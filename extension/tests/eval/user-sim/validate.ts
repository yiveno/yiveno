/**
 * user-sim 数据集自检：隔离、聚合对账、清理覆盖、锚点逐字。
 * 返回 problems[]；空数组 = 通过。schema 级校验（MemoryItemSchema 等）在 test 里做。
 */

import { USER_SIM_TOPICS } from './personas'
import { HYBRID_FAKE_EMBEDDING_DIM } from '../hybrid-fake-embedding'
import { userSimTokens, type UserSimDataset } from './generate'

export function validateUserSimDataset(data: UserSimDataset): string[] {
  const problems: string[] = []
  const ok = (cond: boolean, msg: string): void => {
    if (!cond) problems.push(msg)
  }
  const ids = data.memoryItems.map(m => m.id)
  ok(new Set(ids).size === ids.length, 'duplicate memory item ids')
  ok(
    ids.every(id => data.cleanupManifest.memoryItemIds.includes(id)) &&
      data.cleanupManifest.memoryItemIds.length === ids.length,
    'cleanup manifest does not cover exactly the visible items'
  )
  ok(
    data.behaviorStats.every(b =>
      data.cleanupManifest.behaviorKeys.some(k => k.url === b.url && k.ownerId === b.ownerId)
    ),
    'cleanup manifest missing behavior keys'
  )
  for (const m of data.memoryItems) {
    ok(/^[0-9a-f-]{36}$/.test(m.id), `bad uuid ${m.id}`)
    ok(
      Array.isArray(m.clues.embedding) && m.clues.embedding.length === HYBRID_FAKE_EMBEDDING_DIM,
      `missing fake embedding ${m.id}`
    )
    if (m.type === 'bookmark') {
      ok(
        m.payload.title.length > 0 && /^https:\/\//.test(m.payload.url),
        `bad bookmark payload ${m.id}`
      )
    } else {
      ok(m.payload.selectedText.length > 0, `bad excerpt payload ${m.id}`)
    }
  }
  // 泄漏扫描：GT 字符串与禁用标记不得出现在可见层
  const visibleText = JSON.stringify(data.memoryItems) + JSON.stringify(data.behaviorStats)
  for (const q of data.groundTruth.queries) {
    ok(!visibleText.includes(q.clue), `query text leaked into visible layer: ${q.id}`)
  }
  for (const bad of [
    'groundTruth',
    'targetId',
    'expectedKey',
    '"role"',
    'distractor',
    'topicId',
    'latent'
  ]) {
    ok(!visibleText.includes(bad), `forbidden marker in visible layer: ${bad}`)
  }
  for (const t of USER_SIM_TOPICS) {
    ok(!visibleText.includes(`"${t.id}"`), `latent topic id leaked: ${t.id}`)
  }
  // associative 零内容词重叠
  const byId = new Map(data.memoryItems.map(m => [m.id, m]))
  for (const q of data.groundTruth.queries) {
    if (q.type !== 'associative' || q.targetId == null) continue
    const m = byId.get(q.targetId)
    if (!m) continue
    const itemTokens = userSimTokens(
      `${m.clues.title ?? ''} ${m.clues.textExcerpt ?? ''} ${m.clues.note ?? ''}`
    )
    const overlap = [...userSimTokens(q.clue)].filter(w => itemTokens.has(w))
    ok(
      overlap.length === 0,
      `associative clue ${q.id} overlaps target tokens: ${overlap.join(',')}`
    )
  }
  // 行为聚合与事件流对账
  const recount = new Map<string, number>()
  for (const e of data.events) {
    if (e.type === 'visit' || e.type === 'revisit') {
      recount.set(e.url!, (recount.get(e.url!) ?? 0) + 1)
    }
  }
  for (const b of data.behaviorStats) {
    ok(recount.get(b.url) === b.visitCount, `behavior count mismatch for ${b.url}`)
  }
  for (const q of data.groundTruth.queries) {
    ok(
      q.targetId === null || byId.has(q.targetId),
      `query ${q.id} target missing from visible items`
    )
  }
  for (const a of data.groundTruth.dreaming.anchors) {
    const m = byId.get(a.itemId)
    ok(
      m != null && m.type === 'text_excerpt' && m.payload.selectedText.includes(a.anchor),
      `dreaming anchor not verbatim in item ${a.itemId}`
    )
  }
  const c = data.meta.counts
  ok(c.saves >= 160 && c.saves <= 450, `saves out of range: ${c.saves}`)
  ok(c.visits >= 800, `visits too low: ${c.visits}`)
  ok(c.queries === 80, `queries != 80: ${c.queries}`)
  return problems
}
