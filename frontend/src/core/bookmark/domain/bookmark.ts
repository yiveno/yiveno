import type { BookmarkNode } from "@/types/domain/bookmark";

export type { BookmarkNode };

export type BookmarkFolder = BookmarkNode & {
  url: undefined;
  children: BookmarkNode[];
  childrenCount: number;
};

export type BookmarkItem = BookmarkNode & {
  url: string;
  children: undefined;
  childrenCount: undefined;
};

export type BookmarkType = "folder" | "bookmark";

export function isBookmarkFolder(node: BookmarkNode): node is BookmarkFolder {
  return !node.url && Array.isArray(node.children);
}

export function isBookmarkItem(node: BookmarkNode): node is BookmarkItem {
  return typeof node.url === "string";
}

export function getBookmarkType(node: BookmarkNode): BookmarkType {
  return isBookmarkFolder(node) ? "folder" : "bookmark";
}

/**
 * 书签操作类型
 */
export type BookmarkOperation =
  | "create"
  | "update"
  | "delete"
  | "move"
  | "reorder";

/**
 * 书签变更事件
 */
export interface BookmarkChangeEvent {
  type: BookmarkOperation;
  node: BookmarkNode;
  oldParentId?: string;
  newParentId?: string;
  oldIndex?: number;
  newIndex?: number;
  timestamp: number;
}

/**
 * 书签筛选选项
 */
export interface BookmarkSearchOptions {
  query: string;
  includeFolders?: boolean;
  includeUrls?: boolean;
  caseSensitive?: boolean;
  maxResults?: number;
}

/**
 * 书签筛选结果
 */
export interface BookmarkSearchResult {
  node: BookmarkNode;
  score: number;
  matchedFields: string[];
  path: string[];
}
