/**
 * user-sim 数据集生成：persona 潜在状态 → 90 天事件流 → 可见层 + 隐藏 Ground truth。
 * 纯函数、确定性 seed；同 seed 逐字一致。可见层不含任何 GT 信息（validate.ts 校验）。
 * 模拟数据只作机制验证，不作真实用户证据。
 */

import type { MemoryItem } from '@/core/memory/memory-item'
import type { BehaviorStatsRecord } from '@/infrastructure/indexeddb/behavior-stats-types'
import { stringHashU32 } from '../string-hash-u32'
import { HYBRID_FAKE_EMBEDDING_DIM, makeFakeEmbedding } from '../hybrid-fake-embedding'
import {
  USER_SIM_NEGATIVE_TOPICS,
  USER_SIM_PERSONAS,
  USER_SIM_TOPICS,
  type SimProject,
  type SimTopic
} from './personas'

export type UserSimClueType =
  'concrete' | 'paraphrase' | 'associative' | 'temporal' | 'vague' | 'negative'

export type UserSimEvent = {
  seq: number
  type: string
  day: number
  at: string
  itemId?: string
  url?: string
  dwellMs?: number
  queryId?: string
  outcome?: string
}

export type UserSimQuery = {
  id: string
  type: UserSimClueType
  clue: string
  targetId: string | null
  note: string
  distractors: string[]
}

export type UserSimGroundTruth = {
  schemaVersion: 1
  runId: string
  persona: string
  queries: UserSimQuery[]
  portrait: {
    weeklyLatentTopTopics: { week: number; topTopics: string[] }[]
    stableTopTopics: string[]
  }
  behavior: { latentTopDomains: string[] }
  dreaming: { anchors: { itemId: string; anchor: string }[] }
  itemTopics: Record<string, string>
  itemAspects: Record<string, string>
}

export type UserSimDataset = {
  meta: {
    schemaVersion: 1
    runId: string
    seed: number
    days: number
    endIso: string
    persona: string
    counts: { saves: number; visits: number; queries: number; events: number }
  }
  events: UserSimEvent[]
  memoryItems: MemoryItem[]
  behaviorStats: BehaviorStatsRecord[]
  groundTruth: UserSimGroundTruth
  cleanupManifest: {
    schemaVersion: 1
    namespace: string
    ownerId: string
    sourceLocalProfileId: string
    memoryItemIds: string[]
    behaviorKeys: { ownerId: string; url: string }[]
    instructions: string
  }
}

const TITLE_TEMPLATES: ((t: SimTopic, a: string) => string)[] = [
  (_t, a) => `${cap(a)}: a practical guide`,
  (_t, a) => `What actually works for ${a}`,
  (_t, a) => `${cap(a)} explained with examples`,
  (t, a) => `Notes on ${a} (${t.label})`,
  (_t, a) => `${cap(a)} — pitfalls and fixes`,
  (_t, a) => `Rethinking ${a}`
]
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)
const STOP = new Set(
  'the a an and or of to in on for with when i was that it my me about from during back while what actually works'.split(
    ' '
  )
)
export const userSimTokens = (s: string): Set<string> =>
  new Set((s.toLowerCase().match(/[a-z][a-z-]{2,}/g) || []).filter(w => !STOP.has(w)))

function fnv1a(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(a: number): () => number {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function uuidFrom(seedStr: string): string {
  const h = [0, 1, 2, 3]
    .map(i => stringHashU32(`${seedStr}::${i}`).toString(16).padStart(8, '0'))
    .join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`
}

export const userSimAspectSlug = (aspect: string): string =>
  aspect
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

function fakeEmbeddingFor(topicId: string, aspect: string): number[] {
  const own = makeFakeEmbedding(
    `${topicId}::${userSimAspectSlug(aspect)}`,
    HYBRID_FAKE_EMBEDDING_DIM
  )
  const shared = makeFakeEmbedding(`${topicId}::shared`, HYBRID_FAKE_EMBEDDING_DIM)
  const mixed = own.map((v, i) => v * 0.75 + (shared[i] ?? 0) * 0.25)
  const norm = Math.sqrt(mixed.reduce((s, v) => s + v * v, 0)) || 1
  return mixed.map(v => v / norm)
}

type HiddenItem = {
  id: string
  kind: 'bookmark' | 'text_excerpt'
  topicId: string
  aspect: string
  title: string
  url: string
  domain: string
  selectedText: string | null
  claim: string
  savedDay: number
  projectId: string
  encoding: number
  revisits: number
  lastVisitDay: number
  deleted: boolean
  dismissed: number
  note: string | null
  clusterWith?: string
}

export function generateUserSimDataset(input: {
  seed?: number
  days?: number
  endIso?: string
  personaId?: string
}): UserSimDataset {
  const seed = input.seed ?? 42
  const days = input.days ?? 90
  const endIso = input.endIso ?? '2026-11-28'
  const personaId = input.personaId ?? 'indie-dev-researcher'
  const persona = USER_SIM_PERSONAS.find(p => p.id === personaId)
  if (!persona) {
    throw new Error(`unknown persona: ${personaId}`)
  }
  const topics = USER_SIM_TOPICS.filter(t => persona.topicIds.includes(t.id))
  const projects = persona.projects
  const act = persona.activity
  const ns = personaId === 'indie-dev-researcher' ? '' : `:${personaId}`
  const rng = mulberry32(fnv1a(`yiveno-sim:${seed}${ns}`))
  const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)]!
  const weighted = <T>(pairs: [T, number][]): T => {
    let total = 0
    for (const [, w] of pairs) total += w
    let r = rng() * total
    for (const [v, w] of pairs) {
      r -= w
      if (r <= 0) return v
    }
    return pairs[pairs.length - 1]![0]
  }
  const end = new Date(`${endIso}T12:00:00Z`)
  const dayIso = (d: number): string =>
    new Date(end.getTime() - (days - 1 - d) * 86400000).toISOString()
  const ownerId = uuidFrom(`owner:${seed}${ns}`)
  const profileId = uuidFrom(`profile:${seed}${ns}`)
  const runId = `sim-${seed}${ns.replace(':', '-')}`

  const interest: Record<string, number> = Object.fromEntries(topics.map(t => [t.id, 0.4 + rng()]))
  const weeklyLatent: { week: number; topTopics: string[] }[] = []
  const items: HiddenItem[] = []
  const events: UserSimEvent[] = []
  let itemCounter = 0
  let eventCounter = 0
  const ev = (type: string, day: number, extra: Partial<UserSimEvent>): void => {
    events.push({ seq: eventCounter++, type, day, at: dayIso(day), ...extra })
  }
  const activeProjects = (day: number): SimProject[] =>
    projects.filter(p => p.windows.some(([a, b]) => day >= a && day <= b))
  const topicWeightsFor = (day: number): [SimTopic, number][] =>
    topics.map(t => {
      let w = interest[t.id]!
      for (const p of activeProjects(day)) if (p.topics.includes(t.id)) w += 1.6
      return [t, w]
    })

  function makeItem(day: number): HiddenItem {
    const topic = weighted(topicWeightsFor(day))
    const aspect = pick(topic.aspects)
    const domain = pick(topic.domains)
    const kind: HiddenItem['kind'] = rng() < act.bookmarkRatio ? 'bookmark' : 'text_excerpt'
    const title = pick(TITLE_TEMPLATES)(topic, aspect)
    const slug = `${topic.id}-${aspect.replace(/[^a-z]+/g, '-')}-${itemCounter}`
    const url = `https://${domain}/${slug}`
    const claim = pick(topic.claims)
    const selectedText =
      kind === 'text_excerpt'
        ? `Background on ${aspect} has shifted quickly this year. ${claim}. Practitioners report the effect holds across team sizes, though setup cost varies.`
        : null
    const id = uuidFrom(`item:${seed}${ns}:${itemCounter}`)
    itemCounter++
    const project =
      activeProjects(day).find(p => p.topics.includes(topic.id)) ?? projects[projects.length - 1]!
    const dwellMs = Math.round(20000 + rng() * 240000)
    const item: HiddenItem = {
      id,
      kind,
      topicId: topic.id,
      aspect,
      title,
      url,
      domain,
      selectedText,
      claim,
      savedDay: day,
      projectId: project.id,
      encoding: Math.min(1, dwellMs / 240000 + rng() * 0.3),
      revisits: 0,
      lastVisitDay: day,
      deleted: false,
      dismissed: 0,
      note: rng() < 0.18 ? 'worth revisiting later' : null
    }
    items.push(item)
    ev(kind === 'bookmark' ? 'save_bookmark' : 'save_excerpt', day, { itemId: id, dwellMs })
    ev('visit', day, { itemId: id, url, dwellMs })
    if (rng() < 0.16) {
      const sibTitle = pick(TITLE_TEMPLATES)(topic, aspect)
      if (sibTitle !== title) {
        const sibId = uuidFrom(`item:${seed}${ns}:${itemCounter}`)
        const sibSlug = `${topic.id}-${aspect.replace(/[^a-z]+/g, '-')}-${itemCounter}`
        itemCounter++
        const sib: HiddenItem = {
          ...item,
          id: sibId,
          title: sibTitle,
          url: `https://${pick(topic.domains)}/${sibSlug}`,
          encoding: item.encoding * 0.7,
          revisits: 0,
          clusterWith: id
        }
        item.clusterWith = sibId
        items.push(sib)
        ev(sib.kind === 'bookmark' ? 'save_bookmark' : 'save_excerpt', day, {
          itemId: sibId,
          dwellMs: Math.round(dwellMs * 0.6)
        })
        ev('visit', day, { itemId: sibId, url: sib.url, dwellMs: Math.round(dwellMs * 0.6) })
      }
    }
    return item
  }

  for (let day = 0; day < days; day++) {
    if (day % 7 === 0) {
      weeklyLatent.push({
        week: day / 7,
        topTopics: topicWeightsFor(day)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([t]) => t.id)
      })
      for (const t of topics)
        interest[t.id] = Math.max(0.08, interest[t.id]! * (0.9 + rng() * 0.25))
    }
    const dow = new Date(dayIso(day)).getUTCDay()
    const weekend = dow === 0 || dow === 6
    const sessions = Math.max(
      1,
      Math.round(
        (weekend ? (rng() < 0.6 ? 1 : 2) + act.weekendBoost : 2 + (rng() < 0.5 ? 1 : 0)) *
          act.sessionsMul
      )
    )
    for (let s = 0; s < sessions; s++) {
      const saves = rng() < act.saveP ? 1 + (rng() < 0.4 ? 1 : 0) : 0
      for (let i = 0; i < saves; i++) makeItem(day)
      const browses = 2 + Math.floor(rng() * 4)
      for (let i = 0; i < browses; i++) {
        const topic = weighted(topicWeightsFor(day))
        const domain = pick(topic.domains)
        ev('visit', day, {
          url: `https://${domain}/browse-${topic.id}-${Math.floor(rng() * 40)}`,
          dwellMs: Math.round(5000 + rng() * 90000)
        })
      }
      const aliveNow = items.filter(it => !it.deleted)
      if (aliveNow.length && rng() < act.revisitP) {
        const n = 1 + Math.floor(rng() * 3)
        for (let i = 0; i < n; i++) {
          const it = weighted(
            aliveNow.map(
              x =>
                [
                  x,
                  0.2 + x.encoding * (activeProjects(day).some(p => p.id === x.projectId) ? 2 : 0.6)
                ] as [HiddenItem, number]
            )
          )
          it.revisits++
          it.lastVisitDay = day
          it.encoding = Math.min(1, it.encoding + 0.08)
          ev('revisit', day, {
            itemId: it.id,
            url: it.url,
            dwellMs: Math.round(15000 + rng() * 120000)
          })
        }
      }
    }
    if (items.length > 20 && rng() < 0.05) {
      const candidates = items.filter(it => !it.deleted && it.encoding < 0.4)
      if (candidates.length) {
        const victim = pick(candidates)
        victim.deleted = true
        ev('delete', day, { itemId: victim.id })
      }
    }
    if (rng() < 0.04 && items.length) {
      const it = pick(items)
      it.dismissed++
      ev('dismiss', day, { itemId: it.id })
    }
  }

  const alive = items.filter(it => !it.deleted)
  const need = (it: HiddenItem): number => {
    const proj = projects.find(p => p.id === it.projectId)!
    const revived = proj.revivalDay != null && it.savedDay < proj.revivalDay
    const age = days - it.lastVisitDay
    const forgetting = 1 - Math.exp(-age / act.forgetDays)
    return (revived ? 2.2 : 1) * (0.3 + forgetting) * (0.4 + it.encoding)
  }
  const queries: UserSimQuery[] = []
  const usedTargets = new Set<string>()
  const pickTarget = (): HiddenItem => {
    const pool = alive.filter(it => !usedTargets.has(it.id))
    const it = weighted(pool.map(x => [x, need(x)] as [HiddenItem, number]))
    usedTargets.add(it.id)
    return it
  }
  const topicOf = (it: HiddenItem): SimTopic => topics.find(t => t.id === it.topicId)!
  const projectOf = (it: HiddenItem): SimProject => projects.find(p => p.id === it.projectId)!
  function associativeClue(it: HiddenItem): string {
    const itemTokens = userSimTokens(`${it.title} ${it.selectedText ?? ''} worth revisiting later`)
    const firstScene = pick(projectOf(it).scenes)
    const scenes = [
      firstScene,
      ...projectOf(it).scenes.filter(s => s !== firstScene),
      'a while back',
      'during a busy week',
      'late one evening',
      'on a slow afternoon'
    ]
    for (const scene of scenes) {
      const candidates = [
        `the page I saved ${scene}`,
        `that thing I bookmarked ${scene} — I need it again`,
        `the one I kept coming back to ${scene}`
      ]
      for (const c of candidates) {
        const overlap = [...userSimTokens(c)].filter(w => itemTokens.has(w))
        if (overlap.length === 0) return c
      }
    }
    return 'the page I saved a while back and need again'
  }
  const plan: UserSimClueType[] = [
    ...Array<UserSimClueType>(16).fill('concrete'),
    ...Array<UserSimClueType>(16).fill('paraphrase'),
    ...Array<UserSimClueType>(16).fill('associative'),
    ...Array<UserSimClueType>(10).fill('temporal'),
    ...Array<UserSimClueType>(10).fill('vague'),
    ...Array<UserSimClueType>(12).fill('negative')
  ]
  let negativeQueues: {
    deleted: HiddenItem[]
    topics: (typeof USER_SIM_NEGATIVE_TOPICS)[number][]
  } | null = null
  plan.forEach((type, i) => {
    const qid = `q-${String(i + 1).padStart(3, '0')}`
    if (type === 'negative') {
      if (!negativeQueues) {
        const aliveAspects = new Set(alive.map(it => it.aspect))
        const shuffle = <T>(arr: T[]): T[] => {
          const a = [...arr]
          for (let k = a.length - 1; k > 0; k--) {
            const j = Math.floor(rng() * (k + 1))
            ;[a[k], a[j]] = [a[j]!, a[k]!]
          }
          return a
        }
        negativeQueues = {
          deleted: shuffle(
            items.filter(
              (it, idx, arr) =>
                it.deleted &&
                !aliveAspects.has(it.aspect) &&
                arr.findIndex(x => x.aspect === it.aspect) === idx
            )
          ),
          topics: shuffle([...USER_SIM_NEGATIVE_TOPICS])
        }
      }
      const it = i % 2 === 0 ? negativeQueues.deleted.pop() : undefined
      if (it) {
        queries.push({
          id: qid,
          type,
          clue: `the page about ${it.aspect} I used to have saved`,
          targetId: null,
          note: `deleted-item negative aspect=${it.aspect}`,
          distractors: []
        })
      } else {
        const nt = negativeQueues.topics.pop() ?? pick(USER_SIM_NEGATIVE_TOPICS)
        queries.push({
          id: qid,
          type,
          clue: `the thing about ${nt.label} I saved a while ago`,
          targetId: null,
          note: `never-saved topic negative label=${nt.label}`,
          distractors: []
        })
      }
      return
    }
    const it = pickTarget()
    const t = topicOf(it)
    let clue: string
    if (type === 'concrete')
      clue = `the ${it.kind === 'text_excerpt' ? 'excerpt' : 'page'} about ${it.aspect}`
    else if (type === 'paraphrase')
      clue = `that write-up covering ${it.aspect.replace('recall', 'remembering').replace('ranking', 'ordering')} in ${t.label}`
    else if (type === 'associative') clue = associativeClue(it)
    else if (type === 'temporal') {
      const weeks = Math.max(1, Math.round((days - it.savedDay) / 7))
      const shownWeeks = personaId === 'misremembering-user' ? weeks + 2 : weeks
      clue = `the one on ${t.label} from about ${shownWeeks} weeks ago`
    } else if (type === 'vague' && personaId === 'misremembering-user') {
      const idx = topics.findIndex(x => x.id === t.id)
      const neighbor = topics[(idx + 1) % topics.length]!
      clue = `that thing about ${neighbor.label} I saved`
    } else clue = `that thing about ${t.label} I saved`
    const distractors = alive
      .filter(x => x.id !== it.id && x.topicId === it.topicId && x.aspect === it.aspect)
      .map(x => x.id)
    queries.push({
      id: qid,
      type,
      clue,
      targetId: it.id,
      note: `need=${need(it).toFixed(2)} project=${it.projectId}`,
      distractors
    })
    ev('recall_query', days - 1, { queryId: qid, outcome: 'pending_eval' })
  })

  const memoryItems: MemoryItem[] = alive.map(it => {
    const clues: MemoryItem['clues'] = {
      title: it.title,
      keywords: userSimAspectSlug(it.aspect)
        .split('-')
        .filter(token => token && !USER_SIM_TOPICS.some(t => t.id === token)),
      entities: [],
      tags: [],
      sourceUrl: it.url,
      domain: it.domain,
      embedding: fakeEmbeddingFor(it.topicId, it.aspect),
      embeddingModel: 'user-sim-fake',
      embeddingDim: HYBRID_FAKE_EMBEDDING_DIM,
      openCount: it.revisits,
      lastOpenedAt: it.revisits ? dayIso(it.lastVisitDay) : null,
      settledCount: 0,
      dismissCount: it.dismissed,
      ...(it.note ? { note: it.note } : {}),
      ...(it.selectedText ? { textExcerpt: it.selectedText } : {})
    }
    const base = {
      id: it.id,
      ownerId,
      sourceLocalProfileId: profileId,
      clues,
      createdAt: dayIso(it.savedDay),
      updatedAt: dayIso(it.lastVisitDay),
      deletedAt: null
    }
    return it.kind === 'bookmark'
      ? {
          ...base,
          type: 'bookmark' as const,
          payload: {
            title: it.title,
            url: it.url,
            domain: it.domain,
            chromeCreatedAt: dayIso(it.savedDay)
          }
        }
      : {
          ...base,
          type: 'text_excerpt' as const,
          payload: {
            selectedText: it.selectedText!,
            sourceUrl: it.url,
            pageTitle: it.title,
            domain: it.domain,
            origin: 'user' as const
          }
        }
  })
  const behaviorMap = new Map<string, BehaviorStatsRecord>()
  for (const e of events) {
    if (e.type !== 'visit' && e.type !== 'revisit') continue
    const url = e.url!
    const row =
      behaviorMap.get(url) ??
      ({
        ownerId,
        url,
        domain: new URL(url).hostname,
        visitCount: 0,
        lastVisitTime: 0,
        totalDwellMs: 0,
        updatedAt: dayIso(days - 1)
      } satisfies BehaviorStatsRecord)
    row.visitCount++
    row.totalDwellMs += e.dwellMs ?? 0
    row.lastVisitTime = Math.max(row.lastVisitTime, Date.parse(e.at))
    behaviorMap.set(url, row)
  }
  const behaviorStats = [...behaviorMap.values()].sort((a, b) => a.url.localeCompare(b.url))

  const latentDomains: Record<string, number> = {}
  for (const t of topics)
    for (const d of t.domains) latentDomains[d] = (latentDomains[d] ?? 0) + interest[t.id]!
  const groundTruth: UserSimGroundTruth = {
    schemaVersion: 1,
    runId,
    persona: personaId,
    queries,
    portrait: {
      weeklyLatentTopTopics: weeklyLatent,
      stableTopTopics: weeklyLatent[weeklyLatent.length - 1]!.topTopics
    },
    behavior: {
      latentTopDomains: Object.entries(latentDomains)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([d]) => d)
    },
    dreaming: {
      anchors: alive.filter(it => it.selectedText).map(it => ({ itemId: it.id, anchor: it.claim }))
    },
    itemTopics: Object.fromEntries(alive.map(it => [it.id, it.topicId])),
    itemAspects: Object.fromEntries(alive.map(it => [it.id, it.aspect]))
  }
  return {
    meta: {
      schemaVersion: 1,
      runId,
      seed,
      days,
      endIso,
      persona: personaId,
      counts: {
        saves: memoryItems.length,
        visits: events.filter(e => e.type === 'visit' || e.type === 'revisit').length,
        queries: queries.length,
        events: events.length
      }
    },
    events,
    memoryItems,
    behaviorStats,
    groundTruth,
    cleanupManifest: {
      schemaVersion: 1,
      namespace: `yiveno-sim:${runId}`,
      ownerId,
      sourceLocalProfileId: profileId,
      memoryItemIds: memoryItems.map(m => m.id),
      behaviorKeys: behaviorStats.map(b => ({ ownerId: b.ownerId, url: b.url })),
      instructions:
        'Delete memory items by id, behavior_stats rows by (ownerId,url), then sweep orphan memory_notes for this ownerId. Do not touch other owners.'
    }
  }
}
