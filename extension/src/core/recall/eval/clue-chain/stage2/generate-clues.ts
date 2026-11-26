/**
 * Stage 2 逆向 clue：从物品反推，不照抄标题全文。
 * 签名只吃 ClueGenItemView（无行为字段）。
 */

import { CLUE_CHAIN_STAGE2_SIZES } from '@/core/recall/eval/clue-chain/stage2/constants'
import type { Stage2PositiveTier, Stage2Task } from '@/core/recall/eval/clue-chain/stage2/types'
import {
  createMulberry32,
  nextInt,
  shuffleInPlace
} from '@/core/recall/eval/behavior-ablation/prng'
import type { ClueGenItemView } from '@/core/recall/eval/behavior-ablation/types'

/** clue 生成输入：显式排除行为字段。 */
export type Stage2ClueGenerationInput = {
  views: readonly ClueGenItemView[]
  seed: number
}

const TIER_PAIR_CYCLE: ReadonlyArray<readonly [Stage2PositiveTier, Stage2PositiveTier]> = [
  ['concrete', 'semi_fuzzy'],
  ['concrete', 'vague'],
  ['semi_fuzzy', 'vague']
]

/** 库外虚构主题（负例；不得与 TOPIC_CLUSTERS id 撞车）。 */
const NEGATIVE_TOPICS: readonly {
  id: string
  shared: string
  detail: string
  feeling: string
}[] = [
  {
    id: 'neg-orchid',
    shared: 'orchid',
    detail: 'phalaenopsis watering',
    feeling: 'humid greenhouse'
  },
  { id: 'neg-sailing', shared: 'sailing', detail: 'spinnaker trim', feeling: 'windy afternoon' },
  { id: 'neg-pottery', shared: 'pottery', detail: 'kiln cone chart', feeling: 'clay under nails' },
  { id: 'neg-beekeeping', shared: 'beekeeping', detail: 'queen marking', feeling: 'smoky hive' },
  {
    id: 'neg-astronomy',
    shared: 'astronomy',
    detail: 'dobsonian collimation',
    feeling: 'cold rooftop'
  },
  { id: 'neg-fencing', shared: 'fencing', detail: 'foil tip pressure', feeling: 'salle echo' },
  {
    id: 'neg-mycology',
    shared: 'mycology',
    detail: 'spore print colors',
    feeling: 'damp forest floor'
  },
  {
    id: 'neg-calligraphy',
    shared: 'calligraphy',
    detail: 'nib oblique angle',
    feeling: 'ink on blotter'
  },
  {
    id: 'neg-origami',
    shared: 'origami',
    detail: 'wet-folding cranes',
    feeling: 'thin paper crackle'
  },
  { id: 'neg-hamradio', shared: 'ham radio', detail: 'QRP antenna tuner', feeling: 'static hiss' },
  { id: 'neg-vivarium', shared: 'vivarium', detail: 'dart frog bioactive', feeling: 'misty glass' },
  { id: 'neg-letterpress', shared: 'letterpress', detail: 'chase lockup', feeling: 'oil and lead' },
  {
    id: 'neg-parkour',
    shared: 'parkour',
    detail: 'precision jump drills',
    feeling: 'scraped palms'
  },
  {
    id: 'neg-cheese',
    shared: 'cheese aging',
    detail: 'cave humidity log',
    feeling: 'ammonia tang'
  },
  {
    id: 'neg-glassblowing',
    shared: 'glassblowing',
    detail: 'punty transfer',
    feeling: 'furnace heat'
  },
  { id: 'neg-falconry', shared: 'falconry', detail: 'jess and swivel', feeling: 'leather glove' },
  { id: 'neg-locksmith', shared: 'locksmith', detail: 'pin tumbler rake', feeling: 'tiny clicks' },
  {
    id: 'neg-taxidermy',
    shared: 'taxidermy',
    detail: 'form measurement',
    feeling: 'sawdust smell'
  },
  { id: 'neg-surfing', shared: 'surfing', detail: 'rail engagement', feeling: 'salty dawn' },
  { id: 'neg-bonsai', shared: 'bonsai', detail: 'wiring young maple', feeling: 'quiet bench' },
  { id: 'neg-caving', shared: 'caving', detail: 'single rope technique', feeling: 'echoing drip' },
  {
    id: 'neg-bookbinding',
    shared: 'bookbinding',
    detail: 'kettle stitch',
    feeling: 'linen thread'
  },
  {
    id: 'neg-beetles',
    shared: 'beetle rearing',
    detail: 'substrate moisture',
    feeling: 'crunchy leaves'
  },
  {
    id: 'neg-iceclimbing',
    shared: 'ice climbing',
    detail: 'screw placements',
    feeling: 'frozen breath'
  }
]

function pick<T>(items: readonly T[], rng: () => number): T {
  return items[nextInt(rng, items.length)]!
}

function concreteClue(view: ClueGenItemView, rng: () => number): string {
  const d0 = view.distinctiveTerms[0] ?? 'detail'
  const d1 = view.distinctiveTerms[1] ?? d0
  const shared = view.sharedTerms[0] ?? 'topic'
  const domainHint = view.domain.split('.')[0] ?? 'site'
  return pick(
    [
      `that ${shared} piece that went deep on ${d0} and ${d1}`,
      `the ${shared} writeup mentioning ${d0}, I think from ${domainHint}`,
      `saved notes about ${d0} for ${shared}, plus something on ${d1}`,
      `looking for my ${shared} clip — distinctive bit was ${d0}`
    ],
    rng
  )
}

function semiFuzzyClue(view: ClueGenItemView, rng: () => number): string {
  const d0 = view.distinctiveTerms[0] ?? 'detail'
  const shared = view.sharedTerms[1] ?? view.sharedTerms[0] ?? 'topic'
  const domainHint = view.domain.split('.')[0] ?? 'site'
  return pick(
    [
      `the ${shared} thing with ${d0} in it`,
      `something from ${domainHint} about ${shared}, maybe ${d0}`,
      `where did I put those ${shared} notes — ${d0} sticks out`,
      `half-remember ${shared}; the part about ${d0}`
    ],
    rng
  )
}

function vagueClue(view: ClueGenItemView, rng: () => number): string {
  const shared = view.sharedTerms[0] ?? 'topic'
  const feeling = pick(
    ['felt useful later', 'wanted to revisit', 'marked for later', 'skimmed on a commute'],
    rng
  )
  const timeFeel = pick(
    ['a few weeks back', 'sometime last month', 'not that old', 'earlier this summer'],
    rng
  )
  const sourceFeel = pick(
    [
      `from a ${view.domain.split('.')[0] ?? 'site'} rabbit hole`,
      'from some article tab',
      'after a long read'
    ],
    rng
  )
  return pick(
    [
      `${shared} stuff I ${feeling}, ${timeFeel}`,
      `fuzzy ${shared} save — ${sourceFeel}`,
      `can't recall the title, just ${shared} and ${feeling}`,
      `${timeFeel} I grabbed something ${shared}-related`
    ],
    rng
  )
}

function clueForTier(view: ClueGenItemView, tier: Stage2PositiveTier, rng: () => number): string {
  if (tier === 'concrete') return concreteClue(view, rng)
  if (tier === 'semi_fuzzy') return semiFuzzyClue(view, rng)
  return vagueClue(view, rng)
}

function embeddingAnchorForTier(view: ClueGenItemView, tier: Stage2PositiveTier): string {
  if (tier === 'concrete') {
    return view.embeddingAnchor
  }
  if (tier === 'semi_fuzzy') {
    return `${view.clusterId}::shared::${view.distinctiveTerms[0] ?? 'x'}`
  }
  return `${view.clusterId}::shared`
}

function assertNoTitleCopy(clue: string, title: string): void {
  const normalizedClue = clue.toLowerCase().replace(/\s+/g, ' ').trim()
  const normalizedTitle = title.toLowerCase().replace(/\s+/g, ' ').trim()
  if (normalizedTitle.length >= 12 && normalizedClue.includes(normalizedTitle)) {
    throw new Error(`clue 禁止照抄标题全文: "${title}"`)
  }
}

/**
 * 从 views 生成正例 + 负例任务。
 * 每目标恰好 2 条；三档经轮转覆盖全集。
 */
export function generateStage2ClueTasks(input: Stage2ClueGenerationInput): Stage2Task[] {
  const { views, seed } = input
  if (views.length !== CLUE_CHAIN_STAGE2_SIZES.corpusItems) {
    throw new Error(`generateStage2ClueTasks: views ${views.length}`)
  }

  const rng = createMulberry32(seed ^ 0x51)
  const ordered = [...views]
  shuffleInPlace(ordered, rng)

  const tasks: Stage2Task[] = []
  let taskIndex = 0

  for (let i = 0; i < ordered.length; i += 1) {
    const view = ordered[i]!
    const pair = TIER_PAIR_CYCLE[i % TIER_PAIR_CYCLE.length]!
    for (const tier of pair) {
      taskIndex += 1
      const clue = clueForTier(view, tier, rng)
      assertNoTitleCopy(clue, view.title)
      tasks.push({
        id: `s2-${String(taskIndex).padStart(3, '0')}`,
        tier,
        clue,
        targetId: view.id,
        clusterId: view.clusterId,
        embeddingAnchor: embeddingAnchorForTier(view, tier),
        note: `${tier} 逆向自 ${view.clusterId} / ${view.distinctiveTerms.join('+')}`
      })
    }
  }

  if (tasks.length !== CLUE_CHAIN_STAGE2_SIZES.positiveTasks) {
    throw new Error(`正例任务数 ${tasks.length}`)
  }

  if (NEGATIVE_TOPICS.length !== CLUE_CHAIN_STAGE2_SIZES.negativeTasks) {
    throw new Error(`负例主题表长度须为 ${CLUE_CHAIN_STAGE2_SIZES.negativeTasks}`)
  }

  for (let i = 0; i < NEGATIVE_TOPICS.length; i += 1) {
    const topic = NEGATIVE_TOPICS[i]!
    taskIndex += 1
    const clue = pick(
      [
        `that ${topic.shared} piece about ${topic.detail}`,
        `${topic.feeling} — looking for ${topic.shared} notes`,
        `where did I save the ${topic.detail} writeup`,
        `fuzzy memory of ${topic.shared}, ${topic.feeling}`
      ],
      rng
    )
    tasks.push({
      id: `s2-neg-${String(i + 1).padStart(2, '0')}`,
      tier: 'negative',
      clue,
      targetId: null,
      clusterId: topic.id,
      embeddingAnchor: `negative::${topic.id}::orthogonal`,
      note: `负例：库中无 ${topic.shared}`
    })
  }

  if (tasks.length !== CLUE_CHAIN_STAGE2_SIZES.totalTasks) {
    throw new Error(`总任务数 ${tasks.length}`)
  }

  return tasks
}

/** 运行时断言：views 不含行为字段。 */
export function assertStage2ViewsHaveNoBehaviorFields(views: readonly ClueGenItemView[]): void {
  const forbidden = [
    'openCount',
    'settledCount',
    'dismissCount',
    'lastOpenedAt',
    'lastSettledAt',
    'lastDismissedAt'
  ] as const
  for (const view of views) {
    const record = view as unknown as Record<string, unknown>
    for (const key of forbidden) {
      if (key in record && record[key] !== undefined) {
        throw new Error(`clue view ${view.id} 不得含行为字段 ${key}`)
      }
    }
  }
}
