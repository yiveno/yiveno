# Material Web Components 集成解决方案

## 问题描述

在 AcuityBookmarks 项目中集成 Material Web Components 时，遇到了 **hover 和 ripple 效果不工作** 的问题。

## 问题表现

- ✅ 按钮正常显示，颜色正确
- ❌ 鼠标悬停时没有颜色变化（hover 效果）
- ❌ 点击时没有水波纹动画（ripple 效果）

## 根本原因

**Material Web Components 的依赖组件（`md-ripple`、`md-focus-ring`、`md-elevation`）没有被注册为 Web Components。**

### 技术细节

1. **副作用导入被 Vite 优化掉了**
   - Material Web Components 使用副作用导入来注册组件：
     ```javascript
     import '../../ripple/ripple.js'  // 副作用导入
     ```
   - Vite 的 tree-shaking 和代码分割会移除"未使用"的副作用导入
   - 虽然 `button.js` 导入了 `ripple.js`，但 Vite 认为它没有被使用

2. **静态导入不够**
   - 即使使用静态导入：
     ```javascript
     import '@material/web/ripple/ripple.js'
     ```
   - Vite 在预构建阶段仍然会优化掉这些导入

3. **诊断过程**
   - 通过 `customElements.get('md-ripple')` 发现组件未注册
   - `md-ripple` 元素只是普通的 `HTMLElement`，没有 Shadow Root
   - 样式表存在但组件功能不工作

## 解决方案

**使用动态导入（`import()`）确保副作用执行：**

```typescript
// frontend/src/pages/settings/main.ts

async function loadMaterialComponents() {
  // 先加载依赖组件（ripple, focus-ring, elevation）
  await Promise.all([
    import('@material/web/ripple/ripple.js'),
    import('@material/web/focus/md-focus-ring.js'),
    import('@material/web/elevation/elevation.js')
  ])
  
  // 再加载按钮组件
  const [
    { MdFilledButton },
    { MdOutlinedButton },
    { MdTextButton },
    { MdIcon }
  ] = await Promise.all([
    import('@material/web/button/filled-button.js'),
    import('@material/web/button/outlined-button.js'),
    import('@material/web/button/text-button.js'),
    import('@material/web/icon/icon.js')
  ])
  
  return { MdFilledButton, MdOutlinedButton, MdTextButton, MdIcon }
}

// 等待 Material Web Components 加载完成
const materialComponents = await loadMaterialComponents()

// 验证组件是否已注册
if (typeof customElements !== 'undefined') {
  logger.info('Settings', 'Material Web', 'Components loaded', {
    'md-ripple': !!customElements.get('md-ripple'),
    'md-focus-ring': !!customElements.get('md-focus-ring'),
    'md-elevation': !!customElements.get('md-elevation')
  })
}
```

### 为什么动态导入有效？

1. **动态导入不会被 tree-shake**
   - Vite 无法静态分析动态导入的依赖关系
   - 所有副作用都会被保留

2. **保证执行顺序**
   - 先加载依赖组件（ripple, focus-ring, elevation）
   - 再加载按钮组件
   - 确保所有组件都正确注册

3. **副作用一定会执行**
   - Web Components 的 `customElement.define()` 调用会执行
   - 组件被正确注册到 `customElements` 注册表

## 验证方法

```javascript
// 检查组件是否已注册
console.log('md-ripple:', customElements.get('md-ripple'))
console.log('md-focus-ring:', customElements.get('md-focus-ring'))
console.log('md-elevation:', customElements.get('md-elevation'))

// 应该输出：
// md-ripple: class extends Do{}
// md-focus-ring: class extends Io{}
// md-elevation: class extends vo{}
```

## 使用示例

```vue
<template>
  <md-filled-button @click="handleClick">
    <md-icon slot="icon">open_in_new</md-icon>
    点击我
  </md-filled-button>
</template>

<style scoped>
/* 自定义颜色 */
md-filled-button {
  --md-sys-color-primary: var(--color-primary);
  --md-sys-color-on-primary: #ffffff;
}
</style>
```

## 注意事项

1. **必须使用动态导入**
   - 不要使用静态导入 `import '@material/web/ripple/ripple.js'`
   - 必须使用 `import('@material/web/ripple/ripple.js')`

2. **加载顺序很重要**
   - 先加载依赖组件（ripple, focus-ring, elevation）
   - 再加载按钮组件
   - 最后初始化 Vue 应用

3. **Vue 配置**
   - 必须配置 `isCustomElement` 识别 `md-` 开头的标签：
     ```typescript
     app.config.compilerOptions.isCustomElement = (tag) => tag.startsWith('md-')
     ```

4. **不需要额外的 CSS**
   - Material Web Components 的样式在 Shadow DOM 内部
   - 只需要通过 CSS 变量自定义颜色

## 相关文件

- `frontend/src/pages/settings/main.ts` - Material Web Components 加载逻辑
- `frontend/src/pages/settings/Settings.vue` - 使用示例
- `frontend/vite.config.ts` - Vite 配置（不需要特殊配置）

## 参考资料

- [Material Web Components 官方文档](https://material-web.dev/)
- [Vite Tree Shaking 文档](https://vitejs.dev/guide/features.html#tree-shaking)
- [Web Components 规范](https://developer.mozilla.org/en-US/docs/Web/Web_Components)

---

**最后更新**: 2026-05-11  
**问题状态**: ✅ 已解决
