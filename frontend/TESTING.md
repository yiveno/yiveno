# 🧪 Yiveno 测试指南

## 📊 测试策略概览

本项目采用**测试金字塔**策略，并遵循 **Chrome Extensions 官方测试最佳实践**：

```
           E2E (5%)              ← 关键用户流程
          /        \
         /          \
    集成测试 (15%)              ← 组件交互
       /            \
      /              \
   单元测试 (60%)               ← 业务逻辑
    /                \
   /                  \
静态分析 (20%)                  ← TypeScript + ESLint
```

**基于官方文档**: https://developer.chrome.com/docs/extensions/how-to/test/

**测试统计**：

- ✅ 50 个测试全部通过
- ✅ 包含 12 个 Service Worker 生命周期测试
- ✅ 所有测试符合 TypeScript 类型安全要求

---

## 🚀 快速开始

### 安装依赖

测试框架的核心依赖已经安装完成 ✅：

```bash
cd frontend

# ✅ 已安装的核心依赖
# - vitest @vitest/ui
# - @vue/test-utils happy-dom
# - fake-indexeddb

# 可选：安装覆盖率工具
bun add -d @vitest/coverage-v8

# 可选：安装视觉测试工具
bun add -d @playwright/test
npx playwright install
```

### 运行测试

```bash
# 运行所有单元测试
bun run test:unit

# 运行所有集成测试
bun run test:integration

# 运行 Chrome API 测试
bun run test:chrome

# 运行性能测试
bun run test:performance

# 运行 Service Worker 单元测试
bun run test:service-worker

# 运行所有测试（包含 Service Worker 单元测试）
bun run test:run

# 带 UI 界面运行测试
bun run test:ui

# 生成覆盖率报告
bun run test:coverage
```

---

## 📁 测试文件结构

```
frontend/src/tests/
├── setup.ts                       # 全局测试配置
├── unit/                          # 单元测试
│   ├── bookmark-tree.test.ts      # 书签树结构测试
│   └── search-service.test.ts     # 搜索服务测试
├── integration/                   # 集成测试
│   └── BookmarkList.test.ts       # 组件集成测试
├── chrome/                        # Chrome API 测试
│   ├── background-script.test.ts  # Background Script 测试
│   └── alarms.test.ts             # Alarms API 测试
├── service-worker/                # Service Worker 测试 ⭐ 新增
│   ├── lifecycle.test.ts          # 生命周期单元测试
│   ├── termination.test.ts        # 终止 E2E 测试（需要 Puppeteer）
│   └── README.md                  # Service Worker 测试说明
├── contract/                      # 契约测试
│   └── api.test.ts
├── performance/                   # 性能测试
│   └── benchmark.test.ts
└── visual/                        # 视觉回归测试
    └── bookmark-list.spec.ts
```

---

## 🎯 测试类型详解

### 1. 单元测试 ⭐⭐⭐⭐⭐

**目标**：测试独立的函数和类

**工具**：Vitest + Happy-DOM

**示例**：

```typescript
import { describe, it, expect } from 'vitest'

describe('书签树结构转换', () => {
  it('应该正确转换扁平书签列表', () => {
    const bookmarks = [
      { id: '1', title: 'Bookmark 1' },
      { id: '2', title: 'Bookmark 2' }
    ]

    const map = flattenTreeToMap(bookmarks)

    expect(map.size).toBe(2)
    expect(map.get('1')?.title).toBe('Bookmark 1')
  })
})
```

**覆盖范围**：

- ✅ 工具函数 (`utils/`)
- ✅ 业务逻辑 (`application/`, `core/`)
- ✅ 数据转换
- ✅ 算法实现

---

### 2. 集成测试 ⭐⭐⭐⭐

**目标**：测试组件交互和用户行为

**工具**：Vitest + Vue Test Utils

**示例**：

```typescript
import { mount } from '@vue/test-utils'

describe('BookmarkList 组件', () => {
  it('应该在点击书签时触发事件', async () => {
    const wrapper = mount(BookmarkList, {
      props: { bookmarks: [{ id: '1', title: 'Test' }] }
    })

    await wrapper.find('[data-testid="bookmark-item"]').trigger('click')

    expect(wrapper.emitted('select')).toBeTruthy()
  })
})
```

**覆盖范围**：

- ✅ Vue 组件渲染
- ✅ 用户交互（点击、输入）
- ✅ 事件触发
- ✅ Props 和 Emits

---

### 3. Chrome API 测试 ⭐⭐⭐⭐⭐

**目标**：测试 Chrome Extension 特有功能

**工具**：Vitest + Chrome API Mock（增强版 - 真实异步行为）

**示例**：

```typescript
describe('Background Script', () => {
  it('应该能够同步书签', async () => {
    vi.mocked(chrome.bookmarks.getTree).mockResolvedValue([...])

    const bookmarks = await syncManager.syncBookmarks()

    expect(chrome.bookmarks.getTree).toHaveBeenCalled()
    expect(bookmarks).toHaveLength(2)
  })
})
```

**覆盖范围**：

- ✅ `chrome.bookmarks.*` API
- ✅ `chrome.storage.*` API（真实异步行为）
- ✅ `chrome.runtime.*` 消息传递
- ✅ `chrome.alarms.*` 定时任务 ⭐ **新增**
- ✅ Background Script 逻辑

**Chrome Extensions 最佳实践**：

- ✅ Mock 实现真实的异步行为（使用 setTimeout）
- ✅ 支持 callback 和 Promise 两种 API 风格
- ✅ 模拟 `chrome.runtime.lastError` 错误场景
- ✅ 完整的 Alarms API 测试（12 个测试）

---

### 4. 性能测试 ⭐⭐⭐⭐

**目标**：确保关键操作的性能

**工具**：Vitest Benchmark

**示例**：

```typescript
it('搜索 2 万书签应该在 100ms 内', () => {
  const bookmarks = Array.from({ length: 20000 }, ...)

  const start = performance.now()
  const results = searchAppService.search('Vue')
  const duration = performance.now() - start

  expect(duration).toBeLessThan(100)
})
```

**性能目标**：

- ✅ 处理 2 万书签 < 200ms
- ✅ 搜索 2 万书签 < 100ms
- ✅ 树结构转换 < 100ms
- ✅ 内存使用 < 50MB

---

### 5. 契约测试 ⭐⭐⭐

**目标**：验证前后端接口契约

**工具**：Vitest + Zod

**示例**：

```typescript
it('API 应该返回正确的格式', async () => {
  const response = await fetch('/api/health')
  const data = await response.json()

  const result = HealthCheckSchema.safeParse(data)
  expect(result.success).toBe(true)
})
```

---

### 6. 视觉回归测试 ⭐⭐⭐

**目标**：确保 UI 不会意外变化

**工具**：Playwright

**示例**：

```typescript
test('BookmarkList 默认状态', async ({ page }) => {
  await page.goto('/management.html')
  await expect(page).toHaveScreenshot('bookmark-list.png')
})
```

---

## 🛠️ 测试工具配置

### Vitest 配置

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    coverage: {
      provider: 'v8',
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60
      }
    }
  }
})
```

### Chrome API Mock

```typescript
// src/tests/setup.ts
// ✅ 增强版 Mock - 模拟真实异步行为
global.chrome = {
  runtime: {
    sendMessage: vi.fn((message, callback?) => {
      const response = { success: true, data: message }
      // 模拟异步行为
      if (callback) {
        setTimeout(() => callback(response), 0)
      }
      return Promise.resolve(response)
    }),
    lastError: null // 用于模拟错误
  },
  bookmarks: {
    getTree: vi.fn((callback?) => {
      const result = []
      if (callback) {
        setTimeout(() => callback(result), 0)
      }
      return Promise.resolve(result)
    }),
    create: vi.fn()
  },
  alarms: {
    create: vi.fn(),
    onAlarm: {
      addListener: vi.fn(),
      trigger: alarm => {
        /* 测试用 */
      }
    }
  }
}
```

---

## 📈 覆盖率目标

| 类型           | 目标覆盖率 | 当前状态                 |
| -------------- | ---------- | ------------------------ |
| 单元测试       | 70%+       | ✅ 9 个测试通过          |
| 集成测试       | 核心组件   | ✅ 5 个测试通过          |
| Chrome API     | 核心 API   | ✅ 16 个测试通过         |
| 性能测试       | 关键路径   | ✅ 4 个测试通过          |
| 契约测试       | API 接口   | ✅ 4 个测试通过          |
| Service Worker | 生命周期   | ✅ 12 个测试通过 ⭐ 新增 |

**总计：50 个测试全部通过 ✅**

**性能表现：**

- 处理 2 万书签：~2ms（目标 < 200ms）⚡
- 搜索 2 万书签：~1ms（目标 < 100ms）⚡
- 处理 10 层嵌套树：~0ms（目标 < 500ms）⚡

---

## ✅ 测试最佳实践

### 1. 命名规范

```typescript
// ✅ 好的测试名称
it('应该在点击书签时触发 select 事件')
it('应该正确处理空书签列表')
it('搜索 2 万书签应该在 100ms 内')

// ❌ 不好的测试名称
it('test 1')
it('works')
```

### 2. 使用 data-testid

```vue
<!-- ✅ 使用 data-testid -->
<button data-testid="search-button">搜索</button>

<!-- ❌ 依赖 class 名称 -->
<button class="btn-primary">搜索</button>
```

### 3. 测试独立性

```typescript
// ✅ 每个测试独立
beforeEach(() => {
  searchService.clearIndex()
})

// ❌ 测试之间有依赖
let sharedState = {}
```

### 4. Mock 外部依赖

```typescript
// ✅ Mock Chrome API
vi.mocked(chrome.bookmarks.getTree).mockResolvedValue([...])

// ❌ 依赖真实 Chrome API
const tree = await chrome.bookmarks.getTree()
```

---

## 🚨 常见问题

### Q: 测试运行很慢怎么办？

A: 使用 `--run` 模式而不是 watch 模式：

```bash
bun run test:run  # 快速运行
bun run test      # watch 模式（开发时使用）
```

### Q: 如何只运行特定测试？

A: 使用 `.only` 或文件路径：

```typescript
it.only('只运行这个测试', () => {})
```

```bash
bun run test src/tests/unit/bookmark-tree.test.ts
```

### Q: 如何调试测试？

A: 使用 Vitest UI：

```bash
bun run test:ui
```

然后在浏览器中打开 `http://localhost:51204/__vitest__/`

---

## 📚 相关资源

- [Vitest 文档](https://vitest.dev/)
- [Vue Test Utils 文档](https://test-utils.vuejs.org/)
- [Playwright 文档](https://playwright.dev/)
- [Chrome Extension Testing](https://developer.chrome.com/docs/extensions/mv3/testing/)

---

## 🎯 下一步

1. ✅ 测试框架已完全配置并运行
2. ✅ 50 个测试全部通过（包含 12 个 Service Worker 测试）
3. ✅ 性能测试表现优异
4. ⏳ 可选：安装 `@vitest/coverage-v8` 生成覆盖率报告
5. ⏳ 可选：安装 `@playwright/test` 进行视觉回归测试
6. ⏳ 可选：安装 `puppeteer` 运行 Service Worker E2E 测试
7. ⏳ 为更多业务逻辑添加单元测试
8. ⏳ 为更多组件添加集成测试
9. ⏳ 集成到 CI/CD 流程

---

**最后更新**: 2025-01-22  
**维护者**: Yiveno Team
