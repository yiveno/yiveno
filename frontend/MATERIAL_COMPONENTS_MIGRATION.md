# Material Web Components 组件迁移指南

## 📋 迁移策略

我们采用**直接替换**策略：

1. **直接使用 Material Web Components**：不创建 wrapper，直接在页面中使用
2. **按需导入**：只导入需要的组件
3. **渐进式替换**：逐步替换现有组件的引用

---

## ✅ 迁移示例

### Button

**旧代码**:

```vue
<script setup>
import { Button } from '@/components/base/Button'
</script>

<template>
  <Button variant="primary" @click="save">保存</Button>
  <Button variant="outline" @click="cancel">取消</Button>
</template>
```

**新代码**:

```vue
<script setup>
// 直接导入 Material Web Components
import '@material/web/button/filled-button.js'
import '@material/web/button/outlined-button.js'
</script>

<template>
  <!-- 直接使用，不需要 wrapper -->
  <md-filled-button @click="save">保存</md-filled-button>
  <md-outlined-button @click="cancel">取消</md-outlined-button>
</template>
```

**API 对比**:

| 旧组件                         | Material Web Components               | 说明                               |
| ------------------------------ | ------------------------------------- | ---------------------------------- |
| `<Button variant="primary">`   | `<md-filled-button>`                  | Filled 按钮                        |
| `<Button variant="secondary">` | `<md-filled-button>`                  | Filled 按钮（可用 CSS 自定义颜色） |
| `<Button variant="outline">`   | `<md-outlined-button>`                | Outlined 按钮                      |
| `<Button variant="text">`      | `<md-text-button>`                    | Text 按钮                          |
| `<Button variant="ghost">`     | `<md-text-button>`                    | Text 按钮                          |
| `<Button icon-left="save">`    | `<md-icon slot="icon">save</md-icon>` | 图标                               |
| `<Button :loading="true">`     | 需要自己实现 loading 状态             | 可用 `<md-circular-progress>`      |

**优势**:

- ✅ 自动包含 Ripple 效果
- ✅ 自动包含 State Layer（hover、focus、pressed）
- ✅ 自动应用 Material Design 3 规范
- ✅ 更好的可访问性（WCAG 2.1 AA）
- ✅ 更小的包体积（按需加载）
- ✅ 不需要维护 wrapper 代码

---

## 🚧 待迁移的组件

### P0 组件（优先级最高）

- [ ] **Input** → `<md-filled-text-field>`, `<md-outlined-text-field>`
- [ ] **Dialog** → `<md-dialog>`（需要适配现有的 Dialog API）
- [ ] **Checkbox** → `<md-checkbox>`
- [ ] **Switch** → `<md-switch>`

### P1 组件

- [ ] **Icon** → `<md-icon>`（需要适配 Lucide Icons）
- [ ] **List** → `<md-list>`, `<md-list-item>`
- [ ] **ProgressBar** → `<md-linear-progress>`, `<md-circular-progress>`
- [ ] **Dropdown** → `<md-menu>`, `<md-menu-item>`

### P2 组件（可选）

- [ ] **Badge** → 组装开发（使用 Material Design 3 规范）
- [ ] **Tooltip** → 组装开发（使用 `<md-elevation>` + 定位逻辑）
- [ ] **Avatar** → 保留现有实现（Material Web Components 不提供）

---

## 📝 迁移步骤（以 Button 为例）

### 1. 创建新组件

```bash
# 在现有组件目录中创建 Material 版本
frontend/src/components/base/Button/ButtonMaterial.vue
```

### 2. 实现新组件

```vue
<script setup lang="ts">
import '@material/web/button/filled-button.js'
import '@material/web/button/outlined-button.js'
import '@material/web/button/text-button.js'

// 保留原有的 Props 接口
import type { ButtonProps } from './Button.d'

const props = withDefaults(defineProps<ButtonProps>(), {
  variant: 'primary',
  size: 'md'
})
</script>

<template>
  <md-filled-button v-if="variant === 'primary'" v-bind="$attrs">
    <slot />
  </md-filled-button>

  <md-outlined-button v-else-if="variant === 'outline'" v-bind="$attrs">
    <slot />
  </md-outlined-button>

  <md-text-button v-else v-bind="$attrs">
    <slot />
  </md-text-button>
</template>
```

### 3. 在实际页面中测试

选择一个非核心页面（如 Settings）进行测试：

```vue
<script setup>
// 导入新组件
import { ButtonMaterial } from '@/components/base/Button'
</script>

<template>
  <div class="settings-page">
    <!-- 使用新组件 -->
    <ButtonMaterial variant="primary" @click="save"> 保存设置 </ButtonMaterial>
  </div>
</template>
```

### 4. 确认功能正常

- [ ] 点击事件正常触发
- [ ] Ripple 效果正常
- [ ] 样式符合 Material Design 3 规范
- [ ] 响应式布局正常
- [ ] 键盘导航正常（Tab、Enter）
- [ ] 屏幕阅读器支持正常

### 5. 逐步替换旧组件

在其他页面中逐步替换：

```vue
<!-- 旧代码 -->
<Button variant="primary" @click="save">保存</Button>

<!-- 新代码 -->
<ButtonMaterial variant="primary" @click="save">保存</ButtonMaterial>
```

### 6. 更新导出

当所有引用都替换完成后，更新组件导出：

```typescript
// frontend/src/components/base/Button/index.ts

// 旧导出（保留一段时间，确保没有遗漏）
export { default as Button } from './Button.vue'

// 新导出
export { default as ButtonMaterial } from './ButtonMaterial.vue'

// 最终：删除旧组件，重命名新组件
export { default as Button } from './ButtonMaterial.vue'
```

### 7. 删除旧组件

```bash
# 确认所有引用都已替换
git grep "from './Button.vue'"

# 删除旧组件
rm frontend/src/components/base/Button/Button.vue
```

---

## 🎯 组件开发三级原则

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
<style scoped>
.md-custom-component {
  /* ✅ 使用 Design Tokens */
  background-color: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  padding: var(--md-sys-spacing-md);
  border-radius: var(--md-sys-shape-corner-medium);

  /* ✅ 使用 Material Design 3 动画 */
  transition: all var(--md-sys-motion-duration-short2)
    var(--md-sys-motion-easing-standard);
}

/* ✅ 必须实现 State Layer */
.md-custom-component::before {
  content: '';
  position: absolute;
  inset: 0;
  background-color: currentColor;
  opacity: 0;
  transition: opacity var(--md-sys-motion-duration-short2)
    var(--md-sys-motion-easing-standard);
}

.md-custom-component:hover::before {
  opacity: var(--md-sys-state-hover-opacity);
}
</style>
```

---

## 📚 参考资源

- [Material Web Components 官方文档](https://github.com/material-components/material-web)
- [Material Design 3 规范](https://m3.material.io/)
- [Material Web Components 使用指南](./MATERIAL_WEB_COMPONENTS_GUIDE.md)
- [完整产品文档 v3.0](../../docs/product/AcuityBookmarks-产品文档-v3.0.md)（仓库唯一规格正文）

---

**最后更新**: 2025-05-11  
**维护者**: AcuityBookmarks Team
