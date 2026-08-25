import {
  createBookmarkMemoryItem,
  createTextExcerptMemoryItem
} from '@/core/memory/create-memory-item'
import type { MemoryItem } from '@/core/memory/memory-item'
import { RECALL_EVAL_IDS } from '@/core/recall/eval/recall-eval-ids'

const ownerId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const sourceLocalProfileId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

/** 为工厂产物覆写稳定 ID 与时间戳，便于 eval 断言。 */
function withStableIdentity(item: MemoryItem, id: string, updatedAt: string): MemoryItem {
  return {
    ...item,
    id,
    createdAt: updatedAt,
    updatedAt
  }
}

/**
 * 固定记忆库（corpus）。
 * 模拟用户真实书签 + 摘录；后续调 Filter 只用同一库，避免用例漂移。
 */
export function buildRecallEvalCorpus(): MemoryItem[] {
  return [
    withStableIdentity(
      createBookmarkMemoryItem({
        ownerId,
        sourceLocalProfileId,
        payload: {
          title: 'Yiveno Product Doc v4.0',
          url: 'https://docs.yiveno.com/product/v4'
        },
        now: () => '2026-07-20T08:00:00.000Z'
      }),
      RECALL_EVAL_IDS.yivenoProductDoc,
      '2026-07-20T08:00:00.000Z'
    ),
    withStableIdentity(
      createBookmarkMemoryItem({
        ownerId,
        sourceLocalProfileId,
        payload: {
          title: 'Yiveno Design Principles',
          url: 'https://docs.yiveno.com/design'
        },
        clues: {
          openCount: 20,
          settledCount: 20,
          lastOpenedAt: '2026-07-24T10:00:00.000Z',
          lastSettledAt: '2026-07-24T10:00:00.000Z'
        },
        now: () => '2026-07-19T08:00:00.000Z'
      }),
      RECALL_EVAL_IDS.yivenoDesignPrinciples,
      '2026-07-19T08:00:00.000Z'
    ),
    withStableIdentity(
      createBookmarkMemoryItem({
        ownerId,
        sourceLocalProfileId,
        payload: {
          title: 'cqw/yiveno',
          url: 'https://github.com/cqw/yiveno'
        },
        now: () => '2026-07-18T08:00:00.000Z'
      }),
      RECALL_EVAL_IDS.githubRepo,
      '2026-07-18T08:00:00.000Z'
    ),
    withStableIdentity(
      createBookmarkMemoryItem({
        ownerId,
        sourceLocalProfileId,
        payload: {
          title: 'Retention Analysis Framework',
          url: 'https://growth.example.com/retention-framework'
        },
        now: () => '2026-07-17T08:00:00.000Z'
      }),
      RECALL_EVAL_IDS.retentionFramework,
      '2026-07-17T08:00:00.000Z'
    ),
    withStableIdentity(
      createBookmarkMemoryItem({
        ownerId,
        sourceLocalProfileId,
        payload: {
          title: 'Cloudflare Workers Guide',
          url: 'https://developers.cloudflare.com/workers/'
        },
        now: () => '2026-07-16T08:00:00.000Z'
      }),
      RECALL_EVAL_IDS.cloudflareWorkersGuide,
      '2026-07-16T08:00:00.000Z'
    ),
    withStableIdentity(
      createTextExcerptMemoryItem({
        ownerId,
        sourceLocalProfileId,
        payload: {
          selectedText:
            'Local keyword Filter scans MemoryItem first, then scores by field weights; embeddings stay in Phase B.',
          sourceUrl: 'https://notes.example.com/vector-index',
          pageTitle: 'Vector index notes'
        },
        now: () => '2026-07-15T08:00:00.000Z'
      }),
      RECALL_EVAL_IDS.vectorIndexExcerpt,
      '2026-07-15T08:00:00.000Z'
    ),
    withStableIdentity(
      createTextExcerptMemoryItem({
        ownerId,
        sourceLocalProfileId,
        payload: {
          selectedText:
            'Pre-release checklist: env:sync:prod, typecheck, i18n:check, then package the extension.',
          sourceUrl: 'https://notes.example.com/deploy-checklist',
          pageTitle: 'Release checklist'
        },
        now: () => '2026-07-14T08:00:00.000Z'
      }),
      RECALL_EVAL_IDS.deployChecklistExcerpt,
      '2026-07-14T08:00:00.000Z'
    ),
    withStableIdentity(
      createBookmarkMemoryItem({
        ownerId,
        sourceLocalProfileId,
        payload: {
          title: 'Braised pork belly recipe',
          url: 'https://cooking.example.com/hongshaorou'
        },
        now: () => '2026-07-13T08:00:00.000Z'
      }),
      RECALL_EVAL_IDS.cookingRecipeNoise,
      '2026-07-13T08:00:00.000Z'
    ),
    withStableIdentity(
      createBookmarkMemoryItem({
        ownerId,
        sourceLocalProfileId,
        payload: {
          title: 'Chrome Extension Manifest V3 migration notes',
          url: 'https://developer.chrome.com/docs/extensions/mv3/intro/'
        },
        now: () => '2026-07-12T08:00:00.000Z'
      }),
      RECALL_EVAL_IDS.chromeExtensionMv3,
      '2026-07-12T08:00:00.000Z'
    ),
    withStableIdentity(
      createTextExcerptMemoryItem({
        ownerId,
        sourceLocalProfileId,
        payload: {
          selectedText:
            'This week: popup empty-state tiers, excerpt detail page, and lightweight library browse.',
          sourceUrl: 'https://notes.example.com/weekly-review',
          pageTitle: 'Weekly review'
        },
        now: () => '2026-07-11T08:00:00.000Z'
      }),
      RECALL_EVAL_IDS.weeklyReviewNote,
      '2026-07-11T08:00:00.000Z'
    ),
    withStableIdentity(
      createTextExcerptMemoryItem({
        ownerId,
        sourceLocalProfileId,
        payload: {
          selectedText: 'Sequence still matters.',
          sourceUrl: 'https://www.gushiwen.cn/context-only',
          pageTitle: 'Palette notes',
          contextBefore: 'Deep red and white appear side by side.',
          contextAfter: 'Do not mix the order.'
        },
        clues: {
          openCount: 30,
          settledCount: 30,
          lastOpenedAt: '2026-07-24T18:00:00.000Z',
          lastSettledAt: '2026-07-24T18:00:00.000Z'
        },
        now: () => '2026-07-25T08:00:00.000Z'
      }),
      RECALL_EVAL_IDS.hongbaiContextOnly,
      '2026-07-25T08:00:00.000Z'
    ),
    withStableIdentity(
      createTextExcerptMemoryItem({
        ownerId,
        sourceLocalProfileId,
        payload: {
          selectedText: 'deep red white tone',
          sourceUrl: 'https://www.gushiwen.cn/in-selected',
          pageTitle: 'Palette notes'
        },
        now: () => '2026-07-10T08:00:00.000Z'
      }),
      RECALL_EVAL_IDS.excerptMatchEmbedded,
      '2026-07-10T08:00:00.000Z'
    ),
    withStableIdentity(
      createTextExcerptMemoryItem({
        ownerId,
        sourceLocalProfileId,
        payload: {
          selectedText: 'red white ok',
          sourceUrl: 'https://www.gushiwen.cn/prefix-tight',
          pageTitle: 'Palette notes'
        },
        now: () => '2026-07-09T08:00:00.000Z'
      }),
      RECALL_EVAL_IDS.excerptMatchPrefixTight,
      '2026-07-09T08:00:00.000Z'
    ),
    withStableIdentity(
      createTextExcerptMemoryItem({
        ownerId,
        sourceLocalProfileId,
        payload: {
          selectedText: 'deep red white tone',
          sourceUrl: 'https://notes.example.com/embedded-en',
          pageTitle: 'Palette notes'
        },
        now: () => '2026-07-08T08:00:00.000Z'
      }),
      RECALL_EVAL_IDS.excerptMatchEmbeddedEn,
      '2026-07-08T08:00:00.000Z'
    ),
    withStableIdentity(
      createTextExcerptMemoryItem({
        ownerId,
        sourceLocalProfileId,
        payload: {
          selectedText: 'red white ok',
          sourceUrl: 'https://notes.example.com/prefix-en',
          pageTitle: 'Palette notes'
        },
        now: () => '2026-07-07T08:00:00.000Z'
      }),
      RECALL_EVAL_IDS.excerptMatchPrefixTightEn,
      '2026-07-07T08:00:00.000Z'
    ),
    withStableIdentity(
      createTextExcerptMemoryItem({
        ownerId,
        sourceLocalProfileId,
        payload: {
          selectedText: 'This note covers growth metrics and cohort analysis methods.',
          sourceUrl: 'https://notes.example.com/type-b-retention',
          pageTitle: 'Growth notes'
        },
        // 对齐 RECALL_EVAL_NOW（2026-07-25）的 yesterday，供多轮补时间 must 用例硬过滤命中
        clues: { note: 'retention note for the leadership sync' },
        now: () => '2026-07-24T10:00:00.000Z'
      }),
      RECALL_EVAL_IDS.typeBRetentionNote,
      '2026-07-24T10:00:00.000Z'
    ),
    withStableIdentity(
      createTextExcerptMemoryItem({
        ownerId,
        sourceLocalProfileId,
        payload: {
          selectedText:
            'A powerful, visually spectacular drama that demands your full concentration, Oppenheimer is unmistakably the work of writer-director Christopher Nolan.',
          sourceUrl: 'https://www.rottentomatoes.com/m/oppenheimer_2023',
          pageTitle: 'Oppenheimer (2023) | Rotten Tomatoes'
        },
        now: () => '2026-08-24T08:00:00.000Z'
      }),
      RECALL_EVAL_IDS.oppenheimerRtExcerpt,
      '2026-08-24T08:00:00.000Z'
    ),
    withStableIdentity(
      createTextExcerptMemoryItem({
        ownerId,
        sourceLocalProfileId,
        payload: {
          selectedText:
            'The Million Pound Note (1954) is a classic Gregory Peck comedy about a man handed a banknote he cannot spend.',
          sourceUrl: 'https://en.wikipedia.org/wiki/The_Million_Pound_Note',
          pageTitle: 'The Million Pound Note - Wikipedia'
        },
        now: () => '2026-08-20T08:00:00.000Z'
      }),
      RECALL_EVAL_IDS.millionPoundPeckExcerpt,
      '2026-08-20T08:00:00.000Z'
    )
  ]
}
