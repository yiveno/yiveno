/**
 * 书签转换器 - 核心业务逻辑
 *
 * 职责：
 * - 在不同数据源之间进行书签结构转换
 * - 统一书签数据格式
 * - 处理树形结构的构建和扁平化
 */

import type { BookmarkNode } from "../domain/bookmark";

/**
 * 最小树节点形状（用于结构化转换）
 * 避免对具体数据源的强绑定
 */
export interface MinimalTreeNode {
  id: string;
  title: string;
  url?: string | undefined;
  children?: MinimalTreeNode[] | undefined;
  parentId?: string | undefined;
  index?: number | undefined;
  dateAdded?: number | undefined;
}

/**
 * IndexedDB 记录接口（临时定义，后续会从 schema 导入）
 */
interface BookmarkRecord {
  id: string | number;
  title: string;
  url?: string | undefined;
  parentId?: string | number | undefined;
  index?: number | undefined;
  dateAdded?: number | undefined;
  pathIds?: Array<string | number> | undefined;
  ancestorIds?: Array<string | number> | undefined;
  depth?: number | undefined;
  domain?: string | undefined;
  titleLower?: string | undefined;
  urlLower?: string | undefined;
  childrenCount?: number | undefined;
}

/**
 * 书签转换器
 *
 * 提供各种数据格式与 BookmarkNode 之间的转换方法
 */
export class BookmarkConverter {
  /**
   * 将任意最小树节点数组转换为 BookmarkNode[]
   *
   * 保持约定：
   * - 叶子节点带 url
   * - 文件夹 children 至少为空数组
   *
   * @param nodes - 最小树节点数组
   * @returns 标准化的 BookmarkNode 数组
   */
  static listToBookmarkNodes<T extends MinimalTreeNode>(
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
   * 从 Chrome 书签树转换为标准 BookmarkNode
   *
   * 接受最小节点形状，避免对 chrome.bookmarks.* API 的强绑定
   *
   * @param nodes - Chrome 书签树节点数组
   * @returns 标准化的 BookmarkNode 数组
   */
  static chromeToBookmarkNodes(nodes: MinimalTreeNode[]): BookmarkNode[] {
    return this.listToBookmarkNodes(nodes);
  }

  /**
   * 从提案草稿树转换为标准 BookmarkNode
   *
   * 结构相同：id/title/url/children
   *
   * @param nodes - 提案草稿树节点数组
   * @returns 标准化的 BookmarkNode 数组
   */
  static proposalsToBookmarkNodes(nodes: MinimalTreeNode[]): BookmarkNode[] {
    return this.listToBookmarkNodes(nodes);
  }

  /**
   * 从 IndexedDB 的扁平记录构建 BookmarkNode 树
   *
   * 对扁平结构进行合并与重建，生成可视化的树形结构
   *
   * @param records - IndexedDB 书签记录数组
   * @returns 重建后的 BookmarkNode 树
   */
  static recordsToBookmarkNodes(records: BookmarkRecord[]): BookmarkNode[] {
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
          if (!parent.children.some((c) => String(c.id) === id)) {
            parent.children.push(node);
          }
        }
      } else {
        if (id !== "0" && !roots.some((r) => r.id === id)) {
          roots.push(node);
        }
      }
    }

    // 排序（若存在 index）
    const getIndex = (id: string) => {
      const raw = unique.get(id);
      return raw && typeof raw.index === "number" ? raw.index : 0;
    };

    const sortChildren = (nodes: BookmarkNode[]) => {
      nodes.sort((a, b) => getIndex(a.id) - getIndex(b.id));
      for (const n of nodes) {
        if (n.children?.length) {
          sortChildren(n.children);
        }
      }
    };

    sortChildren(roots);
    return roots;
  }

  /**
   * 将 BookmarkNode 树扁平化为记录数组
   *
   * 递归遍历树形结构，转换为适合 IndexedDB 存储的扁平记录
   *
   * @param nodes - BookmarkNode 树节点数组
   * @param parentId - 父节点ID（递归时使用）
   * @returns 扁平化的书签记录数组
   */
  static bookmarkNodesToRecords(
    nodes: BookmarkNode[],
    parentId?: string,
  ): BookmarkRecord[] {
    const records: BookmarkRecord[] = [];

    for (const node of nodes) {
      const record: BookmarkRecord = {
        id: node.id,
        title: node.title,
        url: node.url,
        parentId: parentId,
        index: node.index,
        dateAdded: node.dateAdded,
        childrenCount: node.children?.length || 0,
      };

      records.push(record);

      // 递归处理子节点
      if (node.children && node.children.length > 0) {
        const childRecords = this.bookmarkNodesToRecords(
          node.children,
          node.id,
        );
        records.push(...childRecords);
      }
    }

    return records;
  }

  /**
   * 验证书签节点数据完整性
   *
   * 检查节点是否符合业务规则：
   * - 必须有 ID 和标题
   * - 书签必须有 URL，文件夹必须有 children
   * - 不能同时有 URL 和 children
   *
   * @param node - 待验证的书签节点
   * @returns 包含验证结果和错误列表的对象
   */
  static validateBookmarkNode(node: BookmarkNode): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!node.id) {
      errors.push("缺少节点ID");
    }

    if (!node.title || node.title.trim() === "") {
      errors.push("缺少节点标题");
    }

    // 书签必须有URL
    if (!node.url && !node.children) {
      errors.push("书签节点必须包含URL或子节点");
    }

    // 文件夹不能有URL
    if (node.url && node.children) {
      errors.push("文件夹节点不能同时包含URL和子节点");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * 清理和标准化书签数据
   *
   * 对节点数据进行清理：
   * - 去除字符串首尾空格
   * - 标准化 ID 格式
   * - 递归处理子节点
   *
   * @param node - 待清理的书签节点
   * @returns 清理后的书签节点
   */
  static sanitizeBookmarkNode(node: BookmarkNode): BookmarkNode {
    const trimmedUrl = node.url?.trim();
    const result: BookmarkNode = {
      ...node,
      id: String(node.id).trim(),
      title: node.title?.trim() || "",
      children: node.children?.map((child) => this.sanitizeBookmarkNode(child)),
    };

    if (trimmedUrl) {
      result.url = trimmedUrl;
    }

    return result;
  }
}
