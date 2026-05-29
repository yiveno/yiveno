# 时间国际化检查清单

## 📊 当前状态

### ✅ 已完成

- [x] 时间格式化工具 (`time-formatter.ts`)
- [x] `RecentItem.vue` - 最近访问时间
- [x] `SubscriptionSettings.vue` - 订阅到期日期格式化
- [x] `sync-progress.ts` - 同步进度时间显示
- [x] `SyncProgressDialog.vue` - 数字格式化
- [x] 所有语言包翻译键补全（zh_CN, en, ja, ko, ar, zh_TW）

### ⚠️ 已修复（无需进一步处理）

#### 1. 订阅设置页面 (`SubscriptionSettings.vue`)

**问题**: 硬编码 `'zh-CN'`

```typescript
// ❌ 当前代码 (第 218 行)
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN', {
    // 硬编码中文
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}
```

**修复方案**:

```typescript
// ✅ 修复后
import { formatDateTime } from '@/utils/time-formatter'

function formatDate(dateString: string): string {
  const timestamp = new Date(dateString).getTime()
  return formatDateTime(timestamp, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}
```

---

#### 2. 同步进度时间 (`sync-progress.ts`)

**问题**: 硬编码中文文案

```typescript
// ❌ 当前代码 (第 165 行)
export function formatTime(ms: number): string {
  if (ms < 1000) {
    return '不到 1 秒' // 硬编码中文
  }

  if (ms < 60000) {
    const seconds = Math.ceil(ms / 1000)
    return `${seconds} 秒` // 硬编码中文
  }

  const minutes = Math.ceil(ms / 60000)
  return `${minutes} 分钟` // 硬编码中文
}
```

**修复方案**:

```typescript
// ✅ 修复后
import { t } from '@/utils/i18n-helpers'

export function formatTime(ms: number): string {
  if (ms < 1000) {
    return t('time.less_than_second')
  }

  if (ms < 60000) {
    const seconds = Math.ceil(ms / 1000)
    return t('time.seconds', String(seconds))
  }

  const minutes = Math.ceil(ms / 60000)
  return t('time.minutes', String(minutes))
}
```

**需要添加的翻译键**:

```json
{
  "time.less_than_second": {
    "message": "不到 1 秒",
    "description": "时间少于1秒的显示"
  },
  "time.seconds": {
    "message": "$1 秒",
    "description": "秒数显示，$1 是数字"
  },
  "time.minutes": {
    "message": "$1 分钟",
    "description": "分钟数显示，$1 是数字"
  }
}
```

---

#### 3. 数字本地化 (`SyncProgressDialog.vue`)

**问题**: 使用 `toLocaleString()` 但没有指定语言

```vue
<!-- ❌ 当前代码 (第 76-77 行) -->
{{ progress.current.toLocaleString() }} / {{ progress.total.toLocaleString() }}
```

**修复方案**:

```vue
<!-- ✅ 修复后 -->
<script setup>
import { formatNumber } from '@/utils/i18n-helpers'
</script>

<template>
  {{ formatNumber(progress.current) }} /
  {{ formatNumber(progress.total) }}
</template>
```

---

#### 4. 其他时间相关代码（不需要国际化）

以下代码用于**内部逻辑**，不需要国际化：

```typescript
// ✅ 这些不需要修改（用于计算，不显示给用户）
new Date().getFullYear() // 获取年份（用于分类）
new Date().getMonth() // 获取月份（用于分类）
new Date().getHours() // 获取小时（用于推荐算法）
new Date().getDay() // 获取星期（用于推荐算法）
```

**位置**:

- `smart-recommendation-engine.ts` - 推荐算法
- `bookmark-sync-service.ts` - 书签分类
- `indexeddb-repository.ts` - 数据存储

---

## 🔧 修复步骤

### Step 1: 修复订阅设置页面

```bash
# 文件: frontend/src/pages/settings/sections/SubscriptionSettings.vue
```

### Step 2: 修复同步进度时间

```bash
# 文件: frontend/src/types/sync-progress.ts
```

### Step 3: 修复数字格式化

```bash
# 文件: frontend/src/components/base/SyncProgressDialog/SyncProgressDialog.vue
```

### Step 4: 添加翻译键

```bash
# 文件: frontend/_locales/zh_CN/messages.json
# 文件: frontend/_locales/en/messages.json
# ... 其他语言
```

### Step 5: 测试验证

```bash
# 类型检查
bun run typecheck

# 代码规范
bun run lint

# 手动测试
# 1. 切换语言
# 2. 查看订阅到期时间
# 3. 查看同步进度
# 4. 查看最近访问时间
```

---

## 📝 翻译键清单

需要添加到所有语言包：

```json
{
  "time.less_than_second": {
    "message": "不到 1 秒",
    "description": "时间少于1秒"
  },
  "time.seconds": {
    "message": "$1 秒",
    "description": "秒数，$1是数字"
  },
  "time.minutes": {
    "message": "$1 分钟",
    "description": "分钟数，$1是数字"
  }
}
```

**英文翻译**:

```json
{
  "time.less_than_second": {
    "message": "less than 1 second",
    "description": "Time less than 1 second"
  },
  "time.seconds": {
    "message": "$1 seconds",
    "description": "Number of seconds, $1 is the number"
  },
  "time.minutes": {
    "message": "$1 minutes",
    "description": "Number of minutes, $1 is the number"
  }
}
```

---

## ✅ 完成标准

- [x] 所有用户可见的时间都使用国际化函数
- [x] 数字格式化使用 `formatNumber()`
- [x] 日期格式化使用 `formatDateTime()`
- [x] 相对时间使用 `formatRelativeTime()`
- [x] 所有翻译键已添加到 6 种语言
- [x] 类型检查通过
- [x] 代码规范检查通过
- [ ] 手动测试通过（待用户验证）

---

**实际耗时**: 约 30 分钟
**优先级**: P0 (高) ✅ 已完成
**难度**: ⭐ (简单)
