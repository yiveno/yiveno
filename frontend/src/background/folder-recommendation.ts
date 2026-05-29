/**
 * 文件夹推荐 helper
 *
 * 职责：
 * - 通过 Offscreen Document 获取文件夹向量推荐
 * - 提供退化策略，确保在 AI 不可用时也能返回合理结果
 */

import { logger } from "@/infrastructure/logging/logger";
import { dispatchOffscreenRequest } from "@/infrastructure/offscreen/manager";

const FOLDER_RECOMMENDATION_TIMEOUT = 20000;

export async function getFolderRecommendations(
  title: string,
  url: string,
  topK = 3,
  minScore = 0.3,
): Promise<
  Array<{
    folderId: string;
    folderName: string;
    folderPath: string;
    score: number;
    bookmarkCount: number;
    reason: string;
  }>
> {
  try {
    if (!title || !url) {
      logger.error("BackgroundFolderRecommendation", "标题和 URL 不能为空", {
        title,
        url,
      });
      return [];
    }

    try {
      const result = await dispatchOffscreenRequest(
        {
          type: "GET_FOLDER_RECOMMENDATIONS",
          payload: {
            title,
            url,
            topK,
            minScore,
          },
        },
        {
          timeout: FOLDER_RECOMMENDATION_TIMEOUT,
        },
      );

      if (result && Array.isArray(result)) {
        return result as Array<{
          folderId: string;
          folderName: string;
          folderPath: string;
          score: number;
          bookmarkCount: number;
          reason: string;
        }>;
      }

      throw new Error("Offscreen 返回的结果格式不正确");
    } catch (offscreenError) {
      logger.warn(
        "BackgroundFolderRecommendation",
        "Offscreen 推荐失败，降级到书签栏",
        {
          error:
            offscreenError instanceof Error
              ? offscreenError.message
              : String(offscreenError),
        },
      );

      const tree = await chrome.bookmarks.getTree();
      const bookmarksBar = tree[0]?.children?.find(
        (node) => node.title === "书签栏" || node.title === "Bookmarks Bar",
      );

      if (!bookmarksBar) {
        return [];
      }

      return [
        {
          folderId: bookmarksBar.id,
          folderName: bookmarksBar.title,
          folderPath: bookmarksBar.title,
          score: 0.5,
          bookmarkCount: bookmarksBar.children?.length || 0,
          reason: "默认推荐（书签栏）",
        },
      ];
    }
  } catch (error) {
    logger.error("BackgroundFolderRecommendation", "获取文件夹推荐失败", error);
    return [];
  }
}
