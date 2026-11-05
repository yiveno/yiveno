import { z } from 'zod'

/** 第三方语料源（§5.10.6 · R2 准入）。 */
export const ThirdPartyCorpusSourceSchema = z.enum([
  'raindrop', // Raindrop.io 导出
  'pocket' // Pocket 导出
])

export type ThirdPartyCorpusSource = z.infer<typeof ThirdPartyCorpusSourceSchema>

/** 单次导入允许的最大条目数（Normative · §5.10.6）。 */
export const THIRD_PARTY_CORPUS_IMPORT_MAX_ITEMS = 50

/** 解析后的第三方书签行（写库前）。 */
export type ParsedThirdPartyBookmark = {
  /** 源系统稳定 id */
  remoteId: string
  /** 标题 */
  title: string
  /** URL */
  url: string
  /** ISO；来自导出时间戳 */
  createdAt?: string
  /** 源附注 / 描述（可写入 clues.note） */
  note?: string
}
