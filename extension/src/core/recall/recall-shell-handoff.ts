/**
 * Recall Side Panel 开壳 + 预填接力顺序（Omnibox / 划选「用这段来找」同铁律）。
 *
 * 必须先开火 `openShell`（不 await），再写预填，最后 await 开壳。
 * 若先 await storage，会丢掉用户手势 → `sidePanel.open` 失败，Panel 已开时仍误报「打不开」。
 */

/** 接力结果：开壳成功 / 仅预填已写入（Panel 多半已开）/ 两者皆败。 */
export type RecallShellHandoffResult =
  | 'opened' // 开壳 ok
  | 'prefilled' // 开壳失败但预填已写，storage 监听可吃
  | 'failed' // 开壳与预填都失败

/**
 * 先开火开壳，并行写预填；开壳失败但预填成功 → `prefilled`（勿对用户谎报打不开）。
 */
export async function resolveRecallShellHandoff(input: {
  openShell: () => Promise<{ ok: boolean } | null | undefined>
  writePrefill: () => Promise<void>
}): Promise<RecallShellHandoffResult> {
  const opening = input.openShell()
  let wrote = false
  try {
    await input.writePrefill()
    wrote = true
  } catch {
    // 预填失败仍等开壳结果
  }

  let opened = false
  try {
    const response = await opening
    opened = response?.ok === true
  } catch {
    opened = false
  }

  if (opened) {
    return 'opened'
  }
  if (wrote) {
    return 'prefilled'
  }
  return 'failed'
}
