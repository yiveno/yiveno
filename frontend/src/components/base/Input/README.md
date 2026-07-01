# Input 输入框组件

一个功能丰富的输入框组件，支持多种样式、图标、验证和交互状态。

## ✨ 特性

- 🎨 **多种样式** - 支持 outlined、filled、underlined 三种样式
- 📏 **三种尺寸** - sm、md、lg 满足不同场景
- 🔍 **图标支持** - 前缀和后缀图标
- ✅ **表单验证** - 内置错误状态和提示
- 🧹 **可清除** - 支持一键清空内容
- 🔒 **多种状态** - 禁用、只读、加载中
- 🎯 **无障碍** - 符合 WCAG 标准
- 📦 **零依赖** - 纯原子组件

## 📦 安装

```typescript
import { Input } from '@/components'
```

## 🎯 基础用法

### 默认输入框

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { Input } from '@/components'

const value = ref('')
</script>

<template>
  <Input v-model="value" placeholder="请输入内容" />
</template>
```

### 不同样式

```vue
<template>
  <!-- Outlined 样式（默认） -->
  <Input v-model="value" variant="outlined" placeholder="Outlined" />

  <!-- Filled 样式 -->
  <Input v-model="value" variant="filled" placeholder="Filled" />

  <!-- Underlined 样式 -->
  <Input v-model="value" variant="underlined" placeholder="Underlined" />
</template>
```

### 不同尺寸

```vue
<template>
  <Input v-model="value" size="sm" placeholder="Small" />
  <Input v-model="value" size="md" placeholder="Medium" />
  <Input v-model="value" size="lg" placeholder="Large" />
</template>
```

### 带标签

```vue
<template>
  <Input v-model="value" label="用户名" placeholder="请输入用户名" />
</template>
```

### 带图标

```vue
<template>
  <!-- 前缀图标 -->
  <Input v-model="value" prefix-icon="icon-search" placeholder="搜索..." />

  <!-- 后缀图标 -->
  <Input v-model="value" suffix-icon="icon-eye" placeholder="密码" type="password" />

  <!-- 图标点击事件 -->
  <Input v-model="value" suffix-icon="icon-send" @suffix-click="handleSend" />
</template>
```

### 可清除

```vue
<template>
  <Input v-model="value" clearable placeholder="可清除的输入框" @clear="handleClear" />
</template>
```

### 表单验证

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'

const email = ref('')
const error = computed(() => {
  if (!email.value) return false
  return !email.value.includes('@')
})
const errorMessage = computed(() => {
  return error.value ? '请输入有效的邮箱地址' : ''
})
</script>

<template>
  <Input
    v-model="email"
    label="邮箱"
    placeholder="example@email.com"
    :error="error"
    :error-message="errorMessage"
    hint="请输入您的邮箱地址"
  />
</template>
```

### 不同状态

```vue
<template>
  <!-- 禁用 -->
  <Input v-model="value" disabled placeholder="禁用状态" />

  <!-- 只读 -->
  <Input v-model="value" readonly placeholder="只读状态" />

  <!-- 加载中 -->
  <Input v-model="value" loading placeholder="加载中..." />
</template>
```

### 不同类型

```vue
<template>
  <!-- 文本 -->
  <Input v-model="text" type="text" placeholder="文本" />

  <!-- 密码 -->
  <Input v-model="password" type="password" placeholder="密码" />

  <!-- 数字 -->
  <Input v-model.number="number" type="number" placeholder="数字" />

  <!-- 邮箱 -->
  <Input v-model="email" type="email" placeholder="邮箱" />

  <!-- URL -->
  <Input v-model="url" type="url" placeholder="网址" />
</template>
```

### 无边框模式

```vue
<template>
  <Input v-model="value" borderless placeholder="无边框输入框" />
</template>
```

## 📋 API

### Props

| 属性           | 类型                                     | 默认值       | 说明                  |
| -------------- | ---------------------------------------- | ------------ | --------------------- |
| `modelValue`   | `string \| number`                       | `''`         | 输入框的值（v-model） |
| `label`        | `string`                                 | -            | 输入框标签            |
| `variant`      | `'outlined' \| 'filled' \| 'underlined'` | `'outlined'` | 输入框样式            |
| `size`         | `'sm' \| 'md' \| 'lg'`                   | `'md'`       | 输入框大小            |
| `type`         | `string`                                 | `'text'`     | 输入框类型            |
| `placeholder`  | `string`                                 | -            | 占位符文本            |
| `disabled`     | `boolean`                                | `false`      | 是否禁用              |
| `readonly`     | `boolean`                                | `false`      | 是否只读              |
| `clearable`    | `boolean`                                | `false`      | 是否可清除            |
| `error`        | `boolean`                                | `false`      | 是否显示错误状态      |
| `errorMessage` | `string`                                 | -            | 错误提示信息          |
| `hint`         | `string`                                 | -            | 提示信息              |
| `prefixIcon`   | `string`                                 | -            | 前缀图标              |
| `suffixIcon`   | `string`                                 | -            | 后缀图标              |
| `loading`      | `boolean`                                | `false`      | 是否加载中            |
| `borderless`   | `boolean`                                | `false`      | 是否无边框            |
| `maxlength`    | `number`                                 | -            | 最大长度              |
| `autocomplete` | `string`                                 | -            | 自动完成              |
| `name`         | `string`                                 | -            | 表单字段名            |

### Emits

| 事件名              | 参数                        | 说明               |
| ------------------- | --------------------------- | ------------------ |
| `update:modelValue` | `(value: string \| number)` | 值变化时触发       |
| `input`             | `(value: string \| number)` | 输入时触发         |
| `focus`             | `(e: FocusEvent)`           | 获得焦点时触发     |
| `blur`              | `(e: FocusEvent)`           | 失去焦点时触发     |
| `clear`             | `()`                        | 清除内容时触发     |
| `prefix-click`      | `(e: MouseEvent)`           | 前缀图标点击时触发 |
| `suffix-click`      | `(e: MouseEvent)`           | 后缀图标点击时触发 |
| `keydown`           | `(e: KeyboardEvent)`        | 键盘按下时触发     |

### Slots

| 插槽名   | 说明     |
| -------- | -------- |
| `prefix` | 前缀内容 |
| `suffix` | 后缀内容 |

## 🎨 样式变量

```css
.yiveno-input {
  /* 尺寸 */
  --input-sm-height: 32px;
  --input-md-height: 40px;
  --input-lg-height: 48px;

  /* 圆角 */
  border-radius: var(--radius-md);

  /* 边框 */
  border: 1px solid var(--color-border);

  /* 颜色 */
  color: var(--color-text-primary);
  background: var(--color-surface);
}
```

## 💡 使用场景

### 搜索框

```vue
<template>
  <Input
    v-model="searchQuery"
    prefix-icon="icon-search"
    placeholder="搜索..."
    clearable
    @keydown.enter="handleSearch"
  />
</template>
```

### 密码输入

```vue
<script setup lang="ts">
import { ref } from 'vue'

const password = ref('')
const showPassword = ref(false)

const togglePassword = () => {
  showPassword.value = !showPassword.value
}
</script>

<template>
  <Input
    v-model="password"
    :type="showPassword ? 'text' : 'password'"
    :suffix-icon="showPassword ? 'icon-eye-off' : 'icon-eye'"
    placeholder="请输入密码"
    @suffix-click="togglePassword"
  />
</template>
```

### 表单字段

```vue
<template>
  <form @submit.prevent="handleSubmit">
    <Input
      v-model="form.username"
      label="用户名"
      name="username"
      autocomplete="username"
      :error="errors.username"
      :error-message="errors.usernameMessage"
      required
    />

    <Input
      v-model="form.email"
      label="邮箱"
      type="email"
      name="email"
      autocomplete="email"
      :error="errors.email"
      :error-message="errors.emailMessage"
      required
    />

    <Button type="submit">提交</Button>
  </form>
</template>
```

## ⚠️ 注意事项

1. **v-model 修饰符** - 支持 `.number` 和 `.trim` 修饰符
2. **表单集成** - 使用 `name` 属性以支持表单提交和浏览器自动填充
3. **无障碍** - 使用 `label` 属性提供标签，提升可访问性
4. **验证时机** - 建议在 `blur` 事件时进行验证，避免打扰用户输入
5. **密码安全** - 密码输入框应使用 `type="password"` 和 `autocomplete="current-password"`

## 🔗 相关组件

- [Button](../Button/README.md) - 按钮组件
- [Icon](../Icon/README.md) - 图标组件

## 📝 更新日志

- **v1.0.0** - 初始版本，支持基础功能

---

**组件类型**: 基础组件（原子级）  
**最后更新**: 2025-01-05
