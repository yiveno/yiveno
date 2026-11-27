/**
 * 画像摘要 LLM 自然语言组装 · prompt 构建（纯函数）。
 * system 首段 / 锚行须与 Worker hosted-system-prompts 指纹逐字一致。
 */

import type { PortraitSummaryGroup } from '@/core/portrait/build-portrait-summary'
import type { UiLocaleId } from '@/core/i18n/ui-locale'

/** 单组内容点（供 LLM / 校验）。 */
export type PortraitNarrativeGroupPoints = {
  key: PortraitSummaryGroup
  /** 确定性分级标签（确定 / 较确定 / 待确认 / 矛盾） */
  label: string
  /** 代表项 value，至多 5 */
  values: string[]
  /** 该组总数 */
  total: number
}

/** 本次组装用的内容点全集。 */
export type PortraitNarrativeContentPoints = {
  locale: UiLocaleId
  groups: PortraitNarrativeGroupPoints[]
  pendingValues: string[]
  pendingTotal: number
  contestedValues: string[]
  contestedTotal: number
}

/** Worker 指纹 · system 首段（勿改字）。 */
export const PORTRAIT_NARRATIVE_SYSTEM_PREFIX =
  'You write a short natural-language portrait summary for Yiveno (Chrome extension personal memory finder).'

/** Worker 指纹 · 锚行（须全部出现在 system 中）。 */
export const PORTRAIT_NARRATIVE_SYSTEM_ANCHORS = [
  '- Use ONLY the given content points. Do not invent, infer, or complete any preference or fact not listed.',
  '- Output plain text as one paragraph. No markdown.'
] as const

const GROUP_LABEL_ZH: Record<PortraitSummaryGroup, string> = {
  verified: '确定',
  corroborated: '较确定',
  unconfirmed: '待确认',
  contested: '矛盾'
}

const GROUP_LABEL_EN: Record<PortraitSummaryGroup, string> = {
  verified: 'certain',
  corroborated: 'fairly certain',
  unconfirmed: 'unconfirmed',
  contested: 'conflicting'
}

/** 分级标签（随 locale）。 */
export function portraitNarrativeGroupLabel(key: PortraitSummaryGroup, locale: UiLocaleId): string {
  return locale === 'zh_CN' ? GROUP_LABEL_ZH[key] : GROUP_LABEL_EN[key]
}

/**
 * 从摘要项构建内容点（每组至多 5 个代表 value；已按 credibility 降序的输入截断即可）。
 */
export function buildPortraitNarrativeContentPoints(input: {
  locale: UiLocaleId
  groups: Array<{
    key: PortraitSummaryGroup
    values: string[]
    total: number
  }>
  pendingValues: string[]
  contestedValues: string[]
}): PortraitNarrativeContentPoints {
  const groups = input.groups
    .filter(g => g.total > 0 || g.values.length > 0)
    .map(g => ({
      key: g.key,
      label: portraitNarrativeGroupLabel(g.key, input.locale),
      values: g.values.slice(0, 5),
      total: g.total
    }))
  return {
    locale: input.locale,
    groups,
    pendingValues: [...input.pendingValues],
    pendingTotal: input.pendingValues.length,
    contestedValues: [...input.contestedValues],
    contestedTotal: input.contestedValues.length
  }
}

/** 序列化内容点（user 消息正文；含分级与计数）。 */
export function serializePortraitNarrativePoints(points: PortraitNarrativeContentPoints): string {
  const lines: string[] = [`locale: ${points.locale}`]
  for (const g of points.groups) {
    lines.push(
      `group[${g.key}] label=${g.label} total=${g.total} values=${JSON.stringify(g.values)}`
    )
  }
  lines.push(`pending total=${points.pendingTotal} values=${JSON.stringify(points.pendingValues)}`)
  lines.push(
    `contested total=${points.contestedTotal} values=${JSON.stringify(points.contestedValues)}`
  )
  return lines.join('\n')
}

/** 构建 system 指令全文（含硬约束；首段/锚行固定）。 */
export function buildPortraitNarrativeSystemPrompt(locale: UiLocaleId): string {
  const langLine =
    locale === 'zh_CN'
      ? 'Write in Simplified Chinese. Address the user as 你. Max 150 Chinese characters.'
      : 'Write in American English. Address the user as you. Max 90 words.'
  return [
    PORTRAIT_NARRATIVE_SYSTEM_PREFIX,
    '',
    'Hard constraints:',
    PORTRAIT_NARRATIVE_SYSTEM_ANCHORS[0],
    '- Do not present unconfirmed or conflicting items as settled conclusions.',
    '- Distill the point; do not list every content point item by item.',
    '- First person, natural spoken tone like a real chat. No lists, no headings, no internal jargon (no credibility / portrait fact / group / inPortrait / pendingInference).',
    PORTRAIT_NARRATIVE_SYSTEM_ANCHORS[1],
    `- ${langLine}`
  ].join('\n')
}

export type PortraitNarrativeChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/** 构建 [system, user]；可选追加审核失败纠正指令。 */
export function buildPortraitNarrativeMessages(
  points: PortraitNarrativeContentPoints,
  options?: { correctionReasons?: string[] }
): PortraitNarrativeChatMessage[] {
  const system = buildPortraitNarrativeSystemPrompt(points.locale)
  let user = [
    'Content points (authoritative; do not add outside this set):',
    serializePortraitNarrativePoints(points),
    '',
    'Write one short paragraph summarizing what you know about the user from these points only.'
  ].join('\n')
  if (options?.correctionReasons && options.correctionReasons.length > 0) {
    user += `\n\n上次输出未通过审核：${options.correctionReasons.join('；')}，请修正后重新输出`
  }
  return [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ]
}
