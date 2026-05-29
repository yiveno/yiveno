/**
 * 性能监控器测试
 *
 * 测试性能监控功能的正确性
 */

import { describe, it, expect, beforeEach } from "vitest";
import { PerformanceMonitor } from "../performance-monitor";

describe("PerformanceMonitor", () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor();
  });

  describe("record", () => {
    it("应该记录性能指标", () => {
      monitor.record({
        type: "read",
        storeName: "bookmarks",
        duration: 50,
        recordCount: 100,
        success: true,
        timestamp: Date.now(),
      });

      const stats = monitor.getStats();
      expect(stats.totalOperations).toBe(1);
      expect(stats.successfulOperations).toBe(1);
      expect(stats.successRate).toBe(1);
    });

    it("应该记录失败操作", () => {
      monitor.record({
        type: "write",
        storeName: "bookmarks",
        duration: 100,
        success: false,
        error: "Test error",
        timestamp: Date.now(),
      });

      const stats = monitor.getStats();
      expect(stats.failedOperations).toBe(1);
      expect(stats.successRate).toBe(0);
    });

    it("应该限制记录数量", () => {
      // 记录超过 maxMetrics 的数量
      for (let i = 0; i < 1100; i++) {
        monitor.record({
          type: "read",
          storeName: "bookmarks",
          duration: 10,
          success: true,
          timestamp: Date.now(),
        });
      }

      const exported = monitor.export();
      expect(exported.length).toBeLessThanOrEqual(1000);
    });
  });

  describe("getStats", () => {
    it("应该返回空统计（无数据时）", () => {
      const stats = monitor.getStats();
      expect(stats.totalOperations).toBe(0);
      expect(stats.successRate).toBe(0);
    });

    it("应该计算正确的统计信息", () => {
      // 记录多个操作
      monitor.record({
        type: "read",
        storeName: "bookmarks",
        duration: 50,
        success: true,
        timestamp: Date.now(),
      });
      monitor.record({
        type: "write",
        storeName: "bookmarks",
        duration: 100,
        success: true,
        timestamp: Date.now(),
      });
      monitor.record({
        type: "read",
        storeName: "settings",
        duration: 30,
        success: false,
        error: "Test error",
        timestamp: Date.now(),
      });

      const stats = monitor.getStats();
      expect(stats.totalOperations).toBe(3);
      expect(stats.successfulOperations).toBe(2);
      expect(stats.failedOperations).toBe(1);
      expect(stats.successRate).toBeCloseTo(2 / 3);
      expect(stats.averageDuration).toBeCloseTo(60);
      expect(stats.minDuration).toBe(30);
      expect(stats.maxDuration).toBe(100);
    });

    it("应该按操作类型分组统计", () => {
      monitor.record({
        type: "read",
        storeName: "bookmarks",
        duration: 50,
        success: true,
        timestamp: Date.now(),
      });
      monitor.record({
        type: "read",
        storeName: "bookmarks",
        duration: 60,
        success: true,
        timestamp: Date.now(),
      });
      monitor.record({
        type: "write",
        storeName: "bookmarks",
        duration: 100,
        success: true,
        timestamp: Date.now(),
      });

      const stats = monitor.getStats();
      expect(stats.byType.read.count).toBe(2);
      expect(stats.byType.read.averageDuration).toBeCloseTo(55);
      expect(stats.byType.write.count).toBe(1);
      expect(stats.byType.write.averageDuration).toBe(100);
    });

    it("应该按对象存储分组统计", () => {
      monitor.record({
        type: "read",
        storeName: "bookmarks",
        duration: 50,
        success: true,
        timestamp: Date.now(),
      });
      monitor.record({
        type: "read",
        storeName: "settings",
        duration: 30,
        success: true,
        timestamp: Date.now(),
      });

      const stats = monitor.getStats();
      expect(stats.byStore.bookmarks).toBeDefined();
      expect(stats.byStore.settings).toBeDefined();

      const bookmarksStats = stats.byStore.bookmarks!;
      const settingsStats = stats.byStore.settings!;

      expect(bookmarksStats.count).toBe(1);
      expect(bookmarksStats.averageDuration).toBe(50);
      expect(settingsStats.count).toBe(1);
      expect(settingsStats.averageDuration).toBe(30);
    });
  });

  describe("getSlowQueries", () => {
    it("应该返回慢查询", () => {
      monitor.record({
        type: "read",
        storeName: "bookmarks",
        duration: 150,
        success: true,
        timestamp: Date.now(),
      });
      monitor.record({
        type: "read",
        storeName: "bookmarks",
        duration: 50,
        success: true,
        timestamp: Date.now(),
      });
      monitor.record({
        type: "read",
        storeName: "bookmarks",
        duration: 200,
        success: true,
        timestamp: Date.now(),
      });

      const slowQueries = monitor.getSlowQueries(100, 10);
      expect(slowQueries.length).toBe(2);
      expect(slowQueries[0]?.duration).toBe(200);
      expect(slowQueries[1]?.duration).toBe(150);
    });

    it("应该限制返回数量", () => {
      for (let i = 0; i < 20; i++) {
        monitor.record({
          type: "read",
          storeName: "bookmarks",
          duration: 150 + i,
          success: true,
          timestamp: Date.now(),
        });
      }

      const slowQueries = monitor.getSlowQueries(100, 5);
      expect(slowQueries.length).toBe(5);
    });
  });

  describe("getFailedOperations", () => {
    it("应该返回失败操作", () => {
      monitor.record({
        type: "read",
        storeName: "bookmarks",
        duration: 50,
        success: false,
        error: "Error 1",
        timestamp: Date.now(),
      });
      monitor.record({
        type: "write",
        storeName: "bookmarks",
        duration: 100,
        success: true,
        timestamp: Date.now(),
      });
      monitor.record({
        type: "read",
        storeName: "settings",
        duration: 30,
        success: false,
        error: "Error 2",
        timestamp: Date.now(),
      });

      const failedOps = monitor.getFailedOperations(10);
      expect(failedOps.length).toBe(2);
      expect(failedOps.every((op) => !op.success)).toBe(true);
    });
  });

  describe("clear", () => {
    it("应该清空所有记录", () => {
      monitor.record({
        type: "read",
        storeName: "bookmarks",
        duration: 50,
        success: true,
        timestamp: Date.now(),
      });

      monitor.clear();

      const stats = monitor.getStats();
      expect(stats.totalOperations).toBe(0);
    });
  });

  describe("setEnabled", () => {
    it("应该禁用监控", () => {
      monitor.setEnabled(false);

      monitor.record({
        type: "read",
        storeName: "bookmarks",
        duration: 50,
        success: true,
        timestamp: Date.now(),
      });

      const stats = monitor.getStats();
      expect(stats.totalOperations).toBe(0);
    });

    it("应该启用监控", () => {
      monitor.setEnabled(false);
      monitor.setEnabled(true);

      monitor.record({
        type: "read",
        storeName: "bookmarks",
        duration: 50,
        success: true,
        timestamp: Date.now(),
      });

      const stats = monitor.getStats();
      expect(stats.totalOperations).toBe(1);
    });
  });
});
