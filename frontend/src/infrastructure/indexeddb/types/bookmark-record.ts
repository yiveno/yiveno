/**
 * BookmarkRecord 类型定义
 *
 * Type-First 方法：优先定义 TypeScript 类型，然后创建对应的 Zod schema
 * 优势：
 * 1. 类型推断更准确，避免 z.infer 的复杂性
 * 2. 类型定义和运行时验证分离，职责清晰
 * 3. 更容易维护和理解
 */

// ==================== 导入统一的特征类型 ====================

export type { TraitTag } from "@/core/bookmark/trait-rules";

// ==================== 辅助类型 ====================

export type TraitMetadataSource = "worker" | "user" | "imported";

export type InvalidReason =
  | "url_format"
  | "http_error"
  | "network_error"
  | "timeout"
  | "unknown";

export type MetadataSource = "chrome" | "merged";

export interface TraitMetadata {
  tag: string; // 使用 string 而不是 TraitTag，避免循环依赖
  detectedAt: number;
  source: TraitMetadataSource;
  notes?: string | undefined;
}

// ==================== 核心类型 ====================

/**
 * 书签记录 - 明确的类型定义
 *
 * 必需字段：数据完整性的核心字段
 * 可选字段：扩展功能字段，向后兼容
 */
export interface BookmarkRecord {
  // ===== 必需字段 (Core Fields) =====
  id: string;
  title: string;
  index: number;
  path: string[];
  pathString: string;
  pathIds: string[];
  pathIdsString: string;
  ancestorIds: string[];
  siblingIds: string[];
  depth: number;
  titleLower: string;
  keywords: string[];
  isFolder: boolean;
  childrenCount: number;
  tags: string[];
  traitTags: string[];
  createdYear: number;
  createdMonth: number;
  dataVersion: number;
  lastCalculated: number;

  // ===== 可选字段 (Optional Fields) =====
  // Chrome 原生字段
  parentId?: string | undefined;
  url?: string | undefined;
  dateAdded?: number | undefined;
  dateGroupModified?: number | undefined;

  // 派生字段
  urlLower?: string | undefined;
  domain?: string | undefined;
  domainCategory?: string | undefined;

  // 特征字段
  traitMetadata?: TraitMetadata[] | undefined;
  isInvalid?: boolean | undefined;
  invalidReason?: InvalidReason | undefined;
  httpStatus?: number | undefined;
  isDuplicate?: boolean | undefined;
  duplicateOf?: string | undefined;

  // 用户数据
  category?: string | undefined;
  notes?: string | undefined;
  description?: string | undefined; // AI 生成的文件夹描述
  lastVisited?: number | undefined;
  visitCount?: number | undefined;

  // 收藏功能
  isFavorite?: boolean | undefined;
  favoriteOrder?: number | undefined;
  favoritedAt?: number | undefined;

  // 元数据增强
  hasMetadata?: boolean | undefined;
  metadataUpdatedAt?: number | undefined;
  metadataSource?: MetadataSource | undefined;
  metaTitleLower?: string | undefined;
  metaDescriptionLower?: string | undefined;
  metaKeywordsTokens?: string[] | undefined;
  metaBoost?: number | undefined;

  // 虚拟化支持
  flatIndex?: number | undefined;
  isVisible?: boolean | undefined;
  sortKey?: string | undefined;
}
