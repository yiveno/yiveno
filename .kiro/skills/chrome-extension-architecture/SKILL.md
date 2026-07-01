---
name: chrome-extension-architecture
description: Review Chrome Extension code for DDD architecture violations, Service Worker compatibility, and data flow patterns. Use when working with background scripts, Vue components, or IndexedDB operations.
---

# Chrome Extension 架构守护

> **目的**：确保严格遵守 Yiveno 的 DDD 架构和 Chrome Extension 最佳实践

## 🛡️ 架构铁律（必须严格遵守）

### 铁律 1：单向数据流（禁止违反）

**数据流向图：**

```
Chrome Bookmarks API
       ↓
Background Script (唯一监听者)
       ↓
IndexedDB (唯一数据源)
       ↓
Pinia Store (响应式状态)
       ↓
Vue Components (UI 展示)
       ↓
用户操作 → chrome.runtime.sendMessage → Background Script
```

**检查清单：**

- [ ] 前端组件是否直接调用 `chrome.bookmarks.*`？（❌ 禁止）
- [ ] 是否通过 `chrome.runtime.sendMessage` 通知 Background Script？（✅ 正确）
- [ ] Background Script 是否是唯一的 Chrome API 监听者？（✅ 必须）
- [ ] IndexedDB 是否是唯一的数据源？（✅ 必须）

**快速判断：**

```typescript
// ❌ 错误：前端直接调用 Chrome API
// 文件位置：frontend/src/pages/**/*.vue 或 frontend/src/components/**/*.vue
async function createBookmark() {
  await chrome.bookmarks.create({ title: '新书签' }) // ❌ 违反单向数据流
}

// ✅ 正确：通过消息通知 Background Script
async function createBookmark() {
  await chrome.runtime.sendMessage({
    type: 'CREATE_BOOKMARK',
    payload: { title: '新书签' }
  })
}
```

---

### 铁律 2：DDD 分层架构（严格执行）

**分层依赖规则：**

```
frontend/src/
├── presentation/     (Vue组件、页面)
│   ↓ 只能调用
├── application/      (业务逻辑、服务)
│   ↓ 只能调用
├── core/             (领域模型、纯业务)
│   ↓ 只能调用
└── infrastructure/   (IndexedDB、Chrome API、HTTP)
```

**检查清单：**

- [ ] `presentation/` 是否直接访问 `infrastructure/`？（❌ 禁止）
- [ ] `core/` 是否依赖 `infrastructure/`？（❌ 禁止）
- [ ] 是否通过 `application/` 层协调？（✅ 正确）

**快速判断：**

```typescript
// ❌ 错误：跨层访问
// 文件：frontend/src/presentation/components/BookmarkList.vue
import { indexedDBManager } from '@/infrastructure/indexeddb/manager' // ❌

// ✅ 正确：通过 application 层
// 文件：frontend/src/presentation/components/BookmarkList.vue
import { bookmarkService } from '@/application/bookmark/bookmark-service' // ✅
```

---

### 铁律 3：IndexedDB 唯一入口

**必须使用：**

```typescript
import { indexedDBManager } from '@/infrastructure/indexeddb/manager'

// ✅ 正确
const bookmarks = await indexedDBManager.getAllBookmarks()
await indexedDBManager.updateBookmark(id, updates)
```

**绝对禁止：**

```typescript
// ❌ 禁止直接使用原生 API
const db = await indexedDB.open('bookmarks', 1)
const request = db.transaction('bookmarks').objectStore('bookmarks').getAll()
```

**检查清单：**

- [ ] 是否通过 `indexedDBManager` 访问 IndexedDB？（✅ 必须）
- [ ] 是否直接使用 `indexedDB.open()`？（❌ 禁止）

---

### 铁律 4：Service Worker 环境隔离（最高优先级）

**Background Script 运行在 Service Worker 环境，没有 DOM API！**

**环境对比表：**

| API    | 网页环境              | Service Worker | 正确用法                   |
| ------ | --------------------- | -------------- | -------------------------- |
| 定时器 | `window.setTimeout()` | `setTimeout()` | ✅ 直接用全局 `setTimeout` |
| 网络   | `window.fetch()`      | `fetch()`      | ✅ 直接用全局 `fetch`      |
| 存储   | `localStorage`        | ❌ 不存在      | ✅ 用 `chrome.storage.*`   |
| DOM    | `document.*`          | ❌ 不存在      | ❌ Background 中禁止使用   |

**检查清单：**

- [ ] Background Script 是否使用 `window.*`？（❌ 禁止）
- [ ] Background Script 是否使用 `document.*`？（❌ 禁止）
- [ ] Background Script 是否使用 `localStorage`？（❌ 禁止）
- [ ] 定时器类型是否正确？（✅ `ReturnType<typeof setTimeout>`）

**快速判断：**

```typescript
// ❌ 错误：Service Worker 不兼容
class BookmarkSync {
  private timer: number | null = null // ❌ 类型错误

  start() {
    this.timer = window.setTimeout(() => {
      // ❌ 没有 window
      const data = localStorage.getItem('key') // ❌ 没有 localStorage
      document.body.innerHTML = 'hi' // ❌ 没有 document
    }, 1000)
  }
}

// ✅ 正确：Service Worker 兼容
class BookmarkSync {
  private timer: ReturnType<typeof setTimeout> | null = null // ✅

  start() {
    this.timer = setTimeout(async () => {
      // ✅ 全局函数
      const result = await chrome.storage.local.get('key') // ✅
      console.log(result.key) // ✅
    }, 1000)
  }
}
```

**受影响文件（写代码时必须检查）：**

- `frontend/src/background/**/*.ts` - **所有文件**
- `frontend/src/services/**/*-service.ts` - **可能在 Background 调用的服务**

---

## 🚨 常见错误速查

### 错误 1：违反单向数据流

**症状：** 前端组件直接调用 `chrome.bookmarks.*`

**检查方法：**

```bash
# 搜索前端组件中的 Chrome API 调用
grep -r "chrome.bookmarks" frontend/src/components/
grep -r "chrome.bookmarks" frontend/src/pages/
```

**修复方法：** 改为通过 `chrome.runtime.sendMessage` 通知 Background Script

---

### 错误 2：跨层访问

**症状：** `presentation/` 直接导入 `infrastructure/`

**检查方法：**

```bash
# 搜索 presentation 层中的 infrastructure 导入
grep -r "from '@/infrastructure" frontend/src/presentation/
grep -r "from '@/infrastructure" frontend/src/components/
```

**修复方法：** 通过 `application/` 层访问

---

### 错误 3：Service Worker 不兼容

**症状：** Background Script 使用 `window.*` 或 `localStorage`

**检查方法：**

```bash
# 搜索 Background Script 中的不兼容 API
grep -r "window\." frontend/src/background/
grep -r "localStorage" frontend/src/background/
grep -r "document\." frontend/src/background/
```

**修复方法：** 使用 Service Worker 兼容的 API

---

## 📚 相关文档

- [项目架构规范](../../.kiro/steering/project.md)
- [AGENTS.md](../../AGENTS.md)
- [产品文档](../../docs/product/Yiveno-产品文档-v3.0.md)

---

**最后更新**: 2026-05-20  
**维护者**: Kiro AI
