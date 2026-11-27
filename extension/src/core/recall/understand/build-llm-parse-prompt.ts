/**
 * 构造生产路径「口语 → 结构化槽位」解析用的 system/user 消息。
 * hosted nlu / 直连 / clue-chain Stage 1 共用；assistantReply 仅作非召回回落，正式回复由 chitchat 二次调用生成。
 */
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
        '- Chinese relative time (same closed set): 之前 / 以前 / 上次 → a_while_ago; 去年 / 前年 / 去年或前年 → long_ago; 上个月 / 一个月前 → last_month; 几个月前 / 前几个月 → few_months_ago; 最近 / 前几天 → recent. Fuzzy past always maps to a low-confidence soft-rank label — never invent a hard calendar window.',
        '- There are only those 9 relative time labels. If the clue names an absolute date, a season, or an event (e.g. "last summer", "March 2024", "during the World Cup", "去年夏天", "2024年3月", "世界杯期间"), do NOT force-fit a nearby label; leave timeLabel null and keep that wording in contentTerms.',
        '- Do NOT invent absolute dates. Ordinary relative phrases (today/yesterday/last week/recent/之前/以前/上次/去年/…) still map to the closed timeLabel set above (server applies hard vs soft filter by label).',
        '- objectTypes: array of poem|article|song|video|code|command|page|password|quote|bookmark, or null/[]',
        '- objectTypeOther: a short original-language phrase (max 40 chars) naming an object kind that is NOT one of the 10 objectTypes (e.g. podcast / recipe / 播客 / 菜谱). Leave null/omit when objectTypes covers it.',
        '- behaviorHints: array of half_read|often_opened|recently_saved, or null/[]',
        '- preferenceOperator: most_frequent|favorite|recent_frequent, or null. ONLY for ranking preference questions about the user\'s own browsing habits (e.g. "my favorite site", "website I visit most", "sites I keep opening lately", "我最常看的网站"). most_frequent = most often / most visits (also the default when preference is unmarked, e.g. "the one I usually look at"); favorite = most liked; recent_frequent = recently keep visiting. Do NOT set for: questions about a named site\'s activity ("what do I usually do on github", "我最常去 github 干什么" — leave preferenceOperator null; keep the site name in contentTerms), time-rewind ("sites I saw yesterday"), or ordinary find-saved-item clues. Preference/ranking wording belongs ONLY in this slot — never leave those words in contentTerms.',
        '- preferenceTarget: site|page, or null. site = website/domain; page = article/specific page. When preferenceOperator is set and the clue does not clearly say article/page, use site.',
        '- noteHint: boolean if the user refers to their own note/annotation',
        '- portraitQuery: true ONLY when the user asks what Yiveno knows / understands about them as a person (e.g. "what do you know about me", "how well do you know me", "你了解我多少", "你对我了解多少", "tell me what you know about me"). Leave null/false for ordinary find-saved-item clues, preference ranking ("my favorite site"), or world questions. When portraitQuery is true: set intent to recall, leave timeLabel/objectTypes/behaviorHints/preferenceOperator/preferenceTarget/contentTerms/excludeContentTerms empty, and leave assistantReply empty (server builds the portrait summary).',
        '- contentTerms: array of single lowercase tokens (split multi-word entities: ["li","bai"] not ["li bai"]). Drop fillers (the, a, about, saved, read, that, trying, remember, thing, looked, from, at, …) and words already captured as time/type/behavior/note/preference. These are POSITIVE want terms only. Topic words for "most-visited site about RAG" stay here (e.g. rag); preference/ranking words do not.',
        '- excludeContentTerms: array of single lowercase tokens the user EXPLICITLY does not want (e.g. \"not the day-hike packing checklist\" → packing/checklist/hike tokens). Never put these tokens in contentTerms. Use [] or null when there is no clear exclusion.',
        '- intent: recall|chitchat|question|instruction. recall = the user is trying to find something they saved, even vaguely (a time, a type, a topic, a feeling about something saved) — including questions ABOUT a saved item (e.g. "when did I save that article", "你是什么时候保存的那篇文章"). CRITICAL: describing a feature/app/article/video/page the user saw, used, collected, or half-remembers, then asking "which one / what was it / 哪个来着 / 什么软件来着" is ALWAYS recall — they want the saved thing, not a world-fact answer (e.g. "有个…功能，苹果自带的还是哪个软件来着", "那个抠图功能是哪个来着", "which app was that photo cutout thing"). chitchat = the user is greeting, small-talking, commenting, OR asking who/what Yiveno is or what it can do (e.g. "good evening", "今天心情不错", "你是哪位", "你是干什么的"). question = the user asks a world/factual question with a direct answer, NOT about Yiveno identity/name/capability and NOT about finding a saved item (e.g. "how many days are in a leap year", "谁写了红楼梦", "what is the boiling point of water"). instruction = the user asks Yiveno to DO something, generate something, remind them, or delete something (e.g. "remind me to water the plants", "write a haiku", "delete my notes", "帮我翻译这段英文"). When unsure, choose recall — never block a possible recall attempt.',
        '- assistantReply: ONLY when intent is chitchat, question, or instruction — one short fallback sentence in the SAME language as the clue. The formal reply is generated by a later step; write only a one-line fallback here. For delete/remove wording, the fallback must say you never delete anything. Empty / null when intent is recall.',
        '- confidence: high|medium|low (hint only; server recomputes from slots)',
        '- certainty: object describing how firmly the user phrased each condition (NOT whether the fact is true). Per-slot keys:',
        '  * timeRange: hedge|neutral|firm (single value for the time phrase)',
        '  * preferenceOperator: hedge|neutral|firm (single value when preferenceOperator is set)',
        '  * contentTerms: object map token→hedge|neutral|firm for each contentTerms token',
        '  * objectTypes: object map type→hedge|neutral|firm for each objectTypes entry',
        '  * Omit behaviorHints and noteHint (not user-statement conditions). Missing slots default to neutral on the server.',
        '  * Examples: "好像是" / "I think it was" / "maybe" → hedge; unmarked wording → neutral; "我记得很清楚" / "I clearly remember" / "definitely" → firm.',
        '  * When a hedge/firm marker scopes the WHOLE clue (e.g. "好像是讲 RAG 的那篇", "I think it was a poem"), apply that same certainty to EVERY filled recall slot above (each contentTerms token, timeRange, each objectTypes entry, preferenceOperator). Do not leave those maps/slots unmarked as neutral.',
        'Rules:',
        '- objectTypes has only those 10 values. If the thing in the clue is none of them, do NOT guess the closest enum; put the original word in objectTypeOther and leave objectTypes empty/null.',
        '- Only set objectTypes when the clue clearly names or implies that kind of object; do NOT invent types for bare product names (e.g. \"Cloudflare Workers\" → no objectTypes).',
        '- Background music / soundtrack mentions are NOT song.',
        '- Platform/channel source names that appear in the clue (公众号/微信公众号, 抖音/douyin/tiktok, 小红书/xiaohongshu, B站/bilibili, 知乎/zhihu, YouTube, 微博/weibo) MUST stay in contentTerms as tokens; never drop them just to keep topic words.',
        '- half_read covers unfinished reading even without the word \"reading\". \"did not finish\" / \"not finished\" → behaviorHints half_read only; do NOT put finish/finished into excludeContentTerms.',
        '- recently_saved covers just saved/stored/bookmarked/collected.',
        '- often_opened covers kept opening / on repeat / listened a lot.',
        '- Keep residual content words like \"like\" when present in the clue and not a type/time word.',
        '- Zero-anchor assistant requests (e.g. "suggest something fun") → intent chitchat; leave all recall slots empty and fill assistantReply.',
        '- Explicit exclusion vs uncertainty vs ordinary negation:',
        '  * Explicit exclude (must fill excludeContentTerms): \"not the X\", \"except the X\", \"rather than X\", \"don\'t want the X\".',
        '  * Uncertainty / meta (excludeContentTerms empty): \"not sure\", \"I don\'t remember\", \"I don\'t know\", \"maybe not\".',
        '  * Ordinary queries with no exclusion: excludeContentTerms empty; do not invent exclusions.',
        '- When intent is chitchat, question, or instruction, leave the recall slots empty (timeLabel null, objectTypes [], objectTypeOther null, behaviorHints [], preferenceOperator null, preferenceTarget null, contentTerms []) and fill only intent + assistantReply.',
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
