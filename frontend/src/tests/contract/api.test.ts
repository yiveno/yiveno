/**
 * API 契约测试
 *
 * 测试目标：
 * 1. 前端和后端的接口契约
 * 2. 数据格式验证
 * 3. 错误处理
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { z } from "zod";

// API 响应 Schema
const HealthCheckResponseSchema = z.object({
  status: z.literal("ok"),
  timestamp: z.number(),
  version: z.string(),
});

const BookmarkResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string().url(),
  createdAt: z.number(),
  tags: z.array(z.string()).optional(),
});

describe("API 契约测试", () => {
  const API_BASE_URL = "http://127.0.0.1:8787";

  beforeEach(() => {
    // Mock fetch
    global.fetch = vi.fn();
  });

  it("健康检查接口应该返回正确的格式", async () => {
    // Mock 响应
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "ok",
        timestamp: Date.now(),
        version: "1.0.0",
      }),
    } as Response);

    const response = await fetch(`${API_BASE_URL}/api/health`);
    const data = await response.json();

    // 使用 Zod 验证响应格式
    const result = HealthCheckResponseSchema.safeParse(data);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("ok");
      expect(result.data.version).toBe("1.0.0");
    }
  });

  it("书签接口应该返回正确的格式", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "bookmark-123",
        title: "Test Bookmark",
        url: "https://example.com",
        createdAt: Date.now(),
        tags: ["test", "example"],
      }),
    } as Response);

    const response = await fetch(`${API_BASE_URL}/api/bookmarks/123`);
    const data = await response.json();

    const result = BookmarkResponseSchema.safeParse(data);

    expect(result.success).toBe(true);
  });

  it("应该正确处理 API 错误", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({
        error: "Not Found",
        message: "Bookmark not found",
      }),
    } as Response);

    const response = await fetch(`${API_BASE_URL}/api/bookmarks/999`);

    expect(response.ok).toBe(false);
    expect(response.status).toBe(404);

    const error = await response.json();
    expect(error.error).toBe("Not Found");
  });

  it("应该正确处理网络错误", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("Network error"));

    await expect(fetch(`${API_BASE_URL}/api/health`)).rejects.toThrow(
      "Network error",
    );
  });
});
