# 趣学伴文档规范

更新时间：2026-05-01

## 目标

后续文档只保留少量当前入口，历史文档按类型归档。每次迭代都按固定顺序沉淀，避免路线图、ToDo 和 release 报告互相覆盖。

## 文档生命周期

一次版本或专项从计划到归档，按这个顺序写：

1. **路线设计**
   - 先写清楚版本定位、目标、范围、不做什么。
   - 使用 `docs/version-roadmap.md` 维护主路线。
   - 大专项可新增设计文档，例如 `design-education-stage-model.md`。

2. **ToDo 拆解**
   - 所有当前任务进入 `docs/todo-master.md`。
   - ToDo 必须有状态：未开始、进行中、已完成、暂不做、后置。
   - 不再为每个小版本新增分散的 `todo-*.md`，除非是大型专项且在 `todo-master.md` 中有入口。

3. **开发与验收**
   - 开发过程中更新 `docs/current-progress.md`。
   - 生产发布按 `production-release-checklist.md` 和 `workflow-conventions.md`。

4. **Release 报告**
   - 发布完成后写 release 报告。
   - 报告先放入 `docs/releases/`。
   - 当前版本若仍在验收，可在 `current-progress.md` 保留摘要。

5. **归档**
   - 已被新计划替代的路线图、ToDo、检查报告进入对应历史目录。
   - 根目录只保留当前仍然会被频繁阅读和维护的文档。

## 当前根目录保留规则

根目录只放当前有效文档：

- `README.md`：文档入口。
- `product-codebase-overview.md`：产品与代码结构总览。
- `current-progress.md`：当前进度。
- `todo-master.md`：唯一总 ToDo。
- `version-roadmap.md`：唯一版本路线图。
- `documentation-guide.md`：文档规范。
- `design-education-stage-model.md`：当前阶段化设计。
- `draft-ability-model-1.8.md`：当前能力模型工作底稿。
- `design-reading-data-flow.md`：当前阅读数据流设计。
- `workflow-conventions.md`：协作规范。
- `production-release-checklist.md`：发布检查。
- `deployment.md`：部署流程。
- 与当前产品背景直接相关的资料。

## 命名规范

从 2026-05-01 起，新文档统一使用小写 `kebab-case`。

### 当前主文档

- `todo-master.md`
- `version-roadmap.md`
- `current-progress.md`
- `README.md`

### 设计文档

格式：

```text
design-<domain>.md
```

示例：

- `design-education-stage-model.md`
- `design-reading-data-flow.md`

设计草案使用 `draft-<topic>-<version>.md`，例如 `draft-ability-model-1.8.md`。

### Release 报告

目录：

```text
docs/releases/
```

格式：

```text
release-<major>.<minor>.<patch>.md
```

示例：

- `release-1.8.0.md`
- `release-1.8.1.md`

不要再新增 `release-1.8.md` 这种无 patch 的文件，除非它是大版本总说明。

### 历史路线图

目录：

```text
docs/roadmaps/
```

格式：

```text
roadmap-<range-or-version>.md
```

示例：

- `roadmap-1.8-to-2.0.md`
- `roadmap-2026-h1.md`

当前路线只维护 `docs/version-roadmap.md`。

### 历史 ToDo 和问题清单

目录：

```text
docs/todos/
```

格式：

```text
todo-<version-or-topic>.md
issues-<version-or-topic>.md
```

当前 ToDo 只维护 `docs/todo-master.md`。

### 检查和回归

目录：

```text
docs/checks/
```

格式：

```text
check-<version-or-topic>.md
regression-<version-or-topic>.md
baseline-<version-or-topic>.md
```

### 报告

目录：

```text
docs/reports/
```

格式：

```text
report-<topic>.md
analysis-<topic>.md
```

### 运维和生产历史

目录：

```text
docs/operations/
```

用于历史恢复计划、旧部署命令、生产事故收口记录。当前部署文档留在根目录。

## 内容模板

### 路线图模板

```markdown
# <产品/版本>路线图

更新时间：YYYY-MM-DD

## 版本定位

## 当前判断

## 必做范围

## 后置范围

## 明确不做

## 验收标准

## 近期执行顺序
```

### ToDo 模板

```markdown
## P0：<阶段>

### <编号>. <任务名>

状态：未开始/进行中/已完成/暂不做/后置

范围：

验收：

不做：
```

### Release 模板

```markdown
# 趣学伴 <版本号> 发布记录

发布日期：YYYY-MM-DD

## 版本定位

## 本次变更

## 数据库/配置变更

## 验证结果

## 已知问题

## 后续事项
```

## 维护规则

- 新任务先进入 `todo-master.md`，不要直接散落到多个版本文档。
- 新路线先更新 `version-roadmap.md`，旧路线归档。
- 发布后再写 release，不用 release 文档承载未来计划。
- 历史文档可以保留原文，不强制重写内容；规范从新文档开始执行。
- 如果一个文档已经不指导当前开发，就移动到对应历史目录。
