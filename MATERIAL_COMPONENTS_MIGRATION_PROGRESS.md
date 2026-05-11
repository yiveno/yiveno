# Material Web Components 组件迁移进度

**最后更新**: 2025-05-11  
**当前阶段**: Phase 2 - P0 组件迁移

---

## 📊 总体进度

- **Phase 1**: ✅ 100% (7/7) - 准备和评估
- **Phase 2**: 🚧 17% (1/6) - P0 组件迁移
- **Phase 3**: ⏳ 0% (0/6) - P1 组件迁移
- **Phase 4**: ⏳ 0% (0/5) - P2 组件迁移

---

## ✅ Phase 1: 准备和评估（已完成）

- [x] 更新 Material Design Roadmap
- [x] 创建使用指南
- [x] 添加 TypeScript 类型定义
- [x] 创建统一导入文件
- [x] 安装 Material Web Components (`@material/web@2.4.1`)
- [x] 创建迁移指南
- [x] 确定迁移策略（直接使用，不创建 wrapper）

---

## 🚧 Phase 2: P0 组件迁移（进行中）

### Button → Material Web Components

**状态**: 🚧 进行中

**已迁移的页面**:
- [x] `frontend/src/pages/settings/Settings.vue` - 订阅页面的按钮

**待迁移的页面**:
- [ ] `frontend/src/pages/management/Management.vue` - 大量 Button 使用
- [ ] 其他使用 Button 的页面

**Material Web Components 对应组件**:
- `<md-filled-button>` - 替代 `<Button variant="primary">`
- `<md-outlined-button>` - 替代 `<Button variant="outline">`
- `<md-text-button>` - 替代 `<Button variant="text">` 或 `<Button variant="ghost">`
- `<md-elevated-button>` - 可选，带阴影的按钮
- `<md-tonal-button>` - 可选，柔和的按钮

**使用示例**:
```vue
<script setup>
import '@material/web/button/filled-button.js'
import '@material/web/button/outlined-button.js'
import '@material/web/button/text-button.js'
import '@material/web/icon/icon.js'
</script>

<template>
  <!-- 主要按钮 -->
  <md-filled-button @click="handleClick">
    <md-icon slot="icon">save</md-icon>
    保存
  </md-filled-button>
  
  <!-- 次要按钮 -->
  <md-outlined-button @click="handleCancel">
    取消
  </md-outlined-button>
  
  <!-- 文本按钮 -->
  <md-text-button @click="handleReset">
    重置
  </md-text-button>
</template>

<style scoped>
/* 自定义 Material Web Components 样式 */
md-filled-button {
  --md-filled-button-container-color: var(--md-sys-color-primary);
  --md-filled-button-label-text-color: var(--md-sys-color-on-primary);
  --md-filled-button-container-height: 40px;
}
</style>
```

### Input → Material Web Components

**状态**: ⏳ 未开始

**Material Web Components 对应组件**:
- `<md-filled-text-field>` - 填充样式输入框
- `<md-outlined-text-field>` - 轮廓样式输入框

### Dialog → Material Web Components

**状态**: ⏳ 未开始

**Material Web Components 对应组件**:
- `<md-dialog>` - 对话框

**注意事项**:
- 需要适配现有的 Dialog API
- 可能需要创建 wrapper 来保持 API 兼容性

### Checkbox → Material Web Components

**状态**: ⏳ 未开始

**Material Web Components 对应组件**:
- `<md-checkbox>` - 复选框

### Radio → Material Web Components

**状态**: ⏳ 未开始

**Material Web Components 对应组件**:
- `<md-radio>` - 单选按钮

### Switch → Material Web Components

**状态**: ⏳ 未开始

**Material Web Components 对应组件**:
- `<md-switch>` - 开关

---

## ⏳ Phase 3: P1 组件迁移（未开始）

- [ ] Icon Button → `<md-icon-button>`
- [ ] FAB → `<md-fab>`
- [ ] Chip → `<md-chip-set>`, `<md-filter-chip>`, `<md-input-chip>`
- [ ] Menu → `<md-menu>`, `<md-menu-item>`
- [ ] List → `<md-list>`, `<md-list-item>`
- [ ] Progress → `<md-linear-progress>`, `<md-circular-progress>`

---

## ⏳ Phase 4: P2 组件迁移（未开始）

- [ ] Tabs → `<md-tabs>`, `<md-primary-tab>`
- [ ] Slider → `<md-slider>`
- [ ] Card → 组装开发（使用 `<md-elevation>` + 自定义布局）
- [ ] Badge → 组装开发（使用 CSS + Material Design 3 规范）
- [ ] Tooltip → 组装开发（使用 `<md-elevation>` + 定位逻辑）

---

## 📝 迁移检查清单

每个组件迁移后必须确认：

- [ ] ✅ 使用 Material Web Components 官方组件（优先）
- [ ] ✅ 或使用官方组件组装（次选）
- [ ] ✅ 或完全符合 Material Design 3 规范（最后手段）
- [ ] ✅ 使用 Design Tokens（颜色、间距、字体、动画）
- [ ] ✅ 支持亮色/暗色主题
- [ ] ✅ 支持键盘导航
- [ ] ✅ 支持屏幕阅读器
- [ ] ✅ 有完整的 TypeScript 类型定义
- [ ] ✅ 功能测试通过
- [ ] ✅ 样式符合 Material Design 3 规范

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
3. **保留兼容性**: 如果需要 wrapper，保留原有 API，确保平滑过渡
4. **严格遵循规范**: 所有自定义组件必须 100% 符合 Material Design 3 规范
5. **真实环境测试**: 直接在 Chrome Extension 环境中测试，避免环境差异

---

**维护者**: AcuityBookmarks Team  
**最后更新**: 2025-05-11
