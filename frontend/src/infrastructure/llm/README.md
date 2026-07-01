# LLM 模块使用指南

## 概述

LLM 模块提供统一的 AI 文本补全接口，支持：

1. **用户自带 API Key**（OpenAI / Claude / Gemini / DeepSeek）— 最高优先级，直连第三方
2. **Pro 托管 LLM**（DeepSeek V4 Flash）— Pro 用户默认，经 Yiveno 后端代理

## 架构

```
AIAppService (应用层)
    ↓
LLMAdapter (适配器层)
    ↓
┌─────────────────┬─────────────────┐
│ UserLLMClient   │ HostedLLMClient │
│ (自定义 API Key) │ (Pro 托管 AI)    │
└─────────────────┴─────────────────┘
         │                    │
    直连第三方 API      backend /api/ai/hosted/*
```

## Provider 优先级

1. **用户自带 API Key** — 配置后优先使用，数据不经 Yiveno 服务器
2. **Pro 托管 LLM** — 未配置 Key 时，Pro 登录用户自动使用（默认 DeepSeek V4 Flash，月配额 999 次）

## 降级策略

```
已配置 API Key → 直连第三方
    ↓ 未配置
Pro 托管 LLM（需登录 + Pro 订阅 + 配额未满）
    ↓ 不可用
抛出错误，上层降级到本地 Embedding / FlexSearch
```

## 快速开始

### 生成书签摘要

```typescript
import { aiAppService } from '@/application/ai/ai-app-service'

const summary = await aiAppService.summarizeBookmark({
  title: 'React Hooks 指南',
  url: 'https://react.dev/hooks',
  content: 'React Hooks 是 React 16.8 引入的新特性...'
})

console.log(summary.summary)
console.log(summary.provider) // 'hosted' | 'openai' | 'claude' | ...
```

### 一键整理

```typescript
const { folders, provider } = await aiAppService.autoOrganizeBookmarks(bookmarks, {
  userNotes: '按技术栈分类'
})
```

### 检测可用 LLM

```typescript
import { llmAdapter } from '@/infrastructure/llm/llm-adapter'

const ready = await llmAdapter.hasAvailableProvider()
const label = await llmAdapter.getCurrentProviderLabel()
```

### 查询托管配额

```typescript
import { hostedLLMClient } from '@/infrastructure/llm/hosted-llm-client'

const quota = await hostedLLMClient.fetchQuota()
// { model, used, limit, remaining, monthKey }
```

## 核心文件

| 文件                   | 职责                            |
| ---------------------- | ------------------------------- |
| `llm-adapter.ts`       | 统一适配器，Provider 选择与降级 |
| `hosted-llm-client.ts` | Pro 托管 LLM，调用后端代理      |
| `user-llm-client.ts`   | 用户自带 API Key，直连第三方    |

## 注意事项

1. **Pro 托管 AI**：发送书签标题 + URL 到服务器；设置页已披露
2. **自定义 API Key**：仅存本机，直连第三方，隐私最优
3. **配额**：托管 LLM 月度次数由服务端 `AI_HOSTED_MONTHLY_QUOTA` 控制
4. **统一入口**：所有 LLM 调用须经 `llmAdapter.complete()`，禁止绕过

## 错误处理

```typescript
try {
  await llmAdapter.complete(prompt)
} catch (error) {
  if (String(error).includes('配额')) {
    // 提示配置 API Key 或下月再用
  } else if (String(error).includes('Pro')) {
    // 提示升级 Pro
  } else if (String(error).includes('登录')) {
    // 提示登录
  }
}
```
