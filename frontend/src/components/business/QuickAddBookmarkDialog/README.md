# QuickAddBookmarkDialog 组件

快速添加书签对话框组件，类似于 Chrome 原生的添加书签界面。

## 功能特性

- ✅ 显示网站图标和页面信息
- ✅ 可编辑书签名称
- ✅ 选择目标文件夹（支持层级显示）
- ✅ **AI 自动分类建议**（如果启用）
- ✅ 回车快速确认
- ✅ ESC 快速取消

## 使用方式

### 全局使用（推荐）

```vue
<!-- 在页面根组件中添加 -->
<template>
  <GlobalQuickAddBookmark />
</template>
```

### 手动使用

```vue
<template>
  <QuickAddBookmarkDialog
    :show="showDialog"
    :title="pageTitle"
    :url="pageUrl"
    :fav-icon-url="favIconUrl"
    :enable-a-i="true"
    @update:show="showDialog = $event"
    @confirm="handleConfirm"
  />
</template>

<script setup>
import { ref } from 'vue'
import { QuickAddBookmarkDialog } from '@/components'

const showDialog = ref(false)
const pageTitle = ref('示例页面')
const pageUrl = ref('https://example.com')
const favIconUrl = ref('')

function handleConfirm(data) {
  console.log('添加书签：', data)
  // data = { title, url, folderId }
}
</script>
```

## Props

| 属性         | 类型      | 默认值  | 说明                 |
| ------------ | --------- | ------- | -------------------- |
| `show`       | `boolean` | `false` | 是否显示对话框       |
| `title`      | `string`  | `''`    | 书签标题             |
| `url`        | `string`  | `''`    | 书签 URL             |
| `favIconUrl` | `string`  | `''`    | 网站图标 URL         |
| `enableAI`   | `boolean` | `true`  | 是否启用 AI 自动分类 |

## Events

| 事件          | 参数                       | 说明               |
| ------------- | -------------------------- | ------------------ |
| `update:show` | `boolean`                  | 对话框显示状态变化 |
| `confirm`     | `{ title, url, folderId }` | 用户确认添加       |

## AI 自动分类

当 `enableAI` 为 `true` 时，组件会自动调用 AI 服务分析书签内容，并建议合适的文件夹。

**工作流程：**

1. 对话框打开
2. 后台调用 `aiAppService.categorizeBookmark()`
3. 根据分类结果查找匹配的文件夹
4. 自动选中建议的文件夹
5. 显示 AI 建议标识

**如果文件夹不存在：**

- 显示警告信息（后续可支持自动创建）

## 触发方式

### 方式 1：快捷键

**Mac/Windows:** `Alt+K`

💡 **为什么选择这个快捷键？**

- ✅ **格式一致**：与我们其他快捷键（Alt+A/B/S）保持一致
- ✅ **简单可靠**：避免 manifest 解析错误
- ✅ **不冲突**：Chrome 原生不使用 Alt+K
- ✅ **易记易按**：K = "快"速添加，位置方便

### 方式 2：右键菜单

1. 在页面任意位置右键
2. 选择"添加到书签..."

### 方式 3：在链接上右键

1. 在链接上右键
2. 选择"添加到书签..."
3. 会自动填充链接地址

## 样式

参考 Chrome 原生添加书签对话框设计：

- 简洁清晰的布局
- 明显的网站图标
- 可见的 AI 建议（绿色高亮）
- 标准的确认/取消按钮

## 技术实现

### 文件夹加载

```typescript
await chrome.bookmarks.getTree()
// 递归遍历，收集所有文件夹
// 格式：技术 > 前端 > React
```

### AI 分类

```typescript
const result = await aiAppService.categorizeBookmark({
  title: '...',
  url: '...'
})
// 返回：{ category: '技术', provider: 'cloudflare' }
```

### 创建书签

```typescript
await chrome.runtime.sendMessage({
  type: 'CREATE_BOOKMARK',
  data: { title, url, parentId }
})
```

## 注意事项

1. **需要权限**：`bookmarks` 权限（已在 manifest.json 中配置）
2. **AI 依赖**：需要用户配置 API Key 或启用 Chrome 内置 LLM
3. **异步操作**：AI 分类需要 1-3 秒，会显示加载状态

## 后续改进

- [ ] 支持自动创建不存在的文件夹
- [ ] 支持记忆用户习惯（domain → 文件夹映射）
- [ ] 支持批量添加书签
- [ ] 支持自定义快捷键
