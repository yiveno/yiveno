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

/**
 * 书签自动分类 Prompt
 */
export function createAutoOrganizePrompt(
  bookmarks: Array<{
    id: string
    title: string
    url: string
    content?: string
    existingTags?: string[]
  }>,
  userNotes?: string
): string {
  const bookmarksText = bookmarks
    .map(
      (b, i) =>
        `${i + 1}. [id: ${b.id}] ${b.title}\n   URL: ${b.url}\n   ${b.content ? `内容: ${b.content.slice(0, 100)}` : ''}\n   ${b.existingTags?.length ? `标签: ${b.existingTags.join(', ')}` : ''}`
    )
    .join('\n\n')

  const trimmedNotes = userNotes?.trim()
  const userNotesSection = trimmedNotes ? `\n用户补充说明（请优先参考）：\n${trimmedNotes}\n` : ''

  return `你是一个专业的书签管理助手。请根据以下书签列表，生成一个合理的文件夹结构来组织这些书签。
${userNotesSection}
要求：
1. 文件夹路径使用 "/" 分隔（最多 3 层），例如："技术/前端/React"
2. 文件夹名称应该简洁、有意义、符合中文习惯
3. 每个文件夹下的书签数量应该适中（建议 5-20 个）
4. bookmarkIds 必须逐字复制书签列表中 [id: xxx] 的 xxx，禁止用序号代替、禁止编造
5. 每个文件夹的 bookmarkIds 不能为空（至少包含 1 个真实 id）
6. 每个书签只能出现在一个文件夹中
7. 对于无法明确分类的书签，可以放到 "其他/未分类"

书签列表：
${bookmarksText}

请返回 JSON 格式的文件夹结构，格式如下：
{
  "folders": [
    {
      "name": "技术文档",
      "path": "技术文档",
      "bookmarkIds": ["真实id1", "真实id2"]
    },
    {
      "name": "前端开发",
      "path": "技术文档/前端开发",
      "bookmarkIds": ["真实id3"]
    }
  ]
}

只返回 JSON，不要其他内容。`
}
