/**
 * 本机 Hybrid 召回扫描上限（与历史关键词后端共用同一量级）。
 * 独立常量，避免 Hybrid 依赖已下线的 KeywordRecallBackend 文件。
 */
export const RECALL_SCAN_LIMIT = 10000
