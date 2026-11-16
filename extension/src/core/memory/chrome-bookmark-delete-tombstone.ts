import { z } from 'zod'

/** 用户从 Yiveno 删除的书签 chromeBookmarkId 集合（本地-only；防同步复活）。 */
export const CHROME_BOOKMARK_TOMBSTONE_STORAGE_KEY = 'yiveno:chrome_bookmark_tombstones' as const

export const ChromeBookmarkDeleteTombstoneStateSchema = z.object({
  /** 已从 Yiveno 记忆删除、禁止再 upsert/bulk 灌入的 Chrome 书签 id */
  chromeBookmarkIds: z.array(z.string().min(1)).default([])
})

export type ChromeBookmarkDeleteTombstoneState = z.infer<
  typeof ChromeBookmarkDeleteTombstoneStateSchema
>
