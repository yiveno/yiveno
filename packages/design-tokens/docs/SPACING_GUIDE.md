# 间距使用指南

本文档说明如何在不同平台使用 AcuityBookmarks 的间距系统。

## 📏 间距系统概览

AcuityBookmarks 采用 **8px 网格系统**，确保设计的一致性和可预测性。

## 📦 间距 Tokens

### 基础间距

```typescript
import { spacing } from '@acuity-bookmarks/design-tokens'

spacing.none   // 0px
spacing.xs     // 4px  - 极小间距
spacing.sm     // 8px  - 小间距
spacing.md     // 12px - 中小间距
spacing.base   // 16px - 中等间距（标准）
spacing.lg     // 24px - 大间距
spacing.xl     // 32px - 超大间距
spacing['2xl'] // 48px - 超超大间距
spacing['3xl'] // 64px - 巨大间距
```

### CSS 变量

```css
var(--spacing-xs)    /* 4px */
var(--spacing-sm)    /* 8px */
var(--spacing-md)    /* 12px */
var(--spacing-base)  /* 16px */
var(--spacing-lg)    /* 24px */
var(--spacing-xl)    /* 32px */
var(--spacing-2xl)   /* 48px */
var(--spacing-3xl)   /* 64px */
```

## 🎯 使用场景

### 1. 组件内间距（Padding）

```css
/* 按钮内边距 */
.button {
  padding: var(--spacing-md) var(--spacing-base);  /* 12px 16px */
}

/* 卡片内边距 */
.card {
  padding: var(--spacing-base);  /* 16px */
}

/* 输入框内边距 */
.input {
  padding: var(--spacing-sm) var(--spacing-md);  /* 8px 12px */
}
```

### 2. 组件间间距（Margin / Gap）

```css
/* 列表项间距 */
.list-item {
  margin-bottom: var(--spacing-sm);  /* 8px */
}

/* 区块间距 */
.section {
  margin-bottom: var(--spacing-lg);  /* 24px */
}

/* Flexbox 间距 */
.container {
  display: flex;
  gap: var(--spacing-base);  /* 16px */
}
```

### 3. 图标与文字间距

```css
/* 图标 + 文字 */
.icon-text {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);  /* 4px */
}
```

## 📐 间距选择决策树

```
需要什么间距？
├─ 图标与文字 → spacing.xs (4px)
├─ 列表项内部 → spacing.sm (8px)
├─ 卡片内部 → spacing.md (12px)
├─ 标准间距 → spacing.base (16px)
├─ 区块间距 → spacing.lg (24px)
└─ 页面级间距 → spacing.xl (32px) 或更大
```

## 🔧 平台使用示例

### Web / Chrome Extension

```vue
<style scoped>
.card {
  padding: var(--spacing-base);
  margin-bottom: var(--spacing-lg);
}

.button-group {
  display: flex;
  gap: var(--spacing-sm);
}
</style>
```

### React Native

```typescript
import { spacing } from '@acuity-bookmarks/design-tokens'

const styles = StyleSheet.create({
  card: {
    padding: parseInt(spacing.base),      // 16
    marginBottom: parseInt(spacing.lg)    // 24
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: parseInt(spacing.sm)             // 8
  }
})
```

### Flutter

```dart
import 'package:acuity_bookmarks_design_tokens/spacing.dart';

Container(
  padding: EdgeInsets.all(AcuitySpacing.base),  // 16
  margin: EdgeInsets.only(bottom: AcuitySpacing.lg),  // 24
  child: Row(
    children: [
      Icon(Icons.star),
      SizedBox(width: AcuitySpacing.xs),  // 4
      Text('Favorite'),
    ],
  ),
)
```

## ⚠️ 使用规范

### ✅ 正确用法

```css
/* 使用间距 tokens */
.card {
  padding: var(--spacing-base);
  margin-bottom: var(--spacing-lg);
}
```

### ❌ 错误用法

```css
/* 禁止魔法数字 */
.card {
  padding: 16px;      /* ❌ 禁止！ */
  margin-bottom: 25px; /* ❌ 禁止！ */
}
```

### 🤔 特殊情况

如果设计稿中的间距不在标准 tokens 中：

1. **优先使用最接近的 token**
2. **添加注释说明原因**
3. **考虑是否需要添加新的 token**

```css
/* ✅ 可接受的特殊情况 */
.special-component {
  /* 设计稿要求 20px，使用最接近的 24px */
  padding: var(--spacing-lg);  /* 24px - 设计稿 20px，向上取整 */
}
```

## 📚 相关资源

- [Material Design 间距系统](https://m3.material.io/foundations/layout/understanding-layout/spacing)
- [8px 网格系统](https://spec.fm/specifics/8-pt-grid)
