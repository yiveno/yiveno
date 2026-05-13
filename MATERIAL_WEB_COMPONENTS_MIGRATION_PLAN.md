# Material Web Components 全面替换计划（直接使用策略）

**目标**：全面拥抱 Material Design，直接使用 Material Web Components

**原则**：
1. **直接使用** Material Web Components 原生组件（不创建封装层）
2. 通过全局样式文件统一配置
3. 保持 Material Design 3 设计规范
4. 利用 `@acuity-bookmarks/design-tokens` 统一样式

**为什么不封装**：
- ✅ Material Web Components API 已经很好用
- ✅ 减少一层抽象，代码更简单
- ✅ `design-tokens` 已经提供了足够的抽象保护
- ✅ 全局样式文件统一管理样式

---

## 📊 当前状态分析

### ✅ 已使用 Material Web Components

| 组件 | 使用位置 | 状态 |
|------|---------|------|
| `md-switch` | NotificationSettings.vue | ✅ 已使用 |
| `md-slider` | NotificationSettings.vue | ✅ 已使用 |
| `md-filled-button` | AISettings.vue, ShortcutSettings.vue | ✅ 已使用 |
| `md-text-button` | AISettings.vue | ✅ 已使用 |

### 🔄 需要替换的自定义组件

#### 1. Base Components (基础组件)

| 自定义组件 | Material Web 替代 | 优先级 | 复杂度 |
|-----------|------------------|--------|--------|
| **Button** | `md-filled-button`, `md-outlined-button`, `md-text-button` | 🔴 高 | 🟢 低 |
| **Input** | `md-filled-text-field`, `md-outlined-text-field` | 🔴 高 | 🟡 中 |
| **Switch** | `md-switch` | ✅ 已完成 | - |
| **Tooltip** | 自定义（Material Web 无） | 🟡 中 | 🟢 低 |
| **Divider** | `md-divider` | 🟢 低 | 🟢 低 |
| **Badge** | `md-badge` | 🟡 中 | 🟢 低 |
| **Spinner** | `md-circular-progress` | 🟡 中 | 🟢 低 |
| **ProgressBar** | `md-linear-progress` | 🟡 中 | 🟢 低 |
| **List** | `md-list`, `md-list-item` | 🔴 高 | 🟡 中 |
| **ListItem** | `md-list-item` | 🔴 高 | 🟡 中 |
| **Dropdown** | `md-menu` | 🟡 中 | 🟡 中 |
| **ContextMenu** | `md-menu` | 🟡 中 | 🟡 中 |
| **Accordion** | 自定义（基于 Material 组装） | 🟢 低 | 🟡 中 |
| **Avatar** | 自定义（Material Web 无） | 🟢 低 | 🟢 低 |
| **Grid** | CSS Grid（保留） | - | - |
| **Spacer** | CSS（保留） | - | - |
| **Overlay** | CSS（保留） | - | - |
| **Icon** | `md-icon` | 🟡 中 | 🟢 低 |
| **LucideIcon** | 保留（与 md-icon 配合） | - | - |
| **SvgIcon** | 保留（与 md-icon 配合） | - | - |
| **EmojiIcon** | 保留（特殊用途） | - | - |

#### 2. Composite Components (复合组件)

| 自定义组件 | Material Web 替代方案 | 优先级 | 复杂度 |
|-----------|---------------------|--------|--------|
| **Dialog** | `md-dialog` | 🔴 高 | 🟡 中 |
| **ConfirmableDialog** | `md-dialog` + 自定义逻辑 | 🔴 高 | 🟡 中 |
| **Card** | `md-elevated-card`, `md-filled-card`, `md-outlined-card` | 🟡 中 | 🟢 低 |
| **Chip** | `md-filter-chip`, `md-input-chip`, `md-assist-chip` | 🟡 中 | 🟢 低 |
| **Checkbox** | `md-checkbox` | 🔴 高 | 🟢 低 |
| **Alert** | 自定义（基于 Material 组装） | 🟡 中 | 🟡 中 |
| **Tabs** | `md-tabs`, `md-primary-tab`, `md-secondary-tab` | 🟡 中 | 🟡 中 |
| **EmptyState** | 自定义（基于 Material 组装） | 🟢 低 | 🟢 低 |
| **Notification** | 自定义（Material Web 无 Snackbar） | 🟡 中 | 🟡 中 |
| **ThemeToggle** | `md-icon-button` + 自定义逻辑 | 🟢 低 | 🟢 低 |
| **LanguageToggle** | `md-menu` + `md-menu-item` | 🟢 低 | 🟢 低 |
| **UserMenu** | `md-menu` + `md-menu-item` | 🟢 低 | 🟢 低 |
| **AppHeader** | 自定义（基于 Material 组装） | 🟢 低 | 🟡 中 |
| **UrlInput** | `md-filled-text-field` + 验证逻辑 | 🟡 中 | 🟡 中 |

#### 3. Business Components (业务组件)

| 业务组件 | 处理方式 | 优先级 |
|---------|---------|--------|
| **BookmarkTree** | 基于 `md-list` 重构 | 🔴 高 |
| **BookmarkSearchInput** | 基于 `md-filled-text-field` 重构 | 🔴 高 |
| **QuickAddBookmarkDialog** | 基于 `md-dialog` 重构 | 🔴 高 |
| **ShareDialog** | 基于 `md-dialog` 重构 | 🟡 中 |
| **SyncProgressDialog** | 基于 `md-dialog` + `md-linear-progress` 重构 | 🟡 中 |
| **GlobalQuickAddBookmark** | 基于 Material 组件重构 | 🟡 中 |
| **GlobalSyncProgress** | 基于 `md-linear-progress` 重构 | 🟡 中 |
| **BookmarkRecommendations** | 基于 `md-card` + `md-list` 重构 | 🟢 低 |

---

## 🎯 Material Web Components 完整清单

### 可直接使用的组件

| 组件 | 用途 | 文档 |
|------|------|------|
| **Buttons** | | |
| `md-filled-button` | 主要操作按钮 | [Docs](https://material-web.dev/components/button/) |
| `md-outlined-button` | 次要操作按钮 | [Docs](https://material-web.dev/components/button/) |
| `md-text-button` | 文本按钮 | [Docs](https://material-web.dev/components/button/) |
| `md-elevated-button` | 浮起按钮 | [Docs](https://material-web.dev/components/button/) |
| `md-tonal-button` | 色调按钮 | [Docs](https://material-web.dev/components/button/) |
| `md-icon-button` | 图标按钮 | [Docs](https://material-web.dev/components/icon-button/) |
| `md-filled-icon-button` | 填充图标按钮 | [Docs](https://material-web.dev/components/icon-button/) |
| `md-filled-tonal-icon-button` | 色调图标按钮 | [Docs](https://material-web.dev/components/icon-button/) |
| `md-outlined-icon-button` | 轮廓图标按钮 | [Docs](https://material-web.dev/components/icon-button/) |
| **FAB** | | |
| `md-fab` | 浮动操作按钮 | [Docs](https://material-web.dev/components/fab/) |
| `md-branded-fab` | 品牌 FAB | [Docs](https://material-web.dev/components/fab/) |
| **Text Fields** | | |
| `md-filled-text-field` | 填充文本框 | [Docs](https://material-web.dev/components/text-field/) |
| `md-outlined-text-field` | 轮廓文本框 | [Docs](https://material-web.dev/components/text-field/) |
| **Selection** | | |
| `md-checkbox` | 复选框 | [Docs](https://material-web.dev/components/checkbox/) |
| `md-radio` | 单选按钮 | [Docs](https://material-web.dev/components/radio/) |
| `md-switch` | 开关 | [Docs](https://material-web.dev/components/switch/) |
| `md-slider` | 滑块 | [Docs](https://material-web.dev/components/slider/) |
| **Chips** | | |
| `md-assist-chip` | 辅助芯片 | [Docs](https://material-web.dev/components/chip/) |
| `md-filter-chip` | 筛选芯片 | [Docs](https://material-web.dev/components/chip/) |
| `md-input-chip` | 输入芯片 | [Docs](https://material-web.dev/components/chip/) |
| `md-suggestion-chip` | 建议芯片 | [Docs](https://material-web.dev/components/chip/) |
| **Dialog** | | |
| `md-dialog` | 对话框 | [Docs](https://material-web.dev/components/dialog/) |
| **Lists** | | |
| `md-list` | 列表容器 | [Docs](https://material-web.dev/components/list/) |
| `md-list-item` | 列表项 | [Docs](https://material-web.dev/components/list/) |
| **Menu** | | |
| `md-menu` | 菜单 | [Docs](https://material-web.dev/components/menu/) |
| `md-menu-item` | 菜单项 | [Docs](https://material-web.dev/components/menu/) |
| `md-sub-menu` | 子菜单 | [Docs](https://material-web.dev/components/menu/) |
| **Progress** | | |
| `md-circular-progress` | 圆形进度 | [Docs](https://material-web.dev/components/progress/) |
| `md-linear-progress` | 线性进度 | [Docs](https://material-web.dev/components/progress/) |
| **Cards** | | |
| `md-elevated-card` | 浮起卡片 | [Docs](https://material-web.dev/components/card/) |
| `md-filled-card` | 填充卡片 | [Docs](https://material-web.dev/components/card/) |
| `md-outlined-card` | 轮廓卡片 | [Docs](https://material-web.dev/components/card/) |
| **Tabs** | | |
| `md-tabs` | 标签页容器 | [Docs](https://material-web.dev/components/tabs/) |
| `md-primary-tab` | 主标签页 | [Docs](https://material-web.dev/components/tabs/) |
| `md-secondary-tab` | 次标签页 | [Docs](https://material-web.dev/components/tabs/) |
| **Divider** | | |
| `md-divider` | 分隔线 | [Docs](https://material-web.dev/components/divider/) |
| **Icon** | | |
| `md-icon` | 图标 | [Docs](https://material-web.dev/components/icon/) |
| **Ripple** | | |
| `md-ripple` | 涟漪效果 | [Docs](https://material-web.dev/components/ripple/) |
| **Elevation** | | |
| `md-elevation` | 高度阴影 | [Docs](https://material-web.dev/components/elevation/) |
| **Focus Ring** | | |
| `md-focus-ring` | 焦点环 | [Docs](https://material-web.dev/components/focus-ring/) |

### Material Web 缺失的组件（需要自定义）

| 组件类型 | 解决方案 |
|---------|---------|
| **Tooltip** | 自定义实现（使用 Popover API） |
| **Snackbar/Toast** | 自定义实现（基于 Material Design 规范） |
| **Avatar** | 自定义实现（简单的圆形图片容器） |
| **Accordion** | 基于 `md-list` + 自定义展开逻辑 |
| **Stepper** | 基于 Material 组件组装 |
| **Bottom Sheet** | 基于 `md-dialog` 自定义样式 |
| **Navigation Drawer** | 自定义实现 |
| **App Bar** | 自定义实现 |
| **Badge** | 自定义实现（简单的绝对定位元素） |

---

## 📋 分阶段替换计划

### Phase 1: 高频基础组件（2-3 周）

**目标**：替换最常用的基础组件

#### 1.1 Button 组件替换
- [ ] 创建 Material Button 封装组件
- [ ] 全局搜索替换 `<Button>` → `<md-filled-button>` 等
- [ ] 更新所有使用 Button 的页面
- [ ] 删除旧的 Button 组件

#### 1.2 Input 组件替换
- [ ] 创建 Material TextField 封装组件
- [ ] 全局搜索替换 `<Input>` → `<md-filled-text-field>`
- [ ] 更新表单验证逻辑
- [ ] 删除旧的 Input 组件

#### 1.3 Checkbox 组件替换
- [ ] 全局搜索替换 `<Checkbox>` → `<md-checkbox>`
- [ ] 更新事件处理逻辑
- [ ] 删除旧的 Checkbox 组件

#### 1.4 List 组件替换
- [ ] 创建 Material List 封装组件
- [ ] 全局搜索替换 `<List>` → `<md-list>`
- [ ] 全局搜索替换 `<ListItem>` → `<md-list-item>`
- [ ] 删除旧的 List 组件

### Phase 2: 对话框和菜单（1-2 周）

#### 2.1 Dialog 组件替换
- [ ] 创建 Material Dialog 封装组件
- [ ] 全局搜索替换 `<Dialog>` → `<md-dialog>`
- [ ] 更新 ConfirmableDialog 基于 `md-dialog`
- [ ] 删除旧的 Dialog 组件

#### 2.2 Menu 组件替换
- [ ] 创建 Material Menu 封装组件
- [ ] 替换 Dropdown → `md-menu`
- [ ] 替换 ContextMenu → `md-menu`
- [ ] 删除旧的 Dropdown 和 ContextMenu 组件

### Phase 3: 卡片和芯片（1 周）

#### 3.1 Card 组件替换
- [ ] 全局搜索替换 `<Card>` → `<md-elevated-card>`
- [ ] 删除旧的 Card 组件

#### 3.2 Chip 组件替换
- [ ] 全局搜索替换 `<Chip>` → `<md-filter-chip>` 等
- [ ] 删除旧的 Chip 组件

### Phase 4: 进度和反馈（1 周）

#### 4.1 Progress 组件替换
- [ ] 替换 Spinner → `md-circular-progress`
- [ ] 替换 ProgressBar → `md-linear-progress`
- [ ] 删除旧的 Spinner 和 ProgressBar 组件

#### 4.2 其他组件
- [ ] 替换 Divider → `md-divider`
- [ ] 替换 Badge → `md-badge`（如果需要）

### Phase 5: 业务组件重构（2-3 周）

#### 5.1 BookmarkTree 重构
- [ ] 基于 `md-list` 重构树形结构
- [ ] 保持虚拟滚动性能
- [ ] 测试 2 万书签性能

#### 5.2 搜索和对话框重构
- [ ] BookmarkSearchInput 基于 `md-filled-text-field`
- [ ] QuickAddBookmarkDialog 基于 `md-dialog`
- [ ] ShareDialog 基于 `md-dialog`
- [ ] SyncProgressDialog 基于 `md-dialog` + `md-linear-progress`

### Phase 6: 自定义组件优化（1-2 周）

#### 6.1 保留但优化的组件
- [ ] Tooltip - 基于 Popover API 重构
- [ ] Notification - 基于 Material Design 规范重构
- [ ] Avatar - 简化实现
- [ ] EmptyState - 基于 Material 组件组装

#### 6.2 清理工作
- [ ] 删除所有未使用的旧组件
- [ ] 更新组件文档
- [ ] 更新 Storybook（如果有）

---

## 🛠️ 技术实施指南

### 1. 组件封装模式

```vue
<!-- frontend/src/components/material/MaterialButton.vue -->
<script setup lang="ts">
import { defineOptions } from 'vue'
import '@material/web/button/filled-button'
import '@material/web/button/outlined-button'
import '@material/web/button/text-button'

defineOptions({
  name: 'MaterialButton'
})

interface Props {
  variant?: 'filled' | 'outlined' | 'text' | 'elevated' | 'tonal'
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'filled',
  disabled: false,
  type: 'button'
})

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()
</script>

<template>
  <md-filled-button
    v-if="variant === 'filled'"
    :disabled="disabled"
    :type="type"
    @click="emit('click', $event)"
  >
    <slot />
  </md-filled-button>
  
  <md-outlined-button
    v-else-if="variant === 'outlined'"
    :disabled="disabled"
    :type="type"
    @click="emit('click', $event)"
  >
    <slot />
  </md-outlined-button>
  
  <md-text-button
    v-else-if="variant === 'text'"
    :disabled="disabled"
    :type="type"
    @click="emit('click', $event)"
  >
    <slot />
  </md-text-button>
</template>

<style scoped>
/* 使用 design-tokens 统一样式 */
md-filled-button {
  --md-filled-button-container-color: var(--md-sys-color-primary);
  --md-filled-button-label-text-color: var(--md-sys-color-on-primary);
  --md-filled-button-container-shape: var(--radius-md);
}

md-outlined-button {
  --md-outlined-button-outline-color: var(--md-sys-color-outline);
  --md-outlined-button-label-text-color: var(--md-sys-color-primary);
  --md-outlined-button-container-shape: var(--radius-md);
}

md-text-button {
  --md-text-button-label-text-color: var(--md-sys-color-primary);
  --md-text-button-container-shape: var(--radius-md);
}
</style>
```

### 2. 全局样式配置

```css
/* frontend/src/assets/material-web-theme.css */

/* 统一配置所有 Material Web Components 的样式 */

/* Buttons */
md-filled-button {
  --md-filled-button-container-color: var(--md-sys-color-primary);
  --md-filled-button-label-text-color: var(--md-sys-color-on-primary);
  --md-filled-button-container-shape: var(--radius-md);
  --md-filled-button-label-text-font: var(--font-family-base);
  --md-filled-button-label-text-size: var(--md-sys-typescale-label-large-size);
}

/* Text Fields */
md-filled-text-field {
  --md-filled-text-field-container-color: var(--md-sys-color-surface-variant);
  --md-filled-text-field-label-text-color: var(--md-sys-color-on-surface-variant);
  --md-filled-text-field-input-text-color: var(--md-sys-color-on-surface);
  --md-filled-text-field-container-shape: var(--radius-sm);
}

/* Dialogs */
md-dialog {
  --md-dialog-container-color: var(--md-sys-color-surface);
  --md-dialog-container-shape: var(--radius-lg);
}

/* Lists */
md-list {
  --md-list-container-color: transparent;
}

md-list-item {
  --md-list-item-label-text-color: var(--md-sys-color-on-surface);
  --md-list-item-container-shape: var(--radius-sm);
}

/* ... 更多组件样式 */
```

### 3. 迁移检查清单

每个组件替换后必须检查：

- [ ] 功能完整性（所有 props 和 events 都正常工作）
- [ ] 样式一致性（符合 Material Design 3 规范）
- [ ] 可访问性（键盘导航、屏幕阅读器）
- [ ] 性能（特别是列表和树形组件）
- [ ] 响应式（不同屏幕尺寸）
- [ ] 深色主题（dark mode）
- [ ] 类型安全（TypeScript 类型定义）

---

## 📈 成功指标

### 量化目标

- [ ] **组件替换率**: 80%+ 的自定义组件被 Material Web Components 替换
- [ ] **代码减少**: 自定义组件代码减少 50%+
- [ ] **性能**: 保持或提升当前性能（特别是 2 万书签场景）
- [ ] **一致性**: 100% 符合 Material Design 3 规范
- [ ] **可维护性**: 减少自定义样式代码 60%+

### 质量目标

- [ ] 所有组件通过可访问性测试
- [ ] 所有组件支持深色主题
- [ ] 所有组件有完整的 TypeScript 类型
- [ ] 所有组件有文档和使用示例

---

## 🚨 风险和缓解措施

### 风险 1: Material Web Components 功能不足

**缓解措施**:
- 保留 Tooltip、Notification 等缺失组件的自定义实现
- 基于 Material 组件组装复杂组件
- 遵循 Material Design 规范自定义样式

### 风险 2: 性能下降

**缓解措施**:
- 在 BookmarkTree 等关键组件中保持虚拟滚动
- 性能测试（2 万书签场景）
- 必要时使用 Web Components 的 lazy loading

### 风险 3: 迁移工作量大

**缓解措施**:
- 分阶段进行，每个阶段独立可测试
- 优先替换高频组件
- 保持向后兼容，逐步迁移

### 风险 4: Material Web Components 维护模式

**缓解措施**:
- 组件稳定，维护模式影响有限
- 保持 design-tokens 抽象层，便于未来迁移
- 关注 MDUI 等社区替代方案

---

## 📚 参考资源

- [Material Web Components 官方文档](https://material-web.dev/)
- [Material Design 3 规范](https://m3.material.io/)
- [Material Theme Builder](https://m3.material.io/theme-builder)
- [项目 Design Tokens](../../packages/design-tokens/README.md)

---

**最后更新**: 2026-05-13  
**负责人**: 开发团队  
**预计完成时间**: 8-10 周
