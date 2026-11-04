/**
 * 同主题混淆组：同 subject、3–5 成员、消歧线索 + 组级 ambiguous。
 * 成员 seed 与 listProbeClusters 元信息同 seed/计数严格对齐。
 */

import { generateDiversityClues } from './clue-gen'
import { DIVERSITY_PACKS } from './diversity'
import { DEFAULT_PROBE_FILLER_SEED, rngForFillerItem } from './prng'
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

function memberCount(rng: ReturnType<typeof rngForFillerItem>): number {
  return 3 + rng.nextInt(3) // 3–5
}

function uniqueDaysAgo(rng: ReturnType<typeof rngForFillerItem>, count: number): number[] {
  const days: number[] = []
  let guard = 0
  while (days.length < count && guard < 80) {
    guard += 1
    const d = 1 + rng.nextInt(400)
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
  const clusterId = `clu-${kind === 'bookmark' ? 'bm' : 'ex'}-${persona}-${clusterIndex}`
  const members: ClusterMemberDraft[] = []
  for (let m = 0; m < n; m += 1) {
    const memberRng = rngForFillerItem(seed, `clu-${kind}-m`, clusterIndex * 10 + m, persona)
    const host = memberRng.pick(pack.hosts)
    const prefix = memberRng.pick(pack.titlePrefixes)
    const noteBase = memberRng.pick(pack.noteTemplates)
    const note = `${noteBase} · cluster ${clusterIndex} member ${m}`
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
      text: `item where I noted ${member.note.split(' · ')[0]}`,
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
  let hostShort = 'that site'
  try {
    hostShort = new URL(member.host).hostname.replace(/^www\./, '').split('.')[0] || hostShort
  } catch {
    // ignore
  }
  return {
    text: `write-up I kept on ${hostShort}`,
    type: 'paraphrase'
  }
}

function ambiguousForSubject(subject: string): ProbeTypedClue {
  return {
    text: `something I saved about ${subject}`,
    type: 'ambiguous'
  }
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
        selectedText: `${snippet} (cluster ${c} m${m})`,
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
