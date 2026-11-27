/**
 * 画像 LLM 叙事缓存（chrome.storage.local；键 = 事实签名）。
 */

import { z } from 'zod'

import {
  readChromeStorageLocal,
  writeChromeStorageLocal
} from '@/infrastructure/storage/chrome-storage-local'

export const PORTRAIT_NARRATIVE_CACHE_STORAGE_KEY = 'yiveno.portraitNarrativeCache' as const

const cacheSchema = z.object({
  entries: z.record(
    z.string(),
    z.object({
      text: z.string(),
      locale: z.enum(['en', 'zh_CN'])
    })
  )
})

type PortraitNarrativeCacheBag = z.infer<typeof cacheSchema>

async function readBag(): Promise<PortraitNarrativeCacheBag> {
  const bag = await readChromeStorageLocal(PORTRAIT_NARRATIVE_CACHE_STORAGE_KEY, cacheSchema)
  return bag ?? { entries: {} }
}

/** 按签名读取缓存；locale 不一致视为未命中。 */
export async function readPortraitNarrativeCache(
  signature: string,
  locale: 'en' | 'zh_CN'
): Promise<string | null> {
  if (!signature) {
    return null
  }
  const bag = await readBag()
  const hit = bag.entries[signature]
  if (!hit || hit.locale !== locale) {
    return null
  }
  return hit.text
}

/** 写入通过审核的 LLM 文案。 */
export async function writePortraitNarrativeCache(
  signature: string,
  locale: 'en' | 'zh_CN',
  text: string
): Promise<void> {
  if (!signature || !text.trim()) {
    return
  }
  const bag = await readBag()
  bag.entries[signature] = { text: text.trim(), locale }
  // 简易上限：超过 40 条丢弃最旧插入序（Object 键序）
  const keys = Object.keys(bag.entries)
  if (keys.length > 40) {
    for (const key of keys.slice(0, keys.length - 40)) {
      delete bag.entries[key]
    }
  }
  await writeChromeStorageLocal(PORTRAIT_NARRATIVE_CACHE_STORAGE_KEY, bag)
}
