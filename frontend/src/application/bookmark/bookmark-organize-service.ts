/**
 * 书签整理服务
 *
 * 职责：
 * - 一键整理书签（AI 生成文件夹结构）
 * - LLM 生成分类结构（整理流程不阻塞等待 Embedding）
 * - 提供预览和手动调整功能
 * - 执行书签移动操作
 */

import { aiAppService, AI_ORGANIZE_BATCH_SIZE } from '@/application/ai/ai-app-service'
import { buildProposalTreeFromOrganizeResult } from '@/application/bookmark/bookmark-organize-proposal-builder'
import {
  auditOrganizeProposalIntegrity,
  type OrganizeProposalAuditResult
} from '@/application/bookmark/organize-proposal-audit'
import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
import { logger } from '@/infrastructure/logging/logger'
import { llmAdapter } from '@/infrastructure/llm/llm-adapter'
import {
  ORGANIZE_TOTAL_STAGES,
  type OrganizeProgress,
  type OrganizeStageKey
} from '@/core/bookmark/organize-progress'
import type { BookmarkNode } from '@/types'

export type { OrganizeProgress, OrganizeStageKey } from '@/core/bookmark/organize-progress'

/**
 * 整理提案完整性校验失败（不可自动修复时使用）
 */
export class OrganizeIntegrityError extends Error {
  readonly audit: OrganizeProposalAuditResult

  constructor(audit: OrganizeProposalAuditResult) {
    super('organize proposal integrity failed')
    this.name = 'OrganizeIntegrityError'
    this.audit = audit
  }
}

/** 一键整理失败（对用户仅展示统一失败提示） */
export class OrganizeFailureError extends Error {
  constructor(message = 'organize failed') {
    super(message)
    this.name = 'OrganizeFailureError'
  }
}

/**
 * 文件夹结构
 */
export interface FolderStructure {
  name: string
  path: string
  bookmarkIds: string[]
}

/**
 * 整理结果
 */
/** 提案树构建用的书签快照 */
export interface OrganizeBookmarkSnapshot {
  id: string
  title: string
  url: string
  parentId?: string
  index?: number
}

/** 一键整理可选参数 */
export interface OrganizeOptions {
  /** 用户补充说明，会一并传给 LLM */
  userNotes?: string
}

export interface OrganizeResult {
  /** 生成的文件夹结构 */
  folders: FolderStructure[]
  /** 参与整理的书签快照（供提案树挂载） */
  bookmarkItems: OrganizeBookmarkSnapshot[]
  /** 原始书签数量 */
  originalCount: number
  /** 分类书签数量 */
  organizedCount: number
  /** 未分类书签数量 */
  unclassifiedCount: number
  /** 使用的 AI 提供者 */
  aiProvider: string
}

/**
 * 书签整理服务
 */
export class BookmarkOrganizeService {
  private readonly loggerPrefix = 'BookmarkOrganizeService'

  /**
   * 一键整理书签
   *
   * 流程：
   * 1. 从 IndexedDB 获取所有书签
   * 2. 为书签生成 Embedding（如果没有）
   * 3. 使用 LLM 分析并生成文件夹结构
   * 4. 返回整理结果供用户预览
   *
   * @param progressCallback 进度回调
   * @returns 整理结果
   */
  async organizeBookmarks(
    progressCallback?: (progress: OrganizeProgress) => void,
    options?: OrganizeOptions
  ): Promise<OrganizeResult> {
    const userNotes = options?.userNotes?.trim() || undefined
    logger.info(this.loggerPrefix, '开始一键整理书签', {
      hasUserNotes: Boolean(userNotes)
    })

    // 阶段 1: 获取书签数据
    this.emitProgress(progressCallback, 'load_bookmarks', 1, {
      stageProgress: 0,
      stageCurrent: 0,
      stageTotal: 0,
      stageUnit: 'none',
      bookmarkCount: 0,
      isComplete: false
    })

    const bookmarks = await indexedDBManager.getAllBookmarks()
    logger.info(this.loggerPrefix, `获取到 ${bookmarks.length} 个书签`)

    // 按书签 ID 逐条参与整理：全部叶子书签（含无 URL / 失效链接，URL 非必填）
    const bookmarkItems = bookmarks.filter(b => !b.isFolder)
    const noUrlCount = bookmarkItems.filter(b => !b.url?.trim()).length
    if (noUrlCount > 0) {
      logger.info(this.loggerPrefix, '含无 URL 书签，仍按 ID 参与整理', { noUrlCount })
    }
    logger.info(this.loggerPrefix, `参与整理的书签项: ${bookmarkItems.length}`)

    if (bookmarkItems.length === 0) {
      throw new OrganizeFailureError('no bookmarks to organize')
    }

    const bookmarkCount = bookmarkItems.length

    this.emitProgress(progressCallback, 'load_bookmarks', 1, {
      stageProgress: 1,
      stageCurrent: bookmarkCount,
      stageTotal: bookmarkCount,
      stageUnit: 'bookmarks',
      bookmarkCount,
      isComplete: false
    })

    // 阶段 2: 理解书签内容（一键整理仅依赖 LLM 标题/URL，不阻塞等待 ONNX 模型下载）
    logger.info(this.loggerPrefix, '跳过 Embedding 同步，直接进入 AI 分类')
    this.emitProgress(progressCallback, 'index_bookmarks', 2, {
      stageProgress: 1,
      stageCurrent: bookmarkCount,
      stageTotal: bookmarkCount,
      stageUnit: 'bookmarks',
      bookmarkCount,
      isComplete: false
    })

    // 阶段 3: AI 分析并生成文件夹结构
    const totalAiBatches = Math.max(1, Math.ceil(bookmarkCount / AI_ORGANIZE_BATCH_SIZE))
    this.emitProgress(progressCallback, 'ai_organize', 3, {
      stageProgress: 0,
      stageCurrent: 0,
      stageTotal: totalAiBatches,
      stageUnit: 'batches',
      bookmarkCount,
      isComplete: false
    })

    // 准备发送给 AI 的数据
    const organizeSnapshots: OrganizeBookmarkSnapshot[] = bookmarkItems.map(bookmark => {
      const snapshot: OrganizeBookmarkSnapshot = {
        id: bookmark.id,
        title: bookmark.title,
        url: bookmark.url || '',
        index: bookmark.index
      }
      if (bookmark.parentId) {
        snapshot.parentId = bookmark.parentId
      }
      return snapshot
    })

    const aiBookmarks = organizeSnapshots.map(bookmark => {
      const tags = bookmarkItems.find(item => item.id === bookmark.id)?.tags
      const payload: {
        id: string
        title: string
        url: string
        existingTags?: string[]
      } = {
        id: bookmark.id,
        title: bookmark.title,
        url: bookmark.url
      }
      if (tags && tags.length > 0) {
        payload.existingTags = tags
      }
      return payload
    })

    const aiResult = await aiAppService.autoOrganizeBookmarks(aiBookmarks, {
      ...(userNotes ? { userNotes } : {}),
      onProgress: aiProgress => {
        const stageTotal = aiProgress.totalBatches > 0 ? aiProgress.totalBatches : totalAiBatches
        const stageCurrent = aiProgress.processedBatches
        this.emitProgress(progressCallback, 'ai_organize', 3, {
          stageProgress: stageTotal > 0 ? stageCurrent / stageTotal : 0,
          stageCurrent,
          stageTotal,
          stageUnit: 'batches',
          detailCurrent: aiProgress.processedBookmarks,
          detailTotal: aiProgress.totalBookmarks,
          detailUnit: 'bookmarks',
          bookmarkCount,
          isComplete: false
        })
      }
    })

    this.emitProgress(progressCallback, 'ai_organize', 3, {
      stageProgress: 1,
      stageCurrent: totalAiBatches,
      stageTotal: totalAiBatches,
      stageUnit: 'batches',
      bookmarkCount,
      isComplete: false
    })

    // 阶段 4: 生成整理预览
    this.emitProgress(progressCallback, 'complete', 4, {
      stageProgress: 0,
      stageCurrent: 0,
      stageTotal: 1,
      stageUnit: 'none',
      bookmarkCount,
      isComplete: false
    })

    this.emitProgress(progressCallback, 'complete', 4, {
      stageProgress: 1,
      stageCurrent: 1,
      stageTotal: 1,
      stageUnit: 'none',
      bookmarkCount,
      isComplete: true
    })

    // 统计结果
    const organizedCount = aiResult.folders.reduce(
      (sum, folder) => sum + folder.bookmarkIds.length,
      0
    )
    const unclassifiedCount = bookmarkItems.length - organizedCount

    const result: OrganizeResult = {
      folders: aiResult.folders,
      bookmarkItems: organizeSnapshots,
      originalCount: bookmarkItems.length,
      organizedCount,
      unclassifiedCount,
      aiProvider: aiResult.provider
    }

    logger.info(this.loggerPrefix, '一键整理完成', {
      originalCount: result.originalCount,
      organizedCount: result.organizedCount,
      unclassifiedCount: result.unclassifiedCount,
      folderCount: result.folders.length
    })

    return result
  }

  /**
   * 将 AI 整理结果转为提案树（供管理页右侧预览）
   */
  buildProposalPreview(
    originalRoots: BookmarkNode[],
    folders: FolderStructure[],
    bookmarkItems: OrganizeBookmarkSnapshot[]
  ): BookmarkNode[] {
    return buildProposalTreeFromOrganizeResult(originalRoots, folders, bookmarkItems)
  }

  /**
   * 校验整理提案是否包含全部参与整理的书签（按 ID，一本不少）。
   */
  auditProposalIntegrity(
    bookmarkItems: OrganizeBookmarkSnapshot[],
    proposalRoots: BookmarkNode[]
  ): OrganizeProposalAuditResult {
    return auditOrganizeProposalIntegrity(bookmarkItems, proposalRoots)
  }

  /**
   * 构建并通过完整性审计的整理提案树；失败则抛出 OrganizeIntegrityError。
   */
  buildValidatedProposalPreview(
    originalRoots: BookmarkNode[],
    result: OrganizeResult
  ): BookmarkNode[] {
    const proposal = buildProposalTreeFromOrganizeResult(
      originalRoots,
      result.folders,
      result.bookmarkItems
    )
    const audit = auditOrganizeProposalIntegrity(result.bookmarkItems, proposal)
    if (!audit.ok) {
      throw new OrganizeIntegrityError(audit)
    }
    return proposal
  }

  /**
   * 检查 LLM 是否可用
   */
  async ensureLlmReady(): Promise<void> {
    const ready = await llmAdapter.hasAvailableProvider()
    if (!ready) {
      throw new Error('请先登录或配置 API Key 后使用 AI 整理')
    }
  }

  /**
   * 推送整理进度
   */
  private emitProgress(
    callback: ((progress: OrganizeProgress) => void) | undefined,
    stageKey: OrganizeStageKey,
    currentStage: number,
    partial: Partial<Omit<OrganizeProgress, 'totalStages' | 'currentStage' | 'stageKey'>> &
      Pick<OrganizeProgress, 'bookmarkCount' | 'isComplete'>
  ): void {
    if (!callback) return

    const stageCurrent = partial.stageCurrent ?? 0
    const stageTotal = partial.stageTotal ?? 0
    const stageUnit = partial.stageUnit ?? 'none'

    callback({
      totalStages: ORGANIZE_TOTAL_STAGES,
      currentStage,
      stageKey,
      stageProgress: partial.stageProgress ?? 0,
      stageCurrent,
      stageTotal,
      stageUnit,
      detailCurrent: partial.detailCurrent ?? stageCurrent,
      detailTotal: partial.detailTotal ?? stageTotal,
      detailUnit: partial.detailUnit ?? stageUnit,
      bookmarkCount: partial.bookmarkCount,
      isComplete: partial.isComplete
    })
  }
}

/**
 * 单例实例
 */
export const bookmarkOrganizeService = new BookmarkOrganizeService()
