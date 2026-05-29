/**
 * 书签仓储层
 *
 * 职责：
 * - 提供书签数据的访问接口，隔离核心业务与基础设施层
 * - 统一错误处理，将所有结果封装为 Result<T> 类型
 * - 管理 IndexedDB 的初始化和数据操作
 */

import type { Result } from "@/core/common/result";
import { ok as Ok, err as Err } from "@/core/common/result";
import type { ILogger } from "@/core/common/logger";
import { noopLogger } from "@/core/common/logger";
import {
  indexedDBManager,
  type BookmarkRecord,
} from "@/infrastructure/indexeddb/manager";

/**
 * 书签仓储类
 *
 * 负责书签数据的持久化操作，是核心层与基础设施层的桥梁
 */
export class BookmarkRepository {
  private logger: ILogger;

  /**
   * 构造函数
   *
   * @param logger - Logger 实例，默认使用 noopLogger
   */
  constructor(logger?: ILogger) {
    this.logger = logger || noopLogger;
  }
  /**
   * 获取所有书签记录
   *
   * @param limit - 可选的返回数量限制
   * @param offset - 可选的偏移量（用于分页）
   * @returns 包含书签记录数组的 Result 对象
   */
  async getAllBookmarks(
    limit?: number,
    offset?: number,
  ): Promise<Result<BookmarkRecord[]>> {
    try {
      await indexedDBManager.initialize();
      const data = await indexedDBManager.getAllBookmarks(limit, offset);
      return Ok(data);
    } catch (e: unknown) {
      this.logger.error("BookmarkRepository", "getAllBookmarks failed", e);
      return Err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  /**
   * 根据ID获取单个书签记录
   *
   * @param id - 书签的唯一标识符
   * @returns 包含书签记录的 Result 对象，如果不存在则返回 null
   */
  async getBookmarkById(id: string): Promise<Result<BookmarkRecord | null>> {
    try {
      await indexedDBManager.initialize();
      const data = await indexedDBManager.getBookmarkById(id);
      return Ok(data);
    } catch (e: unknown) {
      this.logger.error("BookmarkRepository", "getBookmarkById failed", e);
      return Err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  /**
   * 根据父节点ID获取子节点列表
   *
   * @param parentId - 父节点的唯一标识符
   * @param offset - 可选的偏移量，默认为 0
   * @param limit - 可选的返回数量限制
   * @returns 包含子节点记录数组的 Result 对象
   */
  async getChildrenByParentId(
    parentId: string,
    offset?: number,
    limit?: number,
  ): Promise<Result<BookmarkRecord[]>> {
    try {
      await indexedDBManager.initialize();
      const data = await indexedDBManager.getChildrenByParentId(
        parentId,
        offset ?? 0,
        limit,
      );
      return Ok(data);
    } catch (e: unknown) {
      this.logger.error(
        "BookmarkRepository",
        "getChildrenByParentId failed",
        e,
      );
      return Err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  /**
   * 获取全局统计数据
   *
   * @returns 包含全局统计信息的 Result 对象
   */
  async getGlobalStats(): Promise<Result<unknown>> {
    try {
      await indexedDBManager.initialize();
      const data = await indexedDBManager.getGlobalStats();
      return Ok(data);
    } catch (e: unknown) {
      this.logger.error("BookmarkRepository", "getGlobalStats failed", e);
      return Err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  /**
   * 更新书签（部分更新）
   *
   * @param id - 书签的唯一标识符
   * @param updates - 要更新的字段（部分 BookmarkRecord）
   * @returns 包含 void 的 Result 对象
   */
  async updateBookmark(
    id: string,
    updates: Partial<BookmarkRecord>,
  ): Promise<Result<void>> {
    try {
      await indexedDBManager.initialize();

      // 1. 获取完整的书签记录
      const existingBookmark = await indexedDBManager.getBookmarkById(id);
      if (!existingBookmark) {
        this.logger.error(
          "BookmarkRepository",
          "updateBookmark: 书签不存在",
          id,
        );
        return Err(new Error(`书签不存在: ${id}`));
      }

      // 2. 合并更新字段
      const updatedBookmark: BookmarkRecord = {
        ...existingBookmark,
        ...updates,
        id: existingBookmark.id, // 确保 id 不被覆盖
      };

      // 3. 调用 IndexedDBManager 更新
      await indexedDBManager.updateBookmark(updatedBookmark);

      this.logger.debug("BookmarkRepository", "updateBookmark 成功", {
        id,
        updates,
      });
      return Ok(undefined);
    } catch (e: unknown) {
      this.logger.error("BookmarkRepository", "updateBookmark failed", e);
      return Err(e instanceof Error ? e : new Error(String(e)));
    }
  }
}

/**
 * 书签仓储单例实例
 *
 * 全局共享的仓储实例，避免重复创建
 * 注意：默认使用 noopLogger，如需日志功能，请通过应用层注入 logger
 */
export const bookmarkRepository = new BookmarkRepository();
