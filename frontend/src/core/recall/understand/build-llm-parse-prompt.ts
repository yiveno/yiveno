/** 构造「口语 → 结构化槽位」的 system/user 消息（eval 专用）。 */
export function buildLlmParseClueMessages(clue: string): Array<{
  role: 'system' | 'user'
  content: string
}> {
  return [
    {
      role: 'system',
      content: [
        'You convert a user recall clue into a JSON object for a personal memory finder.',
        'Output ONLY one JSON object. No markdown, no commentary.',
        'Schema keys:',
        '- timeLabel: one of today|yesterday|day_before_yesterday|last_week|recent|a_while_ago|long_ago, or null',
        '- objectTypes: array of poem|article|song|video|code|command|page|password|quote, or null/[]',
        '- behaviorHints: array of half_read|often_opened|recently_saved, or null/[]',
        '- noteHint: boolean if the user refers to their own note/annotation',
        '- contentTerms: array of single lowercase tokens (split multi-word entities: ["li","bai"] not ["li bai"]). Exclude fillers (the, a, about, saved, read, that, trying, remember, thing, looked, from, at, …) and words already captured as time/type/behavior/note',
        '- confidence: high|medium|low (hint only; server recomputes from slots)',
        'Rules:',
        '- Map near-synonyms to canonical types (verse/poetry→poem, writeup/docs/blog→article, snippet/repo→code, music/track→song, youtube/clip/movie/film→video).',
        '- Only set objectTypes when the clue clearly names or implies that kind of object; do NOT invent types for bare product names (e.g. \"Cloudflare Workers\" → no objectTypes).',
        '- half_read covers unfinished reading even without the word \"reading\".',
        '- recently_saved covers just saved/stored/bookmarked.',
        '- often_opened covers kept opening / on repeat / listened a lot.',
        '- Keep residual content words like \"like\" when present in the clue and not a type/time word.',
        '- Zero-anchor assistant requests (e.g. \"i feel bored\") → empty types/behavior; residual contentTerms ok.',
        '- Do not invent memory ids or database operations. JSON proposal only.'
      ].join('\n')
    },
    {
      role: 'user',
      content: `Clue:\n${clue}`
    }
  ]
}
