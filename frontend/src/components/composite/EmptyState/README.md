# EmptyState 空状态组件

一个空状态组件，用于展示无数据、筛选无结果等空状态。

## ✨ 特性

- 🎨 **友好提示** - 清晰的空状态说明
- 🖼️ **图标支持** - 可自定义图标
- 🔧 **操作引导** - 支持添加操作按钮
- 📦 **组合组件** - 由 Icon + 标题 + 描述组成

## 📦 安装

```typescript
import { EmptyState } from '@/components'
```

## 🔗 依赖组件

本组件依赖以下基础组件：

- [Icon](../../base/Icon/README.md)

## 🎯 基础用法

### 默认用法

```vue
<script setup lang="ts">
import { EmptyState } from '@/components'
</script>

<template>
  <EmptyState />
</template>
```

## 💡 使用场景

### 无数据状态

```vue
<template>
  <EmptyState icon="icon-folder" title="暂无数据" description="还没有添加任何内容">
    <Button @click="handleAdd">添加内容</Button>
  </EmptyState>
</template>
```

## 📋 API

### Props

| 属性 | 类型 | 默认值 | 说明   |
| ---- | ---- | ------ | ------ |
| -    | -    | -      | 待补充 |

### Emits

| 事件名 | 参数 | 说明   |
| ------ | ---- | ------ |
| -      | -    | 待补充 |

### Slots

| 插槽名    | 说明     |
| --------- | -------- |
| `default` | 默认内容 |

## 🎨 样式变量

组件使用 CSS 变量，可以通过覆盖变量来自定义样式。

## ⚠️ 注意事项

1. 这是复合组件，由多个基础组件组合而成
2. 不包含业务逻辑，保持通用性
3. 可在任何项目中使用

## 🔗 相关组件

- [组件分类规范](../../README.md)
- [基础组件文档](../../base/README.md)
- [复合组件文档](../README.md)

## 📝 更新日志

- **v1.0.0** - 初始版本

---

**组件类型**: 复合组件  
**最后更新**: 2025-01-05
