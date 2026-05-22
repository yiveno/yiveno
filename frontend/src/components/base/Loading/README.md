# Loading 组件

基于 Material Design 3 的 `md-circular-progress` 封装的加载指示器组件。

## 特性

- ✅ 基于 `md-circular-progress` 实现
- ✅ 5 种尺寸变体（xs / sm / md / lg / xl）
- ✅ 支持不确定进度（转圈动画）
- ✅ 统一的加载状态展示

## 使用示例

### 基础用法

```vue
<template>
  <Loading />
</template>
```

### 不同尺寸

```vue
<template>
  <Loading size="xs" />
  <!-- 16px -->
  <Loading size="sm" />
  <!-- 20px -->
  <Loading size="md" />
  <!-- 32px，默认 -->
  <Loading size="lg" />
  <!-- 48px -->
  <Loading size="xl" />
  <!-- 64px -->
</template>
```

### 在按钮中使用

```vue
<template>
  <md-filled-button>
    <Loading v-if="isLoading" size="xs" slot="icon" />
    <span>提交</span>
  </md-filled-button>
</template>
```

### 在下拉框中使用

```vue
<template>
  <div class="dropdown">
    <Loading v-if="loading" size="md" />
    <div v-else>内容</div>
  </div>
</template>
```

## Props

| 属性          | 类型                                   | 默认值 | 说明             |
| ------------- | -------------------------------------- | ------ | ---------------- |
| size          | `'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl'` | `'md'` | 尺寸             |
| indeterminate | `boolean`                              | `true` | 是否为不确定进度 |

## 尺寸对照表

| 尺寸 | 直径 | 线宽  | 使用场景           |
| ---- | ---- | ----- | ------------------ |
| xs   | 16px | 2px   | 按钮图标、小型组件 |
| sm   | 20px | 2.5px | 输入框、小卡片     |
| md   | 32px | 3px   | 下拉框、中型卡片   |
| lg   | 48px | 4px   | 页面加载、大型卡片 |
| xl   | 64px | 5px   | 全屏加载           |

## 设计规范

- 统一使用 `md-circular-progress` 组件
- 禁止使用"加载中..."等文案，统一使用 Loading 组件
- 颜色自动使用 `--md-sys-color-primary`
- 尺寸根据使用场景选择合适的变体
