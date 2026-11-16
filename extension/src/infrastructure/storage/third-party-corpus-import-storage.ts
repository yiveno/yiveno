/**
 * 第三方语料导入进度读写（chrome.storage.local · 按来源 map）。
 */

import {
  THIRD_PARTY_CORPUS_IMPORT_STORAGE_KEY,
  ThirdPartyCorpusImportStateSchema,
  ThirdPartyCorpusImportStatesSchema,
  type ThirdPartyCorpusImportState,
  type ThirdPartyCorpusImportStates
} from '@/core/memory/third-party-corpus-import-state'
import type { ThirdPartyCorpusSource } from '@/core/memory/third-party-corpus-source'
import { writeChromeStorageLocal } from '@/infrastructure/storage/chrome-storage-local'

/** 读取 storage 原始值并规范为按来源 map（含旧单条迁移写回）。 */
async function readImportStatesMap(): Promise<ThirdPartyCorpusImportStates> {
  const result = await chrome.storage.local.get(THIRD_PARTY_CORPUS_IMPORT_STORAGE_KEY)
  const raw = result[THIRD_PARTY_CORPUS_IMPORT_STORAGE_KEY]
  if (raw === undefined) {
    return {}
  }

  // 旧格式：单条 State（带 source）→ 迁成 map 并写回
  const legacy = ThirdPartyCorpusImportStateSchema.safeParse(raw)
  if (legacy.success) {
    const migrated: ThirdPartyCorpusImportStates = {
      [legacy.data.source]: legacy.data
    }
    await writeChromeStorageLocal(THIRD_PARTY_CORPUS_IMPORT_STORAGE_KEY, migrated)
    return migrated
  }

  const parsed = ThirdPartyCorpusImportStatesSchema.safeParse(raw)
  return parsed.success ? parsed.data : {}
}

/** 读取指定来源的最近一次导入状态。 */
export async function readThirdPartyCorpusImportState(
  source: ThirdPartyCorpusSource
): Promise<ThirdPartyCorpusImportState | null> {
  const map = await readImportStatesMap()
  return map[source] ?? null
}

/** 写入指定来源的导入状态（不覆盖另一来源）。 */
export async function writeThirdPartyCorpusImportState(
  source: ThirdPartyCorpusSource,
  state: ThirdPartyCorpusImportState
): Promise<void> {
  const map = await readImportStatesMap()
  const next: ThirdPartyCorpusImportStates = {
    ...map,
    [source]: state
  }
  await writeChromeStorageLocal(THIRD_PARTY_CORPUS_IMPORT_STORAGE_KEY, next)
}

/** 清除指定来源的导入状态记录（按来源删除后调用）。 */
export async function clearThirdPartyCorpusImportState(
  source: ThirdPartyCorpusSource
): Promise<void> {
  const map = await readImportStatesMap()
  const next: ThirdPartyCorpusImportStates = { ...map }
  delete next[source]
  await writeChromeStorageLocal(THIRD_PARTY_CORPUS_IMPORT_STORAGE_KEY, next)
}
