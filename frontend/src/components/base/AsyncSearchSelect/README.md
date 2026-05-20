# AsyncSearchSelect 异步搜索选择器

通用的异步搜索选择器组件，支持单选/多选、防抖搜索、loading 状态等功能。

## 特性

- ✅ 支持单选/多选模式
- ✅ 异步搜索（防抖）
- ✅ Loading 状态显示
- ✅ 无结果提示
- ✅ 已选项 Chips 展示（多选模式）
- ✅ 点击外部关闭下拉
- ✅ 键盘导航支持
- ✅ 完全类型安全

## 使用示例

### 基础用法（单选）

```vue
<template>
  <AsyncSearchSelect
    ref="selectRef"
    label="选择用户"
    placeholder="输入用户名搜索..."
    @search="handleSearch"
    @change="handleChange"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { AsyncSearchSelect } from '@/components'
import type { SelectOption, AsyncSearchSelectInstance } from '@/components'

const selectRef = ref<AsyncSearchSelectInstance | null>(null)

// 处理搜索
const handleSearch = async (query: string) => {
  // 调用 API 搜索
  const results = await searchAPI(query)
  
  // 转换为 SelectOption 格式
  const options: SelectOption[] = results.map(item => ({
    value: item.id,
    label: item.name,
    description: item.email,
    raw: item
  }))
  
  // 设置搜索结果
  selectRef.value?.setOptions(options)
}

// 处理选择变化
const handleChange = (values: string[]) => {
  console.log('选中的值:', values)
}
</script>
```

### 多选模式

```vue
<template>
  <AsyncSearchSelect
    ref="selectRef"
    label="选择多个用户"
    placeholder="输入用户名搜索..."
    :multiple="true"
    @search="handleSearch"
    @change="handleChange"
    @update:selected="handleSelectedChange"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { AsyncSearchSelect } from '@/components'
import type { SelectOption, AsyncSearchSelectInstance } from '@/components'

const selectRef = ref<AsyncSearchSelectInstance | null>(null)

const handleSearch = async (query: string) => {
  // 搜索逻辑...
  selectRef.value?.setOptions(options)
}

const handleChange = (values: string[]) => {
  console.log('选中的值数组:', values)
}

const handleSelectedChange = (options: SelectOption[]) => {
  console.log('选中的选项对象:', options)
}
</script>
```

### 自定义配置

```vue
<template>
  <AsyncSearchSelect
    ref="selectRef"
    label="搜索商品"
    placeholder="输入商品名称..."
    :multiple="true"
    :min-search-length="3"
    :debounce="500"
    empty-text="未找到匹配的商品"
    @search="handleSearch"
  />
</template>
```

## Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `label` | `string` | `'搜索'` | 输入框标签 |
| `placeholder` | `string` | `'输入关键词搜索...'` | 输入框占位符 |
| `multiple` | `boolean` | `false` | 是否多选 |
| `minSearchLength` | `number` | `2` | 最小搜索长度 |
| `emptyText` | `string` | `'未找到匹配结果'` | 无结果提示文本 |
| `debounce` | `number` | `300` | 防抖延迟（毫秒） |

## Events

| 事件 | 参数 | 说明 |
|------|------|------|
| `search` | `(query: string)` | 搜索事件，返回搜索关键词 |
| `change` | `(values: string[])` | 选择变化，返回选中的值数组 |
| `update:selected` | `(options: SelectOption[])` | 选择变化，返回选中的选项对象数组 |

## 实例方法

通过 `ref` 可以调用以下方法：

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `setOptions` | `(options: SelectOption[])` | `void` | 设置搜索结果 |
| `setLoading` | `(loading: boolean)` | `void` | 设置 loading 状态 |
| `clearSelection` | `()` | `void` | 清空选择 |
| `getSelectedValues` | `()` | `string[]` | 获取选中的值 |
| `getSelectedOptions` | `()` | `SelectOption[]` | 获取选中的选项 |

## SelectOption 接口

```typescript
interface SelectOption {
  /** 选项值（唯一标识） */
  value: string
  /** 选项标签（显示文本） */
  label: string
  /** 选项描述（可选） */
  description?: string
  /** 原始数据（可选） */
  raw?: any
}
```

## 完整示例（用户搜索）

```vue
<template>
  <div class="user-search-demo">
    <AsyncSearchSelect
      ref="userSelectRef"
      label="搜索用户"
      placeholder="输入用户名或邮箱"
      :multiple="true"
      :min-search-length="2"
      empty-text="未找到匹配的用户"
      @search="handleUserSearch"
      @change="handleUserChange"
    />
    
    <div v-if="selectedUserIds.length > 0" class="selected-info">
      已选择 {{ selectedUserIds.length }} 个用户
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { AsyncSearchSelect } from '@/components'
import type { SelectOption, AsyncSearchSelectInstance } from '@/components'
import { trpc } from '@/services/trpc'

const userSelectRef = ref<AsyncSearchSelectInstance | null>(null)
const selectedUserIds = ref<string[]>([])

const handleUserSearch = async (query: string) => {
  try {
    // 设置 loading
    userSelectRef.value?.setLoading(true)
    
    // 调用 API
    const result = await trpc.user.search.query({ query })
    
    // 转换为 SelectOption
    const options: SelectOption[] = result.data.map(user => ({
      value: user.id,
      label: user.name || user.email,
      description: user.email,
      raw: user
    }))
    
    // 设置结果
    userSelectRef.value?.setOptions(options)
  } catch (error) {
    console.error('搜索失败:', error)
    userSelectRef.value?.setOptions([])
  }
}

const handleUserChange = (userIds: string[]) => {
  selectedUserIds.value = userIds
}
</script>
```

## 样式定制

组件使用 CSS 变量，可以通过覆盖变量来定制样式：

```css
.async-search-select {
  /* 下拉菜单最大高度 */
  --dropdown-max-height: 320px;
  
  /* 下拉菜单 z-index */
  --dropdown-z-index: 1000;
}
```

## 注意事项

1. **异步搜索**：组件本身不处理搜索逻辑，需要在 `@search` 事件中调用 API 并通过 `setOptions` 设置结果
2. **Loading 状态**：搜索时会自动显示 loading，但需要在搜索完成后调用 `setOptions` 来关闭 loading
3. **防抖**：输入已内置防抖，默认 300ms，可通过 `debounce` prop 调整
4. **最小搜索长度**：默认需要输入至少 2 个字符才会触发搜索，可通过 `minSearchLength` 调整
5. **清空选择**：弹窗关闭时记得调用 `clearSelection()` 清空选择状态

## 与 Ant Design Select 的对比

| 特性 | AsyncSearchSelect | Ant Design Select |
|------|-------------------|-------------------|
| 异步搜索 | ✅ | ✅ |
| 多选 | ✅ | ✅ |
| Loading 状态 | ✅ | ✅ |
| 防抖 | ✅ 内置 | ❌ 需手动实现 |
| 无结果提示 | ✅ | ✅ |
| Chips 展示 | ✅ | ✅ |
| 依赖 | 无外部依赖 | 需要 Ant Design |
| 样式 | Material Design 3 | Ant Design |
