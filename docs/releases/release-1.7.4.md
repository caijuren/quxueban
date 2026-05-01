# 趣学伴 1.7.4 发布记录

更新时间：2026-04-30

## 版本定位

`1.7.4 = 图书馆阅读状态 + 今日概览统计口径 + 钉钉推送 + 节假日排程修复版`

1.7.4 是 1.7 稳定期内的小步修复版本，重点处理真实使用中暴露的图书馆、阅读记录、今日概览、钉钉推送和节假日排程问题。  
本版本不做 1.8 的结构性重构，不新增大型模块。

## 一、图书馆与阅读记录

### 已完成

- 书籍详情页阅读状态改为展示最近阅读记录中的阅读阶段，不再展示孩子当前学期阶段。
- 添加/编辑阅读记录时，阅读阶段改为下拉菜单。
- 阅读日期选择完具体日期后，日期弹窗自动关闭。
- 编辑阅读记录时，孩子表现字段可保存长文本。
- `reading_logs.performance` 从 `varchar(200)` 扩为 `text`。
- 图书详情页封面背景去掉紫色渐变，改为浅灰底。
- 图书详情页删除图书按钮移动到阅读笔记下面。
- 图书馆卡片去掉多选、编辑、删除按钮，卡片点击进入详情页。
- 批量操作栏暂时隐藏。
- 图书封面展示改为 `object-contain`，避免封面四周被裁掉。
- 图书馆首页卡片默认按最近阅读记录时间倒序排列。
- 图书馆首页“最近在读”改为最近一次有阅读记录的书，不再限定状态必须是在读中。
- 新增脚本 `backend/scripts/set-book-reading-status.ts`，用于将指定图书改为在读中。

### 正式库修复脚本

```bash
cd backend
FAMILY_ID=正式家庭ID CHILD_ID=孩子ID BOOK_NAME=封神演义 pnpm script:set-book-reading
```

脚本会同步处理：

- `book_read_states.status = reading`
- `book_read_states.finished_at = null`
- `active_readings` 中补齐或更新 `reading` 记录

## 二、今日概览与钉钉推送

### 已完成

- 今日概览学习时长统一为 `已完成 + 部分完成`。
- 学习时长优先使用实际填写分钟数。
- 没有实际填写分钟数时，回退为 `任务预计时长 * 次数`。
- 实际填写为 `0` 分钟时不再误回退为预计时长。
- 钉钉“今日学习情况”推送使用同一学习时长口径。
- 修复钉钉推送中实际时长被次数重复相乘的问题。
- 钉钉完成率把部分完成计入完成侧，和今日概览保持一致。

## 三、节假日排程

### 已完成

- 任务发布接口支持避开内置法定节假日。
- 发布预览也同步避开内置法定节假日。
- 新增前端内置假期表：`frontend/src/lib/china-holidays.ts`。
- 新增后端内置假期表：`backend/src/utils/china-holidays.ts`。
- 当前内置 2026 全年法定节假日，包括元旦、春节、清明、劳动节、端午、中秋、国庆。
- 新增检查脚本 `pnpm script:check-next-year-holidays`，用于发版或年底提醒下一年假期表是否已补齐。
- 如需在正式发布流程中强制阻断，可使用 `HOLIDAY_CHECK_STRICT=true pnpm script:check-next-year-holidays`。

### 维护原则

中国法定节假日一般在前一年由官方公布，当前系统不依赖运行时联网接口。  
每年官方公布下一年安排后，将日期更新到前后端内置假期表，再随版本发布。这样发布计划时不受第三方接口或网络波动影响。

## 四、品牌与页面资源

- 使用 `UI/logo2.png` 作为网站 logo。
- 前端运行资源为 `frontend/public/logo.png`。
- 标签页标题改为 `趣学伴——家庭学习伙伴`。
- favicon、manifest 图标和侧边栏品牌图标都使用 `logo2`。

## 五、清理

- 清理根目录和 frontend 根目录下无引用的临时 `test*` 文件。
- 保留正式测试目录：
  - `frontend/src/test`
  - `backend/src/__tests__`

## 六、数据库变更

本版本包含 Prisma migration：

- `20260430090000_expand_reading_log_performance`

上线时必须执行：

```bash
cd backend
pnpm prisma migrate deploy
```

## 七、版本号

- 根 `package.json`：`1.7.4`
- `frontend/package.json`：`1.7.4`
- `backend/package.json`：`1.7.4`
- `backend/src/modules/system.ts`：`1.7.4`

## 八、验证记录

本地已验证：

- `frontend pnpm build`：通过
- `backend pnpm build`：通过
- `backend pnpm prisma migrate deploy`：本地通过
- `/api/health`：正常
- 前端 `http://127.0.0.1:5173`：正常
- 后端 `http://127.0.0.1:3001`：正常
- 《封神演义》状态修复脚本：本地验证成功
- `pnpm script:check-next-year-holidays`：可运行；当前提示 2027 假期表待官方公布后补齐，默认不阻断发版

## 九、发布步骤

1. 确认工作区只包含 1.7.4 相关改动。
2. 推送代码到正式部署分支。
3. 正式环境拉取代码。
4. 安装依赖。
5. 执行数据库迁移：

```bash
cd backend
pnpm prisma migrate deploy
```

6. 构建前端和后端。
7. 重启 PM2 后端服务。
8. 更新 nginx 静态资源。
9. 验证：
   - `/api/health`
   - `/api/health/ready`
   - `/api/version`
   - 登录
   - 今日概览学习时长
   - 钉钉推送
   - 图书馆排序
   - 书籍详情页添加/编辑阅读记录
   - 《封神演义》状态

## 十、上线边界

- 不处理 1.8 能力模型重构。
- 不做自动抓取节假日接口。
- 不做大规模任务/计划重构。
- 不清理所有历史 mock mode 分支。
- 不处理所有后端调试日志，只记录为下一轮改进项。
