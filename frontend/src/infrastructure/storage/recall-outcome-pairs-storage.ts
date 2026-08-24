/**
 * §7.2 P3：本机 Outcome 对 ring buffer（chrome.storage.local）。
 */

import { z } from 'zod'

import { optionalProp } from '@/core/common/optional-props'
import type { RecallOutcomePairRecord } from '@/core/recall/recall-outcome-pairs'
import {
  readChromeStorageLocal,
  writeChromeStorageLocal
} from '@/infrastructure/storage/chrome-storage-local'

export const RECALL_OUTCOME_PAIRS_LOCAL_KEY = 'yiveno.recallOutcomePairs'

const MAX_PAIRS = 120

const RecallOutcomePairRecordSchema = z.object({
  fingerprint: z.string().min(1),
  cluePreview: z.string(),
  label: z.enum(['target', 'none_in_results']),
  targetId: z.string().uuid().optional(),
  negativeIds: z.array(z.string().uuid()).optional(),
  confidence: z.enum(['strong', 'medium_high', 'medium', 'medium_low']).optional(),
  source: z.enum([
    'mark',
    'dismiss',
    'no_match',
    'exit_prompt',
    'settled_single',
    'settled_last',
    'copy',
    'unresolved'
  ]),
  createdAt: z.string().datetime()
})

const StoreSchema = z.object({
  pairs: z.array(RecallOutcomePairRecordSchema).max(MAX_PAIRS)
})

type ParsedRecallOutcomePair = z.infer<typeof RecallOutcomePairRecordSchema>

/** 去掉 optional 上的显式 undefined，满足 exactOptionalPropertyTypes。 */
function toRecallOutcomePairRecord(pair: ParsedRecallOutcomePair): RecallOutcomePairRecord {
  return {
    fingerprint: pair.fingerprint,
    cluePreview: pair.cluePreview,
    label: pair.label,
    source: pair.source,
    createdAt: pair.createdAt,
    ...optionalProp('targetId', pair.targetId),
    ...optionalProp('negativeIds', pair.negativeIds),
    ...optionalProp('confidence', pair.confidence)
  }
}

/** 读取全部 Outcome 对（损坏则空）。 */
export async function listRecallOutcomePairs(): Promise<RecallOutcomePairRecord[]> {
  const store = await readChromeStorageLocal(RECALL_OUTCOME_PAIRS_LOCAL_KEY, StoreSchema)
  return (store?.pairs ?? []).map(toRecallOutcomePairRecord)
}

/** 追加一条对；同指纹+同 target/负例集去重顶置；超出截断最旧。 */
export async function appendRecallOutcomePair(pair: RecallOutcomePairRecord): Promise<void> {
  const validated = RecallOutcomePairRecordSchema.parse(pair)
  const existing = await listRecallOutcomePairs()
  const filtered = existing.filter(item => {
    if (item.fingerprint !== validated.fingerprint || item.label !== validated.label) {
      return true
    }
    if (validated.label === 'target') {
      return item.targetId !== validated.targetId
    }
    const a = [...(item.negativeIds ?? [])].sort().join(',')
    const b = [...(validated.negativeIds ?? [])].sort().join(',')
    return a !== b
  })
  const next = [validated, ...filtered].slice(0, MAX_PAIRS)
  await writeChromeStorageLocal(RECALL_OUTCOME_PAIRS_LOCAL_KEY, { pairs: next })
}
