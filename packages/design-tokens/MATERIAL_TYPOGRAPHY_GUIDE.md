# Material Design 3 Typography 使用指南

## 📚 概述

本项目已完整集成 Material Design 3 的字体系统（Type Scale），提供 15 个预定义的字体样式，涵盖从大标题到小标签的所有文本场景。

---

## 🎯 Material Design 3 Type Scale

### 字体层级结构

```
Display (大标题)
  ├─ Display Large   (57px) - 营销页面、首屏标题
  ├─ Display Medium  (45px) - 次级大标题
  └─ Display Small   (36px) - 小大标题

Headline (标题)
  ├─ Headline Large  (32px) - 页面主标题
  ├─ Headline Medium (28px) - 区块标题
  └─ Headline Small  (24px) - 卡片标题

Title (小标题)
  ├─ Title Large     (22px) - 列表项标题
  ├─ Title Medium    (16px) - 对话框标题
  └─ Title Small     (14px) - 小标题

Body (正文)
  ├─ Body Large      (16px) - 主要段落
  ├─ Body Medium     (14px) - 次要段落
  └─ Body Small      (12px) - 辅助文本

Label (标签)
  ├─ Label Large     (14px) - 按钮文字
  ├─ Label Medium    (12px) - 表单标签
  └─ Label Small     (11px) - 小标签
```

---

## 🔧 使用方式

### 方式 1：CSS 变量（推荐）

```css
.my-title {
  font-size: var(--md-sys-typescale-headline-large-size);
  font-weight: var(--md-sys-typescale-headline-large-weight);
  line-height: var(--md-sys-typescale-headline-large-line-height);
  letter-spacing: var(--md-sys-typescale-headline-large-tracking);
}
```

### 方式 2：工具类

```html
<h1 class="md-typescale-display-large">Welcome</h1>
<h2 class="md-typescale-headline-medium">Settings</h2>
<p class="md-typescale-body-large">This is a paragraph.</p>
<button class="md-typescale-label-large">Save</button>
```

### 方式 3：HTML 元素自动映射

项目已在 `base.css` 中为 HTML 元素配置了默认字体样式：

```css
h1 → Display Medium
h2 → Headline Large
h3 → Headline Medium
h4 → Headline Small
h5 → Title Large
h6 → Title Medium
p  → Body Large
small → Body Small
```

---

## 📋 完整的 CSS 变量列表

### Display

```css
--md-sys-typescale-display-large-size: 3.5625rem;    /* 57px */
--md-sys-typescale-display-large-weight: 400;
--md-sys-typescale-display-large-line-height: 4rem;  /* 64px */
--md-sys-typescale-display-large-tracking: -0.25px;

--md-sys-typescale-display-medium-size: 2.8125rem;   /* 45px */
--md-sys-typescale-display-medium-weight: 400;
--md-sys-typescale-display-medium-line-height: 3.25rem; /* 52px */
--md-sys-typescale-display-medium-tracking: 0;

--md-sys-typescale-display-small-size: 2.25rem;      /* 36px */
--md-sys-typescale-display-small-weight: 400;
--md-sys-typescale-display-small-line-height: 2.75rem; /* 44px */
--md-sys-typescale-display-small-tracking: 0;
```

### Headline

```css
--md-sys-typescale-headline-large-size: 2rem;        /* 32px */
--md-sys-typescale-headline-large-weight: 400;
--md-sys-typescale-headline-large-line-height: 2.5rem; /* 40px */
--md-sys-typescale-headline-large-tracking: 0;

--md-sys-typescale-headline-medium-size: 1.75rem;    /* 28px */
--md-sys-typescale-headline-medium-weight: 400;
--md-sys-typescale-headline-medium-line-height: 2.25rem; /* 36px */
--md-sys-typescale-headline-medium-tracking: 0;

--md-sys-typescale-headline-small-size: 1.5rem;      /* 24px */
--md-sys-typescale-headline-small-weight: 400;
--md-sys-typescale-headline-small-line-height: 2rem; /* 32px */
--md-sys-typescale-headline-small-tracking: 0;
```

### Title

```css
--md-sys-typescale-title-large-size: 1.375rem;       /* 22px */
--md-sys-typescale-title-large-weight: 400;
--md-sys-typescale-title-large-line-height: 1.75rem; /* 28px */
--md-sys-typescale-title-large-tracking: 0;

--md-sys-typescale-title-medium-size: 1rem;          /* 16px */
--md-sys-typescale-title-medium-weight: 500;
--md-sys-typescale-title-medium-line-height: 1.5rem; /* 24px */
--md-sys-typescale-title-medium-tracking: 0.15px;

--md-sys-typescale-title-small-size: 0.875rem;       /* 14px */
--md-sys-typescale-title-small-weight: 500;
--md-sys-typescale-title-small-line-height: 1.25rem; /* 20px */
--md-sys-typescale-title-small-tracking: 0.1px;
```

### Body

```css
--md-sys-typescale-body-large-size: 1rem;            /* 16px */
--md-sys-typescale-body-large-weight: 400;
--md-sys-typescale-body-large-line-height: 1.5rem;   /* 24px */
--md-sys-typescale-body-large-tracking: 0.5px;

--md-sys-typescale-body-medium-size: 0.875rem;       /* 14px */
--md-sys-typescale-body-medium-weight: 400;
--md-sys-typescale-body-medium-line-height: 1.25rem; /* 20px */
--md-sys-typescale-body-medium-tracking: 0.25px;

--md-sys-typescale-body-small-size: 0.75rem;         /* 12px */
--md-sys-typescale-body-small-weight: 400;
--md-sys-typescale-body-small-line-height: 1rem;     /* 16px */
--md-sys-typescale-body-small-tracking: 0.4px;
```

### Label

```css
--md-sys-typescale-label-large-size: 0.875rem;       /* 14px */
--md-sys-typescale-label-large-weight: 500;
--md-sys-typescale-label-large-line-height: 1.25rem; /* 20px */
--md-sys-typescale-label-large-tracking: 0.1px;

--md-sys-typescale-label-medium-size: 0.75rem;       /* 12px */
--md-sys-typescale-label-medium-weight: 500;
--md-sys-typescale-label-medium-line-height: 1rem;   /* 16px */
--md-sys-typescale-label-medium-tracking: 0.5px;

--md-sys-typescale-label-small-size: 0.6875rem;      /* 11px */
--md-sys-typescale-label-small-weight: 500;
--md-sys-typescale-label-small-line-height: 1rem;    /* 16px */
--md-sys-typescale-label-small-tracking: 0.5px;
```

---

## 🎨 实际应用场景

### 场景 1：页面标题

```html
<h1 class="md-typescale-headline-large">Settings</h1>
```

或使用 CSS 变量：

```css
.page-title {
  font-size: var(--md-sys-typescale-headline-large-size);
  font-weight: var(--md-sys-typescale-headline-large-weight);
  line-height: var(--md-sys-typescale-headline-large-line-height);
}
```

### 场景 2：书签标题

```html
<div class="bookmark-title md-typescale-title-medium">
  My Bookmark
</div>
```

### 场景 3：按钮文字

```html
<button class="md-typescale-label-large">
  Save Changes
</button>
```

### 场景 4：描述文本

```html
<p class="md-typescale-body-medium">
  This is a description of the bookmark.
</p>
```

---

## 🔄 与项目现有字体系统的关系

### 字体家族

Material Design 3 推荐使用 **Roboto**，但本项目使用 **Noto Sans** 以支持更多语言：

```css
/* Material Typography 中的字体家族定义 */
--md-sys-typescale-font-family-plain: 'Noto Sans', 'Roboto', system-ui, sans-serif;
--md-sys-typescale-font-family-brand: 'Noto Sans', 'Roboto', system-ui, sans-serif;
```

### 与智能字体系统的配合

- **系统界面** - 使用 Material Design 3 Type Scale + 用户选择的语言字体
- **用户内容** - 使用智能多语言字体栈（`smart-fonts.css`）

```css
/* 系统界面 - 使用 Material Type Scale */
.system-ui {
  font-size: var(--md-sys-typescale-body-large-size);
  font-family: var(--font-family-ui); /* 用户选择的语言字体 */
}

/* 用户内容 - 使用智能字体栈 */
.user-content {
  font-size: var(--md-sys-typescale-body-medium-size);
  font-family: var(--font-family-content); /* 多语言智能字体栈 */
}
```

---

## 📐 字体大小对照表

| Type Scale | 字号 (px) | 字号 (rem) | 用途 |
|-----------|----------|-----------|------|
| Display Large | 57px | 3.5625rem | 营销页面首屏 |
| Display Medium | 45px | 2.8125rem | 次级大标题 |
| Display Small | 36px | 2.25rem | 小大标题 |
| Headline Large | 32px | 2rem | 页面主标题 |
| Headline Medium | 28px | 1.75rem | 区块标题 |
| Headline Small | 24px | 1.5rem | 卡片标题 |
| Title Large | 22px | 1.375rem | 列表项标题 |
| Title Medium | 16px | 1rem | 对话框标题 |
| Title Small | 14px | 0.875rem | 小标题 |
| Body Large | 16px | 1rem | 主要段落 |
| Body Medium | 14px | 0.875rem | 次要段落 |
| Body Small | 12px | 0.75rem | 辅助文本 |
| Label Large | 14px | 0.875rem | 按钮文字 |
| Label Medium | 12px | 0.75rem | 表单标签 |
| Label Small | 11px | 0.6875rem | 小标签 |

---

## ✅ 最佳实践

### 1. 优先使用 CSS 变量

```css
/* ✅ 推荐 */
.my-component {
  font-size: var(--md-sys-typescale-body-large-size);
  font-weight: var(--md-sys-typescale-body-large-weight);
  line-height: var(--md-sys-typescale-body-large-line-height);
}

/* ❌ 不推荐 */
.my-component {
  font-size: 16px;
  font-weight: 400;
  line-height: 24px;
}
```

### 2. 保持字体层级一致

```html
<!-- ✅ 正确：层级清晰 -->
<h1 class="md-typescale-headline-large">Page Title</h1>
<h2 class="md-typescale-headline-medium">Section Title</h2>
<h3 class="md-typescale-headline-small">Subsection Title</h3>

<!-- ❌ 错误：层级混乱 -->
<h1 class="md-typescale-body-large">Page Title</h1>
<h2 class="md-typescale-display-large">Section Title</h2>
```

### 3. 根据场景选择合适的字体样式

- **营销页面** → Display
- **页面标题** → Headline
- **列表项** → Title
- **段落文本** → Body
- **按钮/标签** → Label

---

## 🔗 参考资源

- [Material Design 3 Typography](https://m3.material.io/styles/typography/overview)
- [Material Design Type Scale](https://m3.material.io/styles/typography/type-scale-tokens)
- [Google Fonts - Roboto](https://fonts.google.com/specimen/Roboto)
- [Google Fonts - Noto Sans](https://fonts.google.com/noto/specimen/Noto+Sans)

---

**最后更新**: 2026-05-11  
**版本**: 1.0.0
