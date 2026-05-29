/**
 * 文件夹向量调试工具
 *
 * 将 folderVectorService 的关键方法挂载到 window，
 * 方便在 Chrome 扩展 DevTools Console 里直接调试。
 *
 * 使用方式（在扩展页面的 Console 里）：
 *
 * // 1. 检查统计信息
 * await __AB_FOLDER_VECTOR__.stats()
 *
 * // 2. 同步文件夹向量
 * await __AB_FOLDER_VECTOR__.sync()
 *
 * // 3. 测试推荐
 * await __AB_FOLDER_VECTOR__.recommend('React 官方文档', 'https://react.dev')
 *
 * // 4. 更新单个文件夹向量
 * await __AB_FOLDER_VECTOR__.updateFolder('folder_id')
 *
 * // 5. 清空所有向量
 * await __AB_FOLDER_VECTOR__.clear()
 */

import { folderVectorService } from "@/application/folder/folder-vector-service";
import { folderVectorStore } from "@/infrastructure/folder-vector/folder-vector-store";
import { logger } from "@/infrastructure/logging/logger";

const LOG_TAG = "FolderVectorDebug";

export interface FolderVectorDebugBridge {
  /** 查看统计信息 */
  stats(): Promise<{ folderCount: number; providerName: string | null }>;
  /** 同步文件夹向量 */
  sync(): Promise<void>;
  /** 测试推荐 */
  recommend(title: string, url: string, topK?: number): Promise<void>;
  /** 更新单个文件夹向量 */
  updateFolder(folderId: string): Promise<void>;
  /** 清空所有向量 */
  clear(): Promise<void>;
  /** 直接访问 vectorStore */
  vectorStore: typeof folderVectorStore;
  /** 直接访问 service */
  service: typeof folderVectorService;
}

async function stats() {
  const result = await folderVectorService.getStats();
  console.info(
    `[FolderVectorDebug] 文件夹向量: ${result.folderCount} 个, Provider: ${result.providerName ?? "未初始化"}`,
  );
  return result;
}

async function sync() {
  console.info("[FolderVectorDebug] 开始同步文件夹向量...");

  await folderVectorService.syncFolderVectors((progress) => {
    const pct = Math.round((progress.processed / progress.total) * 100);
    console.info(
      `[FolderVectorDebug] 进度: ${progress.processed}/${progress.total} (${pct}%) 失败: ${progress.failed}`,
    );
  });

  console.info("[FolderVectorDebug] ✅ 同步完成");
}

async function recommend(title: string, url: string, topK = 3) {
  console.info(`[FolderVectorDebug] 推荐文件夹: "${title}" - ${url}`);

  const recommendations = await folderVectorService.recommendFolders(
    title,
    url,
    undefined, // bookmarkContent
    topK,
  );

  if (recommendations.length === 0) {
    console.warn("[FolderVectorDebug] ❌ 无推荐结果！可能原因：");
    console.warn(
      "  1. 文件夹向量库为空，请先运行: await __AB_FOLDER_VECTOR__.sync()",
    );
    console.warn(
      "  2. 书签向量库为空，请先运行: await __AB_EMBEDDING__.sync()",
    );
    console.warn("  3. 相似度太低（< 0.3）");
    return;
  }

  console.info(
    `[FolderVectorDebug] ✅ 找到 ${recommendations.length} 个推荐：`,
  );
  console.table(
    recommendations.map((r) => ({
      文件夹: r.folderPath,
      匹配度: `${Math.round(r.score * 100)}%`,
      书签数: r.bookmarkCount,
      原因: r.reason,
    })),
  );
}

async function updateFolder(folderId: string) {
  console.info(`[FolderVectorDebug] 更新文件夹向量: ${folderId}`);
  await folderVectorService.updateFolderVector(folderId);
  console.info("[FolderVectorDebug] ✅ 更新完成");
}

async function clear() {
  console.info("[FolderVectorDebug] 清空所有文件夹向量...");
  await folderVectorService.clearAll();
  console.info("[FolderVectorDebug] ✅ 已清空");
}

/**
 * 启用文件夹向量调试桥
 * 将调试方法挂载到 window.__AB_FOLDER_VECTOR__
 */
export function enableFolderVectorDebugBridge(): () => void {
  const bridge: FolderVectorDebugBridge = {
    stats,
    sync,
    recommend,
    updateFolder,
    clear,
    vectorStore: folderVectorStore,
    service: folderVectorService,
  };

  (
    window as Window & { __AB_FOLDER_VECTOR__?: FolderVectorDebugBridge }
  ).__AB_FOLDER_VECTOR__ = bridge;
  logger.info(
    LOG_TAG,
    "🔧 文件夹向量调试桥已启用，在 Console 中使用 __AB_FOLDER_VECTOR__",
  );

  // 获取控制台样式颜色
  const getConsoleColor = (): string => {
    try {
      // prettier-ignore
      /* eslint-disable @typescript-eslint/no-var-requires */
      const {
        materialColors,
      } = require("@acuity-bookmarks/design-tokens/colors");
      /* eslint-enable @typescript-eslint/no-var-requires */
      return materialColors.primaryDark.rgb;
    } catch {
      // 降级方案
      return "rgb(155, 203, 251)";
    }
  };

  console.info(
    "%c[FolderVectorDebug] 调试命令：\n" +
      "  await __AB_FOLDER_VECTOR__.stats()                              // 查看统计\n" +
      "  await __AB_FOLDER_VECTOR__.sync()                               // 同步向量 ⭐\n" +
      '  await __AB_FOLDER_VECTOR__.recommend("React", "https://react.dev") // 测试推荐\n' +
      '  await __AB_FOLDER_VECTOR__.updateFolder("folder_id")            // 更新单个文件夹\n' +
      "  await __AB_FOLDER_VECTOR__.clear()                              // 清空向量",
    `color: ${getConsoleColor()}; font-weight: bold`,
  );

  return () => {
    delete (
      window as Window & { __AB_FOLDER_VECTOR__?: FolderVectorDebugBridge }
    ).__AB_FOLDER_VECTOR__;
  };
}
