/**
 * 书签特征相关类型定义
 *
 * 特征是对书签的客观描述，不带价值判断
 */

export type {
  TraitTag,
  TraitMetadata,
  TraitMetadataSource,
} from "@/infrastructure/indexeddb/types/bookmark-record";

/**
 * 特征筛选选项
 */
export interface TraitFilterOptions {
  /** 是否返回完整的书签对象（默认只返回 ID） */
  includeFullRecord?: boolean;
  /** 排序字段 */
  sortBy?: "dateAdded" | "title" | "url";
  /** 排序方向 */
  sortOrder?: "asc" | "desc";
}

/**
 * 特征筛选结果
 */
export interface TraitFilterResult {
  /** 书签 ID 列表 */
  ids: string[];
  /** 完整书签记录（如果请求） */
  records?: Array<{
    id: string;
    title: string;
    url?: string;
    traitTags?: string[];
    traitMetadata?: Array<{
      tag: string;
      detectedAt: number;
      source: string;
      notes?: string;
    }>;
  }>;
  /** 结果数量 */
  count: number;
}

/**
 * 特征统计信息
 */
export interface TraitStatistics {
  duplicate: number;
  invalid: number;
  internal: number;
  total: number;
}
