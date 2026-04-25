# 趣学伴产品与代码结构说明

更新时间：2026-04-25

## 一、产品定位

趣学伴是一套面向家庭场景的学习管理系统。

核心目标：

- 家长制定和管理任务
- 家长查看孩子的学习与阅读执行情况
- 系统沉淀数据并形成复盘
- 通过 AI 提供阶段性总结与建议

它不是单一的待办工具，而是一个围绕“任务、阅读、记录、复盘、建议”构建的家庭学习操作系统。

---

## 二、当前产品主线

当前系统围绕这条主线运转：

`任务/图书输入 -> 周计划分配 -> 每日执行记录 -> 数据统计 -> 学习报告 -> 下一步调整`

---

## 三、核心模块说明

### 1. 首页

作用：

- 展示当前孩子的当天学习情况
- 展示当日任务与完成状态
- 展示当天学习时长、完成率、阅读情况

### 2. 任务管理

作用：

- 创建任务模板
- 管理任务分类、规则、学科和完成方式
- 为计划发布提供任务来源

### 3. 学习计划

作用：

- 将任务映射到某一周
- 生成每个孩子每天的学习安排
- 与首页当日任务同步

### 4. 图书馆

作用：

- 管理当前孩子的书目
- 展示在读 / 已读 / 未开始
- 支撑阅读记录与图书详情

### 5. 阅读

作用：

- 查看当前在读内容
- 更新阅读进度
- 承担阅读记录入口

### 6. 成就

作用：

- 家长端查看和管理成就
- 展示阶段性成长反馈

### 7. 学习统计

作用：

- 从任务与阅读数据中生成复盘视图
- 展示时间、完成率、结构分布和趋势

### 8. 学习报告

作用：

- 基于当前孩子的数据生成阶段总结
- 提供亮点、建议与趋势性总结

### 9. 设置

作用：

- 账户信息
- 家庭设置
- 孩子管理
- 学习设置
- 通知偏好
- AI 设置
- 数据管理
- 危险区域

---

## 四、当前业务原则

### 1. 孩子数据严格隔离

虽然处于同一家庭下，但系统当前原则是：

- 每个孩子的数据独立
- 不做默认共享
- 所有任务、图书、阅读、统计、报告都围绕当前孩子

### 2. 家长端为主

当前产品的主要完整能力都在家长端。  
孩子端相关能力目前不是主要范围。

### 3. 阅读与任务并列

系统不只是任务系统，也不只是阅读系统，而是：

- 任务体系
- 阅读体系
- 统计体系
- 报告体系

共同构成的复合产品。

---

## 五、源码结构说明

## 根目录

主要目录：

- [frontend](/Users/grubby/Desktop/quxueban/frontend)
- [backend](/Users/grubby/Desktop/quxueban/backend)
- [packages](/Users/grubby/Desktop/quxueban/packages)
- [prisma](/Users/grubby/Desktop/quxueban/prisma)
- [scripts](/Users/grubby/Desktop/quxueban/scripts)
- [docs](/Users/grubby/Desktop/quxueban/docs)

说明：

- `frontend` 是主前端应用
- `backend` 是主后端服务
- `packages` 是共享包与子模块
- `prisma` 是数据库 schema 与迁移
- `scripts` 是辅助脚本
- `docs` 是产品、版本和说明文档

---

## 前端结构

主目录：
- [frontend/src](/Users/grubby/Desktop/quxueban/frontend/src)

核心子目录：

- [frontend/src/pages](/Users/grubby/Desktop/quxueban/frontend/src/pages)
  页面层

- [frontend/src/pages/parent](/Users/grubby/Desktop/quxueban/frontend/src/pages/parent)
  家长端核心页面

- [frontend/src/pages/parent/settings](/Users/grubby/Desktop/quxueban/frontend/src/pages/parent/settings)
  设置页子模块

- [frontend/src/components](/Users/grubby/Desktop/quxueban/frontend/src/components)
  公共组件

- [frontend/src/components/ui](/Users/grubby/Desktop/quxueban/frontend/src/components/ui)
  基础 UI 组件

- [frontend/src/components/parent](/Users/grubby/Desktop/quxueban/frontend/src/components/parent)
  家长端业务组件

- [frontend/src/components/parent/library](/Users/grubby/Desktop/quxueban/frontend/src/components/parent/library)
  图书馆相关组件

- [frontend/src/contexts](/Users/grubby/Desktop/quxueban/frontend/src/contexts)
  全局上下文，如当前孩子上下文

- [frontend/src/hooks](/Users/grubby/Desktop/quxueban/frontend/src/hooks)
  认证、数据查询等 hooks

- [frontend/src/lib](/Users/grubby/Desktop/quxueban/frontend/src/lib)
  API 客户端、工具函数等

- [frontend/src/types](/Users/grubby/Desktop/quxueban/frontend/src/types)
  类型定义

---

## 后端结构

主目录：
- [backend/src](/Users/grubby/Desktop/quxueban/backend/src)

核心子目录：

- [backend/src/modules](/Users/grubby/Desktop/quxueban/backend/src/modules)
  业务模块入口

当前关键模块包括：

- [backend/src/modules/auth.ts](/Users/grubby/Desktop/quxueban/backend/src/modules/auth.ts)
  登录、注册、家长、孩子相关认证与基本资料接口

- [backend/src/modules/tasks.ts](/Users/grubby/Desktop/quxueban/backend/src/modules/tasks.ts)
  任务管理与计划发布核心逻辑

- [backend/src/modules/plans.ts](/Users/grubby/Desktop/quxueban/backend/src/modules/plans.ts)
  学习计划与每日打卡

- [backend/src/modules/dashboard.ts](/Users/grubby/Desktop/quxueban/backend/src/modules/dashboard.ts)
  首页数据汇总

- [backend/src/modules/library.ts](/Users/grubby/Desktop/quxueban/backend/src/modules/library.ts)
  图书馆与图书信息相关逻辑

- [backend/src/modules/reading.ts](/Users/grubby/Desktop/quxueban/backend/src/modules/reading.ts)
  当前阅读与阅读状态

- [backend/src/modules/reading-logs.ts](/Users/grubby/Desktop/quxueban/backend/src/modules/reading-logs.ts)
  阅读记录

- [backend/src/modules/statistics.ts](/Users/grubby/Desktop/quxueban/backend/src/modules/statistics.ts)
  学习统计相关接口

- [backend/src/modules/reports.ts](/Users/grubby/Desktop/quxueban/backend/src/modules/reports.ts)
  学习报告相关接口

- [backend/src/modules/dingtalk.ts](/Users/grubby/Desktop/quxueban/backend/src/modules/dingtalk.ts)
  钉钉推送

- [backend/src/modules/children.ts](/Users/grubby/Desktop/quxueban/backend/src/modules/children.ts)
  孩子详情与钉钉配置等扩展接口

其他目录：

- [backend/src/config](/Users/grubby/Desktop/quxueban/backend/src/config)
  数据库、环境变量、日志等配置

- [backend/src/middleware](/Users/grubby/Desktop/quxueban/backend/src/middleware)
  认证、中间件、错误处理、日志

- [backend/src/services](/Users/grubby/Desktop/quxueban/backend/src/services)
  服务层能力

---

## 六、数据库相关

主要文件：

- [backend/prisma/schema.prisma](/Users/grubby/Desktop/quxueban/backend/prisma/schema.prisma)

需要特别注意：

- 线上数据库结构与当前 Prisma schema 并非完全一致
- 数据库真实情况请参考：
  [DATABASE_REALITY_REPORT.md](/Users/grubby/Desktop/quxueban/DATABASE_REALITY_REPORT.md)

这意味着：

- 新功能开发前需要先核对真实表结构
- 不能默认以 Prisma schema 为唯一真实来源

---

## 七、当前版本状态

### 1.2

稳定发布版  
目标是将已经确认的改动正式整理、提交并更新到正式环境。

### 1.5

体验与结构优化版  
重点在：

- 全站统一
- 图书馆重构
- 阅读升级
- 学习统计与学习报告重构
- 设置页统一
- 历史导入专项

### 2.0

能力模型与 AI 升级版  
重点在：

- 孩子能力模型
- AI 分析与建议升级

