/**
 * 查询意图识别器
 *
 * 根据用户输入特征自动判断最优搜索策略：
 * - fuse     精确关键词，本地快速匹配
 * - semantic 自然语言描述，语义理解
 * - hybrid   模糊区域，Fuse 先返回 + Semantic 异步补充
 */

/** 技术关键词集合（命中则倾向 Fuse） */
const TECH_KEYWORDS = new Set([
  'css',
  'js',
  'ts',
  'vue',
  'react',
  'api',
  'sql',
  'git',
  'npm',
  'cdn',
  'html',
  'php',
  'ios',
  'ui',
  'ux',
  'ai',
  'ml',
  'db',
  'http',
  'url',
  'svg',
  'png',
  'pdf',
  'json',
  'xml',
  'rss',
  'ssh',
  'ftp',
  'dns',
  'ip'
])

/** 语义关键词集合（命中则倾向 Semantic/Hybrid） */
const SEMANTIC_KEYWORDS = new Set([
  '代码',
  '编程',
  '开发',
  '技术',
  '教程',
  '文档',
  '博客',
  '学习',
  'code',
  'programming',
  'development',
  'tutorial',
  'documentation',
  'blog',
  'learning'
])

/** 自然语言触发词（命中则倾向 Semantic） */
const NATURAL_TRIGGERS = [
  /怎么|如何|什么是|为什么|哪里|哪个|推荐|教程|学习|入门|指南/,
  /how to|what is|why|where|best|guide|tutorial|learn|intro/i
]

/** 最小触发语义搜索的字符数 */
const MIN_SEMANTIC_LENGTH = 2 // 降低到 2，支持"代码"这样的短词

export type QueryIntent = 'fuse' | 'semantic' | 'hybrid'

export interface IntentResult {
  intent: QueryIntent
  confidence: number
  reason: string
}

/**
 * 识别查询意图
 */
export function detectIntent(query: string): IntentResult {
  const q = query.trim()

  // 太短，直接 Fuse
  if (q.length < MIN_SEMANTIC_LENGTH) {
    return { intent: 'fuse', confidence: 1, reason: 'too_short' }
  }

  const lower = q.toLowerCase()
  const words = lower.split(/\s+/)
  const charCount = q.replace(/\s/g, '').length
  const hasChineseChars = /[\u4e00-\u9fa5]/.test(q)
  const wordCount = words.length

  // 单个技术词 → Fuse
  if (isSingleTechKeyword(wordCount, lower)) {
    return { intent: 'fuse', confidence: 0.95, reason: 'tech_keyword' }
  }

  // 语义关键词（如"代码"、"编程"）→ Hybrid（结合 Fuse 和 Semantic）
  if (hasSemanticKeyword(lower, words)) {
    return { intent: 'hybrid', confidence: 0.9, reason: 'semantic_keyword' }
  }

  // 含特殊符号（域名/路径/版本号）→ Fuse
  if (hasSpecialChars(q)) {
    return { intent: 'fuse', confidence: 0.9, reason: 'special_chars' }
  }

  // 自然语言触发词 → Semantic
  if (hasNaturalLanguageTrigger(q)) {
    return {
      intent: 'semantic',
      confidence: 0.9,
      reason: 'natural_language_trigger'
    }
  }

  // 中文长句（> 4 汉字）→ Semantic
  const chineseCharCount = (q.match(/[\u4e00-\u9fa5]/g) || []).length
  if (hasChineseChars && chineseCharCount > 4) {
    return { intent: 'semantic', confidence: 0.85, reason: 'long_chinese' }
  }

  // 多词英文短语（2-4 词，非技术词）→ Hybrid
  if (isMultiWordEnglishPhrase(wordCount, hasChineseChars, words)) {
    return { intent: 'hybrid', confidence: 0.75, reason: 'multi_word_phrase' }
  }

  // 中文短词（1-4 汉字）→ Hybrid
  if (hasChineseChars && chineseCharCount <= 4) {
    return { intent: 'hybrid', confidence: 0.7, reason: 'short_chinese' }
  }

  // 长字符串（> 15 字符）→ Semantic
  if (charCount > 15) {
    return { intent: 'semantic', confidence: 0.8, reason: 'long_query' }
  }

  // 默认 Hybrid
  return { intent: 'hybrid', confidence: 0.6, reason: 'default' }
}

/**
 * 检查是否为单个技术关键词
 */
function isSingleTechKeyword(wordCount: number, lower: string): boolean {
  return wordCount === 1 && TECH_KEYWORDS.has(lower)
}

/**
 * 检查是否包含语义关键词
 */
function hasSemanticKeyword(lower: string, words: string[]): boolean {
  return SEMANTIC_KEYWORDS.has(lower) || words.some(w => SEMANTIC_KEYWORDS.has(w))
}

/**
 * 检查是否包含特殊字符
 */
function hasSpecialChars(q: string): boolean {
  return /[./\\@#:?=&]/.test(q)
}

/**
 * 检查是否包含自然语言触发词
 */
function hasNaturalLanguageTrigger(q: string): boolean {
  return NATURAL_TRIGGERS.some(pattern => pattern.test(q))
}

/**
 * 检查是否为多词英文短语
 */
function isMultiWordEnglishPhrase(
  wordCount: number,
  hasChineseChars: boolean,
  words: string[]
): boolean {
  if (wordCount >= 2 && wordCount <= 4 && !hasChineseChars) {
    const allTech = words.every(w => TECH_KEYWORDS.has(w))
    if (allTech) {
      return false
    }
    return true
  }
  return false
}
