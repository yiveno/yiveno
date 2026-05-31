# 🎨 Design Tokens 使用指南

本文档说明如何在项目中使用 otterSage 的设计 tokens。

---

## 📦 安装

在 workspace 中，design-tokens 已经通过 `workspace:*` 自动链接，无需额外安装。

```json
// frontend/package.json
{
  "dependencies": {
    "@ottersage/design-tokens": "workspace:*"
  }
}
```

---

## 🎯 使用方式

### 1. 在 TypeScript/JavaScript 中使用

```typescript
// 导入所有 tokens
import { colors, spacing, shadows, duration, easing, glassmorphism } from '@ottersage/design-tokens'

// 或者按需导入
import { colors } from '@ottersage/design-tokens/colors'
import { duration, easing } from '@ottersage/design-tokens/animations'
import { glassmorphism } from '@ottersage/design-tokens/effects'

// 使用示例
const buttonStyle = {
  backgroundColor: colors.primary[500],
  padding: spacing.md,
  boxShadow: shadows.md,
  transition: `all ${duration.fast} ${easing.standard}`
}
```

### 2. 在 Vue 组件中使用

```vue
<script setup lang="ts">
import { colors, shadows, duration } from '@ottersage/design-tokens'

const cardStyle = {
  background: colors.primary[50],
  boxShadow: shadows.lg,
  transition: `transform ${duration.normal}`
}
</script>

<template>
  <div :style="cardStyle">
    <!-- 内容 -->
  </div>
</template>
```

### 3. 在 CSS 中使用（推荐）

```vue
<style scoped>
/* 导入 CSS 变量 */
@import '@ottersage/design-tokens/css/material-theme.css';

.button {
  /* 使用 Material Design 颜色 */
  background-color: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);

  /* 使用自定义 tokens（需要先定义 CSS 变量） */
  padding: var(--spacing-md);
  box-shadow: var(--shadow-md);
  transition: all var(--duration-fast) var(--easing-standard);
}

.button:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
}
</style>
```

---

## 🎨 可用的 Design Tokens

### 1. 颜色系统 (colors)

#### 主色阶梯

```typescript
colors.primary[50] // #eff6ff - 最浅
colors.primary[100] // #dbeafe
colors.primary[200] // #bfdbfe
colors.primary[300] // #93c5fd
colors.primary[400] // #60a5fa
colors.primary[500] // #3b82f6 - 主色
colors.primary[600] // #2563eb
colors.primary[700] // #1d4ed8
colors.primary[800] // #1e40af
colors.primary[900] // #1e3a8a
colors.primary[950] // #172554 - 最深
```

#### 次要色阶梯

```typescript
colors.secondary[50] // #fdf4ff - 最浅
colors.secondary[500] // #d946ef
colors.secondary[600] // #c026d3 - 次要色
colors.secondary[900] // #701a75 - 最深
```

#### 语义化颜色

```typescript
colors.semantic.success // #22c55e
colors.semantic.error // #ef4444
colors.semantic.warning // #f59e0b
colors.semantic.info // #3b82f6
colors.semantic.ai // #c026d3
```

### 2. 间距系统 (spacing)

```typescript
spacing.none // 0
spacing.xs // 4px
spacing.sm // 8px
spacing.md // 12px
spacing.base // 16px
spacing.lg // 24px
spacing.xl // 32px
spacing['2xl'] // 48px
spacing['3xl'] // 64px
```

### 3. 阴影系统 (shadows)

```typescript
shadows.none // 无阴影
shadows.xs // 微小阴影
shadows.sm // 小阴影
shadows.md // 中等阴影
shadows.lg // 大阴影
shadows.xl // 超大阴影
shadows['2xl'] // 超超大阴影

// 特殊阴影
shadows.inner // 内阴影
shadows.focus // 焦点阴影（蓝色）
shadows.focusSecondary // 焦点阴影（紫色）
shadows.coloredPrimary // 彩色阴影（主色）
shadows.coloredSecondary // 彩色阴影（次要色）
```

### 4. 动画系统 (animations)

#### 时长

```typescript
duration.instant // 50ms
duration.fastest // 100ms
duration.fast // 200ms
duration.normal // 300ms
duration.slow // 400ms
duration.slowest // 700ms
```

#### 缓动函数

```typescript
easing.standard // 标准
easing.emphasized // 强调
easing.emphasizedDecelerate // 强调减速
easing.emphasizedAccelerate // 强调加速
easing.spring // 弹性
easing.bounce // 回弹
```

### 5. 视觉效果 (effects)

#### 玻璃态效果

```typescript
glassmorphism.light // 轻度玻璃态
glassmorphism.medium // 中度玻璃态
glassmorphism.heavy // 重度玻璃态
glassmorphism.dark // 深色玻璃态
```

#### 渐变

```typescript
gradients.brand // 品牌渐变
gradients.brandVertical // 品牌渐变（垂直）
gradients.subtle // 微妙渐变
gradients.shine // 光泽效果
```

#### 模糊

```typescript
blur.none // 无模糊
blur.sm // 小模糊
blur.md // 中等模糊
blur.lg // 大模糊
```

---

## 💡 使用示例

### 示例 1：玻璃态卡片

```vue
<script setup lang="ts">
import { glassmorphism, shadows, spacing } from '@ottersage/design-tokens'
</script>

<template>
  <div class="glass-card">
    <h3>玻璃态卡片</h3>
    <p>这是一个现代的玻璃态效果卡片</p>
  </div>
</template>

<style scoped>
.glass-card {
  /* 玻璃态效果 */
  background: v-bind('glassmorphism.light.background');
  backdrop-filter: v-bind('glassmorphism.light.backdropFilter');
  border: v-bind('glassmorphism.light.border');
  box-shadow: v-bind('glassmorphism.light.boxShadow');

  /* 间距和圆角 */
  padding: v-bind('spacing.lg');
  border-radius: 16px;
}
</style>
```

### 示例 2：带动画的按钮

```vue
<script setup lang="ts">
import { colors, shadows, duration, easing } from '@ottersage/design-tokens'
</script>

<template>
  <button class="animated-button">点击我</button>
</template>

<style scoped>
.animated-button {
  /* 颜色 */
  background: v-bind('colors.primary[500]');
  color: white;

  /* 阴影 */
  box-shadow: v-bind('shadows.md');

  /* 动画 */
  transition: all v-bind('duration.fast') v-bind('easing.standard');
}

.animated-button:hover {
  background: v-bind('colors.primary[600]');
  box-shadow: v-bind('shadows.lg');
  transform: translateY(-2px);
}

.animated-button:active {
  transform: translateY(0);
  box-shadow: v-bind('shadows.sm');
}
</style>
```

### 示例 3：渐变背景

```vue
<script setup lang="ts">
import { gradients, spacing } from '@ottersage/design-tokens'
</script>

<template>
  <div class="gradient-hero">
    <h1>欢迎使用 otterSage</h1>
  </div>
</template>

<style scoped>
.gradient-hero {
  /* 品牌渐变背景 */
  background: v-bind('gradients.brand');

  /* 间距 */
  padding: v-bind('spacing["2xl"]');

  /* 文字颜色 */
  color: white;
  text-align: center;
}
</style>
```

---

## 🎯 最佳实践

### 1. 优先使用 CSS 变量

```css
/* ✅ 推荐：使用 CSS 变量 */
.button {
  background-color: var(--md-sys-color-primary);
  padding: var(--spacing-md);
}

/* ❌ 避免：硬编码 */
.button {
  background-color: #3b82f6;
  padding: 12px;
}
```

### 2. 使用语义化颜色

```typescript
// ✅ 推荐：使用语义化颜色
const successStyle = {
  color: colors.semantic.success
}

// ❌ 避免：直接使用色阶
const successStyle = {
  color: colors.primary[500] // 不清楚这是什么用途
}
```

### 3. 组合使用 tokens

```typescript
// ✅ 推荐：组合使用多个 tokens
const cardStyle = {
  background: colors.primary[50],
  padding: spacing.lg,
  borderRadius: borderRadius.lg,
  boxShadow: shadows.md,
  transition: `all ${duration.fast} ${easing.standard}`
}
```

### 4. 避免魔法数字

```css
/* ❌ 避免：魔法数字 */
.card {
  padding: 18px;
  box-shadow: 0 3px 7px rgba(0, 0, 0, 0.12);
}

/* ✅ 推荐：使用 tokens */
.card {
  padding: var(--spacing-lg);
  box-shadow: var(--shadow-md);
}
```

---

## 📚 相关文档

- [设计系统规范](../../.kiro/steering/design-system.md)
- [Material Design 3](https://m3.material.io/)
- [组件库文档](../../frontend/src/components/README.md)

---

**最后更新**: 2025-01-XX  
**版本**: 1.1.0
