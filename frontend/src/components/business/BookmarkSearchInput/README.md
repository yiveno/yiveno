# BookmarkSearchInput 组件

书签搜索输入组件 - 支持多种交互模式和搜索结果展示方式。

## 功能特性

### ✨ 核心功能

- 🔍 **智能搜索**：FlexSearch 关键词筛选 + Pro Hybrid 语义检索
- 🎯 **多种交互模式**：icon / compact / full / inline
- 📋 **搜索结果下拉列表**：即时预览前 N 条结果
- ⌨️ **键盘导航**：↑/↓ 导航，Enter 打开，Esc 关闭
- 🏷️ **快捷筛选**：可配置的筛选标签（无效/重复书签等）
- 📊 **实时统计**：显示结果数量和执行时间

---

## 使用示例

### 1. Popup 页面（icon 模式 + dropdown 结果）

```vue
<BookmarkSearchInput
  display-mode="icon"
  result-display="dropdown"
  :max-dropdown-results="5"
  :quick-filters="{
    enabled: true,
    position: 'dropdown',
    filters: []
  }"
  @result-click="handleBookmarkClick"
  @view-all="handleViewAllResults"
/>
```

**特点：**

- 初始显示为圆形搜索图标
- 点击展开为搜索框
- 搜索结果显示在下拉列表中（最多 5 条）
- 点击单个结果直接打开书签
- 点击"查看全部"跳转到 Management 页面

---

### 2. Management 页面（full 模式 + emit 结果）

```vue
<BookmarkSearchInput
  display-mode="full"
  result-display="emit"
  :quick-filters="{
    enabled: true,
    position: 'inline',
    filters: customFilters
  }"
  :show-stats="true"
  @search-complete="handleSearchResults"
/>
```

**特点：**

- 完整搜索框，始终展开
- 快捷筛选标签显示在搜索框旁边
- 搜索结果通过事件传递给父组件
- 父组件自行处理结果展示

---

### 3. Side Panel（compact 模式）

```vue
<BookmarkSearchInput
  display-mode="compact"
  result-display="dropdown"
  :max-dropdown-results="8"
  :quick-filters="{ enabled: false }"
  size="sm"
/>
```

**特点：**

- 紧凑搜索框，始终显示
- 不显示快捷筛选标签
- 搜索结果显示在下拉列表中

---

## Props 配置

### 交互模式

| Prop            | 类型                                        | 默认值       | 说明             |
| --------------- | ------------------------------------------- | ------------ | ---------------- |
| `displayMode`   | `'icon' \| 'compact' \| 'full' \| 'inline'` | `'icon'`     | 交互展示模式     |
| `resultDisplay` | `'dropdown' \| 'navigate' \| 'emit'`        | `'dropdown'` | 搜索结果展示方式 |

### 搜索配置

| Prop       | 类型                                                           | 默认值        | 说明             |
| ---------- | -------------------------------------------------------------- | ------------- | ---------------- |
| `mode`     | `'indexeddb' \| 'memory'`                                      | `'indexeddb'` | 搜索模式         |
| `strategy` | `'flexsearch' \| 'hybrid'`（由账号自动解析，调用方勿手动指定） | 自动          | 检索策略         |
| `limit`    | `number`                                                       | `100`         | 搜索结果数量限制 |
| `debounce` | `number`                                                       | `300`         | 防抖延迟（毫秒） |

### 结果展示

| Prop                 | 类型      | 默认值 | 说明                 |
| -------------------- | --------- | ------ | -------------------- |
| `showResultCount`    | `boolean` | `true` | 是否显示结果数量     |
| `maxDropdownResults` | `number`  | `5`    | 下拉列表最多显示几条 |
| `showStats`          | `boolean` | `true` | 是否显示统计信息     |

### 快捷筛选

| Prop           | 类型                | 默认值 | 说明         |
| -------------- | ------------------- | ------ | ------------ |
| `quickFilters` | `QuickFilterConfig` | -      | 快捷筛选配置 |

```typescript
interface QuickFilterConfig {
  enabled: boolean // 是否启用
  position: 'inline' | 'dropdown' // 显示位置
  filters: QuickFilter[] // 筛选器列表
}

interface QuickFilter {
  id: string // 唯一标识
  label: string // 显示标签
  icon?: string // 图标名称
  count?: number // 结果数量
  filter: (node: BookmarkNode) => boolean // 筛选逻辑
}
```

---

## Events

| 事件名            | 参数                      | 说明                          |
| ----------------- | ------------------------- | ----------------------------- |
| `search-complete` | `results: BookmarkNode[]` | 搜索完成                      |
| `search-start`    | `query: string`           | 搜索开始                      |
| `search-clear`    | -                         | 搜索清空                      |
| `search-error`    | `error: Error`            | 搜索错误                      |
| `result-click`    | `bookmark: BookmarkNode`  | 结果项点击（dropdown 模式）   |
| `view-all`        | `results: BookmarkNode[]` | 查看全部结果（dropdown 模式） |

---

## 键盘快捷键

| 快捷键  | 功能                                 |
| ------- | ------------------------------------ |
| `↓`     | 向下导航（下拉列表）                 |
| `↑`     | 向上导航（下拉列表）                 |
| `Enter` | 打开选中的书签                       |
| `Esc`   | 清空输入 / 关闭下拉列表 / 收起搜索框 |

---

## 设计原则

### 1. 单一职责

- **搜索组件**：只负责搜索输入和结果展示
- **搜索服务**：只负责搜索逻辑和数据处理
- **父组件**：负责结果的最终处理（跳转、展示等）

### 2. 可配置性

- 通过 `displayMode` 适配不同页面布局
- 通过 `resultDisplay` 控制结果展示方式
- 通过 `quickFilters` 自定义筛选功能

### 3. 向后兼容

- 保留旧的 props（`enableTraitFilters`, `showQuickFilters` 等）
- 新的 props 优先级更高
- 逐步迁移到新的配置方式

---

## 迁移指南

### 从旧版本迁移

**旧版本：**

```vue
<BookmarkSearchInput
  :enable-trait-filters="true"
  :show-quick-filters="true"
  :custom-quick-filters="myFilters"
  @search-complete="handleResults"
/>
```

**新版本：**

```vue
<BookmarkSearchInput
  display-mode="icon"
  result-display="dropdown"
  :quick-filters="{
    enabled: true,
    position: 'dropdown',
    filters: myFilters
  }"
  @search-complete="handleResults"
  @result-click="handleBookmarkClick"
  @view-all="handleViewAll"
/>
```

---

## 常见问题

### Q: 如何隐藏快捷筛选标签？

```vue
<BookmarkSearchInput :quick-filters="{ enabled: false }" />
```

### Q: 如何自定义下拉列表显示数量？

```vue
<BookmarkSearchInput :max-dropdown-results="10" />
```

### Q: 如何在搜索后跳转到其他页面？

```vue
<BookmarkSearchInput result-display="navigate" @search-complete="openManagementPage" />
```

或者使用 `view-all` 事件：

```vue
<BookmarkSearchInput result-display="dropdown" @view-all="openManagementPage" />
```

---

## 开发计划

### ✅ 已完成

- [x] 多种交互模式（icon / compact / full / inline）
- [x] 搜索结果下拉列表
- [x] 键盘导航
- [x] 快捷筛选可配置

### 🚧 进行中

- [ ] 虚拟滚动（大量结果）
- [ ] 搜索建议（自动补全）

### 📋 计划中

- [ ] 高级筛选面板
- [ ] 搜索结果分组
- [ ] 搜索结果高亮
- [ ] 搜索性能优化

---

**最后更新**: 2026-04-30  
**版本**: 2.0.0
