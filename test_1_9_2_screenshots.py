from playwright.sync_api import sync_playwright
import json
import os
import time

BASE_URL = os.environ.get("FRONTEND_URL", "http://127.0.0.1:5175").rstrip("/")
USERNAME = os.environ.get("TEST_USERNAME", "andycoy")
PASSWORD = os.environ.get("TEST_PASSWORD", "123456")
ALLOW_REGISTER = os.environ.get("ALLOW_REGISTER", "true") == "true"
SELECTED_CHILD_ID = os.environ.get("SELECTED_CHILD_ID", "3")
PLAYWRIGHT_BROWSER = os.environ.get("PLAYWRIGHT_BROWSER", "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge")
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
SCREENSHOT_DIR = os.path.join(ROOT_DIR, "test_screenshots")
REPORT_PATH = os.path.join(ROOT_DIR, "test_1_9_2_report.json")

report = {
    "summary": {"total": 0, "passed": 0, "failed": 0, "warnings": 0},
    "tests": [],
}


def log_test(name, status, details="", screenshot=None):
    report["tests"].append({
        "name": name,
        "status": status,
        "details": details,
        "screenshot": screenshot,
    })
    report["summary"]["total"] += 1
    if status == "PASS":
        report["summary"]["passed"] += 1
    elif status == "FAIL":
        report["summary"]["failed"] += 1
    else:
        report["summary"]["warnings"] += 1
    print(f"[{status}] {name}: {details}")


def login(page):
    page.goto(f"{BASE_URL}/login", wait_until="networkidle")
    page.fill('input[name="quxueban-login-username"]', USERNAME)
    page.fill('input[name="quxueban-login-password"]', PASSWORD)
    page.click('button[type="submit"]')
    page.wait_for_timeout(3000)
    if "/parent" not in page.url:
        if not ALLOW_REGISTER:
            log_test("登录", "FAIL", f"登录后未进入家长端，当前 URL: {page.url}")
            return False

        temp_username = f"shot-{int(time.time())}"
        temp_password = "Test123456"
        page.goto(f"{BASE_URL}/register", wait_until="networkidle")
        page.fill('input[placeholder="输入用户名"]', temp_username)
        page.fill('input[placeholder="至少6位密码"]', temp_password)
        page.fill('input[placeholder="再次输入密码"]', temp_password)
        page.click('button[type="submit"]')
        page.wait_for_timeout(3000)
        if "/parent" not in page.url:
            log_test("临时账号注册", "FAIL", f"注册后未进入家长端，当前 URL: {page.url}")
            return False
        log_test("临时账号注册", "PASS", f"使用临时账号 {temp_username} 完成截图登录")
    page.evaluate("(childId) => localStorage.setItem('selected_child_id', childId)", SELECTED_CHILD_ID)
    log_test("登录", "PASS", "已进入家长端")
    return True


def check_text(page, name, selectors):
    ok = True
    for selector, desc in selectors:
        if page.locator(selector).count() > 0:
            log_test(f"{name}-{desc}", "PASS", f"{desc}正常显示")
        else:
            log_test(f"{name}-{desc}", "FAIL", f"{desc}未找到")
            ok = False
    return ok


def screenshot_page(page, url, name, file_name, selectors):
    page.goto(url, wait_until="networkidle")
    page.wait_for_timeout(2500)
    path = os.path.join(SCREENSHOT_DIR, file_name)
    page.screenshot(path=path, full_page=True)
    check_text(page, name, selectors)


def open_goal_dialog(page):
    page.goto(f"{BASE_URL}/parent/goals?category=交付层&point=英语能力", wait_until="networkidle")
    page.wait_for_timeout(2500)
    check_text(page, "目标配置器", [
        ("text=创建目标", "创建目标标题"),
        ("text=目标方向", "目标方向字段"),
        ("text=所属层级", "所属层级字段"),
        ("text=能力点", "能力点字段"),
        ("text=完成标准", "完成标准字段"),
        ("text=保存并关联任务", "保存并关联任务按钮"),
    ])
    page.screenshot(path=os.path.join(SCREENSHOT_DIR, "18_goal_configurator_1_9_2.png"), full_page=True)


def open_task_dialog(page):
    page.goto(f"{BASE_URL}/parent/tasks?category=交付层&point=英语能力", wait_until="networkidle")
    page.wait_for_timeout(2500)
    check_text(page, "任务创建器", [
        ("text=新建任务", "新建任务标题"),
        ("text=三层归属", "三层归属区域"),
        ("text=英语能力", "预填能力点"),
    ])
    page.screenshot(path=os.path.join(SCREENSHOT_DIR, "19_task_configurator_1_9_2.png"), full_page=True)


def main():
    os.makedirs(SCREENSHOT_DIR, exist_ok=True)

    with sync_playwright() as p:
        launch_options = {"headless": True}
        if PLAYWRIGHT_BROWSER and os.path.exists(PLAYWRIGHT_BROWSER):
            launch_options["executable_path"] = PLAYWRIGHT_BROWSER
        browser = p.chromium.launch(**launch_options)
        page = browser.new_page(viewport={"width": 1440, "height": 900})

        if login(page):
            screenshot_page(page, f"{BASE_URL}/parent/ability-model", "三层准备度", "09_ability_1_9_2.png", [
                ("text=三层准备度模型", "页面标题"),
                ("text=三公基础模板", "默认模板"),
                ("text=观察指标", "观察指标列"),
                ("text=数据来源", "数据来源列"),
                ("text=目标", "目标关联"),
                ("text=任务", "任务关联"),
            ])
            screenshot_page(page, f"{BASE_URL}/parent/goals", "目标管理", "08_goals_1_9_2.png", [
                ("text=目标准备工作台", "页面标题"),
                ("text=当前目标方向", "目标方向区"),
                ("text=三层覆盖", "三层覆盖区"),
                ("text=下一步动作", "下一步动作区"),
            ])
            open_goal_dialog(page)
            open_task_dialog(page)

        browser.close()

    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(json.dumps(report["summary"], ensure_ascii=False))
    if report["summary"]["failed"] > 0:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
