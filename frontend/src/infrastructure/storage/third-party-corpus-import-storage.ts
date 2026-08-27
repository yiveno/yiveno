/**
 * 第三方语料导入进度读写（chrome.storage.local）。
 */

import {
  THIRD_PARTY_CORPUS_IMPORT_STORAGE_KEY,
  ThirdPartyCorpusImportStateSchema,
  type ThirdPartyCorpusImportState
} from '@/core/memory/third-party-corpus-import-state'
import { writeChromeStorageLocal } from '@/infrastructure/storage/chrome-storage-local'

/** 读取最近一次第三方导入状态。 */
export async function readThirdPartyCorpusImportState(): Promise<ThirdPartyCorpusImportState | null> {
  const result = await chrome.storage.local.get(THIRD_PARTY_CORPUS_IMPORT_STORAGE_KEY)
  const raw = result[THIRD_PARTY_CORPUS_IMPORT_STORAGE_KEY]
  const parsed = ThirdPartyCorpusImportStateSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

/** 写入第三方导入状态。 */
export async function writeThirdPartyCorpusImportState(
  state: ThirdPartyCorpusImportState
): Promise<void> {
  await writeChromeStorageLocal(THIRD_PARTY_CORPUS_IMPORT_STORAGE_KEY, state)
}
