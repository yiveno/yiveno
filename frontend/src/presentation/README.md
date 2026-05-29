# Presentation 层适配器说明

## 🎯 什么是 Presentation 层适配器？

Presentation 层适配器是 **UI 组件和应用服务层之间的桥梁**，负责：

1. **隔离组件对基础设施的直接访问**
   - 组件不应该直接访问 `infrastructure/`（如 `indexedDBManager`、`logger`）
   - 组件不应该直接访问 `services/`（如 `queryWorkerAdapter`）

2. **提供 UI 友好的接口**
   - 将应用服务层的复杂接口转换为简单的 UI 接口
   - 统一数据格式和错误处理

3. **统一用户反馈**
   - 统一的错误提示、加载状态、成功提示
   - 统一的加载动画和进度反馈

4. **数据转换和格式化**
   - 将领域模型转换为 UI 需要的格式
   - 处理 UI 特定的数据转换

## 📊 当前问题

### ❌ 违规示例

```typescript
// ❌ 组件直接访问基础设施层
import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
import { logger } from '@/infrastructure/logging/logger'

// ❌ 组件直接访问服务层
import { queryWorkerAdapter } from '@/services/query-worker-adapter'

// ❌ 组件直接访问应用层（虽然好一些，但仍应该通过适配器）
import { notificationService } from '@/application/notification/notification-service'
```

### ✅ 正确做法

```typescript
// ✅ 通过 Presentation 层适配器
import { bookmarkPresentationAdapter } from '@/presentation/adapters/bookmark-adapter'
import { notificationPresentationAdapter } from '@/presentation/adapters/notification-adapter'
```

## 🏗️ 架构图

```
┌─────────────────────────────────────────────────────────┐
│                    UI Components                        │
│  (Vue Components, Pages, Composables)                  │
└────────────────────┬────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│           Presentation Layer                           │
│  ┌─────────────────────────────────────────────────┐  │
│  │  Adapters (适配器)                               │  │
│  │  - bookmark-adapter.ts                          │  │
│  │  - notification-adapter.ts                       │  │
│  │  - search-adapter.ts                             │  │
│  └─────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────┐  │
│  │  Composables (组合式函数)                        │  │
│  │  - useBookmarkData.ts                           │  │
│  │  - useNotification.ts                           │  │
│  └─────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│           Application Layer                            │
│  (应用服务层)                                           │
└────────────────────┬────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│           Core Layer                                   │
│  (核心领域层)                                           │
└────────────────────┬────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│           Infrastructure Layer                        │
│  (基础设施层)                                           │
└─────────────────────────────────────────────────────────┘
```

## 💡 为什么需要这个层？

### 1. **分层架构原则**

根据 DDD 分层架构：

- **Presentation 层** 不应该直接访问 **Infrastructure 层**
- **Presentation 层** 应该通过 **Application 层** 访问业务逻辑

### 2. **解耦和可测试性**

```
没有适配器：
UI Component → Infrastructure → 难以测试，耦合度高

有适配器：
UI Component → Presentation Adapter → Application → Infrastructure
            ↑
            └─ 可以轻松 mock 适配器进行测试
```

### 3. **UI 特定的需求**

- UI 需要加载状态、错误提示、成功提示
- UI 需要数据格式化（日期、数字、文本）
- UI 需要特定的数据格式（表格、列表、卡片）

### 4. **统一错误处理**

```typescript
// ❌ 没有适配器：每个组件都要处理错误
try {
  const bookmarks = await indexedDBManager.getAllBookmarks()
} catch (error) {
  logger.error('...')
  uiStore.showError('加载失败')
  // ... 重复的错误处理代码
}

// ✅ 有适配器：统一处理
const { data, error, loading } = await bookmarkAdapter.getBookmarks()
// 错误已经在适配器中统一处理了
```

## 📝 示例：书签适配器

### 适配器接口

```typescript
// presentation/adapters/bookmark-adapter.ts
export interface BookmarkPresentationAdapter {
  // 获取书签列表（带加载状态和错误处理）
  getBookmarks(): Promise<{
    data: BookmarkRecord[] | null
    error: Error | null
    loading: boolean
  }>

  // 搜索书签（UI 友好的接口）
  searchBookmarks(query: string): Promise<SearchResult[]>

  // 创建书签（带用户反馈）
  createBookmark(bookmark: CreateBookmarkInput): Promise<{
    success: boolean
    bookmark?: BookmarkRecord
    error?: string
  }>
}
```

### 适配器实现

```typescript
// presentation/adapters/bookmark-adapter.ts
import { bookmarkAppService } from '@/application/bookmark/bookmark-app-service'
import { bookmarkSearchService } from '@/application/query/bookmark-search-service'
import { notificationService } from '@/application/notification/notification-service'
import { logger } from '@/infrastructure/logging/logger'
import type { BookmarkRecord } from '@/infrastructure/indexeddb/types'

export class BookmarkPresentationAdapter {
  /**
   * 获取所有书签（UI 友好的接口）
   */
  async getBookmarks(): Promise<{
    data: BookmarkRecord[] | null
    error: Error | null
    loading: boolean
  }> {
    try {
      const result = await bookmarkAppService.getAllBookmarks()
      if (result.ok) {
        return {
          data: result.value,
          error: null,
          loading: false
        }
      }

      // 统一错误处理
      logger.error('BookmarkAdapter', '获取书签失败', result.error)
      notificationService.showError('获取书签失败，请稍后重试')

      return {
        data: null,
        error: result.error,
        loading: false
      }
    } catch (error) {
      logger.error('BookmarkAdapter', '获取书签异常', error)
      notificationService.showError('获取书签时发生错误')

      return {
        data: null,
        error: error instanceof Error ? error : new Error(String(error)),
        loading: false
      }
    }
  }

  /**
   * 搜索书签（UI 友好的接口）
   */
  async searchBookmarks(query: string): Promise<SearchResult[]> {
    try {
      const result = await bookmarkSearchService.search(query, { limit: 50 })
      return result.results.map(r => ({
        bookmark: r.bookmark,
        score: r.score,
        highlights: r.highlights
      }))
    } catch (error) {
      logger.error('BookmarkAdapter', '搜索书签失败', error)
      notificationService.showError('搜索失败，请稍后重试')
      return []
    }
  }
}
```

## 🎨 使用 Composables 封装

为了更方便使用，可以创建 Composables：

```typescript
// presentation/composables/useBookmarkData.ts
import { ref, computed } from 'vue'
import { bookmarkPresentationAdapter } from '@/presentation/adapters/bookmark-adapter'

export function useBookmarkData() {
  const bookmarks = ref<BookmarkRecord[]>([])
  const loading = ref(false)
  const error = ref<Error | null>(null)

  const loadBookmarks = async () => {
    loading.value = true
    error.value = null

    const result = await bookmarkPresentationAdapter.getBookmarks()
    bookmarks.value = result.data || []
    error.value = result.error
    loading.value = false
  }

  const hasBookmarks = computed(() => bookmarks.value.length > 0)

  return {
    bookmarks,
    loading,
    error,
    hasBookmarks,
    loadBookmarks
  }
}
```

## 🔄 迁移步骤

### 阶段一：创建适配器（当前）

1. ✅ 创建 `presentation/adapters/` 目录
2. ✅ 创建 `bookmark-adapter.ts`
3. ✅ 创建 `notification-adapter.ts`
4. ⏳ 创建其他适配器

### 阶段二：创建 Composables

1. ⏳ 创建 `presentation/composables/useBookmarkData.ts`
2. ⏳ 创建 `presentation/composables/useNotification.ts`
3. ⏳ 迁移现有 composables

### 阶段三：迁移组件

1. ⏳ 将组件中的直接访问改为使用适配器
2. ⏳ 逐步迁移，保持向后兼容

## 📚 相关文档

- [DDD 分层架构最佳实践](https://martinfowler.com/bliki/PresentationDomainDataLayering.html)
- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)

---

**总结**：Presentation 层适配器是 UI 和应用层之间的桥梁，提供了：

- ✅ 分层隔离
- ✅ UI 友好接口
- ✅ 统一错误处理
- ✅ 更好的可测试性
