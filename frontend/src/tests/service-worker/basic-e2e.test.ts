/**
 * Service Worker 基础 E2E 测试
 *
 * 测试目标：
 * 1. 验证 Service Worker 能够正常启动
 * 2. 验证扩展能够正确加载
 * 3. 验证基本的浏览器环境
 *
 * 这是一个最小化的 E2E 测试，用于验证测试环境是否正常工作。
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import puppeteer, { type Browser, type Target } from "puppeteer";
import { resolve } from "path";

// ⚠️ 这些测试需要构建后的扩展
const EXTENSION_PATH = resolve(__dirname, "../../../../dist"); // 项目根目录的 dist/
const TEST_TIMEOUT = 60000; // 60 秒超时
const BROWSER_LAUNCH_TIMEOUT = 120000; // 浏览器启动超时 120 秒

describe("Service Worker 基础 E2E 测试", () => {
  let browser: Browser;
  let serviceWorkerTarget: Target | undefined;

  beforeAll(async () => {
    console.log("🚀 启动浏览器...");
    console.log("📦 扩展路径:", EXTENSION_PATH);

    // 启动浏览器并加载扩展
    browser = await puppeteer.launch({
      headless: false, // Service Worker 测试需要可见浏览器
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        "--no-sandbox",
        "--disable-setuid-sandbox",
      ],
      timeout: BROWSER_LAUNCH_TIMEOUT,
    });

    console.log("✅ 浏览器已启动");
    console.log("⏳ 等待 Service Worker 启动...");

    // 等待 Service Worker 启动
    serviceWorkerTarget = await browser.waitForTarget(
      (target) => target.type() === "service_worker",
      { timeout: TEST_TIMEOUT },
    );

    console.log("✅ Service Worker 已启动");
  }, BROWSER_LAUNCH_TIMEOUT);

  afterAll(async () => {
    if (browser) {
      console.log("⏳ 关闭浏览器...");
      await browser.close();
      console.log("✅ 浏览器已关闭");
    }
  });

  describe("环境验证", () => {
    it("应该成功启动浏览器", () => {
      expect(browser).toBeDefined();
      expect(browser.isConnected()).toBe(true);
    });

    it("应该成功加载扩展", async () => {
      const targets = await browser.targets();
      const extensionTargets = targets.filter(
        (t) => t.type() === "service_worker",
      );

      expect(extensionTargets.length).toBeGreaterThan(0);
      console.log(`✅ 找到 ${extensionTargets.length} 个 Service Worker`);
    });

    it("应该能够获取 Service Worker 实例", async () => {
      expect(serviceWorkerTarget).toBeDefined();
      expect(serviceWorkerTarget?.type()).toBe("service_worker");

      const worker = await serviceWorkerTarget?.worker();
      expect(worker).toBeDefined();

      console.log("✅ Service Worker 实例获取成功");
    });

    it("应该能够在 Service Worker 中执行代码", async () => {
      if (!serviceWorkerTarget) {
        throw new Error("Service Worker target not found");
      }

      const worker = await serviceWorkerTarget.worker();
      if (!worker) {
        throw new Error("Service Worker worker not found");
      }

      // 执行简单的 JavaScript 代码
      const result = (await worker.evaluate(() => {
        return {
          timestamp: Date.now(),
          userAgent: navigator.userAgent,
          hasChrome: typeof chrome !== "undefined",
        };
      })) as { timestamp: number; userAgent: string; hasChrome: boolean };

      expect(result.timestamp).toBeGreaterThan(0);
      expect(result.userAgent).toBeDefined();
      expect(result.hasChrome).toBe(true);

      console.log("✅ Service Worker 代码执行成功");
      console.log("   - 时间戳:", result.timestamp);
      console.log(
        "   - User Agent:",
        result.userAgent.substring(0, 50) + "...",
      );
      console.log("   - Chrome API 可用:", result.hasChrome);
    });
  });

  describe("扩展信息", () => {
    it("应该能够获取扩展 URL", async () => {
      if (!serviceWorkerTarget) {
        throw new Error("Service Worker target not found");
      }

      const url = serviceWorkerTarget.url();
      expect(url).toBeDefined();
      expect(url).toContain("chrome-extension://");

      console.log("✅ 扩展 URL:", url);
    });

    it("应该能够获取扩展 ID", async () => {
      if (!serviceWorkerTarget) {
        throw new Error("Service Worker target not found");
      }

      const url = serviceWorkerTarget.url();
      const extensionId = url.split("//")[1]?.split("/")[0];

      expect(extensionId).toBeDefined();
      expect(extensionId?.length).toBeGreaterThan(0);

      console.log("✅ 扩展 ID:", extensionId);
    });
  });
});

/**
 * 使用说明：
 *
 * 1. 构建扩展：
 *    cd frontend
 *    bun run build
 *
 * 2. 运行测试：
 *    bun run test:service-worker:e2e
 *
 * 预期结果：
 * - ✅ 6 个测试全部通过
 * - ✅ Service Worker 正常启动
 * - ✅ 扩展正确加载
 *
 * 注意事项：
 * - 这是一个基础测试，用于验证测试环境
 * - 不测试具体的业务逻辑
 * - 主要验证 Puppeteer + Chrome Extension 的集成
 */
