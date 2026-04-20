# Packages 目录说明

本目录包含项目的各个子包，采用 monorepo 结构管理。

## 目录结构

```
packages/
├── dashboard/      # Vue 技术栈的管理仪表盘（开发中）
├── parent-app/     # React 家长端应用（与 frontend/ 目录重复，待评估）
└── shared/         # 共享类型定义和工具函数
```

## 各包说明

### dashboard/
- **技术栈**: Vue 3 + Vite
- **用途**: 管理后台仪表盘
- **状态**: 开发中，尚未集成到主应用

### parent-app/
- **技术栈**: React + TypeScript + Vite
- **用途**: 家长端应用
- **注意**: 此目录与项目根目录的 `frontend/` 内容高度重复
  - `frontend/` 是当前主要维护的版本
  - `parent-app/` 保留用于历史参考，后续可能合并或删除

### shared/
- **技术栈**: TypeScript
- **用途**: 共享类型定义、API 客户端、工具函数
- **注意**: 目前 `frontend/` 和 `parent-frontend/` 仍使用各自的实现，未完全接入此包

## 使用建议

1. **新功能开发**: 优先在 `frontend/` 目录进行
2. **类型共享**: 逐步将通用类型迁移到 `shared/` 包
3. **代码复用**: 避免在多个包中重复实现相同功能
4. **后续规划**: 评估是否继续维护 monorepo 结构，或合并为单一应用

## 注意事项

- 修改 `shared/` 中的代码时，需检查是否影响其他包
- `parent-app/` 中的修改可能不会同步到生产环境
- 运行各包前请先阅读对应目录的 README.md
