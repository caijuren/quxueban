# 趣学伴 1.9.1 UI 架构升级版发布记录

发布日期：2026-05-04

## 版本定位

`1.9.1 UI 架构升级版` 聚焦家长端桌面工作台的信息架构和 UI 一致性，不新增复杂业务能力，不引入新的后端 schema。

本版本不把移动端弹窗和移动端截图走查作为发版阻塞项，移动端后续单独规划。

## 本次变更

### 桌面端 UI 收口

- 今日概览、学习计划、目标管理、能力模型、图书详情、数据体检和成就管理的按钮层级统一到 `Button` 组件。
- 主操作、次操作、普通操作、导出操作和危险操作按统一规则呈现。
- 目标管理、能力模型、图书详情等页面去除局部硬编码渐变按钮，减少样式分叉。
- 图书详情“AI阅读洞察”入口文案降级为“阅读洞察”，避免 1.9.1 阶段强化 AI 预期。
- 数据体检说明文案改为面向“后续报告和诊断”的数据缺口预检。

### 阅读异常链路

- 数据体检保留“阅读记录页码异常”检查项。
- 图书详情支持 `?issue=reading-page` 深链路进入异常书。
- 异常阅读记录支持高亮、展示页码异常标签、提供“修正第一条”和“返回数据体检”入口。

### 测试和文档

- 新增 `test_full_website_v2.py`，用于本地桌面端 smoke 检查。
- `test_report.json` 和 `test_screenshots/` 加入 `.gitignore`，避免提交本地测试产物。
- 新增 `docs/checks/regression-1.9.1-ui.md`，记录桌面端截图走查和 smoke 结果。
- 清理早期临时测试脚本 `test_full_website.py` 和 `test_full_website_v3.py`。

## 本地检查

已执行：

```bash
pnpm --filter frontend lint
pnpm --filter frontend build
pnpm --filter quxueban-backend lint
pnpm --filter quxueban-backend build
pnpm run check:versions
python3 test_full_website_v2.py
```

结果：通过。

Smoke 结果：35 项通过，0 失败，0 警告。

## 发版边界

本版本不做：

- 不新增 AI 功能。
- 不做后端 schema 迁移。
- 不做移动端专项适配。
- 不做 1.9.2 的数据治理闭环增强。

## 后续计划

1. 进入 `1.9.2 数据治理闭环版`，把数据体检升级为定位、修复、复查闭环。
2. 继续完善任务、目标、图书和阅读记录的数据补齐入口。
3. 后续单独规划移动端弹窗和移动端工作台体验。
