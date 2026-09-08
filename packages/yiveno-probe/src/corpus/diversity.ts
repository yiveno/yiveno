/**
 * 质量轮多样性语料：画像风味 + 过程随机（可复现 seed）。
 * URL 保留 yiveno-div 指纹供 DEV 清理；禁止进召回 runtime。
 */

import { DEFAULT_PROBE_FILLER_SEED, rngForFillerItem, type SeededRng } from './prng'
import type { RecallProbePersonaId } from './types'
import type { RecallProbeBookmarkSeed, RecallProbeExcerptSeed } from './types'

export type ProbeDiversityBuildOptions = {
  keyPrefix?: string
  /** 过程随机种子；缺省用 DEFAULT_PROBE_FILLER_SEED */
  seed?: number
}

type DiversityHostPack = {
  hosts: readonly string[]
  titlePrefixes: readonly string[]
  subjects: readonly string[]
  noteTemplates: readonly string[]
  excerptSnippets: readonly string[]
}

const PACKS: Record<RecallProbePersonaId, DiversityHostPack> = {
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
    excerptSnippets: [
      'The sample frame still undercounts informal archives that never enter the catalog.',
      'Causal claims collapse when the diary window is shorter than the policy cycle.',
      'Secondary sources rarely preserve the annotation layer readers actually used.',
      'Verification rituals matter more than another dashboard of unverified quotes.',
      'Field notes drift when the codebook is updated mid-wave without a migration log.',
      'Interview prompts work better when they ask for a concrete scene, not a trait.'
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
    excerptSnippets: [
      'Hierarchy that whispers beats decoration that shouts for attention.',
      'Empty states fail when they apologize instead of offering the next action.',
      'Motion should explain structure, not perform brand personality alone.',
      'Labels die quietly; users blame themselves before your navigation.',
      'Density without clutter means every pixel still answers a question.',
      'Critique lands when it names the decision, not the person.'
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
      'Actions cache misses across forks',
      'Manifest V3 service worker sleep',
      'roadmap review rituals',
      'promise chains that swallow errors',
      'reading list hygiene on HN',
      'HTTP semantics edge cases',
      'branch-scoped dependency caches',
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
    excerptSnippets: [
      'Retries without a stable request key turn timeouts into duplicate charges.',
      'Sequential reads can beat fancy plans when the hot set still fits in memory.',
      'Branch-scoped caches miss when CI jobs checkout a different ref.',
      'Service worker event handles must stay registered or the worker sleeps mid-task.',
      'Idempotency keys only help if every client path actually sends them.',
      'EXPLAIN is a hint; production load still has to agree with the plan.'
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
    excerptSnippets: [
      'Definitions stick when you restate them in your own words before the quiz window.',
      'Worked examples fail when you only copy the last line instead of the decision tree.',
      'Citation managers still need a human check on DOIs that resolve to the wrong edition.',
      'Spaced repetition beats one long cram block when the exam spans multiple chapters.',
      'Office hours help when you bring the stuck step, not the whole unsolved set.',
      'Lab prep notes matter more than the pretty plot you paste into the PDF.'
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
    excerptSnippets: [
      'Approvals stall when the owner is Consulted on paper but never named in the thread.',
      'Travel exceptions need a written reason; chat thumbs-up is not an audit trail.',
      'Paused notifications still surface urgent DMs; everything else waits for clear status.',
      'All-hands agendas fail when renewals at risk are buried under hiring theater.',
      'RACI only helps if the Responsible person is a human, not a team emoji.',
      'Expense policy fights start when meals and travel sit in different Notion pages.'
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
  const pack = PACKS[persona]
  const out: RecallProbeBookmarkSeed[] = []
  for (let i = 0; i < count; i += 1) {
    const rng = rngForFillerItem(seed, 'div-bm', i, persona)
    const host = rng.pick(pack.hosts)
    const prefix = rng.pick(pack.titlePrefixes)
    const subject = rng.pick(pack.subjects)
    const daysAgo = 1 + rng.nextInt(400)
    const weak = rng.next() < 0.07
    const withNote = weak || rng.next() < 0.16
    const note = withNote ? `${rng.pick(pack.noteTemplates)} (#${i + 1})` : undefined
    const title = weak ? rng.pick(WEAK_TITLES) : `${prefix} ${subject}`
    const suggestedClues =
      withNote && note
        ? [
            `the ${weak ? 'untitled ' : ''}page where I noted ${note.split(' (#')[0]}`,
            `${prefix.toLowerCase().replace(/:$/, '')} I saved about ${subject}`
          ]
        : []
    out.push({
      key: `${keyPrefix}-${i}`,
      title,
      url: `${host}/${pathSlug(rng, i)}`,
      daysAgo,
      ...(note ? { note } : {}),
      suggestedClues
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
  const pack = PACKS[persona]
  const out: RecallProbeExcerptSeed[] = []
  for (let i = 0; i < count; i += 1) {
    const rng = rngForFillerItem(seed, 'div-ex', i, persona)
    const host = rng.pick(pack.hosts)
    const snippet = rng.pick(pack.excerptSnippets)
    const daysAgo = 2 + rng.nextInt(300)
    const weakPage = rng.next() < 0.1
    const withNote = weakPage || rng.next() < 0.18
    const note = withNote ? `${rng.pick(pack.noteTemplates)} excerpt ${i + 1}` : undefined
    const pageTitle = weakPage
      ? rng.pick(WEAK_TITLES)
      : `${rng.pick(pack.titlePrefixes)} ${rng.pick(pack.subjects)}`
    const suggestedClues =
      withNote && note
        ? [
            `excerpt I annotated: ${note.split(' excerpt')[0]}`,
            `piece about ${snippet.slice(0, 32).toLowerCase()}…`
          ]
        : []
    out.push({
      key: `${keyPrefix}-${i}`,
      pageTitle,
      sourceUrl: `${host}/excerpt/${pathSlug(rng, i)}`,
      selectedText: `${snippet} (div ${i + 1})`,
      daysAgo,
      ...(note ? { note } : {}),
      suggestedClues
    })
  }
  return out
}
