/**
 * 本机 Hybrid / 关键词召回扫描上限。
 *
 * - `RECALL_SCAN_LIMIT` = 20000：约束邻域（无内容词 + 时间/刚存 + 类型）路径的候选 cap。
 *   该路径本就少见 + 用户已显式约束，cap 是合理的工程折衷。
 *
 * - `RECALL_FALLBACK_SCAN_LIMIT` = 100000：倒排失败 / 无命中时的全表扫兜底上限。
 *   阶段六（D · 2026-09-21）从 20000 提到 100000 以解决 cold memory 问题——
 *   旧 20K 截断会让真实库超过 20K 后老条目永远不可见；100K 是 OOM 安全阀而非设计意图。
 *
 * 对齐产品质量→压力档（~20k）；倒排命中仍受 KEYWORD_INDEX_CANDIDATE_ID_CAP 约束。
 */

export const RECALL_SCAN_LIMIT = 20000

/**
 * 倒排 fallback 全表扫上限。阶段六 D：cold memory 修复。
 *
 * 边界选择理由：
 * - 100K 条 MemoryItem ≈ 30-50MB IndexedDB 数据；JSON 反序列化进内存 < 80MB。
 * - SW 全表读取实测 P95 < 150ms（详见 docs/audit/2026-09-cold-memory-fix.md）。
 * - 100K 是兜底保护，不是产品承诺上限；超出仍会截断以防 OOM。
 *
 * 若真实库 > 100K → 启动方案 E（分页/迭代 recall），不在本阶段范围。
 */
export const RECALL_FALLBACK_SCAN_LIMIT = 100000
