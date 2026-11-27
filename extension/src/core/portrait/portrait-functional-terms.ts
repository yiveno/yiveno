/**
 * 画像推断功能词表：站点导航/页脚类 topicAnchor，不生成/不展示 inference。
 * 闭集产品槽过滤（非内容同义灰名单）。
 */

/** 中文功能词（整词 / 精确匹配）。 */
export const PORTRAIT_FUNCTIONAL_TERMS_ZH = [
  '联系',
  '投稿',
  '邮箱',
  '招聘',
  '登录',
  '注册',
  '首页',
  '关于',
  '下载',
  '订阅',
  '周五发布'
] as const

/** 英文功能词（大小写不敏感；含空格短语）。 */
export const PORTRAIT_FUNCTIONAL_TERMS_EN = [
  'contact',
  'subscribe',
  'login',
  'sign up',
  'home',
  'about',
  'download',
  'jobs',
  'careers'
] as const

const ZH_SET = new Set<string>(PORTRAIT_FUNCTIONAL_TERMS_ZH)
const EN_SET = new Set<string>(PORTRAIT_FUNCTIONAL_TERMS_EN.map(t => t.toLowerCase()))

/**
 * topicAnchor / 事实 value 是否命中功能词。
 * 中文：规范化后精确匹配；英文：精确或整词（含短语）。
 */
export function isPortraitFunctionalTopicAnchor(raw: string): boolean {
  const trimmed = raw.trim()
  if (!trimmed) {
    return false
  }
  if (ZH_SET.has(trimmed)) {
    return true
  }
  const lower = trimmed.toLowerCase()
  if (EN_SET.has(lower)) {
    return true
  }
  for (const term of EN_SET) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`, 'i')
    if (pattern.test(trimmed)) {
      return true
    }
  }
  return false
}
