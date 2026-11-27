/**
 * 画像待确认项语义聚类 · prompt 构建（纯函数）。
 * system 首段 / 锚行须与 Worker hosted-system-prompts 指纹逐字一致。
 */

/** Worker 指纹 · system 首段（勿改字）。 */
export const PORTRAIT_CLUSTER_SYSTEM_PREFIX =
  'You cluster pending preference items into higher-level groups for Yiveno (Chrome extension personal memory finder).'

/** Worker 指纹 · 锚行（须全部出现在 system 中）。 */
export const PORTRAIT_CLUSTER_SYSTEM_ANCHORS = [
  '- Every input item must appear in exactly one cluster. No omissions, no duplicates, no invented items.',
  '- Output ONLY one JSON object. No markdown, no commentary.'
] as const

export type PortraitClusterChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/** 构建 system 指令全文（硬约束；首段/锚行固定）。 */
export function buildPortraitClusterSystemPrompt(): string {
  return [
    PORTRAIT_CLUSTER_SYSTEM_PREFIX,
    '',
    'Hard constraints:',
    PORTRAIT_CLUSTER_SYSTEM_ANCHORS[0],
    '- Cluster label MUST be a higher-level summary of its members (2–8 characters or words).',
    '- Only clusters with 2+ members may use a summary label; a single-member cluster label MUST equal that item value exactly.',
    '- Label must NOT contain concrete entity names that are not among the members.',
    '- Return pure JSON: {"clusters":[{"label":"…","items":["value",…]},…]}',
    PORTRAIT_CLUSTER_SYSTEM_ANCHORS[1]
  ].join('\n')
}

/**
 * 构建 [system, user]；可选追加校验失败纠正指令。
 * @param values 待确认项 value 列表（调用方已按 credibility 截到 ≤60）
 */
export function buildPortraitClusterMessages(
  values: readonly string[],
  options?: { correctionReasons?: string[] }
): PortraitClusterChatMessage[] {
  const system = buildPortraitClusterSystemPrompt()
  let user = [
    'Pending preference item values (authoritative set; partition exactly these):',
    JSON.stringify(values),
    '',
    'Cluster them into higher-level preference groups. Return JSON only.'
  ].join('\n')
  if (options?.correctionReasons && options.correctionReasons.length > 0) {
    user += `\n\n上次输出未通过校验：${options.correctionReasons.join('；')}，请修正后重新输出纯 JSON`
  }
  return [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ]
}
