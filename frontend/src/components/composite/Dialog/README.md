# Dialog 对话框组件

一个对话框组件，用于显示模态内容和用户交互。

## ✨ 特性

- 🎨 **Material Design** - 遵循 MD3 设计规范
- ⌨️ **键盘支持** - ESC 关闭、Tab 焦点管理
- 🔒 **焦点锁定** - 防止焦点逃逸
- 📱 **响应式** - 适配不同屏幕尺寸
- 📦 **组合组件** - 由 Button + Card + Icon 组成

## 📦 安装

```typescript
import { Dialog } from '@/components'
```

## 🔗 依赖组件

本组件依赖以下基础组件：

- [Button](../../base/Button/README.md)
- [Card](../../base/Card/README.md)
- [Icon](../../base/Icon/README.md)

## 🎯 基础用法

### 默认用法

```vue
<script setup lang="ts">
import { Dialog } from '@/components'
</script>

<template>
  <Dialog />
</template>
```

## 💡 使用场景

### 确认对话框

```vue
<template>
  <Dialog :show="showDialog" title="确认删除" @confirm="handleConfirm" @cancel="handleCancel">
    <p>确定要删除这个项目吗？</p>
  </Dialog>
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
