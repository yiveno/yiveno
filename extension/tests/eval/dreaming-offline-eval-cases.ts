/**
 * Dreaming Phase 4 Stage 3 · 离线评估用例（合成 fixture；gate=stretch，不进 must）。
 * 4 类 × 5 组 = 20；词面互不重叠。
 */

import type { RecallEvalCase, RecallEvalExpectation } from './recall-eval-cases'
import type { RecallEvalItemId } from './recall-eval-ids'
import {
  DREAMING_OFFLINE_EVAL_IDS,
  OFFLINE_DIRTY_NOTE_AT,
  OFFLINE_UPDATED_AT,
  makeDreamingEvalNote,
  type DreamingOfflineGroupSpec
} from './dreaming-eval-corpus'
import type { MemoryNoteRecord } from '@/infrastructure/indexeddb/memory-notes-types'

function asEvalId(id: string): RecallEvalItemId {
  return id as RecallEvalItemId
}

/** 离线评估类目。 */
export type DreamingOfflineCategory =
  | 'note_only' // 命题独占
  | 'note_and_literal' // 命题+字面并存
  | 'note_exclude' // 命题命中但 exclude 硬切
  | 'dirty_orphan' // 脏 / 孤儿

export interface DreamingOfflineEvalBlueprint {
  id: string
  category: DreamingOfflineCategory
  clue: string
  contentTerms: string[]
  excludeContentTerms?: string[]
  group: DreamingOfflineGroupSpec
  note: MemoryNoteRecord
  /** 脏/孤儿：OFF/ON 均不应靠命题进池 */
  expectationOn: RecallEvalExpectation
  expectationOff: RecallEvalExpectation
  noteText: string
}

function excerptGroup(
  id: string,
  sourceId: string,
  selectedText: string,
  pageTitle: string,
  path: string,
  omitFromCorpus?: boolean
): DreamingOfflineGroupSpec {
  return {
    id,
    sourceId,
    selectedText,
    pageTitle,
    sourceUrl: `https://example.com/${path}`,
    ...(omitFromCorpus ? { omitFromCorpus: true } : {})
  }
}

function noteFor(
  sourceId: string,
  text: string,
  sourceQuote: string,
  sourceUpdatedAt: string = OFFLINE_UPDATED_AT
): MemoryNoteRecord {
  return makeDreamingEvalNote({
    sourceId,
    index: 0,
    text,
    sourceQuote,
    sourceUpdatedAt,
    sourceType: 'text_excerpt'
  })
}

/**
 * 20 组蓝图。
 * (a) 原文零字面 · 命题双 term → ON Top1 / OFF no_match
 * (b) 原文+命题均含词 → ON/OFF 均可 Top1
 * (c) 命题命中但源含 exclude → ON/OFF 均 no_match
 * (d) 脏或孤儿命题 → ON/OFF 均无该源
 */
export const DREAMING_OFFLINE_EVAL_BLUEPRINTS: DreamingOfflineEvalBlueprint[] = [
  // —— (a) 命题独占 ——
  {
    id: 'offline-a01-rottnest',
    category: 'note_only',
    clue: 'rottnest quokka',
    contentTerms: ['rottnest', 'quokka'],
    group: excerptGroup(
      'offline-a01-rottnest',
      DREAMING_OFFLINE_EVAL_IDS.a01,
      'The small marsupial foraged quietly near the dunes at dusk.',
      'Wildlife field notes',
      'a01'
    ),
    note: noteFor(
      DREAMING_OFFLINE_EVAL_IDS.a01,
      'Quokka sightings on Rottnest Island are common at dusk.',
      'The small marsupial foraged quietly near the dunes at dusk.'
    ),
    noteText: 'Quokka sightings on Rottnest Island are common at dusk.',
    expectationOn: { kind: 'top1', expectedId: asEvalId(DREAMING_OFFLINE_EVAL_IDS.a01) },
    expectationOff: { kind: 'no_match' }
  },
  {
    id: 'offline-a02-aurora',
    category: 'note_only',
    clue: 'aurora borealis',
    contentTerms: ['aurora', 'borealis'],
    group: excerptGroup(
      'offline-a02-aurora',
      DREAMING_OFFLINE_EVAL_IDS.a02,
      'Green curtains rippled above the frozen lake after midnight.',
      'Night sky journal',
      'a02'
    ),
    note: noteFor(
      DREAMING_OFFLINE_EVAL_IDS.a02,
      'Aurora borealis may appear after midnight in clear weather.',
      'Green curtains rippled above the frozen lake after midnight.'
    ),
    noteText: 'Aurora borealis may appear after midnight in clear weather.',
    expectationOn: { kind: 'top1', expectedId: asEvalId(DREAMING_OFFLINE_EVAL_IDS.a02) },
    expectationOff: { kind: 'no_match' }
  },
  {
    id: 'offline-a03-mangrove',
    category: 'note_only',
    clue: 'mangrove kayak',
    contentTerms: ['mangrove', 'kayak'],
    group: excerptGroup(
      'offline-a03-mangrove',
      DREAMING_OFFLINE_EVAL_IDS.a03,
      'Roots arched over brackish channels where birds nested quietly.',
      'Coastal paddle notes',
      'a03'
    ),
    note: noteFor(
      DREAMING_OFFLINE_EVAL_IDS.a03,
      'Mangrove kayak routes wind through tidal channels at dawn.',
      'Roots arched over brackish channels where birds nested quietly.'
    ),
    noteText: 'Mangrove kayak routes wind through tidal channels at dawn.',
    expectationOn: { kind: 'top1', expectedId: asEvalId(DREAMING_OFFLINE_EVAL_IDS.a03) },
    expectationOff: { kind: 'no_match' }
  },
  {
    id: 'offline-a04-sourdough',
    category: 'note_only',
    clue: 'sourdough starter',
    contentTerms: ['sourdough', 'starter'],
    group: excerptGroup(
      'offline-a04-sourdough',
      DREAMING_OFFLINE_EVAL_IDS.a04,
      'Bubbles rose slowly in the jar kept beside the warm oven.',
      'Kitchen ferment log',
      'a04'
    ),
    note: noteFor(
      DREAMING_OFFLINE_EVAL_IDS.a04,
      'Sourdough starter needs daily feeding when kept at room temperature.',
      'Bubbles rose slowly in the jar kept beside the warm oven.'
    ),
    noteText: 'Sourdough starter needs daily feeding when kept at room temperature.',
    expectationOn: { kind: 'top1', expectedId: asEvalId(DREAMING_OFFLINE_EVAL_IDS.a04) },
    expectationOff: { kind: 'no_match' }
  },
  {
    id: 'offline-a05-kiln',
    category: 'note_only',
    clue: 'kiln glaze',
    contentTerms: ['kiln', 'glaze'],
    group: excerptGroup(
      'offline-a05-kiln',
      DREAMING_OFFLINE_EVAL_IDS.a05,
      'Clay cups waited on the shelf after the long firing cycle.',
      'Studio ceramic notes',
      'a05'
    ),
    note: noteFor(
      DREAMING_OFFLINE_EVAL_IDS.a05,
      'Kiln glaze recipes vary with peak temperature and hold time.',
      'Clay cups waited on the shelf after the long firing cycle.'
    ),
    noteText: 'Kiln glaze recipes vary with peak temperature and hold time.',
    expectationOn: { kind: 'top1', expectedId: asEvalId(DREAMING_OFFLINE_EVAL_IDS.a05) },
    expectationOff: { kind: 'no_match' }
  },

  // —— (b) 命题 + 字面并存 ——
  {
    id: 'offline-b01-ferry',
    category: 'note_and_literal',
    clue: 'ferry timetable',
    contentTerms: ['ferry', 'timetable'],
    group: excerptGroup(
      'offline-b01-ferry',
      DREAMING_OFFLINE_EVAL_IDS.b01,
      'Ferry timetable posts list hourly departures from the harbor.',
      'Harbor board',
      'b01'
    ),
    note: noteFor(
      DREAMING_OFFLINE_EVAL_IDS.b01,
      'Ferry timetable updates every season for holiday crowds.',
      'Ferry timetable posts list hourly departures from the harbor.'
    ),
    noteText: 'Ferry timetable updates every season for holiday crowds.',
    expectationOn: { kind: 'top1', expectedId: asEvalId(DREAMING_OFFLINE_EVAL_IDS.b01) },
    expectationOff: { kind: 'top1', expectedId: asEvalId(DREAMING_OFFLINE_EVAL_IDS.b01) }
  },
  {
    id: 'offline-b02-volcano',
    category: 'note_and_literal',
    clue: 'volcano basalt',
    contentTerms: ['volcano', 'basalt'],
    group: excerptGroup(
      'offline-b02-volcano',
      DREAMING_OFFLINE_EVAL_IDS.b02,
      'Volcano basalt columns lined the trail after the last eruption.',
      'Geology hike',
      'b02'
    ),
    note: noteFor(
      DREAMING_OFFLINE_EVAL_IDS.b02,
      'Volcano basalt cools into hexagonal columns along the ridge.',
      'Volcano basalt columns lined the trail after the last eruption.'
    ),
    noteText: 'Volcano basalt cools into hexagonal columns along the ridge.',
    expectationOn: { kind: 'top1', expectedId: asEvalId(DREAMING_OFFLINE_EVAL_IDS.b02) },
    expectationOff: { kind: 'top1', expectedId: asEvalId(DREAMING_OFFLINE_EVAL_IDS.b02) }
  },
  {
    id: 'offline-b03-cedar',
    category: 'note_and_literal',
    clue: 'cedar shingles',
    contentTerms: ['cedar', 'shingles'],
    group: excerptGroup(
      'offline-b03-cedar',
      DREAMING_OFFLINE_EVAL_IDS.b03,
      'Cedar shingles weathered silver after ten winters on the roof.',
      'Cabin repair log',
      'b03'
    ),
    note: noteFor(
      DREAMING_OFFLINE_EVAL_IDS.b03,
      'Cedar shingles last longer when installed with a ventilated gap.',
      'Cedar shingles weathered silver after ten winters on the roof.'
    ),
    noteText: 'Cedar shingles last longer when installed with a ventilated gap.',
    expectationOn: { kind: 'top1', expectedId: asEvalId(DREAMING_OFFLINE_EVAL_IDS.b03) },
    expectationOff: { kind: 'top1', expectedId: asEvalId(DREAMING_OFFLINE_EVAL_IDS.b03) }
  },
  {
    id: 'offline-b04-trilobite',
    category: 'note_and_literal',
    clue: 'trilobite fossil',
    contentTerms: ['trilobite', 'fossil'],
    group: excerptGroup(
      'offline-b04-trilobite',
      DREAMING_OFFLINE_EVAL_IDS.b04,
      'Trilobite fossil beds appeared in the shale after the storm.',
      'Field paleontology',
      'b04'
    ),
    note: noteFor(
      DREAMING_OFFLINE_EVAL_IDS.b04,
      'Trilobite fossil collecting is restricted in this park.',
      'Trilobite fossil beds appeared in the shale after the storm.'
    ),
    noteText: 'Trilobite fossil collecting is restricted in this park.',
    expectationOn: { kind: 'top1', expectedId: asEvalId(DREAMING_OFFLINE_EVAL_IDS.b04) },
    expectationOff: { kind: 'top1', expectedId: asEvalId(DREAMING_OFFLINE_EVAL_IDS.b04) }
  },
  {
    id: 'offline-b05-espresso',
    category: 'note_and_literal',
    clue: 'espresso crema',
    contentTerms: ['espresso', 'crema'],
    group: excerptGroup(
      'offline-b05-espresso',
      DREAMING_OFFLINE_EVAL_IDS.b05,
      'Espresso crema stayed thick when the grind was dialed finer.',
      'Cafe dial-in notes',
      'b05'
    ),
    note: noteFor(
      DREAMING_OFFLINE_EVAL_IDS.b05,
      'Espresso crema thins when the roast is too dark for the machine.',
      'Espresso crema stayed thick when the grind was dialed finer.'
    ),
    noteText: 'Espresso crema thins when the roast is too dark for the machine.',
    expectationOn: { kind: 'top1', expectedId: asEvalId(DREAMING_OFFLINE_EVAL_IDS.b05) },
    expectationOff: { kind: 'top1', expectedId: asEvalId(DREAMING_OFFLINE_EVAL_IDS.b05) }
  },

  // —— (c) 命题命中但 exclude ——
  {
    id: 'offline-c01-wombat',
    category: 'note_exclude',
    clue: 'wombat burrow',
    contentTerms: ['wombat', 'burrow'],
    excludeContentTerms: ['settlement'],
    group: excerptGroup(
      'offline-c01-wombat',
      DREAMING_OFFLINE_EVAL_IDS.c01,
      'The wombat burrow survey near the settlement recorded twelve entrances.',
      'Burrow survey',
      'c01'
    ),
    note: noteFor(
      DREAMING_OFFLINE_EVAL_IDS.c01,
      'Wombat burrow maps highlight dunes away from the settlement edge.',
      'The wombat burrow survey near the settlement recorded twelve entrances.'
    ),
    noteText: 'Wombat burrow maps highlight dunes away from the settlement edge.',
    expectationOn: { kind: 'no_match' },
    expectationOff: { kind: 'no_match' }
  },
  {
    id: 'offline-c02-orchard',
    category: 'note_exclude',
    clue: 'apple orchard',
    contentTerms: ['apple', 'orchard'],
    excludeContentTerms: ['pesticide'],
    group: excerptGroup(
      'offline-c02-orchard',
      DREAMING_OFFLINE_EVAL_IDS.c02,
      'Apple orchard rows needed pruning after the pesticide spray window.',
      'Farm week log',
      'c02'
    ),
    note: noteFor(
      DREAMING_OFFLINE_EVAL_IDS.c02,
      'Apple orchard yields rose after drip irrigation replaced flood rows.',
      'Apple orchard rows needed pruning after the pesticide spray window.'
    ),
    noteText: 'Apple orchard yields rose after drip irrigation replaced flood rows.',
    expectationOn: { kind: 'no_match' },
    expectationOff: { kind: 'no_match' }
  },
  {
    id: 'offline-c03-ballet',
    category: 'note_exclude',
    clue: 'ballet recital',
    contentTerms: ['ballet', 'recital'],
    excludeContentTerms: ['cancel'],
    group: excerptGroup(
      'offline-c03-ballet',
      DREAMING_OFFLINE_EVAL_IDS.c03,
      'Ballet recital tickets went on sale before the cancel notice posted.',
      'Arts calendar',
      'c03'
    ),
    note: noteFor(
      DREAMING_OFFLINE_EVAL_IDS.c03,
      'Ballet recital programs list cast changes on the night of the show.',
      'Ballet recital tickets went on sale before the cancel notice posted.'
    ),
    noteText: 'Ballet recital programs list cast changes on the night of the show.',
    expectationOn: { kind: 'no_match' },
    expectationOff: { kind: 'no_match' }
  },
  {
    id: 'offline-c04-scuba',
    category: 'note_exclude',
    clue: 'scuba reef',
    contentTerms: ['scuba', 'reef'],
    excludeContentTerms: ['storm'],
    group: excerptGroup(
      'offline-c04-scuba',
      DREAMING_OFFLINE_EVAL_IDS.c04,
      'Scuba reef dive was postponed after the storm front moved in.',
      'Dive shop board',
      'c04'
    ),
    note: noteFor(
      DREAMING_OFFLINE_EVAL_IDS.c04,
      'Scuba reef checklists include buoyancy drills before open water.',
      'Scuba reef dive was postponed after the storm front moved in.'
    ),
    noteText: 'Scuba reef checklists include buoyancy drills before open water.',
    expectationOn: { kind: 'no_match' },
    expectationOff: { kind: 'no_match' }
  },
  {
    id: 'offline-c05-vintage',
    category: 'note_exclude',
    clue: 'vintage camera',
    contentTerms: ['vintage', 'camera'],
    excludeContentTerms: ['broken'],
    group: excerptGroup(
      'offline-c05-vintage',
      DREAMING_OFFLINE_EVAL_IDS.c05,
      'Vintage camera shutter stuck broken after the damp storage month.',
      'Gear repair ticket',
      'c05'
    ),
    note: noteFor(
      DREAMING_OFFLINE_EVAL_IDS.c05,
      'Vintage camera light seals should be replaced every few decades.',
      'Vintage camera shutter stuck broken after the damp storage month.'
    ),
    noteText: 'Vintage camera light seals should be replaced every few decades.',
    expectationOn: { kind: 'no_match' },
    expectationOff: { kind: 'no_match' }
  },

  // —— (d) 脏 / 孤儿 ——
  {
    id: 'offline-d01-dirty-nebula',
    category: 'dirty_orphan',
    clue: 'nebula cluster',
    contentTerms: ['nebula', 'cluster'],
    group: excerptGroup(
      'offline-d01-dirty-nebula',
      DREAMING_OFFLINE_EVAL_IDS.d01,
      'Telescope logs mention faint glow beyond the ridge after dusk.',
      'Observatory scrap',
      'd01'
    ),
    note: noteFor(
      DREAMING_OFFLINE_EVAL_IDS.d01,
      'Nebula cluster charts help plan deep-sky imaging sessions.',
      'Telescope logs mention faint glow beyond the ridge after dusk.',
      OFFLINE_DIRTY_NOTE_AT
    ),
    noteText: 'Nebula cluster charts help plan deep-sky imaging sessions.',
    expectationOn: { kind: 'no_match' },
    expectationOff: { kind: 'no_match' }
  },
  {
    // 原 clue「lichen survey」与 c01 摘录「burrow survey」交叉 → 误 top1；改 census。
    id: 'offline-d02-dirty-lichen',
    category: 'dirty_orphan',
    clue: 'lichen census',
    contentTerms: ['lichen', 'census'],
    group: excerptGroup(
      'offline-d02-dirty-lichen',
      DREAMING_OFFLINE_EVAL_IDS.d02,
      'Rock faces held pale crusts after the spring melt.',
      'Botany notebook',
      'd02'
    ),
    note: noteFor(
      DREAMING_OFFLINE_EVAL_IDS.d02,
      'Lichen census plots mark diversity along the alpine ridge.',
      'Rock faces held pale crusts after the spring melt.',
      OFFLINE_DIRTY_NOTE_AT
    ),
    noteText: 'Lichen census plots mark diversity along the alpine ridge.',
    expectationOn: { kind: 'no_match' },
    expectationOff: { kind: 'no_match' }
  },
  {
    // 原 clue「comet trail」与 b02 摘录「lined the trail」交叉 → 误 top1；改 coma。
    id: 'offline-d03-orphan-ghost',
    category: 'dirty_orphan',
    clue: 'comet coma',
    contentTerms: ['comet', 'coma'],
    group: excerptGroup(
      'offline-d03-orphan-ghost',
      DREAMING_OFFLINE_EVAL_IDS.orphanGhost,
      'Deleted source body never stored in corpus.',
      'Ghost page',
      'd03',
      true
    ),
    note: noteFor(
      DREAMING_OFFLINE_EVAL_IDS.orphanGhost,
      'Comet coma photos need long exposures under dark skies.',
      'Deleted source body never stored in corpus.'
    ),
    noteText: 'Comet coma photos need long exposures under dark skies.',
    expectationOn: { kind: 'no_match' },
    expectationOff: { kind: 'no_match' }
  },
  {
    id: 'offline-d04-orphan-ghost2',
    category: 'dirty_orphan',
    clue: 'meteor shower',
    contentTerms: ['meteor', 'shower'],
    group: excerptGroup(
      'offline-d04-orphan-ghost2',
      DREAMING_OFFLINE_EVAL_IDS.d05,
      'Second deleted source body never stored in corpus.',
      'Ghost page 2',
      'd04',
      true
    ),
    note: noteFor(
      DREAMING_OFFLINE_EVAL_IDS.d05,
      'Meteor shower peaks favor moonless rural viewing sites.',
      'Second deleted source body never stored in corpus.'
    ),
    noteText: 'Meteor shower peaks favor moonless rural viewing sites.',
    expectationOn: { kind: 'no_match' },
    expectationOff: { kind: 'no_match' }
  },
  {
    id: 'offline-d05-dirty-onyx',
    category: 'dirty_orphan',
    clue: 'onyx carving',
    contentTerms: ['onyx', 'carving'],
    group: excerptGroup(
      'offline-d05-dirty-onyx',
      DREAMING_OFFLINE_EVAL_IDS.d04,
      'Workshop dust settled on unfinished stone blanks overnight.',
      'Studio inventory',
      'd05'
    ),
    note: noteFor(
      DREAMING_OFFLINE_EVAL_IDS.d04,
      'Onyx carving tools dull quickly on dense banded stone.',
      'Workshop dust settled on unfinished stone blanks overnight.',
      OFFLINE_DIRTY_NOTE_AT
    ),
    noteText: 'Onyx carving tools dull quickly on dense banded stone.',
    expectationOn: { kind: 'no_match' },
    expectationOff: { kind: 'no_match' }
  }
]

/** 转成 RecallEvalCase 形状（stretch；ON 期望）。 */
export function dreamingOfflineBlueprintsToCases(mode: 'on' | 'off'): RecallEvalCase[] {
  return DREAMING_OFFLINE_EVAL_BLUEPRINTS.map(bp => ({
    id: bp.id,
    clue: bp.clue,
    clueClass: 'concrete',
    gate: 'stretch',
    expectation: mode === 'on' ? bp.expectationOn : bp.expectationOff,
    note: `offline ${bp.category}`
  }))
}

/** 评估集全部命题行（含脏/孤儿）。 */
export function listDreamingOfflineEvalNotes(): MemoryNoteRecord[] {
  return DREAMING_OFFLINE_EVAL_BLUEPRINTS.map(bp => bp.note)
}

/** 评估集源规格（含 omit）。 */
export function listDreamingOfflineEvalGroups(): DreamingOfflineGroupSpec[] {
  return DREAMING_OFFLINE_EVAL_BLUEPRINTS.map(bp => bp.group)
}
