/** favicon 加载失败 id 集合（不可变更新，配合 Vue ref）。 */

export function isFaviconBroken(brokenIds: ReadonlySet<string>, id: string): boolean {
  return brokenIds.has(id)
}

/** 已存在则返回原 Set，避免无意义触发响应式。 */
export function withBrokenFavicon(brokenIds: ReadonlySet<string>, id: string): ReadonlySet<string> {
  if (brokenIds.has(id)) {
    return brokenIds
  }
  const next = new Set(brokenIds)
  next.add(id)
  return next
}
