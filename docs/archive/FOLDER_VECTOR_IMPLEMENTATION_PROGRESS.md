# 文件夹向量推荐实现进度

## ✅ 阶段 1：核心服务（已完成）

### 1. IndexedDB Schema 扩展

**文件**: `frontend/src/infrastructure/indexeddb/schema.ts`

- ✅ 数据库版本升级：11 → 12
- ✅ 新增 `FOLDER_VECTORS` store
- ✅ 新增 `FolderVectorRecord` 接口

**字段设计**：

```typescript
interface FolderVectorRecord {
  folderId: string // 主键
  folderName: string // 文件夹名称
  folderPath: string // 完整路径
  vector: number[] // 代表向量
  bookmarkCount: number // 书签数量
  model: string // 模型名称
  updatedAt: number // 更新时间
}
```

---

### 2. 文件夹向量存储

**文件**: `frontend/src/infrastructure/folder-vector/folder-vector-store.ts`

**功能**：

- ✅ `upsert()` - 写入/更新单条记录
- ✅ `upsertBatch()` - 批量写入
- ✅ `get()` - 获取单条记录
- ✅ `delete()` - 删除单条记录
- ✅ `deleteBatch()` - 批量删除
- ✅ `getAll()` - 获取所有记录
- ✅ `getAllIds()` - 获取所有 ID
- ✅ `count()` - 获取总数
- ✅ `clear()` - 清空所有记录

**特点**：

- 完全复用 IndexedDB 事务机制
- 类型安全
- 错误处理完善

---

### 3. 文件夹向量服务（核心算法）

**文件**: `frontend/src/application/folder/folder-vector-service.ts`

**核心功能**：

#### 3.1 增量同步文件夹向量

```typescript
async syncFolderVectors(onProgress?: (progress) => void): Promise<void>
```

**算法**：

1. 获取所有文件夹
2. 对每个文件夹：
   - 收集该文件夹下所有书签的向量
   - 计算平均向量（归一化）
   - 如果文件夹为空，使用文件夹名称生成向量
3. 存储到 IndexedDB

**优化**：

- 增量同步（只处理变更的文件夹）
- 进度回调
- 错误容错

#### 3.2 推荐文件夹

```typescript
async recommendFolders(
  bookmarkTitle: string,
  bookmarkUrl: string,
  topK = 3,
  minScore = 0.3
): Promise<FolderRecommendation[]>
```

**算法**：

1. 生成新书签的向量
2. 计算与所有文件夹向量的余弦相似度
3. 过滤低于阈值的结果
4. 返回 Top K 推荐

**推荐结果**：

```typescript
interface FolderRecommendation {
  folderId: string
  folderName: string
  folderPath: string
  score: number // 0-1
  bookmarkCount: number
  reason: string // "包含 15 个相似书签（匹配度 85%）"
}
```

#### 3.3 更新单个文件夹向量

```typescript
async updateFolderVector(folderId: string): Promise<void>
```

**用途**：

- 书签添加/删除后更新文件夹向量
- 保持向量库的实时性

#### 3.4 统计信息

```typescript
async getStats(): Promise<{ folderCount, providerName }>
```

---

### 4. Background 消息处理

**文件**: `frontend/src/background/messaging.ts`

**新增消息类型**：

#### 4.1 `GET_FOLDER_RECOMMENDATIONS`

```typescript
// 请求
{
  type: 'GET_FOLDER_RECOMMENDATIONS',
  data: {
    title: string,
    url: string,
    topK?: number,      // 默认 3
    minScore?: number   // 默认 0.3
  }
}

// 响应
{
  success: boolean,
  recommendations: FolderRecommendation[]
}
```

#### 4.2 `SYNC_FOLDER_VECTORS`

```typescript
// 请求
{
  type: 'SYNC_FOLDER_VECTORS'
}

// 响应
{
  success: boolean
}
```

---

## ✅ 阶段 2：UI 改造（已完成）

### 1. QuickAddBookmarkDialog 组件改造（Vue 版本）

**文件**: `frontend/src/components/business/QuickAddBookmarkDialog/QuickAddBookmarkDialog.vue`

**使用场景**: 通过 `GlobalQuickAddBookmark` 组件使用

**新增功能**：

#### 1.1 AI 自动归纳开关 ⭐

- ✅ **✨ AI 自动归纳** 复选框（默认开启）
- ✅ 勾选：显示 AI 推荐文件夹（Top 3）
- ✅ 取消勾选：显示手动选择文件夹（下拉列表）
- ✅ 动态切换，实时响应

#### 1.2 推荐文件夹展示（AI 模式）

- ✅ 显示 Top 3 推荐文件夹
- ✅ 显示匹配度百分比
- ✅ 显示推荐原因
- ✅ 最佳匹配标记
- ✅ 选中状态高亮

#### 1.3 手动选择模式

- ✅ 下拉列表选择文件夹
- ✅ 显示完整文件夹路径
- ✅ 默认选择书签栏

#### 1.4 加载状态

- ✅ 推荐加载中动画
- ✅ 加载失败自动切换到手动模式

#### 1.5 交互优化

- ✅ 点击推荐项自动选中
- ✅ 自动选中最佳推荐
- ✅ 模式切换流畅

---

### 2. Content Script 对话框改造（原生 HTML 版本）

**文件**: `frontend/src/content/inject-quick-add-dialog.ts`

**使用场景**: 通过右键菜单"添加到书签"触发，在网页中注入

**新增功能**：

#### 2.1 AI 自动归纳开关 ⭐

- ✅ **✨ AI 自动归纳** 复选框（默认开启）
- ✅ 勾选：显示 AI 推荐文件夹（Top 3）
- ✅ 取消勾选：显示手动选择文件夹（树形选择器）
- ✅ 动态切换，实时响应
- ✅ 推荐失败自动切换到手动模式

#### 2.2 推荐文件夹展示（AI 模式）

- ✅ 显示 Top 3 推荐文件夹
- ✅ 显示匹配度百分比（绿色 badge）
- ✅ 显示推荐原因
- ✅ 最佳匹配标记（绿色 badge）
- ✅ 选中状态高亮（绿色边框 + 背景）

#### 2.3 手动选择模式

- ✅ 树形文件夹选择器
- ✅ 展开/折叠功能
- ✅ 选中状态高亮
- ✅ 默认选择书签栏

#### 2.4 加载状态

- ✅ 推荐加载中动画（旋转图标 + 提示文字）
- ✅ 加载失败自动切换到手动模式

#### 2.5 交互优化

- ✅ 点击推荐项自动选中
- ✅ 自动选中最佳推荐
- ✅ 选中后图标变为 ✓
- ✅ 自动滚动到树形选择器中的对应文件夹
- ✅ 模式切换流畅

#### 2.6 实现细节

- ✅ 实现 `getVectorRecommendations()` 函数
- ✅ 通过 `GET_FOLDER_RECOMMENDATIONS` 消息与 Background 通信
- ✅ 推荐项样式完全符合 Chrome 原生风格
- ✅ 响应式交互（hover、选中、点击）
- ✅ 代码结构优化（所有元素在对话框显示前定义）

**UI 效果（Vue 组件版本）**：

```
┌─────────────────────────────────────┐
│ 添加书签                             │
├─────────────────────────────────────┤
│ 📖 React 官方文档                    │
│ https://react.dev                   │
│                                     │
│ 文件夹                               │
│ ☑ ✨ AI 自动归纳                    │
│                                     │
│ ✨ 推荐文件夹：                      │
│ ┌─────────────────────────────────┐ │
│ │ ✓ 前端开发 > React      85% 🏆  │ │
│ │   包含 15 个相似书签             │ │
│ │                                 │ │
│ │   前端开发 > JavaScript  72%    │ │
│ │   包含 8 个相似书签              │ │
│ │                                 │ │
│ │   编程资源               65%    │ │
│ │   包含 23 个相似书签             │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [取消]  [完成]                      │
└─────────────────────────────────────┘

--- 取消勾选 AI 自动归纳后 ---

┌─────────────────────────────────────┐
│ 添加书签                             │
├─────────────────────────────────────┤
│ 📖 React 官方文档                    │
│ https://react.dev                   │
│                                     │
│ 文件夹                               │
│ ☐ ✨ AI 自动归纳                    │
│                                     │
│ 📁 选择文件夹：                      │
│ [书签栏 > 前端开发 > React    ▼]   │
│                                     │
│ [取消]  [完成]                      │
└─────────────────────────────────────┘
```

**UI 效果（Content Script 原生版本）**：

```
┌─────────────────────────────────────┐
│ 添加书签                             │
├─────────────────────────────────────┤
│ 名称                                 │
│ [React 官方文档            ] [✨]   │
│ ☐ ⭐ 添加到收藏                      │
│                                     │
│ 文件夹                               │
│ ☑ ✨ AI 自动归纳                    │
│                                     │
│ ⟳ 正在分析最佳文件夹...              │
│                                     │
│ ✨ 推荐文件夹                        │
│ ┌─────────────────────────────────┐ │
│ │ 📁 前端开发 > React      85%    │ │
│ │    包含 15 个相似书签            │ │
│ │    [最佳匹配]                    │ │
│ ├─────────────────────────────────┤ │
│ │ 📁 前端开发 > JavaScript  72%   │ │
│ │    包含 8 个相似书签             │ │
│ ├─────────────────────────────────┤ │
│ │ 📁 编程资源               65%   │ │
│ │    包含 23 个相似书签            │ │
│ └─────────────────────────────────┘ │
│                                     │
│                    [取消]  [保存]   │
└─────────────────────────────────────┘

--- 取消勾选 AI 自动归纳后 ---

┌─────────────────────────────────────┐
│ 添加书签                             │
├─────────────────────────────────────┤
│ 名称                                 │
│ [React 官方文档            ] [✨]   │
│ ☐ ⭐ 添加到收藏                      │
│                                     │
│ 文件夹                               │
│ ☐ ✨ AI 自动归纳                    │
│                                     │
│ 📁 选择文件夹                        │
│ ┌─────────────────────────────────┐ │
│ │ ▼ 📁 书签栏                      │ │
│ │   ▶ 📁 前端开发                  │ │
│ │   ▶ 📁 后端开发                  │ │
│ │   ▶ 📁 编程资源                  │ │
│ └─────────────────────────────────┘ │
│                                     │
│                    [取消]  [保存]   │
└─────────────────────────────────────┘
```

---

### 2. 调试工具

**文件**: `frontend/src/devtools/folder-vector-debug.ts`

**功能**：

- ✅ `__AB_FOLDER_VECTOR__.stats()` - 查看统计
- ✅ `__AB_FOLDER_VECTOR__.sync()` - 同步向量
- ✅ `__AB_FOLDER_VECTOR__.recommend()` - 测试推荐
- ✅ `__AB_FOLDER_VECTOR__.updateFolder()` - 更新单个文件夹
- ✅ `__AB_FOLDER_VECTOR__.clear()` - 清空向量

**集成位置**：

- ✅ Management 页面（开发模式或 `?abDevtools=1`）

---

## 🎯 核心算法详解

### 1. 文件夹向量生成

**方法**：平均向量法

```
文件夹向量 = Σ(书签向量) / 书签数量
```

**归一化**：

```typescript
magnitude = √(Σ(v[i]²))
normalized[i] = v[i] / magnitude
```

**特殊情况**：

- 空文件夹：使用文件夹名称生成向量
- 无向量书签：使用文件夹名称生成向量

### 2. 相似度计算

**方法**：余弦相似度（点积）

```
similarity = Σ(a[i] * b[i])
```

**原因**：向量已归一化，余弦相似度 = 点积

### 3. 推荐策略

**阈值**：

- 默认 `minScore = 0.3`（30% 相似度）
- 可调整（用户偏好）

**排序**：

- 按相似度降序
- 返回 Top K（默认 3）

**推荐原因生成**：

- 0 个书签："新文件夹（匹配度 X%）"
- 1 个书签："包含 1 个相似书签（匹配度 X%）"
- N 个书签："包含 N 个相似书签（匹配度 X%）"

---

## 📊 性能分析

### 时间复杂度

- **同步文件夹向量**：O(F × B)
  - F = 文件夹数量
  - B = 平均每个文件夹的书签数量
  - 假设 100 个文件夹，每个 20 个书签 → 2000 次向量操作

- **推荐文件夹**：O(F)
  - F = 文件夹数量
  - 假设 100 个文件夹 → 100 次相似度计算
  - 耗时 < 10ms

### 空间复杂度

- **文件夹向量存储**：O(F × D)
  - F = 文件夹数量
  - D = 向量维度（384）
  - 假设 100 个文件夹 → 100 × 384 × 4 bytes ≈ 150KB

---

## ✅ 验证结果

- ✅ TypeScript 类型检查通过
- ✅ 无编译错误
- ✅ 架构符合项目规范（单向数据流、DDD 分层）
- ✅ 完全本地化（无网络请求）
- ✅ 与语义搜索技术栈一致
- ✅ UI 改造完成
- ✅ 调试工具集成

---

## 🚀 使用指南

### 首次使用

1. **同步书签向量**（如果还没有）：

   ```javascript
   // 在 Management 页面 Console
   await __AB_EMBEDDING__.sync()
   ```

2. **同步文件夹向量**：

   ```javascript
   await __AB_FOLDER_VECTOR__.sync()
   ```

3. **测试推荐**：
   ```javascript
   await __AB_FOLDER_VECTOR__.recommend('React 官方文档', 'https://react.dev')
   ```

### 添加书签

1. 右键点击页面 → "添加到书签"
2. 或使用快捷键（如果配置）
3. 对话框自动显示推荐文件夹
4. 点击推荐项或手动选择
5. 点击"完成"

### 调试

- 查看统计：`await __AB_FOLDER_VECTOR__.stats()`
- 重新同步：`await __AB_FOLDER_VECTOR__.sync()`
- 清空重置：`await __AB_FOLDER_VECTOR__.clear()`

---

## 📝 已创建的文件

### 核心服务

1. `frontend/src/infrastructure/folder-vector/folder-vector-store.ts` - 文件夹向量存储
2. `frontend/src/application/folder/folder-vector-service.ts` - 文件夹向量服务

### 调试工具

3. `frontend/src/devtools/folder-vector-debug.ts` - 调试桥

### 已修改的文件

4. `frontend/src/infrastructure/indexeddb/schema.ts` - Schema 扩展
5. `frontend/src/infrastructure/indexeddb/manager.ts` - Store 配置
6. `frontend/src/background/messaging.ts` - 消息处理
7. `frontend/src/components/business/QuickAddBookmarkDialog/QuickAddBookmarkDialog.vue` - Vue 组件 UI 改造
8. `frontend/src/content/inject-quick-add-dialog.ts` - Content Script 原生对话框 UI 改造
9. `frontend/src/pages/management/Management.vue` - 调试桥集成

---

## 🎉 完成状态

- ✅ 阶段 1：核心服务（100%）
- ✅ 阶段 2：UI 改造（100%）
  - ✅ Vue 组件版本（GlobalQuickAddBookmark）
  - ✅ Content Script 原生版本（右键菜单触发）
  - ✅ **AI 自动归纳 / 手动选择切换功能** ⭐
- ⏳ 阶段 3：优化增强（待定）

**总体进度**: 100% 🎉

**核心功能**：

- ✅ 文件夹向量生成与存储
- ✅ 基于余弦相似度的智能推荐
- ✅ AI 自动归纳模式（默认）
- ✅ 手动选择模式（可切换）
- ✅ 两个版本的 UI 实现（Vue + 原生 HTML）

**可选优化**（待定）：

- 用户习惯学习（强化学习）
- 批量分类功能
- 创建新文件夹智能命名
- 性能优化

---

## 🎯 两个版本对比

| 特性                | Vue 组件版本                 | Content Script 版本    |
| ------------------- | ---------------------------- | ---------------------- |
| **触发方式**        | GlobalQuickAddBookmark 组件  | 右键菜单"添加到书签"   |
| **运行环境**        | 扩展页面（Popup/Management） | 网页注入               |
| **技术栈**          | Vue 3 + Composition API      | 原生 HTML + JavaScript |
| **样式**            | 项目设计系统（CSS 变量）     | Chrome 原生样式        |
| **向量推荐**        | ✅ 已实现                    | ✅ 已实现              |
| **AI 自动归纳开关** | ✅ 已实现                    | ✅ 已实现              |
| **推荐展示**        | Top 3 推荐卡片               | Top 3 推荐卡片         |
| **手动选择**        | ✅ 下拉列表                  | ✅ 树形选择器          |
| **模式切换**        | ✅ 实时切换                  | ✅ 实时切换            |
| **加载动画**        | ✅ 旋转图标                  | ✅ 旋转图标            |
| **自动选中**        | ✅ 最佳推荐                  | ✅ 最佳推荐            |
| **失败降级**        | ✅ 自动切换到手动            | ✅ 自动切换到手动      |
| **收藏功能**        | ❌ 无                        | ✅ 有                  |
| **重复检测**        | ❌ 无                        | ✅ 有                  |

---

**实施完成时间**: 2026-05-01
**实施方式**: 方案 A（完全重构）
**技术栈**: 向量相似度 + 完全本地化
