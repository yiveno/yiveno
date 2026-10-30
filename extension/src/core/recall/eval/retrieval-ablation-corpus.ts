/**
 * L2 召回消融合成库。
 *
 * - **无**预填 embedding（禁止 fake / embeddingAnchor）。
 * - 真实轨：由 runner 经 Worker `bge-m3` 写入 `clues.embedding`。
 * - 时钟与 `RECALL_EVAL_NOW_MS` 对齐（统一 nowMs）。
 */

import {
  createBookmarkMemoryItem,
  createTextExcerptMemoryItem
} from '@/core/memory/create-memory-item'
import type { MemoryItem } from '@/core/memory/memory-item'
import { RECALL_EVAL_NOW_MS } from '@/core/recall/eval/recall-eval-now'
import { RETRIEVAL_ABLATION_IDS } from '@/core/recall/eval/retrieval-ablation-ids'

const OWNER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const SOURCE_LOCAL_PROFILE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

/** 与 RECALL_EVAL_NOW_MS 同日：2026-07-25T12:00Z */
export const RETRIEVAL_ABLATION_NOW_MS = RECALL_EVAL_NOW_MS

const ABLATION_NOW_ISO = new Date(RETRIEVAL_ABLATION_NOW_MS).toISOString()
const RECENT_ISO = '2026-07-24T09:00:00.000Z'
const OLD_ISO = '2026-06-01T09:00:00.000Z'

function withStableIdentity(item: MemoryItem, id: string, updatedAt: string): MemoryItem {
  return {
    ...item,
    id,
    createdAt: updatedAt,
    updatedAt
  }
}

/** 构造未嵌入的消融 corpus（纯函数）。 */
export function buildRetrievalAblationCorpus(): MemoryItem[] {
  return [
    withStableIdentity(
      createTextExcerptMemoryItem({
        ownerId: OWNER_ID,
        sourceLocalProfileId: SOURCE_LOCAL_PROFILE_ID,
        payload: {
          selectedText:
            'A three hour re-enactment of the Manhattan Project, full of Cillian Murphy looking worried.',
          sourceUrl: 'https://reviews.example.com/ablation-movie-near',
          pageTitle: 'Movie review'
        },
        now: () => OLD_ISO
      }),
      RETRIEVAL_ABLATION_IDS.semanticMovieExcerpt,
      OLD_ISO
    ),
    withStableIdentity(
      createBookmarkMemoryItem({
        ownerId: OWNER_ID,
        sourceLocalProfileId: SOURCE_LOCAL_PROFILE_ID,
        payload: {
          title: 'Atomic bomb documentary notes',
          url: 'https://docs.example.com/ablation-atomic-bomb-doc'
        },
        now: () => OLD_ISO
      }),
      RETRIEVAL_ABLATION_IDS.keywordLeaderPage,
      OLD_ISO
    ),
    withStableIdentity(
      createTextExcerptMemoryItem({
        ownerId: OWNER_ID,
        sourceLocalProfileId: SOURCE_LOCAL_PROFILE_ID,
        payload: {
          selectedText:
            'Cinematic notes on the physicists behind the first sustained chain reaction.',
          sourceUrl: 'https://notes.example.com/ablation-physicists',
          pageTitle: 'Physicists review'
        },
        now: () => OLD_ISO
      }),
      RETRIEVAL_ABLATION_IDS.pureSemanticPhysicistsNote,
      OLD_ISO
    ),
    withStableIdentity(
      createTextExcerptMemoryItem({
        ownerId: OWNER_ID,
        sourceLocalProfileId: SOURCE_LOCAL_PROFILE_ID,
        payload: {
          selectedText: 'How we think about privacy in product analytics dashboards.',
          sourceUrl: 'https://blog.example.com/ablation-privacy',
          pageTitle: 'Privacy article'
        },
        now: () => RECENT_ISO
      }),
      RETRIEVAL_ABLATION_IDS.privacyRecentExcerpt,
      RECENT_ISO
    ),
    withStableIdentity(
      createTextExcerptMemoryItem({
        ownerId: OWNER_ID,
        sourceLocalProfileId: SOURCE_LOCAL_PROFILE_ID,
        payload: {
          selectedText: 'Ancient burial practices over a thousand years ago.',
          sourceUrl: 'https://history.example.com/ablation-burial',
          pageTitle: 'Burial archaeology'
        },
        now: () => OLD_ISO
      }),
      RETRIEVAL_ABLATION_IDS.ancientBurialExcerpt,
      OLD_ISO
    ),
    withStableIdentity(
      createTextExcerptMemoryItem({
        ownerId: OWNER_ID,
        sourceLocalProfileId: SOURCE_LOCAL_PROFILE_ID,
        payload: {
          selectedText: 'A long boring post about weather forecast across the pacific northwest.',
          sourceUrl: 'https://news.example.com/ablation-weather',
          pageTitle: 'Weather forecast'
        },
        now: () => RECENT_ISO
      }),
      RETRIEVAL_ABLATION_IDS.weatherInWindowExcerpt,
      RECENT_ISO
    ),
    withStableIdentity(
      createTextExcerptMemoryItem({
        ownerId: OWNER_ID,
        sourceLocalProfileId: SOURCE_LOCAL_PROFILE_ID,
        payload: {
          selectedText: 'Weekly review: shipping notes and team rituals.',
          sourceUrl: 'https://notes.example.com/ablation-weekly-review',
          pageTitle: 'Weekly review'
        },
        now: () => OLD_ISO
      }),
      RETRIEVAL_ABLATION_IDS.weeklyReviewNoise,
      OLD_ISO
    ),
    withStableIdentity(
      createTextExcerptMemoryItem({
        ownerId: OWNER_ID,
        sourceLocalProfileId: SOURCE_LOCAL_PROFILE_ID,
        payload: {
          selectedText: 'Simple tomato pasta recipe with basil and olive oil.',
          sourceUrl: 'https://cook.example.com/ablation-pasta',
          pageTitle: 'Pasta recipe'
        },
        now: () => OLD_ISO
      }),
      RETRIEVAL_ABLATION_IDS.unrelatedRecipeExcerpt,
      OLD_ISO
    ),
    withStableIdentity(
      createTextExcerptMemoryItem({
        ownerId: OWNER_ID,
        sourceLocalProfileId: SOURCE_LOCAL_PROFILE_ID,
        payload: {
          selectedText:
            'Legal notes on cookie consent banners and GDPR lawful basis for analytics.',
          sourceUrl: 'https://legal.example.com/ablation-cookie-consent',
          pageTitle: 'Cookie consent checklist'
        },
        now: () => OLD_ISO
      }),
      RETRIEVAL_ABLATION_IDS.cookieConsentLegalExcerpt,
      OLD_ISO
    ),
    withStableIdentity(
      createTextExcerptMemoryItem({
        ownerId: OWNER_ID,
        sourceLocalProfileId: SOURCE_LOCAL_PROFILE_ID,
        payload: {
          selectedText:
            'Non-proliferation policy brief on nuclear weapons stockpile reductions and treaty verification.',
          sourceUrl: 'https://policy.example.com/ablation-nuclear-stockpile',
          pageTitle: 'Nuclear stockpile brief'
        },
        now: () => OLD_ISO
      }),
      RETRIEVAL_ABLATION_IDS.nuclearPolicyBriefExcerpt,
      OLD_ISO
    ),
    withStableIdentity(
      createTextExcerptMemoryItem({
        ownerId: OWNER_ID,
        sourceLocalProfileId: SOURCE_LOCAL_PROFILE_ID,
        payload: {
          selectedText:
            'Day hike packing checklist for Yellowstone Boardwalk trails: water, layers, bear spray.',
          sourceUrl: 'https://outdoors.example.com/ablation-yellowstone-hike',
          pageTitle: 'Yellowstone day hike checklist'
        },
        now: () => OLD_ISO
      }),
      RETRIEVAL_ABLATION_IDS.hikingYellowstoneExcerpt,
      OLD_ISO
    ),
    withStableIdentity(
      createTextExcerptMemoryItem({
        ownerId: OWNER_ID,
        sourceLocalProfileId: SOURCE_LOCAL_PROFILE_ID,
        payload: {
          selectedText:
            'Sourdough starter feeding schedule: discard, flour, water, and warm proofing notes.',
          sourceUrl: 'https://bake.example.com/ablation-sourdough',
          pageTitle: 'Sourdough starter log'
        },
        now: () => OLD_ISO
      }),
      RETRIEVAL_ABLATION_IDS.sourdoughStarterExcerpt,
      OLD_ISO
    )
  ]
}

/** 诊断用：确认 corpus 不含预填向量。 */
export function assertAblationCorpusHasNoEmbeddings(items: readonly MemoryItem[]): void {
  const polluted = items.filter(
    item => Array.isArray(item.clues.embedding) && item.clues.embedding.length > 0
  )
  if (polluted.length > 0) {
    throw new Error(
      `消融 corpus 不得预填 embedding；污染 id=[${polluted.map(item => item.id).join(', ')}]`
    )
  }
}

export function ablationCorpusFingerprint(items: readonly MemoryItem[]): string {
  return items
    .map(item => item.id)
    .slice()
    .sort()
    .join('|')
}

/** 时钟 ISO（与 nowMs 一致，便于报告）。 */
export const RETRIEVAL_ABLATION_NOW_ISO = ABLATION_NOW_ISO
