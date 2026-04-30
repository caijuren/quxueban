# 趣学伴 1.7.6 发布记录

发布日期：2026-05-01

## 修复内容

- 修复今日概览学习时长重复累计的问题。
- 修复钉钉今日概览学习时长重复累计的问题。
- 同一天、同一个孩子、同一个任务出现多条打卡记录时，只取最后一次打卡参与统计。
- 打卡保存接口收紧：再次提交同一天同孩子同任务时更新已有记录；发现历史重复行时保留最新记录并删除旧重复。
- 新增生产诊断脚本 `pnpm run script:check-daily-study-minutes`，用于查询某天学习时长明细和重复打卡组。
- 本次问题样例：2026-04-30 `古文学习` 有 5 条 completed 记录，每条 27 分钟，旧逻辑累计为 135 分钟；新逻辑只按最后一条 27 分钟统计。

## 发布步骤

```bash
cd /home/ubuntu/backend
git pull
pnpm install
pnpm build
pm2 restart study-planner-api
curl http://127.0.0.1:3001/api/version
```

本次只改后端统计和钉钉逻辑，不需要重新发布前端。

## 诊断命令

```bash
cd /home/ubuntu/backend
FAMILY_ID=1 CHILD_ID=24 CHECK_DATE=2026-04-30 pnpm run script:check-daily-study-minutes
```

完整生产发布流程见 `docs/PRODUCTION_RELEASE_CHECKLIST.md`。
