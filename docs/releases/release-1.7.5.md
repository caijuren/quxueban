# 趣学伴 1.7.5 发布记录

发布日期：2026-04-30

## 修复内容

- 今日概览学习时长：已完成和部分完成都会计入；当打卡没有填写实际分钟数时，按任务计划时长兜底。
- 钉钉今日概览推送：使用与今日概览一致的学习时长算法。
- 修复只有 `daily_checkins.task_id`、没有有效周计划关联时学习时长被漏算的问题。
- 任务完成证据上传支持 Excel 和 PPT 文件，保留图片、音频、视频和 PDF 支持。
- 移除图书馆批量操作组件残留，避免旧批量操作入口继续出现。
- “封神演义改为在读中”脚本支持带书名号或包含匹配，降低正式库书名不完全一致导致脚本没改到的风险。

## 生产更新步骤

```bash
cd /home/ubuntu/backend
git pull
cat package.json | grep version
pnpm install
pnpm prisma migrate deploy
pnpm build
pm2 restart study-planner-api
curl http://127.0.0.1:3001/api/version
```

## 数据修复

如需把《封神演义》改为在读中：

```bash
cd /home/ubuntu/backend
FAMILY_ID=1 CHILD_ID=3 BOOK_NAME=封神演义 pnpm run script:set-book-reading
```

如果正式库的家庭或孩子 ID 不同，替换 `FAMILY_ID` 和 `CHILD_ID` 后再执行。
