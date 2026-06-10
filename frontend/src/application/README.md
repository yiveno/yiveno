# Application 目录（应用层）

## 概述

本目录包含应用层服务，协调领域模型和基础设施，实现具体的业务用例。

---

## 📂 目录职责

### ✅ 应该放在这里

- **业务用例实现**：用户操作的完整流程
- **跨领域协调**：协调多个领域服务
- **事务管理**：确保数据一致性
- **权限检查**：业务级别的权限控制
- **数据转换**：DTO ↔ Domain Model
- **业务规则编排**：组合多个领域规则

### ❌ 不应该放在这里

- **直接的 Chrome API 调用**：应该在 `infrastructure/` 层
- **领域规则**：应该在 `core/domain/` 层
- **UI 逻辑**：应该在 `presentation/` 层
- **数据访问**：应该在 `infrastructure/` 层

---

## 🏗️ 目录结构

```
application/
├── ai/                    # AI 相关应用服务
│   ├── ai-app-service.ts
│   └── llm-response-validator.ts
├── bookmark/              # 书签相关应用服务
│   ├── bookmark-app-service.ts
│   ├── bookmark-diff-service.ts
│   ├── management-proposal-diff.ts
│   ├── proposal-apply-service.ts
│   ├── proposal-tree-edit-service.ts
│   ├── bookmark-index-app-service.ts
│   ├── favorite-app-service.ts
│   ├── recommendation-app-service.ts
│   └── tree-app-service.ts
├── font/                  # 字体相关应用服务
│   └── font-service.ts
├── notification/          # 通知相关应用服务
│   └── notification-service.ts
├── query/                 # 搜索相关应用服务
│   ├── bookmark-search-service.ts
│   └── bookmark-memory-search-service.ts
├── scheduler/             # 调度相关应用服务
│   └── scheduler-service.ts
├── settings/              # 设置相关应用服务
│   └── settings-app-service.ts
├── share/                 # 分享相关应用服务
│   ├── poster-service.ts
│   └── share-service.ts
├── subscription/          # 订阅相关应用服务
│   └── subscription-app-service.ts
├── index.ts               # 统一导出
└── README.md              # 本文档
```

---

## 📝 命名规范

### 推荐命名模式

- `*-app-service.ts` - 应用服务（推荐）
- `*-use-case.ts` - 用例实现
- `*-coordinator.ts` - 协调器
- `*-orchestrator.ts` - 编排器

### 示例

```typescript
// ✅ 好的命名
bookmark - app - service.ts // 书签应用服务
bookmark - change - app - service.ts // 书签变更应用服务
recommendation - app - service.ts // 推荐应用服务

// ❌ 不好的命名
bookmark - manager.ts // 太宽泛
smart - recommendation.ts // 缺少 -app-service 后缀
utils.ts // 太通用
```

---

## 🎯 应用服务模式

### 基本结构

```typescript
/**
 * 书签应用服务
 *
 * 职责：
 * - 协调书签相关的业务用例
 * - 管理事务边界
 * - 处理错误和异常
 */
export class BookmarkAppService {
  /** 服务是否已初始化 */
  private initialized = false

  /**
   * 初始化服务
   */
  async initialize(): Promise<Result<void>> {
    // 初始化逻辑
  }

  /**
   * 业务用例：获取所有书签
   */
  async getAllBookmarks(limit?: number, offset?: number): Promise<Result<BookmarkRecord[]>> {
    // 1. 参数验证
    // 2. 调用领域服务或仓储
    // 3. 数据转换
    // 4. 返回结果
  }
}
```

### Result 模式

所有应用服务方法应该返回 `Result<T>` 类型：

```typescript
import type { Result } from '@/core/common/result'
import { ok, err } from '@/core/common/result'

async function someUseCase(): Promise<Result<Data>> {
  try {
    // 业务逻辑
    return ok(data)
  } catch (error) {
    logger.error('Service', '操作失败', error)
    return err(new Error('操作失败'))
  }
}
```

---

## 🔄 依赖关系

### 架构分层

```
┌─────────────────────────────────┐
│   Presentation Layer (UI)       │
│   - Components                   │
│   - Pages                        │
│   - Composables                  │
└────────────┬────────────────────┘
             ↓
┌─────────────────────────────────┐
│   Application Layer ← 你在这里   │
│   - Use Cases                    │
│   - Coordinators                 │
│   - DTOs                         │
└────────────┬────────────────────┘
             ↓
┌─────────────────────────────────┐
│   Domain Layer (Core)            │
│   - Entities                     │
│   - Value Objects                │
│   - Domain Services              │
└────────────┬────────────────────┘
             ↓
┌─────────────────────────────────┐
│   Infrastructure Layer           │
│   - Repositories                 │
│   - Gateways                     │
│   - External Services            │
└─────────────────────────────────┘
```

### 依赖规则

1. **Application 层可以依赖**：
   - ✅ Domain 层（Core）
   - ✅ Infrastructure 层（通过接口）
   - ❌ Presentation 层

2. **Application 层不应该**：
   - ❌ 直接调用 Chrome API（使用 Infrastructure 层）
   - ❌ 包含 UI 逻辑（使用 Presentation 层）
   - ❌ 实现领域规则（使用 Domain 层）

---

## 📖 使用指南

### 在 Presentation 层使用

```typescript
// ✅ 正确：通过统一导出使用
import { bookmarkAppService, bookmarkSearchService } from '@/application'

// ✅ 也可以：直接导入
import { bookmarkAppService } from '@/application/bookmark/bookmark-app-service'
```

### 在 Composables 使用

```typescript
// ✅ 正确：Composables 应该使用 Application 层
import { bookmarkSearchService } from '@/application'

export function useBookmarkSearch() {
  const search = async (query: string) => {
    const result = await bookmarkSearchService.search(query)
    if (result.ok) {
      return result.value
    }
    // 处理错误
  }

  return { search }
}
```

### 在 Pages/Components 使用

```vue
<script setup lang="ts">
import { bookmarkAppService } from '@/application'

const loadBookmarks = async () => {
  const result = await bookmarkAppService.getAllBookmarks()
  if (result.ok) {
    bookmarks.value = result.value
  } else {
    // 显示错误
  }
}
</script>
```

---

## 🎨 设计模式

### 1. 用例模式（Use Case Pattern）

每个用例是一个独立的方法：

```typescript
export class BookmarkAppService {
  // 用例：创建书签
  async createBookmark(data: CreateBookmarkDTO): Promise<Result<Bookmark>> {
    // 实现
  }

  // 用例：删除书签
  async deleteBookmark(id: string): Promise<Result<void>> {
    // 实现
  }
}
```

### 2. 协调器模式（Coordinator Pattern）

协调多个服务：

```typescript
export class BookmarkChangeAppService {
  async planAndExecute(
    original: BookmarkTree,
    target: BookmarkTree
  ): Promise<Result<ExecutionResult>> {
    // 1. 调用 Diff 服务
    const diffResult = await diffService.compare(original, target)

    // 2. 调用执行器
    const execResult = await executor.execute(diffResult)

    // 3. 返回结果
    return ok({ diff: diffResult, execution: execResult })
  }
}
```

### 3. 事务模式（Transaction Pattern）

确保数据一致性：

```typescript
export class BookmarkAppService {
  async moveBookmark(bookmarkId: string, targetFolderId: string): Promise<Result<void>> {
    // 开始事务
    const transaction = await this.beginTransaction()

    try {
      // 1. 更新书签
      await this.updateBookmark(bookmarkId, { parentId: targetFolderId })

      // 2. 更新索引
      await this.updateIndex(bookmarkId)

      // 3. 提交事务
      await transaction.commit()

      return ok(undefined)
    } catch (error) {
      // 回滚事务
      await transaction.rollback()
      return err(error)
    }
  }
}
```

---

## 🧪 测试指南

### 单元测试

```typescript
import { describe, it, expect, vi } from 'vitest'
import { BookmarkAppService } from './bookmark-app-service'

describe('BookmarkAppService', () => {
  it('should get all bookmarks', async () => {
    // Arrange
    const service = new BookmarkAppService()

    // Act
    const result = await service.getAllBookmarks()

    // Assert
    expect(result.ok).toBe(true)
    expect(result.value).toBeInstanceOf(Array)
  })
})
```

### 集成测试

```typescript
import { describe, it, expect } from 'vitest'
import { bookmarkAppService } from './bookmark-app-service'
import { indexedDBManager } from '@/infrastructure/indexeddb/manager'

describe('BookmarkAppService Integration', () => {
  it('should create and retrieve bookmark', async () => {
    // 初始化 IndexedDB
    await indexedDBManager.initialize()

    // 创建书签
    const createResult = await bookmarkAppService.createBookmark({
      title: 'Test',
      url: 'https://test.com'
    })

    expect(createResult.ok).toBe(true)

    // 获取书签
    const getResult = await bookmarkAppService.getBookmarkById(createResult.value.id)

    expect(getResult.ok).toBe(true)
    expect(getResult.value?.title).toBe('Test')
  })
})
```

---

## 🔍 故障排除

### 问题：不知道功能应该放在哪里

**判断标准：**

1. 是否是完整的业务用例？
   - 是 → Application 层
   - 否 → 继续判断

2. 是否是领域规则？
   - 是 → Domain 层
   - 否 → 继续判断

3. 是否是基础设施操作？
   - 是 → Infrastructure 层
   - 否 → 可能是工具函数（Utils）

### 问题：Application 层太臃肿

**解决方案：**

1. 拆分成多个小的应用服务
2. 提取共享逻辑到 Domain 层
3. 使用协调器模式组合服务

### 问题：循环依赖

**解决方案：**

1. 检查依赖方向是否正确
2. 使用依赖注入
3. 提取共享接口到 Core 层

---

## 📚 相关文档

- [Services 层文档](../services/README.md)
- [架构分层说明](../ARCHITECTURE_LAYERS.md)
- [DDD 设计原则](../docs/DDD_PRINCIPLES.md)
- [Result 模式](../core/common/result.ts)

---

**最后更新**: 2025-01-10  
**维护者**: System
