/**
 * 本机 Hybrid / 关键词召回扫描上限（全表扫与 list 候选 cap）。
 * 对齐产品质量→压力档（~20k）；倒排命中仍受 KEYWORD_INDEX_CANDIDATE_ID_CAP 约束。
 */
export const RECALL_SCAN_LIMIT = 20000
