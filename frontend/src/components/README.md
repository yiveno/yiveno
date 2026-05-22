# 组件分类规范

## 📦 目录结构

```
frontend/src/components/
├── base/                # 基础组件（原子级）
├── composite/           # 复合组件（通用组合）
├── business/            # 业务组件（项目专属）
└── index.ts            # 统一导出
```

## 🎯 组件分类

### 1. 基础组件（Base Components）

**定义**：原子级 UI 组件，单一功能的最小 UI 单元

**特征**：

- ✅ 单一功能
- ✅ 不依赖其他组件
- ✅ 纯 UI 展示
- ✅ 无业务逻辑
- ✅ 完全可复用
- ✅ 可独立成 package

**示例**：

- `Button` - 按钮
- `Input` - 输入框
- `Icon` - 图标
- `Spinner` - 加载动画
- `Badge` - 徽章
- `Divider` - 分割线

**i18n 策略**：

- ❌ 不需要内置 i18n
- ✅ 文案完全由外部传入（props 或 slots）

**目录**：`components/base/`

---

### 2. 复合组件（Composite Components）

**定义**：多个基础组件组合，纯 UI 展示，无业务逻辑

**特征**：

- ✅ 由多个基础组件组合而成
- ✅ 纯 UI 展示
- ✅ 无业务逻辑
- ✅ 完全可复用
- ✅ 可独立成 package
- ⚠️ 可能有少量固定的 UI 提示文案

**示例**：

- `Alert` - Icon + 内容区域
- `Card` - 卡片容器（可能包含 Icon）
- `Dialog` - Button + Card + Icon 组合
- `ConfirmableDialog` - Dialog + 确认逻辑
- `EmptyState` - Icon + 标题 + 描述
- `Checkbox` - Input + Icon 组合
- `Chip` - Button + Icon 组合（用于显示标签、数量等）
- `Tabs` - 多个 Tab 组合
- `Avatar` - 头像（可能包含 Icon）
- `Notification` - 通知提示
- `ThemeToggle` - 主题切换
- `AppHeader` - 应用头部
- `SyncProgressDialog` - 同步进度对话框
- `PerformanceMonitor` - 性能监控

**i18n 策略**：

- 如果无文案：❌ 不需要 i18n，props 传入
- 如果有固定文案：✅ 需要内置翻译 + 外部覆盖

**目录**：`components/composite/`

---

### 3. 业务组件（Business Components）

**定义**：包含业务逻辑、数据处理、算法，项目专属

**特征**：

- ❌ 包含业务逻辑
- ❌ 数据处理和算法
- ❌ 项目专属
- ❌ 不可独立成 package
- ✅ 直接使用项目 i18n

**示例**：

- `BookmarkTree` - 书签树（包含书签业务逻辑）
- `BookmarkSearchInput` - 书签搜索（包含搜索算法）
- `BookmarkRecommendations` - 书签推荐（包含推荐算法）
- `QuickAddBookmarkDialog` - 快速添加书签（包含书签创建逻辑）
- `GlobalQuickAddBookmark` - 全局快速添加
- `GlobalSyncProgress` - 全局同步进度

**i18n 策略**：

- ✅ 直接使用项目的 i18n 系统
- ✅ 使用 `useI18n()` from `@/utils/i18n-helpers`
- ✅ 翻译键位于项目的 `_locales/` 目录

**目录**：`components/business/`

---

## 🔍 判断标准

### 核心判断流程

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

**业务逻辑的定义**：

- ✅ 依赖项目特定的数据模型（如书签、标签）
- ✅ 包含项目特定的算法（如搜索、推荐、排序）
- ✅ 调用项目特定的服务（如 bookmarkService、aiService）
- ✅ 处理项目特定的业务规则（如书签创建、同步）

**不是业务逻辑**：

- ❌ 通用的 UI 交互（如点击、hover、展开/收起）
- ❌ 通用的表单验证（如必填、邮箱格式）
- ❌ 通用的状态管理（如 loading、error）

### 详细对比表

| 问题                   | 基础组件 | 复合组件       | 业务组件  |
| ---------------------- | -------- | -------------- | --------- |
| 是否包含业务逻辑？     | ❌ 否    | ❌ 否          | ✅ 是     |
| 是否由多个组件组合？   | ❌ 否    | ✅ 是          | 可能是    |
| 是否可独立成 package？ | ✅ 是    | ✅ 是          | ❌ 否     |
| 是否依赖项目特定功能？ | ❌ 否    | ❌ 否          | ✅ 是     |
| 文案如何处理？         | 外部传入 | 外部传入或内置 | 项目 i18n |
| 是否可在其他项目使用？ | ✅ 是    | ✅ 是          | ❌ 否     |

### 示例对比

| 组件                      | 分类     | 原因                                        |
| ------------------------- | -------- | ------------------------------------------- |
| `Button`                  | 基础组件 | 单一功能，不依赖其他组件                    |
| `Icon`                    | 基础组件 | 单一功能，不依赖其他组件                    |
| `Input`                   | 基础组件 | 单一功能，不依赖其他组件                    |
| `Alert`                   | 复合组件 | Icon + 内容，但无业务逻辑，通用 UI          |
| `Card`                    | 复合组件 | 可能包含 Icon，但无业务逻辑，通用 UI        |
| `Dialog`                  | 复合组件 | Button + Card + Icon，但无业务逻辑，通用 UI |
| `EmptyState`              | 复合组件 | Icon + 标题 + 描述，但无业务逻辑，通用 UI   |
| `Checkbox`                | 复合组件 | Input + Icon，但无业务逻辑，通用 UI         |
| `BookmarkTree`            | 业务组件 | 包含书签展示、拖拽、编辑等**书签业务逻辑**  |
| `BookmarkSearchInput`     | 业务组件 | 包含**书签搜索算法**和筛选逻辑              |
| `BookmarkRecommendations` | 业务组件 | 包含**书签推荐算法**                        |

---

## 📝 命名规范

### 文件命名

- **组件文件**：PascalCase（如 `Button.vue`, `BookmarkTree.vue`）
- **目录名**：PascalCase（如 `Button/`, `BookmarkTree/`）
- **类型文件**：PascalCase + `.d.ts`（如 `Button.d.ts`）

### 组件命名

```vue
<script setup lang="ts">
// ✅ 使用 defineOptions 设置组件名
defineOptions({ name: 'AcuityButton' })
</script>
```

### CSS 类名

- **基础组件**：`btn`, `input`, `dialog`（简短）
- **业务组件**：`bookmark-tree`, `bookmark-search`（描述性）

---

## 🚀 使用示例

### 基础组件

```vue
<script setup lang="ts">
import { Button } from '@/components'
</script>

<template>
  <Button variant="primary">
    {{ t('submit') }}
    <!-- 文案由外部传入 -->
  </Button>
</template>
```

### 业务组件

```vue
<script setup lang="ts">
import BookmarkTree from '@/components/business/BookmarkTree/BookmarkTree.vue'
</script>

<template>
  <BookmarkTree :nodes="bookmarkNodes" />
  <!-- 组件内部使用项目 i18n -->
</template>
```

---

## ⚠️ 注意事项

### 禁止事项

1. ❌ **基础组件内部写死文案**

   ```vue
   <!-- ❌ 错误 -->
   <Button>提交</Button>

   <!-- ✅ 正确 -->
   <Button>{{ t('submit') }}</Button>
   ```

2. ❌ **业务组件放在 base 或 composite 目录**

   ```
   ❌ components/base/BookmarkTree/
   ❌ components/composite/BookmarkTree/
   ✅ components/business/BookmarkTree/
   ```

3. ❌ **复合组件放在 base 目录**

   ```
   ❌ components/base/Alert/  (Alert 使用了 Icon，是复合组件)
   ✅ components/composite/Alert/
   ```

4. ❌ **业务组件使用独立 i18n**

   ```typescript
   // ❌ 错误：业务组件不需要独立 i18n
   import { useTreeNodeI18n } from './useTreeNodeI18n'

   // ✅ 正确：直接使用项目 i18n
   import { useI18n } from '@/utils/i18n-helpers'
   ```

### 推荐做法

1. ✅ **新建组件前先确定分类**
   - 问自己：这个组件是否包含业务逻辑？
     - 是 → `business/`
     - 否 → 继续
   - 问自己：这个组件是否由多个基础组件组合？
     - 是 → `composite/`
     - 否 → `base/`

2. ✅ **基础组件保持单一功能**
   - 不依赖其他组件
   - 纯 UI 展示
   - 无业务逻辑

3. ✅ **复合组件保持通用性**
   - 可以组合多个基础组件
   - 但不包含业务逻辑
   - 可在任何项目中使用

4. ✅ **业务组件直接使用项目 i18n**
   - 使用 `useI18n()` from `@/utils/i18n-helpers`
   - 翻译键位于 `_locales/` 目录

5. ✅ **严格区分三种组件类型**
   - 基础组件、复合组件、业务组件各司其职
   - 保持低耦合，便于维护和扩展

---

## 📚 相关文档

- [基础组件文档](./base/README.md)
- [业务组件文档](./business/README.md)
- [项目 i18n 系统](../utils/i18n-helpers.ts)
- [设计系统规范](../../.kiro/steering/design-system.md)

---

## 🔄 迁移记录

### 2025-05-20：组件清理 - 删除冗余组件

**变更**：

- ✅ 删除 `UrlInput` 组件（已被 `Input` 组件的 `type="url"` 替代）
- ✅ 删除 `CountIndicator` 组件（已被 `Chip` 组件完全替代）
- ✅ 更新所有使用 `CountIndicator` 的地方改用 `Chip`：
  - `SidePanel.vue` - 最近访问和收藏夹数量显示
  - `BookmarkSearchInput.vue` - 快捷筛选标签数量显示
- ✅ 更新 `ShareDialog.vue` 使用 `Input` 组件替代 `MdInput`

**影响的文件**：

- `components/index.ts` - 移除 CountIndicator 导出
- `pages/side-panel/SidePanel.vue` - 使用 Chip 替代 CountIndicator
- `components/business/BookmarkSearchInput/BookmarkSearchInput.vue` - 使用 Chip 替代 CountIndicator
- `components/business/ShareDialog/ShareDialog.vue` - 使用 Input 替代 MdInput

**验证**：

- ✅ 构建成功
- ✅ background.js 验证通过：无 DOM API

---

### 2025-01-05：严格分类 - 创建 composite 目录

**变更**：

- ✅ 创建 `composite/` 目录
- ✅ 移动复合组件从 `base/` 到 `composite/`：
  - `base/Alert/` → `composite/Alert/`
  - `base/AppHeader/` → `composite/AppHeader/`
  - `base/Avatar/` → `composite/Avatar/`
  - `base/Card/` → `composite/Card/`
  - `base/Checkbox/` → `composite/Checkbox/`
  - `base/Chip/` → `composite/Chip/`
  - `base/ConfirmableDialog/` → `composite/ConfirmableDialog/`
  - `base/Dialog/` → `composite/Dialog/`
  - `base/EmptyState/` → `composite/EmptyState/`
  - `base/Notification/` → `composite/Notification/`
  - `base/PerformanceMonitor/` → `composite/PerformanceMonitor/`
  - `base/SyncProgressDialog/` → `composite/SyncProgressDialog/`
  - `base/Tabs/` → `composite/Tabs/`
  - `base/ThemeToggle/` → `composite/ThemeToggle/`
- ✅ 更新 `components/index.ts` 导出路径
- ✅ 更新所有引用这些组件的文件

**影响的文件**：

- `components/index.ts` - 更新导出路径
- `components/composite/SyncProgressDialog/SyncProgressDialog.vue` - 更新 Dialog 引用
- `components/composite/AppHeader/AppHeader.vue` - 更新 ThemeToggle 引用
- `components/business/GlobalSyncProgress/GlobalSyncProgress.vue` - 更新 SyncProgressDialog 引用
- `composables/useNotification.ts` - 更新 Notification 引用
- `pages/settings/main.ts` - 更新 ThemeToggle 引用

**验证**：

- ✅ TypeScript 类型检查通过

---

### 2025-01-04：组件目录重构 - 创建 business 目录

**变更**：

- ✅ 创建 `business/` 目录
- ✅ 移动业务组件：
  - `composite/BookmarkTree/` → `business/BookmarkTree/`
  - `composite/BookmarkSearchInput/` → `business/BookmarkSearchInput/`
  - `composite/BookmarkRecommendations/` → `business/BookmarkRecommendations/`
  - `composite/QuickAddBookmarkDialog/` → `business/QuickAddBookmarkDialog/`
  - `GlobalQuickAddBookmark.vue` → `business/GlobalQuickAddBookmark/`
  - `GlobalSyncProgress.vue` → `business/GlobalSyncProgress/`
- ✅ 删除空的 `composite/` 目录
- ✅ 更新所有 import 路径

**影响的文件**：

- `pages/management/Management.vue`
- `pages/side-panel/SidePanel.vue`
- `pages/popup/Popup.vue`
- `pages/settings/Settings.vue`

**验证**：

- ✅ TypeScript 类型检查通过
- ✅ Stylelint 检查通过

---

**最后更新**: 2025-05-20  
**维护者**: Kiro AI
