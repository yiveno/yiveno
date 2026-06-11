# Services 目录（基础设施层）

## 概述

本目录包含基础设施层服务，直接与外部系统交互。

**重要：** 本目录仅包含基础设施服务，业务逻辑服务已迁移到 `application/` 目录。

---

## 📂 目录职责

### ✅ 应该放在这里

- **Chrome API 封装**：书签、存储、通知、侧边栏等
- **IndexedDB 操作**：数据同步、持久化
- **网络请求**：爬虫、API 调用
- **Worker 适配器**：Web Worker 通信
- **性能监控**：查询性能、系统监控
- **外部服务客户端**：tRPC、第三方 API

### ❌ 不应该放在这里

- **业务逻辑**：应该在 `application/` 层
- **领域模型**：应该在 `core/domain/` 层
- **UI 组件**：应该在 `components/` 层
- **状态管理**：应该在 `stores/` 层

---

## 📋 当前文件清单

### 书签相关

| 文件                          | 职责                        | 类型           |
| ----------------------------- | --------------------------- | -------------- |
| `bookmark-sync-service.ts`    | Chrome API → IndexedDB 同步 | Infrastructure |
| `bookmark-trait-service.ts`   | 特征检测和标记              | Infrastructure |
| `bookmark-trait-auto-sync.ts` | 特征自动同步                | Infrastructure |

### 查询和性能

| 文件                           | 职责               | 类型           |
| ------------------------------ | ------------------ | -------------- |
| `query-worker-adapter.ts`      | 查询 Worker 适配器 | Infrastructure |
| `query-performance-monitor.ts` | 查询性能监控       | Infrastructure |

### 其他基础设施

| 文件                    | 职责         | 类型           |
| ----------------------- | ------------ | -------------- |
| `favicon-service.ts`    | Favicon 管理 | Infrastructure |
| `navigation-service.ts` | 页面导航     | Infrastructure |
| `trpc.ts`               | tRPC 客户端  | Infrastructure |

---

## 🔄 已迁移的服务

以下服务已迁移到 `application/` 层：

| 旧位置                                    | 新位置                                               | 原因     |
| ----------------------------------------- | ---------------------------------------------------- | -------- |
| `services/bookmark-index-service.ts`      | `application/bookmark/bookmark-index-app-service.ts` | 业务逻辑 |
| `services/smart-recommendation-engine.ts` | `application/bookmark/recommendation-app-service.ts` | 业务逻辑 |

---

## 📝 命名规范

### 推荐命名模式

- `*-service.ts` - 基础设施服务
- `*-gateway.ts` - 外部系统网关
- `*-adapter.ts` - 适配器模式
- `*-client.ts` - 客户端封装
- `*-worker.ts` - Worker 实现

### 示例

```typescript
// ✅ 好的命名
bookmark - sync - service.ts // 书签同步服务
favicon - gateway.ts // Favicon 网关
query - worker - adapter.ts // 查询 Worker 适配器

// ❌ 不好的命名
smart - recommendation.ts // 太模糊，应该在 application 层
bookmark - manager.ts // 太宽泛，职责不清
utils.ts // 太通用
```

---

## 🏗️ 架构原则

### 依赖方向

```
Presentation Layer (UI)
        ↓
Application Layer (Business Logic)
        ↓
Infrastructure Layer (Services) ← 你在这里
        ↓
External Systems (Chrome API, IndexedDB, Network)
```

### 关键规则

1. **单向依赖**：Services 层不应该依赖 Application 层
2. **接口隔离**：通过接口与 Application 层通信
3. **职责单一**：每个服务只做一件事
4. **可测试性**：易于 mock 和测试

---

## 📖 使用指南

### 在 Application 层使用

```typescript
// ✅ 正确：通过 Application 层使用
import { bookmarkAppService } from '@/application'

// ❌ 错误：直接使用 Services 层（除非在 Background Script）
import { bookmarkSyncService } from '@/services/bookmark-sync-service'
```

### 在 Background Script 使用

```typescript
// ✅ 正确：Background Script 可以直接使用 Infrastructure
import { bookmarkSyncService } from '@/services/bookmark-sync-service'
```

### 在 Composables 使用

```typescript
// ✅ 正确：通过 Application 层
import { bookmarkSearchService } from '@/application'

// ⚠️ 特殊情况：某些基础设施服务可以直接使用
import { faviconService } from '@/services/favicon-service'
```

---

## 🔍 故障排除

### 问题：不知道服务应该放在哪里

**判断标准：**

1. 是否直接与外部系统交互？
   - 是 → Services 层
   - 否 → 继续判断

2. 是否包含业务逻辑？
   - 是 → Application 层
   - 否 → 继续判断

3. 是否是领域模型？
   - 是 → Core/Domain 层
   - 否 → 可能是工具函数（Utils）

### 问题：循环依赖

**解决方案：**

1. 检查依赖方向是否正确
2. 使用依赖注入
3. 提取共享接口到 Core 层

---

## 📚 相关文档

- [Application 层文档](../application/README.md)
- [架构分层说明](../ARCHITECTURE_LAYERS.md)
- [DDD 设计原则](../docs/DDD_PRINCIPLES.md)

---

**最后更新**: 2025-01-10  
**维护者**: System

## 书签筛选服务（统一入口）

统一入口只有两个层级：

- 应用层服务：`bookmarkSearchService.search(query, { limit })`
- 组合式封装：`useBookmarkSearch`（内部调用上面的应用层服务）

说明：原 `services/hybrid-search-engine.ts` 与 `services/fuse-search.ts` 已移除/弃用，请勿再引用。

### 主要特性

### 🚀 **筛选策略**

- `flexsearch`: 基于 FlexSearch + IndexedDB 的本地关键词筛选（Free / 未开启语义检索）
- `hybrid`: FlexSearch + 本地 Embedding 语义召回（Pro 且开启语义检索）

### 🎯 **智能匹配算法**

- **标题匹配**: 权重最高 (100/50)
- **URL匹配**: 中等权重 (30)
- **域名匹配**: 中等权重 (20)
- **关键词匹配**: 低权重 (15)
- **标签匹配**: 最低权重 (10)

### 🔍 **筛选字段支持**

- `title`: 书签标题
- `url`: 完整URL
- `domain`: 域名
- `keywords`: 关键词
- `tags`: 标签
- `path`: 文件夹路径

### ⚡ **性能优化**

- 筛选结果缓存
- 智能去重
- 结果数量限制
- 性能统计监控

## 基本用法

### 1) 筛选（通过应用层，推荐）

````typescript
import { bookmarkSearchService } from '@/application/query/bookmark-search-service'

// 筛选页面
const searchResults = await bookmarkSearchService.search('react hooks', { limit: 50 })

// 弹窗页面
const popupResults = await bookmarkSearchService.search('vue components', { limit: 50 })

// 侧边栏
const sideResults = await bookmarkSearchService.search('typescript', { limit: 50 })

### 2) 通过 Composable（页面集成更简洁）

```ts
import { createBookmarkSearchPresets } from '@/composables/useBookmarkSearch'

const presets = createBookmarkSearchPresets()
const search = presets.managementSearch()
search.searchImmediate('react')
````

````

## 各页面专用配置（筛选）

### SearchPopup 页面
```typescript
// 配置：精确筛选 + 高亮 + 完整字段
{
  mode: 'accurate',
  fields: ['title', 'url', 'domain', 'keywords', 'tags'],
  enableHighlight: true,
  minScore: 5,
  limit: 20
}
````

### Popup 弹窗

```typescript
// 配置：快速筛选 + 基础字段
{
  mode: 'fast',
  fields: ['title', 'url', 'domain'],
  enableHighlight: false,
  limit: 50
}
```

### SidePanel 侧边栏

```typescript
// 配置：内存筛选 + 实时响应
{
  mode: 'fast', // 或使用内存筛选
  fields: ['title', 'url', 'domain'],
  enableHighlight: false,
  limit: 50
}
```

## 筛选选项详解

### 选项（统一入口）

| 选项       | 类型     | 默认值 | 说明                                                           |
| ---------- | -------- | ------ | -------------------------------------------------------------- |
| `strategy` | `never`  | `-`    | 已废弃，由 `search-mode.ts` 自动解析为 `flexsearch` / `hybrid` |
| `limit`    | `number` | `100`  | 结果数量上限                                                   |

### 筛选结果格式

返回类型沿用 IndexedDB 管道的 `SearchResult[]`：

```ts
interface SearchResult {
  bookmark: BookmarkRecord
  score: number
  matchedFields: string[]
  highlights: Record<string, string[]>
}
```

## 性能监控（筛选）

### 筛选统计

```typescript
interface SearchStats {
  query: string // 查询关键词
  mode: SearchMode // 筛选模式
  duration: number // 筛选耗时 (ms)
  totalResults: number // 结果总数
  returnedResults: number // 返回结果数
  maxScore: number // 最高分数
  avgScore: number // 平均分数
}
```

### 缓存管理

```typescript
// 清除筛选缓存
// 如需手动缓存控制，可由页面层自行管理；bookmarkSearchService 默认无需手动清缓存。

// 获取缓存统计
const cacheStats = bookmarkSearchService.getCacheStats()
logger.info('SearchService', `缓存大小: ${cacheStats.size}/${cacheStats.maxSize}`)
```

## 整理页提案：Diff 与应用

管理页右侧提案树与左侧原始树的差异计算、校验与应用：

```ts
import { calculateManagementProposalDiff } from '@/application/bookmark/management-proposal-diff'
import { proposalApplyService } from '@/application/bookmark/proposal-apply-service'

const diff = calculateManagementProposalDiff(originalChildren, proposalChildren, flatOriginalNodes)
const result = await proposalApplyService.applyOperations(diff.operations, { onProgress })
```

- Diff：`@/application/bookmark/bookmark-diff-service` + `management-proposal-diff.ts`
- 应用：`@/application/bookmark/proposal-apply-service.ts`（经 Background Script 写入 Chrome）
- 提案树编辑：`@/application/bookmark/proposal-tree-edit-service.ts`

注意：避免在 UI/store 中直接操作 Chrome API。

## 命名规范与职责边界（重要）

为避免“smart/unified/lightweight/modern”混用导致的困惑，现行规范如下：

- API 门面：`utils/unified-bookmark-api.ts`
  - 定位：对外统一通信与 IndexedDB 回退门面，不承载筛选/差异/执行实现
  - 页面若需要筛选/执行等能力，优先调用应用层服务（如 `bookmarkSearchService`、`bookmarkChangeAppService`）

- 筛选：`application/query/bookmark-search-service.ts`
  - 策略：`flexsearch` / `hybrid`（由 `core/query/search-mode.ts` 自动解析）
  - 组合式封装：`composables/useBookmarkSearch.ts`

- 整理页提案变更：
  - Diff：`application/bookmark/bookmark-diff-service.ts` + `management-proposal-diff.ts`
  - Apply：`application/bookmark/proposal-apply-service.ts`

- 现代化书签服务：`services/modern-bookmark-service.ts`
  - 定位：原生事件/特性桥接，统一代理到应用层服务（如筛选）

> 历史兼容：`utils/smart-bookmark-diff-engine.ts`、`utils/smart-bookmark-executor.ts` 已移除；请改用上面的 core 路径。
> 更新：`utils/smart-bookmark-manager.ts` 已移除，请改用 `bookmarkChangeAppService`。

### 本次清理更新（Dead Code Removal）

- 删除：`utils/smart-bookmark-manager.ts`（已完成迁移，使用 `application/bookmark/smart-bookmark-manager.ts` 或 `bookmarkChangeAppService`）
- 删除：`services/realtime-performance-optimizer.ts`（未被引用，性能监控统一由 `services/search-performance-monitor.ts` 提供）
- 删除：`utils/operation-tracker.ts`（历史基础设施类，当前未使用）
- 删除：`utils/bookmark-tree-builder.ts`（未引用，树构建统一由 `core/bookmark/services/*` 与 `application/bookmark/tree-app-service.ts` 提供）
- 删除：`utils/favicon-indexeddb-schema.ts`（未引用，Favicons 统一由 `services/favicon-service.ts` 处理，如需持久化由 IndexedDB 统一管理）
- 删除：`utils/unified-ai-api.ts`（未集成到 UI 流程，如后续恢复 AI 能力请使用 Cloudflare Worker 端点封装在 `application/*`）

以上移除均已通过类型检查与生产构建验证，不影响现有功能。若你在分支中仍引用这些模块，请按上面的替代路径迁移。

## 迁移对照表（从旧名到规范名）

| 旧文件/概念                           | 现行/规范位置                                               |
| ------------------------------------- | ----------------------------------------------------------- |
| `services/hybrid-search-engine.ts`    | `application/query/bookmark-search-service.ts`（策略统一）  |
| `services/fuse-search.ts`             | `core/query-engine/strategies/flexsearch-strategy.ts`       |
| `utils/smart-bookmark-diff-engine.ts` | `application/bookmark/bookmark-diff-service.ts`             |
| `utils/smart-bookmark-executor.ts`    | `application/bookmark/proposal-apply-service.ts`            |
| `bookmark-change-app-service.ts`      | `management-proposal-diff.ts` + `proposal-apply-service.ts` |
| `unified-*.ts`（API 门面）            | `utils/unified-bookmark-api.ts`（职责收敛为通信与回退）     |

> 如需进一步统一命名为 `bookmark-api.ts` 等，将在后续版本按低风险路径进行重命名并提供 codemod。

## 迁移指南（筛选）

### 从旧的筛选实现迁移

1. **替换筛选调用**:

   ```typescript
   // 旧代码
   const results = await indexedDBManager.searchBookmarks(query, options)

   // 新代码
   const { results } = await bookmarkSearchService.search(query, {
     mode: 'accurate',
     limit: options.limit
   })
   ```

2. **更新结果处理**:

   ```typescript
   // 旧格式：results[].bookmark
   // 新格式：results[] (直接是书签信息)
   ```

3. **使用应用服务**:

```typescript
// 推荐使用应用层的 bookmarkSearchService
import { bookmarkSearchService } from '@/application/query/bookmark-search-service'
const results = await bookmarkSearchService.search(query)
```

## 扩展计划

### 未来支持的筛选模式

- **AI筛选**: 基于LLM的语义筛选
- **全文筛选**: 网页内容的全文检索
- **智能推荐**: 基于用户行为的个性化推荐

### Omnibox集成

统一筛选服务为未来的omnibox功能提供了完美的基础：

```typescript
// 未来的omnibox实现
chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
  const results = await bookmarkSearchService.search(text, {
    strategy: 'flexsearch',
    limit: 5
  })

  suggest(
    results.map(r => ({
      content: r.url,
      description: `📖 ${r.title} - ${r.domain}`
    }))
  )
})
```

## 注意事项

1. 初始化：应用层服务负责数据初始化与降级处理，无需手动干预
2. 错误处理：应用层服务包含完整错误处理，Composable 可通过 onError 覆盖
3. 性能：Hybrid 会自动合并去重并排序，limit 控制返回量
4. 兼容性：旧的 hybrid/flexsearch 独立服务已弃用，请迁移到 `bookmarkSearchService` 或 `useBookmarkSearch`

## 故障排除

### 常见问题

**Q: 筛选结果为空？**
A: 检查筛选关键词是否过短（<2字符），或者降低minScore设置。

**Q: 筛选速度慢？**
A: 尝试使用'fast'模式，或者减少筛选字段数量。

**Q: 结果不准确？**
A: 使用'accurate'模式，并调整minScore参数。

**Q: 内存使用过高？**
A: 定期调用clearCache()清理筛选缓存。
