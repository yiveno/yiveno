/**
 * Hybrid eval 专用 corpus。
 *
 * 与 `buildRecallEvalCorpus` 命名空间独立（`2222...` prefix），仅用于 `run-hybrid-eval` 链路。
 * 每条 MemoryItem 都预填 `clues.embedding`，使 Hybrid 路径实际能跑（生产 corpus embedding 是
 * `schedule-async-memory-embedding` 异步写入；eval 必须可同步构造）。
 *
 * **Anchor 模型（核心约定）：**
 * - 每个"应该被命中"的 corpus item 用一个**专属 anchor string** 派生 fake embedding。
 * - 对应 clue 的 `clueEmbeddingText` 必须包含同一 anchor string（用例侧保证）。
 * - 这样不论 fake hash 算法如何演化，clue ↔ item 余弦恒为 1，必过阈值；
 *   与之正交的 item 余弦恒为 0，必过不了阈值。**不依赖具体 hash 输出的分布**。
 *
 * `now`：固定时钟字符串，对齐 `RECALL_EVAL_NOW_MS = 2026-07-25`，与 orchestrate-keyword-recall 一致。
 */

import {
  createBookmarkMemoryItem,
  createTextExcerptMemoryItem
} from '@/core/memory/create-memory-item'
import type { MemoryItem } from '@/core/memory/memory-item'
import {
  HYBRID_FAKE_EMBEDDING_DIM,
  makeFakeEmbedding,
  makeOrthogonalVector,
  makeOrthogonalVectorForPair
} from '@/core/recall/eval/hybrid-fake-embedding'
import { HYBRID_EVAL_IDS } from '@/core/recall/eval/hybrid-eval-ids'

/** Hybrid eval 全员共用的固定 owner / profile，与现有关键词 eval 一致以避免混合断言出错。 */
const OWNER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const SOURCE_LOCAL_PROFILE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

/**
 * 对齐 `RECALL_EVAL_NOW_MS = 2026-07-25 12:00 UTC`（与现有 recall-eval-now.ts 同步）。
 * 时间窗类用例可借此精确判断 in/out window。
 */
const HYBRID_EVAL_NOW = '2026-07-25T12:00:00.000Z'
const RECENT_HYBRID_ISO = '2026-07-24T09:00:00.000Z' // yesterday 窗内
const OLD_HYBRID_ISO = '2026-06-01T09:00:00.000Z' // yesterday / recent 窗外

// —— Anchor 常量（用例 clue 的 embedding 文本必须包含对应 anchor；同 anchor → 余弦 1）——
// 命名：<target>_ANCHOR；语义上对应"被命中目标"。
export const HYBRID_EVAL_ANCHORS = {
  /** semanticNearNeighborExcerpt 的 anchor；用例 pure-semantic-movie-near-neighbor / 同义改写场景 */
  semanticNear: 'the first nuclear detonation movie',
  /** keywordLeaderPage 的 anchor；用例 keyword-leader-protection-against-semantic-rival */
  keywordLeader: 'atomic bomb documentary',
  /** pureSemanticMovieNote 的 anchor；用例 pure-semantic-physicists-only */
  pureSemantic: 'first chain reaction physicists cinematic review',
  /** inWindowRecentExcerpt 的 anchor；用例 corroboration-suppress-window-only-unrelated / adr011 */
  inWindowRecent: 'privacy article yesterday',
  /** sameDomainArticle 的 anchor；用例 same-domain-beats-semantic-tie */
  sameDomain: 'Yiveno product documentation recall chapter'
} as const

/** 用工厂出 item 后用稳定 ID + 时间戳覆写，方便断言。 */
function withStableIdentity(item: MemoryItem, id: string, updatedAt: string): MemoryItem {
  return {
    ...item,
    id,
    createdAt: updatedAt,
    updatedAt
  }
}

/** 把 fake embedding 注入新构造的 MemoryItem（必须有 `clues.embedding`）。 */
function withFakeEmbedding(item: MemoryItem, embedding: readonly number[]): MemoryItem {
  return {
    ...item,
    clues: { ...item.clues, embedding: [...embedding] }
  }
}

/**
 * 构造与现有 recall-eval 同形态、同 owner 的 Mini Hybrid corpus。
 * 纯函数；调用方传入额外 fields 用于调用方注入。
 */
export function buildHybridEvalCorpus(): MemoryItem[] {
  // —— 各 target 的 fake embedding（与 anchor string 一一对应；hash 算法无关）——
  const semanticNearVector = makeFakeEmbedding(HYBRID_EVAL_ANCHORS.semanticNear)
  const keywordLeaderVector = makeFakeEmbedding(HYBRID_EVAL_ANCHORS.keywordLeader)
  const pureSemanticVector = makeFakeEmbedding(HYBRID_EVAL_ANCHORS.pureSemantic)
  const inWindowVector = makeFakeEmbedding(HYBRID_EVAL_ANCHORS.inWindowRecent)
  const sameDomainVector = makeFakeEmbedding(HYBRID_EVAL_ANCHORS.sameDomain)

  // —— 正交对照：与所有 anchor 都准正交，验证 R0 / 抑制语义命中 ——
  const musicRivalOrthogonal = makeOrthogonalVector('a tune that keeps replaying in my head')
  const weatherRivalOrthogonal = makeOrthogonalVector(
    'forecast discussion for next week in the metropolitan area'
  )
  const outOfWindowOrthogonal = makeOrthogonalVector(
    'ancient burial practices over a thousand years ago'
  )
  const inWindowUnrelatedOrthogonal = makeOrthogonalVector(
    'a long boring post about weather forecast across the pacific northwest'
  )

  // —— 同域软加成对照组 B（竞争项）：与 sameDomainVector 互不相似，验证同域加成压过 ——
  const offDomainNearNeighborVector = makeOrthogonalVectorForPair(
    'Yiveno design principles — strategy notes chapter',
    [HYBRID_EVAL_ANCHORS.sameDomain]
  )

  return [
    // —— R0 助手发令唯一候选：与 clue 准正交 —— 等于「邻域不准填空」的对照 —
    withFakeEmbedding(
      withStableIdentity(
        createTextExcerptMemoryItem({
          ownerId: OWNER_ID,
          sourceLocalProfileId: SOURCE_LOCAL_PROFILE_ID,
          payload: {
            selectedText: 'Wrote the chorus for an indie single last spring.',
            sourceUrl: 'https://notes.example.com/eval-hybrid-music-rival',
            pageTitle: 'Indie track draft'
          },
          now: () => OLD_HYBRID_ISO
        }),
        HYBRID_EVAL_IDS.r0AssistantCommand,
        OLD_HYBRID_ISO
      ),
      musicRivalOrthogonal
    ),

    // —— R0 非 Recall（天气）：与 clue 准正交 —— 验证 Hybrid 不得用语义填空 —
    withFakeEmbedding(
      withStableIdentity(
        createTextExcerptMemoryItem({
          ownerId: OWNER_ID,
          sourceLocalProfileId: SOURCE_LOCAL_PROFILE_ID,
          payload: {
            selectedText: 'Weather pattern discussion for next week.',
            sourceUrl: 'https://news.example.com/eval-hybrid-weather-rival',
            pageTitle: 'Weather'
          },
          now: () => OLD_HYBRID_ISO
        }),
        HYBRID_EVAL_IDS.r0NonRecallWeather,
        OLD_HYBRID_ISO
      ),
      weatherRivalOrthogonal
    ),

    // —— 语义同向目标：英文同义改写（电影评论向）——
    withFakeEmbedding(
      withStableIdentity(
        createTextExcerptMemoryItem({
          ownerId: OWNER_ID,
          sourceLocalProfileId: SOURCE_LOCAL_PROFILE_ID,
          payload: {
            selectedText:
              'A three hour re-enactment of the Manhattan Project, full of Cillian Murphy looking worried.',
            sourceUrl: 'https://reviews.example.com/eval-hybrid-near-neighbor',
            pageTitle: 'Movie review'
          },
          now: () => OLD_HYBRID_ISO
        }),
        HYBRID_EVAL_IDS.semanticNearNeighborExcerpt,
        OLD_HYBRID_ISO
      ),
      semanticNearVector
    ),

    // —— 词面领先者：标题中含与 clue 强共享词，关键词 Top1 强势 ——
    withFakeEmbedding(
      withStableIdentity(
        createTextExcerptMemoryItem({
          ownerId: OWNER_ID,
          sourceLocalProfileId: SOURCE_LOCAL_PROFILE_ID,
          payload: {
            selectedText:
              'Atomic bomb primer covering the first nuclear detonation tests in the New Mexico desert.',
            sourceUrl: 'https://notes.example.com/eval-hybrid-keyword-leader',
            pageTitle: 'Atomic bomb documentary notes'
          },
          now: () => OLD_HYBRID_ISO
        }),
        HYBRID_EVAL_IDS.keywordLeaderPage,
        OLD_HYBRID_ISO
      ),
      keywordLeaderVector
    ),

    // —— 纯语义近邻：词面与 clue 完全无重叠，语义同向 ——
    withFakeEmbedding(
      withStableIdentity(
        createTextExcerptMemoryItem({
          ownerId: OWNER_ID,
          sourceLocalProfileId: SOURCE_LOCAL_PROFILE_ID,
          payload: {
            selectedText: 'Cinematic review of the physicists behind the first chain reaction.',
            sourceUrl: 'https://reviews.example.com/eval-hybrid-movie-movie-note',
            pageTitle: 'Untitled'
          },
          now: () => OLD_HYBRID_ISO
        }),
        HYBRID_EVAL_IDS.pureSemanticMovieNote,
        OLD_HYBRID_ISO
      ),
      pureSemanticVector
    ),

    // —— 时窗场景：yesterday 窗内、语义近邻、词面命中「privacy article」—
    withFakeEmbedding(
      withStableIdentity(
        createTextExcerptMemoryItem({
          ownerId: OWNER_ID,
          sourceLocalProfileId: SOURCE_LOCAL_PROFILE_ID,
          payload: {
            selectedText: 'Privacy update on data brokers and the new state measure.',
            sourceUrl: 'https://news.example.com/eval-hybrid-privacy-recent',
            pageTitle: 'Privacy news'
          },
          now: () => RECENT_HYBRID_ISO
        }),
        HYBRID_EVAL_IDS.inWindowRecentExcerpt,
        RECENT_HYBRID_ISO
      ),
      inWindowVector
    ),

    // —— 时窗外无关条目 —
    withFakeEmbedding(
      withStableIdentity(
        createTextExcerptMemoryItem({
          ownerId: OWNER_ID,
          sourceLocalProfileId: SOURCE_LOCAL_PROFILE_ID,
          payload: {
            selectedText: 'Burial customs of the early bronze age civilization.',
            sourceUrl: 'https://history.example.com/eval-hybrid-old-unrelated',
            pageTitle: 'Bronze age history'
          },
          now: () => OLD_HYBRID_ISO
        }),
        HYBRID_EVAL_IDS.outOfWindowOldExcerpt,
        OLD_HYBRID_ISO
      ),
      outOfWindowOrthogonal
    ),

    // —— 时窗内但准正交（佐证门应剔除）—
    withFakeEmbedding(
      withStableIdentity(
        createTextExcerptMemoryItem({
          ownerId: OWNER_ID,
          sourceLocalProfileId: SOURCE_LOCAL_PROFILE_ID,
          payload: {
            selectedText: 'Weather forecast discussion for the pacific northwest.',
            sourceUrl: 'https://weather.example.com/eval-hybrid-window-unrelated',
            pageTitle: 'Weather'
          },
          now: () => RECENT_HYBRID_ISO
        }),
        HYBRID_EVAL_IDS.inWindowUnrelatedExcerpt,
        RECENT_HYBRID_ISO
      ),
      inWindowUnrelatedOrthogonal
    ),

    // —— 同域加成 A：clue 与 item 同 host ——
    withFakeEmbedding(
      withStableIdentity(
        createBookmarkMemoryItem({
          ownerId: OWNER_ID,
          sourceLocalProfileId: SOURCE_LOCAL_PROFILE_ID,
          payload: {
            title: 'Yiveno Product Doc — Recall section',
            url: 'https://docs.yiveno.com/product/recall'
          },
          now: () => OLD_HYBRID_ISO
        }),
        HYBRID_EVAL_IDS.sameDomainArticle,
        OLD_HYBRID_ISO
      ),
      sameDomainVector
    ),

    // —— 同域加成 B（竞争项）：与 A 语义相近，但不同 host —
    withFakeEmbedding(
      withStableIdentity(
        createBookmarkMemoryItem({
          ownerId: OWNER_ID,
          sourceLocalProfileId: SOURCE_LOCAL_PROFILE_ID,
          payload: {
            title: 'Yiveno Design Principles',
            url: 'https://design.yiveno.com/principles'
          },
          now: () => OLD_HYBRID_ISO
        }),
        HYBRID_EVAL_IDS.offDomainNearNeighbor,
        OLD_HYBRID_ISO
      ),
      offDomainNearNeighborVector
    )
  ]
}

/** 与 `RECALL_EVAL_NOW_MS` 对齐（2026-07-25 12:00 UTC）。 */
export const HYBRID_EVAL_NOW_MS = new Date(HYBRID_EVAL_NOW).getTime()
