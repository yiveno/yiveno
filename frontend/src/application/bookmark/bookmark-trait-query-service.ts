/**
 * 书签特征查询服务
 *
 * 职责：
 * - 提供统一的书签特征查询接口
 * - 利用 IndexedDB 索引优化性能
 * - 业务中立：不关心查询结果的用途
 *
 * 设计原则：
 * - 单一职责：只负责查询，不负责业务决策
 * - 高性能：优先使用索引
 * - 易扩展：支持新增特征类型
 *
 * @example
 * ```typescript
 * // 查询所有重复书签
 * const duplicateIds = await bookmarkTraitQueryService.queryByTrait('duplicate')
 *
 * // 业务层决定如何使用：
 * // - 清理业务：删除这些书签
 * // - 整理业务：移动到"待处理"文件夹
 * // - 导出业务：导出为 CSV
 * ```
 */

import { indexedDBManager } from "@/infrastructure/indexeddb/manager";
import type { BookmarkRecord } from "@/infrastructure/indexeddb/types";
import { logger } from "@/infrastructure/logging/logger";
import type { TraitTag } from "@/core/bookmark/trait-rules";
import { TRAIT_RULES } from "@/core/bookmark/trait-rules";

/**
 * 书签特征类型（重新导出，方便使用）
 */
export type { TraitTag } from "@/core/bookmark/trait-rules";

/**
 * 查询选项
 */
export interface TraitQueryOptions {
  /** 是否返回完整的书签对象（默认只返回 ID） */
  includeFullRecord?: boolean;
  /** 排序字段 */
  sortBy?: "dateAdded" | "title" | "url";
  /** 排序方向 */
  sortOrder?: "asc" | "desc";
}

/**
 * 查询结果
 */
export interface TraitQueryResult {
  ids: string[];
  records?: BookmarkRecord[];
  count: number;
}

/**
 * 书签特征查询服务
 */
class BookmarkTraitQueryService {
  /**
   * 通过特征查询书签（使用 IndexedDB 索引优化）
   *
   * 性能优化：
   * - 使用 IndexedDB 的 multiEntry 索引
   * - 避免全表扫描
   * - 只返回需要的数据（ID 或完整记录）
   *
   * @param trait - 特征类型
   * @param options - 查询选项
   * @returns 查询结果
   *
   * @example
   * ```typescript
   * // 只获取 ID（最快）
   * const result = await queryByTrait('duplicate')
   * console.log(result.ids)  // ['id1', 'id2', ...]
   *
   * // 获取完整记录并排序
   * const result = await queryByTrait('duplicate', {
   *   includeFullRecord: true,
   *   sortBy: 'dateAdded',
   *   sortOrder: 'asc'
   * })
   * ```
   */
  async queryByTrait(
    trait: TraitTag,
    options: TraitQueryOptions = {},
  ): Promise<TraitQueryResult> {
    try {
      // 获取所有书签，然后筛选具有指定特征的书签
      const allBookmarks = await indexedDBManager.getAllBookmarks();

      // 筛选具有指定特征的书签
      let records = allBookmarks.filter(
        (record) => record.traitTags && record.traitTags.includes(trait),
      );

      // 排序
      if (options.sortBy) {
        records = this.sortRecords(records, options.sortBy, options.sortOrder);
      }

      const ids = records.map((r) => r.id);

      const traitName = TRAIT_RULES[trait]?.name || trait;
      logger.debug(
        "TraitQueryService",
        `查询特征 "${traitName}": ${records.length} 条`,
      );

      const result: {
        ids: string[];
        records?: BookmarkRecord[];
        count: number;
      } = {
        ids,
        count: records.length,
      };

      if (options.includeFullRecord) {
        result.records = records;
      }

      return result;
    } catch (error) {
      logger.error("TraitQueryService", "查询特征异常", error);
      throw error;
    }
  }

  /**
   * 查询具有多个特征的书签（交集）
   *
   * 用于查询同时具有多个特征的书签，例如：
   * - 既是重复又是无效的书签
   * - 既是内部又是未访问的书签
   *
   * @param traits - 特征类型数组
   * @param options - 查询选项
   * @returns 同时具有所有特征的书签
   *
   * @example
   * ```typescript
   * // 查询既是重复又是无效的书签
   * const result = await queryByTraits(['duplicate', 'invalid'])
   * ```
   */
  async queryByTraits(
    traits: TraitTag[],
    options: TraitQueryOptions = {},
  ): Promise<TraitQueryResult> {
    if (traits.length === 0) {
      return { ids: [], count: 0 };
    }

    const firstTrait = traits[0];
    if (traits.length === 1 && firstTrait) {
      return this.queryByTrait(firstTrait, options);
    }

    // 查询每个特征的结果
    const results = await Promise.all(
      traits.map((trait) =>
        this.queryByTrait(trait, { includeFullRecord: true }),
      ),
    );

    // 计算交集
    const idSets = results.map((r) => new Set(r.ids));
    const intersection = idSets.reduce((acc, set) => {
      return new Set([...acc].filter((id) => set.has(id)));
    });

    const ids = Array.from(intersection);

    // 如果需要完整记录，从第一个结果中筛选
    if (options.includeFullRecord && results[0]?.records) {
      let records = results[0].records.filter((r) => intersection.has(r.id));

      if (options.sortBy) {
        records = this.sortRecords(records, options.sortBy, options.sortOrder);
      }

      return {
        ids,
        records,
        count: ids.length,
      };
    }

    return {
      ids,
      count: ids.length,
    };
  }

  /**
   * 获取书签的所有特征
   *
   * @param bookmarkId - 书签 ID
   * @returns 特征列表
   *
   * @example
   * ```typescript
   * const traits = await getBookmarkTraits('bookmark-123')
   * console.log(traits)  // ['duplicate', 'invalid']
   * ```
   */
  async getBookmarkTraits(bookmarkId: string): Promise<TraitTag[]> {
    const allBookmarks = await indexedDBManager.getAllBookmarks();
    const bookmark = allBookmarks.find((b) => b.id === bookmarkId);
    return (bookmark?.traitTags || []) as TraitTag[];
  }

  /**
   * 统计各特征的书签数量
   *
   * 用于生成统计报告，例如：
   * - Popup 页面的"需要关注"区块
   * - Management 页面的筛选器统计
   *
   * @returns 特征统计信息
   *
   * @example
   * ```typescript
   * const stats = await getTraitStatistics()
   * console.log(stats)  // { duplicate: 42, invalid: 15, internal: 8, outdated: 120, untagged: 35, untitled: 18 }
   * ```
   */
  async getTraitStatistics(): Promise<Record<TraitTag, number>> {
    const traits: TraitTag[] = [
      "duplicate",
      "invalid",
      "internal",
      "outdated",
      "untagged",
      "untitled",
    ];

    const counts = await Promise.all(
      traits.map(async (trait) => {
        const result = await this.queryByTrait(trait);
        return result.count;
      }),
    );

    return {
      duplicate: counts[0] ?? 0,
      invalid: counts[1] ?? 0,
      internal: counts[2] ?? 0,
      outdated: counts[3] ?? 0,
      untagged: counts[4] ?? 0,
      untitled: counts[5] ?? 0,
    };
  }

  /**
   * 排序书签记录
   *
   * @private
   */
  private sortRecords(
    records: BookmarkRecord[],
    sortBy: "dateAdded" | "title" | "url",
    sortOrder: "asc" | "desc" = "asc",
  ): BookmarkRecord[] {
    const sorted = [...records].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case "dateAdded":
          comparison = (a.dateAdded || 0) - (b.dateAdded || 0);
          break;
        case "title":
          comparison = a.title.localeCompare(b.title);
          break;
        case "url":
          comparison = (a.url || "").localeCompare(b.url || "");
          break;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

    return sorted;
  }

  // ==================== 扩展查询方法 ====================

  /**
   * 获取具有指定特征的书签（返回完整记录）
   *
   * ✅ 业务层直接调用，无需自己查询 IndexedDB
   *
   * @param trait - 特征类型
   * @param options - 查询选项
   * @returns 书签记录数组
   *
   * @example
   * ```typescript
   * // 获取所有无效书签
   * const invalidBookmarks = await getBookmarksByTrait('invalid')
   *
   * // 获取所有重复书签，按日期排序
   * const duplicates = await getBookmarksByTrait('duplicate', {
   *   sortBy: 'dateAdded',
   *   sortOrder: 'desc'
   * })
   * ```
   */
  async getBookmarksByTrait(
    trait: TraitTag,
    options?: Omit<TraitQueryOptions, "includeFullRecord">,
  ): Promise<BookmarkRecord[]> {
    const result = await this.queryByTrait(trait, {
      ...options,
      includeFullRecord: true,
    });
    return result.records || [];
  }

  /**
   * 获取具有多个特征的书签（交集，返回完整记录）
   *
   * @param traits - 特征类型数组
   * @param options - 查询选项
   * @returns 书签记录数组
   *
   * @example
   * ```typescript
   * // 获取既是重复又是无效的书签
   * const bookmarks = await getBookmarksByTraits(['duplicate', 'invalid'])
   * ```
   */
  async getBookmarksByTraits(
    traits: TraitTag[],
    options?: Omit<TraitQueryOptions, "includeFullRecord">,
  ): Promise<BookmarkRecord[]> {
    const result = await this.queryByTraits(traits, {
      ...options,
      includeFullRecord: true,
    });
    return result.records || [];
  }

  /**
   * 获取单个书签的完整信息（包含特征）
   *
   * @param bookmarkId - 书签 ID
   * @returns 书签记录，如果不存在则返回 null
   *
   * @example
   * ```typescript
   * const bookmark = await getBookmarkWithTraits('bookmark-123')
   * if (bookmark) {
   *   console.log(bookmark.traitTags)  // ['duplicate', 'invalid']
   * }
   * ```
   */
  async getBookmarkWithTraits(
    bookmarkId: string,
  ): Promise<BookmarkRecord | null> {
    const allBookmarks = await indexedDBManager.getAllBookmarks();
    return allBookmarks.find((b) => b.id === bookmarkId) || null;
  }

  /**
   * 批量获取书签的完整信息（包含特征）
   *
   * @param bookmarkIds - 书签 ID 数组
   * @returns 书签记录数组
   *
   * @example
   * ```typescript
   * const bookmarks = await getBatchBookmarksWithTraits(['id1', 'id2', 'id3'])
   * ```
   */
  async getBatchBookmarksWithTraits(
    bookmarkIds: string[],
  ): Promise<BookmarkRecord[]> {
    const allBookmarks = await indexedDBManager.getAllBookmarks();
    const idSet = new Set(bookmarkIds);
    return allBookmarks.filter((b) => idSet.has(b.id));
  }

  /**
   * 检查书签是否具有指定特征
   *
   * @param bookmarkId - 书签 ID
   * @param trait - 特征类型
   * @returns 是否具有该特征
   *
   * @example
   * ```typescript
   * const isInvalid = await hasBookmarkTrait('bookmark-123', 'invalid')
   * if (isInvalid) {
   *   console.log('这是一个无效书签')
   * }
   * ```
   */
  async hasBookmarkTrait(
    bookmarkId: string,
    trait: TraitTag,
  ): Promise<boolean> {
    const traits = await this.getBookmarkTraits(bookmarkId);
    return traits.includes(trait);
  }

  /**
   * 获取所有负面特征的书签（需要用户关注的）
   *
   * @param options - 查询选项
   * @returns 书签记录数组
   *
   * @example
   * ```typescript
   * // 获取所有需要关注的书签（重复、无效）
   * const problemBookmarks = await getNegativeTraitBookmarks()
   * ```
   */
  async getNegativeTraitBookmarks(
    options?: Omit<TraitQueryOptions, "includeFullRecord">,
  ): Promise<BookmarkRecord[]> {
    const allBookmarks = await indexedDBManager.getAllBookmarks();

    // 筛选具有负面特征的书签
    let records = allBookmarks.filter((record) => {
      if (!record.traitTags || record.traitTags.length === 0) return false;

      // 检查是否有负面特征
      return record.traitTags.some((tag) => {
        const metadata = TRAIT_RULES[tag as TraitTag];
        return metadata && metadata.isNegative;
      });
    });

    // 排序
    if (options?.sortBy) {
      records = this.sortRecords(records, options.sortBy, options.sortOrder);
    }

    return records;
  }

  /**
   * 获取特征详细统计（包含书签列表）
   *
   * @returns 特征详细统计
   *
   * @example
   * ```typescript
   * const stats = await getDetailedTraitStatistics()
   * console.log(stats.duplicate.count)      // 42
   * console.log(stats.duplicate.bookmarks)  // [...]
   * ```
   */
  async getDetailedTraitStatistics(): Promise<
    Record<
      TraitTag,
      {
        count: number;
        bookmarks: BookmarkRecord[];
      }
    >
  > {
    const traits: TraitTag[] = [
      "duplicate",
      "invalid",
      "internal",
      "outdated",
      "untagged",
      "untitled",
    ];

    const results = await Promise.all(
      traits.map(async (trait) => {
        const bookmarks = await this.getBookmarksByTrait(trait);
        return {
          trait,
          count: bookmarks.length,
          bookmarks,
        };
      }),
    );

    return {
      duplicate: results[0] ?? { count: 0, bookmarks: [] },
      invalid: results[1] ?? { count: 0, bookmarks: [] },
      internal: results[2] ?? { count: 0, bookmarks: [] },
      outdated: results[3] ?? { count: 0, bookmarks: [] },
      untagged: results[4] ?? { count: 0, bookmarks: [] },
      untitled: results[5] ?? { count: 0, bookmarks: [] },
    };
  }
}

export const bookmarkTraitQueryService = new BookmarkTraitQueryService();
