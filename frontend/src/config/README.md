# 🎛️ 配置系统使用指南

> **设计理念**：统一管理所有可配置变量，消除魔法数字，为后续接入全局配置开关系统做准备。

---

## 📋 目录

- [配置概览](#配置概览)
- [使用示例](#使用示例)
- [配置分类](#配置分类)
- [最佳实践](#最佳实践)
- [迁移指南](#迁移指南)

---

## 📊 配置概览

所有配置统一在 `frontend/src/config/constants.ts` 中管理，共 **15 个配置对象**：

| 配置对象              | 作用                 | 配置项数 |
| --------------------- | -------------------- | -------- |
| `PERFORMANCE_CONFIG`  | 性能优化相关时间配置 | 7        |
| `NOTIFICATION_CONFIG` | 通知系统配置         | 5        |
| `BOOKMARK_CONFIG`     | 书签管理配置         | 6        |
| `UI_CONFIG`           | UI 交互配置          | 2        |
| `CHROME_CONFIG`       | Chrome API 配置      | 5        |
| `ERROR_CONFIG`        | 错误处理配置         | 4        |
| `DEBUG_CONFIG`        | 调试配置             | 3        |
| `API_CONFIG`          | API 基础配置         | 2        |
| `CRAWLER_CONFIG`      | 爬虫配置             | 9        |
| `AI_CONFIG`           | AI 配置              | 7        |
| `ANIMATION_CONFIG`    | 动画与过渡配置       | 14       |
| `SIZE_CONFIG`         | 尺寸与间距配置       | 26       |
| `TIMEOUT_CONFIG`      | 超时与延迟配置       | 20       |
| `WORKER_CONFIG`       | Worker 与并发配置    | 7        |
| `LIMIT_CONFIG`        | 限制与阈值配置       | 4        |

**总计：121+ 配置项**

---

## 💡 使用示例

### 基础用法

```typescript
import {
  NOTIFICATION_CONFIG,
  TIMEOUT_CONFIG,
  SIZE_CONFIG,
  ANIMATION_CONFIG
} from '@/config/constants'

// ✅ 使用通知配置
const toastTimeout = NOTIFICATION_CONFIG.DEFAULT_TOAST_TIMEOUT

// ✅ 使用超时配置
setTimeout(callback, TIMEOUT_CONFIG.DELAY.SHORT)

// ✅ 使用尺寸配置
const iconSize = SIZE_CONFIG.ICON.MD

// ✅ 使用动画配置
const animationDuration = ANIMATION_CONFIG.DURATION.FAST
const easing = ANIMATION_CONFIG.EASING.STANDARD
```

### 在 Vue 组件中使用

```vue
<script setup lang="ts">
import { ANIMATION_CONFIG, SIZE_CONFIG } from '@/config/constants'

// 使用配置
const transitionDuration = `${ANIMATION_CONFIG.DURATION.NORMAL}ms`
const iconSize = SIZE_CONFIG.ICON.LG
</script>

<style scoped>
.element {
  /* ✅ 使用 CSS 变量引用配置 */
  transition: all v-bind(transitionDuration);
}
</style>
```

### 在 CSS 中使用

```typescript
// 1. 定义 CSS 变量
const style = {
  '--animation-duration': `${ANIMATION_CONFIG.DURATION.NORMAL}ms`,
  '--icon-size': `${SIZE_CONFIG.ICON.MD}px`
}

// 2. 在 CSS 中使用
// .element {
//   animation-duration: var(--animation-duration);
//   width: var(--icon-size);
// }
```

---

## 🗂️ 配置分类详解

### 1️⃣ 时间相关配置

#### `NOTIFICATION_CONFIG` - 通知系统

```typescript
{
  DEFAULT_TOAST_TIMEOUT: 9999000,      // Toast 默认显示时长
  MAX_TOAST_LIFETIME: 9999000,         // Toast 最大生命周期
  SUPPRESS_WINDOW: 1200,               // 通知抑制窗口期
  TOAST_OFFSET_TOP: 90                 // Toast 顶部偏移
}
```

#### `TIMEOUT_CONFIG` - 超时与延迟

```typescript
{
  API: {
    STANDARD: 10000,                   // 标准 API 超时
    FAST: 5000,                        // 快速 API 超时
    SLOW: 30000                        // 慢速 API 超时
  },
  DELAY: {
    IMMEDIATE: 0,                      // 立即执行
    SHORT: 100,                        // 短延迟
    MEDIUM: 200,                       // 中等延迟
    STANDARD: 500,                     // 标准延迟
    LONG: 1000                         // 长延迟
  },
  CACHE: {
    SHORT: 5000,                       // 短期缓存
    MEDIUM: 900000,                    // 中期缓存（15分钟）
    LONG: 3600000                      // 长期缓存（1小时）
  }
}
```

### 2️⃣ UI 相关配置

#### `ANIMATION_CONFIG` - 动画与过渡

```typescript
{
  DURATION: {
    INSTANT: 100,                      // 极快动画
    FAST: 200,                         // 快速动画
    NORMAL: 300,                       // 正常动画
    SLOW: 500,                         // 慢速动画
    TOAST_ENTER: 240,                  // Toast 入场
    RIPPLE: 600                        // 水波纹效果
  },
  EASING: {
    STANDARD: 'cubic-bezier(...)',     // 标准缓动
    EMPHASIZED: 'cubic-bezier(...)',   // 强调缓动
    DECELERATE: 'cubic-bezier(...)'    // 减速缓动
  }
}
```

#### `SIZE_CONFIG` - 尺寸与间距

```typescript
{
  ICON: {
    XS: 12, SM: 16, MD: 20,            // 图标尺寸
    NORMAL: 22, LG: 24, XL: 32
  },
  SPACING: {
    XS: 4, SM: 8, MD: 12,              // 间距
    NORMAL: 16, LG: 20, XL: 24
  },
  RADIUS: {
    SM: 4, NORMAL: 8,                  // 圆角
    LG: 12, FULL: 9999
  },
  TOAST: {
    MIN_WIDTH: 320,                    // Toast 最小宽度
    MAX_WIDTH: 480,                    // Toast 最大宽度
    CLOSE_BUTTON: 28                   // 关闭按钮尺寸
  }
}
```

### 3️⃣ 性能相关配置

#### `WORKER_CONFIG` - Worker 与并发

```typescript
{
  BATCH: {
    STANDARD: 100,                     // 标准批次
    SMALL: 5,                          // 小批次
    LARGE: 2000                        // 大批次
  },
  CONCURRENCY: {
    STANDARD: 5,                       // 标准并发
    CRAWLER_GLOBAL: 2,                 // 爬虫全局并发
    CRAWLER_PER_DOMAIN: 1              // 爬虫单域名并发
  }
}
```

#### `LIMIT_CONFIG` - 限制与阈值

```typescript
{
  DATA: {
    SEARCH_RESULTS: 20,                // 搜索结果限制
    SEARCH_HISTORY: 10,                // 搜索历史长度
    LARGE_DATASET: 1000                // 大数据集阈值
  },
  CRAWLER: {
    DAILY_LIMIT: 200                   // 每日爬取限制
  }
}
```

---

## ✅ 最佳实践

### 1. 始终使用配置常量

```typescript
// ❌ 不好的做法：硬编码
setTimeout(callback, 300)
icon.size = 20
toast.timeout = 3000

// ✅ 好的做法：使用配置
import { TIMEOUT_CONFIG, SIZE_CONFIG, NOTIFICATION_CONFIG } from '@/config/constants'

setTimeout(callback, TIMEOUT_CONFIG.DELAY.STANDARD)
icon.size = SIZE_CONFIG.ICON.MD
toast.timeout = NOTIFICATION_CONFIG.DEFAULT_TOAST_TIMEOUT
```

### 2. 为配置添加注释

```typescript
// ✅ 说明为什么使用这个配置
const timeout = TIMEOUT_CONFIG.DELAY.BOOKMARK_OP // 确保 Chrome API 完成
```

### 3. 使用语义化的配置名称

```typescript
// ❌ 不好的命名
const delay1 = 100
const delay2 = 500

// ✅ 好的命名
const hoverDebounce = PERFORMANCE_CONFIG.HOVER_DEBOUNCE_TIME
const pageCloseDelay = PERFORMANCE_CONFIG.PAGE_CLOSE_DELAY
```

### 4. 避免重复定义

```typescript
// ❌ 不好的做法：重复定义
const shortDelay = 100
const quickDelay = 100
const fastDelay = 100

// ✅ 好的做法：统一引用
const delay = TIMEOUT_CONFIG.DELAY.SHORT // 所有 100ms 延迟统一使用
```

---

## 🔄 迁移指南

### 步骤 1：识别魔法数字

在代码中搜索硬编码的数字：

```bash
# 搜索 setTimeout 中的硬编码
grep -r "setTimeout.*[0-9]" frontend/src

# 搜索 size/width/height 的硬编码
grep -r "size:\s*[0-9]" frontend/src
```

### 步骤 2：映射到配置

| 魔法数字       | 配置常量                                 |
| -------------- | ---------------------------------------- |
| `300` (延迟)   | `TIMEOUT_CONFIG.DELAY.STANDARD`          |
| `200` (防抖)   | `PERFORMANCE_CONFIG.HOVER_DEBOUNCE_TIME` |
| `20` (图标)    | `SIZE_CONFIG.ICON.MD`                    |
| `10000` (超时) | `TIMEOUT_CONFIG.API.STANDARD`            |

### 步骤 3：替换并测试

```typescript
// 修改前
await new Promise(resolve => setTimeout(resolve, 500))

// 修改后
import { TIMEOUT_CONFIG } from '@/config/constants'
await new Promise(resolve => setTimeout(resolve, TIMEOUT_CONFIG.DELAY.STANDARD))
```

### 步骤 4：验证

```bash
# 运行类型检查
bun run typecheck:force

# 运行代码检查
bun run lint:check:force
```

---

## 🚀 未来扩展

### 全局配置开关系统

配置系统已经为接入全局配置开关做好准备：

```typescript
// 未来可能的实现
interface GlobalConfigManager {
  get<K extends keyof typeof NOTIFICATION_CONFIG>(
    category: 'NOTIFICATION',
    key: K
  ): (typeof NOTIFICATION_CONFIG)[K]

  set<K extends keyof typeof NOTIFICATION_CONFIG>(
    category: 'NOTIFICATION',
    key: K,
    value: (typeof NOTIFICATION_CONFIG)[K]
  ): void
}

// 用户可以在设置页面动态调整
configManager.set('NOTIFICATION', 'DEFAULT_TOAST_TIMEOUT', 5000)
```

### 配置持久化

```typescript
// 保存到 chrome.storage.local
await chrome.storage.local.set({
  'config.notification': NOTIFICATION_CONFIG,
  'config.animation': ANIMATION_CONFIG
})

// 加载用户自定义配置
const userConfig = await chrome.storage.local.get('config.notification')
```

### 配置导入/导出

```typescript
// 导出配置
const config = {
  notification: NOTIFICATION_CONFIG,
  animation: ANIMATION_CONFIG
  // ...
}
const blob = new Blob([JSON.stringify(config)], { type: 'application/json' })

// 导入配置
const imported = JSON.parse(await file.text())
```

---

## 📚 相关文档

- [产品文档](../../../docs/product/otterSage-产品文档-v3.0.md)（仓库内唯一产品正文）
- [项目文档目录](../../../docs/)

---

## 🤝 贡献指南

### 添加新配置

1. 在 `constants.ts` 中找到对应的配置对象
2. 添加新的配置项，并附上完整的 JSDoc 注释
3. 更新此 README 文档
4. 运行测试确保无破坏性变更

### 修改现有配置

1. ⚠️ **谨慎修改**：配置可能被多处引用
2. 使用全局搜索确认影响范围
3. 更新所有相关注释和文档
4. 充分测试受影响的功能

---

**最后更新**: 2025-10-31
**维护者**: otterSage Team
