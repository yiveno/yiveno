/**
 * Embedding 服务
 *
 * 职责：
 * 1. 自动选择最优 EmbeddingProvider（ONNX 优先，Chrome Built-in 备用）
 * 2. 增量同步书签向量（只处理新增/变更的书签）
 * 3. 提供本地语义搜索接口
 */

import type { EmbeddingProvider } from "./embedding-provider";
import { onnxEmbeddingProvider } from "./onnx-embedding-provider";
import { chromeBuiltinEmbeddingProvider } from "./chrome-builtin-embedding-provider";
import { localVectorStore } from "./local-vector-store";
import type { VectorRecord } from "./local-vector-store";
import type { BookmarkRecord } from "@/infrastructure/indexeddb/manager";
import { logger } from "@/infrastructure/logging/logger";

const LOG_TAG = "EmbeddingService";

/** 每批处理的书签数量，避免长时间阻塞 */
const BATCH_SIZE = 32;

/** 书签文本的最大长度，超出截断 */
const MAX_TEXT_LENGTH = 512;

export interface EmbeddingSyncProgress {
  total: number;
  processed: number;
  failed: number;
}

export interface LocalSemanticResult {
  bookmarkId: string;
  score: number;
  title: string;
  url: string;
}

export class EmbeddingService {
  private provider: EmbeddingProvider | null = null;
  private providerInitPromise: Promise<EmbeddingProvider | null> | null = null;

  /**
   * 获取当前可用的 Provider（懒初始化，优先 ONNX，备用 Chrome Built-in）
   */
  async getProvider(): Promise<EmbeddingProvider | null> {
    if (this.provider) return this.provider;
    if (this.providerInitPromise) return this.providerInitPromise;

    this.providerInitPromise = (async () => {
      // 方案2：ONNX 本地模型（主力）
      try {
        const onnxAvailable = await onnxEmbeddingProvider.isAvailable();
        logger.info(LOG_TAG, `ONNX isAvailable: ${onnxAvailable}`);
        if (onnxAvailable) {
          logger.info(LOG_TAG, "使用 ONNX 本地 Embedding Provider");
          this.provider = onnxEmbeddingProvider;
          return this.provider;
        }
      } catch (err) {
        logger.warn(LOG_TAG, "ONNX isAvailable 异常", err);
      }

      // 方案1：Chrome Built-in AI（未来预留）
      if (await chromeBuiltinEmbeddingProvider.isAvailable()) {
        logger.info(LOG_TAG, "使用 Chrome Built-in AI Embedding Provider");
        this.provider = chromeBuiltinEmbeddingProvider;
        return this.provider;
      }

      logger.warn(LOG_TAG, "没有可用的 Embedding Provider");
      return null;
    })();

    const result = await this.providerInitPromise;
    this.providerInitPromise = null;
    return result;
  }

  /**
   * 检查语义搜索是否可用
   */
  async isAvailable(): Promise<boolean> {
    const provider = await this.getProvider();
    return provider !== null;
  }

  /**
   * 增量同步书签向量
   *
   * 只处理向量库中不存在的书签（新增）或内容已变更的书签。
   * 已删除的书签对应向量会被清理。
   *
   * @param bookmarks 当前所有书签
   * @param onProgress 进度回调
   */
  async syncBookmarks(
    bookmarks: BookmarkRecord[],
    onProgress?: (progress: EmbeddingSyncProgress) => void,
  ): Promise<void> {
    const provider = await this.getProvider();
    if (!provider) {
      logger.warn(LOG_TAG, "Embedding Provider 不可用，跳过同步");
      return;
    }

    // 只处理有 URL 的书签（排除文件夹）
    const urlBookmarks = bookmarks.filter((b) => b.url && !b.isFolder);

    if (urlBookmarks.length === 0) return;

    // 获取已存储的 ID 集合
    const existingIds = await localVectorStore.getAllIds();

    // 找出需要新增 embedding 的书签
    const toEmbed = urlBookmarks.filter((b) => !existingIds.has(b.id));

    // 清理已删除书签的向量
    const currentIds = new Set(urlBookmarks.map((b) => b.id));
    const toDelete = Array.from(existingIds).filter(
      (id) => !currentIds.has(id),
    );
    if (toDelete.length > 0) {
      await localVectorStore.deleteBatch(toDelete);
      logger.info(LOG_TAG, `清理已删除书签向量: ${toDelete.length} 条`);
    }

    if (toEmbed.length === 0) {
      logger.info(LOG_TAG, "所有书签向量已是最新，无需同步");
      return;
    }

    logger.info(
      LOG_TAG,
      `开始增量同步: ${toEmbed.length} 条书签需要 embedding`,
    );

    const progress: EmbeddingSyncProgress = {
      total: toEmbed.length,
      processed: 0,
      failed: 0,
    };

    // 分批处理
    for (let i = 0; i < toEmbed.length; i += BATCH_SIZE) {
      const batch = toEmbed.slice(i, i + BATCH_SIZE);

      try {
        const texts = batch.map((b) => buildBookmarkText(b));

        let vectors: number[][];
        if (provider.embedBatch) {
          vectors = await provider.embedBatch(texts);
        } else {
          vectors = await Promise.all(texts.map((t) => provider.embed(t)));
        }

        const updatedAt = Date.now();
        const records: VectorRecord[] = [];
        batch.forEach((b, idx) => {
          const vector = vectors[idx];
          if (!vector || !b.url) return;

          records.push({
            bookmarkId: b.id,
            vector,
            model: provider.name,
            title: b.title,
            url: b.url,
            updatedAt,
          });
        });

        await localVectorStore.upsertBatch(records);
        progress.processed += batch.length;
      } catch (error) {
        logger.warn(LOG_TAG, `批次 embedding 失败`, error);
        progress.failed += batch.length;
        progress.processed += batch.length;
      }

      onProgress?.(progress);

      // 让出主线程，避免阻塞 UI
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    logger.info(
      LOG_TAG,
      `同步完成: 成功 ${progress.processed - progress.failed} 条，失败 ${progress.failed} 条`,
    );
  }

  /**
   * 本地语义搜索
   *
   * @param query 查询文本
   * @param topK 返回数量
   * @param minScore 最低相似度阈值，默认 0.2
   */
  async search(
    query: string,
    topK = 10,
    minScore = 0.2,
  ): Promise<LocalSemanticResult[]> {
    const provider = await this.getProvider();
    if (!provider) return [];

    const count = await localVectorStore.count();
    if (count === 0) {
      logger.info(LOG_TAG, "向量库为空，请先同步书签");
      return [];
    }

    const queryVector = await provider.embed(query.trim());
    return localVectorStore.search(queryVector, topK, minScore);
  }

  /**
   * 获取向量库统计信息
   */
  async getStats(): Promise<{ count: number; providerName: string | null }> {
    const [count, provider] = await Promise.all([
      localVectorStore.count(),
      this.getProvider(),
    ]);
    return { count, providerName: provider?.name ?? null };
  }
}

/**
 * 将书签转换为用于 embedding 的文本
 *
 * 优先级策略：
 * 1. 标题：优先使用爬取的 meta title，回退到书签标题
 * 2. 文件夹路径：用户组织书签的方式，包含重要的分类信息
 * 3. 描述：使用爬取的 meta description（如果有）
 * 4. 关键词：使用爬取的 meta keywords（如果有）
 * 5. 域名：用于语义上下文
 * 6. URL 路径：提取有意义的路径词
 *
 * 组合这些字段可以提升语义搜索质量，让搜索结果更准确。
 */
function buildBookmarkText(bookmark: BookmarkRecord): string {
  const parts: string[] = [];

  // 1. 标题（优先使用 meta title，因为更准确）
  if (bookmark.metaTitleLower) {
    parts.push(bookmark.metaTitleLower);
  } else if (bookmark.title) {
    parts.push(bookmark.title);
  }

  // 2. 文件夹路径（新增：用户的分类信息，非常重要）
  if (bookmark.path && bookmark.path.length > 1) {
    // path 数组包含从根到当前节点的所有文件夹名称
    // 例如：['书签栏', '前端开发', 'React', '当前书签']
    // 我们只取文件夹部分（去掉最后一个，即当前书签名称）
    const folderPath = bookmark.path.slice(0, -1).join(" > ");
    if (folderPath) {
      parts.push(folderPath);
    }
  }

  // 3. 描述（来自网页 meta description）
  if (bookmark.metaDescriptionLower) {
    // 描述通常较长，截取前 200 字符避免稀释其他信息
    const description = bookmark.metaDescriptionLower.slice(0, 200);
    parts.push(description);
  }

  // 4. 关键词（来自网页 meta keywords）
  if (bookmark.metaKeywordsTokens && bookmark.metaKeywordsTokens.length > 0) {
    // 最多使用前 10 个关键词
    const keywords = bookmark.metaKeywordsTokens.slice(0, 10).join(" ");
    parts.push(keywords);
  }

  // 5. 域名（用于语义上下文）
  if (bookmark.domain) {
    parts.push(bookmark.domain);
  }

  // 6. URL 路径部分（去掉协议和域名，保留有意义的路径词）
  if (bookmark.url) {
    try {
      const url = new URL(bookmark.url);
      const pathWords = url.pathname
        .split(/[/\-_.]/)
        .filter((w) => w.length > 2)
        .slice(0, 5)
        .join(" ");
      if (pathWords) parts.push(pathWords);
    } catch {
      // 忽略无效 URL
    }
  }

  return parts.join(" | ").slice(0, MAX_TEXT_LENGTH);
}

export const embeddingService = new EmbeddingService();
