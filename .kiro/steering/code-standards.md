---
inclusion: always
---

# 代码规范强制执行规则

**本文档定义了 AI IDE 必须遵守的代码质量标准**

---

## 📚 完整配置文件（自动加载）

以下配置文件会自动加载到上下文中，AI 必须严格遵守其中的所有规则：

### TypeScript 配置

#[[file:../../tsconfig.base.json]]

### ESLint 配置

#[[file:../../eslint.config.js]]

### Prettier 配置

#[[file:../../.prettierrc.json]]

### Stylelint 配置

#[[file:../../frontend/stylelint.config.js]]

> **⚠️ 重要**：以上配置文件包含所有详细规则，AI 必须完全遵守。特别注意 Stylelint 的 `order/properties-order` 规则（250 行完整的 CSS 属性排序列表）。

---

## 🔍 写代码前强制检查清单（每次都要过一遍）

**⚠️ 在编写任何代码前，必须先过一遍这个清单！**

### TypeScript 检查（5 秒）

- [ ] 没有使用 `any` 类型
- [ ] 数组/对象访问使用 `??` 或 `?.`（因为 `noUncheckedIndexedAccess: true`）
- [ ] 函数所有分支都有显式返回值
- [ ] 可选属性不使用 `undefined`，而是条件构造对象

### Vue 3 检查（5 秒）

- [ ] `defineOptions` 在 `defineProps` 之前
- [ ] Props 没有在 root scope 解构（❌ `...props.xxx` → ✅ `toRefs(props)` 或 `props.xxx`）
- [ ] 事件命名使用 camelCase（❌ `'update-value'` → ✅ `updateValue`）
- [ ] 没有在 computed 中修改响应式状态

### CSS 检查（10 秒）

- [ ] 所有颜色使用 CSS 变量（❌ `#333` / `red` → ✅ `var(--color-text-primary)`）
- [ ] 所有间距使用 CSS 变量（❌ `16px` → ✅ `var(--spacing-4)`）
- [ ] 所有字号使用 CSS 变量（❌ `14px` → ✅ `var(--text-sm)`）
- [ ] 属性按顺序排列：定位 → 显示 → 盒模型 → 字体 → 背景 → 视觉 → 动画
- [ ] **关键顺序**：`flex` 在 `gap` 之前，`justify-content` 在 `align-items` 之前
- [ ] 颜色使用现代格式（❌ `rgba(0, 0, 0, 0.5)` → ✅ `rgb(0 0 0 / 50%)`）
- [ ] 使用简写属性（❌ `top: 0; right: 0; bottom: 0; left: 0;` → ✅ `inset: 0;`）
- [ ] hover/active 不改变几何属性（width/height/padding/margin/transform）

---

## 🎯 核心原则

**AI IDE 在编写代码时，必须确保代码符合以下所有规范：**

1. ✅ TypeScript 严格模式（100% 类型安全）
2. ✅ ESLint 规则（0 errors, 0 warnings）
3. ✅ Stylelint 规则（CSS 代码规范）
4. ✅ Prettier 格式化（统一代码风格）

---

## 📋 代码质量检查清单

### 在编写/修改代码前，必须确认：

- [ ] 是否使用了 `any` 类型？（❌ 永久禁止）
- [ ] 是否使用了 `as any` 断言？（❌ 永久禁止）
- [ ] 是否有未使用的导入？（❌ 必须删除）
- [ ] 是否有未使用的变量？（❌ 必须删除或加 `_` 前缀）
- [ ] 是否有变量遮蔽？（❌ 必须重命名）
- [ ] 是否有 Race Condition？（❌ 必须修复或添加 eslint-disable 注释）
- [ ] 是否有嵌套三元运算符？（❌ 必须提取为函数）
- [ ] 函数复杂度是否过高？（⚠️ 建议重构）
- [ ] 嵌套深度是否过深？（⚠️ 建议重构）

---

## 🚨 TypeScript 严格模式规则

### 1. 禁止 `any` 类型

```typescript
// ❌ 错误：使用 any
function processData(data: any) {
  return data.value
}

// ✅ 正确：使用具体类型
function processData(data: DataItem) {
  return data.value
}

// ✅ 正确：使用泛型
function processData<T>(data: T) {
  return data
}

// ✅ 正确：使用 unknown + 类型守卫
function processData(data: unknown) {
  if (typeof data === 'object' && data !== null && 'value' in data) {
    return (data as { value: string }).value
  }
}
```

### 2. 处理可选属性（`exactOptionalPropertyTypes`）

```typescript
// ❌ 错误：显式 undefined
const options = {
  email,
  password,
  redirectTo: redirectUrl || undefined // ❌
}

// ✅ 正确：条件构造对象
const options = redirectUrl
  ? { email, password, options: { redirectTo: redirectUrl } }
  : { email, password }

// ✅ 正确：使用可选链
const options = {
  email,
  password,
  ...(redirectUrl && { options: { redirectTo: redirectUrl } })
}
```

### 3. 数组/对象访问检查（`noUncheckedIndexedAccess`）

```typescript
// ❌ 错误：直接访问可能不存在的元素
const items = ['a', 'b', 'c']
const item = items[10] // 类型: string | undefined
item.toUpperCase() // ❌ 编译错误

// ✅ 正确：使用可选链
const item = items[10]
item?.toUpperCase()

// ✅ 正确：使用空值合并
const item = items[10] ?? 'default'
item.toUpperCase()

// ✅ 正确：使用类型守卫
const item = items[10]
if (item !== undefined) {
  item.toUpperCase()
}
```

### 4. 函数必须显式返回（`noImplicitReturns`）

```typescript
// ❌ 错误：部分分支没有返回值
function getValue(condition: boolean): string {
  if (condition) {
    return 'yes'
  }
  // ❌ 缺少 else 分支的返回值
}

// ✅ 正确：所有分支都有返回值
function getValue(condition: boolean): string {
  if (condition) {
    return 'yes'
  }
  return 'no'
}

// ✅ 正确：使用三元运算符
function getValue(condition: boolean): string {
  return condition ? 'yes' : 'no'
}
```

---

## 🔍 ESLint 规则详解

### 1. 禁止变量遮蔽（`@typescript-eslint/no-shadow`）

```typescript
// ❌ 错误：内层变量遮蔽外层变量
const response = await fetch(url1)
if (condition) {
  const response = await fetch(url2) // ❌ 遮蔽外层 response
}

// ✅ 正确：使用不同的变量名
const response1 = await fetch(url1)
if (condition) {
  const response2 = await fetch(url2)
}

// ✅ 正确：使用更具描述性的名称
const userResponse = await fetch(userUrl)
if (condition) {
  const settingsResponse = await fetch(settingsUrl)
}
```

### 2. 防止 Race Condition（`require-atomic-updates`）

```typescript
// ❌ 错误：可能导致数据不一致
state.value = await compute(state.value)

// ✅ 正确：保存状态快照
const snapshot = state.value
const result = await compute(snapshot)
state.value = result

// ✅ 正确：如果确定安全，添加注释说明
// eslint-disable-next-line require-atomic-updates -- 此处 state.value 在 await 期间不会被其他代码修改
state.value = await compute(state.value)
```

### 3. 避免嵌套三元运算符（`no-nested-ternary`）

```typescript
// ❌ 错误：嵌套三元运算符
const value = condition1 ? value1 : condition2 ? value2 : value3

// ✅ 正确：提取为函数
function getValue() {
  if (condition1) return value1
  if (condition2) return value2
  return value3
}
const value = getValue()

// ✅ 正确：使用 if-else
let value
if (condition1) {
  value = value1
} else if (condition2) {
  value = value2
} else {
  value = value3
}
```

### 4. 限制函数复杂度（`complexity`）

```typescript
// ❌ 错误：圈复杂度过高（> 15）
function processBookmark(bookmark: Bookmark) {
  if (bookmark.type === 'folder') {
    if (bookmark.children.length > 0) {
      if (bookmark.expanded) {
        // ... 10+ 层嵌套
      }
    }
  }
}

// ✅ 正确：拆分为多个小函数
function processBookmark(bookmark: Bookmark) {
  if (bookmark.type === 'folder') {
    return processFolder(bookmark)
  }
  return processLink(bookmark)
}

function processFolder(folder: Folder) {
  if (folder.children.length === 0) return
  if (!folder.expanded) return
  processChildren(folder.children)
}
```

### 5. 限制嵌套深度（`max-depth`）

```typescript
// ❌ 错误：嵌套过深（> 4 层）
function processData(data: Data[]) {
  for (const item of data) {
    // 第 1 层
    if (item.valid) {
      // 第 2 层
      for (const child of item.children) {
        // 第 3 层
        if (child.active) {
          // 第 4 层
          for (const tag of child.tags) {
            // 第 5 层 ❌
            // ...
          }
        }
      }
    }
  }
}

// ✅ 正确：提前返回，减少嵌套
function processData(data: Data[]) {
  for (const item of data) {
    if (!item.valid) continue
    processChildren(item.children)
  }
}

function processChildren(children: Child[]) {
  for (const child of children) {
    if (!child.active) continue
    processTags(child.tags)
  }
}
```

### 6. Vue 事件命名规范（`vue/custom-event-name-casing`）

```vue
<!-- ❌ 错误：使用 kebab-case -->
<script setup lang="ts">
const emit = defineEmits<{
  'update-value': [value: string] // ❌
  'item-selected': [id: string] // ❌
}>()
</script>

<!-- ✅ 正确：使用 camelCase -->
<script setup lang="ts">
const emit = defineEmits<{
  updateValue: [value: string] // ✅
  itemSelected: [id: string] // ✅
}>()
</script>
```

### 7. Vue 响应式规则

```typescript
// ❌ 错误：解构 props 会丢失响应式
const { title, url } = props // ❌

// ✅ 正确：使用 toRefs
const { title, url } = toRefs(props)

// ✅ 正确：直接使用 props
console.log(props.title)

// ❌ 错误：在 root scope 展开 props
const filterOptions = ref({
  ...props.initialFilter // ❌ 会丢失响应式
})

// ✅ 正确：使用 toRefs 或条件赋值
const filterOptions = ref({
  ...toRefs(props.initialFilter)
})

// ❌ 错误：ref 对象响应式丢失
const bookmark = ref({ title: 'test' })
const title = bookmark.value.title // ❌ 丢失响应式

// ✅ 正确：使用 computed
const title = computed(() => bookmark.value.title)
```

### 8. Vue 宏定义顺序

```typescript
// ✅ 正确：defineOptions 必须在最前面
defineOptions({ name: 'ComponentName' })

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// ❌ 错误：defineOptions 在 defineProps 之后
const props = defineProps<Props>()
defineOptions({ name: 'ComponentName' }) // ❌ 顺序错误
```

---

## 🎨 Stylelint 规则

**⚠️ 完整规则请参考 `frontend/stylelint.config.js`（已自动加载）**

### 高频错误清单（必须避免）

#### 1. CSS 属性排序错误

**⚠️ 最常见的错误！必须严格按照以下顺序：**

```css
/* ✅ 正确的顺序 */
.element {
  /* 1. 定位 */
  position: relative;
  top: 0;
  z-index: 1;

  /* 2. 显示（⚠️ 关键：flex 在 gap 之前，justify-content 在 align-items 之前） */
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  flex: 1; /* ⚠️ flex 必须在 gap 之前 */
  justify-content: center; /* ⚠️ 必须在 align-items 之前 */
  align-items: center; /* ⚠️ 必须在 justify-content 之后 */
  gap: var(--spacing-4);

  /* 3. 盒模型（⚠️ 关键：border-width 在 border-color 之前） */
  width: 100%;
  padding: var(--spacing-4);
  border: 1px solid var(--color-border);
  border-width: 2px; /* ⚠️ 必须在 border-color 之前 */
  border-color: var(--color-primary);
  border-radius: var(--radius-md);
  outline: none; /* ⚠️ outline 必须在 background 之前 */

  /* 4. 字体（⚠️ 关键：white-space 在 text-overflow 之前） */
  font-size: var(--text-base);
  color: var(--color-text-primary);
  white-space: nowrap; /* ⚠️ 必须在 text-overflow 之前 */
  text-overflow: ellipsis;

  /* 5. 背景 */
  background-color: var(--color-surface);

  /* 6. 视觉效果 */
  opacity: 1;
  cursor: pointer;

  /* 7. 变换和动画 */
  transition: all 0.2s;
}
```

#### 2. 使用简写属性

```css
/* ❌ 错误：使用多个单独属性 */
.element {
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
}

/* ✅ 正确：使用简写属性 */
.element {
  inset: 0;
}
```

#### 3. 现代颜色函数格式

```css
/* ❌ 错误：旧格式 */
.element {
  background-color: rgba(0, 0, 0, 0.5);
  color: rgba(255, 255, 255, 0.8);
}

/* ✅ 正确：现代格式 */
.element {
  background-color: rgb(0 0 0 / 50%);
  color: rgb(255 255 255 / 80%);
}
```

#### 4. 禁止硬编码数值

```css
/* ❌ 错误：硬编码 */
.element {
  padding: 16px;
  font-size: 14px;
  color: #333;
  border-radius: 8px;
}

/* ✅ 正确：使用 CSS 变量 */
.element {
  padding: var(--spacing-4);
  font-size: var(--text-sm);
  color: var(--color-text-primary);
  border-radius: var(--radius-md);
}
```

#### 5. 交互时禁止几何变化

```css
/* ❌ 错误：改变几何属性 */
.button:hover {
  width: 120px;
  padding: 20px;
  transform: scale(1.1);
}

/* ✅ 正确：只改变视觉属性 */
.button:hover {
  opacity: 0.9;
  background-color: var(--color-primary-hover);
  box-shadow: var(--shadow-md);
}
```

### 快速示例

```css
/* ✅ 正确 */
.element {
  /* 定位 */
  position: relative;

  /* 显示（注意：justify-content 在 align-items 之前） */
  display: flex;
  justify-content: center;
  align-items: center;

  /* 盒模型 */
  padding: var(--spacing-4);

  /* 字体 */
  color: var(--color-text-primary);

  /* 背景 */
  background: var(--color-surface);
}
```

---

## 🔧 自动修复命令

### 快速修复所有问题

```bash
# 1. 自动修复 ESLint 错误
bun run lint:fix:enhanced

# 2. 自动格式化代码
bun run format

# 3. 类型检查（无法自动修复，需要手动修复）
bun run typecheck:force
```

### 分步修复

```bash
# 只修复 ESLint 错误
cd frontend && bun run lint:fix

# 只修复 Stylelint 错误
cd frontend && bun run stylelint:fix

# 只格式化代码
bun run format
```

---

## 📊 代码质量标准

### 提交前必须满足：

- ✅ TypeScript 类型检查：0 errors
- ✅ ESLint 检查：0 errors, 0 warnings
- ✅ Stylelint 检查：0 errors, 0 warnings
- ✅ Prettier 格式化：已格式化

### 允许的例外情况：

1. **Race Condition 警告**：如果确定安全，可以添加 `eslint-disable-next-line` 注释
2. **函数复杂度警告**：如果无法拆分，可以暂时保留（但应该在 TODO 中记录）
3. **嵌套深度警告**：如果无法优化，可以暂时保留（但应该在 TODO 中记录）

---

## 🚀 AI IDE 工作流程

### 编写代码时：

1. **过一遍检查清单**（20 秒）
   - 确认要遵守的关键规则
2. **编写代码**
   - 遵循所有规则
   - 特别注意高频错误清单
3. **自我检查**
   - 确认没有违反任何规则
   - 特别检查 CSS 属性顺序

4. **提交代码**
   - AI 不主动运行检查命令
   - 等待用户运行 `bun run lint:fix:enhanced`

### 用户要求检查时：

1. **运行检查**：`bun run typecheck:force && bun run lint:check:force`
2. **发现错误**：立即修复
3. **再次检查**：确认所有错误已修复

### 推荐的完整工作流程：

```bash
# 1. AI 写代码（目标：96% 正确）
# 2. 用户运行自动修复（修复剩余 4%）
bun run lint:fix:enhanced
# 3. 最终结果：100% 正确
```

---

## 📚 相关文档

- [TypeScript 严格模式配置](../../tsconfig.base.json)
- [ESLint 配置](../../eslint.config.js)
- [Prettier 配置](../../.prettierrc.json)
- [配置优化完成总结](../.kiro/CONFIGURATION-OPTIMIZATION-COMPLETE.md)

---

**最后更新**: 2026-05-20  
**版本**: 1.0.0
