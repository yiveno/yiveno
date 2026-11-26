/**
 * 问句式召回护栏：LLM 常把「有个…功能/软件，哪个来着」判成 world question。
 * 当已抽出具体 contentTerms / objectTypeOther，且 clue 带找回锚时，确定性改判 recall。
 */

/** 找回锚：描述见过/用过/收藏过的东西后再问「哪个来着」。 */
const RECALL_FIND_ANCHORS =
  /有个|之前|以前|看到|看过|用过|收藏|保存|存过|那个|功能|软件|文章|视频|帖子|页面|网页|工具|App|app|which (one|app|tool|site)|what (was|is) that|came across|saved|bookmarked|collected/i

export interface QuestionAsRecallInput {
  /** 原始线索 */
  clue: string
  /** LLM 提议的 intent */
  intent: string | null | undefined
  /** 已抽出的正向内容词 */
  contentTerms: readonly string[]
  /** 未知类型原文（若有） */
  objectTypeOther?: string | null
}

/**
 * 是否应将 question 改判为 recall（并清空 assistantReply）。
 * 仅在 intent=question 且已有具体槽位 + 找回锚时触发。
 */
export function shouldReclassifyQuestionAsRecall(input: QuestionAsRecallInput): boolean {
  if (input.intent !== 'question') {
    return false
  }
  const hasSpecificSlots =
    input.contentTerms.length > 0 ||
    (typeof input.objectTypeOther === 'string' && input.objectTypeOther.trim().length > 0)
  if (!hasSpecificSlots) {
    return false
  }
  return RECALL_FIND_ANCHORS.test(input.clue)
}
