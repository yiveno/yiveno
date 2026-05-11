# AcuityBookmarks Material Design 3 全面落地计划

**文档版本**: 1.0.0  
**创建日期**: 2025-05-11  
**负责人**: 产品团队

---

## 📋 目录

1. [当前状态分析](#当前状态分析)
2. [Material Design 3 核心理念](#material-design-3-核心理念)
3. [落地策略](#落地策略)
4. [实施路线图](#实施路线图)
5. [技术方案](#技术方案)
6. [组件库建设](#组件库建设)
7. [设计协作流程](#设计协作流程)
8. [质量保证](#质量保证)

---

## 当前状态分析

### ✅ 已完成的工作

1. **设计 Tokens 系统**
   - ✅ 创建了独立的 `@acuity-bookmarks/design-tokens` 包
   - ✅ 使用 Material Theme Builder 生成了完整的主题（种子色 #3B82F6）
   - ✅ 包含 6 个主题变体（Light/Dark × Standard/Medium Contrast/High Contrast）
   - ✅ 定义了语义色、强调色、Primary 色彩系列
   - ✅ 发布到 npm（`@acuity-bookmarks/design-tokens@1.1.1`）

2. **颜色系统**
   - ✅ Material Design 3 主题色（Primary、Secondary、Tertiary、Error）
   - ✅ Surface 色彩系统（Surface、Surface Variant、Surface Container）
   - ✅ 语义色（Success、Warning、Info）
   - ✅ 强调色（Teal、Gold、Amber、Purple、AI）
   - ✅ 支持亮色/暗色主题自动切换

3. **基础 Tokens**
   - ✅ Spacing（基于 4px 基准）
   - ✅ Shape（圆角系统）
   - ✅ Elevation（阴影系统）
   - ✅ Motion（动画时长和缓动函数）

4. **项目集成**
   - ✅ Frontend（Chrome Extension）已集成
   - ✅ Website（官网）已集成
   - ✅ 清理了所有硬编码颜色值
   - ✅ 统一使用 design-tokens 包

### ❌ 尚未完成的工作

1. **Typography 系统**
   - ❌ 未使用 Material Design 3 的 Type Scale
   - ❌ 字体定义不完整（缺少 Display、Headline、Body、Label 等）
   - ❌ 未定义字体加载策略

2. **组件库**
   - ❌ 没有基于 Material Design 3 的组件库
   - ❌ 现有组件未遵循 Material Design 3 规范
   - ❌ 缺少 Material Design 3 的交互模式（Ripple、State Layer 等）

3. **交互设计**
   - ❌ 未实现 Material Design 3 的动效系统
   - ❌ 缺少 Ripple 效果
   - ❌ 缺少 State Layer（hover、focus、pressed 状态）
   - ❌ 缺少 Elevation 动画

4. **可访问性**
   - ❌ 未系统性地实现 WCAG 2.1 AA 标准
   - ❌ 缺少键盘导航支持
   - ❌ 缺少屏幕阅读器支持

5. **设计协作**
   - ❌ 没有 Figma 设计文件
   - ❌ 没有设计规范文档
   - ❌ 没有组件库 Storybook

---

## Material Design 3 核心理念

### 1. 设计原则

**Material Design 3 的三大支柱：**

1. **个性化 (Personalization)**
   - 动态颜色系统（Dynamic Color）
   - 用户可自定义主题
   - 品牌色与系统色的融合

2. **适应性 (Adaptive)**
   - 响应式布局
   - 跨平台一致性
   - 支持多种设备尺寸

3. **表现力 (Expressive)**
   - 丰富的动效
   - 清晰的视觉层次
   - 情感化设计

### 2. 核心组件

Material Design 3 提供了完整的组件库：

**基础组件 (Foundation)**
- Button (Filled, Outlined, Text, Elevated, Tonal)
- FAB (Floating Action Button)
- Icon Button
- Segmented Button

**输入组件 (Inputs)**
- Text Field (Filled, Outlined)
- Checkbox
- Radio Button
- Switch
- Slider
- Chip (Input, Filter, Suggestion, Assist)

**选择组件 (Selection)**
- Menu
- Dropdown
- Select
- Autocomplete

**导航组件 (Navigation)**
- Navigation Bar
- Navigation Drawer
- Navigation Rail
- Tabs
- Top App Bar
- Bottom App Bar

**容器组件 (Containment)**
- Card
- Dialog
- Divider
- List
- Side Sheet
- Bottom Sheet

**通信组件 (Communication)**
- Badge
- Progress Indicator (Linear, Circular)
- Snackbar
- Tooltip

### 3. 交互模式

**State Layer（状态层）**
- Hover: 8% opacity
- Focus: 12% opacity
- Pressed: 12% opacity
- Dragged: 16% opacity

**Ripple Effect（涟漪效果）**
- 点击时的水波纹动画
- 符合 Material Design 的标志性交互

**Elevation（高度）**
- 0-5 级阴影系统
- 动态高度变化（hover、pressed）

---

## 落地策略

### 阶段划分

我们将 Material Design 3 的落地分为 **4 个阶段**：

```
Phase 1: 基础设施完善 (2 周)
  ↓
Phase 2: 组件库建设 (4 周)
  ↓
Phase 3: 交互优化 (2 周)
  ↓
Phase 4: 设计协作 (持续)
```

### 优先级原则

1. **P0 (必须)**: 影响用户体验的核心功能
2. **P1 (重要)**: 提升产品质量的关键功能
3. **P2 (可选)**: 锦上添花的增强功能

---

## 实施路线图

### Phase 1: 基础设施完善 (2 周)

**目标**: 完善 Design Tokens 系统，建立完整的设计基础

#### 1.1 Typography 系统 (P0)

**任务**:
- [ ] 定义 Material Design 3 Type Scale
  - Display (Large, Medium, Small)
  - Headline (Large, Medium, Small)
  - Title (Large, Medium, Small)
  - Body (Large, Medium, Small)
  - Label (Large, Medium, Small)
- [ ] 选择并集成字体
  - 推荐: Roboto Flex (Material Design 官方字体)
  - 备选: Inter (现代、清晰、支持中文)
- [ ] 定义字体加载策略
  - 使用 `font-display: swap` 避免 FOIT
  - 预加载关键字体
- [ ] 更新 `design-tokens` 包

**产出**:
```css
/* packages/design-tokens/css/typography.css */
:root {
  /* Display */
  --md-sys-typescale-display-large-font: 'Roboto Flex', sans-serif;
  --md-sys-typescale-display-large-size: 57px;
  --md-sys-typescale-display-large-line-height: 64px;
  --md-sys-typescale-display-large-weight: 400;
  --md-sys-typescale-display-large-tracking: -0.25px;

  /* Headline */
  --md-sys-typescale-headline-large-font: 'Roboto Flex', sans-serif;
  --md-sys-typescale-headline-large-size: 32px;
  --md-sys-typescale-headline-large-line-height: 40px;
  --md-sys-typescale-headline-large-weight: 400;
  --md-sys-typescale-headline-large-tracking: 0px;

  /* Body */
  --md-sys-typescale-body-large-font: 'Roboto Flex', sans-serif;
  --md-sys-typescale-body-large-size: 16px;
  --md-sys-typescale-body-large-line-height: 24px;
  --md-sys-typescale-body-large-weight: 400;
  --md-sys-typescale-body-large-tracking: 0.5px;

  /* Label */
  --md-sys-typescale-label-large-font: 'Roboto Flex', sans-serif;
  --md-sys-typescale-label-large-size: 14px;
  --md-sys-typescale-label-large-line-height: 20px;
  --md-sys-typescale-label-large-weight: 500;
  --md-sys-typescale-label-large-tracking: 0.1px;
}
```

#### 1.2 Motion 系统完善 (P1)

**任务**:
- [ ] 定义完整的动画时长
  - Short1-4 (50ms-200ms)
  - Medium1-4 (250ms-400ms)
  - Long1-4 (450ms-600ms)
  - Extra Long1-4 (700ms-1000ms)
- [ ] 定义缓动函数
  - Standard: `cubic-bezier(0.2, 0, 0, 1)`
  - Emphasized: `cubic-bezier(0.2, 0, 0, 1)`
  - Decelerated: `cubic-bezier(0, 0, 0, 1)`
  - Accelerated: `cubic-bezier(0.3, 0, 1, 1)`

#### 1.3 State Layer 系统 (P0)

**任务**:
- [ ] 定义 State Layer 的 opacity 值
- [ ] 创建 State Layer 的 CSS 工具类
- [ ] 文档化使用方法

**产出**:
```css
/* packages/design-tokens/css/state-layer.css */
:root {
  --md-sys-state-hover-opacity: 0.08;
  --md-sys-state-focus-opacity: 0.12;
  --md-sys-state-pressed-opacity: 0.12;
  --md-sys-state-dragged-opacity: 0.16;
}

/* State Layer 工具类 */
.state-layer {
  position: relative;
  overflow: hidden;
}

.state-layer::before {
  content: '';
  position: absolute;
  inset: 0;
  background-color: currentColor;
  opacity: 0;
  transition: opacity var(--md-sys-motion-duration-short2) var(--md-sys-motion-easing-standard);
}

.state-layer:hover::before {
  opacity: var(--md-sys-state-hover-opacity);
}

.state-layer:focus-visible::before {
  opacity: var(--md-sys-state-focus-opacity);
}

.state-layer:active::before {
  opacity: var(--md-sys-state-pressed-opacity);
}
```

---

### Phase 2: 组件迁移和集成 (4-6 周)

**目标**: 将现有组件迁移到 Material Web Components

#### 2.1 安装和配置

**安装 Material Web Components**:
```bash
bun add @material/web
```

**配置 TypeScript**:
```typescript
// frontend/src/types/material-web.d.ts
declare module '@material/web/button/filled-button.js'
declare module '@material/web/button/outlined-button.js'
declare module '@material/web/button/text-button.js'
declare module '@material/web/textfield/filled-text-field.js'
declare module '@material/web/textfield/outlined-text-field.js'
// ... 其他组件
```

**创建统一导入文件**:
```typescript
// frontend/src/components/material/index.ts
// 统一导入 Material Web Components
export * from '@material/web/button/filled-button.js'
export * from '@material/web/button/outlined-button.js'
export * from '@material/web/button/text-button.js'
export * from '@material/web/textfield/filled-text-field.js'
export * from '@material/web/textfield/outlined-text-field.js'
export * from '@material/web/dialog/dialog.js'
export * from '@material/web/checkbox/checkbox.js'
export * from '@material/web/radio/radio.js'
export * from '@material/web/switch/switch.js'
export * from '@material/web/list/list.js'
export * from '@material/web/list/list-item.js'
export * from '@material/web/menu/menu.js'
export * from '@material/web/menu/menu-item.js'
export * from '@material/web/chips/chip-set.js'
export * from '@material/web/chips/filter-chip.js'
export * from '@material/web/chips/input-chip.js'
export * from '@material/web/progress/linear-progress.js'
export * from '@material/web/progress/circular-progress.js'
export * from '@material/web/icon/icon.js'
export * from '@material/web/iconbutton/icon-button.js'
export * from '@material/web/fab/fab.js'
```

#### 2.2 组件迁移优先级

**P0 组件（第 1-2 周）**:
- ✅ Button → `<md-filled-button>`, `<md-outlined-button>`, `<md-text-button>`
- ✅ Input → `<md-filled-text-field>`, `<md-outlined-text-field>`
- ✅ Dialog → `<md-dialog>`
- ✅ Checkbox → `<md-checkbox>`
- ✅ Radio → `<md-radio>`
- ✅ Switch → `<md-switch>`

**P1 组件（第 3-4 周）**:
- ✅ Icon Button → `<md-icon-button>`
- ✅ FAB → `<md-fab>`
- ✅ Chip → `<md-chip-set>`, `<md-filter-chip>`, `<md-input-chip>`
- ✅ Menu → `<md-menu>`, `<md-menu-item>`
- ✅ List → `<md-list>`, `<md-list-item>`
- ✅ Progress → `<md-linear-progress>`, `<md-circular-progress>`

**P2 组件（第 5-6 周）**:
- ✅ Tabs → `<md-tabs>`, `<md-primary-tab>`
- ✅ Slider → `<md-slider>`
- ⚠️ Card → 组装开发（使用 `<md-elevation>` + 自定义布局）
- ⚠️ Badge → 组装开发（使用 CSS + Material Design 3 规范）
- ⚠️ Tooltip → 组装开发（使用 `<md-elevation>` + 定位逻辑）

#### 2.3 使用示例

**基础使用**:
```vue
<script setup lang="ts">
import '@material/web/button/filled-button.js'
import '@material/web/textfield/filled-text-field.js'

const title = ref('')

const handleSubmit = () => {
  console.log('提交:', title.value)
}
</script>

<template>
  <div class="form">
    <md-filled-text-field 
      label="书签标题"
      :value="title"
      @input="title = $event.target.value"
    />
    
    <md-filled-button @click="handleSubmit">
      提交
    </md-filled-button>
  </div>
</template>

<style scoped>
/* Material Web Components 自动使用 Design Tokens */
/* 无需额外配置 */
</style>
```

**组装开发示例（Card）**:
```vue
<script setup lang="ts">
import '@material/web/elevation/elevation.js'

defineProps<{
  title?: string
  subtitle?: string
}>()
</script>

<template>
  <div class="md-card">
    <md-elevation></md-elevation>
    
    <div v-if="title || subtitle" class="md-card__header">
      <h3 v-if="title" class="md-card__title">{{ title }}</h3>
      <p v-if="subtitle" class="md-card__subtitle">{{ subtitle }}</p>
    </div>
    
    <div class="md-card__content">
      <slot />
    </div>
    
    <div v-if="$slots.actions" class="md-card__actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
/* ✅ 严格遵循 Material Design 3 规范 */
.md-card {
  position: relative;
  display: flex;
  flex-direction: column;
  
  /* 使用 Material Design 3 Design Tokens */
  background-color: var(--md-sys-color-surface);
  color: var(--md-sys-color-on-surface);
  border-radius: var(--md-sys-shape-corner-medium);
  padding: var(--md-sys-spacing-md);
  
  /* Material Design 3 动画 */
  transition: all var(--md-sys-motion-duration-short2) var(--md-sys-motion-easing-standard);
}

.md-card__header {
  margin-bottom: var(--md-sys-spacing-md);
}

.md-card__title {
  /* 使用 Material Design 3 Typography */
  font-family: var(--md-sys-typescale-headline-small-font);
  font-size: var(--md-sys-typescale-headline-small-size);
  font-weight: var(--md-sys-typescale-headline-small-weight);
  line-height: var(--md-sys-typescale-headline-small-line-height);
  letter-spacing: var(--md-sys-typescale-headline-small-tracking);
  color: var(--md-sys-color-on-surface);
}

.md-card__subtitle {
  /* 使用 Material Design 3 Typography */
  font-family: var(--md-sys-typescale-body-medium-font);
  font-size: var(--md-sys-typescale-body-medium-size);
  font-weight: var(--md-sys-typescale-body-medium-weight);
  line-height: var(--md-sys-typescale-body-medium-line-height);
  letter-spacing: var(--md-sys-typescale-body-medium-tracking);
  color: var(--md-sys-color-on-surface-variant);
}

.md-card__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--md-sys-spacing-sm);
  margin-top: var(--md-sys-spacing-md);
}
</style>
```

#### 2.4 迁移检查清单

每个组件迁移后必须确认：

- [ ] ✅ 使用 Material Web Components 官方组件（优先）
- [ ] ✅ 或使用官方组件组装（次选）
- [ ] ✅ 或完全符合 Material Design 3 规范（最后手段）
- [ ] ✅ 使用 Design Tokens（颜色、间距、字体、动画）
- [ ] ✅ 支持亮色/暗色主题
- [ ] ✅ 支持键盘导航
- [ ] ✅ 支持屏幕阅读器
- [ ] ✅ 有完整的 TypeScript 类型定义
- [ ] ✅ 有使用文档和示例

---

### Phase 3: 交互优化 (2 周)

**目标**: 实现 Material Design 3 的交互模式

#### 3.1 动效系统 (P0)

**任务**:
- [ ] 实现页面过渡动画
- [ ] 实现组件进入/退出动画
- [ ] 实现 Shared Element Transition（共享元素过渡）
- [ ] 优化动画性能（使用 `transform` 和 `opacity`）

#### 3.2 可访问性 (P0)

**任务**:
- [ ] 键盘导航支持
  - Tab 键导航
  - Enter/Space 键激活
  - Escape 键关闭
- [ ] 屏幕阅读器支持
  - ARIA 标签
  - ARIA 状态
  - ARIA 角色
- [ ] 焦点管理
  - 焦点陷阱（Dialog、Drawer）
  - 焦点恢复
- [ ] 颜色对比度检查
  - 确保符合 WCAG 2.1 AA 标准
  - 使用 Material Design 的对比度工具

#### 3.3 响应式设计 (P1)

**任务**:
- [ ] 定义断点系统
  - Compact: < 600px
  - Medium: 600px - 840px
  - Expanded: > 840px
- [ ] 实现响应式布局
- [ ] 实现响应式组件

---

### Phase 4: 设计协作 (持续)

**目标**: 建立设计与开发的协作流程

#### 4.1 Figma 设计文件 (P1)

**任务**:
- [ ] 创建 Figma 设计文件
- [ ] 使用 Material Design 3 Figma Kit
- [ ] 定义组件库
- [ ] 定义设计规范

#### 4.2 Storybook (P1)

**任务**:
- [ ] 搭建 Storybook
- [ ] 为每个组件编写 Story
- [ ] 添加交互测试
- [ ] 部署 Storybook 到线上

#### 4.3 设计文档 (P2)

**任务**:
- [ ] 编写设计规范文档
- [ ] 编写组件使用指南
- [ ] 编写最佳实践文档

---

## 技术方案

### 1. 组件库选型：Material Web Components（Google 官方）

**核心决策**：
- ✅ **优先使用 Material Web Components**（Google 官方实现）
- ✅ **不重复造轮子**，专注核心业务功能
- ✅ **100% 符合 Material Design 3 规范**

**为什么选择 Material Web Components**：
1. **Google 官方实现**：质量有保证，持续维护
2. **完整的组件库**：包含所有 Material Design 3 标准组件
3. **Web Components 标准**：框架无关，可在 Vue 中直接使用
4. **完善的可访问性**：符合 WCAG 2.1 AA 标准
5. **体积可控**：按需加载，适合 Chrome Extension
6. **持续更新**：跟随 Material Design 3 演进

### 2. 组件开发三级原则（严格遵守）

**原则 1：优先使用 Material Web Components**
```vue
<!-- ✅ 正确：直接使用官方组件 -->
<script setup>
import '@material/web/button/filled-button.js'
</script>

<template>
  <md-filled-button @click="handleClick">
    提交
  </md-filled-button>
</template>
```

**原则 2：组装开发（如果官方组件不满足需求）**
```vue
<!-- ✅ 正确：使用官方组件组装 -->
<script setup>
import '@material/web/button/filled-button.js'
import '@material/web/icon/icon.js'
</script>

<template>
  <div class="custom-action-bar">
    <md-icon>bookmark</md-icon>
    <md-filled-button>保存书签</md-filled-button>
  </div>
</template>
```

**原则 3：自定义实现（最后手段，必须 100% 符合 Material Design 3 规范）**
```vue
<!-- ⚠️ 仅在万不得已时使用 -->
<!-- 必须严格遵循 Material Design 3 规范 -->
<script setup>
// 必须使用 Material Design 3 的：
// - 颜色系统（Design Tokens）
// - 间距系统
// - 字体系统
// - 动画系统（duration、easing）
// - State Layer（hover、focus、pressed）
// - Ripple Effect
// - Elevation
</script>

<template>
  <div class="md-custom-component">
    <!-- 必须符合 Material Design 3 规范 -->
  </div>
</template>

<style scoped>
.md-custom-component {
  /* 使用 Design Tokens */
  background-color: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  padding: var(--md-sys-spacing-md);
  border-radius: var(--md-sys-shape-corner-medium);
  
  /* 使用 Material Design 3 动画 */
  transition: all var(--md-sys-motion-duration-short2) var(--md-sys-motion-easing-standard);
}
</style>
```

**❌ 绝对禁止**：
- ❌ 自定义组件与 Material Design 3 规范不一致
- ❌ 硬编码颜色、间距、字号（必须使用 Design Tokens）
- ❌ 自定义动画时长和缓动函数（必须使用 Material Design 3 标准）
- ❌ 忽略 State Layer、Ripple Effect、Elevation 等 Material Design 3 特性

### 3. 组件库架构

```
frontend/src/components/
├── material/                    # Material Web Components 封装层
│   ├── index.ts                # 统一导入 Material Web Components
│   ├── MdButton.vue            # 可选：Vue Wrapper（如需更好的 TypeScript 支持）
│   ├── MdTextField.vue
│   └── ...
├── composite/                   # 组装组件（使用 Material Web Components 组装）
│   ├── BookmarkActionBar/      # 使用 md-button + md-icon 组装
│   ├── SearchBar/              # 使用 md-text-field + md-icon 组装
│   └── ...
├── business/                    # 业务组件（包含业务逻辑）
│   ├── BookmarkTree/
│   ├── BookmarkSearchInput/
│   └── ...
└── index.ts
```

### 4. 技术栈

**核心技术**:
- **Material Web Components** (Google 官方)
- Vue 3 (Composition API)
- TypeScript
- CSS Variables (Design Tokens)
- Vite

**辅助工具**:
- Storybook (组件展示)
- Vitest (单元测试)
- Playwright (E2E 测试)
- ESLint + Stylelint (代码规范)

### 5. 性能优化

**策略**:
1. **Tree Shaking**: 按需导入 Material Web Components
2. **Code Splitting**: 路由级别的代码分割
3. **Lazy Loading**: 懒加载非关键组件
4. **CSS Optimization**: 使用 CSS Variables 减少重复代码
5. **Animation Performance**: Material Web Components 已优化

---

## 组件库建设

### 组件开发三级原则（严格遵守）

```
优先级 1: 使用 Material Web Components 官方组件
         ↓ (如果官方组件不满足需求)
优先级 2: 使用官方组件组装开发
         ↓ (如果组装也无法满足)
优先级 3: 自定义实现（必须 100% 符合 Material Design 3 规范）
```

### 组件分类和实现策略

#### 类别 A：直接使用官方组件

这些组件直接使用 Material Web Components，无需任何封装：

| 组件 | Material Web Component | 说明 |
|------|----------------------|------|
| Button | `<md-filled-button>`, `<md-outlined-button>`, `<md-text-button>` | 直接使用 |
| Icon Button | `<md-icon-button>` | 直接使用 |
| FAB | `<md-fab>` | 直接使用 |
| Text Field | `<md-filled-text-field>`, `<md-outlined-text-field>` | 直接使用 |
| Checkbox | `<md-checkbox>` | 直接使用 |
| Radio | `<md-radio>` | 直接使用 |
| Switch | `<md-switch>` | 直接使用 |
| Slider | `<md-slider>` | 直接使用 |
| Dialog | `<md-dialog>` | 直接使用 |
| Menu | `<md-menu>`, `<md-menu-item>` | 直接使用 |
| List | `<md-list>`, `<md-list-item>` | 直接使用 |
| Chip | `<md-chip-set>`, `<md-filter-chip>`, `<md-input-chip>` | 直接使用 |
| Progress | `<md-linear-progress>`, `<md-circular-progress>` | 直接使用 |
| Tabs | `<md-tabs>`, `<md-primary-tab>` | 直接使用 |
| Icon | `<md-icon>` | 直接使用 |

#### 类别 B：组装开发

这些组件使用 Material Web Components 组装：

| 组件 | 组装方式 | 说明 |
|------|---------|------|
| Card | `<md-elevation>` + 自定义布局 | 使用 Elevation + Material Design 3 规范 |
| Badge | CSS + Material Design 3 规范 | 使用 Design Tokens |
| Tooltip | `<md-elevation>` + 定位逻辑 | 使用 Elevation + Material Design 3 规范 |
| Snackbar | `<md-elevation>` + 自定义布局 | 使用 Elevation + Material Design 3 规范 |
| Empty State | `<md-icon>` + Typography | 使用 Icon + Material Design 3 Typography |
| Search Bar | `<md-filled-text-field>` + `<md-icon-button>` | 组装官方组件 |

#### 类别 C：业务组件（包含业务逻辑）

这些组件包含业务逻辑，但必须使用 Material Web Components 或符合 Material Design 3 规范：

| 组件 | 实现方式 | 说明 |
|------|---------|------|
| BookmarkTree | 使用 `<md-list>` + 业务逻辑 | 树形结构 + 拖拽 |
| BookmarkSearchInput | 使用 `<md-filled-text-field>` + 搜索逻辑 | 搜索算法 |
| BookmarkRecommendations | 使用 `<md-list>` + 推荐算法 | AI 推荐 |

### 组件质量标准

**必须满足**:
- [ ] ✅ 优先使用 Material Web Components 官方组件
- [ ] ✅ 或使用官方组件组装（如果官方组件不满足需求）
- [ ] ✅ 或 100% 符合 Material Design 3 规范（最后手段）
- [ ] ✅ 使用 Design Tokens（颜色、间距、字体、动画）
- [ ] ✅ 支持亮色/暗色主题
- [ ] ✅ 支持键盘导航
- [ ] ✅ 支持屏幕阅读器
- [ ] ✅ 有完整的 TypeScript 类型定义
- [ ] ✅ 有使用文档

**绝对禁止**:
- [ ] ❌ 自定义组件与 Material Design 3 规范不一致
- [ ] ❌ 硬编码颜色、间距、字号
- [ ] ❌ 自定义动画时长和缓动函数
- [ ] ❌ 忽略 State Layer、Ripple Effect、Elevation

---

## 设计协作流程

### Figma to Code 工作流

```
1. 设计师在 Figma 中设计
   ↓
2. 使用 Material Design 3 Figma Kit
   ↓
3. 导出设计规范（颜色、间距、字体等）
   ↓
4. 开发者使用 Figma MCP 工具获取设计
   ↓
5. 转换为 Vue 组件
   ↓
6. 使用 design-tokens 包的变量
   ↓
7. 代码审查
   ↓
8. 合并到主分支
```

### 设计规范同步

**自动化工具**:
- Figma Tokens Plugin: 导出 Design Tokens
- Style Dictionary: 转换 Tokens 为多平台格式
- GitHub Actions: 自动同步 Tokens

---

## 质量保证

### 1. 代码质量

**工具**:
- ESLint: JavaScript/TypeScript 代码规范
- Stylelint: CSS 代码规范
- Prettier: 代码格式化
- TypeScript: 类型检查

**规则**:
- 禁止使用 `any`
- 禁止硬编码颜色、间距、字号
- 必须使用 design-tokens 的变量
- 必须添加 JSDoc 注释

### 2. 测试覆盖

**测试类型**:
- 单元测试 (Vitest)
- 组件测试 (Vitest + @vue/test-utils)
- E2E 测试 (Playwright)
- 视觉回归测试 (Playwright)

**覆盖率要求**:
- 单元测试: > 80%
- 组件测试: > 70%
- E2E 测试: 覆盖核心流程

### 3. 可访问性测试

**工具**:
- axe-core: 自动化可访问性测试
- WAVE: 浏览器扩展
- 屏幕阅读器: NVDA (Windows), VoiceOver (macOS)

**检查项**:
- [ ] 颜色对比度 (WCAG 2.1 AA)
- [ ] 键盘导航
- [ ] 屏幕阅读器支持
- [ ] 焦点管理
- [ ] ARIA 标签

### 4. 性能测试

**工具**:
- Lighthouse: 性能评分
- Chrome DevTools: 性能分析
- Bundle Analyzer: 包大小分析

**指标**:
- First Contentful Paint (FCP): < 1.8s
- Largest Contentful Paint (LCP): < 2.5s
- Time to Interactive (TTI): < 3.8s
- Cumulative Layout Shift (CLS): < 0.1

---

## 总结

### 核心价值

通过全面采用 Material Web Components 和 Material Design 3，我们将获得：

1. **专注核心功能**: 不需要维护组件库，专注书签管理核心功能
2. **专业可靠**: Google 官方实现，质量有保证
3. **持续更新**: 跟随 Material Design 3 演进，自动获得新特性
4. **完善的可访问性**: 符合 WCAG 2.1 AA 标准
5. **体积可控**: 按需加载，适合 Chrome Extension

### 组件开发三级原则（核心）

```
优先级 1: 使用 Material Web Components 官方组件
         ↓ (如果官方组件不满足需求)
优先级 2: 使用官方组件组装开发
         ↓ (如果组装也无法满足)
优先级 3: 自定义实现（必须 100% 符合 Material Design 3 规范）
```

**绝对禁止**：
- ❌ 自定义组件与 Material Design 3 规范不一致
- ❌ 硬编码颜色、间距、字号（必须使用 Design Tokens）
- ❌ 自定义动画时长和缓动函数（必须使用 Material Design 3 标准）
- ❌ 忽略 State Layer、Ripple Effect、Elevation 等 Material Design 3 特性

### 关键里程碑

- **Week 2**: 完成 Typography 和 State Layer 系统，安装 Material Web Components
- **Week 4**: 完成 P0 组件迁移（Button、Input、Dialog、Checkbox、Radio、Switch）
- **Week 6**: 完成 P1 组件迁移（Icon Button、FAB、Chip、Menu、List、Progress）
- **Week 8**: 完成 P2 组件迁移（Tabs、Slider、Card、Badge、Tooltip）
- **Week 10**: 完成交互优化和可访问性测试
- **Week 12**: 清理旧组件，完成文档

### 下一步行动

1. **立即开始**: 安装 Material Web Components
2. **创建示例**: 创建示例页面，测试集成
3. **制定清单**: 制定详细的组件迁移清单
4. **逐步迁移**: 按优先级逐步迁移组件

---

**文档维护**: 本文档将持续更新，记录实施进度和遇到的问题。

**反馈渠道**: 如有任何问题或建议，请在 GitHub Issues 中提出。
