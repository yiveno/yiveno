/**
 * LLM Prompt 模板
 *
 * 包含各种 AI 任务的 Prompt 模板
 *
 * 注意：书签分类功能已迁移到基于向量的本地推荐（folderVectorService）
 */

/**
 * 书签摘要 Prompt
 */
export function createSummarizePrompt(bookmark: {
  title: string
  url: string
  content?: string
}): string {
  return `请为这个书签生成一个简洁的摘要（50字以内）：

标题：${bookmark.title}
URL：${bookmark.url}
${bookmark.content ? `内容：${bookmark.content.slice(0, 500)}` : ''}

摘要：`
}

/**
 * 语义搜索增强 Prompt
 */
export function createSemanticSearchPrompt(query: string): string {
  return `用户搜索查询："${query}"

请理解用户的搜索意图，并提取关键概念和同义词。
返回一个 JSON 对象，包含：
- keywords: 关键词数组
- concepts: 核心概念数组
- synonyms: 同义词数组

只返回 JSON，不要其他内容。`
}

/**
 * 标签生成 Prompt
 */
export function createTagGenerationPrompt(bookmark: {
  title: string
  url: string
  content?: string
}): string {
  return `基于这个书签的信息，生成 2-3 个相关标签：
- 标签应该简洁且高级（例如："React", "JavaScript", "Web开发"）
- 只返回 JSON 数组格式的字符串，不要额外解释

书签信息：
标题：${bookmark.title}
URL：${bookmark.url}
${bookmark.content ? `内容摘要：${bookmark.content.slice(0, 300)}` : ''}

返回格式示例：["React", "Hook", "性能优化"]`
}
