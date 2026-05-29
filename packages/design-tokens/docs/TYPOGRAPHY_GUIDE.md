# 字体使用指南

本文档说明如何在不同平台使用 AcuityBookmarks 的字体系统。

## 📝 字体系统概览

AcuityBookmarks 采用系统字体栈，确保在所有平台上都有良好的阅读体验。

## 📦 字体 Tokens

### 1. 字体家族（Font Family）

```typescript
import { fontFamily } from '@acuity-bookmarks/design-tokens'

fontFamily.sans // 无衬线字体（默认）
fontFamily.mono // 等宽字体（代码）
fontFamily.serif // 衬线字体（标题）
```

**CSS 变量：**

```css
var(--font-family-sans)   /* -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, ... */
var(--font-family-mono)   /* ui-monospace, SFMono-Regular, "SF Mono", Menlo, ... */
var(--font-family-serif)  /* Georgia, Cambria, "Times New Roman", Times, serif */
```

### 2. 字体大小（Font Size）

```typescript
import { fontSize } from '@acuity-bookmarks/design-tokens'

fontSize.xs // 10px - 极小文字
fontSize.sm // 12px - 辅助文字、标签
fontSize.base // 14px - 正文（默认）
fontSize.md // 16px - 次要标题
fontSize.lg // 18px - 小标题
fontSize.xl // 20px - 标题
fontSize['2xl'] // 24px - 大标题
fontSize['3xl'] // 30px - 超大标题
fontSize['4xl'] // 36px - 巨大标题
fontSize['5xl'] // 48px - 特大标题
```

**CSS 变量：**

```css
var(--text-xs)    /* 10px */
var(--text-sm)    /* 12px */
var(--text-base)  /* 14px */
var(--text-md)    /* 16px */
var(--text-lg)    /* 18px */
var(--text-xl)    /* 20px */
var(--text-2xl)   /* 24px */
var(--text-3xl)   /* 30px */
var(--text-4xl)   /* 36px */
var(--text-5xl)   /* 48px */
```

### 3. 字重（Font Weight）

```typescript
import { fontWeight } from '@acuity-bookmarks/design-tokens'

fontWeight.light // 300
fontWeight.normal // 400 - 正文
fontWeight.medium // 500 - 强调
fontWeight.semibold // 600 - 小标题
fontWeight.bold // 700 - 标题
fontWeight.extrabold // 800 - 特殊强调
```

**CSS 变量：**

```css
var(--font-light)      /* 300 */
var(--font-normal)     /* 400 */
var(--font-medium)     /* 500 */
var(--font-semibold)   /* 600 */
var(--font-bold)       /* 700 */
var(--font-extrabold)  /* 800 */
```

### 4. 行高（Line Height）

```typescript
import { lineHeight } from '@acuity-bookmarks/design-tokens'

lineHeight.tight // 1.25 - 标题
lineHeight.snug // 1.375 - 紧密
lineHeight.normal // 1.5 - 正文（默认）
lineHeight.relaxed // 1.625 - 宽松
lineHeight.loose // 2 - 超宽松
```

**CSS 变量：**

```css
var(--line-height-tight)    /* 1.25 */
var(--line-height-snug)     /* 1.375 */
var(--line-height-normal)   /* 1.5 */
var(--line-height-relaxed)  /* 1.625 */
var(--line-height-loose)    /* 2 */
```

### 5. 字母间距（Letter Spacing）

```typescript
import { letterSpacing } from '@acuity-bookmarks/design-tokens'

letterSpacing.tighter // -0.05em
letterSpacing.tight // -0.025em
letterSpacing.normal // 0
letterSpacing.wide // 0.025em
letterSpacing.wider // 0.05em
letterSpacing.widest // 0.1em
```

## 🎯 使用场景

### 1. 标题层级

```css
/* H1 - 页面主标题 */
.h1 {
  font-size: var(--text-2xl); /* 24px */
  font-weight: var(--font-bold); /* 700 */
  line-height: var(--line-height-tight); /* 1.25 */
}

/* H2 - 区块标题 */
.h2 {
  font-size: var(--text-xl); /* 20px */
  font-weight: var(--font-semibold); /* 600 */
  line-height: var(--line-height-tight); /* 1.25 */
}

/* H3 - 小标题 */
.h3 {
  font-size: var(--text-lg); /* 18px */
  font-weight: var(--font-semibold); /* 600 */
  line-height: var(--line-height-snug); /* 1.375 */
}
```

### 2. 正文文字

```css
/* 正文 */
.body {
  font-size: var(--text-base); /* 14px */
  font-weight: var(--font-normal); /* 400 */
  line-height: var(--line-height-normal); /* 1.5 */
}

/* 次要文字 */
.body-secondary {
  font-size: var(--text-sm); /* 12px */
  font-weight: var(--font-normal); /* 400 */
  line-height: var(--line-height-normal); /* 1.5 */
  color: var(--color-text-secondary);
}
```

### 3. UI 元素

```css
/* 按钮文字 */
.button {
  font-size: var(--text-sm); /* 12px */
  font-weight: var(--font-medium); /* 500 */
  line-height: var(--line-height-normal); /* 1.5 */
}

/* 标签 */
.label {
  font-size: var(--text-xs); /* 10px */
  font-weight: var(--font-medium); /* 500 */
  line-height: var(--line-height-normal); /* 1.5 */
  letter-spacing: var(--letter-spacing-wide); /* 0.025em */
  text-transform: uppercase;
}
```

## 🔧 平台使用示例

### Web / Chrome Extension

```vue
<style scoped>
.title {
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  line-height: var(--line-height-tight);
}

.body-text {
  font-size: var(--text-base);
  font-weight: var(--font-normal);
  line-height: var(--line-height-normal);
}
</style>
```

### React Native

```typescript
import { fontSize, fontWeight, lineHeight } from '@acuity-bookmarks/design-tokens'

const styles = StyleSheet.create({
  title: {
    fontSize: parseInt(fontSize.xl), // 20
    fontWeight: fontWeight.semibold, // '600'
    lineHeight: parseFloat(lineHeight.tight) * parseInt(fontSize.xl) // 1.25 * 20 = 25
  },
  bodyText: {
    fontSize: parseInt(fontSize.base), // 14
    fontWeight: fontWeight.normal, // '400'
    lineHeight: parseFloat(lineHeight.normal) * parseInt(fontSize.base) // 1.5 * 14 = 21
  }
})
```

### Flutter

```dart
import 'package:acuity_bookmarks_design_tokens/typography.dart';

Text(
  'Title',
  style: TextStyle(
    fontSize: AcuityFontSize.xl,              // 20
    fontWeight: AcuityFontWeight.semibold,    // FontWeight.w600
    height: AcuityLineHeight.tight,           // 1.25
  ),
)

Text(
  'Body text',
  style: TextStyle(
    fontSize: AcuityFontSize.base,            // 14
    fontWeight: AcuityFontWeight.normal,      // FontWeight.w400
    height: AcuityLineHeight.normal,          // 1.5
  ),
)
```

## ⚠️ 使用规范

### ✅ 正确用法

```css
/* 使用字体 tokens */
.title {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  line-height: var(--line-height-tight);
}
```

### ❌ 错误用法

```css
/* 禁止硬编码字号 */
.title {
  font-size: 18px; /* ❌ 禁止！ */
  font-weight: 600; /* ❌ 禁止！ */
}
```

## 📐 字体选择决策树

```
需要什么字体？
├─ 页面主标题 → text-2xl + font-bold
├─ 区块标题 → text-xl + font-semibold
├─ 小标题 → text-lg + font-semibold
├─ 正文 → text-base + font-normal
├─ 次要文字 → text-sm + font-normal
├─ 按钮 → text-sm + font-medium
└─ 标签 → text-xs + font-medium + uppercase
```

## 📚 相关资源

- [Material Design 字体系统](https://m3.material.io/styles/typography/overview)
- [Web 字体最佳实践](https://web.dev/font-best-practices/)
