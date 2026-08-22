---
inclusion: always
---

# Yiveno 设计系统规则

> **Normative：** `docs/design/Yiveno-设计标准-v1.md` + `@yiveno/design-tokens/css/brand.css`。  
> 冲突时以设计标准与 `brand.css` 为准。

## 强制规则

### 1. 唯一设计标准

**任何终端项目必须引用 `@yiveno/design-tokens` 作为唯一设计标准。**

```typescript
// ✅ 扩展入口（见 frontend/src/styles/extension-ui.css）
import '@yiveno/design-tokens/css/brand.css'
import '@yiveno/design-tokens/css/variables.css'
import '@yiveno/design-tokens/css/semantic-colors.css'

// ✅ 官网：通常只引 brand.css
```

### 2. 禁止内部自定义色板

业务 CSS 写 Brand Roles：`--accent` / `--surface` / `--on-surface` / `--space-*` / `--radius-*`。

```css
/* ✅ */
.button {
  background-color: var(--accent);
  color: var(--on-accent);
  padding: var(--space-md);
  border-radius: var(--radius-full);
}

/* ❌ 硬编码色值 / 另造 token 文件 */
```

### 3. 扩展控件与图标

- 控件：自研 `AppButton` / `AppIconButton` / `AppSwitch` / `AppLinearProgress`
- 图标：**Lucide 线框按需内联**（`AppIcon` / `icon-paths.ts`）；禁止第二套图标库 / 图标字体 CDN

### 4. 检查清单

- [ ] 是否经 `brand.css` / `extension-ui.css` 消费 Roles？
- [ ] 是否硬编码颜色 / 间距？
- [ ] 图标是否只经 `AppIcon` / `icon-paths`？

## Token 布局

```
packages/design-tokens/
├── src/brand.ts
├── css/brand.css          # 权威
├── css/motion.css
├── css/variables.css
└── css/semantic-colors.css
```
