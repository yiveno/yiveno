/**
 * Dreaming 闭集常量（闹钟名 / schema / 命题上限）。
 * 夜间编译与派生表读写共用；禁止在调用处散写字面量。
 */

/** chrome.alarms 名（稳定，可过滤）。 */
export const DREAMING_ALARM_NAME = 'yiveno.dreaming' as const

/**
 * 周期（分钟）。每日一次；Chrome 周期闹钟从创建时刻起计，
 * **无**固定墙钟语义（不是「每天 03:00」）。
 */
export const DREAMING_ALARM_PERIOD_MINUTES = 1440 as const

/** `memory_notes` / meta 的 schema 版本；升版强制重建命题。 */
export const DREAMING_SCHEMA_VERSION = 1 as const

/** 每源条目最多保留的原子命题数。 */
export const DREAMING_MAX_PROPOSITIONS_PER_SOURCE = 3 as const

/**
 * 单条命题正文硬上限（字符）。
 * 超长在写库前截断拒绝（无引用不入库同级校验）。
 */
export const DREAMING_PROPOSITION_MAX_CHARS = 400 as const

/** 夜间编译每批源条目数（peek-then-commit 打包）。 */
export const DREAMING_COMPILE_BATCH_SIZE = 8 as const

/** 单次 alarm tick 最多处理批次数（有界，防 SW 被杀中途丢太多）。 */
export const DREAMING_COMPILE_MAX_BATCHES_PER_TICK = 3 as const

/**
 * Phase 4 优先读总开关（默认 OFF）。
 * OFF 时查询行为与 Phase 0 基线一致：不扫 note、不合并候选、不加虚拟字段分、不走命题佐证。
 * 只能由 Stage 4 的显式一步翻为 true（评估通过后）；其余任何阶段不得翻开。
 * 注意：这里用普通 boolean，不用 `as const false`——Stage 4 要改的就是这一行字面量。
 */
export const DREAMING_PREFER_READ_ENABLED: boolean = false

/** 死链巡检 chrome.alarms 名（独立；不搭同步 / dreaming 便车）。 */
export const LINK_STATUS_SWEEP_ALARM_NAME = 'yiveno.link_status_sweep' as const

/**
 * 死链巡检周期（分钟）= 7 天。
 * Chrome 周期闹钟从创建时刻起计，无固定墙钟。
 */
export const LINK_STATUS_SWEEP_ALARM_PERIOD_MINUTES = 10080 as const

/** 连续「死链」失败达到此次数才升 `stale`（网络/超时不算）。 */
export const LINK_STATUS_STALE_FAILURE_THRESHOLD = 2 as const

/** 单次 tick 最多 HEAD/探测条数（书签可达万级；参照回填节流）。 */
export const LINK_STATUS_SWEEP_BATCH_LIMIT = 40 as const

/** 任务间距毫秒（节流）。 */
export const LINK_STATUS_SWEEP_GAP_MS = 450 as const

/** 单 URL 探测超时毫秒。 */
export const LINK_STATUS_CHECK_TIMEOUT_MS = 8_000 as const
