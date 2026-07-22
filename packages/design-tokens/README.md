# @yiveno/design-tokens

Yiveno 设计令牌包 - 基于 Material Design 3 的统一设计系统。

## 📦 包含内容

- **Material Design 3 主题** - 见 `css/material-theme.css`（默认种子与产品文档 §2.5.5「晴空」一致）
- **官方配色预设** - `src/color-presets.ts`：六套色相 `id` / 中文名 / Builder 种子 Hex（与产品文档 §2.5.5 同步）
- **颜色系统** - 完整的 MD3 颜色方案 + 语义色
- **间距系统** - Material Design spacing tokens
- **形状系统** - Material Design shape tokens
- **字体系统** - 字体家族、大小、字重
- **CSS 变量** - 完整的 MD3 CSS 自定义属性

## 🎨 设计理念

### Material Design 3 主题

Yiveno 完全采用 **Material Design 3** 设计系统：

- **种子色**: `#89EAD7` (薄荷绿)
- **Primary**: `#83d5c5` (亮色) / `#016b5d` (暗色)
- **Secondary**: `#b1ccc5` (亮色) / `#4f5b58` (暗色)
- **完整色系**: MD3 自动生成的完整颜色方案

### 设计原则

1. **遵循 Material Design 3 规范** - 不覆盖任何 MD3 自动生成的颜色
2. **统一的设计语言** - 插件和官网使用相同的设计系统
3. **深色主题优先** - 为专业用户设计的深色界面
4. **可访问性** - 符合 WCAG 对比度要求

## 📖 使用方法

### 1. 在 CSS 中使用（推荐）

推荐直接导入 CSS 文件使用 CSS 变量：

```typescript
// 在你的入口文件中
import '@yiveno/design-tokens/css/material-theme.css'
import '@yiveno/design-tokens/css/variables.css'
import '@yiveno/design-tokens/css/semantic-colors.css'

// 然后在 CSS 中使用
.button {
  background-color: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  padding: var(--md-sys-spacing-md);
  border-radius: var(--md-sys-shape-corner-medium);
}
```

### 2. 在 TypeScript/JavaScript 中使用（无法使用 CSS 变量的场景）

**适用场景**：Canvas、Chrome Badge API、浏览器控制台等无法使用 CSS 变量的地方。

```typescript
// 导入颜色常量（提供 CSS、RGB、Hex 三种格式）
import { materialColors, semanticColors } from '@yiveno/design-tokens/colors'

// Canvas 绘图示例
const ctx = canvas.getContext('2d')
ctx.fillStyle = materialColors.primary.rgb // 'rgb(47, 98, 140)'
ctx.fillRect(0, 0, 100, 100)

// Chrome Badge API 示例
chrome.action.setBadgeBackgroundColor({
  color: semanticColors.success.rgb // 'rgb(46, 125, 50)'
})

// 浏览器控制台样式示例
console.log(
  `%c成功`,
  `background: ${semanticColors.successContainer.rgb}; color: ${semanticColors.success.rgb}`
)

// 获取不同格式的颜色值
materialColors.primary.css // 'var(--md-sys-color-primary)'
materialColors.primary.rgb // 'rgb(47, 98, 140)'
materialColors.primary.hex // '#2f628c'
```

**可用的颜色导出**：

```typescript
// Material Design 3 主题色
materialColors.primary // 主色（亮色主题）
materialColors.primaryDark // 主色（暗色主题）
materialColors.secondary // 次要色（亮色主题）
materialColors.secondaryDark // 次要色（暗色主题）
materialColors.error // 错误色（亮色主题）
materialColors.errorDark // 错误色（暗色主题）
materialColors.surface // 表面色（亮色主题）
materialColors.surfaceDark // 表面色（暗色主题）
materialColors.onSurface // 表面上的文本（亮色主题）
materialColors.onSurfaceDark // 表面上的文本（暗色主题）

// 语义化颜色
semanticColors.warning // 警告色
semanticColors.warningContainer // 警告容器色
semanticColors.success // 成功色
semanticColors.successContainer // 成功容器色
semanticColors.info // 信息色
semanticColors.infoContainer // 信息容器色

// 强调色/装饰色
accentColors.teal // 青色
accentColors.gold // 金色
accentColors.amber // 琥珀色
accentColors.purple // 紫色
accentColors.ai // AI 功能色

// Primary 色彩系列（50-900）
primaryScale[50] // 最浅
primaryScale[500] // 中等
primaryScale[900] // 最深
```

**辅助函数**：

```typescript
import { getColor, getThemeColor } from '@yiveno/design-tokens/colors'

// 获取特定格式的颜色
const rgbColor = getColor(materialColors.primary, 'rgb')
const hexColor = getColor(materialColors.primary, 'hex')

// 根据主题获取颜色
const themeColor = getThemeColor(
  materialColors.primary, // 亮色
  materialColors.primaryDark, // 暗色
  'dark' // 当前主题
)
```

### 3. 在 Vue / Astro 中使用

```vue
<script setup>
// CSS tokens 通过 CSS 变量自动可用
</script>

<template>
  <button class="btn-primary">登录</button>
</template>

<style scoped>
.btn-primary {
  background-color: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
}
</style>
```

### 4. Chrome Extension 中使用

```typescript
// 在入口文件中导入 CSS
import '@yiveno/design-tokens/css/material-theme.css'
import '@yiveno/design-tokens/css/variables.css'
import '@yiveno/design-tokens/css/semantic-colors.css'

// 在 CSS 中使用变量
.button {
  background-color: var(--md-sys-color-primary);
}

// 在无法使用 CSS 变量的场景（Badge API、Canvas 等）
import { materialColors, semanticColors } from '@yiveno/design-tokens/colors'

// Badge API
chrome.action.setBadgeBackgroundColor({
  color: semanticColors.success.rgb
})

// Canvas
const ctx = canvas.getContext('2d')
ctx.fillStyle = materialColors.primary.rgb
```

## 🎯 颜色自动同步

**v1.1.0 新特性**：所有颜色现在支持自动同步！

只要修改 `@yiveno/design-tokens` 包中的颜色定义，所有使用这些颜色的地方都会自动同步，**包括无法使用 CSS 变量的场景**（Canvas、Badge API、Console 等）。

**工作原理**：

1. **CSS 变量场景**：通过 CSS 变量自动同步（已有功能）
2. **TypeScript 常量场景**：通过导入 TypeScript 常量自动同步（v1.1.0 新增）

**示例**：

```typescript
// ✅ 自动同步：修改 design-tokens 包后，这里的颜色会自动更新
import { materialColors } from '@yiveno/design-tokens/colors'

const BADGE_COLORS = {
  info: materialColors.primary.rgb, // 自动同步
  success: semanticColors.success.rgb, // 自动同步
  warning: semanticColors.warning.rgb, // 自动同步
  error: materialColors.error.rgb // 自动同步
}

// ❌ 不会自动同步：硬编码的颜色值
const BADGE_COLORS = {
  info: 'rgb(47, 98, 140)', // 需要手动更新
  success: 'rgb(46, 125, 50)' // 需要手动更新
}
```

## 🎯 设计令牌列表

### Material Design 颜色 tokens

```css
/* 主题色 */
var(--md-sys-color-primary)              /* 主色 - 薄荷绿 */
var(--md-sys-color-on-primary)           /* 主色上的文本 */
var(--md-sys-color-secondary)            /* 次要色 - 蓝绿色 */
var(--md-sys-color-on-secondary)         /* 次要色上的文本 */

/* 表面色 */
var(--md-sys-color-surface)              /* 表面背景 */
var(--md-sys-color-on-surface)           /* 表面上的文本 */
var(--md-sys-color-background)           /* 页面背景 */
var(--md-sys-color-on-background)        /* 背景上的文本 */
```

### 语义化颜色（CSS 变量）

```css
/* 语义色 - 来自 semantic-colors.css */
var(--yiveno-semantic-warning)           /* 警告色 */
var(--yiveno-semantic-success)           /* 成功色 */
var(--yiveno-semantic-info)              /* 信息色 */

/* 强调色 - 来自 semantic-colors.css */
var(--yiveno-accent-teal)                /* 青色 */
var(--yiveno-accent-gold)                /* 金色 */
var(--yiveno-accent-amber)               /* 琥珀色 */
var(--yiveno-accent-purple)              /* 紫色 */
var(--yiveno-accent-ai)                  /* AI 功能色 */
```

### 语义化颜色（TypeScript）

```typescript
colors.semantic.success // #22c55e - 成功
colors.semantic.error // #ef4444 - 错误
colors.semantic.warning // #f59e0b - 警告
colors.semantic.info // #3b82f6 - 信息
```

### 间距

```typescript
spacing.xs // 4px
spacing.sm // 8px
spacing.md // 12px
spacing.base // 16px
spacing.lg // 24px
spacing.xl // 32px
```

### 字体

```typescript
fontSize.sm // 12px
fontSize.base // 14px
fontSize.md // 16px
fontSize.lg // 18px
```

## 🔄 跨平台使用

### 插件前端 (Chrome Extension)

```typescript
import { materialTheme } from '@yiveno/design-tokens'
// 自动映射到 Chrome Material Design
```

### 官网 (Astro)

```typescript
import { colors, spacing } from '@yiveno/design-tokens'
// 直接使用设计令牌
```

## 📝 维护指南

### 修改 Material Design 主题色

1. 访问 [Material Design Theme Builder](https://m3.material.io/theme-builder)
2. 调整种子色（当前为 #89EAD7）
3. 导出 CSS 文件
4. 替换 `css/material-theme.css`
5. 更新 `src/colors.ts` 中的颜色值

### 修改其他 tokens

- **语义色**: 编辑 `src/colors.ts` 的 `semantic` 部分
- **间距**: 编辑 `css/variables.css` 的 spacing tokens
- **字体**: 编辑 `src/typography.ts`
- **形状**: 编辑 `css/variables.css` 的 shape tokens

### ⚠️ 不要做的事情

- ❌ 不要手动覆盖 Material Design 自动生成的颜色
- ❌ 不要使用 `brand-override.css`（已废弃）
- ❌ 不要在 `variables.css` 中定义品牌色（应使用 MD3 颜色）

## 🎯 设计原则

1. **一致性优先**: 所有产品使用相同的设计令牌
2. **简单实用**: 只提供真正需要的令牌
3. **平台适配**: 支持 Web 和 Chrome Extension
4. **类型安全**: 完整的 TypeScript 类型支持

## 📚 完整文档

### 设计规范

- [设计原则](./docs/DESIGN_PRINCIPLES.md) - 核心设计理念
- [颜色使用指南](./docs/COLOR_USAGE.md) - 如何使用颜色系统
- [间距使用指南](./docs/SPACING_GUIDE.md) - 如何使用间距系统
- [字体使用指南](./docs/TYPOGRAPHY_GUIDE.md) - 如何使用字体系统
- [跨平台映射表](./docs/PLATFORM_MAPPING.md) - 不同平台的实现方式
- [核心 UI 规范](./docs/CORE_UI_SPECS.md) - 核心 UI 元素规范

### 实现示例

- [Web CSS 变量示例](./examples/web-css-variables.html) - HTML/CSS 完整示例
- [React Native 示例](./examples/react-native.tsx) - React Native 完整示例
- [Flutter 示例](./examples/flutter.dart) - Flutter 完整示例
- [Vue 组件示例](./examples/button-example.vue) - Vue 组件示例

## 🚀 发布到 npm

### 内部项目使用（Monorepo）

```json
// frontend/package.json 或 website/package.json
{
  "dependencies": {
    "@yiveno/design-tokens": "workspace:*"
  }
}
```

### 外部项目使用（npm）

```bash
# 发布到 npm（需要权限）
cd packages/design-tokens
npm publish --access public

# 外部项目安装
npm install @yiveno/design-tokens
# 或
bun add @yiveno/design-tokens
```

## 🤝 贡献指南

### 修改设计 tokens

1. **修改颜色**：编辑 `src/colors.ts` 或使用 [Material Theme Builder](https://m3.material.io/theme-builder) 生成新的 `css/material-theme.css`
2. **修改间距**：编辑 `css/variables.css` 的 spacing tokens
3. **修改字体**：编辑 `src/typography.ts`
4. **测试变更**：在 `examples/` 中测试所有平台的实现
5. **更新文档**：同步更新 `docs/` 中的相关文档

### 添加新的 token

1. 在对应的 TypeScript 文件中添加（如 `src/colors.ts`）
2. 在 `css/variables.css` 中添加对应的 CSS 变量
3. 更新文档说明使用方法
4. 在示例中展示新 token 的用法

## 📜 License

MIT
