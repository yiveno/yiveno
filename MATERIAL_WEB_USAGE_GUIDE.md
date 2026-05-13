# Material Web Components 使用指南

## 🎯 核心策略：直接使用，无封装层

我们**直接使用** Material Web Components，不创建 Vue 封装层。

**原因**：
- ✅ Material Web Components API 已经很好用
- ✅ 减少抽象层，代码更简单
- ✅ `design-tokens` 提供了足够的保护
- ✅ 全局样式文件统一管理

---

## 📦 安装和配置

### 1. 全局样式已配置

文件：`frontend/src/assets/material-web-theme.css`

这个文件统一配置了所有 Material Web Components 的样式，使用 `@acuity-bookmarks/design-tokens`。

### 2. 在 main.ts 中导入

```typescript
// main.ts
import '@acuity-bookmarks/design-tokens/css/material-theme.css'
import '@acuity-bookmarks/design-tokens/css/variables.css'
import '@acuity-bookmarks/design-tokens/css/semantic-colors.css'
import '@/assets/material-web-theme.css' // Material Web Components 全局样式
```

---

## 🛠️ 使用方式

### 按钮 (Buttons)

```vue
<script setup lang="ts">
import '@material/web/button/filled-button'
import '@material/web/button/outlined-button'
import '@material/web/button/text-button'

function handleSave() {
  console.log('保存')
}
</script>

<template>
  <!-- 主要操作 -->
  <md-filled-button @click="handleSave">
    保存
  </md-filled-button>

  <!-- 次要操作 -->
  <md-outlined-button @click="handleCancel">
    取消
  </md-outlined-button>

  <!-- 文本按钮 -->
  <md-text-button @click="handleReset">
    重置
  </md-text-button>

  <!-- 危险操作（使用全局样式类） -->
  <md-filled-button class="button--danger" @click="handleDelete">
    删除
  </md-filled-button>

  <!-- 禁用状态 -->
  <md-filled-button disabled>
    已禁用
  </md-filled-button>
</template>
```

### 文本框 (Text Fields)

```vue
<script setup lang="ts">
import '@material/web/textfield/filled-text-field'
import '@material/web/textfield/outlined-text-field'
import { ref } from 'vue'

const username = ref('')
const password = ref('')
</script>

<template>
  <!-- 填充样式文本框 -->
  <md-filled-text-field
    v-model="username"
    label="用户名"
    placeholder="请输入用户名"
  ></md-filled-text-field>

  <!-- 轮廓样式文本框 -->
  <md-outlined-text-field
    v-model="password"
    type="password"
    label="密码"
    placeholder="请输入密码"
  ></md-outlined-text-field>

  <!-- 带错误提示 -->
  <md-filled-text-field
    v-model="email"
    label="邮箱"
    error
    error-text="邮箱格式不正确"
  ></md-filled-text-field>
</template>
```

### 复选框 (Checkbox)

```vue
<script setup lang="ts">
import '@material/web/checkbox/checkbox'
import { ref } from 'vue'

const agreed = ref(false)
</script>

<template>
  <label>
    <md-checkbox
      :checked="agreed"
      @change="agreed = ($event.target as any).checked"
    ></md-checkbox>
    我同意服务条款
  </label>
</template>
```

### 开关 (Switch)

```vue
<script setup lang="ts">
import '@material/web/switch/switch'
import { ref } from 'vue'

const enabled = ref(true)
</script>

<template>
  <md-switch
    :selected="enabled"
    @change="enabled = ($event.target as any).selected"
  ></md-switch>
</template>
```

### 滑块 (Slider)

```vue
<script setup lang="ts">
import '@material/web/slider/slider'
import { ref } from 'vue'

const volume = ref(50)
</script>

<template>
  <md-slider
    :min="0"
    :max="100"
    :value="volume"
    labeled
    @input="volume = ($event.target as any).value"
  ></md-slider>
</template>
```

### 对话框 (Dialog)

```vue
<script setup lang="ts">
import '@material/web/dialog/dialog'
import '@material/web/button/text-button'
import { ref } from 'vue'

const dialogRef = ref<HTMLElement | null>(null)

function openDialog() {
  (dialogRef.value as any)?.show()
}

function closeDialog() {
  (dialogRef.value as any)?.close()
}
</script>

<template>
  <md-filled-button @click="openDialog">
    打开对话框
  </md-filled-button>

  <md-dialog ref="dialogRef">
    <div slot="headline">对话框标题</div>
    <div slot="content">
      这是对话框的内容
    </div>
    <div slot="actions">
      <md-text-button @click="closeDialog">取消</md-text-button>
      <md-text-button @click="handleConfirm">确认</md-text-button>
    </div>
  </md-dialog>
</template>
```

### 列表 (List)

```vue
<script setup lang="ts">
import '@material/web/list/list'
import '@material/web/list/list-item'
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

### 菜单 (Menu)

```vue
<script setup lang="ts">
import '@material/web/menu/menu'
import '@material/web/menu/menu-item'
import '@material/web/button/filled-button'
import { ref } from 'vue'

const menuRef = ref<HTMLElement | null>(null)
const anchorRef = ref<HTMLElement | null>(null)

function openMenu() {
  (menuRef.value as any)?.show()
}
</script>

<template>
  <md-filled-button ref="anchorRef" @click="openMenu">
    打开菜单
  </md-filled-button>

  <md-menu ref="menuRef" :anchor="anchorRef">
    <md-menu-item>
      <div slot="headline">菜单项 1</div>
    </md-menu-item>
    <md-menu-item>
      <div slot="headline">菜单项 2</div>
    </md-menu-item>
  </md-menu>
</template>
```

### 芯片 (Chips)

```vue
<script setup lang="ts">
import '@material/web/chips/chip-set'
import '@material/web/chips/filter-chip'
import '@material/web/chips/input-chip'
</script>

<template>
  <md-chip-set>
    <md-filter-chip label="筛选 1"></md-filter-chip>
    <md-filter-chip label="筛选 2"></md-filter-chip>
    <md-input-chip label="输入芯片"></md-input-chip>
  </md-chip-set>
</template>
```

### 进度指示器 (Progress)

```vue
<script setup lang="ts">
import '@material/web/progress/linear-progress'
import '@material/web/progress/circular-progress'
</script>

<template>
  <!-- 线性进度 -->
  <md-linear-progress :value="0.5"></md-linear-progress>
  
  <!-- 不确定进度 -->
  <md-linear-progress indeterminate></md-linear-progress>
  
  <!-- 圆形进度 -->
  <md-circular-progress :value="0.75"></md-circular-progress>
  
  <!-- 不确定圆形进度 -->
  <md-circular-progress indeterminate></md-circular-progress>
</template>
```

### 标签页 (Tabs)

```vue
<script setup lang="ts">
import '@material/web/tabs/tabs'
import '@material/web/tabs/primary-tab'
import { ref } from 'vue'

const activeTab = ref(0)
</script>

<template>
  <md-tabs @change="activeTab = ($event.target as any).activeTabIndex">
    <md-primary-tab>标签 1</md-primary-tab>
    <md-primary-tab>标签 2</md-primary-tab>
    <md-primary-tab>标签 3</md-primary-tab>
  </md-tabs>

  <div v-if="activeTab === 0">内容 1</div>
  <div v-if="activeTab === 1">内容 2</div>
  <div v-if="activeTab === 2">内容 3</div>
</template>
```

### 分隔线 (Divider)

```vue
<script setup lang="ts">
import '@material/web/divider/divider'
</script>

<template>
  <div>内容 1</div>
  <md-divider></md-divider>
  <div>内容 2</div>
</template>
```

---

## 🎨 自定义样式

### 方式 1：使用全局样式类

全局样式文件已定义了一些工具类：

```vue
<template>
  <!-- 危险操作按钮 -->
  <md-filled-button class="button--danger">删除</md-filled-button>
  
  <!-- 成功操作按钮 -->
  <md-filled-button class="button--success">保存成功</md-filled-button>
</template>
```

### 方式 2：组件内自定义

```vue
<template>
  <md-filled-button class="custom-button">自定义按钮</md-filled-button>
</template>

<style scoped>
.custom-button {
  --md-filled-button-container-color: #ff6b6b;
  --md-filled-button-label-text-color: white;
}
</style>
```

### 方式 3：添加到全局样式

如果需要全局使用，添加到 `material-web-theme.css`：

```css
/* frontend/src/assets/material-web-theme.css */

/* 警告按钮 */
md-filled-button.button--warning {
  --md-filled-button-container-color: var(--color-semantic-warning);
  --md-filled-button-label-text-color: white;
}
```

---

## 📚 完整组件列表

| 组件类型 | 组件标签 | 导入路径 |
|---------|---------|---------|
| **Buttons** | | |
| 填充按钮 | `<md-filled-button>` | `@material/web/button/filled-button` |
| 轮廓按钮 | `<md-outlined-button>` | `@material/web/button/outlined-button` |
| 文本按钮 | `<md-text-button>` | `@material/web/button/text-button` |
| 浮起按钮 | `<md-elevated-button>` | `@material/web/button/elevated-button` |
| 色调按钮 | `<md-tonal-button>` | `@material/web/button/tonal-button` |
| **Icon Buttons** | | |
| 图标按钮 | `<md-icon-button>` | `@material/web/iconbutton/icon-button` |
| 填充图标按钮 | `<md-filled-icon-button>` | `@material/web/iconbutton/filled-icon-button` |
| **Text Fields** | | |
| 填充文本框 | `<md-filled-text-field>` | `@material/web/textfield/filled-text-field` |
| 轮廓文本框 | `<md-outlined-text-field>` | `@material/web/textfield/outlined-text-field` |
| **Selection** | | |
| 复选框 | `<md-checkbox>` | `@material/web/checkbox/checkbox` |
| 单选按钮 | `<md-radio>` | `@material/web/radio/radio` |
| 开关 | `<md-switch>` | `@material/web/switch/switch` |
| 滑块 | `<md-slider>` | `@material/web/slider/slider` |
| **Dialog** | | |
| 对话框 | `<md-dialog>` | `@material/web/dialog/dialog` |
| **Lists** | | |
| 列表 | `<md-list>` | `@material/web/list/list` |
| 列表项 | `<md-list-item>` | `@material/web/list/list-item` |
| **Menu** | | |
| 菜单 | `<md-menu>` | `@material/web/menu/menu` |
| 菜单项 | `<md-menu-item>` | `@material/web/menu/menu-item` |
| **Chips** | | |
| 芯片集 | `<md-chip-set>` | `@material/web/chips/chip-set` |
| 筛选芯片 | `<md-filter-chip>` | `@material/web/chips/filter-chip` |
| 输入芯片 | `<md-input-chip>` | `@material/web/chips/input-chip` |
| **Progress** | | |
| 线性进度 | `<md-linear-progress>` | `@material/web/progress/linear-progress` |
| 圆形进度 | `<md-circular-progress>` | `@material/web/progress/circular-progress` |
| **Tabs** | | |
| 标签页 | `<md-tabs>` | `@material/web/tabs/tabs` |
| 主标签 | `<md-primary-tab>` | `@material/web/tabs/primary-tab` |
| **Others** | | |
| 分隔线 | `<md-divider>` | `@material/web/divider/divider` |
| 图标 | `<md-icon>` | `@material/web/icon/icon` |
| FAB | `<md-fab>` | `@material/web/fab/fab` |

---

## 🔧 TypeScript 支持

Material Web Components 提供了类型定义，但在 Vue 中使用时需要一些类型断言：

```typescript
// 获取组件实例
const dialogRef = ref<HTMLElement | null>(null)

// 调用方法
function openDialog() {
  (dialogRef.value as any)?.show()
}

// 获取事件值
function handleChange(event: Event) {
  const value = (event.target as any).value
  console.log(value)
}
```

---

## 📖 参考资源

- [Material Web Components 官方文档](https://material-web.dev/)
- [Material Design 3 规范](https://m3.material.io/)
- [项目 Design Tokens](../../packages/design-tokens/README.md)
- [迁移计划](./MATERIAL_WEB_COMPONENTS_MIGRATION_PLAN.md)

---

**最后更新**: 2026-05-13
