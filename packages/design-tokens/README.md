# @yiveno/design-tokens

Yiveno 设计令牌。规范正文：`docs/design/Yiveno-设计标准-v1.md`。

## 权威入口

| 入口                          | 用途                                                    |
| ----------------------------- | ------------------------------------------------------- |
| **`css/brand.css`**           | Brand Core + Product Roles + `--space-*` / `--radius-*` |
| **`css/motion.css`**          | 扩展：精简 `--motion-*`                                 |
| **`css/variables.css`**       | motion + 轻量全局                                       |
| **`css/semantic-colors.css`** | info / success / warning / error → Roles                |
| **`src/brand.ts`**            | Brand Core hex（Canvas / Badge 等无 CSS 场景）          |

```css
@import '@yiveno/design-tokens/css/brand.css';
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
- **扩展**：上述经 `frontend/src/styles/extension-ui.css`；自研 `App*` 控件

## 已移除

旧实验色板 / 多预设 theme 运行时、过时 TS 模块（`colors` / `spacing` / `animations` 等）。
