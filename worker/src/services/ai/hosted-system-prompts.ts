/**
 * hosted/complete 的 system 指纹校验（形状 + 前缀/锚行）。
 *
 * 残留说明（本批刻意保留）：
 * - 这是「形状 + system 指纹」，不是服务端 system prompt 模板渲染。
 * - 闲聊二次回复的 system 含动态行（日期 / intent / previousReply）；nlu 一 taskKind 对应解析版与闲聊版两套 prompt。
 * - 硬搬服务端模板会拆扩展侧 builders；更彻底的服务端模板渲染另立批。
 * - 残留风险：攻击者可在规范 system 后追加指令（后缀注入）；但须持有效 device token，
 *   且受自有配额约束（匿名终身 15 次），滥用价值有限。
 */

/** hosted/complete 允许的 taskKind（闭集；enrichment/gs/dreaming 有专用端点）。 */
export const HOSTED_COMPLETE_TASK_KINDS = [
  'nlu', // 线索理解 / 闲聊二次回复
  'framing_nlg', // Framing 润色
  'follow_up_nlg', // need_a_clue 追问
  'narrow_polish', // composer Narrow 举例润色
  'portrait_narrative', // 画像摘要自然语言组装
  'portrait_cluster' // 待确认项语义聚类
] as const

export type HostedCompleteTaskKind = (typeof HOSTED_COMPLETE_TASK_KINDS)[number]

type SystemFingerprint = {
  /** system 须以此首段开头（扩展 builder 原文逐字） */
  prefix: string
  /** 必须全部出现的锚行（扩展 builder 原文逐字） */
  anchors: readonly string[]
}

/** nlu · 解析版（build-llm-parse-prompt） */
const NLU_PARSE: SystemFingerprint = {
  prefix: 'You convert a user recall clue into a JSON object for a personal memory finder.',
  anchors: [
    'Output ONLY one JSON object. No markdown, no commentary.',
    '- Do not invent memory ids or database operations. JSON proposal only.'
  ]
}

/** nlu · 闲聊二次回复版（build-chitchat-reply-prompt）；首段后可接动态行 */
const NLU_CHITCHAT: SystemFingerprint = {
  prefix:
    'You are Yiveno. In Chinese you are called 奇忆. When you reply in English, call yourself Yiveno. When you reply in Chinese, call yourself 奇忆. When the user asks who you are or what your name is, always say your name. You are the one who finds things: you help the user find what they want. The user can just say whatever comes to mind, and you do your best to find it. The user just said something that is not a request to find something. Reply with one or two short, warm sentences in the SAME language as the user, and gently steer back to finding something they saved. Never invent saved items, never claim anything about the library, never ask a multi-step question, never continue the small talk beyond one redirect.',
  anchors: [
    'Reply by intent — the policy is fixed, the wording is yours:',
    'Hard ban: do not invent a mood, activity, story, or "you seem busy/tired/…" from incoherent or garbled text. Do not invent facts. If you cannot honestly understand what they meant, or do not know the answer, say that instead of guessing.',
    'Current intent for this reply:'
  ]
}

const FRAMING_NLG: SystemFingerprint = {
  prefix:
    'You rewrite Yiveno Recall neighborhood framing for the user (Chrome extension personal memory recovery).',
  anchors: [
    'Return ONLY JSON:',
    '- empty array for top_pick. label matches reply language; value MUST be stable English phrases.'
  ]
}

const FOLLOW_UP_NLG: SystemFingerprint = {
  prefix:
    'You write the next assistant turn for Yiveno Recall (personal memory recovery in a Chrome extension).',
  anchors: [
    'Return ONLY a JSON object:',
    '- Never invent memory items, titles, URLs, or facts not in weakCandidateTitles / context.'
  ]
}

const NARROW_POLISH: SystemFingerprint = {
  prefix: 'You polish short example words for Yiveno Recall composer placeholders.',
  anchors: [
    'Return ONLY a JSON object:',
    '- Forbidden: inventing new words, synonyms, themes, extra tokens, or swapping to a different selected word.'
  ]
}

/** 与扩展 portrait-narrative-prompt.ts 首段 / 锚行逐字一致。 */
const PORTRAIT_NARRATIVE: SystemFingerprint = {
  prefix:
    'You write a short natural-language portrait summary for Yiveno (Chrome extension personal memory finder).',
  anchors: [
    '- Use ONLY the given content points. Do not invent, infer, or complete any preference or fact not listed.',
    '- Output plain text as one paragraph. No markdown.'
  ]
}

/** 与扩展 portrait-cluster-prompt.ts 首段 / 锚行逐字一致。 */
const PORTRAIT_CLUSTER: SystemFingerprint = {
  prefix:
    'You cluster pending preference items into higher-level groups for Yiveno (Chrome extension personal memory finder).',
  anchors: [
    '- Every input item must appear in exactly one cluster. No omissions, no duplicates, no invented items.',
    '- Output ONLY one JSON object. No markdown, no commentary.'
  ]
}

function matchesFingerprint(system: string, fp: SystemFingerprint): boolean {
  if (!system.startsWith(fp.prefix)) {
    return false
  }
  return fp.anchors.every(anchor => system.includes(anchor))
}

/**
 * 解析 hosted taskKind：缺省/空 → nlu；显式但不在闭集内 → null（调用方 400）。
 */
export function parseHostedCompleteTaskKind(raw: unknown): HostedCompleteTaskKind | null {
  if (raw === undefined || raw === null) {
    return 'nlu'
  }
  if (typeof raw !== 'string') {
    return null
  }
  const trimmed = raw.trim()
  if (trimmed.length === 0) {
    return 'nlu'
  }
  if ((HOSTED_COMPLETE_TASK_KINDS as readonly string[]).includes(trimmed)) {
    return trimmed as HostedCompleteTaskKind
  }
  return null
}

/**
 * 校验 system 指纹；nlu 接受解析版或闲聊版任一。
 */
export function validateHostedSystemPrompt(
  taskKind: HostedCompleteTaskKind,
  systemContent: string
): boolean {
  const text = systemContent.trim()
  switch (taskKind) {
    case 'nlu':
      return matchesFingerprint(text, NLU_PARSE) || matchesFingerprint(text, NLU_CHITCHAT)
    case 'framing_nlg':
      return matchesFingerprint(text, FRAMING_NLG)
    case 'follow_up_nlg':
      return matchesFingerprint(text, FOLLOW_UP_NLG)
    case 'narrow_polish':
      return matchesFingerprint(text, NARROW_POLISH)
    case 'portrait_narrative':
      return matchesFingerprint(text, PORTRAIT_NARRATIVE)
    case 'portrait_cluster':
      return matchesFingerprint(text, PORTRAIT_CLUSTER)
  }
}

/** 测试 / 日志用：规范 system 前缀（不暴露完整 prompt）。 */
export const HOSTED_SYSTEM_PROMPT_PREFIXES = {
  nluParse: NLU_PARSE.prefix,
  nluChitchat: NLU_CHITCHAT.prefix,
  framing_nlg: FRAMING_NLG.prefix,
  follow_up_nlg: FOLLOW_UP_NLG.prefix,
  narrow_polish: NARROW_POLISH.prefix,
  portrait_narrative: PORTRAIT_NARRATIVE.prefix,
  portrait_cluster: PORTRAIT_CLUSTER.prefix
} as const
