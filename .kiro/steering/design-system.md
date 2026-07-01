---
inclusion: always
---

# Yiveno 设计系统规则

本文档定义了 Yiveno 项目的设计系统规范，用于指导 Figma 设计到代码的转换。

## 🚨 强制规则（必须严格遵守）

### 1. 唯一设计标准

**该产品的任何终端项目必须引用 `@yiveno/design-tokens` 作为唯一设计标准。**

```typescript
// ✅ 正确：在所有入口文件中导入
import '@yiveno/design-tokens/css/material-theme.css'
import '@yiveno/design-tokens/css/variables.css'
import '@yiveno/design-tokens/css/semantic-colors.css'

// ❌ 错误：自定义颜色、间距、字体等设计 tokens
// import '@/design-system/tokens.css'  // 禁止！
```

### 2. 禁止内部自定义

**禁止在项目内部自定义颜色、间距、字体等设计 tokens。**

```css
/* ❌ 错误：硬编码颜色值 */
.button {
  background-color: #3b82f6; /* 禁止！ */
  padding: 16px; /* 禁止！ */
  font-size: 14px; /* 禁止！ */
}

/* ✅ 正确：使用 design-tokens 的变量 */
.button {
  background-color: var(--md-sys-color-primary);
  padding: var(--md-sys-spacing-md);
  font-size: var(--md-sys-typescale-label-large-size);
}
```

### 3. 导入顺序

**所有入口文件必须按以下顺序导入样式：**

```typescript
// 1. design-tokens 包（必须最先导入）
import '@yiveno/design-tokens/css/material-theme.css'
import '@yiveno/design-tokens/css/variables.css'
import '@yiveno/design-tokens/css/semantic-colors.css'

// 2. 项目样式
import '@/assets/main.css'
import '@/assets/fonts.css'
```

import '@yiveno/design-tokens/css/variables.css'

// 2. 项目样式
import '@/assets/main.css'
import '@/assets/fonts.css'

```

### 4. Material Web 组件样式管理

**所有 Material Web 组件的样式必须在入口处集中配置，禁止在各个组件文件中重复配置。**

```

✅ 正确做法：

- 全局样式：frontend/src/design-system/material-web-overrides.css
- 在入口文件（main.css）中导入
- 提供尺寸变体类（size-xs、size-sm、size-md）

❌ 错误做法：

- 在每个 Vue 组件的 <style scoped> 中配置 Material Web 样式
- 重复配置相同的 CSS 变量（如 --md-primary-tab-container-color）
- 在多个文件中配置相同组件的样式

例外情况：

- 只有在需要组件特定样式时，才在组件中覆盖
- 必须有明确的理由（如 Settings 页面需要更大的 Tabs）

````

**示例：**

```css
/* ✅ 正确：在 design-system/material-web-overrides.css 中统一配置 */
md-tabs {
  --md-primary-tab-container-color: transparent;
  --md-primary-tab-label-text-color: var(--color-text-secondary);
  /* ... 其他全局配置 */
}

/* ✅ 正确：组件中只覆盖特定样式 */
/* Settings.vue */
md-tabs {
  --md-primary-tab-container-height: 56px; /* Settings 页面需要更大的高度 */
}

/* ❌ 错误：在组件中重复配置所有样式 */
/* SomeComponent.vue */
md-tabs {
  --md-primary-tab-container-color: transparent;
  --md-primary-tab-label-text-color: var(--color-text-secondary);
  --md-primary-tab-active-label-text-color: var(--color-primary);
  /* ... 重复的配置 */
}
````

### 5. 检查清单

在修改任何样式代码前，必须确认：

- [ ] 是否导入了 `@yiveno/design-tokens` 的 CSS？
- [ ] 是否使用了硬编码的颜色值？（如 `#3B82F6`、`rgb(59, 130, 246)`）
- [ ] 是否使用了硬编码的间距值？（如 `16px`、`1rem`）
- [ ] 是否使用了硬编码的字号？（如 `14px`、`0.875rem`）
- [ ] 是否创建了自定义的 design tokens 文件？
- [ ] 是否在组件中重复配置了 Material Web 组件的样式？

---

## 🎨 设计系统概览

Yiveno 采用 **Material Design 3** 设计系统，基于薄荷绿色系（种子色 #89EAD7）。

### 核心原则

1. **Material Design 3 优先** - 遵循 MD3 规范，不覆盖自动生成的颜色
2. **统一设计语言** - 插件和官网使用相同的设计系统
3. **深色主题优先** - 为专业用户设计的深色界面
4. **可访问性** - 符合 WCAG 对比度要求
5. **禁止魔法数字** - 所有数值必须使用设计 tokens

---

## 📦 技术栈

### 框架与库

- **UI 框架**: Vue 3 (Composition API)
- **状态管理**: Pinia
- **样式方案**: CSS Variables + Scoped CSS
- **构建工具**: Vite
- **类型系统**: TypeScript
- **组件库**: 自研组件库（基于 Material Design 3）

### 关键依赖

```json
{
  "@yiveno/design-tokens": "workspace:*",
  "@vueuse/core": "^14.0.0",
  "immer": "^10.2.0",
  "mitt": "^3.0.1",
  "pinia": "^3.0.3",
  "vue": "^3.5.18"
}
```

---

## 🎯 设计 Tokens 定义

### Token 存储位置

设计 tokens 定义在独立的 workspace package 中：

```
packages/design-tokens/
├── src/
│   ├── colors.ts          # 颜色定义
│   ├── spacing.ts         # 间距定义
│   ├── typography.ts      # 字体定义
│   └── index.ts
├── css/
│   ├── material-theme.css # Material Design 3 主题
│   └── variables.css      # CSS 变量定义
└── package.json
```

### 1. 颜色系统 (Colors)

#### Material Design 3 主题色

```css
/* 主色调 - 薄荷绿 */
--md-sys-color-primary: #83d5c5; /* 亮色模式 */
--md-sys-color-on-primary: #003731; /* 主色上的文本 */
--md-sys-color-primary-container: #004d44; /* 主色容器 */

/* 次要色 - 蓝绿色 */
--md-sys-color-secondary: #b1ccc5;
--md-sys-color-on-secondary: #1c3531;

/* 表面色 */
--md-sys-color-surface: #0e1513; /* 深色模式表面 */
--md-sys-color-on-surface: #dfe4e1; /* 表面上的文本 */
--md-sys-color-background: #0e1513; /* 页面背景 */
--md-sys-color-on-background: #dfe4e1; /* 背景上的文本 */

/* 错误色 */
--md-sys-color-error: #ffb4ab;
--md-sys-color-on-error: #690005;
```

#### 语义化颜色 (TypeScript)

```typescript
// packages/design-tokens/src/colors.ts
export const colors = {
  semantic: {
    success: '#22c55e', // 成功
    error: '#ef4444', // 错误
    warning: '#f59e0b', // 警告
    info: '#3b82f6' // 信息
  },
  brand: {
    primary: '#83d5c5', // 品牌主色
    secondary: '#b1ccc5' // 品牌次色
  }
}
```

#### 使用规范

```vue
<style scoped>
/* ✅ 正确：使用 CSS 变量 */
.button-primary {
  background-color: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
}

.text-error {
  color: var(--color-semantic-error);
}

/* ❌ 错误：硬编码颜色 */
.button {
  background-color: #83d5c5; /* 禁止！ */
  color: #333; /* 禁止！ */
}
</style>
```

### 2. 间距系统 (Spacing)

```css
/* 间距 tokens */
--spacing-1: 4px; /* 紧凑间距、图标与文字 */
--spacing-2: 8px; /* 小间距、列表项内 */
--spacing-3: 12px; /* 中等间距、卡片内 */
--spacing-4: 16px; /* 标准间距、区块内 */
--spacing-5: 20px; /* 较大间距 */
--spacing-6: 24px; /* 大间距、区块间 */
--spacing-8: 32px; /* 特大间距 */
--spacing-lg: 24px; /* 别名：大间距 */
--spacing-md: 12px; /* 别名：中等间距 */
--spacing-sm: 8px; /* 别名：小间距 */
--spacing-xs: 4px; /* 别名：超小间距 */
```

#### 使用规范

```vue
<style scoped>
/* ✅ 正确：使用间距 tokens */
.card {
  padding: var(--spacing-4);
  margin-bottom: var(--spacing-6);
  gap: var(--spacing-3);
}

/* ❌ 错误：魔法数字 */
.card {
  padding: 16px; /* 禁止！ */
  margin-bottom: 25px; /* 禁止！ */
}
</style>
```

### 3. 字体系统 (Typography)

```css
/* 字号 */
--text-xs: 12px; /* 辅助文字、标签 */
--text-sm: 14px; /* 次要文字、按钮 */
--text-base: 16px; /* 正文 */
--text-lg: 18px; /* 小标题 */
--text-xl: 20px; /* 标题 */
--text-2xl: 24px; /* 大标题 */

/* 字重 */
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;

/* 行高 */
--line-height-tight: 1.25;
--line-height-normal: 1.5;
--line-height-relaxed: 1.75;
```

#### 使用规范

```vue
<style scoped>
/* ✅ 正确：使用字体 tokens */
.title {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  line-height: var(--line-height-normal);
}

/* ❌ 错误：硬编码字号 */
.title {
  font-size: 18px; /* 禁止！ */
  font-weight: 600; /* 禁止！ */
}
</style>
```

### 4. 圆角 (Border Radius)

```css
--radius-sm: 4px;
--radius-md: 8px;
--radius-lg: 12px;
--radius-full: 9999px;
```

### 5. 阴影 (Shadows / Elevation)

**Material Design 3 Elevation 系统**

Material Design 3 使用 Elevation（高度）来表示元素在 Z 轴上的相对距离，通过阴影效果创造层次感。

```css
/* Material Design 3 Elevation 变量 */
--md-sys-elevation-0: none; /* Level 0: 无阴影（平面） */
--md-sys-elevation-1: ...; /* Level 1: 最轻微阴影（卡片） */
--md-sys-elevation-2: ...; /* Level 2: 轻微阴影（按钮） */
--md-sys-elevation-3: ...; /* Level 3: 中等阴影（菜单） */
--md-sys-elevation-4: ...; /* Level 4: 较强阴影（导航） */
--md-sys-elevation-5: ...; /* Level 5: 最强阴影（对话框） */

/* 便捷别名（推荐使用） */
--shadow-none: var(--md-sys-elevation-0);
--shadow-sm: var(--md-sys-elevation-1);
--shadow-md: var(--md-sys-elevation-2);
--shadow-lg: var(--md-sys-elevation-3);
--shadow-xl: var(--md-sys-elevation-4);
--shadow-2xl: var(--md-sys-elevation-5);
```

**使用场景**

| Elevation Level | 别名            | 使用场景 | 示例           |
| --------------- | --------------- | -------- | -------------- |
| Level 0         | `--shadow-none` | 平面元素 | 背景、分隔线   |
| Level 1         | `--shadow-sm`   | 轻微悬浮 | 卡片、徽章     |
| Level 2         | `--shadow-md`   | 中等悬浮 | 按钮、芯片     |
| Level 3         | `--shadow-lg`   | 明显悬浮 | 菜单、工具提示 |
| Level 4         | `--shadow-xl`   | 强烈悬浮 | 导航抽屉       |
| Level 5         | `--shadow-2xl`  | 最高层级 | 模态对话框     |

**使用规范**

```css
/* ✅ 推荐：使用便捷别名 */
.card {
  box-shadow: var(--shadow-sm);
}

.card:hover {
  box-shadow: var(--shadow-md);
}

.dialog {
  box-shadow: var(--shadow-lg);
}

/* ✅ 也可以：直接使用 Material Elevation 变量 */
.menu {
  box-shadow: var(--md-sys-elevation-3);
}

/* ❌ 错误：硬编码阴影值 */
.card {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); /* 禁止！ */
}
```

**注意事项**

- **不需要使用 `<md-elevation>` 组件**：直接使用 CSS 变量即可
- **遵循 Material Design 规范**：不要创建自定义的阴影值
- **保持一致性**：同类元素使用相同的 elevation level

### 6. 动画 (Motion)

```css
/* Material Design 3 动画 tokens */
--md-sys-motion-duration-short1: 50ms;
--md-sys-motion-duration-short2: 100ms;
--md-sys-motion-duration-medium1: 250ms;
--md-sys-motion-duration-medium2: 300ms;
--md-sys-motion-duration-long1: 450ms;
--md-sys-motion-duration-long2: 500ms;

--md-sys-motion-easing-standard: cubic-bezier(0.2, 0, 0, 1);
--md-sys-motion-easing-emphasized: cubic-bezier(0.2, 0, 0, 1);
```

---

## 🏗️ 组件库架构

### 组件分类

```
frontend/src/components/
├── base/              # 基础组件（原子级）
│   ├── Button/
│   ├── Input/
│   ├── Dialog/
│   ├── Card/
│   ├── Icon/
│   └── ...
├── composite/         # 复合组件（分子级）
│   ├── BookmarkItem/
│   ├── SearchBar/
│   └── ...
└── index.ts          # 统一导出
```

### 组件命名规范

- **文件名**: PascalCase (e.g., `Button.vue`, `Dialog.vue`)
- **组件名**: 使用 `defineOptions({ name: 'ComponentName' })`
- **CSS 类名**: kebab-case with prefix (e.g., `yiveno-button`, `yiveno-dialog`)

### 组件示例

```vue
<!-- frontend/src/components/base/Button/Button.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import type { ButtonProps } from './Button.d'

defineOptions({ name: 'YivenoButton' })

const props = withDefaults(defineProps<ButtonProps>(), {
  variant: 'primary',
  size: 'medium'
})

const buttonClasses = computed(() => [
  'yiveno-button',
  `yiveno-button--${props.variant}`,
  `yiveno-button--${props.size}`
])
</script>

<template>
  <button :class="buttonClasses">
    <slot />
  </button>
</template>

<style scoped>
.yiveno-button {
  padding: var(--spacing-3) var(--spacing-4);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  border-radius: var(--radius-md);
  transition: all var(--md-sys-motion-duration-short2) var(--md-sys-motion-easing-standard);
}

.yiveno-button--primary {
  background-color: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
}

.yiveno-button--primary:hover {
  background-color: color-mix(in srgb, var(--md-sys-color-primary), black 8%);
}
</style>
```

---

## 🎨 从 Figma 到代码的转换规则

### 1. 颜色转换

| Figma 设计     | 代码实现                        |
| -------------- | ------------------------------- |
| Primary Color  | `var(--md-sys-color-primary)`   |
| Text/Primary   | `var(--color-text-primary)`     |
| Text/Secondary | `var(--color-text-secondary)`   |
| Background     | `var(--color-background)`       |
| Surface        | `var(--color-surface)`          |
| Error          | `var(--color-semantic-error)`   |
| Success        | `var(--color-semantic-success)` |

### 2. 间距转换

| Figma 值 | 代码实现                      |
| -------- | ----------------------------- |
| 4px      | `var(--spacing-1)`            |
| 8px      | `var(--spacing-2)`            |
| 12px     | `var(--spacing-3)`            |
| 16px     | `var(--spacing-4)`            |
| 24px     | `var(--spacing-6)`            |
| 其他值   | 使用最接近的 token + 注释说明 |

### 3. 字号转换

| Figma 值 | 代码实现           |
| -------- | ------------------ |
| 12px     | `var(--text-xs)`   |
| 14px     | `var(--text-sm)`   |
| 16px     | `var(--text-base)` |
| 18px     | `var(--text-lg)`   |
| 20px     | `var(--text-xl)`   |
| 24px     | `var(--text-2xl)`  |

### 4. 圆角转换

| Figma 值 | 代码实现             |
| -------- | -------------------- |
| 4px      | `var(--radius-sm)`   |
| 8px      | `var(--radius-md)`   |
| 12px     | `var(--radius-lg)`   |
| 全圆角   | `var(--radius-full)` |

---

## 📐 布局规范

### Flexbox 优先

```vue
<style scoped>
/* ✅ 推荐：使用 Flexbox */
.container {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
  align-items: center;
}

/* ✅ 也可以：Grid 布局 */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--spacing-4);
}
</style>
```

### 响应式设计

```vue
<style scoped>
.container {
  padding: var(--spacing-4);
}

/* Chrome Extension 固定宽度 */
@media (min-width: 380px) {
  .popup-container {
    width: 380px; /* Chrome 扩展弹窗标准宽度 */
  }
}
</style>
```

---

## 🔧 工具与工作流

### 导入设计 tokens

```typescript
// 在 TypeScript 中使用
import { colors, spacing, fontSize } from '@yiveno/design-tokens'

const buttonStyle = {
  backgroundColor: colors.brand.primary,
  padding: spacing.md,
  fontSize: fontSize.base
}
```

```vue
<!-- 在 Vue 组件中使用 CSS 变量 -->
<script setup lang="ts">
// CSS tokens 通过 CSS 变量自动可用
</script>

<template>
  <button class="btn-primary">登录</button>
</template>

<style scoped>
.btn-primary {
  background-color: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  padding: var(--spacing-md) var(--spacing-lg);
  font-size: var(--text-base);
  border-radius: var(--radius-md);
}
</style>
```

### 代码检查

```bash
# 类型检查
bun run typecheck:force

# 代码规范检查
bun run lint:check:force

# 样式检查（会检查是否使用了魔法数字）
bun run stylelint:force
```

---

## 🚫 禁止事项

### 1. 禁止硬编码数值

```vue
<style scoped>
/* ❌ 错误 */
.button {
  padding: 16px;
  font-size: 14px;
  color: #333;
  border-radius: 8px;
}

/* ✅ 正确 */
.button {
  padding: var(--spacing-4);
  font-size: var(--text-sm);
  color: var(--color-text-primary);
  border-radius: var(--radius-md);
}
</style>
```

### 2. 禁止使用 Tailwind 类名

```vue
<!-- ❌ 错误：Figma 生成的 Tailwind 类名 -->
<div class="flex items-center gap-4 p-4 bg-gray-100">
  ...
</div>

<!-- ✅ 正确：使用项目的 CSS 变量 -->
<div class="container">
  ...
</div>

<style scoped>
.container {
  display: flex;
  align-items: center;
  gap: var(--spacing-4);
  padding: var(--spacing-4);
  background-color: var(--color-surface);
}
</style>
```

### 3. 禁止直接复制 Figma 生成的代码

Figma MCP 生成的代码（React + Tailwind）仅作为**设计参考**，必须：

1. 转换为 Vue 3 Composition API
2. 替换 Tailwind 类名为项目的 CSS 变量
3. 复用现有组件（Button、Input、Dialog 等）
4. 遵循项目的 DDD 分层架构

---

## 📚 相关资源

### 内部文档

- [设计系统 README](../../packages/design-tokens/README.md)
- [设计系统使用示例](../../packages/design-tokens/USAGE.md)
- [组件库文档](../../frontend/src/components/README.md)
- [架构分层说明](../../frontend/src/ARCHITECTURE_LAYERS.md)

### 外部资源

- [Material Design 3](https://m3.material.io/)
- [Material Theme Builder](https://m3.material.io/theme-builder)
- [Vue 3 文档](https://vuejs.org/)
- [Pinia 文档](https://pinia.vuejs.org/)

---

## 🎯 Figma 集成工作流

### 步骤 1: 获取设计

1. 在 Figma 中选择要实现的组件/页面
2. 复制 Figma URL（包含 fileKey 和 nodeId）
3. 使用 Figma MCP 工具获取设计上下文

### 步骤 2: 分析设计

1. 查看 Figma 生成的代码（React + Tailwind）
2. 识别设计中使用的颜色、间距、字号
3. 映射到项目的设计 tokens

### 步骤 3: 实现代码

1. 创建 Vue 组件（或复用现有组件）
2. 使用 CSS 变量替换 Tailwind 类名
3. 确保 1:1 视觉还原
4. 运行代码检查确保符合规范

### 步骤 4: 验证

1. 对比 Figma 截图和实际渲染
2. 检查响应式行为
3. 测试交互功能
4. 确保可访问性

---

**最后更新**: 2025-12-12  
**版本**: 1.0.0
