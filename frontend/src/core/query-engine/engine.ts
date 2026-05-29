/**
 * 核心查询引擎
 *
 * 设计：
 * - 通过策略接口 `SearchStrategy` 解耦具体实现；
 * - 统一处理输入规范（trim/空串），保持上层调用简洁；
 * - 与数据来源无关，仅接收 BookmarkRecord 列表进行检索。
 */
import type {
  BookmarkRecord,
  SearchResult,
} from "@/infrastructure/indexeddb/manager";

/**
 * 查询策略接口
 *
 * 定义查询算法的标准契约，允许灵活切换不同的查询实现
 */
export interface SearchStrategy {
  /**
   * 执行查询操作
   *
   * @param query - 查询字符串
   * @param bookmarks - 待查询的书签记录列表
   * @returns 匹配的查询结果数组，按相关性排序
   */
  search(query: string, bookmarks: BookmarkRecord[]): SearchResult[];
}

/**
 * 查询引擎类
 *
 * 使用策略模式实现可插拔的查询算法，支持多种查询策略
 */
export class SearchEngine {
  /**
   * 构造函数
   *
   * @param strategy - 具体的查询策略实现
   */
  constructor(private strategy: SearchStrategy) {}

  /**
   * 执行查询
   *
   * @param query - 查询字符串
   * @param bookmarks - 待查询的书签记录列表
   * @returns 匹配的查询结果数组，如果查询为空则返回空数组
   */
  search(query: string, bookmarks: BookmarkRecord[]): SearchResult[] {
    const q = String(query || "").trim();
    if (!q) return [];
    return this.strategy.search(q, bookmarks);
  }
}
