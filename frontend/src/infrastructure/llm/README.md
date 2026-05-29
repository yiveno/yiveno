# LLM 模块使用指南

## 概述

LLM 模块提供了统一的 AI 功能接口，支持：

- 用户自带 API Key（OpenAI / Claude / Gemini / DeepSeek）- 最高优先级
- Chrome 内置 LLM（Gemini Nano）- 免费、本地处理

## 架构

```
AIAppService (应用层)
    ↓
LLMAdapter (适配器层)
    ↓
┌─────────────────┬─────────────────┐
│ UserLLMClient   │ BuiltInLLMClient│
│ (用户 API Key)   │ (Chrome 内置)    │
└─────────────────┴─────────────────┘
```

## Provider 优先级

1. **用户自带 API Key**（OpenAI / Claude / Gemini / DeepSeek）
   - 隐私最优，数据不经过产品服务器
   - 直接调用第三方 API
   - 需要用户在设置页面配置

2. **Chrome Built-in LLM**（Gemini Nano）
   - 极端 fallback（覆盖率低，功能受限）
   - 完全免费，本地处理
   - 需要 Chrome 127+ 并手动启用

## 降级策略

```
用户有 Key → 直接调第三方 API
用户无 Key → Chrome Built-in（如果可用）
两者都不可用 → 抛出错误，上层降级到本地 Fuse.js 搜索
```

## 快速开始

### 1. 书签分类

```typescript
import { aiAppService } from '@/application/ai/ai-app-service'

// 分类单个书签
const result = await aiAppService.categorizeBookmark({
  title: 'React Hooks 指南',
  url: 'https://react.dev/hooks',
  description: 'React Hooks 的完整指南'
})

console.log(result.category) // '技术'
console.log(result.provider) // 'builtin' 或 'openai' 或 'claude' 或 'gemini'
```

### 2. 生成书签摘要

```typescript
const summary = await aiAppService.summarizeBookmark({
  title: 'React Hooks 指南',
  url: 'https://react.dev/hooks',
  content: 'React Hooks 是 React 16.8 引入的新特性...'
})

console.log(summary.summary) // 'React Hooks 是 React 16.8...'
```

### 3. 一键整理书签

```typescript
const bookmarks = [
  { id: '1', title: 'React 文档', url: 'https://react.dev' },
  { id: '2', title: 'Vue 文档', url: 'https://vuejs.org' },
  { id: '3', title: '设计系统', url: 'https://designsystem.com' }
]

const results = await aiAppService.organizeBookmarks(bookmarks)

results.forEach(result => {
  console.log(`${result.id}: ${result.category} -> ${result.suggestedFolder}`)
})
```

### 4. 语义搜索增强

```typescript
const enhanced = await aiAppService.enhanceSemanticSearch('react hooks')

console.log(enhanced.keywords) // ['react', 'hooks']
console.log(enhanced.concepts) // ['React Hooks', '函数组件']
console.log(enhanced.synonyms) // ['useState', 'useEffect']
```

### 5. 生成标签

```typescript
const tags = await aiAppService.generateTags({
  title: 'React Hooks 指南',
  url: 'https://react.dev/hooks',
  content: '...'
})

console.log(tags) // ['React', 'Hook', 'JavaScript']
```

## 高级用法

### 检测可用 LLM 提供者

```typescript
import { llmAdapter } from '@/infrastructure/llm/llm-adapter'

const capabilities = await llmAdapter.detectCapabilities()

capabilities.forEach(cap => {
  console.log(`${cap.provider}: ${cap.available ? '可用' : '不可用'}`)
  if (!cap.available) {
    console.log(`原因: ${cap.reason}`)
  }
})
```

### 手动选择 LLM 提供者

LLM 适配器会自动根据优先级选择可用的提供者：

1. 用户自带 API Key（如果已配置）
2. Chrome Built-in LLM（如果可用）

无需手动选择，系统会自动降级。

### 获取 Chrome 内置 LLM 启用指南

```typescript
const guide = aiAppService.getBuiltInLLMGuide()

console.log(guide.title)
console.log(guide.steps)
console.log(guide.requirements)
```

## 使用场景

### 场景 1: 添加书签时自动分类

```typescript
// 在书签创建后
chrome.bookmarks.onCreated.addListener(async (id, bookmark) => {
  if (bookmark.url) {
    const category = await aiAppService.categorizeBookmark({
      title: bookmark.title,
      url: bookmark.url
    })

    // 将书签移动到对应文件夹
    await chrome.bookmarks.move(id, {
      parentId: category.category
    })
  }
})
```

### 场景 2: 批量整理书签栏

```typescript
// 在用户点击"一键整理"按钮时
async function organizeBookmarkBar() {
  const bookmarkBar = await chrome.bookmarks.getTree()
  const bookmarks = extractBookmarks(bookmarkBar[0])

  const results = await aiAppService.organizeBookmarks(bookmarks)

  // 应用整理结果
  for (const result of results) {
    await chrome.bookmarks.move(result.id, {
      parentId: getOrCreateFolder(result.suggestedFolder)
    })
  }
}
```

### 场景 3: 增强搜索功能

```typescript
// 在用户输入搜索查询时
async function enhancedSearch(query: string) {
  const enhanced = await aiAppService.enhanceSemanticSearch(query)

  // 使用增强的关键词进行搜索
  const results = await bookmarkSearchService.search(enhanced.keywords.join(' '))

  return results
}
```

## 注意事项

1. **用户 API Key 配置**
   - 支持 OpenAI、Anthropic Claude、Google Gemini、DeepSeek
   - 需要用户在设置页面填写 API Key
   - 数据直接发送到第三方 API，不经过产品服务器

2. **Chrome 内置 LLM 需要手动启用**
   - 需要 Chrome 127+ 版本
   - 需要在 `chrome://flags` 中启用相关功能
   - 需要下载约 22GB 的模型文件

3. **自动降级**
   - 优先使用用户自带 API Key
   - 如果未配置，降级到 Chrome 内置 LLM
   - 如果都不可用，抛出错误

4. **性能考虑**
   - 用户 API Key：需要网络请求，可能有延迟
   - 内置 LLM：本地处理，无网络延迟

5. **成本考虑**
   - 用户 API Key：用户自行承担 API 费用
   - 内置 LLM：完全免费

## 错误处理

```typescript
try {
  const result = await aiAppService.categorizeBookmark(bookmark)
} catch (error) {
  if (error.message.includes('没有可用的 AI 服务')) {
    // 提示用户配置 API Key 或启用 Chrome 内置 LLM
    showConfigGuide()
  } else if (error.message.includes('API Key')) {
    // API Key 配置错误
    showApiKeyError()
  } else {
    // 其他错误
    console.error('分类失败:', error)
  }
}
```
