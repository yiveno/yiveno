# Material Web Components 迁移总结

**日期**: 2025-05-11  
**状态**: Phase 1 完成，开始 Phase 2（组件迁移）

---

## ✅ 已完成的工作

### 1. 核心决策

- ✅ **组件库选型**: Material Web Components（Google 官方实现）
- ✅ **迁移策略**: 渐进式迁移，在项目中直接测试
- ✅ **组件开发三级原则**: 
  1. 优先使用官方组件
  2. 使用官方组件组装
  3. 自定义实现（必须 100% 符合 Material Design 3 规范）

### 2. 基础设施

- ✅ 安装 `@material/web@2.4.1`
- ✅ 添加 TypeScript 类型定义
- ✅ 创建统一导入文件
- ✅ 更新文档和指南

### 3. 第一个 Material 组件

- ✅ 创建 `ButtonMaterial.vue`
- ✅ 保留原有 API（variant、size、loading 等）
- ✅ 自动包含 Ripple 效果和 State Layer

---

## 🎯 迁移策略调整

### 原计划（已废弃）

❌ 创建单独的测试页面 `material-demo`  
❌ 在测试页面中验证所有组件  
❌ 验证完成后再迁移到实际页面

**问题**：
- 测试页面与实际环境不同（CSP、Chrome Extension API 等）
- 需要维护额外的测试页面
- 迁移完成后测试页面就没用了

### 新策略（当前）

✅ 直接在项目中创建 Material 版本组件  
✅ 在实际页面中并行测试  
✅ 确认无问题后逐步替换旧组件

**优势**：
- 在真实环境中测试
- 渐进式迁移，风险可控
- 不需要维护额外的测试页面
- 可以立即看到效果

---

## 📝 迁移步骤（标准流程）

### 1. 创建新组件

在现有组件目录中创建 Material 版本：

```
frontend/src/components/base/Button/
├── Button.vue          # 旧组件（保留）
├── ButtonMaterial.vue  # 新组件（Material Web Components）
├── Button.d.ts         # 类型定义（共享）
└── index.ts            # 导出（同时导出新旧组件）
```

### 2. 实现新组件

```vue
<script setup lang="ts">
import '@material/web/button/filled-button.js'
import type { ButtonProps } from './Button.d'

const props = withDefaults(defineProps<ButtonProps>(), {
  variant: 'primary',
  size: 'md'
})
</script>

<template>
  <md-filled-button v-bind="$attrs">
    <slot />
  </md-filled-button>
</template>
```

### 3. 在实际页面中测试

选择一个非核心页面（如 Settings）：

```vue
<script setup>
import { ButtonMaterial } from '@/components/base/Button'
</script>

<template>
  <ButtonMaterial variant="primary" @click="save">
    保存设置
  </ButtonMaterial>
</template>
```

### 4. 确认功能正常

- [ ] 点击事件正常触发
- [ ] Ripple 效果正常
- [ ] 样式符合 Material Design 3 规范
- [ ] 响应式布局正常
- [ ] 键盘导航正常
- [ ] 屏幕阅读器支持正常

### 5. 逐步替换旧组件

在其他页面中逐步替换：

```diff
- <Button variant="primary" @click="save">保存</Button>
+ <ButtonMaterial variant="primary" @click="save">保存</ButtonMaterial>
```

### 6. 删除旧组件

当所有引用都替换完成后：

```bash
# 确认所有引用都已替换
git grep "from './Button.vue'"

# 删除旧组件
rm frontend/src/components/base/Button/Button.vue

# 重命名新组件
mv frontend/src/components/base/Button/ButtonMaterial.vue \
   frontend/src/components/base/Button/Button.vue
```

---

## 📊 迁移进度

### Phase 1: 准备和评估（1 周）

**进度**: ✅ 100% (7/7)

- [x] 更新 Material Design Roadmap
- [x] 创建使用指南
- [x] 添加 TypeScript 类型定义
- [x] 创建统一导入文件
- [x] 安装 Material Web Components
- [x] 创建第一个 Material 组件
- [x] 创建迁移指南

### Phase 2: P0 组件迁移（2 周）

**进度**: 🚧 17% (1/6)

- [x] Button → 直接使用 `<md-filled-button>`, `<md-outlined-button>`, `<md-text-button>`
  - [x] Settings 页面 - 订阅按钮已迁移
  - [ ] Management 页面 - 待迁移
  - [ ] 其他页面 - 待迁移
- [ ] Input → `<md-filled-text-field>`, `<md-outlined-text-field>`
- [ ] Dialog → `<md-dialog>`
- [ ] Checkbox → `<md-checkbox>`
- [ ] Radio → `<md-radio>`
- [ ] Switch → `<md-switch>`

### Phase 3: P1 组件迁移（2 周）

**进度**: 0% (0/6)

- [ ] Icon Button → `<md-icon-button>`
- [ ] FAB → `<md-fab>`
- [ ] Chip → `<md-chip-set>`, `<md-filter-chip>`, `<md-input-chip>`
- [ ] Menu → `<md-menu>`, `<md-menu-item>`
- [ ] List → `<md-list>`, `<md-list-item>`
- [ ] Progress → `<md-linear-progress>`, `<md-circular-progress>`

### Phase 4: P2 组件迁移（2 周）

**进度**: 0% (0/5)

- [ ] Tabs → `<md-tabs>`, `<md-primary-tab>`
- [ ] Slider → `<md-slider>`
- [ ] Card → 组装开发
- [ ] Badge → 组装开发
- [ ] Tooltip → 组装开发

---

## 🎯 下一步行动

### 立即执行

1. **继续迁移 Button 组件**
   - 迁移 Management 页面的所有 Button
   - 测试所有功能
   - 确认样式正确

2. **开始迁移 Input 组件**
   - 创建使用示例
   - 在 Settings 页面中测试
   - 逐步替换其他页面

3. **制定详细迁移清单**
   - 列出所有使用 Button 的页面
   - 列出所有使用 Input 的页面
   - 制定替换顺序

---

## 📚 相关文档

- [Material Design Roadmap](./MATERIAL_DESIGN_ROADMAP.md) - 完整的落地计划
- [迁移指南](./MATERIAL_WEB_COMPONENTS_MIGRATION.md) - 详细的迁移步骤
- [组件迁移指南](./frontend/MATERIAL_COMPONENTS_MIGRATION.md) - 组件级别的迁移说明
- [使用指南](./frontend/MATERIAL_WEB_COMPONENTS_GUIDE.md) - Material Web Components 使用方法

---

## 💡 关键要点

1. **不要重复造轮子**: 优先使用 Material Web Components 官方组件
2. **渐进式迁移**: 在实际页面中并行测试，确认无问题后再替换
3. **保留兼容性**: 新组件保留原有 API，确保平滑过渡
4. **严格遵循规范**: 所有自定义组件必须 100% 符合 Material Design 3 规范
5. **真实环境测试**: 直接在 Chrome Extension 环境中测试，避免环境差异

---

**维护者**: AcuityBookmarks Team  
**最后更新**: 2025-05-11

