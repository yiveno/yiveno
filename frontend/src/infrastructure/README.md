# Infrastructure 基础设施层

本目录包含应用的**基础设施层**实现，提供技术性基础能力，不包含业务逻辑。

---

## 📂 目录结构

```
infrastructure/
├── events/          # 事件系统
├── http/            # HTTP 客户端
├── indexeddb/       # IndexedDB 管理
├── logging/         # 日志系统
├── storage/         # 浏览器存储
└── index.ts         # 统一导出
```

---

## 🎯 职责定位

### ✅ 应该包含

- **技术性基础能力**：HTTP、存储、日志、事件、缓存
- **与外部系统交互**：IndexedDB、Chrome API、网络请求
- **通用工具封装**：错误处理、类型转换、数据校验

### ❌ 不应包含

- **业务逻辑**：书签操作、用户偏好、AI 推荐（属于 `services/` 或 `application/`）
- **领域模型**：`Bookmark`、`Tag`、`User`（属于 `core/`）
- **UI 组件**：按钮、表单、对话框（属于 `components/`）

---

## 📦 模块说明

### 1. 事件系统 (`events/`)

#### `event-bus.ts` - 全局事件总线

```typescript
import { emitEvent, onEvent, offEvent } from '@/infrastructure/events/event-bus'

// 类型安全的事件发送
emitEvent('bookmark:created', { id: '123', title: 'New' })

// 类型安全的事件监听
onEvent('bookmark:created', data => {
  console.log(data.title) // 自动类型推导
})
```

**特点**：

- ✅ 基于 `mitt`，轻量且类型安全
- ✅ 适用于全局应用事件
- ✅ 支持多订阅者

#### `event-stream.ts` - 事件流管理

```typescript
import { dispatchCoalescedEvent } from '@/infrastructure/events/event-stream'

// 合并高频事件，防抖处理
dispatchCoalescedEvent('bookmark:bulk-update', bookmarkIds)
```

**特点**：

- ✅ 事件合并/节流
- ✅ 适用于高频事件场景（批量操作）
- ✅ 独特价值，不与 event-bus 冲突

**使用场景**：

- `event-bus`：普通事件（创建、删除）
- `event-stream`：高频事件（批量更新、滚动）

---

### 2. HTTP 客户端 (`http/`)

#### `api-client.ts` - 企业级 HTTP 客户端

```typescript
import { apiClient } from '@/infrastructure/http/api-client'

// 完整的错误处理
const result = await apiClient.get<UserData>('/api/user/me')
if (result.ok) {
  console.log(result.value.data)
} else {
  console.error(result.error.message)
}
```

**特点**：

- ✅ Result 模式（`ok` / `err`）
- ✅ 自动重试（默认 3 次）
- ✅ 超时控制（默认 10s）
- ✅ 请求/响应拦截器

**适用场景**：

- 复杂 API 调用（认证、重试）
- 需要详细错误信息
- 企业级应用

#### `safe-fetch.ts` - 轻量级封装

```typescript
import { safeJsonFetch } from '@/infrastructure/http/safe-fetch'

// 简洁的 API，失败返回 null
const user = await safeJsonFetch<UserData>('/api/user/me')
if (user) {
  console.log(user.email)
}
```

**特点**：

- ✅ 基于 `api-client` 实现（共享重试、超时等能力）
- ✅ 自动 JSON 解析
- ✅ 失败返回 `null`，无需 `try-catch`

**适用场景**：

- 简单页面请求
- 不需要详细错误处理
- 快速原型开发

**架构关系**：

```
api-client.ts  <-- safe-fetch.ts (wrapper)
     ↓              ↓
 认证服务         认证页面
```

**选择指南**：
| 场景 | 推荐 | 原因 |
|------|------|------|
| 复杂 API（认证、重试） | `api-client.ts` | 功能完整 |
| 简单页面请求 | `safe-fetch.ts` | 简洁易用 |
| 未来统一标准 | `api-client.ts` | 企业级 |

---

### 3. IndexedDB (`indexeddb/`)

#### `manager.ts` - IndexedDB 管理器（唯一入口）

```typescript
import { indexedDBManager } from '@/infrastructure/indexeddb/manager'

// ✅ 所有 IndexedDB 操作必须通过 manager
const bookmarks = await indexedDBManager.getAllBookmarks()
await indexedDBManager.saveBookmark(bookmark)

// ❌ 禁止直接使用原生 API
const db = indexedDB.open('AcuityBookmarks', 9) // 错误！
```

**核心能力**：

- 数据库连接管理
- Schema 版本升级
- 批量操作优化（2000/批）
- 事务管理

**架构原则**：

```
Chrome API → Background Script → IndexedDB → Pinia Store → UI
     ↑                                                         ↓
     └─────────────── chrome.runtime.sendMessage ─────────────┘
```

**铁律**：

- ✅ IndexedDB 是**唯一数据源**
- ✅ Background Script 是**唯一监听者**
- ❌ 前端**禁止直接调用** Chrome API

---

### 4. 存储 (`storage/`)

#### `modern-storage.ts` - Chrome Storage 封装

```typescript
import { modernStorage } from '@/infrastructure/storage/modern-storage'

// chrome.storage.local（永久）
await modernStorage.setLocal('theme', 'dark')
const theme = await modernStorage.getLocal('theme', 'light')

// chrome.storage.session（会话级）
await modernStorage.setSession('db_ready', true)
const ready = await modernStorage.getSession('db_ready', false)
```

**存储方案对比**：
| 存储类型 | 生命周期 | 容量 | 使用场景 |
|---------|---------|------|----------|
| IndexedDB | 永久 | 不限 | 书签数据（2万+）、爬取元数据 |
| chrome.storage.local | 永久 | 10MB | 用户偏好、扩展配置 |
| chrome.storage.session | 会话级 | 10MB | 临时数据、UI 状态、同步状态 |
| Pinia Store | 页面级 | 内存 | 高频 UI 状态、计算属性 |

**决策树**：

1. 数据量 > 1000 条？→ IndexedDB
2. 需要浏览器关闭后保留？→ chrome.storage.local
3. 需要跨页面共享但会话结束清除？→ chrome.storage.session
4. 仅当前页面使用且刷新后可重建？→ Pinia Store

---

### 5. 日志 (`logging/`)

#### `logger.ts` - 统一日志系统

```typescript
import { logger } from '@/infrastructure/logging/logger'

// 分类日志（模块 + 操作 + 上下文）
logger.info('BookmarkSync', '完成同步', { count: 150 })
logger.error('IndexedDB', '保存失败', error)
logger.debug('Performance', '加载耗时', { duration: 234 })
```

**特点**：

- ✅ 统一格式：`[时间] [级别] [模块] 消息 上下文`
- ✅ 日志级别：`debug` / `info` / `warn` / `error`
- ✅ 生产环境自动过滤 `debug` 日志

---

## 🚨 使用规范

### 1. 导入路径

```typescript
// ✅ 推荐：从统一入口导入
import { logger, modernStorage, apiClient } from '@/infrastructure'

// ✅ 也可以：直接导入具体模块
import { logger } from '@/infrastructure/logging/logger'

// ❌ 错误：不要从 index.ts 以外的文件导入其他模块
// 在 infrastructure/http/ 内部不要导入 infrastructure/storage/
```

### 2. Service Worker 兼容性

**Background Script 运行在 Service Worker 环境，没有 `window`、`document`、`localStorage`！**

| 正确 ✅                         | 错误 ❌               |
| ------------------------------- | --------------------- |
| `setTimeout()`                  | `window.setTimeout()` |
| `fetch()`                       | `window.fetch()`      |
| `chrome.storage.*`              | `localStorage.*`      |
| `ReturnType<typeof setTimeout>` | `number` (timer 类型) |

```typescript
// ❌ 错误
private timer: number | null = null
this.timer = window.setTimeout(() => {...}, 1000)

// ✅ 正确
private timer: ReturnType<typeof setTimeout> | null = null
this.timer = setTimeout(() => {...}, 1000)
```

**受影响模块**：

- `infrastructure/indexeddb/**`（可能被 Service Worker 调用）
- `infrastructure/storage/**`（可能被 Service Worker 调用）
- `infrastructure/logging/**`（可能被 Service Worker 调用）

### 3. 错误处理

```typescript
// ✅ 推荐：使用 Result 模式
const result = await apiClient.get('/api/data')
if (result.ok) {
  // 成功
} else {
  logger.error('API', '请求失败', result.error)
}

// ✅ 简单场景：使用 safe-fetch
const data = await safeJsonFetch('/api/data')
if (data) {
  // 成功
}

// ❌ 避免：裸 try-catch
try {
  await fetch('/api/data')
} catch (e) {
  console.error(e) // 信息不够详细
}
```

### 4. 类型安全

```typescript
// ✅ 必须：使用 Zod 校验外部数据
import { BookmarkRecordArraySchema } from '@/types/schema'

const raw = await indexedDBManager.getAllBookmarks()
const validated = BookmarkRecordArraySchema.parse(raw)

// ❌ 禁止：直接使用未校验的数据
const bookmarks = await indexedDBManager.getAllBookmarks()
return bookmarks // 可能不符合类型
```

---

## 📊 模块使用统计

| 模块                     | 使用次数 | 状态       | 价值     |
| ------------------------ | -------- | ---------- | -------- |
| `indexeddb/manager`      | 50+      | ⭐⭐⭐⭐⭐ | 核心模块 |
| `logging/logger`         | 100+     | ⭐⭐⭐⭐⭐ | 核心模块 |
| `events/event-bus`       | 30+      | ⭐⭐⭐⭐⭐ | 核心模块 |
| `storage/modern-storage` | 15+      | ⭐⭐⭐⭐☆  | 重要模块 |
| `http/api-client`        | 2        | ⭐⭐⭐☆☆   | 有价值   |
| `http/safe-fetch`        | 2        | ⭐⭐⭐☆☆   | 有价值   |
| `events/event-stream`    | 1        | ⭐⭐⭐☆☆   | 专用场景 |

---

## 🎯 最佳实践

### 1. 事件驱动架构

```typescript
// ✅ 推荐：通过事件解耦
emitEvent('bookmark:created', bookmark)

// ❌ 避免：直接调用其他模块
otherService.handleBookmarkCreated(bookmark)
```

### 2. 统一错误处理

```typescript
// ✅ 推荐：使用 logger + Result
const result = await operation()
if (!result.ok) {
  logger.error('Module', '操作失败', result.error)
  return
}

// ❌ 避免：静默失败
await operation().catch(() => {}) // 错误被吞没
```

### 3. 数据校验

```typescript
// ✅ 推荐：Zod 校验 + 类型推导
const data = schema.parse(raw)
// data 类型自动推导

// ❌ 避免：手动类型断言
const data = raw as BookmarkRecord // 不安全
```

---

## 🔗 相关文档

- [架构规范](../../../文档/项目管理/架构规范-快速开始.md)
- [单向数据流说明](../../../单向数据流架构说明.md)
- [Service Worker 环境说明](../../../文档/开发指南/Service-Worker-环境说明.md)

---

**最后更新**: 2025-10-27  
**维护者**: Infrastructure Team  
**架构评分**: ⭐⭐⭐⭐⭐ (5/5)
