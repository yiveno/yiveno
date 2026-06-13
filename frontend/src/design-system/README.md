# CSS 设计系统使用指南

Material 组件采用边界见：[`material-coverage.md`](./material-coverage.md)。

## 核心原则

1. **禁止魔法数字** - 所有间距、字号、颜色必须使用变量
2. **语义化命名** - 变量名表达用途而非数值
3. **一致性优先** - 宁可妥协设计稿，也要保持系统统一

---

## 间距 (Spacing)

```css
/* ✅ 正确 */
padding: var(--spacing-4); /* 16px */
margin: var(--spacing-2); /* 8px */
gap: var(--spacing-3); /* 12px */

/* ❌ 错误 */
padding: 16px;
margin: 7px;
gap: 5px;
```

| 变量          | 值   | 使用场景             |
| ------------- | ---- | -------------------- |
| `--spacing-1` | 4px  | 紧凑间距、图标与文字 |
| `--spacing-2` | 8px  | 小间距、列表项内     |
| `--spacing-3` | 12px | 中等间距、卡片内     |
| `--spacing-4` | 16px | 标准间距、区块内     |
| `--spacing-5` | 20px | 较大间距             |
| `--spacing-6` | 24px | 大间距、区块间       |
| `--spacing-8` | 32px | 特大间距             |

---

## 字号 (Typography)

```css
/* ✅ 正确 */
font-size: var(--text-sm); /* 14px */
font-size: var(--text-base); /* 16px */
font-size: var(--text-lg); /* 18px */

/* ❌ 错误 */
font-size: 15px;
font-size: 13px;
```

| 变量          | 值   | 使用场景       |
| ------------- | ---- | -------------- |
| `--text-xs`   | 12px | 辅助文字、标签 |
| `--text-sm`   | 14px | 次要文字、按钮 |
| `--text-base` | 16px | 正文           |
| `--text-lg`   | 18px | 小标题         |
| `--text-xl`   | 20px | 标题           |
| `--text-2xl`  | 24px | 大标题         |

---

## 颜色 (Colors)

```css
/* ✅ 正确 - 语义化颜色 */
color: var(--color-text-primary);
color: var(--color-text-secondary);
background: var(--color-surface);
border-color: var(--color-border);

/* ✅ 正确 - 状态颜色 */
color: var(--color-error);
color: var(--color-warning);
color: var(--color-success);

/* ❌ 错误 - 硬编码 */
color: #333;
color: rgba(0, 0, 0, 0.6);
background: #f5f5f5;
```

### 文字颜色

| 变量                     | 用途     |
| ------------------------ | -------- |
| `--color-text-primary`   | 主要文字 |
| `--color-text-secondary` | 次要文字 |
| `--color-text-tertiary`  | 辅助文字 |
| `--color-text-disabled`  | 禁用文字 |

### 背景颜色

| 变量                        | 用途          |
| --------------------------- | ------------- |
| `--color-background`        | 页面背景      |
| `--color-surface`           | 卡片/面板背景 |
| `--color-surface-variant`   | 次级表面      |
| `--color-surface-container` | 容器背景      |

### 状态颜色

| 变量              | 用途         |
| ----------------- | ------------ |
| `--color-primary` | 主色调、链接 |
| `--color-error`   | 错误状态     |
| `--color-warning` | 警告状态     |
| `--color-success` | 成功状态     |

---

## 圆角 (Border Radius)

```css
/* ✅ 正确 */
border-radius: var(--radius-sm); /* 4px */
border-radius: var(--radius-md); /* 8px */
border-radius: var(--radius-lg); /* 12px */
border-radius: var(--radius-full); /* 9999px */

/* ❌ 错误 */
border-radius: 6px;
border-radius: 10px;
```

---

## 阴影 (Shadows)

```css
/* ✅ 正确 */
box-shadow: var(--shadow-sm);
box-shadow: var(--shadow-md);
box-shadow: var(--shadow-lg);

/* ❌ 错误 */
box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
```

---

## 交互状态

```css
/* 统一的 hover 状态 */
.button:hover {
  background: color-mix(in srgb, var(--color-primary), transparent 8%);
}

/* 统一的 disabled 状态 */
.button:disabled {
  opacity: var(--state-disabled-opacity); /* 0.38 */
  cursor: not-allowed;
}

/* 统一的 focus 状态 */
.button:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
```

---

## 特殊情况处理

如果设计稿数值不在系统中，请：

1. **优先调整为最近的系统值**
2. 如果必须自定义，添加注释说明原因：

```css
.popup-container {
  width: 380px; /* Chrome 扩展弹窗标准宽度，无法使用变量 */
}
```

---

## Stylelint 检查

运行检查：

```bash
bun run stylelint
```

如果看到警告，请修改为使用 CSS 变量。
