# Product

## Register

product

## Users

知识工作者、开发者/设计师、学生等「存过但找不到」的人。使用场景：在浏览中随手保存书签/划词摘录，之后只记得模糊线索，需要立刻找回原文。

## Product Purpose

Yiveno 是个人信息寻回系统（Capture 低负担 + Recall 高置信）。用户把重要内容存进来，日后用任意一点线索找回「对，就是这个」。不是书签管理器、不是 AI 自动整理工具、不是聊天机器人。

## Brand Personality

沉稳、直接、可托付。语气短、不夸张；强调找回与线索，不卖「管理/整理/AI」。

## Anti-references

- AI Bookmark Manager / 「管理你的书签」/ 「自动整理一切」类产品话术与 UI
- 把对话/聊天做成主路径的助手壳
- 暗示「永久保存看过的所有内容」、未上线能力装成已可用

## Design Principles

1. **找回优先**：每个界面先服务「用线索找到它」，浏览/设置是辅线。
2. **诚实可用**：只呈现已上线能力；空状态与线索解释要说清楚「为什么是/不是这个」。
3. **低负担捕获**：保存路径尽量短；不强迫整理、分类、打标签。
4. **本地事实源**：记忆在本地可信；UI 经 Background 读写，不直连 Chrome 书签 API。
5. **一致性胜过花样**：扩展多页壳（Popup / 记忆库 / 设置 / 详情）共用同一导航与视觉词汇。

## Accessibility & Inclusion

目标对齐 WCAG 2.2 AA 常用项：可键盘操作、对比度达标、`prefers-reduced-motion` 下关闭装饰性动效；文案避免 exclusive jargon。
