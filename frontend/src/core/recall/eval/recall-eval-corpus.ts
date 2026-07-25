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
          title: 'Yiveno 产品文档 v4.0',
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
          title: 'Yiveno 设计原则',
          url: 'https://docs.yiveno.com/design'
        },
        clues: {
          openCount: 20,
          lastOpenedAt: '2026-07-24T10:00:00.000Z'
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
          title: '产品留存分析框架',
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
          title: 'Cloudflare Workers 入门',
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
            '本地关键词 Filter 先扫 MemoryItem，再按字段权重打分；embedding 留给 Phase B。',
          sourceUrl: 'https://notes.example.com/vector-index',
          pageTitle: '向量索引备忘'
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
          selectedText: '发布前检查：env:sync:prod、typecheck、i18n:check，再打包扩展。',
          sourceUrl: 'https://notes.example.com/deploy-checklist',
          pageTitle: '上线检查清单'
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
          title: '红烧肉家常做法',
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
          title: 'Chrome 扩展 Manifest V3 迁移笔记',
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
          selectedText: '本周完成：Popup 空状态分层、摘录详情页、记忆库轻浏览。',
          sourceUrl: 'https://notes.example.com/weekly-review',
          pageTitle: '周复盘'
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
          selectedText: '先后仍须次第',
          sourceUrl: 'https://www.gushiwen.cn/context-only',
          pageTitle: '古文岛-原古诗文网',
          contextBefore: '桃红李白，红白相间。',
          contextAfter: '不可紊乱。'
        },
        clues: {
          openCount: 30,
          lastOpenedAt: '2026-07-24T18:00:00.000Z'
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
          selectedText: '深红白宜相',
          sourceUrl: 'https://www.gushiwen.cn/in-selected',
          pageTitle: '古文岛-原古诗文网'
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
          selectedText: '红白宜',
          sourceUrl: 'https://www.gushiwen.cn/prefix-tight',
          pageTitle: '古文岛-原古诗文网'
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
    )
  ]
}
