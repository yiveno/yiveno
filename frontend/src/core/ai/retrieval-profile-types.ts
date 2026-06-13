/**
 * 书签 LLM 检索 Profile 类型（Core 层）
 */

/** 单条书签检索 Profile */
export interface BookmarkRetrievalProfile {
  /** 书签 ID */
  bookmarkId: string
  /** 面向检索的简短描述（非 UI 摘要） */
  profile: string
  /** 口语/同义检索词 */
  keywords: string[]
}

/** LLM 批处理输入 */
export interface RetrievalProfileBookmarkInput {
  id: string
  title: string
  url: string
}

/** 检索 Profile 内容版本（变更 prompt 结构时递增） */
export const RETRIEVAL_PROFILE_CONTENT_VERSION = 1
