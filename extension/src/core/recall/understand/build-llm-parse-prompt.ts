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
        '- There are only those 9 relative time labels. If the clue names an absolute date, a season, or an event (e.g. "last summer", "March 2024", "during the World Cup"), do NOT force-fit a nearby label; leave timeLabel null and keep that wording in contentTerms.',
        '- Do NOT invent absolute dates. Ordinary relative phrases (today/yesterday/last week/recent/…) still map to the closed timeLabel set above (server applies hard vs soft filter by label).',
        '- objectTypes: array of poem|article|song|video|code|command|page|password|quote|bookmark, or null/[]',
        '- objectTypeOther: a short original-language phrase (max 40 chars) naming an object kind that is NOT one of the 10 objectTypes (e.g. podcast / recipe / 播客 / 菜谱). Leave null/omit when objectTypes covers it.',
        '- behaviorHints: array of half_read|often_opened|recently_saved, or null/[]',
        '- noteHint: boolean if the user refers to their own note/annotation',
        '- contentTerms: array of single lowercase tokens (split multi-word entities: ["li","bai"] not ["li bai"]). Drop fillers (the, a, about, saved, read, that, trying, remember, thing, looked, from, at, …) and words already captured as time/type/behavior/note. These are POSITIVE want terms only.',
        '- excludeContentTerms: array of single lowercase tokens the user EXPLICITLY does not want (e.g. \"not the day-hike packing checklist\" → packing/checklist/hike tokens). Never put these tokens in contentTerms. Use [] or null when there is no clear exclusion.',
        '- intent: recall|chitchat|question|instruction. recall = the user is trying to find something they saved, even vaguely (a time, a type, a topic, a feeling about something saved) — including questions ABOUT a saved item (e.g. "when did I save that article", "你是什么时候保存的那篇文章"). chitchat = the user is greeting, small-talking, commenting, OR asking who/what Yiveno is or what it can do (e.g. "good evening", "今天心情不错", "你是哪位", "你是干什么的"). question = the user asks a world/factual question with a direct answer, NOT about Yiveno identity/name/capability and NOT about finding a saved item (e.g. "how many days are in a leap year", "谁写了红楼梦", "what is the boiling point of water"). instruction = the user asks Yiveno to DO something, generate something, remind them, or delete something (e.g. "remind me to water the plants", "write a haiku", "delete my notes", "帮我翻译这段英文"). When unsure, choose recall — never block a possible recall attempt.',
        '- assistantReply: a short natural reply in the SAME language as the clue, ONLY when intent is chitchat, question, or instruction. One or two sentences, warm and brief, and steer back to finding things. chitchat: acknowledge lightly (greeting / mood / unclear input — if incoherent, gently say it looks unclear/scrambled, do NOT invent a mood, activity, or story from nonsense). question: answer briefly from your own knowledge, then steer back; if you do not know, say so briefly — never invent a fact. instruction: state plainly that you cannot do that (you only find things), then steer back; for delete/remove wording, say explicitly that you never delete anything. Never invent saved items, never claim anything about the library, never ask a multi-step question, never continue beyond one redirect. Empty / null when intent is recall.',
        '- confidence: high|medium|low (hint only; server recomputes from slots)',
        'Rules:',
        '- Map near-synonyms to canonical types (verse/poetry→poem, writeup/docs/blog→article, snippet/repo→code, music/track→song, youtube/clip/movie/film→video, bookmark/bookmarks→bookmark).',
        '- objectTypes has only those 10 values. If the thing in the clue is none of them, do NOT guess the closest enum; put the original word in objectTypeOther and leave objectTypes empty/null.',
        '- Only set objectTypes when the clue clearly names or implies that kind of object; do NOT invent types for bare product names (e.g. \"Cloudflare Workers\" → no objectTypes).',
        '- half_read covers unfinished reading even without the word \"reading\". \"did not finish\" / \"not finished\" → behaviorHints half_read only; do NOT put finish/finished into excludeContentTerms.',
        '- recently_saved covers just saved/stored/bookmarked/collected.',
        '- often_opened covers kept opening / on repeat / listened a lot.',
        '- Four-digit years (1900–2099) in titles/names (e.g. a 1954 film) are contentTerms only; timeLabel must be null unless the clue also says today/yesterday/recent/long ago/etc.',
        '- Keep residual content words like \"like\" when present in the clue and not a type/time word.',
        '- Zero-anchor assistant requests (e.g. "suggest something fun") → intent chitchat; leave all recall slots empty and fill assistantReply.',
        '- Explicit exclusion vs uncertainty vs ordinary negation:',
        '  * Explicit exclude (must fill excludeContentTerms): \"not the X\", \"except the X\", \"rather than X\", \"don\'t want the X\".',
        '  * Uncertainty / meta (excludeContentTerms empty): \"not sure\", \"I don\'t remember\", \"I don\'t know\", \"maybe not\".',
        '  * Ordinary queries with no exclusion: excludeContentTerms empty; do not invent exclusions.',
        '- When intent is chitchat, question, or instruction, leave the recall slots empty (timeLabel null, objectTypes [], objectTypeOther null, behaviorHints [], contentTerms []) and fill only intent + assistantReply.',
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
