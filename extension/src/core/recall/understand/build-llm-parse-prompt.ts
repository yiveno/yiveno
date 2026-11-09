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
        '- timeLabel: one of today|yesterday|day_before_yesterday|last_week|recent|a_while_ago|last_month|few_months_ago|long_ago, or null',
        '- Map month-scale phrases: last month / a month ago → last_month; a few months ago/back / couple months → few_months_ago; a while back → few_months_ago; a while ago / some time ago → a_while_ago; long ago / a long time ago → long_ago',
        '- Do NOT invent absolute dates. Fuzzy time phrases still map to the closed timeLabel set above (server applies hard vs soft filter by label).',
        '- objectTypes: array of poem|article|song|video|code|command|page|password|quote|bookmark, or null/[]',
        '- behaviorHints: array of half_read|often_opened|recently_saved, or null/[]',
        '- noteHint: boolean if the user refers to their own note/annotation',
        '- contentTerms: array of single lowercase tokens (split multi-word entities: ["li","bai"] not ["li bai"]). Drop fillers (the, a, about, saved, read, that, trying, remember, thing, looked, from, at, …) and words already captured as time/type/behavior/note. These are POSITIVE want terms only.',
        '- excludeContentTerms: array of single lowercase tokens the user EXPLICITLY does not want (e.g. \"not the day-hike packing checklist\" → packing/checklist/hike tokens). Never put these tokens in contentTerms. Use [] or null when there is no clear exclusion.',
        '- intent: recall|chitchat. recall = the user is trying to find something they saved, even vaguely (a time, a type, a topic, a feeling about something saved). chitchat = the user is greeting, small-talking, commenting, or asking something unrelated to finding a saved item (e.g. "nice weather today", "i feel bored", "hello", "how are you"). When unsure, choose recall — never block a possible recall attempt.',
        '- assistantReply: a short natural reply in the SAME language as the clue, ONLY when intent is chitchat. One or two sentences, warm and brief, and steer back to finding things (e.g. "Yeah, lovely day — is there something you were looking for?"). If the clue looks incoherent, accidental, or garbled, gently say it looks unclear/scrambled — do NOT invent a mood, activity, or story from nonsense. Never invent saved items, never claim anything about the library, never ask a multi-step question, never continue the small talk beyond one redirect. Empty / null when intent is recall.',
        '- confidence: high|medium|low (hint only; server recomputes from slots)',
        'Rules:',
        '- Map near-synonyms to canonical types (verse/poetry→poem, writeup/docs/blog→article, snippet/repo→code, music/track→song, youtube/clip/movie/film→video, bookmark/bookmarks→bookmark).',
        '- Only set objectTypes when the clue clearly names or implies that kind of object; do NOT invent types for bare product names (e.g. \"Cloudflare Workers\" → no objectTypes).',
        '- half_read covers unfinished reading even without the word \"reading\". \"did not finish\" / \"not finished\" → behaviorHints half_read only; do NOT put finish/finished into excludeContentTerms.',
        '- recently_saved covers just saved/stored/bookmarked/collected.',
        '- often_opened covers kept opening / on repeat / listened a lot.',
        '- Four-digit years (1900–2099) in titles/names (e.g. a 1954 film) are contentTerms only; timeLabel must be null unless the clue also says today/yesterday/recent/long ago/etc.',
        '- Keep residual content words like \"like\" when present in the clue and not a type/time word.',
        '- Zero-anchor assistant requests (e.g. "i feel bored") → intent chitchat; leave all recall slots empty and fill assistantReply.',
        '- Explicit exclusion vs uncertainty vs ordinary negation:',
        '  * Explicit exclude (must fill excludeContentTerms): \"not the X\", \"except the X\", \"rather than X\", \"don\'t want the X\".',
        '  * Uncertainty / meta (excludeContentTerms empty): \"not sure\", \"I don\'t remember\", \"I don\'t know\", \"maybe not\".',
        '  * Ordinary queries with no exclusion: excludeContentTerms empty; do not invent exclusions.',
        '- When intent is chitchat, leave the recall slots empty (timeLabel null, objectTypes [], behaviorHints [], contentTerms []) and fill only intent + assistantReply.',
        '- A token must not appear in both contentTerms and excludeContentTerms. Shared topic words stay in contentTerms only.',
        '- Do not invent memory ids or database operations. JSON proposal only.'
      ].join('\n')
    },
    {
      role: 'user',
      content: `Clue:\n${clue}`
    }
  ]
}
