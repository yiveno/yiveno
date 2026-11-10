/**
 * Dreaming run 游标纯函数：生成 run id、推进游标、判断源是否已处理。
 * 不碰 IndexedDB / Chrome；持久化由 meta repository 负责。
 */

/** 游标快照（写入 `memory_notes_meta`）。 */
export type DreamRunCursor = {
  dreamRunId: string
  /** 已处理到的源 MemoryItem.id；空串 = 本 run 尚未处理任何源。 */
  lastCursor: string
  lastRunAt: string | null
}

/** 生成一次 dreaming run 的幂等 id（`dream_` + uuid）。 */
export function createDreamRunId(nowMs: number = Date.now()): string {
  const uuid =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `fallback-${nowMs}-${Math.random().toString(36).slice(2, 10)}`
  return `dream_${uuid}`
}

/** 开新 run：新 id + 空游标。 */
export function startDreamRun(nowMs: number = Date.now()): DreamRunCursor {
  return {
    dreamRunId: createDreamRunId(nowMs),
    lastCursor: '',
    lastRunAt: new Date(nowMs).toISOString()
  }
}

/**
 * 推进游标到刚处理完的源 id。
 * 调用方须按源 id 字典序扫描，保证「id ≤ lastCursor」= 已处理。
 */
export function advanceDreamRunCursor(
  cursor: DreamRunCursor,
  sourceMemoryItemId: string,
  nowMs: number = Date.now()
): DreamRunCursor {
  return {
    dreamRunId: cursor.dreamRunId,
    lastCursor: sourceMemoryItemId,
    lastRunAt: new Date(nowMs).toISOString()
  }
}

/**
 * 判断源是否已在本 run 处理过。
 * 空游标 → 全部未处理；否则按字典序：`sourceId <= lastCursor` 视为已处理。
 */
export function isSourceProcessedInDreamRun(
  cursor: DreamRunCursor,
  sourceMemoryItemId: string
): boolean {
  if (!cursor.lastCursor) {
    return false
  }
  return sourceMemoryItemId.localeCompare(cursor.lastCursor) <= 0
}

/**
 * 从已排序的源 id 列表中，取出游标之后待处理的切片。
 * `sortedSourceIds` 须已按字典序升序。
 */
export function pickPendingSourceIdsAfterCursor(
  sortedSourceIds: readonly string[],
  cursor: DreamRunCursor,
  limit: number
): string[] {
  if (limit <= 0) {
    return []
  }
  const pending: string[] = []
  for (const id of sortedSourceIds) {
    if (isSourceProcessedInDreamRun(cursor, id)) {
      continue
    }
    pending.push(id)
    if (pending.length >= limit) {
      break
    }
  }
  return pending
}
