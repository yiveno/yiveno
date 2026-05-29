# Tailwind CSS 迁移到 Material Design Tokens

## 目标

移除 Tailwind CSS 依赖，统一使用 `@acuity-bookmarks/design-tokens` 的 Material Design 系统。

## Tailwind 到 Material Design 映射

### 布局类

| Tailwind                            | Material Design CSS                             |
| ----------------------------------- | ----------------------------------------------- |
| `flex`, `flex-col`, `flex-row`      | `display: flex; flex-direction: column/row`     |
| `items-center`, `items-start`       | `align-items: center/start`                     |
| `justify-between`, `justify-center` | `justify-content: space-between/center`         |
| `gap-3`, `gap-8`                    | `gap: var(--md-sys-spacing-sm/md)`              |
| `min-h-screen`                      | `min-height: 100vh`                             |
| `w-full`                            | `width: 100%`                                   |
| `container`                         | 使用 `.container` 工具类                        |
| `mx-auto`                           | `margin-inline: auto`                           |
| `px-4`, `py-2`                      | `padding-inline/block: var(--md-sys-spacing-*)` |

### 定位类

| Tailwind               | Material Design CSS                      |
| ---------------------- | ---------------------------------------- |
| `sticky`, `top-0`      | `position: sticky; inset-block-start: 0` |
| `z-50`                 | `z-index: 50`                            |
| `relative`, `absolute` | `position: relative/absolute`            |

### 颜色和背景

| Tailwind             | Material Design CSS                                |
| -------------------- | -------------------------------------------------- |
| `bg-bg-default`      | `background-color: var(--md-sys-color-background)` |
| `bg-bg-depth`        | `background-color: var(--md-sys-color-surface)`    |
| `text-content`       | `color: var(--md-sys-color-on-background)`         |
| `text-content-muted` | `color: var(--md-sys-color-on-surface-variant)`    |
| `text-primary-400`   | `color: var(--md-sys-color-primary)`               |
| `border-white/5`     | `border-color: rgba(255, 255, 255, 0.05)`          |

### 效果类

| Tailwind                     | Material Design CSS                                           |
| ---------------------------- | ------------------------------------------------------------- |
| `backdrop-blur-xl`           | `backdrop-filter: blur(24px)`                                 |
| `shadow-lg`                  | `box-shadow: var(--md-sys-elevation-3)`                       |
| `rounded-lg`, `rounded-full` | `border-radius: var(--md-sys-shape-corner-large/extra-large)` |

### 响应式

| Tailwind         | Material Design CSS                           |
| ---------------- | --------------------------------------------- |
| `md:flex`        | `@media (min-width: 768px) { display: flex }` |
| `hidden md:flex` | 使用 CSS `display: none` + 媒体查询           |

## 迁移步骤

1. ✅ 创建全局工具类 CSS (`assets/css/utilities.css`)
2. ⏳ 替换 `layouts/default.vue`
3. ⏳ 替换所有 `pages/*.vue`
4. ⏳ 替换所有 `components/**/*.vue`
5. ✅ 验证样式正确性
6. ✅ 删除 Tailwind 相关依赖（如果有）

## 工具类策略

创建一组基于 Material Design tokens 的工具类：

- `.flex`, `.flex-col`, `.flex-row`
- `.items-center`, `.justify-between`
- `.gap-sm`, `.gap-md`, `.gap-lg`
- `.p-sm`, `.p-md`, `.p-lg`, `.px-md`, `.py-sm`
- `.m-auto`, `.mx-auto`
- `.text-sm`, `.text-lg`, `.text-xl`
- `.rounded-md`, `.rounded-lg`
- `.shadow-sm`, `.shadow-md`
- 响应式变体使用媒体查询

## 注意事项

1. **不使用任意值**：所有间距、颜色都来自 Material Design tokens
2. **语义化**：优先使用语义化的 token 名称
3. **一致性**：与前端插件保持相同的设计系统
4. **性能**：减少 CSS 体积，只保留实际使用的样式
