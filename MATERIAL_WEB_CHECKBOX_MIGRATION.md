# Material Web Checkbox 迁移完成

## ✅ 迁移概览

已成功将自定义 Checkbox 组件替换为 Material Web Checkbox 组件，完全符合 Material Design 3 规范，确保项目设计风格一致。

---

## 📋 完成的工作

### 1. **Management 页面 - 全选 Checkbox**

**位置**: `frontend/src/pages/management/Management.vue`

**迁移内容**:
- ✅ 替换自定义 `<Checkbox>` 为 `<md-checkbox>`
- ✅ 更新事件处理：`@update:model-value` → `@change`
- ✅ 更新属性：`:model-value` → `:checked`
- ✅ 移除自定义属性：`size="md"`, `variant="icon"`
- ✅ 配置 Material Web Checkbox 样式（颜色、尺寸）

**代码示例**:
```vue
<!-- 迁移前 -->
<Checkbox
  :model-value="rightSelectAllState.checked"
  :indeterminate="rightSelectAllState.indeterminate"
  size="md"
  class="select-all-checkbox"
  @update:model-value="toggleRightSelectAll"
/>

<!-- 迁移后 -->
<md-checkbox
  :checked="rightSelectAllState.checked"
  :indeterminate="rightSelectAllState.indeterminate"
  class="select-all-checkbox"
  @change="toggleRightSelectAll"
></md-checkbox>
```

### 2. **TreeNode 组件 - 节点选择 Checkbox**

**位置**: `frontend/src/components/business/BookmarkTree/TreeNode.vue`

**迁移内容**:
- ✅ 替换文件夹节点的 `<Checkbox>` 为 `<md-checkbox>`
- ✅ 替换书签节点的 `<Checkbox>` 为 `<md-checkbox>`
- ✅ 更新事件处理和属性绑定
- ✅ 移除自定义 `variant="icon"` 属性
- ✅ 配置 Material Web Checkbox 样式（与文件夹/书签 hover 颜色协调）

**代码示例**:
```vue
<!-- 文件夹节点 - 迁移前 -->
<Checkbox
  v-if="config.showSelectionCheckbox && config.selectable === 'multiple' && !isRootFolder"
  variant="icon"
  :model-value="isSelected"
  :indeterminate="isIndeterminate"
  size="md"
  class="select-checkbox"
  @update:model-value="toggleSelection"
/>

<!-- 文件夹节点 - 迁移后 -->
<md-checkbox
  v-if="config.showSelectionCheckbox && config.selectable === 'multiple' && !isRootFolder"
  :checked="isSelected"
  :indeterminate="isIndeterminate"
  class="select-checkbox"
  @change="toggleSelection"
></md-checkbox>

<!-- 书签节点 - 迁移后 -->
<md-checkbox
  v-if="config.showSelectionCheckbox && config.selectable === 'multiple'"
  :checked="isSelected"
  :indeterminate="false"
  class="select-checkbox"
  @change="toggleSelection"
></md-checkbox>
```

### 3. **删除自定义 Checkbox 组件**

- ✅ 删除 `frontend/src/components/composite/Checkbox/` 目录
- ✅ 从 `frontend/src/components/index.ts` 移除 Checkbox 导出
- ✅ 从 `frontend/src/components/index.ts` 移除 Checkbox 类型导出

### 4. **更新导入语句**

**Management.vue**:
```typescript
// 移除自定义 Checkbox 导入
import {
  App,
  AppHeader,
  BookmarkSearchInput,
  Card,
  Dialog,
  LucideIcon,
  Input,
  Main,
  UrlInput,
  AnimatedNumber
} from '@/components'

// 添加 Material Web Checkbox 导入
import '@material/web/checkbox/checkbox.js'
```

**TreeNode.vue**:
```typescript
// 移除自定义 Checkbox 导入
import { LucideIcon } from '@/components/base/LucideIcon'

// 添加 Material Web Checkbox 导入
import '@material/web/checkbox/checkbox.js'
```

---

## 🎨 Material Web Checkbox 样式配置

### Management 页面样式

```css
.select-all-checkbox {
  /* Material Web Checkbox 样式配置 */
  --md-checkbox-container-size: 20px;
  --md-checkbox-icon-size: 16px;
  --md-checkbox-selected-container-color: var(--md-sys-color-primary);
  --md-checkbox-selected-icon-color: var(--md-sys-color-on-primary);
  --md-checkbox-unselected-outline-color: var(--md-sys-color-outline);
  --md-checkbox-unselected-hover-outline-color: var(--md-sys-color-on-surface);
}
```

### TreeNode 组件样式

```css
/* 基础样式 */
.select-checkbox {
  margin-right: var(--spacing-0-5);
  
  /* Material Web Checkbox 样式配置 */
  --md-checkbox-container-size: 20px;
  --md-checkbox-icon-size: 16px;
  --md-checkbox-selected-container-color: var(--md-sys-color-primary);
  --md-checkbox-selected-icon-color: var(--md-sys-color-on-primary);
  --md-checkbox-unselected-outline-color: var(--md-sys-color-outline);
  --md-checkbox-unselected-hover-outline-color: var(--md-sys-color-on-surface);
}

/* 文件夹行内的 Checkbox hover 使用黄色系 */
.folder-content:hover .select-checkbox {
  --md-checkbox-unselected-hover-state-layer-color: var(--color-folder-hover);
  --md-checkbox-unselected-hover-state-layer-opacity: 0.08;
}

/* 书签行内的 Checkbox hover 使用蓝色系 */
.bookmark-content:hover .select-checkbox {
  --md-checkbox-unselected-hover-state-layer-color: var(--color-bookmark-hover);
  --md-checkbox-unselected-hover-state-layer-opacity: 0.08;
}
```

---

## 📊 功能对比

| 功能 | 自定义 Checkbox | Material Web Checkbox | 状态 |
|------|----------------|----------------------|------|
| 基础选中/未选中 | ✅ | ✅ | ✅ 已迁移 |
| 半选中状态 (indeterminate) | ✅ | ✅ | ✅ 已迁移 |
| 圆形图标变体 | ✅ | ❌ | ⚠️ 改为方形（Material Design 标准） |
| 自定义尺寸 (sm/md/lg) | ✅ | ✅ | ✅ 通过 CSS 变量配置 |
| Ripple 效果 | ❌ | ✅ | ✅ 内置支持 |
| 键盘导航 | ✅ | ✅ | ✅ 内置支持 |
| ARIA 支持 | ✅ | ✅ | ✅ 内置支持 |

---

## 🎯 Material Design 一致性提升

### 迁移前
- ❌ 自定义圆形图标 Checkbox（不符合 Material Design 规范）
- ❌ 需要手动维护代码
- ❌ 缺少 Ripple 效果

### 迁移后
- ✅ 完全符合 Material Design 3 规范
- ✅ 使用官方 Material Web Components
- ✅ 由 Google 维护，无需自己维护
- ✅ 内置 Ripple 效果
- ✅ 完整的可访问性支持
- ✅ 与项目其他 Material Web 组件风格一致

---

## 📝 使用示例

### 基础用法

```vue
<template>
  <md-checkbox
    :checked="isChecked"
    @change="handleChange"
  ></md-checkbox>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import '@material/web/checkbox/checkbox.js'

const isChecked = ref(false)

function handleChange(event: Event) {
  const target = event.target as HTMLInputElement
  isChecked.value = target.checked
}
</script>
```

### 半选中状态

```vue
<template>
  <md-checkbox
    :checked="allSelected"
    :indeterminate="someSelected"
    @change="handleSelectAll"
  ></md-checkbox>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import '@material/web/checkbox/checkbox.js'

const selectedItems = ref<string[]>([])
const allItems = ['item1', 'item2', 'item3']

const allSelected = computed(() => selectedItems.value.length === allItems.length)
const someSelected = computed(() => 
  selectedItems.value.length > 0 && selectedItems.value.length < allItems.length
)

function handleSelectAll(event: Event) {
  const target = event.target as HTMLInputElement
  selectedItems.value = target.checked ? [...allItems] : []
}
</script>
```

### 自定义样式

```vue
<template>
  <md-checkbox
    :checked="isChecked"
    class="custom-checkbox"
    @change="handleChange"
  ></md-checkbox>
</template>

<style scoped>
.custom-checkbox {
  /* 自定义尺寸 */
  --md-checkbox-container-size: 24px;
  --md-checkbox-icon-size: 18px;
  
  /* 自定义颜色 */
  --md-checkbox-selected-container-color: var(--md-sys-color-primary);
  --md-checkbox-selected-icon-color: var(--md-sys-color-on-primary);
  --md-checkbox-unselected-outline-color: var(--md-sys-color-outline);
  
  /* 自定义 hover 效果 */
  --md-checkbox-unselected-hover-outline-color: var(--md-sys-color-on-surface);
  --md-checkbox-unselected-hover-state-layer-color: var(--md-sys-color-primary);
  --md-checkbox-unselected-hover-state-layer-opacity: 0.08;
}
</style>
```

---

## ⚠️ 注意事项

### 1. **事件处理**

Material Web Checkbox 的 `change` 事件返回的是原生 `Event`，需要通过 `event.target.checked` 获取选中状态。

```typescript
// ✅ 正确
function handleChange(event: Event) {
  const target = event.target as HTMLInputElement
  const checked = target.checked
  // 处理选中状态
}

// ❌ 错误：Material Web Checkbox 没有 @update:model-value 事件
function handleChange(value: boolean) {
  // 这不会被触发
}
```

### 2. **属性绑定**

Material Web Checkbox 使用 `:checked` 而不是 `:model-value`。

```vue
<!-- ✅ 正确 -->
<md-checkbox :checked="isChecked"></md-checkbox>

<!-- ❌ 错误 -->
<md-checkbox :model-value="isChecked"></md-checkbox>
```

### 3. **样式定制**

通过 CSS 变量定制样式，常用变量：
- `--md-checkbox-container-size`: 容器尺寸
- `--md-checkbox-icon-size`: 图标尺寸
- `--md-checkbox-selected-container-color`: 选中状态背景色
- `--md-checkbox-selected-icon-color`: 选中状态图标颜色
- `--md-checkbox-unselected-outline-color`: 未选中状态边框颜色
- `--md-checkbox-unselected-hover-outline-color`: hover 状态边框颜色
- `--md-checkbox-unselected-hover-state-layer-color`: hover 状态涟漪颜色
- `--md-checkbox-unselected-hover-state-layer-opacity`: hover 状态涟漪透明度

### 4. **圆形图标变体已移除**

自定义 Checkbox 的圆形图标变体（`variant="icon"`）不符合 Material Design 规范，已统一改为方形 Checkbox。这确保了项目设计风格的一致性。

---

## 🚀 后续优化建议

### 1. **添加标签支持**

Material Web Checkbox 可以与 `<label>` 元素配合使用：

```vue
<template>
  <label class="checkbox-label">
    <md-checkbox :checked="isChecked" @change="handleChange"></md-checkbox>
    <span>同意服务条款</span>
  </label>
</template>

<style scoped>
.checkbox-label {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-2);
  cursor: pointer;
}
</style>
```

### 2. **创建包装组件**（可选）

如果需要简化 API，可以创建一个包装组件：

```vue
<!-- MaterialCheckbox.vue -->
<template>
  <md-checkbox
    :checked="modelValue"
    :indeterminate="indeterminate"
    :disabled="disabled"
    @change="handleChange"
  ></md-checkbox>
</template>

<script setup lang="ts">
import '@material/web/checkbox/checkbox.js'

interface Props {
  modelValue: boolean
  indeterminate?: boolean
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  indeterminate: false,
  disabled: false
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'change': [value: boolean]
}>()

function handleChange(event: Event) {
  const target = event.target as HTMLInputElement
  const checked = target.checked
  emit('update:modelValue', checked)
  emit('change', checked)
}
</script>
```

使用包装组件：

```vue
<MaterialCheckbox
  v-model="isChecked"
  :indeterminate="someSelected"
  @change="handleChange"
/>
```

---

## 📚 相关资源

- [Material Web Checkbox 文档](https://github.com/material-components/material-web/blob/main/docs/components/checkbox.md)
- [Material Design 3 Selection 规范](https://m3.material.io/components/checkbox/overview)
- [Material Web Components](https://material-web.dev/)

---

**最后更新**: 2026-05-13  
**版本**: 1.0.0  
**状态**: ✅ 迁移完成
