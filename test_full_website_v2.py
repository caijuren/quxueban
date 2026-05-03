from playwright.sync_api import sync_playwright
import json
import os

BASE_URL = os.environ.get("FRONTEND_URL", "http://127.0.0.1:5174").rstrip("/")
API_URL = os.environ.get("BACKEND_URL", "http://127.0.0.1:3001").rstrip("/")
USERNAME = os.environ.get("TEST_USERNAME", "andycoy")
PASSWORD = os.environ.get("TEST_PASSWORD", "123456")
PLAYWRIGHT_BROWSER = os.environ.get("PLAYWRIGHT_BROWSER", "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge")
TEST_BOOK_ID = os.environ.get("TEST_BOOK_ID", "2260")
ANOMALY_BOOK_ID = os.environ.get("ANOMALY_BOOK_ID", "2241")
SELECTED_CHILD_ID = os.environ.get("SELECTED_CHILD_ID", "3")
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
SCREENSHOT_DIR = os.path.join(ROOT_DIR, "test_screenshots")
REPORT_PATH = os.path.join(ROOT_DIR, "test_report.json")

# 测试报告
report = {
    "summary": {"total": 0, "passed": 0, "failed": 0, "warnings": 0},
    "tests": []
}

def log_test(name, status, details="", screenshot=None):
    report["tests"].append({
        "name": name,
        "status": status,
        "details": details,
        "screenshot": screenshot
    })
    report["summary"]["total"] += 1
    if status == "PASS":
        report["summary"]["passed"] += 1
    elif status == "FAIL":
        report["summary"]["failed"] += 1
    else:
        report["summary"]["warnings"] += 1
    print(f"[{status}] {name}: {details}")

def test_login(page):
    """测试登录功能"""
    try:
        page.goto(f'{BASE_URL}/login')
        page.wait_for_load_state('networkidle')
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, '01_login.png'))

        # 检查登录页面元素
        if page.locator('text=欢迎回来').count() > 0 or page.locator('text=登录').count() > 0:
            log_test("登录页面加载", "PASS", "登录页面正常加载")
        else:
            log_test("登录页面加载", "FAIL", "登录页面元素未找到")
            return False

        # 尝试登录 - 使用 name 属性选择器
        try:
            page.fill('input[name="quxueban-login-username"]', USERNAME)
            page.fill('input[name="quxueban-login-password"]', PASSWORD)
            page.click('button[type="submit"]')
            page.wait_for_timeout(3000)
            page.screenshot(path=os.path.join(SCREENSHOT_DIR, '02_after_login.png'))

            # 检查是否登录成功 - 检查URL或页面内容
            current_url = page.url
            if '/parent' in current_url:
                log_test("用户登录", "PASS", f"登录成功，当前URL: {current_url}")
                return True
            else:
                # 检查是否有错误提示
                error_msg = page.locator('text=登录失败').count()
                if error_msg > 0:
                    log_test("用户登录", "WARNING", "登录失败，可能是密码错误")
                else:
                    log_test("用户登录", "WARNING", f"登录后未跳转到预期页面，当前URL: {current_url}")
                return False
        except Exception as e:
            log_test("用户登录", "WARNING", f"登录操作失败: {str(e)}")
            return False

    except Exception as e:
        log_test("登录功能", "FAIL", f"登录测试失败: {str(e)}")
        return False

def test_page(page, url, name, selectors, screenshot_name):
    """通用页面测试"""
    try:
        page.goto(url)
        page.wait_for_load_state('networkidle')
        page.wait_for_timeout(2000)
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, screenshot_name))

        found_any = False
        for selector, desc in selectors:
            if page.locator(selector).count() > 0:
                log_test(f"{name}-{desc}", "PASS", f"{desc}正常显示")
                found_any = True
            else:
                log_test(f"{name}-{desc}", "WARNING", f"{desc}未找到")

        if not found_any:
            log_test(f"{name}页面", "WARNING", "页面可能未正确加载或需要登录")

    except Exception as e:
        log_test(f"{name}", "FAIL", f"测试失败: {str(e)}")

def test_api_endpoints():
    """测试 API 端点"""
    import requests

    endpoints = [
        ("GET", f"{API_URL}/api/health", "健康检查"),
        ("GET", f"{API_URL}/api/version", "版本信息"),
    ]

    for method, url, name in endpoints:
        try:
            response = requests.request(method, url, timeout=5)
            if response.status_code == 200:
                log_test(f"API-{name}", "PASS", f"{name}正常，状态码: {response.status_code}")
            else:
                log_test(f"API-{name}", "WARNING", f"{name}返回状态码: {response.status_code}")
        except Exception as e:
            log_test(f"API-{name}", "FAIL", f"{name}请求失败: {str(e)}")

def test_reading_anomaly_flow(page):
    """测试数据体检到阅读页码异常高亮的深链路"""
    try:
        page.goto(f'{BASE_URL}/parent/data-quality')
        page.wait_for_load_state('networkidle')
        page.wait_for_timeout(2000)

        if page.locator('text=阅读记录页码异常').count() > 0:
            log_test("阅读异常链路-数据体检入口", "PASS", "数据体检展示阅读记录页码异常检查项")
        else:
            log_test("阅读异常链路-数据体检入口", "WARNING", "未找到阅读记录页码异常检查项，可能当前数据无异常")
            return

        page.goto(f'{BASE_URL}/parent/library/{ANOMALY_BOOK_ID}?issue=reading-page')
        page.wait_for_load_state('networkidle')
        page.wait_for_timeout(2500)
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, '17_reading_page_anomaly.png'), full_page=True)

        checks = [
            ('text=已高亮', '异常高亮提示'),
            ('text=修正第一条', '修正第一条入口'),
            ('text=页码异常', '页码异常标签'),
            ('text=返回数据体检', '返回数据体检入口'),
        ]
        for selector, desc in checks:
            if page.locator(selector).count() > 0:
                log_test(f"阅读异常链路-{desc}", "PASS", f"{desc}正常显示")
            else:
                log_test(f"阅读异常链路-{desc}", "FAIL", f"{desc}未找到")
    except Exception as e:
        log_test("阅读异常链路", "FAIL", f"测试失败: {str(e)}")

def main():
    import os
    os.makedirs(SCREENSHOT_DIR, exist_ok=True)

    print("=" * 60)
    print("趣学伴网站全面功能测试")
    print("=" * 60)

    # 测试 API
    print("\n[1/3] 测试 API 端点...")
    test_api_endpoints()

    # 测试前端页面
    print("\n[2/3] 测试前端页面...")
    with sync_playwright() as p:
        launch_options = {"headless": True}
        if PLAYWRIGHT_BROWSER and os.path.exists(PLAYWRIGHT_BROWSER):
            launch_options["executable_path"] = PLAYWRIGHT_BROWSER
        browser = p.chromium.launch(**launch_options)
        page = browser.new_page(viewport={'width': 1440, 'height': 900})

        # 测试登录
        is_logged_in = test_login(page)

        if is_logged_in:
            if SELECTED_CHILD_ID:
                page.evaluate("(childId) => localStorage.setItem('selected_child_id', childId)", SELECTED_CHILD_ID)

            # 测试各个页面
            test_page(page, f'{BASE_URL}/parent', '首页', [
                ('text=概览', '概览标题'),
                ('text=今日概览', '今日概览'),
                ('text=任务', '任务区域'),
            ], '03_homepage.png')

            test_page(page, f'{BASE_URL}/parent/tasks', '任务管理', [
                ('text=任务', '任务标题'),
                ('text=任务管理', '任务管理'),
            ], '04_tasks.png')

            test_page(page, f'{BASE_URL}/parent/plans', '学习计划', [
                ('text=学习计划', '学习计划标题'),
                ('text=计划', '计划'),
            ], '05_plans.png')

            test_page(page, f'{BASE_URL}/parent/library', '图书馆', [
                ('text=图书馆', '图书馆标题'),
                ('text=图书', '图书'),
            ], '06_library.png')

            test_page(page, f'{BASE_URL}/parent/library/{TEST_BOOK_ID}', '图书详情', [
                ('text=阅读记录', '阅读记录入口'),
                ('text=阅读洞察', '阅读洞察入口'),
                ('text=成长档案', '成长档案'),
            ], '15_book_detail.png')

            test_page(page, f'{BASE_URL}/parent/reading', '阅读中心', [
                ('text=阅读', '阅读标题'),
            ], '07_reading.png')

            test_page(page, f'{BASE_URL}/parent/goals', '目标管理', [
                ('text=目标', '目标标题'),
            ], '08_goals.png')

            test_page(page, f'{BASE_URL}/parent/ability-model', '能力模型', [
                ('text=能力', '能力标题'),
                ('text=三层准备度', '三层准备度'),
            ], '09_ability.png')

            test_page(page, f'{BASE_URL}/parent/growth-dashboard', '仪表盘', [
                ('text=成长总览', '成长总览'),
                ('text=成长', '成长'),
            ], '10_dashboard.png')

            test_page(page, f'{BASE_URL}/parent/data-quality', '数据体检', [
                ('text=数据体检', '数据体检标题'),
                ('text=修复', '修复入口'),
            ], '16_data_quality.png')

            test_reading_anomaly_flow(page)

            test_page(page, f'{BASE_URL}/parent/settings', '设置', [
                ('text=设置', '设置标题'),
            ], '11_settings.png')

            test_page(page, f'{BASE_URL}/parent/reports', '学习报告', [
                ('text=报告', '报告标题'),
                ('text=学习报告', '学习报告'),
            ], '12_reports.png')

            test_page(page, f'{BASE_URL}/parent/achievements', '成就', [
                ('text=成就', '成就标题'),
            ], '13_achievements.png')

            test_page(page, f'{BASE_URL}/parent/statistics', '学习统计', [
                ('text=统计', '统计标题'),
                ('text=学习统计', '学习统计'),
            ], '14_statistics.png')
        else:
            log_test("页面测试", "WARNING", "由于登录失败，跳过其他页面测试")

        browser.close()

    # 生成报告
    print("\n" + "=" * 60)
    print("测试报告")
    print("=" * 60)
    print(f"总计: {report['summary']['total']}")
    print(f"通过: {report['summary']['passed']}")
    print(f"失败: {report['summary']['failed']}")
    print(f"警告: {report['summary']['warnings']}")
    if report['summary']['total'] > 0:
        print(f"通过率: {report['summary']['passed']/report['summary']['total']*100:.1f}%")

    # 保存详细报告
    with open(REPORT_PATH, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(f"\n详细报告已保存到: {REPORT_PATH}")
    print(f"截图已保存到: {SCREENSHOT_DIR}/")

if __name__ == "__main__":
    main()
