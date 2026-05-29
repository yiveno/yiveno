/**
 * BookmarkAPIGateway 单元测试
 *
 * 测试目标：infrastructure/chrome-api/bookmark-gateway.ts
 *
 * 测试范围：
 * - 书签树构建
 * - 书签节点增强
 * - 使用频率评分
 * - 文件夹类型识别
 * - 推荐系统
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { BookmarkAPIGateway } from "@/infrastructure/chrome-api/bookmark-gateway";
import type { EnhancedBookmarkNode } from "@/infrastructure/chrome-api/bookmark-gateway";
import { indexedDBManager } from "@/infrastructure/indexeddb/manager";
import type { BookmarkRecord } from "@/infrastructure/indexeddb/types";

// Mock IndexedDB Manager
vi.mock("@/infrastructure/indexeddb/manager", () => ({
  indexedDBManager: {
    initialize: vi.fn().mockResolvedValue(undefined),
    getAllBookmarks: vi.fn().mockResolvedValue([]),
  },
}));

describe("BookmarkAPIGateway", () => {
  let gateway: BookmarkAPIGateway;

  beforeEach(() => {
    vi.clearAllMocks();
    // 重置单例以避免测试间污染
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (BookmarkAPIGateway as any)["instance"] = undefined;
    gateway = BookmarkAPIGateway.getInstance();

    // 默认 Mock：initialize 成功
    vi.mocked(indexedDBManager.initialize).mockResolvedValue();
  });

  describe("单例模式", () => {
    it("应该返回同一个实例", () => {
      const instance1 = BookmarkAPIGateway.getInstance();
      const instance2 = BookmarkAPIGateway.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe("书签树构建", () => {
    it("应该能够从扁平数据构建树结构", async () => {
      const flatBookmarks: Array<Partial<BookmarkRecord>> = [
        {
          id: "1",
          parentId: "0", // Chrome 根节点的 parentId 是 '0'
          title: "Bookmarks Bar",
          dateAdded: Date.now(),
          index: 0,
        },
        {
          id: "2",
          parentId: "1",
          title: "Vue.js",
          url: "https://vuejs.org",
          dateAdded: Date.now(),
          index: 0,
        },
      ];

      vi.mocked(indexedDBManager.getAllBookmarks).mockResolvedValue(
        flatBookmarks as BookmarkRecord[],
      );

      const tree = await gateway.getEnhancedBookmarkTree();

      expect(tree).toHaveLength(1);
      expect(tree[0]).toBeDefined();
      const root = tree[0]!;
      expect(root.id).toBe("1");
      expect(root.children).toHaveLength(1);
      expect(root.children?.[0]).toBeDefined();
      expect(root.children?.[0]!.id).toBe("2");
    });

    it("应该处理孤立节点（父节点不存在）", async () => {
      const flatBookmarks: Array<Partial<BookmarkRecord>> = [
        {
          id: "1",
          parentId: "non-existent",
          title: "Orphan Bookmark",
          url: "https://example.com",
          dateAdded: Date.now(),
          index: 0,
        },
      ];

      vi.mocked(indexedDBManager.getAllBookmarks).mockResolvedValue(
        flatBookmarks as BookmarkRecord[],
      );

      const tree = await gateway.getEnhancedBookmarkTree();

      // 孤立节点应该被作为根节点
      expect(tree).toHaveLength(1);
      expect(tree[0]).toBeDefined();
      expect(tree[0]!.id).toBe("1");
    });

    it("应该正确处理多层嵌套", async () => {
      const flatBookmarks: Array<Partial<BookmarkRecord>> = [
        {
          id: "1",
          parentId: "0",
          title: "Level 1",
          dateAdded: Date.now(),
          index: 0,
        },
        {
          id: "2",
          parentId: "1",
          title: "Level 2",
          dateAdded: Date.now(),
          index: 0,
        },
        {
          id: "3",
          parentId: "2",
          title: "Level 3",
          dateAdded: Date.now(),
          index: 0,
        },
        {
          id: "4",
          parentId: "3",
          title: "Level 4",
          url: "https://example.com",
          dateAdded: Date.now(),
          index: 0,
        },
      ];

      vi.mocked(indexedDBManager.getAllBookmarks).mockResolvedValue(
        flatBookmarks as BookmarkRecord[],
      );

      const tree = await gateway.getEnhancedBookmarkTree();

      // 验证嵌套结构存在
      expect(tree).toHaveLength(1);
      expect(tree[0]).toBeDefined();
      expect(tree[0]!.id).toBe("1");
      expect(tree[0]!.children).toBeDefined();

      // 验证深层嵌套
      const level1 = tree[0]!;
      expect(level1.children?.[0]).toBeDefined();
      expect(level1.children?.[0]!.id).toBe("2");

      const level2 = level1.children?.[0];
      expect(level2).toBeDefined();
      expect(level2?.children?.[0]).toBeDefined();
      expect(level2?.children?.[0]!.id).toBe("3");

      const level3 = level2?.children?.[0];
      expect(level3).toBeDefined();
      expect(level3?.children?.[0]).toBeDefined();
      expect(level3?.children?.[0]!.id).toBe("4");
    });
  });

  describe("书签节点增强", () => {
    it("应该为书签节点添加域名", async () => {
      const flatBookmarks: Array<Partial<BookmarkRecord>> = [
        {
          id: "1",
          parentId: "0",
          title: "Vue.js",
          url: "https://vuejs.org/guide",
          dateAdded: Date.now(),
          index: 0,
        },
      ];

      vi.mocked(indexedDBManager.getAllBookmarks).mockResolvedValue(
        flatBookmarks as BookmarkRecord[],
      );

      const tree = await gateway.getEnhancedBookmarkTree();
      const bookmark = tree[0] as EnhancedBookmarkNode;

      expect(bookmark.domain).toBe("vuejs.org");
    });

    it("应该为书签节点计算使用评分", async () => {
      const flatBookmarks: Array<Partial<BookmarkRecord>> = [
        {
          id: "1",
          parentId: "0",
          title: "Vue.js",
          url: "https://vuejs.org",
          dateAdded: Date.now(),
          index: 0,
        },
      ];

      vi.mocked(indexedDBManager.getAllBookmarks).mockResolvedValue(
        flatBookmarks as BookmarkRecord[],
      );

      const tree = await gateway.getEnhancedBookmarkTree();
      const bookmark = tree[0] as EnhancedBookmarkNode;

      expect(bookmark.usageScore).toBeDefined();
      expect(typeof bookmark.usageScore).toBe("number");
    });

    it("文件夹节点不应该有域名", async () => {
      const flatBookmarks: Array<Partial<BookmarkRecord>> = [
        {
          id: "1",
          parentId: "0",
          title: "My Folder",
          dateAdded: Date.now(),
          index: 0,
        },
      ];

      vi.mocked(indexedDBManager.getAllBookmarks).mockResolvedValue(
        flatBookmarks as BookmarkRecord[],
      );

      const tree = await gateway.getEnhancedBookmarkTree();
      const folder = tree[0] as EnhancedBookmarkNode;

      expect(folder.domain).toBeUndefined();
    });

    it("应该识别文件夹类型", async () => {
      const flatBookmarks: Array<Partial<BookmarkRecord>> = [
        {
          id: "1",
          parentId: "0",
          title: "Bookmarks Bar",
          dateAdded: Date.now(),
          index: 0,
        },
        {
          id: "2",
          parentId: "0",
          title: "Other Bookmarks",
          dateAdded: Date.now(),
          index: 1,
        },
        {
          id: "3",
          parentId: "0",
          title: "Mobile Bookmarks",
          dateAdded: Date.now(),
          index: 2,
        },
      ];

      vi.mocked(indexedDBManager.getAllBookmarks).mockResolvedValue(
        flatBookmarks as BookmarkRecord[],
      );

      const tree = await gateway.getEnhancedBookmarkTree();

      expect((tree[0] as EnhancedBookmarkNode).folderType).toBe(
        "bookmarks-bar",
      );
      expect((tree[1] as EnhancedBookmarkNode).folderType).toBe("other");
      expect((tree[2] as EnhancedBookmarkNode).folderType).toBe("mobile");
    });
  });

  describe("使用频率评分", () => {
    it("最近创建的书签应该有更高的分数", async () => {
      const now = Date.now();
      const recentBookmark: Partial<BookmarkRecord> = {
        id: "1",
        parentId: "0",
        title: "Recent",
        url: "https://recent.com",
        dateAdded: now - 1000 * 60 * 60 * 24, // 1 天前
        index: 0,
      };
      const oldBookmark: Partial<BookmarkRecord> = {
        id: "2",
        parentId: "0",
        title: "Old",
        url: "https://old.com",
        dateAdded: now - 1000 * 60 * 60 * 24 * 365, // 1 年前
        index: 1,
      };

      vi.mocked(indexedDBManager.getAllBookmarks).mockResolvedValue([
        recentBookmark,
        oldBookmark,
      ] as BookmarkRecord[]);

      const tree = await gateway.getEnhancedBookmarkTree();

      const recentScore = (tree[0] as EnhancedBookmarkNode).usageScore || 0;
      const oldScore = (tree[1] as EnhancedBookmarkNode).usageScore || 0;

      expect(recentScore).toBeGreaterThan(oldScore);
    });

    it("文件夹的使用评分应该为 0", async () => {
      const flatBookmarks: Array<Partial<BookmarkRecord>> = [
        {
          id: "1",
          parentId: "0",
          title: "My Folder",
          dateAdded: Date.now(),
          index: 0,
        },
      ];

      vi.mocked(indexedDBManager.getAllBookmarks).mockResolvedValue(
        flatBookmarks as BookmarkRecord[],
      );

      const tree = await gateway.getEnhancedBookmarkTree();
      const folder = tree[0] as EnhancedBookmarkNode;

      expect(folder.usageScore).toBe(0);
    });
  });

  describe("获取最近书签", () => {
    it("应该返回最近添加的书签", async () => {
      const now = Date.now();
      const bookmarks: Array<Partial<BookmarkRecord>> = [
        {
          id: "1",
          parentId: "0",
          title: "Bookmark 1",
          url: "https://example1.com",
          dateAdded: now - 1000,
          index: 0,
        },
        {
          id: "2",
          parentId: "0",
          title: "Bookmark 2",
          url: "https://example2.com",
          dateAdded: now - 2000,
          index: 1,
        },
        {
          id: "3",
          parentId: "0",
          title: "Bookmark 3",
          url: "https://example3.com",
          dateAdded: now - 3000,
          index: 2,
        },
      ];

      vi.mocked(indexedDBManager.getAllBookmarks).mockResolvedValue(
        bookmarks as BookmarkRecord[],
      );

      const recent = await gateway.getRecentBookmarks(2);

      expect(recent).toHaveLength(2);
      expect(recent[0]).toBeDefined();
      expect(recent[1]).toBeDefined();
      expect(recent[0]!.id).toBe("1");
      expect(recent[1]!.id).toBe("2");
    });

    it("应该过滤掉文件夹", async () => {
      const bookmarks: Array<Partial<BookmarkRecord>> = [
        {
          id: "1",
          parentId: "0",
          title: "Folder",
          dateAdded: Date.now(),
          index: 0,
        },
        {
          id: "2",
          parentId: "0",
          title: "Bookmark",
          url: "https://example.com",
          dateAdded: Date.now() - 1000,
          index: 1,
        },
      ];

      vi.mocked(indexedDBManager.getAllBookmarks).mockResolvedValue(
        bookmarks as BookmarkRecord[],
      );

      const recent = await gateway.getRecentBookmarks(10);

      expect(recent).toHaveLength(1);
      expect(recent[0]).toBeDefined();
      expect(recent[0]!.id).toBe("2");
    });

    it("应该支持自定义数量限制", async () => {
      const bookmarks: Array<Partial<BookmarkRecord>> = Array.from(
        { length: 100 },
        (_, i) => ({
          id: `${i}`,
          parentId: "0",
          title: `Bookmark ${i}`,
          url: `https://example${i}.com`,
          dateAdded: Date.now() - i * 1000,
          index: i,
        }),
      );

      vi.mocked(indexedDBManager.getAllBookmarks).mockResolvedValue(
        bookmarks as BookmarkRecord[],
      );

      const recent5 = await gateway.getRecentBookmarks(5);
      const recent20 = await gateway.getRecentBookmarks(20);

      expect(recent5).toHaveLength(5);
      expect(recent20).toHaveLength(20);
    });
  });

  describe("智能推荐系统", () => {
    it("应该基于域名匹配推荐书签", async () => {
      const bookmarks: Array<Partial<BookmarkRecord>> = [
        {
          id: "1",
          parentId: "0",
          title: "Vue.js Docs",
          url: "https://vuejs.org/guide",
          dateAdded: Date.now(),
          index: 0,
        },
        {
          id: "2",
          parentId: "0",
          title: "React Docs",
          url: "https://react.dev",
          dateAdded: Date.now(),
          index: 1,
        },
      ];

      vi.mocked(indexedDBManager.getAllBookmarks).mockResolvedValue(
        bookmarks as BookmarkRecord[],
      );

      const recommendations = await gateway.getSmartRecommendations(
        {
          currentDomain: "vuejs.org",
        },
        5,
      );

      expect(recommendations).toHaveLength(2);
      // Vue.js 应该排在前面（域名完全匹配）
      expect(recommendations[0]).toBeDefined();
      expect(recommendations[0]!.id).toBe("1");
    });

    it("应该返回指定数量的推荐", async () => {
      const bookmarks: Array<Partial<BookmarkRecord>> = Array.from(
        { length: 20 },
        (_, i) => ({
          id: `${i}`,
          parentId: "0",
          title: `Bookmark ${i}`,
          url: `https://example${i}.com`,
          dateAdded: Date.now(),
          index: i,
        }),
      );

      vi.mocked(indexedDBManager.getAllBookmarks).mockResolvedValue(
        bookmarks as BookmarkRecord[],
      );

      const recommendations = await gateway.getSmartRecommendations({}, 5);

      expect(recommendations).toHaveLength(5);
    });

    it("应该过滤掉文件夹", async () => {
      const bookmarks: Array<Partial<BookmarkRecord>> = [
        {
          id: "1",
          parentId: "0",
          title: "Folder",
          dateAdded: Date.now(),
          index: 0,
        },
        {
          id: "2",
          parentId: "0",
          title: "Bookmark",
          url: "https://example.com",
          dateAdded: Date.now(),
          index: 1,
        },
      ];

      vi.mocked(indexedDBManager.getAllBookmarks).mockResolvedValue(
        bookmarks as BookmarkRecord[],
      );

      const recommendations = await gateway.getSmartRecommendations({}, 10);

      expect(recommendations).toHaveLength(1);
      expect(recommendations[0]).toBeDefined();
      expect(recommendations[0]!.id).toBe("2");
    });

    it("空书签列表应该返回空推荐", async () => {
      vi.mocked(indexedDBManager.getAllBookmarks).mockResolvedValue([]);

      const recommendations = await gateway.getSmartRecommendations({}, 5);

      expect(recommendations).toHaveLength(0);
    });
  });

  describe("错误处理", () => {
    it("IndexedDB 初始化失败应该抛出错误", async () => {
      vi.mocked(indexedDBManager.initialize).mockRejectedValue(
        new Error("DB init failed"),
      );

      await expect(gateway.getEnhancedBookmarkTree()).rejects.toThrow();
    });

    it("获取书签失败应该抛出错误", async () => {
      vi.mocked(indexedDBManager.getAllBookmarks).mockRejectedValue(
        new Error("DB read failed"),
      );

      await expect(gateway.getEnhancedBookmarkTree()).rejects.toThrow();
    });

    it("推荐系统出错应该返回空数组", async () => {
      vi.mocked(indexedDBManager.getAllBookmarks).mockRejectedValue(
        new Error("DB error"),
      );

      const recommendations = await gateway.getSmartRecommendations({}, 5);

      expect(recommendations).toHaveLength(0);
    });
  });

  describe("边界情况", () => {
    it("应该处理空书签列表", async () => {
      // 确保 initialize 成功
      vi.mocked(indexedDBManager.initialize).mockResolvedValue();
      vi.mocked(indexedDBManager.getAllBookmarks).mockResolvedValue([]);

      const tree = await gateway.getEnhancedBookmarkTree();

      expect(tree).toHaveLength(0);
    });

    it("应该处理无效的 URL", async () => {
      const bookmarks: Array<Partial<BookmarkRecord>> = [
        {
          id: "1",
          parentId: "0",
          title: "Invalid URL",
          url: "not-a-valid-url",
          dateAdded: Date.now(),
          index: 0,
        },
      ];

      // 确保 initialize 成功
      vi.mocked(indexedDBManager.initialize).mockResolvedValue();
      vi.mocked(indexedDBManager.getAllBookmarks).mockResolvedValue(
        bookmarks as BookmarkRecord[],
      );

      const tree = await gateway.getEnhancedBookmarkTree();

      // 应该不会崩溃，domain 应该是 undefined
      expect(tree[0]).toBeDefined();
      expect(tree[0]!.domain).toBeUndefined();
    });

    it("应该处理缺失的字段", async () => {
      const bookmarks: Array<Partial<BookmarkRecord>> = [
        {
          id: "1",
          // 缺少 parentId, title, dateAdded 等
          url: "https://example.com",
        },
      ];

      // 确保 initialize 成功
      vi.mocked(indexedDBManager.initialize).mockResolvedValue();
      vi.mocked(indexedDBManager.getAllBookmarks).mockResolvedValue(
        bookmarks as BookmarkRecord[],
      );

      // 应该不会崩溃
      await expect(gateway.getEnhancedBookmarkTree()).resolves.toBeDefined();
    });
  });
});
