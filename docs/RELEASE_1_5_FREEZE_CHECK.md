# 趣学伴 1.5 封板检查记录

检查时间：2026-04-27

## 当前结论

1.5 已进入封板检查阶段。

自动化检查、本地运行态健康检查和主要 P0 接口回归已通过。图书导入、设置页重构、仪表盘真实数据接入已明确后移，不阻塞 1.5 封板。

## 自动化检查结果

| 项目 | 命令 | 结果 | 备注 |
| --- | --- | --- | --- |
| 前端 lint | `cd frontend && pnpm lint` | 通过 |  |
| 前端构建 | `cd frontend && pnpm build` | 通过 | Vite 大 chunk 提示，不阻塞上线 |
| 前端测试 | `cd frontend && pnpm test -- --run` | 通过 | 1 个测试文件，3 个用例 |
| 后端 lint | `cd backend && pnpm lint` | 通过 |  |
| 后端构建 | `cd backend && pnpm build` | 通过 | Prisma Client 已生成 |
| 后端测试 | `cd backend && pnpm test --runInBand` | 通过 | 1 个测试文件，7 个用例；沙箱内监听端口受限，已在沙箱外复测通过 |

## 数据库检查结果

| 项目 | 命令 | 结果 | 备注 |
| --- | --- | --- | --- |
| PostgreSQL 可连接 | `pg_isready -h localhost -p 5432` | 通过 | `localhost:5432 - accepting connections` |
| Prisma migration 状态 | `cd backend && npx prisma migrate status` | 通过 | 10 个 migration，数据库结构已是最新 |

## 本地运行态检查

| 项目 | 地址 | 结果 | 备注 |
| --- | --- | --- | --- |
| 后端基础健康检查 | `http://127.0.0.1:3001/api/health` | 通过 | 返回 `{"status":"ok"}` |
| 后端 ready 检查 | `http://127.0.0.1:3001/api/health/ready` | 通过 | 数据库 `connected` |
| 后端版本接口 | `http://127.0.0.1:3001/api/version` | 通过 | 当前运行态 API 前缀为 `/api` |
| 前端服务 | `http://127.0.0.1:5173` | 通过 | HTTP 200 |

## P0 接口回归结果

| 项目 | 结果 | 备注 |
| --- | --- | --- |
| 登录 | 通过 | `andycoy / 123456` 可登录 |
| 孩子列表 | 通过 | 当前返回 2 个 active 孩子 |
| 孩子新增/编辑/删除 | 通过 | 使用临时孩子完成闭环测试，测试孩子已删除 |
| 家庭设置保存 | 通过 | 原值保存成功 |
| 孩子学期配置保存 | 通过 | 测试写入成功，测试配置已恢复 |
| 孩子钉钉配置保存 | 通过 | 测试写入成功，测试 webhook 已清理 |
| Excel 图书导入 | 已验证但不纳入 1.5 上线范围 | 1 行临时 Excel 导入成功，有 progress 和 success 反馈；产品决策为后续再做 |
| 图书删除 | 通过 | 导入测试书已删除 |
| 用户名修改 | 通过 | 同名保存成功，未改变实际用户名 |
| 密码修改 | 通过 | 用相同密码重写成功，随后登录仍正常 |
| 数据导出 | 已修复并通过 | 原 500，原因是下载 header 使用中文文件名；已改为家庭编码文件名并复测 200 |

## 本轮修复

- 修复数据导出接口 `Content-Disposition` 文件名含中文导致 500 的问题。
- 当前导出文件名格式：`quxueban_backup_<familyCode>_<YYYY-MM-DD>.json`。

## 当前工作区状态

当前工作区仍有大量未提交改动，涉及：

- 后端任务、计划、阅读、图书馆、仪表盘、孩子管理等模块。
- 前端今日概览、任务管理、学习计划、图书馆、报告、设置、目标管理、仪表盘、公共组件。
- 1.5/1.8/2.0 文档。
- 配置文件调整和旧文件删除。

正式上线前建议按主题拆分提交，至少分为：

1. `docs: add 1.5 release and roadmap docs`
2. `feat: align parent navigation and page toolbar`
3. `feat: refine dashboard tasks plans and goals`
4. `feat: refine library reading reports and settings`
5. `fix: stabilize backend tasks plans reading and library`
6. `chore: update lint test config`

## 仍需浏览器人工确认的封板项

以下项目不适合只靠自动化判断，正式上线前建议人工走一遍：

1. 今日概览、任务管理、学习计划、图书馆主流程能正常进入和操作。
2. 孩子切换在顶部可用，切换后核心页面数据刷新。
3. 图书馆不把导入作为 1.5 必测项；导入功能后续专项处理。
4. 设置页不作为 1.5 重构范围；账号、家庭、孩子、通知、危险操作统一进入 1.8。
5. 仪表盘允许保留静态图表和静态榜单；1.8 再接真实数据源。
6. 全站无明显崩溃、白屏、无法关闭弹窗、按钮遮挡等发布级问题。

## 封板建议

- 自动化与运行态：通过。
- 数据库：本地 migration 状态通过；生产库仍需按线上环境单独确认。
- 产品范围：图书导入、设置页重构、仪表盘真实数据已后移，不阻塞 1.5。
- 发布动作：建议完成最后一轮浏览器冒烟验收后，执行提交、打标签、部署。
