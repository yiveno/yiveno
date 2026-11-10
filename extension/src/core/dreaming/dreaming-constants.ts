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
