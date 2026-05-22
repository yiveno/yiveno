# AppHeader 应用头部组件

一个应用头部组件，包含导航、搜索、用户信息等。

## ✨ 特性

- 🎨 **响应式布局** - 适配不同屏幕
- 🔍 **搜索集成** - 可包含搜索功能
- 👤 **用户信息** - 显示用户头像和菜单
- 📦 **组合组件** - 由 Icon + Button + ThemeToggle 组成

## 📦 安装

```typescript
import { AppHeader } from '@/components'
```

## 🔗 依赖组件

本组件依赖以下基础组件：

- [Icon](../../base/Icon/README.md)
- [Button](../../base/Button/README.md)
- [ThemeToggle](../../base/ThemeToggle/README.md)

## 🎯 基础用法

### 默认用法

```vue
<script setup lang="ts">
import { AppHeader } from '@/components'
</script>

<template>
  <AppHeader />
</template>
```

## 💡 使用场景

### 应用头部

```vue
<template>
  <AppHeader title="应用名称" :user="currentUser" @menu-click="handleMenu" />
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
