/**
 * 质量轮多样性语料：画像风味、可复现、多数无 suggestedClues；
 * 每隔若干条带备注 + 口语线索，供覆盖面探针（非 runtime 灰名单）。
 */

import type { RecallProbePersonaId } from '@/infrastructure/debug/recall-probe-corpus-types'
import type {
  RecallProbeBookmarkSeed,
  RecallProbeExcerptSeed
} from '@/infrastructure/debug/recall-probe-corpus-types'

type DiversityHostPack = {
  hosts: readonly string[]
  titlePrefixes: readonly string[]
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
      'https://arxiv.org/abs/yiveno-div'
    ],
    titlePrefixes: [
      'Field notes on',
      'Lab memo:',
      'Long read:',
      'Archive scrap:',
      'Survey of',
      'Briefing:',
      'Essay draft:',
      'Literature map:'
    ],
    noteTemplates: [
      'cite in weekly research digest',
      'cross-check methods section later',
      'possible lead for interview guide',
      'park for lit review cluster'
    ],
    excerptSnippets: [
      'The sample frame still undercounts informal archives that never enter the catalog.',
      'Causal claims collapse when the diary window is shorter than the policy cycle.',
      'Secondary sources rarely preserve the annotation layer readers actually used.',
      'Verification rituals matter more than another dashboard of unverified quotes.'
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
      'https://www.youtube.com/watch?v=yivenoDiv'
    ],
    titlePrefixes: [
      'Critique notes:',
      'Reference board:',
      'Pattern study:',
      'Motion pass:',
      'Type pairing:',
      'Case study:',
      'Workshop slide:',
      'IA sketch:'
    ],
    noteTemplates: [
      'reuse spacing rhythm in client deck',
      'steal contrast pair for dark UI',
      'teach this in Friday critique',
      'compare with onboarding flow v3'
    ],
    excerptSnippets: [
      'Hierarchy that whispers beats decoration that shouts for attention.',
      'Empty states fail when they apologize instead of offering the next action.',
      'Motion should explain structure, not perform brand personality alone.',
      'Labels die quietly; users blame themselves before your navigation.'
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
      'https://www.rfc-editor.org/rfc/yiveno-div'
    ],
    titlePrefixes: [
      'Runbook:',
      'Incident note:',
      'API sketch:',
      'Perf checklist:',
      'RFC skim:',
      'CI tip:',
      'Schema change:',
      'Oncall scrap:'
    ],
    noteTemplates: [
      'link from onboarding doc',
      'postmortem follow-up',
      'cut CI minutes with this',
      'verify before the payments cutover'
    ],
    excerptSnippets: [
      'Retries without a stable request key turn timeouts into duplicate charges.',
      'Sequential reads can beat fancy plans when the hot set still fits in memory.',
      'Branch-scoped caches miss when CI jobs checkout a different ref.',
      'Service worker event handles must stay registered or the worker sleeps mid-task.'
    ]
  }
}

const WEAK_TITLES = ['Untitled document', 'Notes', 'Draft', 'Document', 'New page'] as const

function pick<T>(list: readonly T[], index: number): T {
  return list[index % list.length]!
}

/**
 * 生成多样性书签（含少量弱标题 + 备注探针）。
 * @param persona 画像风味
 * @param count 条数
 * @param keyPrefix 稳定 key 前缀
 */
export function buildDiversityBookmarkSeeds(
  persona: RecallProbePersonaId,
  count: number,
  keyPrefix = `div-bm-${persona}`
): RecallProbeBookmarkSeed[] {
  const pack = PACKS[persona]
  const out: RecallProbeBookmarkSeed[] = []
  for (let i = 0; i < count; i += 1) {
    const host = pick(pack.hosts, i)
    const prefix = pick(pack.titlePrefixes, i)
    const topic = `${persona} topic ${i + 1}`
    const daysAgo = 1 + (i % 400)
    const weak = i % 17 === 0
    const withNote = i % 7 === 0 || weak
    const note = withNote ? `${pick(pack.noteTemplates, i)} (#${i + 1})` : undefined
    const title = weak ? pick(WEAK_TITLES, i) : `${prefix} ${topic}`
    const suggestedClues =
      withNote && note
        ? [
            `the ${weak ? 'untitled ' : ''}page where I noted ${note.split(' (#')[0]}`,
            `${prefix.toLowerCase().replace(/:$/, '')} I saved about ${topic}`
          ]
        : []
    out.push({
      key: `${keyPrefix}-${i}`,
      title,
      url: `${host}/${i}`,
      daysAgo,
      ...(note ? { note } : {}),
      suggestedClues
    })
  }
  return out
}

/**
 * 生成多样性摘录（含纯备注弱页名）。
 */
export function buildDiversityExcerptSeeds(
  persona: RecallProbePersonaId,
  count: number,
  keyPrefix = `div-ex-${persona}`
): RecallProbeExcerptSeed[] {
  const pack = PACKS[persona]
  const out: RecallProbeExcerptSeed[] = []
  for (let i = 0; i < count; i += 1) {
    const host = pick(pack.hosts, i + 5)
    const snippet = pick(pack.excerptSnippets, i)
    const daysAgo = 2 + (i % 300)
    const weakPage = i % 11 === 0
    const withNote = i % 6 === 0 || weakPage
    const note = withNote ? `${pick(pack.noteTemplates, i + 2)} excerpt ${i + 1}` : undefined
    const pageTitle = weakPage
      ? pick(WEAK_TITLES, i + 1)
      : `${pick(pack.titlePrefixes, i + 3)} item ${i + 1}`
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
      sourceUrl: `${host}/excerpt/${i}`,
      selectedText: `${snippet} (div ${i + 1})`,
      daysAgo,
      ...(note ? { note } : {}),
      suggestedClues
    })
  }
  return out
}
