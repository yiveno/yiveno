/**
 * 确定性语料生成：~120 MemoryItem / 12 簇；尚不含行为播种。
 */

import {
  createBookmarkMemoryItem,
  createTextExcerptMemoryItem
} from '@/core/memory/create-memory-item'
import type { MemoryItem } from '@/core/memory/memory-item'
import {
  HYBRID_FAKE_EMBEDDING_DIM,
  makeFakeEmbedding,
  makeOrthogonalVectorForPair
} from '@/core/recall/eval/hybrid-fake-embedding'
import {
  BEHAVIOR_ABLATION_NOW_ISO,
  BEHAVIOR_ABLATION_NOW_MS,
  BEHAVIOR_ABLATION_OWNER_ID,
  BEHAVIOR_ABLATION_PROFILE_ID,
  BEHAVIOR_ABLATION_SIZES
} from '@/core/recall/eval/behavior-ablation/constants'
import {
  createMulberry32,
  deterministicUuid,
  nextInt
} from '@/core/recall/eval/behavior-ablation/prng'
import { TOPIC_CLUSTERS } from '@/core/recall/eval/behavior-ablation/topic-catalog'
import type { ClueGenItemView } from '@/core/recall/eval/behavior-ablation/types'

function pickTemplate(templates: readonly string[], rng: () => number): string {
  return templates[nextInt(rng, templates.length)]!
}

function fillTemplate(template: string, shared: string, distinct: string): string {
  return template.replaceAll('{shared}', shared).replaceAll('{distinct}', distinct)
}

function daysBeforeNow(days: number): string {
  const ms = BEHAVIOR_ABLATION_NOW_MS - days * 24 * 60 * 60 * 1000
  return new Date(ms).toISOString()
}

export interface GeneratedCorpus {
  items: MemoryItem[]
  views: ClueGenItemView[]
}

/**
 * 语料 → ClueGenItemView + MemoryItem（行为字段全 0；embedding 已填）。
 * 种子只驱动本函数内部抽样；不读行为表。
 */
export function generateCorpus(seed: number): GeneratedCorpus {
  const rng = createMulberry32(seed ^ 0x11)
  const views: ClueGenItemView[] = []
  const items: MemoryItem[] = []
  const anchors: string[] = []

  if (TOPIC_CLUSTERS.length !== BEHAVIOR_ABLATION_SIZES.topicClusters) {
    throw new Error(
      `topicClusters 期望 ${BEHAVIOR_ABLATION_SIZES.topicClusters}，实际 ${TOPIC_CLUSTERS.length}`
    )
  }

  let globalIndex = 0
  for (let c = 0; c < TOPIC_CLUSTERS.length; c += 1) {
    const cluster = TOPIC_CLUSTERS[c]!
    if (cluster.distinctive.length !== BEHAVIOR_ABLATION_SIZES.itemsPerCluster) {
      throw new Error(
        `簇 ${cluster.id} distinctive 长度须为 ${BEHAVIOR_ABLATION_SIZES.itemsPerCluster}`
      )
    }
    for (let i = 0; i < cluster.distinctive.length; i += 1) {
      const distinctive = cluster.distinctive[i]!
      const sharedJoin = cluster.shared.slice(0, 3).join(' ')
      const distinctJoin = distinctive.join(' ')
      const title = fillTemplate(
        pickTemplate(cluster.titleTemplates, rng),
        sharedJoin,
        distinctJoin
      )
      const note = fillTemplate(pickTemplate(cluster.noteTemplates, rng), sharedJoin, distinctJoin)
      const excerpt = fillTemplate(
        pickTemplate(cluster.excerptTemplates, rng),
        sharedJoin,
        distinctJoin
      )
      const domain = cluster.domains[nextInt(rng, cluster.domains.length)]!
      const path = `${cluster.id}/${distinctive[0]}-${i}`
      const url = `https://${domain}/ablation/${path}`
      const createdAt = daysBeforeNow(7 + nextInt(rng, 120))
      const id = deterministicUuid(0x100 + c, i)
      const embeddingAnchor = `${cluster.id}::${distinctive.join('_')}::${i}`
      anchors.push(embeddingAnchor)
      const isBookmark = (globalIndex + nextInt(rng, 2)) % 2 === 0
      const keywords = [...cluster.shared.slice(0, 4), ...distinctive]
      const tags = [cluster.id, distinctive[0]!]
      const type = isBookmark ? ('bookmark' as const) : ('text_excerpt' as const)

      const view: ClueGenItemView = {
        id,
        type,
        clusterId: cluster.id,
        sharedTerms: [...cluster.shared],
        distinctiveTerms: [...distinctive],
        title,
        url,
        domain,
        note,
        tags,
        keywords,
        selectedText: isBookmark ? '' : excerpt,
        embeddingAnchor,
        createdAt
      }
      views.push(view)
      globalIndex += 1
    }
  }

  // embedding：目标用自身 anchor；簇内近邻互相不完全正交，跨簇尽量正交
  for (let i = 0; i < views.length; i += 1) {
    const view = views[i]!
    const partners = anchors.filter((_, idx) => {
      if (idx === i) return false
      const other = views[idx]!
      return other.clusterId !== view.clusterId
    })
    const embedding =
      partners.length > 0
        ? makeOrthogonalVectorForPair(
            view.embeddingAnchor,
            partners.slice(0, 8),
            HYBRID_FAKE_EMBEDDING_DIM
          )
        : makeFakeEmbedding(view.embeddingAnchor, HYBRID_FAKE_EMBEDDING_DIM)
    // 同簇：混入一点共享方向，使语义近邻真实存在
    const sharedVec = makeFakeEmbedding(`${view.clusterId}::shared`, HYBRID_FAKE_EMBEDDING_DIM)
    const mixed = embedding.map((v, dim) => v * 0.75 + (sharedVec[dim] ?? 0) * 0.25)
    let norm = 0
    for (const v of mixed) norm += v * v
    norm = Math.sqrt(norm) || 1
    const normalized = mixed.map(v => v / norm)

    const baseClues = {
      title: view.title,
      keywords: [...view.keywords],
      tags: [...view.tags],
      note: view.note,
      domain: view.domain,
      sourceUrl: view.url,
      embedding: normalized,
      embeddingModel: 'behavior-ablation-fake',
      embeddingDim: HYBRID_FAKE_EMBEDDING_DIM,
      openCount: 0,
      settledCount: 0,
      dismissCount: 0,
      lastOpenedAt: null as string | null
    }

    let item: MemoryItem
    if (view.type === 'bookmark') {
      item = createBookmarkMemoryItem({
        ownerId: BEHAVIOR_ABLATION_OWNER_ID,
        sourceLocalProfileId: BEHAVIOR_ABLATION_PROFILE_ID,
        payload: {
          title: view.title,
          url: view.url,
          domain: view.domain
        },
        clues: baseClues,
        now: () => view.createdAt
      })
    } else {
      item = createTextExcerptMemoryItem({
        ownerId: BEHAVIOR_ABLATION_OWNER_ID,
        sourceLocalProfileId: BEHAVIOR_ABLATION_PROFILE_ID,
        payload: {
          selectedText: view.selectedText || view.title,
          sourceUrl: view.url,
          pageTitle: view.title,
          domain: view.domain
        },
        clues: {
          ...baseClues,
          textExcerpt: view.selectedText || view.title
        },
        now: () => view.createdAt
      })
    }

    items.push({
      ...item,
      id: view.id,
      createdAt: view.createdAt,
      updatedAt: view.createdAt
    })
  }

  if (items.length !== BEHAVIOR_ABLATION_SIZES.corpusItems) {
    throw new Error(`corpus 条数 ${items.length} ≠ ${BEHAVIOR_ABLATION_SIZES.corpusItems}`)
  }

  // 触达 now 常量，避免未用告警；时钟写在 meta
  void BEHAVIOR_ABLATION_NOW_ISO

  return { items, views }
}
