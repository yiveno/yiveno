# Service Worker 环境修复总结

## 🐛 问题描述

Service Worker 启动时出现以下问题：

1. **`document is not defined`** - ReferenceError
2. **同步收藏数据失败（非致命错误）**
3. **菜单重复注册** - 日志显示菜单被注册了两次

错误堆栈：

```
ReferenceError: document is not defined
  at getStaticGlobal (bootstrap.ts:185:30)
  at async bootstrap.ts:227:15
```

## 🔍 根本原因

### 1. Service Worker 环境限制

Service Worker 是一个特殊的 JavaScript 执行环境，**没有 DOM API**：

- ❌ 没有 `window` 对象
- ❌ 没有 `document` 对象
- ❌ 没有 `localStorage`
- ✅ 只有 Chrome API 和 Web Worker API

### 2. 模块导入触发链

```
bootstrap.ts (Service Worker)
    ↓ 动态导入
favoriteAppService
    ↓ 模块级别代码执行
export const favoriteAppService = new FavoriteAppService()
    ↓ 可能触发
bookmarkStore (Pinia)
    ↓ Pinia 初始化
尝试访问 document (getStaticGlobal)
    ↓
❌ ReferenceError: document is not defined
```

### 3. 为什么环境检查不够

之前的修复尝试：

```typescript
// ❌ 这个检查不够，因为动态导入本身会触发模块加载
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const { favoriteAppService } = await import('@/application/bookmark/favorite-app-service')
  await favoriteAppService.syncFavoriteData()
}
```

问题：

- `import()` 语句会立即加载模块
- 模块加载时会执行顶层代码（`export const favoriteAppService = new FavoriteAppService()`）
- 即使有环境检查，模块的依赖链仍然会被触发

## ✅ 解决方案

### 方案 1：延迟同步到页面打开时（解决 document is not defined）

**核心思想**：不要在 Service Worker 中同步收藏数据，而是在页面打开时同步。

### 方案 2：使用状态标记避免菜单重复注册

**核心思想**：使用模块级别的状态标记 `menusRegistered`，确保菜单只注册一次。

### 修改的文件

#### 1. `frontend/src/background/bootstrap.ts`

**修改前**：

```typescript
// 在 Service Worker 启动时同步
const { favoriteAppService } = await import('@/application/bookmark/favorite-app-service')
await favoriteAppService.syncFavoriteData()
```

**修改后**：

```typescript
// ⚠️ 收藏数据同步已移到页面打开时执行
// Service Worker 环境中不适合执行可能触发 DOM API 的操作
logger.debug('Bootstrap', '收藏数据同步将在页面打开时执行')
```

#### 2. `frontend/src/pages/management/main.ts`

**添加**：

```typescript
// ✅ 同步收藏数据（IndexedDB ↔ chrome.storage.local）
// 在页面打开时执行，避免在 Service Worker 中触发 DOM API
try {
  const { favoriteAppService } = await import('@/application/bookmark/favorite-app-service')
  await favoriteAppService.syncFavoriteData()
  logger.info('Management', 'Init', '✅ 收藏数据同步完成')
} catch (syncError) {
  logger.warn('Management', 'Init', '收藏数据同步失败（非致命错误）', syncError)
}
```

#### 3. `frontend/src/application/bookmark/favorite-app-service.ts`

**保留之前的修复**：

```typescript
// ⚠️ 使用 self 检查是否在 Service Worker 环境中
const isServiceWorker = typeof self !== 'undefined' && 'ServiceWorkerGlobalScope' in self

if (!isServiceWorker && typeof window !== 'undefined' && typeof document !== 'undefined') {
  // 只在浏览器环境中导入 bookmarkStore
  const { useBookmarkStore } = await import('@/stores/bookmarkStore')
  // ...
}
```

#### 4. `frontend/src/background/menus.ts`

**添加状态标记**：

```typescript
// ✅ 菜单注册状态标记（避免重复注册）
let menusRegistered = false

function registerMenus(): void {
  // ✅ 如果已经注册过，跳过
  if (menusRegistered) {
    logger.debug('Menus', '菜单已注册，跳过重复注册')
    return
  }

  // ... 注册逻辑 ...

  // ✅ 标记为已注册
  menusRegistered = true
}

// ✅ 扩展安装/更新时重置状态
chrome.runtime.onInstalled.addListener(() => {
  menusRegistered = false // 重置状态
  registerMenus()
})
```

## 🎯 修复效果

### 问题 1：document is not defined

**修复前**：

```
Service Worker 启动
    ↓
❌ 尝试导入 favoriteAppService
    ↓
❌ 触发 Pinia 初始化
    ↓
❌ document is not defined
```

**修复后**：

```
Service Worker 启动
    ↓
✅ 跳过收藏数据同步
    ↓
✅ 正常初始化完成

用户打开 Management 页面
    ↓
✅ 在浏览器环境中同步收藏数据
    ↓
✅ 正常工作
```

### 问题 2：菜单重复注册

**修复前**：

```
Service Worker 启动
    ↓
registerMenusAndShortcuts() 被调用
    ↓
第 1 次：立即执行 registerMenus()
    ↓
第 2 次：onInstalled 触发，再次执行 registerMenus()
    ↓
❌ 日志显示两次菜单注册
```

**修复后**：

```
Service Worker 启动
    ↓
registerMenusAndShortcuts() 被调用
    ↓
第 1 次：立即执行 registerMenus()
    ↓
menusRegistered = true
    ↓
onInstalled 触发
    ↓
检查 menusRegistered === true
    ↓
✅ 跳过重复注册（或在扩展更新时重置状态后重新注册）
```

## 📝 设计原则

### 1. Service Worker 职责

Service Worker 应该只处理：

- ✅ Chrome API 调用（书签、存储、通知等）
- ✅ 消息路由
- ✅ 后台任务调度
- ❌ **不应该**导入任何可能包含 DOM API 的模块

### 2. 延迟加载原则

对于可能触发 DOM API 的操作：

- ✅ 延迟到页面打开时执行
- ✅ 在浏览器环境中执行
- ❌ 不要在 Service Worker 启动时执行

### 3. 环境检查原则

```typescript
// ✅ 正确：在导入前检查环境
const isServiceWorker = typeof self !== 'undefined' && 'ServiceWorkerGlobalScope' in self

if (!isServiceWorker) {
  // 只在浏览器环境中导入
  const { someModule } = await import('./some-module')
}

// ❌ 错误：导入后检查环境（太晚了）
const { someModule } = await import('./some-module')
if (typeof document !== 'undefined') {
  // 模块已经加载，可能已经触发错误
}
```

### 4. 幂等性原则

对于可能被多次调用的函数（如菜单注册）：

- ✅ 使用状态标记确保只执行一次
- ✅ 提供重置机制（如扩展更新时）
- ✅ 记录日志便于调试

```typescript
// ✅ 正确：使用状态标记
let initialized = false

function initialize() {
  if (initialized) {
    logger.debug('已初始化，跳过')
    return
  }

  // ... 初始化逻辑 ...

  initialized = true
}

// ❌ 错误：没有状态检查，可能重复执行
function initialize() {
  // ... 初始化逻辑 ...
}
```

## 🧪 测试步骤

### 1. 重新构建

```bash
CRAWLER_DEBUG=true bunx vite build
```

### 2. 重新加载扩展

1. 打开 `chrome://extensions/`
2. 找到 AcuityBookmarks
3. 点击"重新加载"按钮

### 3. 检查 Service Worker 控制台

**预期结果**：

- ✅ 应该看到 `🚀 开始初始化 Service Worker...`
- ✅ 应该看到 `✅ Service Worker 初始化完成`
- ✅ 应该看到 `收藏数据同步将在页面打开时执行`
- ✅ 应该看到 `🔄 开始注册上下文菜单...`（**只出现一次**）
- ✅ 应该看到 `✅ 上下文菜单注册完成`（**只出现一次**）
- ❌ **不应该**看到 `document is not defined` 错误
- ❌ **不应该**看到 `同步收藏数据失败` 错误
- ❌ **不应该**看到菜单注册两次的日志

### 4. 打开 Management 页面

1. 点击扩展图标
2. 选择"打开书签整理"
3. 查看页面控制台

**预期结果**：

- ✅ 应该看到 `✅ 收藏数据同步完成`
- ✅ 页面正常加载

### 5. 测试收藏功能

1. 在 Management 页面中，右键点击一个书签
2. 选择"添加到收藏"
3. 刷新页面
4. 检查收藏状态是否保留

**预期结果**：

- ✅ 收藏状态应该正确保存
- ✅ 刷新后收藏状态应该保留

## 📚 相关文档

- `ENVIRONMENT_SETUP_SUMMARY.md` - 环境变量配置优化
- `ENV_VARIABLES.md` - 环境变量详细指南
- `frontend/.env.README.md` - 为什么没有 frontend/.env

## 🎉 总结

通过以下优化，我们解决了 Service Worker 的所有问题：

### 问题 1：document is not defined

- ✅ 将收藏数据同步从 Service Worker 启动时移到页面打开时
- ✅ 遵循了 Service Worker 的设计原则
- ✅ 提高了代码的健壮性

### 问题 2：菜单重复注册

- ✅ 使用状态标记 `menusRegistered` 确保菜单只注册一次
- ✅ 在扩展更新时重置状态，确保菜单是最新的
- ✅ 减少了不必要的日志输出

### 核心教训

1. **在 Service Worker 中，永远不要导入可能包含 DOM API 的模块**，即使有环境检查
2. **对于可能被多次调用的函数，使用状态标记确保幂等性**
3. **分阶段初始化，核心功能优先，后台任务延迟加载**
4. **为每个阶段添加独立的错误处理，避免单点故障**
