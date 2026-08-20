# @yiveno/design-tokens

Yiveno 设计令牌包。

## 权威

| 入口                             | 用途                                                    |
| -------------------------------- | ------------------------------------------------------- |
| **`css/brand.css`**              | Brand Core + Product Roles + `--space-*` / `--radius-*` |
| **`css/md-sys-brand-alias.css`** | Material Web：`--md-sys-*` → Brand                      |
| **`css/variables.css`**          | Material typography/motion + 轻量全局                   |
| **`css/semantic-colors.css`**    | info/success/warning/error → Roles                      |
| **`src/brand.ts`**               | Brand Core hex（TS）                                    |

```css
@import '@yiveno/design-tokens/css/brand.css';
@import '@yiveno/design-tokens/css/md-sys-brand-alias.css'; /* 扩展 Material Web */
@import '@yiveno/design-tokens/css/variables.css';
@import '@yiveno/design-tokens/css/semantic-colors.css';
```

业务 CSS 优先：`--accent` / `--surface` / `--space-md` / `--radius-lg`。

**已删除：** `material-theme.css`、`presets/*`。`color-presets` 为空壳 `@deprecated`。
