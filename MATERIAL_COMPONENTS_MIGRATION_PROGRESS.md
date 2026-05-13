# Material Web Components 迁移进度

## 迁移策略

直接使用 Material Web Components,不创建包装层。所有样式通过 `frontend/src/assets/material-web-theme.css` 统一配置。

## 组件映射表

| 自定义组件 | Material Web Component | 状态 |
|-----------|----------------------|------|
| Button (variant="primary") | `<md-filled-button>` | 🔄 进行中 |
| Button (variant="secondary") | `<md-filled-tonal-button>` | 🔄 进行中 |
| Button (variant="outline") | `<md-outlined-button>` | 🔄 进行中 |
| Button (variant="ghost") | `<md-text-button>` | 🔄 进行中 |
| Button (variant="text") | `<md-text-button>` | 🔄 进行中 |
| Button (iconOnly) | `<md-icon-button>` | 🔄 进行中 |
| Input | `<md-outlined-text-field>` | ⏳ 待开始 |
| Checkbox | `<md-checkbox>` | ⏳ 待开始 |
| Dialog | `<md-dialog>` | ⏳ 待开始 |
| List | `<md-list>` + `<md-list-item>` | ⏳ 待开始 |

## Button 组件替换清单

### 已完成 ✅
- `frontend/src/components/base/KeyboardShortcutsHelp/KeyboardShortcutsHelp.vue` - 替换为 `<md-text-button>`
- `frontend/src/components/composite/AppHeader/AppHeader.vue` - 替换为 `<md-icon-button>`
- `frontend/src/components/business/ShareDialog/ShareDialog.vue` - 替换为 `<md-filled-button>`, `<md-outlined-button>`, `<md-icon-button>`
- `frontend/src/components/composite/Chip/Chip.vue` - 替换为 `<md-icon-button>`
- `frontend/src/components/composite/PerformanceMonitor/PerformanceMonitor.vue` - 替换为 `<md-icon-button>`, `<md-outlined-button>`
- `frontend/src/components/composite/Dialog/Dialog.vue` - 替换为 `<md-text-button>`, `<md-filled-button>`
- `frontend/src/components/composite/SyncProgressDialog/SyncProgressDialog.vue` - 替换为 `<md-filled-button>`, `<md-text-button>`
- `frontend/src/components/composite/ThemeToggle/ThemeToggle.vue` - 替换为 `<md-icon-button>`
- `frontend/src/components/business/BookmarkTree/TreeNode.vue` - 替换为 `<md-icon-button>`
- `frontend/src/components/business/QuickAddBookmarkDialog/QuickAddBookmarkDialog.vue` - 替换为 `<md-text-button>`, `<md-filled-button>`
- `frontend/src/components/business/BookmarkRecommendations/BookmarkRecommendations.vue` - 替换为 `<md-icon-button>`, `<md-outlined-button>`

### 进行中 🔄
- 无

### 待处理 ⏳
- 无（Button 组件替换已全部完成）

## 替换规则

### 1. 导入方式
```typescript
// ❌ 旧方式
import { Button } from '@/components'

// ✅ 新方式
import '@material/web/button/filled-button.js'
import '@material/web/icon/icon.js'
```

### 2. 组件使用

#### Primary Button
```vue
<!-- ❌ 旧方式 -->
<Button variant="primary">保存</Button>

<!-- ✅ 新方式 -->
<md-filled-button>保存</md-filled-button>
```

#### Secondary Button
```vue
<!-- ❌ 旧方式 -->
<Button variant="secondary">取消</Button>

<!-- ✅ 新方式 -->
<md-filled-tonal-button>取消</md-filled-tonal-button>
```

#### Outline Button
```vue
<!-- ❌ 旧方式 -->
<Button variant="outline">编辑</Button>

<!-- ✅ 新方式 -->
<md-outlined-button>编辑</md-outlined-button>
```

#### Ghost/Text Button
```vue
<!-- ❌ 旧方式 -->
<Button variant="ghost">关闭</Button>
<Button variant="text">了解更多</Button>

<!-- ✅ 新方式 -->
<md-text-button>关闭</md-text-button>
<md-text-button>了解更多</md-text-button>
```

#### Icon Button
```vue
<!-- ❌ 旧方式 -->
<Button variant="ghost" icon-only>
  <LucideIcon name="x" :size="20" />
</Button>

<!-- ✅ 新方式 -->
<md-icon-button>
  <md-icon>close</md-icon>
</md-icon-button>
```

#### Button with Icon
```vue
<!-- ❌ 旧方式 -->
<Button variant="primary">
  <LucideIcon name="download" :size="16" />
  下载
</Button>

<!-- ✅ 新方式 -->
<md-filled-button>
  <md-icon slot="icon">download</md-icon>
  下载
</md-filled-button>
```

### 3. 事件处理

```vue
<!-- Material Web Components 使用原生事件 -->
<md-filled-button @click="handleClick">点击</md-filled-button>
```

### 4. 禁用状态

```vue
<!-- ❌ 旧方式 -->
<Button :disabled="isLoading">提交</Button>

<!-- ✅ 新方式 -->
<md-filled-button :disabled="isLoading">提交</md-filled-button>
```

### 5. 危险操作按钮

```vue
<!-- ❌ 旧方式 -->
<Button variant="primary" class="button--danger">删除</Button>

<!-- ✅ 新方式 -->
<md-filled-button class="button--danger">删除</md-filled-button>
```

## 注意事项

1. **图标系统**: Material Web Components 使用 Material Icons,需要将 Lucide Icons 映射到 Material Icons
2. **尺寸**: Material Web Components 没有 size prop,通过 CSS 变量控制
3. **Loading 状态**: Material Web Components 没有内置 loading 状态,需要手动实现
4. **Ripple 效果**: Material Web Components 自带 ripple 效果,无需额外配置

## 迁移进度

- [x] Phase 1: Button 组件替换 (11/11) ✅ **已完成**
- [ ] Phase 2: Input 组件替换
- [ ] Phase 3: Checkbox/Radio/Switch 组件替换
- [ ] Phase 4: Dialog 组件替换
- [ ] Phase 5: List 组件替换
- [ ] Phase 6: 其他组件替换

## 最后更新

2025-05-13 - Button 组件替换全部完成
