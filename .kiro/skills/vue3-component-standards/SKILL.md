---
name: vue3-component-standards
description: Ensure Vue 3 components follow project standards for naming, props, emits, styling, and architecture. Use when creating or modifying Vue components.
---

# Vue 3 组件开发规范

> **目的**：确保所有 Vue 3 组件符合项目规范，保持代码一致性和可维护性

## 🎯 组件开发检查清单

### 1. 组件命名（必须）

```vue
<script setup lang="ts">
// ✅ 必须：使用 defineOptions 设置组件名
defineOptions({ name: 'YivenoButton' })

// ❌ 错误：不设置组件名
// 组件名用于 Vue DevTools 调试和错误追踪
</script>
```

**命名规范：**

- ✅ 使用 PascalCase（如 `YivenoButton`、`BookmarkTree`）
- ✅ 基础组件加 `Yiveno` 前缀（如 `YivenoButton`、`YivenoInput`）
- ✅ 业务组件使用描述性名称（如 `RecallComposer`）

---

### 2. Props 定义（必须）

```vue
<script setup lang="ts">
import type { ButtonProps } from './Button.d'

// ✅ 正确：使用 TypeScript 接口定义 Props
const props = withDefaults(defineProps<ButtonProps>(), {
  variant: 'primary',
  size: 'medium',
  disabled: false
})

// ❌ 错误：不使用类型定义
const props = defineProps({
  variant: String,
  size: String
})
</script>
```

**Props 规范：**

- ✅ 必须创建独立的 `.d.ts` 类型文件
- ✅ 使用 `withDefaults` 设置默认值
- ✅ Props 名称使用 camelCase
- ✅ 添加 JSDoc 注释（中文）

**示例类型文件：**

```typescript
// Button.d.ts
export interface ButtonProps {
  /** 按钮变体 */
  variant?: 'primary' | 'secondary' | 'text'

  /** 按钮尺寸 */
  size?: 'small' | 'medium' | 'large'

  /** 是否禁用 */
  disabled?: boolean

  /** 是否加载中 */
  loading?: boolean
}

export interface ButtonEmits {
  /** 点击事件 */
  click: [event: MouseEvent]
}
```

---

### 3. Emits 定义（必须）

```vue
<script setup lang="ts">
import type { ButtonEmits } from './Button.d'

// ✅ 正确：使用 TypeScript 接口定义 Emits
const emit = defineEmits<ButtonEmits>()

// 触发事件
const handleClick = (event: MouseEvent) => {
  emit('click', event)
}

// ❌ 错误：不使用类型定义
const emit = defineEmits(['click'])
</script>
```

**Emits 规范：**

- ✅ 使用标准 DOM 事件名称（如 `click`、`change`、`input`）
- ✅ 或使用动词形式（如 `update:modelValue`、`search-complete`）
- ✅ 添加 JSDoc 注释说明事件用途

---

### 4. 样式规范（必须）

```vue
<style scoped>
/* ✅ 正确：使用 CSS 变量 */
.button {
  padding: var(--spacing-3) var(--spacing-4);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  border-radius: var(--radius-md);
  background-color: var(--accent);
  color: var(--on-accent);
  transition: all var(--motion-duration-fast) var(--motion-easing-standard);
}

/* ❌ 错误：硬编码数值 */
.button {
  padding: 12px 16px; /* 禁止！ */
  font-size: 14px; /* 禁止！ */
  background-color: #3b82f6; /* 禁止！ */
}
</style>
```

**样式规范：**

- ✅ 必须使用 `scoped` 避免样式泄漏
- ✅ 必须使用 CSS 变量（来自 `@yiveno/design-tokens`）
- ✅ 类名使用 kebab-case（如 `button-primary`）
- ❌ 禁止硬编码颜色、间距、字号

**可用的 CSS 变量：**

```css
/* 颜色 */
var(--accent)
var(--on-accent)
var(--color-text-primary)
var(--color-text-secondary)
var(--color-background)
var(--color-surface)

/* 间距 */
var(--spacing-1)  /* 4px */
var(--spacing-2)  /* 8px */
var(--spacing-3)  /* 12px */
var(--spacing-4)  /* 16px */
var(--spacing-6)  /* 24px */

/* 字号 */
var(--text-xs)    /* 12px */
var(--text-sm)    /* 14px */
var(--text-base)  /* 16px */
var(--text-lg)    /* 18px */

/* 圆角 */
var(--radius-sm)  /* 4px */
var(--radius-md)  /* 8px */
var(--radius-lg)  /* 12px */

/* 动画 */
var(--motion-duration-fast)  /* 100ms */
var(--motion-easing-standard)  /* cubic-bezier */
```

---

### 5. JSDoc 注释（必须）

```vue
<script setup lang="ts">
/**
 * 更新书签访问记录
 *
 * @description 通过 application 层服务更新书签的 lastVisited 和 visitCount 字段
 * @param bookmarkId - 书签ID
 * @returns Promise<void>
 * @throws {Error} 更新失败时抛出错误
 */
const updateBookmarkVisitRecord = async (bookmarkId: string): Promise<void> => {
  try {
    const { bookmarkAppService } = await import('@/application/bookmark/bookmark-app-service')

    const result = await bookmarkAppService.updateVisitRecord(bookmarkId)

    if (!result.ok) {
      logger.warn('SidePanel', '⚠️ 更新访问记录失败', result.error)
    }
  } catch (error) {
    logger.warn('SidePanel', '⚠️ 更新访问记录失败', error)
  }
}
</script>
```

**注释规范：**

- ✅ 所有函数必须添加 JSDoc 注释（中文）
- ✅ 包含：描述、参数、返回值、异常
- ✅ 复杂逻辑添加行内注释说明意图
- ❌ 禁止重复代码逻辑的注释

---

### 6. 组件分类（必须遵守）

**基础组件（`components/base/`）：**

- ✅ 单一功能，不依赖其他组件
- ✅ 纯 UI 展示，无业务逻辑
- ✅ 文案由外部传入（props 或 slots）
- ❌ 不包含业务逻辑
- ❌ 不调用业务服务

**复合组件（`components/composite/`）：**

- ✅ 由多个基础组件组合
- ✅ 纯 UI 展示，无业务逻辑
- ✅ 可能有少量固定的 UI 提示文案
- ❌ 不包含业务逻辑
- ❌ 不调用业务服务

**业务组件（`components/business/`）：**

- ✅ 包含业务逻辑
- ✅ 调用业务服务
- ✅ 处理业务数据
- ✅ 直接使用项目 i18n

**判断标准：**

```
开始
 ↓
是否包含业务逻辑？
 ├─ 是 → 业务组件 → business/
 └─ 否 → 继续
      ↓
是否由多个基础组件组合？
 ├─ 是 → 复合组件 → composite/
 └─ 否 → 基础组件 → base/
```

---

### 7. 架构约束（必须遵守）

```vue
<script setup lang="ts">
// ❌ 错误：组件直接调用 Chrome API
async function deleteBookmark(id: string) {
  await chrome.bookmarks.remove(id) // ❌ 违反架构
}

// ✅ 正确：通过消息通知 Background Script
async function deleteBookmark(id: string) {
  await chrome.runtime.sendMessage({
    type: 'DELETE_BOOKMARK',
    payload: { id }
  })
}

// ❌ 错误：组件直接访问 IndexedDB
import { indexedDBManager } from '@/infrastructure/indexeddb/manager' // ❌

// ✅ 正确：通过 application 层服务
import { bookmarkService } from '@/application/bookmark/bookmark-service' // ✅
</script>
```

**架构规则：**

- ❌ 组件不能直接调用 `chrome.bookmarks.*`
- ❌ 组件不能直接调用 `indexedDB.open()`
- ❌ 组件不能直接访问 `infrastructure/` 层
- ✅ 必须通过 `application/` 层访问业务逻辑
- ✅ 必须通过 `chrome.runtime.sendMessage` 与 Background Script 通信

---

## 🎨 组件模板

### 基础组件模板

```vue
<!-- components/base/Button/Button.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import type { ButtonProps, ButtonEmits } from './Button.d'

defineOptions({ name: 'YivenoButton' })

const props = withDefaults(defineProps<ButtonProps>(), {
  variant: 'primary',
  size: 'medium',
  disabled: false
})

const emit = defineEmits<ButtonEmits>()

const buttonClasses = computed(() => [
  'button',
  `button--${props.variant}`,
  `button--${props.size}`,
  {
    'button--disabled': props.disabled
  }
])

const handleClick = (event: MouseEvent) => {
  if (props.disabled) return
  emit('click', event)
}
</script>

<template>
  <button :class="buttonClasses" :disabled="disabled" @click="handleClick">
    <slot />
  </button>
</template>

<style scoped>
.button {
  padding: var(--spacing-3) var(--spacing-4);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  border-radius: var(--radius-md);
  transition: all var(--motion-duration-fast) var(--motion-easing-standard);
}

.button--primary {
  background-color: var(--accent);
  color: var(--on-accent);
}

.button--primary:hover:not(.button--disabled) {
  background-color: color-mix(in srgb, var(--accent), black 8%);
}

.button--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
```

### 类型定义模板

```typescript
// components/base/Button/Button.d.ts
export interface ButtonProps {
  /** 按钮变体 */
  variant?: 'primary' | 'secondary' | 'text'

  /** 按钮尺寸 */
  size?: 'small' | 'medium' | 'large'

  /** 是否禁用 */
  disabled?: boolean

  /** 是否加载中 */
  loading?: boolean
}

export interface ButtonEmits {
  /** 点击事件 */
  click: [event: MouseEvent]
}
```

---

## 🔍 自检清单

**在提交组件代码前，确认：**

- [ ] 使用 `defineOptions({ name: 'ComponentName' })` 设置组件名
- [ ] Props 使用 TypeScript 接口定义
- [ ] Emits 使用 TypeScript 接口定义
- [ ] 样式使用 CSS 变量，无硬编码数值
- [ ] 添加 JSDoc 注释（中文）
- [ ] 组件分类正确（base / composite / business）
- [ ] 遵循架构约束（不直接调用 Chrome API / IndexedDB）
- [ ] 运行 `bun run typecheck:force` 通过
- [ ] 运行 `bun run lint:check` 通过
- [ ] 运行 `bun run stylelint:check` 通过

---

## 📚 相关文档

- [组件分类规范](../../frontend/src/components/README.md)
- [基础组件文档](../../frontend/src/components/base/README.md)
- [设计系统规范](../../.kiro/steering/design-system.md)
- [项目架构规范](../../.kiro/steering/project.md)

---

**最后更新**: 2026-05-20  
**维护者**: Kiro AI
