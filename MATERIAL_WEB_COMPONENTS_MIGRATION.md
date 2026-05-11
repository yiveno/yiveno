# Material Web Components 迁移指南

本文档记录了 AcuityBookmarks 项目从自研组件库迁移到 Material Web Components 的完整过程。

---

## 📋 目录

1. [为什么迁移](#为什么迁移)
2. [已完成的工作](#已完成的工作)
3. [下一步行动](#下一步行动)
4. [迁移计划](#迁移计划)
5. [组件开发三级原则](#组件开发三级原则)

---

## 为什么迁移

### 核心原因

1. **专注核心功能**：AcuityBookmarks 是工具类产品，核心是**高效、简洁、提高用户效率**，而不是 UI 特色
2. **不要重复造轮子**：Material Design 组件更专业、更可靠，考虑了可访问性、国际化、边界情况
3. **Google 官方实现**：Material Web Components 是 Google 官方实现，100% 符合 Material Design 3 规范
4. **持续维护**：跟随 Material Design 3 演进，自动获得新特性和 bug 修复
5. **体积可控**：按需加载，适合 Chrome Extension

### 核心价值

- ✅ **专注核心功能**：不需要维护组件库，专注书签管理核心功能
- ✅ **专业可靠**：Google 官方实现，质量有保证
- ✅ **持续更新**：跟随 Material Design 3 演进
- ✅ **完善的可访问性**：符合 WCAG 2.1 AA 标准
- ✅ **体积可控**：按需加载，适合 Chrome Extension

---

## 已完成的工作

### 1. 更新 Material Design Roadmap

✅ **文件**: `MATERIAL_DESIGN_ROADMAP.md`

**更新内容**：
- 明确了组件库选型：Material Web Components（Google 官方）
- 定义了组件开发三级原则
- 更新了技术方案和组件库架构
- 更新了 Phase 2 的迁移计划
- 更新了组件分类和实施策略

### 2. 创建使用指南

✅ **文件**: `frontend/MATERIAL_WEB_COMPONENTS_GUIDE.md`

**包含内容**：
- 安装说明
- 基础使用
- 组件开发三级原则
- 常用组件示例
- 主题定制
- TypeScript 支持
- 最佳实践

### 3. 添加 TypeScript 类型定义

✅ **文件**: `frontend/src/types/material-web.d.ts`

**包含类型**：
- 所有 Material Web Components 的类型定义
- 支持 TypeScript 自动补全和类型检查

### 4. 创建统一导入文件

✅ **文件**: `frontend/src/components/material/index.ts`

**功能**：
- 统一导入所有 Material Web Components
- 支持按需导入和统一导入两种方式

### 5. 安装 Material Web Components

✅ **命令**: `bun add @material/web`

**状态**: 已完成（@material/web@2.4.1）

### 6. 创建第一个 Material 组件

✅ **文件**: `frontend/src/components/base/Button/ButtonMaterial.vue`

**功能**：
- 使用 Material Web Components 实现 Button
- 保留原有 API（variant、size、loading 等）
- 自动包含 Ripple 效果和 State Layer

### 7. 创建迁移指南

✅ **文件**: `frontend/MATERIAL_COMPONENTS_MIGRATION.md`

**功能**：
- 详细的迁移步骤
- 组件对比表
- 最佳实践

---

## 下一步行动

### 立即执行（本周）

1. **✅ 安装 Material Web Components**
   ```bash
   cd frontend
   bun add @material/web
   ```
   **状态**: 已完成（@material/web@2.4.1）

2. **✅ 创建第一个 Material 组件**
   - 已创建 `ButtonMaterial.vue`
   - 保留原有 API，确保兼容性

3. **在实际页面中测试**
   - 选择一个非核心页面（如 Settings）
   - 替换现有 Button 为 ButtonMaterial
   - 测试功能和样式

4. **制定详细迁移清单**
   - 列出所有需要迁移的组件
   - 评估每个组件的迁移难度
   - 制定优先级

### 短期目标（2-4 周）

1. **迁移 P0 组件**
   - Button → `<md-filled-button>`, `<md-outlined-button>`, `<md-text-button>`
   - Input → `<md-filled-text-field>`, `<md-outlined-text-field>`
   - Dialog → `<md-dialog>`
   - Checkbox → `<md-checkbox>`
   - Radio → `<md-radio>`
   - Switch → `<md-switch>`

2. **更新现有页面**
   - 逐步替换现有组件
   - 测试功能完整性
   - 确保样式一致性

### 中期目标（4-8 周）

1. **迁移 P1 组件**
   - Icon Button → `<md-icon-button>`
   - FAB → `<md-fab>`
   - Chip → `<md-chip-set>`, `<md-filter-chip>`, `<md-input-chip>`
   - Menu → `<md-menu>`, `<md-menu-item>`
   - List → `<md-list>`, `<md-list-item>`
   - Progress → `<md-linear-progress>`, `<md-circular-progress>`

2. **迁移 P2 组件**
   - Tabs → `<md-tabs>`, `<md-primary-tab>`
   - Slider → `<md-slider>`
   - Card → 组装开发
   - Badge → 组装开发
   - Tooltip → 组装开发

### 长期目标（8-12 周）

1. **清理旧组件**
   - 删除被替换的旧组件
   - 更新文档
   - 更新测试

2. **性能优化**
   - 按需加载优化
   - Tree Shaking 优化
   - 包大小分析

---

## 迁移计划

### Phase 1: 准备和评估（1 周）

**任务**：
- [x] 更新 Material Design Roadmap
- [x] 创建示例页面
- [x] 创建使用指南
- [x] 添加 TypeScript 类型定义
- [x] 创建统一导入文件
- [x] 安装 Material Web Components
- [ ] 测试示例页面
- [ ] 制定详细迁移清单

### Phase 2: P0 组件迁移（2 周）

**目标组件**：
- [ ] Button
- [ ] Input
- [ ] Dialog
- [ ] Checkbox
- [ ] Radio
- [ ] Switch

**迁移步骤**（每个组件）：
1. 创建新组件（使用 Material Web Components）
2. 更新引用该组件的页面
3. 测试功能完整性
4. 删除旧组件
5. 更新文档

### Phase 3: P1 组件迁移（2 周）

**目标组件**：
- [ ] Icon Button
- [ ] FAB
- [ ] Chip
- [ ] Menu
- [ ] List
- [ ] Progress

### Phase 4: P2 组件迁移（2 周）

**目标组件**：
- [ ] Tabs
- [ ] Slider
- [ ] Card（组装开发）
- [ ] Badge（组装开发）
- [ ] Tooltip（组装开发）

### Phase 5: 清理和优化（1 周）

**任务**：
- [ ] 删除所有旧组件
- [ ] 更新所有文档
- [ ] 性能优化
- [ ] 包大小分析
- [ ] 最终测试

---

## 组件开发三级原则

### 原则 1：优先使用 Material Web Components 官方组件

```vue
<script setup>
import '@material/web/button/filled-button.js'
</script>

<template>
  <!-- ✅ 正确：直接使用官方组件 -->
  <md-filled-button @click="handleClick">
    提交
  </md-filled-button>
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
<script setup>
// 必须使用 Material Design 3 的所有规范
</script>

<template>
  <div class="md-custom-component">
    <!-- 必须符合 Material Design 3 规范 -->
  </div>
</template>

<style scoped>
.md-custom-component {
  /* ✅ 使用 Design Tokens */
  background-color: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  padding: var(--md-sys-spacing-md);
  border-radius: var(--md-sys-shape-corner-medium);
  
  /* ✅ 使用 Material Design 3 动画 */
  transition: all var(--md-sys-motion-duration-short2) var(--md-sys-motion-easing-standard);
}

/* ✅ 必须实现 State Layer */
.md-custom-component::before {
  content: '';
  position: absolute;
  inset: 0;
  background-color: currentColor;
  opacity: 0;
  transition: opacity var(--md-sys-motion-duration-short2) var(--md-sys-motion-easing-standard);
}

.md-custom-component:hover::before {
  opacity: var(--md-sys-state-hover-opacity);
}
</style>
```

### 绝对禁止

- ❌ 自定义组件与 Material Design 3 规范不一致
- ❌ 硬编码颜色、间距、字号（必须使用 Design Tokens）
- ❌ 自定义动画时长和缓动函数（必须使用 Material Design 3 标准）
- ❌ 忽略 State Layer、Ripple Effect、Elevation 等 Material Design 3 特性

---

## 参考资源

- [Material Web Components 官方文档](https://github.com/material-components/material-web)
- [Material Design 3 规范](https://m3.material.io/)
- [Material Design Roadmap](./MATERIAL_DESIGN_ROADMAP.md)
- [Material Web Components 使用指南](./frontend/MATERIAL_WEB_COMPONENTS_GUIDE.md)
- [Design Tokens 文档](./packages/design-tokens/README.md)

---

**最后更新**: 2025-05-11  
**维护者**: AcuityBookmarks Team
