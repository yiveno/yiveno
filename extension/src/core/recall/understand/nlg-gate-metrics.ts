/**
 * NLG 门禁本地度量（拒绝率 / 回退率）。
 * 仅 taskKind + outcome 计数；不存回复 / clue / 标题。
 * 落盘经可注入 storage（core 禁直连 chrome.*；由 infrastructure 接线）。
 */

/** 参与门禁度量的逻辑 taskKind（chitchat 走 nlu API，度量单独分桶）。 */
export type NlgGateMetricsTaskKind =
  | 'framing_nlg' // Framing 润色
  | 'follow_up_nlg' // need_a_clue 追问
  | 'narrow_polish' // Narrow 举例润色
  | 'chitchat' // 非召回二次回复
  | 'portrait_narrative' // 画像叙事
  | 'portrait_cluster' // 画像语义聚类

/**
 * 门禁结局。
 * - accepted：通过
 * - fallback：整表 / 确定性回退
 * - rejected:reason：拒收（reason 为闭集或首个校验原因）
 */
export type NlgGateOutcome = 'accepted' | 'fallback' | `rejected:${string}`

/** 单日桶：taskKind → outcome → 次数。 */
export type NlgGateDayBucket = {
  /** UTC 日键 YYYY-MM-DD */
  day: string
  counts: Record<string, Record<string, number>>
}

export type NlgGateMetricsStore = {
  /** schema 版本 */
  version: 1
  days: NlgGateDayBucket[]
}

/** 可注入落盘（测试 mock / chrome.storage 适配器）。 */
export type NlgGateMetricsPersist = {
  read: () => Promise<NlgGateMetricsStore | null>
  write: (store: NlgGateMetricsStore) => Promise<void>
}

export const NLG_GATE_METRICS_STORAGE_KEY = 'yiveno:nlgGateMetrics' as const
export const NLG_GATE_METRICS_RETENTION_DAYS = 14
const PERSIST_THROTTLE_MS = 2000

let persist: NlgGateMetricsPersist | null = null
let memoryStore: NlgGateMetricsStore = emptyStore()
let persistTimer: ReturnType<typeof setTimeout> | null = null
let persistQueued = false

/** 接线落盘实现（Background / UI bootstrap 调用；可先 hydrate 再记数）。 */
export function configureNlgGateMetricsPersist(next: NlgGateMetricsPersist | null): void {
  persist = next
}

function emptyStore(): NlgGateMetricsStore {
  return { version: 1, days: [] }
}

/** UTC 日键。 */
export function utcDayKey(nowMs: number = Date.now()): string {
  const date = new Date(nowMs)
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** 丢弃超出保留窗的日桶（纯函数；供测试）。 */
export function pruneNlgGateMetricsDays(
  days: readonly NlgGateDayBucket[],
  nowMs: number = Date.now(),
  retentionDays: number = NLG_GATE_METRICS_RETENTION_DAYS
): NlgGateDayBucket[] {
  const cutoff = utcDayKey(nowMs - retentionDays * 24 * 60 * 60 * 1000)
  return days.filter(bucket => bucket.day >= cutoff).sort((a, b) => a.day.localeCompare(b.day))
}

function cloneStore(store: NlgGateMetricsStore): NlgGateMetricsStore {
  return {
    version: 1,
    days: store.days.map(day => ({
      day: day.day,
      counts: Object.fromEntries(
        Object.entries(day.counts).map(([kind, outcomes]) => [kind, { ...outcomes }])
      )
    }))
  }
}

function ensureDayBucket(store: NlgGateMetricsStore, day: string): NlgGateDayBucket {
  let bucket = store.days.find(row => row.day === day)
  if (!bucket) {
    bucket = { day, counts: {} }
    store.days.push(bucket)
  }
  return bucket
}

function bumpCount(
  store: NlgGateMetricsStore,
  taskKind: string,
  outcome: string,
  day: string,
  nowMs: number
): void {
  const bucket = ensureDayBucket(store, day)
  const byOutcome = bucket.counts[taskKind] ?? (bucket.counts[taskKind] = {})
  byOutcome[outcome] = (byOutcome[outcome] ?? 0) + 1
  store.days = pruneNlgGateMetricsDays(store.days, nowMs)
}

function schedulePersist(): void {
  if (!persist) {
    return
  }
  persistQueued = true
  if (persistTimer != null) {
    return
  }
  persistTimer = setTimeout(() => {
    persistTimer = null
    if (!persistQueued || !persist) {
      return
    }
    persistQueued = false
    const snapshot = cloneStore(memoryStore)
    void persist.write(snapshot).catch(() => {
      // 落盘失败静默，不影响主流程
    })
  }, PERSIST_THROTTLE_MS)
}

/**
 * 从落盘 hydrate 到内存（bootstrap 时调用；覆盖当前内存，故须在业务记数前）。
 * 读失败静默。
 */
export async function hydrateNlgGateMetricsFromPersist(): Promise<void> {
  if (!persist) {
    return
  }
  try {
    const loaded = await persist.read()
    if (loaded && loaded.version === 1 && Array.isArray(loaded.days)) {
      memoryStore = {
        version: 1,
        days: pruneNlgGateMetricsDays(loaded.days)
      }
    }
  } catch {
    // 静默
  }
}

/**
 * 记录一次门禁结局（内存立刻 + 节流落盘）。
 * 失败不抛。
 */
export function recordNlgGateOutcome(
  taskKind: NlgGateMetricsTaskKind,
  outcome: NlgGateOutcome,
  nowMs: number = Date.now()
): void {
  try {
    bumpCount(memoryStore, taskKind, outcome, utcDayKey(nowMs), nowMs)
    schedulePersist()
  } catch {
    // 静默
  }
}

/** 读取当前度量快照（含未落盘内存）。 */
export async function readNlgGateMetrics(): Promise<NlgGateMetricsStore> {
  return cloneStore(memoryStore)
}

/** 测试用：清空内存与定时器。 */
export function resetNlgGateMetricsForTests(): void {
  memoryStore = emptyStore()
  persistQueued = false
  if (persistTimer != null) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
}
