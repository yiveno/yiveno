/**
 * 质量轮多样性语料：画像风味 + 过程随机（可复现 seed）。
 * 内容生成与线索生成分离（线索见 clue-gen.ts，独立 rng 流）。
 * URL 保留 yiveno-div 指纹供 DEV 清理；禁止进召回 runtime。
 */

import { generateDiversityClues } from './clue-gen'
import { pickZipfWeighted, planDaysAgoSequence } from './distribution'
import { DEFAULT_PROBE_FILLER_SEED, rngForFillerItem, type SeededRng } from './prng'
import type { RecallProbePersonaId } from './types'
import type { RecallProbeBookmarkSeed, RecallProbeExcerptSeed } from './types'

export type ProbeDiversityBuildOptions = {
  keyPrefix?: string
  /** 过程随机种子；缺省用 DEFAULT_PROBE_FILLER_SEED */
  seed?: number
}

export type DiversityHostPack = {
  hosts: readonly string[]
  titlePrefixes: readonly string[]
  subjects: readonly string[]
  noteTemplates: readonly string[]
  /**
   * 与 noteTemplates 下标一一对应的口语 hint（线索锚，≠ 附注原文）。
   * 长度必须等于 noteTemplates。
   */
  noteHints: readonly string[]
  excerptSnippets: readonly string[]
  /** 保存理由 / 场景片段（线索生成用；≥8） */
  sceneFragments: readonly string[]
  /** 摘录正文中段（≥8；三段组合） */
  excerptMiddles: readonly string[]
  /** 摘录正文收束句（≥8；三段组合） */
  excerptClosers: readonly string[]
}

export const DIVERSITY_PACKS: Record<RecallProbePersonaId, DiversityHostPack> = {
  researcher: {
    hosts: [
      'https://www.nature.com/articles/yiveno-div',
      'https://www.theatlantic.com/yiveno-div',
      'https://aeon.co/essays/yiveno-div',
      'https://www.jstor.org/stable/yiveno-div',
      'https://papers.ssrn.com/sol3/yiveno-div',
      'https://www.ft.com/content/yiveno-div',
      'https://www.theguardian.com/yiveno-div',
      'https://arxiv.org/abs/yiveno-div',
      'https://www.newyorker.com/yiveno-div',
      'https://www.science.org/doi/yiveno-div'
    ],
    titlePrefixes: [
      'Field notes on',
      'Lab memo:',
      'Long read:',
      'Archive scrap:',
      'Survey of',
      'Briefing:',
      'Essay draft:',
      'Literature map:',
      'Working notes:',
      'Seminar scrap:'
    ],
    subjects: [
      'attention metrics in newsrooms',
      'trust measurement in local media',
      'climate tipping narratives',
      'memory palace techniques',
      'aggregation theory leftovers',
      'misinformation pathways',
      'remote work diary windows',
      'library civic programs',
      'preprint citation hygiene',
      'interview guide prompts',
      'dense retrieval baselines',
      'annotation layers in archives'
    ],
    noteTemplates: [
      'cite in weekly research digest',
      'cross-check methods section later',
      'possible lead for interview guide',
      'park for lit review cluster',
      'compare with last grant draft',
      'flag for methods appendix'
    ],
    noteHints: [
      'to cite in my weekly research digest',
      'to cross-check the methods section later',
      'as a possible lead for an interview guide',
      'to park for my lit review cluster',
      'to compare with the last grant draft',
      'to flag for the methods appendix'
    ],
    excerptSnippets: [
      'The sample frame still undercounts informal archives that never enter the catalog.',
      'Causal claims collapse when the diary window is shorter than the policy cycle.',
      'Secondary sources rarely preserve the annotation layer readers actually used.',
      'Verification rituals matter more than another dashboard of unverified quotes.',
      'Field notes drift when the codebook is updated mid-wave without a migration log.',
      'Interview prompts work better when they ask for a concrete scene, not a trait.'
    ],
    sceneFragments: [
      'for the intro of my talk',
      'ahead of Friday office hours',
      'for the visiting scholar brief',
      'before the panel dry run',
      'for the podcast guest prep',
      'ahead of the commute home',
      'for the Sunday desk tidy',
      'before the evening train ride'
    ],
    excerptMiddles: [
      'That gap shows up again when teams skip the pilot codebook.',
      'Readers notice when the claim outruns the evidence window.',
      'The diary entries only make sense next to the policy calendar.',
      'Without a migration log the codes silently fork mid-study.',
      'A concrete scene beats another abstract trait question.',
      'Informal archives stay invisible until someone indexes them.',
      'The quote dashboard looks busy while verification stays thin.',
      'Secondary digests rarely keep the reader annotation layer.'
    ],
    excerptClosers: [
      'I kept this for the methods appendix rewrite.',
      'Worth pairing with the grant draft comparison later.',
      'Parked beside the interview guide prompts.',
      'Useful when the lit review cluster gets dense.',
      'Hold for the visiting scholar brief.',
      'Check again before the panel dry run.',
      'Bring to Friday office hours if stuck.',
      'Flag if the next digest needs a shorter claim.'
    ]
  },
  creator: {
    hosts: [
      'https://www.figma.com/community/yiveno-div',
      'https://www.nngroup.com/articles/yiveno-div',
      'https://www.smashingmagazine.com/yiveno-div',
      'https://www.awwwards.com/yiveno-div',
      'https://www.typewolf.com/yiveno-div',
      'https://dribbble.com/shots/yiveno-div',
      'https://blog.adobe.com/en/yiveno-div',
      'https://www.youtube.com/watch?v=yivenoDiv',
      'https://www.interaction-design.org/yiveno-div',
      'https://uxdesign.cc/yiveno-div'
    ],
    titlePrefixes: [
      'Critique notes:',
      'Reference board:',
      'Pattern study:',
      'Motion pass:',
      'Type pairing:',
      'Case study:',
      'Workshop slide:',
      'IA sketch:',
      'Density check:',
      'Contrast scrap:'
    ],
    subjects: [
      'quiet motion systems',
      'form drop-off patterns',
      'dashboard density',
      'accessible brand contrast',
      'auto layout rituals',
      'editorial font pairing',
      'critique without crushing juniors',
      'empty-state next actions',
      'navigation label decay',
      'onboarding hierarchy',
      'spacing rhythm for decks',
      'dark UI contrast pairs'
    ],
    noteTemplates: [
      'reuse spacing rhythm in client deck',
      'steal contrast pair for dark UI',
      'teach this in Friday critique',
      'compare with onboarding flow v3',
      'park for brand kit refresh',
      'show in next design review'
    ],
    noteHints: [
      'to reuse the spacing rhythm in a client deck',
      'to steal a contrast pair for dark UI',
      'to teach this in Friday critique',
      'to compare with onboarding flow v3',
      'to park for a brand kit refresh',
      'to show in the next design review'
    ],
    excerptSnippets: [
      'Hierarchy that whispers beats decoration that shouts for attention.',
      'Empty states fail when they apologize instead of offering the next action.',
      'Motion should explain structure, not perform brand personality alone.',
      'Labels die quietly; users blame themselves before your navigation.',
      'Density without clutter means every pixel still answers a question.',
      'Critique lands when it names the decision, not the person.'
    ],
    sceneFragments: [
      'for the Sunday scrapbook night',
      'ahead of the studio open house',
      'for the weekend desk rearrange',
      'before the gallery night talk',
      'for the kitchen table sketch',
      'ahead of the evening bus home',
      'for the rainy-day tidy stack',
      'before the morning coffee walk'
    ],
    excerptMiddles: [
      'The next action should sit above the apology copy.',
      'Spacing rhythm only works when the deck mirrors the product.',
      'Contrast pairs fail when dark UI ignores text roles.',
      'Navigation labels rot before anyone files a ticket.',
      'Motion that only sells brand leaves structure unexplained.',
      'Critique sticks when it names the decision, not the junior.',
      'Empty states need a verb, not a shrug illustration.',
      'Density is fine if every pixel still answers a question.'
    ],
    excerptClosers: [
      'Reuse this in the next client deck pass.',
      'Park for the brand kit refresh pile.',
      'Show in Friday critique if time allows.',
      'Compare with onboarding flow v3 tomorrow.',
      'Hold for the gallery night talk notes.',
      'Sketch beside the kitchen table mock.',
      'Bring to the studio open house board.',
      'Check before the morning coffee walk.'
    ]
  },
  developer: {
    hosts: [
      'https://developer.mozilla.org/en-US/docs/yiveno-div',
      'https://docs.github.com/en/yiveno-div',
      'https://www.postgresql.org/docs/yiveno-div',
      'https://stripe.com/docs/yiveno-div',
      'https://developer.chrome.com/docs/yiveno-div',
      'https://linear.app/blog/yiveno-div',
      'https://news.ycombinator.com/item?id=yivenoDiv',
      'https://www.rfc-editor.org/rfc/yiveno-div',
      'https://kubernetes.io/docs/yiveno-div',
      'https://redis.io/docs/yiveno-div'
    ],
    titlePrefixes: [
      'Runbook:',
      'Incident note:',
      'API sketch:',
      'Perf checklist:',
      'RFC skim:',
      'CI tip:',
      'Schema change:',
      'Oncall scrap:',
      'Debug trail:',
      'Migration note:'
    ],
    subjects: [
      'idempotent payment retries',
      'EXPLAIN that lied about seq scans',
      'workflow artifact retention windows',
      'Manifest V3 service worker sleep',
      'roadmap review rituals',
      'promise chains that swallow errors',
      'reading list hygiene on HN',
      'HTTP semantics edge cases',
      'matrix job disk quotas on runners',
      'alarm handlers after SW restart',
      'stable request keys under timeout',
      'hot-set reads that beat fancy plans'
    ],
    noteTemplates: [
      'link from onboarding doc',
      'postmortem follow-up',
      'cut CI minutes with this',
      'verify before the payments cutover',
      'paste into oncall wiki',
      'check after next deploy'
    ],
    noteHints: [
      'to link from the onboarding doc',
      'as a postmortem follow-up',
      'to cut CI minutes with this',
      'to verify before the payments cutover',
      'to paste into the oncall wiki',
      'to check after the next deploy'
    ],
    excerptSnippets: [
      'Retries without a stable request key turn timeouts into duplicate charges.',
      'Sequential reads can beat fancy plans when the hot set still fits in memory.',
      'Branch-scoped caches miss when CI jobs checkout a different ref.',
      'Service worker event handles must stay registered or the worker sleeps mid-task.',
      'Idempotency keys only help if every client path actually sends them.',
      'EXPLAIN is a hint; production load still has to agree with the plan.'
    ],
    sceneFragments: [
      'for the brown-bag lunch talk',
      'ahead of the Friday bike ride',
      'for the weekend errand list',
      'before the evening stretch break',
      'for the mentor circle notes',
      'ahead of the Sunday desk reset',
      'for the commute playlist swap',
      'before the morning coffee refill'
    ],
    excerptMiddles: [
      'Idempotency only helps when every client path sends the key.',
      'Hot-set reads still beat fancy plans under real load.',
      'Branch-scoped caches miss after a different checkout ref.',
      'SW handlers must stay registered or the worker sleeps mid-task.',
      'EXPLAIN is a hint until production agrees with the plan.',
      'Timeouts without stable keys become duplicate charges.',
      'Alarm handlers need a re-register path after SW restart.',
      'Matrix jobs fill disks when artifact retention is unbounded.'
    ],
    excerptClosers: [
      'Link from the onboarding doc when ready.',
      'Paste into the oncall wiki tonight.',
      'Verify before the payments cutover.',
      'Check after the next deploy window.',
      'Bring to the brown-bag lunch talk.',
      'Park for the mentor circle notes.',
      'Hold beside the weekend errand list.',
      'Revisit after the Sunday desk reset.'
    ]
  },
  student: {
    hosts: [
      'https://owl.purdue.edu/owl/yiveno-div',
      'https://openstax.org/books/yiveno-div',
      'https://www.khanacademy.org/yiveno-div',
      'https://www.coursera.org/learn/yiveno-div',
      'https://quizlet.com/yiveno-div',
      'https://library.example.edu/help/yiveno-div',
      'https://www.grammarly.com/blog/yiveno-div',
      'https://www.youtube.com/watch?v=yivenoStudentDiv',
      'https://ocw.mit.edu/yiveno-div',
      'https://www.chegg.com/yiveno-div'
    ],
    titlePrefixes: [
      'Study guide:',
      'Lecture scrap:',
      'Problem set:',
      'Reading notes:',
      'Lab prep:',
      'Exam drill:',
      'Syllabus scrap:',
      'Citation check:',
      'Office-hours note:',
      'Flashcard set:'
    ],
    subjects: [
      'APA thesis statements',
      'metabolism chapter drills',
      'derivatives as a concept',
      'supervised ML week 3',
      'organic functional groups',
      'interlibrary loan chapters',
      'Pomodoro blocks that stick',
      'DOI wrong-edition traps',
      'spaced repetition decks',
      'lab report citations',
      'midterm definition lists',
      'worked example decision trees'
    ],
    noteTemplates: [
      'review before midterm',
      'cite in lab report',
      'ask TA in office hours',
      'park for final essay cluster',
      'add to Anki tonight',
      'check before quiz window'
    ],
    noteHints: [
      'to review before the midterm',
      'to cite in the lab report',
      'to ask the TA in office hours',
      'to park for the final essay cluster',
      'to add to Anki tonight',
      'to check before the quiz window'
    ],
    excerptSnippets: [
      'Definitions stick when you restate them in your own words before the quiz window.',
      'Worked examples fail when you only copy the last line instead of the decision tree.',
      'Citation managers still need a human check on DOIs that resolve to the wrong edition.',
      'Spaced repetition beats one long cram block when the exam spans multiple chapters.',
      'Office hours help when you bring the stuck step, not the whole unsolved set.',
      'Lab prep notes matter more than the pretty plot you paste into the PDF.'
    ],
    sceneFragments: [
      'for the Sunday laundry pile',
      'ahead of the evening bus home',
      'for the club bake sale shift',
      'before the advising appointment',
      'for the roommate chore chart',
      'ahead of the weekend kitchen tidy',
      'for the hallway bulletin glance',
      'before the morning alarm snooze'
    ],
    excerptMiddles: [
      'Restate the definition before the quiz window closes.',
      'Worked examples fail when you only copy the last line.',
      'DOI checks still need a human on wrong editions.',
      'Spaced decks beat one long cram across chapters.',
      'Office hours help when you bring the stuck step.',
      'Lab prep notes matter more than the pretty plot.',
      'Flashcards stick when the prompt asks for a scene.',
      'Syllabus scraps drift unless you date the edition.'
    ],
    excerptClosers: [
      'Review before the midterm block.',
      'Cite in the lab report draft.',
      'Ask the TA in office hours.',
      'Add to Anki tonight.',
      'Park for the final essay cluster.',
      'Check before the quiz window.',
      'Hold for the advising appointment.',
      'Bring on the evening bus home.'
    ]
  },
  knowledge_worker: {
    hosts: [
      'https://www.notion.so/yiveno-div',
      'https://docs.google.com/document/d/yiveno-div',
      'https://slack.com/help/articles/yiveno-div',
      'https://app.asana.com/0/yiveno-div',
      'https://hr.example.com/handbook/yiveno-div',
      'https://support.zoom.com/hc/en/article?id=yiveno-div',
      'https://confluence.example.com/display/OPS/yiveno-div',
      'https://calendar.google.com/calendar/u/0/r/yiveno-div',
      'https://www.microsoft.com/en-us/microsoft-365/yiveno-div',
      'https://support.google.com/a/yiveno-div'
    ],
    titlePrefixes: [
      'Policy note:',
      'Meeting scrap:',
      'Ops checklist:',
      'Vendor brief:',
      'Handbook:',
      'Agenda draft:',
      'RACI scrap:',
      'Status ritual:',
      'QBR talking points:',
      'Travel exception:'
    ],
    subjects: [
      'expense meals and travel',
      'QBR North America deck',
      'Slack status and pause',
      'vendor onboarding refresh',
      'PTO blackout windows',
      'cloud recording retention',
      'spring ops RACI',
      'all-hands September agenda',
      'month-end close approvals',
      'legal dry-run checklist',
      'focus Friday blocks',
      'renewals at risk threads'
    ],
    noteTemplates: [
      'send before month-end close',
      'ping legal after dry run',
      'block focus Friday',
      'compare with last QBR deck',
      'forward to ops channel',
      'confirm owner before standup'
    ],
    noteHints: [
      'to send before month-end close',
      'to ping legal after the dry run',
      'to block focus Friday',
      'to compare with the last QBR deck',
      'to forward to the ops channel',
      'to confirm the owner before standup'
    ],
    excerptSnippets: [
      'Approvals stall when the owner is Consulted on paper but never named in the thread.',
      'Travel exceptions need a written reason; chat thumbs-up is not an audit trail.',
      'Paused notifications still surface urgent DMs; everything else waits for clear status.',
      'All-hands agendas fail when renewals at risk are buried under hiring theater.',
      'RACI only helps if the Responsible person is a human, not a team emoji.',
      'Expense policy fights start when meals and travel sit in different Notion pages.'
    ],
    sceneFragments: [
      'for the lobby bulletin glance',
      'ahead of the charity drive kickoff',
      'for the new-hire buddy lunch',
      'before the building elevator wait',
      'for the cafeteria tray line',
      'ahead of the evening commute home',
      'for the wellness flyer stack',
      'before the holiday shutdown notice'
    ],
    excerptMiddles: [
      'Approvals stall when Consulted never becomes a named owner.',
      'Travel exceptions need a written reason, not a chat thumb.',
      'Paused status still surfaces urgent DMs first.',
      'All-hands bury renewals under hiring theater.',
      'RACI fails when Responsible is a team emoji.',
      'Meals and travel fight when they live on different pages.',
      'Focus Friday only works if the calendar block is real.',
      'Month-end close needs the owner confirmed before standup.'
    ],
    excerptClosers: [
      'Send before month-end close.',
      'Ping legal after the dry run.',
      'Block focus Friday on the calendar.',
      'Forward to the ops channel.',
      'Compare with the last QBR deck.',
      'Confirm the owner before standup.',
      'Hold for the charity drive kickoff.',
      'Check before the holiday shutdown notice.'
    ]
  }
}

const WEAK_TITLES = [
  'Untitled document',
  'Notes',
  'Draft',
  'Document',
  'New page',
  'Copy of Notes',
  'Untitled'
] as const

const PATH_TOKENS = [
  'scrap',
  'memo',
  'clip',
  'ref',
  'pack',
  'later',
  'v2',
  'inbox',
  'parked',
  'skim'
] as const

function resolveOptions(
  keyPrefixOrOptions: string | ProbeDiversityBuildOptions | undefined,
  maybeOptions: ProbeDiversityBuildOptions | undefined,
  defaultPrefix: string
): { keyPrefix: string; seed: number } {
  if (typeof keyPrefixOrOptions === 'string') {
    return {
      keyPrefix: keyPrefixOrOptions,
      seed: maybeOptions?.seed ?? DEFAULT_PROBE_FILLER_SEED
    }
  }
  if (keyPrefixOrOptions && typeof keyPrefixOrOptions === 'object') {
    return {
      keyPrefix: keyPrefixOrOptions.keyPrefix ?? defaultPrefix,
      seed: keyPrefixOrOptions.seed ?? DEFAULT_PROBE_FILLER_SEED
    }
  }
  return {
    keyPrefix: defaultPrefix,
    seed: maybeOptions?.seed ?? DEFAULT_PROBE_FILLER_SEED
  }
}

function pathSlug(rng: SeededRng, index: number): string {
  return `${rng.pick(PATH_TOKENS)}-${index}-${rng.nextInt(9000) + 1000}`
}

/**
 * 生成多样性书签（过程随机；含少量弱标题 + 附注探针）。
 * 兼容旧签名：`(persona, count, keyPrefix?)`。
 */
export function buildDiversityBookmarkSeeds(
  persona: RecallProbePersonaId,
  count: number,
  keyPrefixOrOptions?: string | ProbeDiversityBuildOptions,
  maybeOptions?: ProbeDiversityBuildOptions
): RecallProbeBookmarkSeed[] {
  const { keyPrefix, seed } = resolveOptions(keyPrefixOrOptions, maybeOptions, `div-bm-${persona}`)
  const pack = DIVERSITY_PACKS[persona]
  const daysPlan = planDaysAgoSequence(seed, 'days-bm', persona, count)
  const out: RecallProbeBookmarkSeed[] = []
  for (let i = 0; i < count; i += 1) {
    const rng = rngForFillerItem(seed, 'div-bm', i, persona)
    const host = rng.pick(pack.hosts)
    const prefix = rng.pick(pack.titlePrefixes)
    const subject = pickZipfWeighted(rng, pack.subjects)
    const daysAgo = daysPlan[i]!
    const weak = rng.next() < 0.07
    const withNote = weak || rng.next() < 0.16
    let note: string | undefined
    let noteHint: string | undefined
    if (withNote) {
      const noteIdx = rng.nextInt(pack.noteTemplates.length)
      note = `${pack.noteTemplates[noteIdx]!} (#${i + 1})`
      noteHint = pack.noteHints[noteIdx]!
    }
    const title = weak ? rng.pick(WEAK_TITLES) : `${prefix} ${subject}`
    const clues = generateDiversityClues({
      persona,
      kind: 'bookmark',
      index: i,
      seed,
      title,
      subject,
      daysAgo,
      host,
      sceneFragments: pack.sceneFragments,
      ...(note ? { note } : {}),
      ...(noteHint ? { noteHint } : {})
    })
    out.push({
      key: `${keyPrefix}-${i}`,
      title,
      url: `${host}/${pathSlug(rng, i)}`,
      daysAgo,
      ...(note ? { note } : {}),
      clues
    })
  }
  return out
}

/**
 * 生成多样性摘录（过程随机；含纯附注弱页名）。
 * 兼容旧签名：`(persona, count, keyPrefix?)`。
 */
export function buildDiversityExcerptSeeds(
  persona: RecallProbePersonaId,
  count: number,
  keyPrefixOrOptions?: string | ProbeDiversityBuildOptions,
  maybeOptions?: ProbeDiversityBuildOptions
): RecallProbeExcerptSeed[] {
  const { keyPrefix, seed } = resolveOptions(keyPrefixOrOptions, maybeOptions, `div-ex-${persona}`)
  const pack = DIVERSITY_PACKS[persona]
  const daysPlan = planDaysAgoSequence(seed, 'days-ex', persona, count)
  const out: RecallProbeExcerptSeed[] = []
  for (let i = 0; i < count; i += 1) {
    const rng = rngForFillerItem(seed, 'div-ex', i, persona)
    const host = rng.pick(pack.hosts)
    const opener = rng.pick(pack.excerptSnippets)
    const middle = rng.pick(pack.excerptMiddles)
    const closer = rng.pick(pack.excerptClosers)
    const selectedText = `${opener} ${middle} ${closer}`
    const daysAgo = daysPlan[i]!
    const weakPage = rng.next() < 0.1
    const withNote = weakPage || rng.next() < 0.18
    let note: string | undefined
    let noteHint: string | undefined
    if (withNote) {
      const noteIdx = rng.nextInt(pack.noteTemplates.length)
      note = `${pack.noteTemplates[noteIdx]!} excerpt ${i + 1}`
      noteHint = pack.noteHints[noteIdx]!
    }
    // 弱页只 pick WEAK；否则 prefix 再 Zipf subject（rng 顺位）
    let pageTitle: string
    let subject = ''
    if (weakPage) {
      pageTitle = rng.pick(WEAK_TITLES)
    } else {
      const prefix = rng.pick(pack.titlePrefixes)
      subject = pickZipfWeighted(rng, pack.subjects)
      pageTitle = `${prefix} ${subject}`
    }
    const clues = generateDiversityClues({
      persona,
      kind: 'excerpt',
      index: i,
      seed,
      title: pageTitle,
      subject,
      daysAgo,
      host,
      sceneFragments: pack.sceneFragments,
      ...(note ? { note } : {}),
      ...(noteHint ? { noteHint } : {})
    })
    out.push({
      key: `${keyPrefix}-${i}`,
      pageTitle,
      sourceUrl: `${host}/excerpt/${pathSlug(rng, i)}`,
      selectedText,
      daysAgo,
      ...(note ? { note } : {}),
      clues
    })
  }
  return out
}
