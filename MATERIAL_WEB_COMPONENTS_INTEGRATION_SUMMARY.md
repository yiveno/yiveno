# Material Web Components 与 Vue 3 集成总结

## 📋 概述

本文档记录了在 AcuityBookmarks 项目中集成 Material Web Components 的完整过程、遇到的问题和解决方案。

---

## ✅ 成功集成的组件

### 1. Switch 组件

**状态**: ✅ 完全成功

**使用方式**:
```vue
<template>
  <md-switch
    :selected="value"
    @change="handleChange"
  ></md-switch>
</template>

<script setup>
function handleChange(event: Event) {
  const target = event.target as HTMLInputElement
  value.value = target.selected
}
</script>
```

**关键点**:
- 使用 `:selected` 属性而不是 `v-model`
- 监听 `@change` 事件
- 从 `event.target.selected` 获取新值

**样式覆盖**:
```css
md-switch {
  --md-switch-selected-track-color: var(--color-primary);
  --md-switch-selected-handle-color: var(--md-sys-color-on-primary);
}
```

---

### 2. Button 组件

**状态**: ✅ 完全成功

**使用方式**:
```vue
<template>
  <md-filled-button @click="handleClick">
    按钮文本
  </md-filled-button>
</template>
```

**关键点**:
- 直接使用，无需特殊处理
- 支持 `@click` 等标准事件
- Hover 和 Ripple 效果需要确保依赖组件正确加载

---

## ⚠️ 有兼容性问题的组件

### Select 组件

**状态**: ⚠️ 需要特殊处理

**问题描述**:
- 在 Vue 模板中使用 `<md-filled-select>` 会导致运行时错误
- 错误信息: `Cannot read properties of undefined (reading 'length')`
- 错误位置: `select.js` 的 `getSelectedOptions()` 方法

**根本原因**:
Material Web Components 的 Select 组件在 `firstUpdated` 生命周期中尝试访问子元素（`md-select-option`），但 Vue 的渲染机制可能导致这些子元素在 Select 初始化时还没有完全渲染完成。

**尝试过的解决方案**:

1. ❌ **使用 `v-if` 延迟渲染**
   ```vue
   <md-filled-select v-if="ready">
     <!-- options -->
   </md-filled-select>
   ```
   - 结果：仍然报错

2. ❌ **使用 `watch` 和 `nextTick` 手动同步**
   ```typescript
   watch(selectedValue, async () => {
     await nextTick()
     selectElement.value = selectedValue.value
   })
   ```
   - 结果：仍然报错

3. ❌ **使用 Material Web Components 的 `select()` 方法**
   ```typescript
   selectElement.select(value)
   ```
   - 结果：仍然报错

4. ❌ **使用 `:selected` 响应式绑定**
   ```vue
   <md-select-option :selected="value === 'option1'">
   ```
   - 结果：导致内部状态混乱

**✅ 最终解决方案：使用纯 JavaScript 创建元素**

```typescript
function createSelectElement() {
  if (!selectContainer.value) return
  
  // 创建 select 元素
  const select = document.createElement('md-filled-select')
  
  // 创建 options
  const providers = [
    { value: 'openai', label: 'OpenAI（推荐）', selected: true },
    { value: 'claude', label: 'Anthropic Claude' },
    { value: 'gemini', label: 'Google Gemini' }
  ]
  
  providers.forEach(provider => {
    const option = document.createElement('md-select-option')
    option.setAttribute('value', provider.value)
    if (provider.selected) {
      option.setAttribute('selected', '')
    }
    
    const headline = document.createElement('div')
    headline.setAttribute('slot', 'headline')
    headline.textContent = provider.label
    
    option.appendChild(headline)
    select.appendChild(option)
  })
  
  // 监听变化
  select.addEventListener('input', (event: Event) => {
    const target = event.target as any
    selectedValue.value = target.value
  })
  
  // 添加到容器
  selectContainer.value.appendChild(select)
}

onMounted(() => {
  createSelectElement()
})
```

**模板部分**:
```vue
<template>
  <div ref="selectContainer"></div>
</template>
```

**为什么这样可以工作**:
- 使用命令式 DOM 操作，完全绕过 Vue 的模板渲染
- 子元素在 Select 元素添加到 DOM 之前就已经创建并添加
- 确保 Select 初始化时所有子元素都已经存在

---

## 🔧 配置要点

### 1. Vite 配置

**文件**: `frontend/vite/plugins.ts`

```typescript
export function createVuePlugin() {
  return vue({
    template: {
      compilerOptions: {
        // 识别 Material Web Components 自定义元素
        isCustomElement: (tag) => tag.startsWith('md-')
      }
    }
  })
}
```

**重要**: 这个配置必须在 Vite 配置中设置，而不是在 `main.ts` 中（因为我们使用 runtime-only 版本的 Vue）。

### 2. 动态导入 Material Web Components

**文件**: `frontend/src/pages/settings/main.ts`

```typescript
async function loadMaterialComponents() {
  // 先加载依赖组件（ripple, focus-ring, elevation）
  await Promise.all([
    import('@material/web/ripple/ripple.js'),
    import('@material/web/focus/md-focus-ring.js'),
    import('@material/web/elevation/elevation.js')
  ])
  
  // 再加载所有需要的组件
  const [
    { MdFilledButton },
    { MdSwitch },
    { MdFilledSelect },
    { MdSelectOption }
  ] = await Promise.all([
    import('@material/web/button/filled-button.js'),
    import('@material/web/switch/switch.js'),
    import('@material/web/select/filled-select.js'),
    import('@material/web/select/select-option.js')
  ])
  
  return { MdFilledButton, MdSwitch, MdFilledSelect, MdSelectOption }
}

// 等待 Material Web Components 加载完成
await loadMaterialComponents()
```

**为什么使用动态导入**:
- Vite 的 tree-shaking 会移除未使用的副作用导入
- 动态导入确保副作用（Web Components 注册）一定会执行
- 必须先加载依赖组件（ripple, focus-ring, elevation），再加载主组件

---

## 📊 兼容性总结

| 组件 | Vue 模板兼容性 | 推荐使用方式 | 备注 |
|------|---------------|-------------|------|
| Button | ✅ 完全兼容 | Vue 模板 | 无问题 |
| Switch | ✅ 完全兼容 | Vue 模板 | 使用 `:selected` + `@change` |
| Select | ⚠️ 有问题 | 纯 JavaScript | 必须使用命令式 DOM 操作 |
| Text Field | 🔄 未测试 | 待验证 | - |
| Checkbox | 🔄 未测试 | 待验证 | - |
| Radio | 🔄 未测试 | 待验证 | - |
| Dialog | 🔄 未测试 | 待验证 | - |

---

## 💡 最佳实践

### 1. 优先使用 Vue 模板

对于兼容性良好的组件（如 Button, Switch），优先使用 Vue 模板：

```vue
<template>
  <md-filled-button @click="handleClick">
    按钮
  </md-filled-button>
</template>
```

### 2. 对于有问题的组件，使用命令式 DOM 操作

对于有兼容性问题的组件（如 Select），使用纯 JavaScript：

```vue
<template>
  <div ref="container"></div>
</template>

<script setup>
onMounted(() => {
  const element = document.createElement('md-component')
  // 配置元素...
  container.value.appendChild(element)
})
</script>
```

### 3. 样式覆盖使用 CSS 变量

Material Web Components 使用 Shadow DOM，只能通过 CSS 变量覆盖样式：

```css
md-filled-button {
  --md-filled-button-container-color: var(--color-primary);
  --md-filled-button-label-text-color: var(--color-on-primary);
}
```

### 4. 事件处理

- 使用标准 DOM 事件（`@click`, `@change`, `@input`）
- 从 `event.target` 获取值，而不是使用 `v-model`
- 对于命令式创建的元素，使用 `addEventListener`

---

## 🚨 常见错误

### 1. 忘记配置 `isCustomElement`

**错误**: Vue 警告 "Failed to resolve component: md-filled-button"

**解决**: 在 Vite 配置中添加 `isCustomElement`

### 2. 使用静态导入

**错误**: Hover 和 Ripple 效果不工作

**解决**: 使用动态导入 `import()` 而不是静态导入 `import`

### 3. 在 Select 中使用 Vue 响应式绑定

**错误**: "Cannot read properties of undefined (reading 'length')"

**解决**: 使用纯 JavaScript 创建 Select 元素

### 4. 直接修改 Shadow DOM 样式

**错误**: 样式不生效

**解决**: 使用 CSS 变量覆盖

---

## 📚 参考资源

- [Material Web Components 官方文档](https://material-web.dev/)
- [Material Design 3 设计规范](https://m3.material.io/)
- [Vue 3 与 Web Components](https://vuejs.org/guide/extras/web-components.html)
- [Vite 配置 Vue 插件](https://github.com/vitejs/vite-plugin-vue/tree/main/packages/plugin-vue)

---

## 🎯 结论

Material Web Components 与 Vue 3 的集成总体上是可行的，但需要注意以下几点：

1. **大部分组件可以直接在 Vue 模板中使用**（Button, Switch 等）
2. **少数组件存在兼容性问题**（Select），需要使用命令式 DOM 操作
3. **必须正确配置 Vite 和动态导入**，否则会出现各种问题
4. **样式覆盖只能通过 CSS 变量**，不能直接修改 Shadow DOM

对于未来的开发：
- 优先测试组件的兼容性
- 对于有问题的组件，及时切换到命令式 DOM 操作
- 持续关注 Material Web Components 的更新，可能会修复兼容性问题

---

**最后更新**: 2026-05-12  
**版本**: 1.0.0
