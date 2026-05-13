# Material Web Tabs 迁移完成

## ✅ 迁移概览

已成功将自定义 Tabs 组件替换为 Material Web Tabs 组件，完全符合 Material Design 3 规范。

---

## 📋 完成的工作

### 1. **Management 页面 - 水平 Tabs**

**位置**: `frontend/src/pages/management/Management.vue`

**迁移内容**:
- ✅ 替换自定义 `<Tabs>` 为 `<md-tabs>` + `<md-primary-tab>`
- ✅ 添加 `handleAddDialogTabChange` 函数处理 tab 切换
- ✅ 配置 Material Web Tabs 样式（颜色、字体、间距）
- ✅ 保持原有功能：书签/文件夹切换

**代码示例**:
```vue
<md-tabs
  :active-tab-index="dialogStore.addItemDialog.type === 'bookmark' ? 0 : 1"
  @change="handleAddDialogTabChange"
>
  <md-primary-tab>{{ t('management_bookmark') }}</md-primary-tab>
  <md-primary-tab>{{ t('management_folder') }}</md-primary-tab>
</md-tabs>
```

### 2. **Settings 页面 - 水平 Tabs（改版）**

**位置**: `frontend/src/pages/settings/Settings.vue`

**迁移内容**:
- ✅ 从垂直布局改为水平布局（Material Web Tabs 不支持垂直布局）
- ✅ 替换自定义 `<Tabs>` 为 `<md-tabs>` + `<md-primary-tab>`
- ✅ 添加图标支持（使用 `<md-icon>` slot）
- ✅ 添加 `getActiveTabIndex`、`handleTabChange`、`getIconName` 函数
- ✅ 更新布局样式：从左右分栏改为上下布局

**布局变化**:
```
旧布局（垂直 Tabs）:          新布局（水平 Tabs）:
┌─────────┬──────────┐        ┌──────────────────┐
│ Tabs    │          │        │ Tabs (横向)      │
│ (竖向)  │ Content  │   →    ├──────────────────┤
│         │          │        │                  │
└─────────┴──────────┘        │ Content          │
                              │                  │
                              └──────────────────┘
```

**图标映射**:
```typescript
const iconMap: Record<string, string> = {
  'settings': 'settings',        // Lucide → Material Icons
  'sparkles': 'auto_awesome',
  'bell': 'notifications',
  'keyboard': 'keyboard'
}
```

### 3. **删除自定义 Tabs 组件**

- ✅ 删除 `frontend/src/components/composite/Tabs/` 目录
- ✅ 从 `frontend/src/components/index.ts` 移除 Tabs 导出
- ✅ 从 `frontend/src/components/index.ts` 移除 Tabs 类型导出

---

## 🎨 Material Web Tabs 样式配置

### Management 页面样式

```css
md-tabs {
  --md-primary-tab-container-color: transparent;
  --md-primary-tab-label-text-color: var(--color-text-secondary);
  --md-primary-tab-active-label-text-color: var(--color-primary);
  --md-primary-tab-active-indicator-color: var(--color-primary);
  --md-primary-tab-active-indicator-height: 2px;
  --md-primary-tab-container-height: 48px;
  
  /* 字体 */
  --md-primary-tab-label-text-font: var(--font-family-base);
  --md-primary-tab-label-text-size: var(--text-sm);
  --md-primary-tab-label-text-weight: var(--font-medium);
  
  /* 悬停状态 */
  --md-primary-tab-hover-label-text-color: var(--color-text-primary);
  --md-primary-tab-hover-state-layer-color: var(--color-surface-hover);
  --md-primary-tab-hover-state-layer-opacity: 1;
  
  /* 焦点状态 */
  --md-primary-tab-focus-label-text-color: var(--color-primary);
  
  margin-bottom: var(--spacing-4);
  width: 100%;
}
```

### Settings 页面样式

```css
md-tabs {
  --md-primary-tab-container-color: transparent;
  --md-primary-tab-label-text-color: var(--color-text-secondary);
  --md-primary-tab-active-label-text-color: var(--color-primary);
  --md-primary-tab-active-indicator-color: var(--color-primary);
  --md-primary-tab-active-indicator-height: 3px;
  --md-primary-tab-container-height: 56px;
  
  /* 字体 */
  --md-primary-tab-label-text-font: var(--font-family-base);
  --md-primary-tab-label-text-size: var(--text-base);
  --md-primary-tab-label-text-weight: var(--font-medium);
  
  /* 图标 */
  --md-icon-size: 20px;
  
  width: 100%;
}
```

---

## 📊 功能对比

| 功能 | 自定义 Tabs | Material Web Tabs | 状态 |
|------|------------|-------------------|------|
| 水平布局 | ✅ | ✅ | ✅ 已迁移 |
| 垂直布局 | ✅ | ❌ | ⚠️ 改为水平布局 |
| Underline 样式 | ✅ | ✅ | ✅ 已迁移 |
| Pills 样式 | ✅ | ❌ | ❌ 不支持 |
| 图标支持 | ✅ | ✅ | ✅ 已迁移 |
| 键盘导航 | ✅ | ✅ | ✅ 内置支持 |
| 滑动指示器 | ✅ | ✅ | ✅ 内置支持 |
| ARIA 支持 | ✅ | ✅ | ✅ 内置支持 |

---

## 🎯 Material Design 一致性提升

### 迁移前
- ❌ 自定义样式，不完全符合 Material Design 规范
- ❌ Pills 样式不是 Material Design 标准
- ❌ 需要手动维护代码

### 迁移后
- ✅ 完全符合 Material Design 3 规范
- ✅ 使用官方 Material Web Components
- ✅ 由 Google 维护，无需自己维护
- ✅ 性能优化（Web Components）
- ✅ 完整的可访问性支持

---

## 📝 使用示例

### 基础用法

```vue
<template>
  <md-tabs
    :active-tab-index="activeIndex"
    @change="handleChange"
  >
    <md-primary-tab>标签1</md-primary-tab>
    <md-primary-tab>标签2</md-primary-tab>
    <md-primary-tab>标签3</md-primary-tab>
  </md-tabs>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import '@material/web/tabs/tabs.js'
import '@material/web/tabs/primary-tab.js'

const activeIndex = ref(0)

function handleChange(event: Event) {
  const target = event.target as any
  activeIndex.value = target.activeTabIndex
}
</script>
```

### 带图标的 Tabs

```vue
<template>
  <md-tabs
    :active-tab-index="activeIndex"
    @change="handleChange"
  >
    <md-primary-tab>
      <md-icon slot="icon">home</md-icon>
      首页
    </md-primary-tab>
    <md-primary-tab>
      <md-icon slot="icon">settings</md-icon>
      设置
    </md-primary-tab>
  </md-tabs>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import '@material/web/tabs/tabs.js'
import '@material/web/tabs/primary-tab.js'
import '@material/web/icon/icon.js'

const activeIndex = ref(0)

function handleChange(event: Event) {
  const target = event.target as any
  activeIndex.value = target.activeTabIndex
}
</script>
```

### Secondary Tabs

```vue
<template>
  <md-tabs
    :active-tab-index="activeIndex"
    @change="handleChange"
  >
    <md-secondary-tab>标签1</md-secondary-tab>
    <md-secondary-tab>标签2</md-secondary-tab>
  </md-tabs>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import '@material/web/tabs/tabs.js'
import '@material/web/tabs/secondary-tab.js'

const activeIndex = ref(0)

function handleChange(event: Event) {
  const target = event.target as any
  activeIndex.value = target.activeTabIndex
}
</script>
```

---

## ⚠️ 注意事项

### 1. **事件处理**

Material Web Tabs 的 `change` 事件返回的是 `CustomEvent`，需要通过 `event.target.activeTabIndex` 获取当前激活的 tab 索引。

```typescript
function handleChange(event: Event) {
  const target = event.target as any
  const index = target.activeTabIndex
  // 处理 tab 切换
}
```

### 2. **图标使用**

Material Web Tabs 使用 `<md-icon>` 组件，需要：
- 导入 `@material/web/icon/icon.js`
- 使用 Material Icons 字体
- 通过 `slot="icon"` 指定图标位置

```vue
<md-primary-tab>
  <md-icon slot="icon">settings</md-icon>
  设置
</md-primary-tab>
```

### 3. **样式定制**

通过 CSS 变量定制样式，常用变量：
- `--md-primary-tab-container-color`: 容器背景色
- `--md-primary-tab-label-text-color`: 文本颜色
- `--md-primary-tab-active-label-text-color`: 激活状态文本颜色
- `--md-primary-tab-active-indicator-color`: 指示器颜色
- `--md-primary-tab-active-indicator-height`: 指示器高度
- `--md-primary-tab-container-height`: 容器高度

### 4. **垂直布局**

Material Web Tabs 不支持垂直布局。如果需要垂直布局，有两个选择：
1. 改为水平布局（推荐，本次迁移采用）
2. 保留自定义 Tabs 组件

---

## 🚀 后续优化建议

### 1. **添加内容切换动画**

Material Web Tabs 不提供内容切换动画，可以使用 Vue 的 `<Transition>` 组件：

```vue
<template>
  <md-tabs :active-tab-index="activeIndex" @change="handleChange">
    <md-primary-tab>标签1</md-primary-tab>
    <md-primary-tab>标签2</md-primary-tab>
  </md-tabs>
  
  <Transition name="fade" mode="out-in">
    <div v-if="activeIndex === 0" key="tab1">内容1</div>
    <div v-else key="tab2">内容2</div>
  </Transition>
</template>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
```

### 2. **创建包装组件**（可选）

如果需要简化 API，可以创建一个包装组件：

```vue
<!-- MaterialTabs.vue -->
<template>
  <md-tabs
    :active-tab-index="activeIndex"
    @change="handleChange"
  >
    <md-primary-tab
      v-for="(tab, index) in tabs"
      :key="index"
    >
      <md-icon v-if="tab.icon" slot="icon">{{ tab.icon }}</md-icon>
      {{ tab.text }}
    </md-primary-tab>
  </md-tabs>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import '@material/web/tabs/tabs.js'
import '@material/web/tabs/primary-tab.js'
import '@material/web/icon/icon.js'

interface Tab {
  text: string
  icon?: string
  value?: string | number
}

interface Props {
  modelValue?: string | number
  tabs: Tab[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: string | number]
  'change': [value: string | number]
}>()

const activeIndex = computed(() => {
  if (props.modelValue === undefined) return 0
  return props.tabs.findIndex(t => t.value === props.modelValue)
})

function handleChange(event: Event) {
  const target = event.target as any
  const index = target.activeTabIndex
  const tab = props.tabs[index]
  const value = tab.value ?? index
  emit('update:modelValue', value)
  emit('change', value)
}
</script>
```

使用包装组件：

```vue
<MaterialTabs
  v-model="activeTab"
  :tabs="[
    { text: '标签1', icon: 'home', value: 'tab1' },
    { text: '标签2', icon: 'settings', value: 'tab2' }
  ]"
  @change="handleTabChange"
/>
```

---

## 📚 相关资源

- [Material Web Tabs 文档](https://github.com/material-components/material-web/blob/main/docs/components/tabs.md)
- [Material Design 3 Tabs 规范](https://m3.material.io/components/tabs/overview)
- [Material Web Components](https://material-web.dev/)

---

**最后更新**: 2026-05-13  
**版本**: 1.0.0  
**状态**: ✅ 迁移完成
