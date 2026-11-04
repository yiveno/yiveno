/**
 * 负例探针：线索描述的目标不在库中；不种库、无 expected id。
 * 主题须与全部画像 subjects + noise 标题不相交。
 */

import type { RecallProbePersonaId } from './types'

export type ProbeNegativeClue = {
  key: string
  persona: RecallProbePersonaId
  clue: string
}

/**
 * 手写负例（兽医牙科 / 业余无线电 / 蜂箱管理等库外领域）。
 * 每画像 ≥ 4 条；口吻保持真实记忆线索。
 */
export const PROBE_NEGATIVE_CLUES: readonly ProbeNegativeClue[] = [
  // researcher
  {
    key: 'neg-researcher-vet-dental',
    persona: 'researcher',
    clue: 'that paper on feline dental resorption stages I meant to cite'
  },
  {
    key: 'neg-researcher-beekeeping',
    persona: 'researcher',
    clue: 'article about Varroa mite treatment calendars for backyard hives'
  },
  {
    key: 'neg-researcher-ham-radio',
    persona: 'researcher',
    clue: 'bookmark on amateur radio license exam question pools'
  },
  {
    key: 'neg-researcher-mycology',
    persona: 'researcher',
    clue: 'field guide page on distinguishing morels from false morels'
  },
  // creator
  {
    key: 'neg-creator-pottery',
    persona: 'creator',
    clue: 'tutorial on celadon glaze recipes for cone 10 reduction'
  },
  {
    key: 'neg-creator-luthiers',
    persona: 'creator',
    clue: 'video about bracing patterns for small-body acoustic guitars'
  },
  {
    key: 'neg-creator-calligraphy',
    persona: 'creator',
    clue: 'page on pointed-pen flourishing drills I saved for practice'
  },
  {
    key: 'neg-creator-bonsai',
    persona: 'creator',
    clue: 'guide to wiring juniper bonsai without scarring the bark'
  },
  // developer
  {
    key: 'neg-developer-embroidery',
    persona: 'developer',
    clue: 'notes on machine embroidery digitizing stitch density'
  },
  {
    key: 'neg-developer-hydroponics',
    persona: 'developer',
    clue: 'bookmark about NFT hydroponic channel slope calculations'
  },
  {
    key: 'neg-developer-horology',
    persona: 'developer',
    clue: 'article on regulating a mechanical watch with a timegrapher'
  },
  {
    key: 'neg-developer-falconry',
    persona: 'developer',
    clue: 'page about hood training schedules for passage hawks'
  },
  // student
  {
    key: 'neg-student-farrier',
    persona: 'student',
    clue: 'handout on equine hoof balancing angles for farriers'
  },
  {
    key: 'neg-student-locksmith',
    persona: 'student',
    clue: 'notes on pin tumbler lock picking ethics course I skipped'
  },
  {
    key: 'neg-student-taxidermy',
    persona: 'student',
    clue: 'guide to freeze-drying small mammal taxidermy mounts'
  },
  {
    key: 'neg-student-apiary',
    persona: 'student',
    clue: 'worksheet on honey moisture refractometer readings'
  },
  // knowledge_worker
  {
    key: 'neg-kw-pipe-organ',
    persona: 'knowledge_worker',
    clue: 'memo about tuning a pipe organ after humidity swings'
  },
  {
    key: 'neg-kw-cheese',
    persona: 'knowledge_worker',
    clue: 'notes on aging cave humidity for alpine cheese wheels'
  },
  {
    key: 'neg-kw-sailing',
    persona: 'knowledge_worker',
    clue: 'checklist for reefing a mainsail in a sudden squall'
  },
  {
    key: 'neg-kw-glassblowing',
    persona: 'knowledge_worker',
    clue: 'page on annealing schedules for thick glass sculptures'
  }
] as const
