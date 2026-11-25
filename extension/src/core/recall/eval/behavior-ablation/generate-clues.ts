/**
 * 从物品逆向生成模糊 clue。
 * 签名只吃 ClueGenItemView（无行为字段）— 类型层禁止传入 openCount 等。
 */

import { BEHAVIOR_ABLATION_SIZES } from '@/core/recall/eval/behavior-ablation/constants'
import {
  createMulberry32,
  nextInt,
  shuffleInPlace
} from '@/core/recall/eval/behavior-ablation/prng'
import type {
  BehaviorAblationTaskBase,
  ClueGenItemView,
  MechConflictTask
} from '@/core/recall/eval/behavior-ablation/types'

/** clue 生成输入：显式排除行为字段（结构性保证）。 */
export type ClueGenerationInput = {
  views: readonly ClueGenItemView[]
  seed: number
}

function viewsByCluster(views: readonly ClueGenItemView[]): Map<string, ClueGenItemView[]> {
  const map = new Map<string, ClueGenItemView[]>()
  for (const view of views) {
    const list = map.get(view.clusterId) ?? []
    list.push(view)
    map.set(view.clusterId, list)
  }
  return map
}

function paraphraseClue(view: ClueGenItemView, rng: () => number): string {
  const d0 = view.distinctiveTerms[0] ?? 'detail'
  const d1 = view.distinctiveTerms[1] ?? d0
  const shared = view.sharedTerms[0] ?? 'topic'
  const variants = [
    `that ${shared} piece about ${d0}, something with ${d1}`,
    `the ${shared} notes mentioning ${d0} and ${d1}`,
    `I saved a ${shared} writeup on ${d0}`
  ]
  return variants[nextInt(rng, variants.length)]!
}

function partialClue(view: ClueGenItemView, rng: () => number): string {
  const d0 = view.distinctiveTerms[0] ?? 'detail'
  const shared = view.sharedTerms[1] ?? view.sharedTerms[0] ?? 'topic'
  const variants = [
    `the one about ${d0}`,
    `${shared} thing with ${d0}`,
    `where did I put the ${d0} notes`
  ]
  return variants[nextInt(rng, variants.length)]!
}

function wrongDetailClue(
  view: ClueGenItemView,
  distractor: ClueGenItemView,
  rng: () => number
): string {
  const targetDistinct = view.distinctiveTerms[0] ?? 'target'
  const wrong = distractor.distinctiveTerms[0] ?? 'other'
  const shared = view.sharedTerms[0] ?? 'topic'
  const variants = [
    `the ${shared} article on ${targetDistinct}, maybe it mentioned ${wrong}`,
    `${shared} notes for ${targetDistinct} — wait was it ${wrong}?`,
    `looking for ${targetDistinct} ${shared} but I keep thinking ${wrong}`
  ]
  return variants[nextInt(rng, variants.length)]!
}

function conflictClue(
  target: ClueGenItemView,
  distractor: ClueGenItemView,
  rng: () => number
): { clue: string; statementPull: string[]; targetPull: string[] } {
  const aTerm = distractor.distinctiveTerms[0]!
  const bTerm = target.distinctiveTerms[0]!
  const shared = target.sharedTerms[0] ?? 'topic'
  // 陈述细节偏向干扰项 A；其余细节偏向真目标 B
  const variants = [
    `the ${shared} page heavy on ${aTerm}, but really the ${bTerm} section I cared about`,
    `${shared} writeup — I said ${aTerm} out loud though I meant the ${bTerm} part`,
    `find that ${shared} piece: people mention ${aTerm} first, mine was about ${bTerm}`
  ]
  return {
    clue: variants[nextInt(rng, variants.length)]!,
    statementPull: [aTerm, ...distractor.distinctiveTerms.slice(0, 2)],
    targetPull: [bTerm, ...target.distinctiveTerms.slice(0, 2)]
  }
}

/**
 * 构造主任务 + 两轨冲突子集。
 * **禁止**接收行为数值：参数类型为 ClueGenerationInput。
 */
export function generateClueTasks(input: ClueGenerationInput): {
  mainTasks: BehaviorAblationTaskBase[]
  conflictProdTasks: BehaviorAblationTaskBase[]
  conflictMechTasks: MechConflictTask[]
} {
  const { views, seed } = input
  if (views.length !== BEHAVIOR_ABLATION_SIZES.corpusItems) {
    throw new Error(`generateClueTasks: views ${views.length}`)
  }

  const rng = createMulberry32(seed ^ 0x33)
  const byCluster = viewsByCluster(views)
  // 结构偏好：打乱簇序，簇内顺序保留靠前优先（与行为播种独立，互不读字段）
  const clusterOrder = [...byCluster.keys()]
  shuffleInPlace(clusterOrder, rng)
  const preferred: ClueGenItemView[] = []
  for (const clusterId of clusterOrder) {
    preferred.push(...(byCluster.get(clusterId) ?? []))
  }

  const mainTasks: BehaviorAblationTaskBase[] = []
  let mainIdx = 0
  const kinds: Array<'paraphrase' | 'partial' | 'wrong_detail'> = [
    'paraphrase',
    'partial',
    'wrong_detail'
  ]

  for (const view of preferred) {
    if (mainTasks.length >= BEHAVIOR_ABLATION_SIZES.mainTasks) {
      break
    }
    const kind = kinds[mainIdx % kinds.length]!
    const clusterMates = (byCluster.get(view.clusterId) ?? []).filter(v => v.id !== view.id)
    const distractor =
      clusterMates.length > 0 ? clusterMates[nextInt(rng, clusterMates.length)]! : view

    let clue: string
    if (kind === 'paraphrase') {
      clue = paraphraseClue(view, rng)
    } else if (kind === 'partial') {
      clue = partialClue(view, rng)
    } else {
      clue = wrongDetailClue(view, distractor, rng)
    }

    mainTasks.push({
      id: `main-${String(mainIdx + 1).padStart(3, '0')}`,
      track: 'prod_main',
      kind,
      clue,
      targetId: view.id,
      embeddingAnchor: view.embeddingAnchor,
      statementPullTerms: [...view.distinctiveTerms.slice(0, 2)],
      targetPullTerms: [...view.distinctiveTerms]
    })
    mainIdx += 1
  }

  // 冲突对：每簇取若干 (target, distractor)
  const conflictProdTasks: BehaviorAblationTaskBase[] = []
  const conflictMechTasks: MechConflictTask[] = []
  let conflictIdx = 0
  const clusterIds = [...byCluster.keys()].sort()
  shuffleInPlace(clusterIds, rng)

  for (const clusterId of clusterIds) {
    const mates = byCluster.get(clusterId) ?? []
    if (mates.length < 2) continue
    // 目标取靠前，干扰取靠后（结构位；不读行为数值）
    const ordered = [...mates]
    for (let i = 0; i < Math.min(3, Math.floor(ordered.length / 2)); i += 1) {
      if (conflictProdTasks.length >= BEHAVIOR_ABLATION_SIZES.conflictProd) {
        break
      }
      const target = ordered[i]!
      const distractor = ordered[ordered.length - 1 - i]!
      if (target.id === distractor.id) continue
      const built = conflictClue(target, distractor, rng)
      conflictIdx += 1
      const idNum = String(conflictIdx).padStart(3, '0')

      conflictProdTasks.push({
        id: `cprod-${idNum}`,
        track: 'prod_conflict',
        kind: 'conflict',
        clue: built.clue,
        targetId: target.id,
        distractorId: distractor.id,
        embeddingAnchor: target.embeddingAnchor,
        statementPullTerms: built.statementPull,
        targetPullTerms: built.targetPull
      })

      // 机制轨：同对另存；条件注入用区分词
      conflictMechTasks.push({
        id: `cmech-${idNum}`,
        track: 'mech_conflict',
        kind: 'conflict',
        clue: built.clue,
        targetId: target.id,
        distractorId: distractor.id,
        embeddingAnchor: target.embeddingAnchor,
        statementPullTerms: built.statementPull,
        targetPullTerms: built.targetPull,
        statementConditionValue: distractor.distinctiveTerms[0]!,
        behaviorConditionValue: target.distinctiveTerms[0]!,
        conditionSlot: 'contentTerm'
      })
    }
    if (conflictProdTasks.length >= BEHAVIOR_ABLATION_SIZES.conflictProd) {
      break
    }
  }

  // 若簇内配对不够，跨簇补齐（仍标 conflict）
  while (conflictProdTasks.length < BEHAVIOR_ABLATION_SIZES.conflictProd) {
    const target = preferred[nextInt(rng, preferred.length)]!
    let distractor = preferred[nextInt(rng, preferred.length)]!
    let guard = 0
    while (distractor.id === target.id && guard < 20) {
      distractor = preferred[nextInt(rng, preferred.length)]!
      guard += 1
    }
    const built = conflictClue(target, distractor, rng)
    conflictIdx += 1
    const idNum = String(conflictIdx).padStart(3, '0')
    conflictProdTasks.push({
      id: `cprod-${idNum}`,
      track: 'prod_conflict',
      kind: 'conflict',
      clue: built.clue,
      targetId: target.id,
      distractorId: distractor.id,
      embeddingAnchor: target.embeddingAnchor,
      statementPullTerms: built.statementPull,
      targetPullTerms: built.targetPull
    })
    conflictMechTasks.push({
      id: `cmech-${idNum}`,
      track: 'mech_conflict',
      kind: 'conflict',
      clue: built.clue,
      targetId: target.id,
      distractorId: distractor.id,
      embeddingAnchor: target.embeddingAnchor,
      statementPullTerms: built.statementPull,
      targetPullTerms: built.targetPull,
      statementConditionValue: distractor.distinctiveTerms[0]!,
      behaviorConditionValue: target.distinctiveTerms[0]!,
      conditionSlot: 'contentTerm'
    })
  }

  // 截断到冻结规模
  const prod = conflictProdTasks.slice(0, BEHAVIOR_ABLATION_SIZES.conflictProd)
  const mech = conflictMechTasks.slice(0, BEHAVIOR_ABLATION_SIZES.conflictMech)

  return {
    mainTasks,
    conflictProdTasks: prod,
    conflictMechTasks: mech
  }
}

/**
 * 类型级守卫：若有人给 clue 生成塞行为字段，编译期应失败。
 * 运行时再断言 clue fixture 不含行为键。
 */
export function assertClueViewsHaveNoBehaviorFields(views: readonly ClueGenItemView[]): void {
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
