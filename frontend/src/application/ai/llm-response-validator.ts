/**
 * LLM 响应验证器
 *
 * 处理 LLM 的各种异常情况：
 * - 格式错误
 * - 幻觉（编造数据）
 * - 不完整响应
 * - 非预期格式
 */

import { z } from 'zod'
import { logger } from '@/infrastructure/logging/logger'

const loggerPrefix = 'LLMResponseValidator'

/**
 * 预定义的书签分类列表
 */
export const VALID_CATEGORIES = [
  '技术',
  '设计',
  '学习',
  '工具',
  '娱乐',
  '新闻',
  '商业',
  '其他'
] as const

export type BookmarkCategory = (typeof VALID_CATEGORIES)[number]

/**
 * 书签分类结果的 Zod Schema
 */
const BookmarkCategoryResultSchema = z.object({
  id: z.string().min(1, 'ID 不能为空'),
  category: z.string().min(1, '分类不能为空')
})

const BookmarkCategoryArraySchema = z.array(BookmarkCategoryResultSchema)

export interface ValidatedCategoryResult {
  id: string
  category: BookmarkCategory
  isHallucination: boolean // 是否是幻觉（编造的 ID）
  categoryNormalized: boolean // 分类是否被标准化
}

/**
 * 提取 JSON 的多种策略
 */
function extractJSON(text: string): string | null {
  // 策略 1: 提取 markdown 代码块中的 JSON
  const markdownMatch = text.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/)
  if (markdownMatch) {
    return markdownMatch[1] ?? null
  }

  // 策略 2: 提取第一个完整的 JSON 数组
  const jsonArrayMatch = text.match(/\[[\s\S]*\]/)
  if (jsonArrayMatch) {
    return jsonArrayMatch[0]
  }

  // 策略 3: 移除前后的解释文本
  const cleanedText = text
    .replace(/^[^[]*/, '') // 移除开头非 [ 字符
    .replace(/[^\]]*$/, '') // 移除结尾非 ] 字符

  if (cleanedText.startsWith('[') && cleanedText.endsWith(']')) {
    return cleanedText
  }

  return null
}

/**
 * 标准化分类名称（处理 LLM 可能返回的变体）
 */
export function normalizeCategory(category: string): BookmarkCategory {
  const normalized = category.trim()

  // 完全匹配
  if (VALID_CATEGORIES.includes(normalized as BookmarkCategory)) {
    return normalized as BookmarkCategory
  }

  // 模糊匹配（处理常见变体）
  const variants: Record<string, BookmarkCategory> = {
    编程: '技术',
    开发: '技术',
    代码: '技术',
    IT: '技术',
    UI: '设计',
    UX: '设计',
    美工: '设计',
    教程: '学习',
    文档: '学习',
    教育: '学习',
    课程: '学习',
    实用工具: '工具',
    在线工具: '工具',
    游戏: '娱乐',
    视频: '娱乐',
    音乐: '娱乐',
    资讯: '新闻',
    媒体: '新闻',
    博客: '新闻',
    电商: '商业',
    购物: '商业'
  }

  const variant = Object.keys(variants).find(
    key => normalized.includes(key) || key.includes(normalized)
  )

  if (variant) {
    const mappedCategory = variants[variant]
    if (!mappedCategory) {
      return '其他'
    }
    logger.debug(
      loggerPrefix,
      `标准化分类: ${category} -> ${mappedCategory}`
    )
    return mappedCategory
  }

  // 默认分类
  logger.warn(loggerPrefix, `未知分类: ${category}，使用默认分类"其他"`)
  return '其他'
}

/**
 * 验证和清理 LLM 返回的书签分类结果
 */
export function validateCategoryResults(
  text: string,
  expectedBookmarkIds: string[]
): ValidatedCategoryResult[] {
  const results: ValidatedCategoryResult[] = []
  const expectedIdSet = new Set(expectedBookmarkIds)

  try {
    // 1. 尝试提取 JSON
    const jsonText = extractJSON(text)
    if (!jsonText) {
      logger.warn(loggerPrefix, 'JSON 提取失败', { text: text.slice(0, 200) })
      return []
    }

    // 2. 解析 JSON
    let parsedData: unknown
    try {
      parsedData = JSON.parse(jsonText)
    } catch (error) {
      logger.error(loggerPrefix, 'JSON 解析失败', {
        error,
        jsonText: jsonText.slice(0, 200)
      })
      return []
    }

    // 3. Zod 验证
    const validationResult = BookmarkCategoryArraySchema.safeParse(parsedData)
    if (!validationResult.success) {
      logger.error(loggerPrefix, 'Zod 验证失败', {
        error: validationResult.error,
        data: parsedData
      })
      return []
    }

    // 4. 检测幻觉和标准化分类
    for (const item of validationResult.data) {
      const isHallucination = !expectedIdSet.has(item.id)
      const originalCategory = item.category
      const normalizedCategory = normalizeCategory(item.category)

      if (isHallucination) {
        logger.warn(loggerPrefix, '检测到幻觉：LLM 编造了不存在的书签 ID', {
          id: item.id,
          category: item.category
        })
        continue // 跳过幻觉数据
      }

      results.push({
        id: item.id,
        category: normalizedCategory,
        isHallucination: false,
        categoryNormalized: originalCategory !== normalizedCategory
      })

      if (originalCategory !== normalizedCategory) {
        logger.debug(loggerPrefix, '分类已标准化', {
          id: item.id,
          original: originalCategory,
          normalized: normalizedCategory
        })
      }
    }

    // 5. 检测缺失的书签
    const returnedIds = new Set(results.map(r => r.id))
    const missingIds = expectedBookmarkIds.filter(id => !returnedIds.has(id))
    if (missingIds.length > 0) {
      logger.warn(loggerPrefix, 'LLM 响应缺少部分书签', {
        total: expectedBookmarkIds.length,
        returned: results.length,
        missing: missingIds.length,
        missingIds: missingIds.slice(0, 5) // 只记录前 5 个
      })
    }

    return results
  } catch (error) {
    logger.error(loggerPrefix, '验证过程异常', {
      error,
      text: text.slice(0, 200)
    })
    return []
  }
}

/**
 * 解析简单格式（降级策略）
 * 格式：序号|类别 或 id|类别
 */
export function parseSimpleFormat(
  text: string,
  bookmarks: Array<{ id: string }>
): ValidatedCategoryResult[] {
  const results: ValidatedCategoryResult[] = []
  const lines = text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.includes('|'))

  for (let i = 0; i < lines.length && i < bookmarks.length; i++) {
    const line = lines[i]
    const bookmark = bookmarks[i]

    if (!line || !bookmark) continue

    const parts = line.split('|')
    const categoryText = parts[parts.length - 1]?.trim()

    if (categoryText) {
      const normalizedCategory = normalizeCategory(categoryText)
      results.push({
        id: bookmark.id,
        category: normalizedCategory,
        isHallucination: false,
        categoryNormalized: categoryText !== normalizedCategory
      })
    }
  }

  return results
}

/**
 * 统计验证结果
 */
export interface ValidationStats {
  total: number
  hallucinations: number
  normalized: number
  missing: number
  successRate: number
}

export function getValidationStats(
  results: ValidatedCategoryResult[],
  expectedCount: number
): ValidationStats {
  return {
    total: results.length,
    hallucinations: results.filter(r => r.isHallucination).length,
    normalized: results.filter(r => r.categoryNormalized).length,
    missing: expectedCount - results.length,
    successRate: results.length / expectedCount
  }
}
