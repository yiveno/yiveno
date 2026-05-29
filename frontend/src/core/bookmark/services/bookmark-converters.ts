/**
 * 书签结构转换工具（Bookmark Converters）
 *
 * 职责：
 * - 在不同来源（Chrome 树、提案草稿、IndexedDB 扁平记录）之间进行结构化转换
 * - 输出统一的 `BookmarkNode[]`，便于 UI 与筛选使用
 *
 * 设计与约束：
 * - 采用最小树节点形状 MinimalTreeNode，避免对具体数据源强绑定
 * - 不持久化、不变更业务逻辑，仅做纯转换
 * - 保持叶子节点包含 `url`，文件夹 `children` 至少为空数组的约定
 */
import type { BookmarkNode } from "@/types";
import type { BookmarkRecord } from "@/infrastructure/indexeddb/schema";

/**
 * 最小树节点接口
 *
 * 定义树形结构转换的最小字段集，避免强绑定具体来源
 */
export interface MinimalTreeNode {
  /** 节点唯一标识 */
  id: string;
  /** 节点标题 */
  title: string;
  /** 书签URL（文件夹为空） */
  url?: string | undefined;
  /** 子节点（文件夹使用） */
  children?: MinimalTreeNode[] | undefined;
  /** 父节点ID */
  parentId?: string | undefined;
  /** 位置索引 */
  index?: number | undefined;
  /** 创建时间 */
  dateAdded?: number | undefined;
}

/**
 * 将任意最小树节点数组转换为 BookmarkNode 数组
 *
 * 递归转换，保持约定：
 * - 叶子节点（书签）带 url，children 为 undefined
 * - 文件夹节点 children 至少为空数组
 *
 * @param nodes - 最小树节点数组
 * @returns 标准化的 BookmarkNode 数组
 */
export function listToBookmarkNodes<T extends MinimalTreeNode>(
  nodes: T[],
): BookmarkNode[] {
  const mapNode = (n: MinimalTreeNode): BookmarkNode => {
    const node: BookmarkNode = {
      id: String(n.id),
      title: n.title,
    };

    if (n.url !== undefined) {
      node.url = n.url;
    }

    if (n.parentId !== undefined) {
      node.parentId = n.parentId;
    }

    if (n.dateAdded !== undefined) {
      node.dateAdded = n.dateAdded;
    }

    if (typeof n.index === "number") {
      node.index = n.index;
    }

    if (n.children?.length) {
      node.children = n.children.map(mapNode);
    } else if (!n.url) {
      node.children = [];
    }

    return node;
  };
  return Array.isArray(nodes) ? nodes.map(mapNode) : [];
}

/**
 * 从 Chrome 书签树转换为 BookmarkNode
 *
 * 接受最小节点形状，避免对 chrome.bookmarks.* API 的强绑定
 *
 * @param nodes - Chrome 书签树节点数组
 * @returns 标准化的 BookmarkNode 数组
 */
export function chromeToBookmarkNodes(
  nodes: MinimalTreeNode[],
): BookmarkNode[] {
  return listToBookmarkNodes(nodes);
}

/**
 * 从提案草稿树转换为 BookmarkNode
 *
 * 结构相同：id/title/url/children
 *
 * @param nodes - 提案草稿节点数组
 * @returns 标准化的 BookmarkNode 数组
 */
export function proposalsToBookmarkNodes(
  nodes: MinimalTreeNode[],
): BookmarkNode[] {
  return listToBookmarkNodes(nodes);
}

/**
 * 从 IndexedDB 扁平记录构建 BookmarkNode 树
 *
 * 对扁平结构（含 parentId/index 等）进行合并与重建，生成可视化树
 *
 * @param records - IndexedDB 书签记录数组
 * @returns 重建后的 BookmarkNode 树
 */
export function recordsToBookmarkNodes(
  records: BookmarkRecord[],
): BookmarkNode[] {
  if (!Array.isArray(records) || records.length === 0) return [];

  // 去重后构建节点映射
  const unique = new Map<string, BookmarkRecord>();
  for (const r of records) unique.set(String(r.id), r);
  const items = Array.from(unique.values());

  const nodeMap = new Map<string, BookmarkNode>();
  for (const it of items) {
    nodeMap.set(String(it.id), {
      id: String(it.id),
      title: it.title,
      url: it.url,
      children: it.url ? undefined : [],
      pathIds: it.pathIds,
      ancestorIds: it.ancestorIds,
      depth: it.depth,
      domain: it.domain,
      titleLower: it.titleLower,
      urlLower: it.urlLower,
      childrenCount: it.childrenCount,
    } as BookmarkNode);
  }

  const roots: BookmarkNode[] = [];
  for (const it of items) {
    const id = String(it.id);
    const parentId = it.parentId ? String(it.parentId) : undefined;
    const node = nodeMap.get(id)!;
    if (parentId && nodeMap.has(parentId) && parentId !== "0") {
      const parent = nodeMap.get(parentId)!;
      if (parent.children) {
        if (!parent.children.some((c) => String(c.id) === id))
          parent.children.push(node);
      }
    } else {
      if (id !== "0" && !roots.some((r) => r.id === id)) roots.push(node);
    }
  }

  // 排序（若存在 index）
  const getIndex = (id: string) => {
    const raw = unique.get(id);
    return raw && typeof raw.index === "number" ? raw.index : 0;
  };
  const sortChildren = (nodes: BookmarkNode[]) => {
    nodes.sort((a, b) => getIndex(a.id) - getIndex(b.id));
    for (const n of nodes) if (n.children?.length) sortChildren(n.children);
  };
  sortChildren(roots);

  return roots;
}
