# 添加书签模块清理总结

## 🗑️ 已删除的代码（LLM 分类相关）

### 1. AI 服务层

**文件**: `frontend/src/application/ai/ai-app-service.ts`

删除的方法：

- ❌ `categorizeBookmark()` - LLM 单个书签分类
- ❌ `organizeBookmarks()` - LLM 批量书签整理

删除的类型：

- ❌ `BookmarkCategoryResult`
- ❌ `BookmarkOrganizeResult`

删除的导入：

- ❌ `createCategorizePrompt`
- ❌ `createOrganizePrompt`
- ❌ `validateCategoryResults`
- ❌ `parseSimpleFormat`
- ❌ `getValidationStats`
- ❌ `ValidatedCategoryResult`

**保留的方法**（与分类无关）：

- ✅ `summarizeBookmark()` - 书签摘要
- ✅ `enhanceSemanticSearch()` - 语义搜索增强
- ✅ `generateTags()` - 标签生成
- ✅ `detectCapabilities()` - 检测 LLM 能力
- ✅ `getBuiltInLLMGuide()` - 获取内置 LLM 指南

---

### 2. Background 消息处理

**文件**: `frontend/src/background/messaging.ts`

删除的消息类型：

- ❌ `GET_AI_CATEGORY_SUGGESTION`

删除的处理函数：

- ❌ `handleGetAICategorySuggestion()`

**保留的消息类型**（添加书签核心流程）：

- ✅ `CREATE_BOOKMARK`
- ✅ `GET_BOOKMARK_TREE`
- ✅ `CHECK_DUPLICATE_BOOKMARK`
- ✅ `UPDATE_BOOKMARK`
- ✅ `DELETE_BOOKMARK`
- ✅ `MOVE_BOOKMARK`

---

### 3. UI 组件

**文件**: `frontend/src/components/business/QuickAddBookmarkDialog/QuickAddBookmarkDialog.vue`

删除的方法：

- ❌ `getAISuggestion()` - 获取 LLM 分类建议

替换为：

- 🔄 `getVectorRecommendations()` - TODO 注释（待实现）

**保留的核心功能**：

- ✅ 文件夹选择
- ✅ 书签标题/URL 输入
- ✅ 重复检测
- ✅ 数据验证

---

### 4. Content Script

**文件**: `frontend/src/content/inject-quick-add-dialog.ts`

删除的方法：

- ❌ `getAISuggestion()` - 获取 LLM 分类建议

替换为：

- 🔄 `getVectorRecommendations()` - TODO 注释（待实现）

---

### 5. Prompt 模板

**文件**: `frontend/src/core/ai/prompts.ts`

删除的函数：

- ❌ `createCategorizePrompt()` - 单个书签分类 Prompt
- ❌ `createOrganizePrompt()` - 批量书签整理 Prompt

**保留的函数**：

- ✅ `createSummarizePrompt()` - 书签摘要 Prompt
- ✅ `createSemanticSearchPrompt()` - 语义搜索增强 Prompt
- ✅ `createTagGenerationPrompt()` - 标签生成 Prompt

---

## ✅ 保留的核心流程

### 添加书签的完整流程（已保留）

```
用户触发添加书签
  ↓
GlobalQuickAddBookmark 监听消息
  ↓
QuickAddBookmarkDialog 显示对话框
  ↓
用户选择文件夹 + 填写信息
  ↓
发送 CREATE_BOOKMARK 消息到 Background
  ↓
Background 调用 chrome.bookmarks.create()
  ↓
Chrome API 触发 onCreated 事件
  ↓
自动同步到 IndexedDB
  ↓
广播通知到所有页面
```

### 保留的关键组件

1. **GlobalQuickAddBookmark.vue**
   - 全局监听 `SHOW_ADD_BOOKMARK_DIALOG` 消息
   - 显示添加书签对话框
   - 处理确认/取消操作

2. **QuickAddBookmarkDialog.vue**
   - 书签信息输入（标题、URL）
   - 文件夹选择（下拉列表）
   - 数据验证
   - 网站图标显示

3. **Background Messaging**
   - `CREATE_BOOKMARK` - 创建书签
   - `GET_BOOKMARK_TREE` - 获取文件夹树
   - `CHECK_DUPLICATE_BOOKMARK` - 检测重复

---

## 🎯 下一步：实现向量推荐

### 需要创建的新文件

1. **文件夹向量服务**

   ```
   frontend/src/application/folder/folder-vector-service.ts
   ```

   - 为文件夹生成代表向量
   - 计算书签与文件夹的相似度
   - 推荐 Top N 文件夹

2. **IndexedDB Schema 扩展**

   ```
   frontend/src/infrastructure/indexeddb/schema.ts
   ```

   - 新增 `FOLDER_VECTORS` store
   - 存储文件夹向量缓存

3. **Background 消息处理**

   ```
   frontend/src/background/messaging.ts
   ```

   - 新增 `GET_FOLDER_RECOMMENDATIONS` 消息类型
   - 实现 `handleGetFolderRecommendations()`

### 需要改造的现有文件

1. **QuickAddBookmarkDialog.vue**
   - 替换文件夹选择 UI（从 `<select>` 改为自定义组件）
   - 显示推荐文件夹（Top 3，带相似度分数）
   - 支持创建新文件夹

2. **inject-quick-add-dialog.ts**
   - 集成向量推荐
   - 显示推荐结果

---

## 📊 清理统计

- **删除的文件**: 0（只删除了函数和类型）
- **删除的函数**: 4（categorizeBookmark, organizeBookmarks, createCategorizePrompt, createOrganizePrompt）
- **删除的类型**: 2（BookmarkCategoryResult, BookmarkOrganizeResult）
- **删除的消息类型**: 1（GET_AI_CATEGORY_SUGGESTION）
- **保留的核心流程**: 100%（添加书签的所有核心功能都保留）

---

## ✅ 验证结果

- ✅ TypeScript 类型检查通过
- ✅ 无编译错误
- ✅ 核心添加书签流程完整保留
- ✅ 无历史包袱和冗余代码

---

**清理完成时间**: 2026-05-01
**清理原因**: 将 LLM 分类迁移到基于向量的本地推荐，保持与语义搜索的技术栈一致
