/**
 * 书签特征计算服务
 *
 * 职责：
 * - 读取 IndexedDB 中的所有书签
 * - 预计算书签特征（重复、内部、过时等）
 * - 将计算结果写回 IndexedDB，供前端页面直接消费
 * - 对外提供调度方法，避免重复触发导致的性能抖动
 */

import { indexedDBManager } from "@/infrastructure/indexeddb/manager";
import type { BookmarkRecord } from "@/infrastructure/indexeddb/schema";
import { logger } from "@/infrastructure/logging/logger";
import { TRAIT_TAG_ORDER, type TraitTag } from "@/core/bookmark/trait-rules";

/** 单条书签的特征评估结果 */
interface BookmarkTraitEvaluation {
  id: string;
  tags: TraitTag[];
  metadata: BookmarkRecord["traitMetadata"];
}

/** 内部调度状态 */
const queueState: {
  fullRequested: boolean;
  pendingIds: Set<string>;
  timer: ReturnType<typeof setTimeout> | null;
  running: boolean;
  reasons: Set<string>;
} = {
  fullRequested: false,
  pendingIds: new Set<string>(),
  timer: null,
  running: false,
  reasons: new Set<string>(),
};

/** 调度延迟（毫秒） */
const SCHEDULE_DELAY_MS = 800;

/** 每批写入的最大条数 */
const TRAIT_WRITE_BATCH = 200;

declare global {
  interface BookmarkTraitQueueState {
    running: boolean;
    fullRequested: boolean;
    pendingCount: number;
    reasons: string[];
  }
}

function updateGlobalQueueState(): void {
  const snapshot = {
    running: queueState.running,
    fullRequested: queueState.fullRequested,
    pendingCount: queueState.pendingIds.size,
    reasons: Array.from(queueState.reasons),
  };

  try {
    (
      globalThis as unknown as {
        bookmarkTraitQueue?: BookmarkTraitQueueState;
      }
    ).bookmarkTraitQueue = snapshot;
  } catch {}
}

/**
 * 请求一次全量特征重建
 */
export function scheduleFullTraitRebuild(reason = "unknown"): void {
  queueState.fullRequested = true;
  queueState.reasons.add(reason);
  scheduleFlush();
}

/**
 * 请求对指定书签重新评估特征
 */
export function scheduleTraitRebuildForIds(
  ids: string[],
  reason = "unknown",
): void {
  ids.forEach((id) => queueState.pendingIds.add(id));
  queueState.reasons.add(reason);
  scheduleFlush();
}

/** 启动或续约调度定时器 */
function scheduleFlush(): void {
  if (queueState.timer !== null) {
    return;
  }

  queueState.timer = setTimeout(() => {
    queueState.timer = null;
    void flushTraitQueue();
  }, SCHEDULE_DELAY_MS);

  updateGlobalQueueState();
}

/**
 * 执行特征重计算的入口（增量更新）
 */
async function flushTraitQueue(): Promise<void> {
  if (queueState.running) {
    return;
  }

  queueState.running = true;

  const reasons = Array.from(queueState.reasons);
  const pendingIds = Array.from(queueState.pendingIds);
  const needFullRebuild = queueState.fullRequested;

  queueState.fullRequested = false;
  queueState.pendingIds.clear();
  queueState.reasons.clear();

  updateGlobalQueueState();

  if (!needFullRebuild && pendingIds.length === 0) {
    queueState.running = false;
    return;
  }

  try {
    if (needFullRebuild || pendingIds.length > 100) {
      logger.info("BookmarkTrait", "开始全量重建特征标签", {
        reasons,
        pendingIdsCount: pendingIds.length,
      });
      await evaluateAllBookmarkTraits();
      logger.info("BookmarkTrait", "全量特征标签计算完成");
    } else {
      logger.info("BookmarkTrait", "开始增量更新特征标签", {
        reasons,
        pendingIds,
      });
      await evaluateBookmarksTraitsIncremental(pendingIds);
      logger.info("BookmarkTrait", "增量特征标签更新完成", {
        count: pendingIds.length,
      });
    }

    // ✅ 特征检测完成后，广播消息通知 UI 刷新
    // 注意：在 Service Worker 环境中，如果没有接收端，sendMessage 会失败
    // 我们需要检查是否有可用的 runtime 环境
    if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
      try {
        chrome.runtime.sendMessage(
          {
            type: "acuity-bookmarks-trait-updated",
            timestamp: Date.now(),
            reason: reasons.join(","),
            affectedCount: needFullRebuild ? "all" : pendingIds.length,
          },
          () => {
            // 使用回调函数来捕获错误，避免 Promise rejection
            if (chrome.runtime.lastError) {
              logger.debug(
                "BookmarkTrait",
                "广播特征更新消息失败",
                chrome.runtime.lastError.message,
              );
            } else {
              logger.debug("BookmarkTrait", "✅ 已广播特征更新消息");
            }
          },
        );
      } catch (error) {
        // 忽略广播失败（可能没有接收端）
        logger.debug("BookmarkTrait", "广播特征更新消息异常", error);
      }
    }
  } catch (error) {
    logger.error("BookmarkTrait", "特征标签计算失败", error);
  } finally {
    // eslint-disable-next-line require-atomic-updates -- finally 块中的状态重置是安全的
    queueState.running = false;
  }
}

/**
 * 全量评估所有书签的特征并写回 IndexedDB
 */
export async function evaluateAllBookmarkTraits(): Promise<void> {
  await indexedDBManager.initialize();

  const startTime = performance.now ? performance.now() : Date.now();
  const bookmarks = await indexedDBManager.getAllBookmarks();
  if (bookmarks.length === 0) {
    return;
  }

  const duplicateInfo = buildDuplicateInfo(bookmarks);

  const evaluations: BookmarkTraitEvaluation[] = bookmarks.map((record) =>
    evaluateBookmarkTraits(record, duplicateInfo),
  );

  await persistTraitEvaluations(evaluations);

  const duration =
    (performance.now ? performance.now() : Date.now()) - startTime;
  logger.debug("BookmarkTrait", "特征标签写入完成", {
    total: evaluations.length,
    duration: Math.round(duration),
  });
}

/**
 * 增量评估指定书签的特征
 */
async function evaluateBookmarksTraitsIncremental(
  bookmarkIds: string[],
): Promise<void> {
  if (bookmarkIds.length === 0) return;

  await indexedDBManager.initialize();

  const startTime = performance.now ? performance.now() : Date.now();

  const targetBookmarks: BookmarkRecord[] = [];
  for (const id of bookmarkIds) {
    const bookmark = await indexedDBManager.getBookmarkById(id);
    if (bookmark) {
      targetBookmarks.push(bookmark);
    }
  }

  if (targetBookmarks.length === 0) {
    logger.debug("BookmarkTrait", "待评估书签不存在，跳过", { bookmarkIds });
    return;
  }

  const urls = new Set(
    targetBookmarks
      .filter((b) => b.url)
      .map((b) => b.url!.toLowerCase().trim()),
  );

  const relatedBookmarks: BookmarkRecord[] = [...targetBookmarks];
  const urlSet = new Set<string>();

  for (const url of urls) {
    if (!url || urlSet.has(url)) continue;
    urlSet.add(url);

    const bookmarksWithSameUrl = await indexedDBManager.getBookmarksByUrl(url);
    for (const bookmark of bookmarksWithSameUrl) {
      if (!relatedBookmarks.find((b) => b.id === bookmark.id)) {
        relatedBookmarks.push(bookmark);
      }
    }
  }

  const duplicateInfo = buildDuplicateInfo(relatedBookmarks);

  const evaluations: BookmarkTraitEvaluation[] = relatedBookmarks.map(
    (record) => evaluateBookmarkTraits(record, duplicateInfo),
  );

  await persistTraitEvaluations(evaluations);

  const duration =
    (performance.now ? performance.now() : Date.now()) - startTime;
  logger.debug("BookmarkTrait", "增量特征标签写入完成", {
    requested: bookmarkIds.length,
    evaluated: evaluations.length,
    duration: Math.round(duration),
  });
}

/**
 * 将评估结果批量写入 IndexedDB
 */
async function persistTraitEvaluations(
  evaluations: BookmarkTraitEvaluation[],
): Promise<void> {
  const batches: BookmarkTraitEvaluation[][] = [];
  for (let i = 0; i < evaluations.length; i += TRAIT_WRITE_BATCH) {
    batches.push(evaluations.slice(i, i + TRAIT_WRITE_BATCH));
  }

  for (const batch of batches) {
    await indexedDBManager.updateBookmarksTraits(
      batch.map((item) => ({
        id: item.id,
        traitTags: item.tags,
        traitMetadata: item.metadata,
      })),
    );
  }
}

/**
 * 构建重复书签信息
 */
function buildDuplicateInfo(bookmarks: BookmarkRecord[]): {
  duplicateIds: Set<string>;
  canonicalMap: Map<string, string>;
} {
  const urlGroups = new Map<string, BookmarkRecord[]>();

  for (const record of bookmarks) {
    if (!record.url) continue;
    const key = (record.urlLower ?? record.url).trim().toLowerCase();
    if (!key) continue;
    if (!urlGroups.has(key)) {
      urlGroups.set(key, []);
    }
    urlGroups.get(key)!.push(record);
  }

  const duplicateIds = new Set<string>();
  const canonicalMap = new Map<string, string>();

  for (const [, group] of urlGroups) {
    if (group.length <= 1) continue;

    group.sort((a, b) =>
      getBookmarkOrderKey(a).localeCompare(getBookmarkOrderKey(b)),
    );

    const canonical = group[0];
    if (!canonical) continue;

    for (let i = 1; i < group.length; i += 1) {
      duplicateIds.add(group[i]!.id);
      canonicalMap.set(group[i]!.id, canonical.id);
    }
  }

  return { duplicateIds, canonicalMap };
}

/**
 * 生成书签的排序键
 *
 * ✅ 修复：统一使用 dateAdded + index 排序，与 markDuplicateBookmarks() 保持一致
 * 确保全量同步和特征检测选择相同的"原始书签"
 */
function getBookmarkOrderKey(record: BookmarkRecord): string {
  const dateKey = String(record.dateAdded ?? 0).padStart(20, "0");
  const indexKey = String(record.index ?? 0).padStart(6, "0");
  return `${dateKey}#${indexKey}`;
}

/**
 * 评估单个书签的特征标签
 */
function evaluateBookmarkTraits(
  record: BookmarkRecord,
  duplicateInfo: {
    duplicateIds: Set<string>;
    canonicalMap: Map<string, string>;
  },
): BookmarkTraitEvaluation {
  const tagSet = new Set<TraitTag>();

  const existingMetadata = Array.isArray(record.traitMetadata)
    ? record.traitMetadata.filter((entry) => entry && entry.source !== "worker")
    : [];

  const metadataEntries: BookmarkRecord["traitMetadata"] = [
    ...existingMetadata,
  ];

  // ✅ 只有这三个特征标签需要存储 metadata（需要记录详细信息）
  const METADATA_TAGS: TraitTag[] = ["duplicate", "invalid", "internal"];

  const addTag = (tag: TraitTag, notes?: string) => {
    tagSet.add(tag);
    // ✅ 只为需要 metadata 的标签创建条目
    if (METADATA_TAGS.includes(tag)) {
      metadataEntries.push(createTraitMetadataEntry(tag, notes));
    }
  };

  // 只对书签进行特征检测（文件夹不需要）
  if (record.url) {
    // 1. 检查是否为浏览器内部协议
    if (isInternalProtocol(record.url)) {
      addTag("internal", "浏览器内部链接，仅限本浏览器访问");
    }
    // 2. 对于非内部协议的书签，进行进一步检查
    else {
      // 2.1 URL格式检测
      if (!isValidBookmarkUrl(record.url)) {
        addTag("invalid", "URL 不符合 http/https 规范");
      }
    }

    // 3. 重复书签检测
    if (duplicateInfo.duplicateIds.has(record.id)) {
      const canonicalId = duplicateInfo.canonicalMap.get(record.id);
      addTag(
        "duplicate",
        canonicalId ? `参考原始书签 ${canonicalId}` : undefined,
      );
    }

    // 4. 过时书签检测（超过 1 年未访问）
    if (isOutdatedBookmark(record)) {
      const daysSinceLastVisit = getDaysSinceLastVisit(record);
      addTag("outdated", `已 ${daysSinceLastVisit} 天未访问`);
    }

    // 5. 未分类书签检测（直接在根目录或书签栏）
    if (isUntaggedBookmark(record)) {
      addTag("untagged", "建议整理到文件夹中");
    }

    // 6. 无标题书签检测（标题为空或等于 URL）
    if (isUntitledBookmark(record)) {
      addTag("untitled", "建议添加有意义的标题");
    }
  }

  const tags = Array.from(tagSet).sort(
    (a, b) => TRAIT_TAG_ORDER.indexOf(a) - TRAIT_TAG_ORDER.indexOf(b),
  );

  return {
    id: record.id,
    tags,
    metadata: tags.length > 0 ? metadataEntries : [],
  };
}

/**
 * 判断是否为浏览器内部协议
 */
function isInternalProtocol(url: string): boolean {
  if (!url || typeof url !== "string") return false;

  const lowerUrl = url.toLowerCase();
  return (
    lowerUrl.startsWith("chrome://") ||
    lowerUrl.startsWith("chrome-extension://") ||
    lowerUrl.startsWith("about:") ||
    lowerUrl.startsWith("file://") ||
    lowerUrl.startsWith("edge://") ||
    lowerUrl.startsWith("brave://")
  );
}

/**
 * 判断 URL 是否为有效的 http/https 地址
 */
function isValidBookmarkUrl(url: string): boolean {
  if (!url) return false;
  try {
    const urlObj = new URL(url);

    // 检查协议
    if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:") {
      return false;
    }

    // 检查域名格式
    const hostname = urlObj.hostname;

    // 域名不能为空
    if (!hostname) return false;

    // 检查顶级域名（TLD）是否完整
    // 有效的 TLD 至少 2 个字符（如 .io, .cn）
    const parts = hostname.split(".");
    if (parts.length < 2) return false; // 必须有至少一个点

    const tld = parts[parts.length - 1];
    if (!tld || tld.length < 2) return false; // TLD 至少 2 个字符

    // 检查 TLD 是否只包含字母（排除 .o 这种不完整的）
    if (!/^[a-z]{2,}$/i.test(tld)) return false;

    return true;
  } catch {
    return false;
  }
}

/**
 * 生成统一的特征元数据条目
 */
function createTraitMetadataEntry(tag: TraitTag, notes?: string) {
  return {
    tag,
    detectedAt: Date.now(),
    source: "worker" as const,
    notes,
  };
}

/**
 * 判断书签是否过时（超过 1 年未访问）
 *
 * 检测规则：
 * 1. 优先使用 lastVisited（最后访问时间）
 * 2. 如果没有 lastVisited，使用 dateAdded（创建时间）
 * 3. 超过 365 天视为过时
 */
function isOutdatedBookmark(record: BookmarkRecord): boolean {
  const now = Date.now();
  const oneYearMs = 365 * 24 * 60 * 60 * 1000; // 365 天

  // 优先使用 lastVisited
  if (record.lastVisited && record.lastVisited > 0) {
    return now - record.lastVisited > oneYearMs;
  }

  // 如果没有 lastVisited，使用 dateAdded
  if (record.dateAdded && record.dateAdded > 0) {
    return now - record.dateAdded > oneYearMs;
  }

  return false;
}

/**
 * 获取距离上次访问的天数
 */
function getDaysSinceLastVisit(record: BookmarkRecord): number {
  const now = Date.now();
  const lastTime = record.lastVisited || record.dateAdded || now;
  const diffMs = now - lastTime;
  return Math.floor(diffMs / (24 * 60 * 60 * 1000));
}

/**
 * 判断书签是否未分类（直接在根目录或书签栏）
 *
 * 检测规则：
 * 1. parentId 为 '0'（根目录）
 * 2. parentId 为 '1'（书签栏）
 * 3. pathIds 长度 <= 1（路径深度浅）
 */
function isUntaggedBookmark(record: BookmarkRecord): boolean {
  // 检查 parentId
  if (record.parentId === "0" || record.parentId === "1") {
    return true;
  }

  // 检查路径深度
  if (record.pathIds && record.pathIds.length <= 1) {
    return true;
  }

  return false;
}

/**
 * 判断书签是否无标题
 *
 * 检测规则：
 * 1. 标题为空字符串或只包含空格
 * 2. 标题等于 URL（未自定义标题）
 * 3. 标题为常见的默认值
 */
function isUntitledBookmark(record: BookmarkRecord): boolean {
  const title = record.title?.trim() || "";
  const url = record.url || "";

  // 1. 标题为空
  if (!title) {
    return true;
  }

  // 2. 标题等于 URL
  if (title === url) {
    return true;
  }

  // 3. 标题为常见的默认值
  const defaultTitles = [
    "untitled",
    "no title",
    "new bookmark",
    "无标题",
    "新建书签",
    "未命名",
  ];

  const lowerTitle = title.toLowerCase();
  if (defaultTitles.includes(lowerTitle)) {
    return true;
  }

  return false;
}
