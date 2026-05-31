# Material Web Components 使用指南

本指南说明如何在 otterSage 项目中使用 Material Web Components。

---

## 📋 目录

1. [安装](#安装)
2. [基础使用](#基础使用)
3. [组件开发三级原则](#组件开发三级原则)
4. [常用组件示例](#常用组件示例)
5. [主题定制](#主题定制)
6. [TypeScript 支持](#typescript-支持)
7. [最佳实践](#最佳实践)

---

## 安装

```bash
bun add @material/web
```

---

## 基础使用

### 1. 导入组件

```typescript
// 在需要使用的 Vue 组件中导入
import '@material/web/button/filled-button.js'
import '@material/web/textfield/filled-text-field.js'
```

### 2. 在模板中使用

```vue
<template>
  <md-filled-button @click="handleClick"> 点击我 </md-filled-button>

  <md-filled-text-field label="输入框" :value="value" @input="value = $event.target.value" />
</template>
```

---

## 组件开发三级原则

### 原则 1：优先使用 Material Web Components 官方组件

```vue
<script setup>
import '@material/web/button/filled-button.js'
</script>

<template>
  <!-- ✅ 正确：直接使用官方组件 -->
  <md-filled-button @click="handleClick"> 提交 </md-filled-button>
</template>
```

### 原则 2：组装开发（如果官方组件不满足需求）

```vue
<script setup>
import '@material/web/button/filled-button.js'
import '@material/web/icon/icon.js'
</script>

<template>
  <!-- ✅ 正确：使用官方组件组装 -->
  <div class="custom-action-bar">
    <md-icon>bookmark</md-icon>
    <md-filled-button>保存书签</md-filled-button>
  </div>
</template>

<style scoped>
.custom-action-bar {
  display: flex;
  align-items: center;
  gap: var(--md-sys-spacing-md);
  padding: var(--md-sys-spacing-md);
  background-color: var(--md-sys-color-surface);
  border-radius: var(--md-sys-shape-corner-medium);
}
</style>
```

### 原则 3：自定义实现（最后手段，必须 100% 符合 Material Design 3 规范）

```vue
<script setup>
// 必须使用 Material Design 3 的所有规范
</script>

<template>
  <div class="md-custom-component">
    <!-- 必须符合 Material Design 3 规范 -->
  </div>
</template>

<style scoped>
.md-custom-component {
  /* ✅ 使用 Design Tokens */
  background-color: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  padding: var(--md-sys-spacing-md);
  border-radius: var(--md-sys-shape-corner-medium);

  /* ✅ 使用 Material Design 3 动画 */
  transition: all var(--md-sys-motion-duration-short2) var(--md-sys-motion-easing-standard);
}

/* ✅ 必须实现 State Layer */
.md-custom-component::before {
  content: '';
  position: absolute;
  inset: 0;
  background-color: currentColor;
  opacity: 0;
  transition: opacity var(--md-sys-motion-duration-short2) var(--md-sys-motion-easing-standard);
}

.md-custom-component:hover::before {
  opacity: var(--md-sys-state-hover-opacity);
}
</style>
```

---

## 常用组件示例

### Button

```vue
<script setup>
import '@material/web/button/filled-button.js'
import '@material/web/button/outlined-button.js'
import '@material/web/button/text-button.js'
</script>

<template>
  <md-filled-button @click="handleClick">Filled Button</md-filled-button>
  <md-outlined-button @click="handleClick">Outlined Button</md-outlined-button>
  <md-text-button @click="handleClick">Text Button</md-text-button>
</template>
```

### Text Field

```vue
<script setup>
import '@material/web/textfield/filled-text-field.js'
import '@material/web/textfield/outlined-text-field.js'

const value = ref('')
</script>

<template>
  <md-filled-text-field label="标题" :value="value" @input="value = $event.target.value" />

  <md-outlined-text-field label="描述" :value="value" @input="value = $event.target.value" />
</template>
```

### Dialog

```vue
<script setup>
import '@material/web/dialog/dialog.js'
import '@material/web/button/filled-button.js'
import '@material/web/button/text-button.js'

const showDialog = ref(false)
</script>

<template>
  <md-filled-button @click="showDialog = true"> 打开 Dialog </md-filled-button>

  <md-dialog :open="showDialog" @closed="showDialog = false">
    <div slot="headline">Dialog 标题</div>
    <div slot="content">这是 Dialog 内容</div>
    <div slot="actions">
      <md-text-button @click="showDialog = false">取消</md-text-button>
      <md-filled-button @click="handleConfirm">确认</md-filled-button>
    </div>
  </md-dialog>
</template>
```

### Checkbox & Radio

```vue
<script setup>
import '@material/web/checkbox/checkbox.js'
import '@material/web/radio/radio.js'

const checked = ref(false)
const radioValue = ref('1')
</script>

<template>
  <label>
    <md-checkbox :checked="checked" @change="checked = $event.target.checked" />
    Checkbox
  </label>

  <label>
    <md-radio
      name="group"
      value="1"
      :checked="radioValue === '1'"
      @change="radioValue = $event.target.value"
    />
    Radio 1
  </label>

  <label>
    <md-radio
      name="group"
      value="2"
      :checked="radioValue === '2'"
      @change="radioValue = $event.target.value"
    />
    Radio 2
  </label>
</template>
```

### List

```vue
<script setup>
import '@material/web/list/list.js'
import '@material/web/list/list-item.js'
</script>

<template>
  <md-list>
    <md-list-item>
      <div slot="headline">列表项 1</div>
      <div slot="supporting-text">支持文本</div>
    </md-list-item>
    <md-list-item>
      <div slot="headline">列表项 2</div>
      <div slot="supporting-text">支持文本</div>
    </md-list-item>
  </md-list>
</template>
```

### Progress

```vue
<script setup>
import '@material/web/progress/linear-progress.js'
import '@material/web/progress/circular-progress.js'

const progress = ref(0.5) // 0-1
</script>

<template>
  <md-linear-progress :value="progress" />
  <md-circular-progress :value="progress" />
</template>
```

---

## 主题定制

Material Web Components 自动使用 Design Tokens 中的 CSS Variables：

```css
/* 已在 @ottersage/design-tokens 中定义 */
:root {
  --md-sys-color-primary: #83d5c5;
  --md-sys-color-on-primary: #003731;
  --md-sys-color-secondary: #b1ccc5;
  --md-sys-spacing-md: 16px;
  --md-sys-shape-corner-medium: 12px;
  /* ... 更多 tokens */
}
```

无需额外配置，Material Web Components 会自动读取这些变量。

---

## TypeScript 支持

### 添加类型定义

```typescript
// frontend/src/types/material-web.d.ts
declare module '@material/web/button/filled-button.js'
declare module '@material/web/button/outlined-button.js'
declare module '@material/web/button/text-button.js'
declare module '@material/web/textfield/filled-text-field.js'
declare module '@material/web/textfield/outlined-text-field.js'
declare module '@material/web/dialog/dialog.js'
declare module '@material/web/checkbox/checkbox.js'
declare module '@material/web/radio/radio.js'
declare module '@material/web/switch/switch.js'
declare module '@material/web/list/list.js'
declare module '@material/web/list/list-item.js'
declare module '@material/web/menu/menu.js'
declare module '@material/web/menu/menu-item.js'
declare module '@material/web/chips/chip-set.js'
declare module '@material/web/chips/filter-chip.js'
declare module '@material/web/chips/input-chip.js'
declare module '@material/web/progress/linear-progress.js'
declare module '@material/web/progress/circular-progress.js'
declare module '@material/web/icon/icon.js'
declare module '@material/web/iconbutton/icon-button.js'
declare module '@material/web/fab/fab.js'
```

---

## 最佳实践

### 1. 按需导入

```typescript
// ✅ 正确：只导入需要的组件
import '@material/web/button/filled-button.js'
import '@material/web/textfield/filled-text-field.js'

// ❌ 错误：导入所有组件
import '@material/web/all.js'
```

### 2. 使用 Design Tokens

```css
/* ✅ 正确：使用 Design Tokens */
.custom-component {
  background-color: var(--md-sys-color-primary);
  padding: var(--md-sys-spacing-md);
}

/* ❌ 错误：硬编码值 */
.custom-component {
  background-color: #83d5c5;
  padding: 16px;
}
```

### 3. 事件处理

```vue
<script setup>
// ✅ 正确：使用 $event.target 获取值
const handleInput = (event: Event) => {
  const value = (event.target as HTMLInputElement).value
  console.log(value)
}
</script>

<template>
  <md-filled-text-field @input="handleInput" />
</template>
```

### 4. 响应式状态

```vue
<script setup>
import { ref } from 'vue'

const checked = ref(false)

// ✅ 正确：使用 ref 管理状态
const handleChange = (event: Event) => {
  checked.value = (event.target as HTMLInputElement).checked
}
</script>

<template>
  <md-checkbox :checked="checked" @change="handleChange" />
</template>
```

---

## 完整示例

完整用例以现有页面实现为准，例如 `frontend/src/pages/settings/Settings.vue` 与 `frontend/src/pages/popup/Popup.vue`。

---

## 参考资源

- [Material Web Components 官方文档](https://github.com/material-components/material-web)
- [Material Design 3 规范](https://m3.material.io/)
- [Design Tokens 文档](../../packages/design-tokens/README.md)
- [完整产品文档 v3.0](../../docs/product/otterSage-产品文档-v3.0.md)（仓库唯一规格正文）

---

**最后更新**: 2026-05-31  
**维护者**: otterSage Team
