# 趣学伴 UI 统一规范

更新时间：2026-05-03

## 版本定位

本文档是趣学伴家长端 UI 统一规范，覆盖页面骨架、按钮、卡片、弹窗、输入框、状态标签、空状态、加载状态、错误状态和图标的使用规则。

## 页面骨架

家长端一级页面统一使用：

1. `PageToolbar`
2. 核心指标或筛选区
3. 主内容区
4. 辅助信息、空状态或弹窗

页面容器统一：

```tsx
<div className="mx-auto max-w-[1360px] space-y-5">
```

## 顶栏

标准顶栏使用 `PageToolbarTitle`：

- 图标：`h-10 w-10 rounded-lg bg-primary/10 text-primary`
- 标题：`text-base font-semibold`
- 描述：`text-xs sm:text-sm text-slate-500`
- 右侧按钮：`h-11 rounded-xl`

## 按钮

统一使用 shadcn `Button` 组件。

### 按钮分类

| 类型 | 使用场景 | 样式 |
|------|---------|------|
| 主操作 | 新增、编辑、发布、创建 | `Button` (默认 variant，紫蓝渐变) |
| 次操作 | 同步、推送、分析 | `Button variant="secondary"` |
| 导出 | 导出报告、数据或图片 | `Button variant="outline"` + `text-emerald-600 border-emerald-200` |
| 普通操作 | 筛选、日期、返回 | `Button variant="outline"` |
| 危险操作 | 删除、重置、移除 | `Button variant="destructive"` |

### 按钮尺寸

| 尺寸 | 使用场景 | 样式 |
|------|---------|------|
| 默认 | 页面主操作按钮 | `size="default"` (h-11 px-6) |
| 小 | 卡片内操作、筛选按钮 | `size="sm"` (h-9 rounded-lg) |
| 大 | 特殊强调 | `size="lg"` (h-12 rounded-lg) |
| 图标按钮 | 只有图标的按钮 | `size="icon"` (size-10 rounded-lg) |
| 小图标按钮 | 紧凑区域 | `size="icon-sm"` (size-8 rounded-lg) |

### 按钮图标间距

- 图标与文字间距：`gap-2` (Button 组件默认)
- 图标大小：`size-4` (Button 组件默认)

## 卡片

普通页面卡片：

```tsx
rounded-xl border border-slate-200 bg-white shadow-sm
```

### 卡片变体

| 类型 | 样式 | 使用场景 |
|------|------|---------|
| 默认卡片 | `rounded-xl border border-slate-200 bg-white shadow-sm` | 页面主要内容卡片 |
| 浅色卡片 | `rounded-xl border border-slate-100 bg-slate-50/70` | 次要信息、辅助区域 |
| 强调卡片 | `rounded-xl border border-primary/20 bg-primary/5` | 重点提示、选中状态 |

### 卡片内部间距

- 卡片 padding：`p-4` (紧凑) 或 `p-5` (宽松)
- 卡片内间距：`space-y-3` 或 `space-y-4`

**注意**：`rounded-3xl` 和 `shadow-2xl` 只用于弹窗，不用于普通页面内容。

## 弹窗

统一使用 shadcn `Dialog` 或 `AlertDialog` 组件。

### 弹窗类型

| 类型 | 使用场景 | 组件 |
|------|---------|------|
| 表单弹窗 | 创建、编辑 | `Dialog` |
| 确认弹窗 | 删除、重置确认 | `AlertDialog` |
| 信息弹窗 | 详情展示 | `Dialog` |

### 弹窗样式

- 圆角：`rounded-3xl` (Dialog 组件默认)
- 阴影：`shadow-xl` (Dialog 组件默认)
- 边框：`border` (Dialog 组件默认)
- 遮罩：`bg-black/50 backdrop-blur-sm`

### 弹窗宽度

| 类型 | 宽度 | 使用场景 |
|------|------|---------|
| 小弹窗 | `sm:max-w-sm` (384px) | 简单确认、删除 |
| 中弹窗 | `sm:max-w-md` (448px) | 一般表单 |
| 默认弹窗 | `sm:max-w-lg` (512px) | 大多数弹窗 |
| 大弹窗 | `sm:max-w-xl` (576px) | 复杂表单 |
| 超大弹窗 | `sm:max-w-2xl` (672px) | 大量内容 |

### 弹窗结构

```tsx
<DialogContent className="sm:max-w-lg">
  <DialogHeader>
    <div className="flex items-center gap-3">
      <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
        <Icon className="size-5 text-primary" />
      </div>
      <div>
        <DialogTitle>标题</DialogTitle>
        <DialogDescription>描述</DialogDescription>
      </div>
    </div>
  </DialogHeader>
  
  {/* 内容区 */}
  <div className="space-y-4">
    {/* 表单或内容 */}
  </div>
  
  <DialogFooter>
    <Button variant="outline">取消</Button>
    <Button>确认</Button>
  </DialogFooter>
</DialogContent>
```

### 弹窗标题图标

- 图标容器：`size-10 rounded-xl bg-primary/10`
- 图标大小：`size-5 text-primary`
- 标题样式：`text-xl font-bold` (DialogTitle 默认)
- 描述样式：`text-sm text-muted-foreground` (DialogDescription 默认)

### 弹窗底部按钮

- 主按钮：`Button` (默认 variant)
- 次按钮：`Button variant="outline"`
- 按钮间距：`gap-3` (DialogFooter 默认)
- 按钮位置：右对齐 `sm:justify-end` (DialogFooter 默认)

## 输入框

统一使用 shadcn `Input` 组件。

### 输入框样式

- 高度：`h-11` (默认)
- 圆角：`rounded-xl` (Input 组件默认)
- 边框：`border border-input` (Input 组件默认)
- 背景：`bg-background` (Input 组件默认)
- Focus：`ring-2 ring-ring/20` (Input 组件默认)

### 输入框变体

| 类型 | 样式 | 使用场景 |
|------|------|---------|
| 默认 | `Input` | 大多数输入框 |
| 大输入框 | `Input className="h-12"` | 需要强调的输入框 |

### 表单标签

- 位置：输入框上方
- 样式：`text-sm font-medium text-slate-700`
- 间距：`mb-1.5`
- 必填标记：`text-red-500 ml-0.5`

### 错误状态

- 输入框边框：`border-red-300 focus:ring-red/20`
- 错误文字：`text-sm text-red-500 mt-1`
- 错误图标：`AlertCircle size-4 text-red-500`

## 状态标签

统一使用 shadcn `Badge` 组件。

### Badge 变体

| 状态 | 样式 | 使用场景 |
|------|------|---------|
| 默认 | `Badge` 或 `Badge variant="default"` | 主题相关标签 |
| 成功 | `Badge className="bg-emerald-50 text-emerald-600 hover:bg-emerald-50"` | 完成、成功状态 |
| 警告 | `Badge className="bg-amber-50 text-amber-600 hover:bg-amber-50"` | 进行中、待处理 |
| 错误 | `Badge className="bg-red-50 text-red-600 hover:bg-red-50"` | 错误、失败状态 |
| 中性 | `Badge variant="outline"` | 默认、无状态 |

### Badge 尺寸

| 尺寸 | 样式 | 使用场景 |
|------|------|---------|
| 默认 | `Badge` (text-xs px-2.5 py-0.5) | 大多数标签 |
| 大 | `Badge className="text-sm px-3 py-1"` | 需要强调的标签 |

## 空状态

统一使用 `EmptyPanel` 组件。

### 空状态结构

```tsx
<EmptyPanel
  icon={<Icon className="size-8" />}
  title="空状态标题"
  description="一句说明文案，引导用户进行下一步操作"
  action={
    <Button>
      <Icon className="size-4 mr-1.5" />
      操作按钮
    </Button>
  }
/>
```

### 空状态样式

- 图标容器：`h-16 w-16 rounded-2xl bg-violet-50 text-violet-500`
- 图标大小：`size-8`
- 标题：`text-lg font-semibold text-slate-900`
- 描述：`text-sm text-slate-500`
- 按钮：标准 Button

### 空状态文案规则

- 明确下一步操作
- 不使用过长解释
- 提供操作按钮（如果适用）

## 加载状态

### 页面加载

使用骨架屏 (Skeleton)：

```tsx
<div className="space-y-4">
  <Skeleton className="h-10 w-full" />
  <Skeleton className="h-32 w-full" />
  <Skeleton className="h-32 w-full" />
</div>
```

骨架屏样式：`bg-slate-100 animate-pulse`

### 按钮加载

```tsx
<Button disabled>
  <Loader2 className="size-4 animate-spin mr-1.5" />
  加载中...
</Button>
```

### 数据加载

使用 Spinner 组件，居中显示：

```tsx
<div className="flex items-center justify-center py-12">
  <Loader2 className="size-6 animate-spin text-slate-400" />
</div>
```

## 错误状态

### 表单错误

```tsx
<div className="space-y-1.5">
  <Label>标签</Label>
  <Input className="border-red-300 focus:ring-red/20" />
  <p className="text-sm text-red-500">错误信息</p>
</div>
```

### 网络错误

使用 Toast 提示：

```tsx
toast.error('操作失败', {
  description: '网络错误，请稍后重试',
})
```

### 空数据

统一使用 EmptyPanel 组件，参考空状态规范。

## 图标

统一使用 `lucide-react` 图标库。

### 图标大小

| 场景 | 大小 | 样式 |
|------|------|------|
| 按钮内图标 | 16px | `size-4` (Button 默认) |
| 标题图标 | 20px | `size-5` |
| 页面图标 | 24px | `size-6` |
| 空状态图标 | 32px | `size-8` |

### 图标颜色

| 场景 | 颜色 | 样式 |
|------|------|------|
| 主要图标 | 灰色 | `text-slate-600` |
| 次要图标 | 浅灰 | `text-slate-400` |
| 主题图标 | 主色 | `text-primary` |
| 危险图标 | 红色 | `text-red-500` |
| 成功图标 | 绿色 | `text-emerald-500` |

### 图标间距

- 图标与文字：`gap-1.5` 或 `gap-2`
- 按钮内图标：`gap-2` (Button 默认)

## 文字颜色

### 标准灰色系

统一使用 `slate-*` 系列：

| 元素 | 颜色 |
|------|------|
| 页面标题 | `text-slate-950` |
| 卡片标题 | `text-slate-900` |
| 正文 | `text-slate-700` |
| 次要文字 | `text-slate-500` |
| 辅助文字 | `text-slate-400` |

### 功能颜色

| 场景 | 颜色 |
|------|------|
| 主色文字 | `text-primary` |
| 成功文字 | `text-emerald-600` |
| 警告文字 | `text-amber-600` |
| 错误文字 | `text-red-600` |

## 当前覆盖范围

1. 能力模型
2. 任务管理
3. 学习计划
4. 阅读中心
5. 图书馆
6. 学习报告
7. 统计分析
8. 成就管理
9. 设置
10. 任务详情
11. 图书详情外层和主要弹窗

## 后续整理

后续版本继续统一：

- 设置子页面内部表单
- 统计图表组件
- 阅读记录表单内部字段
- 计划编辑弹窗内部日期选择体验
