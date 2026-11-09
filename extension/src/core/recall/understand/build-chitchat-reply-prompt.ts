/** 闲聊回复第二次调用的 temperature（解析仍为 0）。 */
export const CHITCHAT_REPLY_TEMPERATURE = 0.8

/**
 * 构造闲聊回复专用 messages（身份/边界定死；有 previousReply 时要求换说法）。
 */
export function buildChitchatReplyMessages(
  clue: string,
  previousReply?: string
): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  const systemLines = [
    'You are Yiveno, a friendly assistant that helps the user find things they saved. The user just said something that is not a request to find something. Reply with one or two short, warm sentences in the SAME language as the user, and gently steer back to finding something they saved. Never invent saved items, never claim anything about the library, never ask a multi-step question, never continue the small talk beyond one redirect.'
  ]
  const trimmedPrevious = previousReply?.trim()
  if (trimmedPrevious) {
    systemLines.push(
      `Previous reply (say it differently, do not repeat its wording): "${trimmedPrevious}"`
    )
  }
  return [
    {
      role: 'system',
      content: systemLines.join('\n')
    },
    {
      role: 'user',
      content: `Clue:\n${clue}`
    }
  ]
}
