# 颜色使用指南

本文档说明如何在不同平台使用 AcuityBookmarks 的颜色系统。

## 📦 颜色系统概览

AcuityBookmarks 采用 **Material Design 3** 颜色系统，基于品牌色（蓝色 #3B82F6 和紫色 #C026D3）。

## 🎨 颜色分类

### 1. 品牌色（Brand Colors）

**主色（Primary）- Logo 蓝色**
```typescript
import { colors } from '@acuity-bookmarks/design-tokens'

colors.brand.primary      // #3B82F6
colors.brand.primaryDark  // #1E40AF
```

**次要色（Secondary）- Logo 紫色**
```typescript
colors.brand.secondary      // #C026D3
colors.brand.secondaryDark  // #86198F
```

**品牌渐变**
```typescript
colors.brand.gradient.css  // 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 50%, #C026D3 100%)'
```

### 2. 语义化颜色（Semantic Colors）

```typescript
colors.semantic.success  // #22c55e - 成功状态
colors.semantic.error    // #ef4444 - 错误状态
colors.semantic.warning  // #f59e0b - 警告状态
colors.semantic.info     // #3b82f6 - 信息状态
colors.semantic.ai       // #C026D3 - AI 功能专用色
```

### 3. Material Design 颜色（CSS 变量）

```css
/* 主题色 */
var(--md-sys-color-primary)              /* 主色 */
var(--md-sys-color-on-primary)           /* 主色上的文本 */
var(--md-sys-color-primary-container)    /* 主色容器 */

/* 表面色 */
var(--md-sys-color-surface)              /* 表面背景 */
var(--md-sys-color-on-surface)           /* 表面上的文本 */
var(--md-sys-color-background)           /* 页面背景 */
```

## 🔧 使用方法

### Web / Chrome Extension

```vue
<style scoped>
.button-primary {
  background-color: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
}

.success-badge {
  background-color: var(--color-semantic-success);
}
</style>
```

### React Native

```typescript
import { colors } from '@acuity-bookmarks/design-tokens'

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.brand.primary,
    color: colors.neutral.white
  }
})
```

### Flutter

```dart
import 'package:acuity_bookmarks_design_tokens/colors.dart';

Container(
  color: AcuityColors.brandPrimary,
  child: Text(
    'Hello',
    style: TextStyle(color: AcuityColors.neutralWhite),
  ),
)
```

## ⚠️ 使用规范

### ✅ 正确用法

```css
/* 使用 CSS 变量 */
.button {
  background-color: var(--md-sys-color-primary);
}

/* 使用 TypeScript tokens */
const color = colors.brand.primary
```

### ❌ 错误用法

```css
/* 禁止硬编码颜色值 */
.button {
  background-color: #3B82F6;  /* ❌ 禁止！ */
}
```

## 🎯 颜色选择决策树

```
需要什么颜色？
├─ 品牌相关 → colors.brand.primary / secondary
├─ 状态反馈 → colors.semantic.success / error / warning
├─ AI 功能 → colors.semantic.ai
├─ 文本 → colors.text.primary / secondary
├─ 边框 → colors.border.default
└─ 背景 → colors.background.primary / secondary
```

## 📚 相关资源

- [Material Design 3 颜色系统](https://m3.material.io/styles/color/overview)
- [WCAG 对比度要求](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
