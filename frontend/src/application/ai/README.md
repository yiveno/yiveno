# AI 模块设计文档

## 架构说明

**策略：Pro 托管 LLM 默认 + 自定义 API Key 可选**

### LLM Provider 优先级

1. **用户自带 API Key**（OpenAI / Claude / Gemini / DeepSeek）
   - 配置后优先使用
   - 直连第三方，不经 otterSage 服务器

2. **Pro 托管 LLM**（DeepSeek V4 Flash）
   - Pro 用户默认，无需配置
   - 经 `POST /api/ai/hosted/complete` 代理
   - 月度配额服务端控制（默认 999 次/月）

### 为什么采用托管 LLM？

| 问题     | 旧方案（仅 BYOK） | 新方案                           |
| -------- | ----------------- | -------------------------------- |
| Pro 留存 | 付费后仍需配 Key  | Pro 开箱即用                     |
| 覆盖率   | 依赖用户自行配置  | 100% Pro 用户                    |
| 成本     | 用户承担          | 平台承担，可控（~$0.26/用户/月） |

### 隐私分层

| 模式           | 数据路径                               | 适用                           |
| -------------- | -------------------------------------- | ------------------------------ |
| 本地 Embedding | 完全本地                               | 语义搜索、自动归档推荐（核心） |
| 自定义 API Key | 浏览器 → 第三方                        | 隐私敏感用户                   |
| Pro 托管 LLM   | 浏览器 → Worker → DeepSeek（标题+URL） | 默认 Pro 体验                  |

## 核心能力分层

```
本地 Embedding（核心，完全离线）
    ↓
LLM 增强（摘要 / 整理 / 标签 / 文件夹描述）
    自定义 API Key → Pro 托管 LLM
```

长文本 Embedding 前采用简单截断。

## 一键整理

- 批次大小：40 条/批
- 每批 maxTokens：4000，解析失败重试 1 次
- 1000 条书签 ≈ 25 次 LLM 调用（计入月度配额）

## 响应验证

整理结果经 `organize-response-parser.ts` 多层校验：

- JSON 提取与 Zod 校验
- bookmarkId 幻觉检测
- 缺失书签确定性兜底

## 核心文件

- `ai-app-service.ts` — AI 应用服务（摘要、标签、一键整理）
- `organize-response-parser.ts` — 整理结果解析与校验
- `../infrastructure/llm/llm-adapter.ts` — LLM 统一适配器
- `../infrastructure/llm/hosted-llm-client.ts` — Pro 托管客户端
- `../infrastructure/llm/user-llm-client.ts` — 自定义 API Key 客户端
- `../core/ai/prompts.ts` — Prompt 模板

## 降级策略

```
自定义 API Key（已配置）
    ↓
Pro 托管 LLM
    ↓
错误 → 本地 Embedding / 规则兜底
```
