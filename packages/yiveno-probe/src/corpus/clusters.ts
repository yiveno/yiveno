/**
 * 同主题混淆组：同 subject、3–5 成员、消歧线索 + 组级 ambiguous。
 * 成员 seed 与 listProbeClusters 元信息同 seed/计数严格对齐。
 * 组内 host / titlePrefix / noteTemplate 不放回抽样，保证消歧文本可区分。
 */

import { generateDiversityClues } from './clue-gen'
import { sampleSkewedDaysAgo } from './distribution'
import { DIVERSITY_PACKS } from './diversity'
import { DEFAULT_PROBE_FILLER_SEED, rngForFillerItem, type SeededRng } from './prng'
import type {
  ProbeTypedClue,
  RecallProbeBookmarkSeed,
  RecallProbeExcerptSeed,
  RecallProbePersonaId
} from './types'

export type ProbeClusterBuildOptions = {
  seed?: number
}

export type ProbeClusterMeta = {
  clusterId: string
  persona: RecallProbePersonaId
  kind: 'bookmark' | 'excerpt'
  memberKeys: string[]
  preferredKey: string
  ambiguousClue: ProbeTypedClue
}

function resolveSeed(options?: ProbeClusterBuildOptions): number {
  return options?.seed ?? DEFAULT_PROBE_FILLER_SEED
}

function memberCount(rng: SeededRng): number {
  return 3 + rng.nextInt(3) // 3–5
}

/** 组内不放回：洗牌池副本后按序分配。 */
function shuffleCopy<T>(rng: SeededRng, list: readonly T[]): T[] {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = rng.nextInt(i + 1)
    const tmp = copy[i]!
    copy[i] = copy[j]!
    copy[j] = tmp
  }
  return copy
}

/** 偏斜抽样去重；组内天数两两不同（组本身即簇，不做爆发）。 */
function uniqueDaysAgo(rng: SeededRng, count: number): number[] {
  const days: number[] = []
  let guard = 0
  while (days.length < count && guard < 80) {
    guard += 1
    const d = sampleSkewedDaysAgo(rng)
    if (!days.includes(d)) {
      days.push(d)
    }
  }
  while (days.length < count) {
    days.push(days.length + 1)
  }
  return days
}

type ClusterMemberDraft = {
  key: string
  title: string
  host: string
  subject: string
  daysAgo: number
  note: string
  prefix: string
}

function draftClusterMembers(
  persona: RecallProbePersonaId,
  kind: 'bookmark' | 'excerpt',
  clusterIndex: number,
  seed: number
): { clusterId: string; subject: string; members: ClusterMemberDraft[] } {
  const pack = DIVERSITY_PACKS[persona]
  const rng = rngForFillerItem(seed, `clu-${kind}`, clusterIndex, persona)
  const subject = rng.pick(pack.subjects)
  const n = memberCount(rng)
  const days = uniqueDaysAgo(rng, n)
  // 组级不放回：hosts≥10 / prefixes≥10 / noteTemplates=6 ≥ 成员上限 5
  const hosts = shuffleCopy(rng, pack.hosts)
  const prefixes = shuffleCopy(rng, pack.titlePrefixes)
  const notes = shuffleCopy(rng, pack.noteTemplates)
  const clusterId = `clu-${kind === 'bookmark' ? 'bm' : 'ex'}-${persona}-${clusterIndex}`
  const members: ClusterMemberDraft[] = []
  for (let m = 0; m < n; m += 1) {
    const host = hosts[m]!
    const prefix = prefixes[m]!
    const note = notes[m]!
    const title = `${prefix} ${subject}`
    members.push({
      key: `${clusterId}-${m}`,
      title,
      host,
      subject,
      daysAgo: days[m]!,
      note,
      prefix
    })
  }
  return { clusterId, subject, members }
}

/** 完整 hostname（仅去 www.），避免 developer.mozilla / developer.chrome 撞标签。 */
function hostLabelFull(host: string): string {
  try {
    return new URL(host).hostname.replace(/^www\./, '') || 'that site'
  } catch {
    return 'that site'
  }
}

function disambiguationClue(
  member: ClusterMemberDraft,
  persona: RecallProbePersonaId,
  seed: number,
  index: number
): ProbeTypedClue {
  const rng = rngForFillerItem(seed, 'clu-disambig', index, persona)
  const mode = rng.nextInt(3)
  if (mode === 0) {
    return {
      text: `item where I noted ${member.note}`,
      type: 'note'
    }
  }
  if (mode === 1) {
    const when =
      member.daysAgo <= 14
        ? 'from last week'
        : member.daysAgo <= 45
          ? 'from last month'
          : 'from a while back'
    return {
      text: `the ${member.prefix.replace(/:$/, '')} copy ${when}`,
      type: 'temporal'
    }
  }
  return {
    text: `write-up I kept on ${hostLabelFull(member.host)}`,
    type: 'paraphrase'
  }
}

function ambiguousForSubject(subject: string): ProbeTypedClue {
  return {
    text: `something I saved about ${subject}`,
    type: 'ambiguous'
  }
}

/**
 * 成员消歧线索 = clues 最后一条。
 * 契约：buildCluster* 必须把 disambiguationClue append 在 clues 末尾。
 */
export function getClusterMemberDisambiguationClue(member: {
  clues: readonly ProbeTypedClue[]
}): ProbeTypedClue | undefined {
  if (member.clues.length === 0) {
    return undefined
  }
  return member.clues[member.clues.length - 1]
}

/** 混淆组书签成员（每组 3–5；clusterCount = 组数）。 */
export function buildClusterBookmarkSeeds(
  persona: RecallProbePersonaId,
  clusterCount: number,
  options?: ProbeClusterBuildOptions
): RecallProbeBookmarkSeed[] {
  const seed = resolveSeed(options)
  const pack = DIVERSITY_PACKS[persona]
  const out: RecallProbeBookmarkSeed[] = []
  for (let c = 0; c < clusterCount; c += 1) {
    const draft = draftClusterMembers(persona, 'bookmark', c, seed)
    draft.members.forEach((member, m) => {
      const baseClues = generateDiversityClues({
        persona,
        kind: 'bookmark',
        index: c * 20 + m,
        seed,
        title: member.title,
        subject: member.subject,
        note: member.note,
        daysAgo: member.daysAgo,
        host: member.host,
        sceneFragments: pack.sceneFragments
      })
      const disambig = disambiguationClue(member, persona, seed, c * 20 + m)
      out.push({
        key: member.key,
        title: member.title,
        url: `${member.host}/cluster/${member.key}`,
        daysAgo: member.daysAgo,
        note: member.note,
        clues: [...baseClues, disambig]
      })
    })
  }
  return out
}

/** 混淆组摘录成员。 */
export function buildClusterExcerptSeeds(
  persona: RecallProbePersonaId,
  clusterCount: number,
  options?: ProbeClusterBuildOptions
): RecallProbeExcerptSeed[] {
  const seed = resolveSeed(options)
  const pack = DIVERSITY_PACKS[persona]
  const out: RecallProbeExcerptSeed[] = []
  for (let c = 0; c < clusterCount; c += 1) {
    const draft = draftClusterMembers(persona, 'excerpt', c, seed)
    draft.members.forEach((member, m) => {
      const snippet = rngForFillerItem(seed, 'clu-ex-snip', c * 20 + m, persona).pick(
        pack.excerptSnippets
      )
      const baseClues = generateDiversityClues({
        persona,
        kind: 'excerpt',
        index: c * 20 + m + 500,
        seed,
        title: member.title,
        subject: member.subject,
        note: member.note,
        daysAgo: member.daysAgo,
        host: member.host,
        sceneFragments: pack.sceneFragments
      })
      const disambig = disambiguationClue(member, persona, seed, c * 20 + m + 500)
      out.push({
        key: member.key,
        pageTitle: member.title,
        sourceUrl: `${member.host}/cluster-excerpt/${member.key}`,
        selectedText: snippet,
        daysAgo: member.daysAgo,
        note: member.note,
        clues: [...baseClues, disambig]
      })
    })
  }
  return out
}

/** case-plan 用：组元信息（与成员 builder 同 seed/计数 → 同 keys）。 */
export function listProbeClusters(
  personas: readonly RecallProbePersonaId[],
  options: {
    seed?: number
    bookmarkClusterCount: number
    excerptClusterCount: number
  }
): ProbeClusterMeta[] {
  const seed = options.seed ?? DEFAULT_PROBE_FILLER_SEED
  const out: ProbeClusterMeta[] = []
  for (const persona of personas) {
    for (let c = 0; c < options.bookmarkClusterCount; c += 1) {
      const draft = draftClusterMembers(persona, 'bookmark', c, seed)
      const keys = draft.members.map(m => m.key)
      out.push({
        clusterId: draft.clusterId,
        persona,
        kind: 'bookmark',
        memberKeys: keys,
        preferredKey: keys[0]!,
        ambiguousClue: ambiguousForSubject(draft.subject)
      })
    }
    for (let c = 0; c < options.excerptClusterCount; c += 1) {
      const draft = draftClusterMembers(persona, 'excerpt', c, seed)
      const keys = draft.members.map(m => m.key)
      out.push({
        clusterId: draft.clusterId,
        persona,
        kind: 'excerpt',
        memberKeys: keys,
        preferredKey: keys[0]!,
        ambiguousClue: ambiguousForSubject(draft.subject)
      })
    }
  }
  return out
}
