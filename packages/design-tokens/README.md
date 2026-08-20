# @yiveno/design-tokens

Yiveno 设计令牌。规范正文：`docs/design/Yiveno-设计标准-v1.md`。

## 权威入口

| 入口                             | 用途                                                    |
| -------------------------------- | ------------------------------------------------------- |
| **`css/brand.css`**              | Brand Core + Product Roles + `--space-*` / `--radius-*` |
| **`css/md-sys-brand-alias.css`** | Material Web：`--md-sys-*` → Brand（仅扩展）            |
| **`css/variables.css`**          | Typography / motion + 轻量全局                          |
| **`css/semantic-colors.css`**    | info / success / warning / error → Roles                |
| **`src/brand.ts`**               | Brand Core hex（Canvas / Badge 等无 CSS 场景）          |

```css
@import '@yiveno/design-tokens/css/brand.css';
@import '@yiveno/design-tokens/css/md-sys-brand-alias.css'; /* 扩展 Material Web */
@import '@yiveno/design-tokens/css/variables.css';
@import '@yiveno/design-tokens/css/semantic-colors.css';
```

业务 CSS 优先：`--accent` / `--surface` / `--space-md` / `--radius-lg`。

```ts
import { brandCore } from '@yiveno/design-tokens'
// 或
import { brandCore } from '@yiveno/design-tokens/brand'
```

## 消费方

- **官网**：`brand.css`（`MainLayout` / `site.css`）
- **扩展**：上述四文件经 `frontend/src/styles/material-ui.css`

## 已移除

MD 多预设、`material-theme.css`、旧 TS 模块（`colors` / `spacing` / `animations` 等）、包内过时 USAGE/docs。
