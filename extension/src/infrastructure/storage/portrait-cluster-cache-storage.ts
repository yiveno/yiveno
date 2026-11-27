/**
 * 画像语义簇划分缓存（chrome.storage.local；键 = 待确认事实签名）。
 */

import { z } from 'zod'

import {
  readChromeStorageLocal,
  writeChromeStorageLocal
} from '@/infrastructure/storage/chrome-storage-local'

export const PORTRAIT_CLUSTER_CACHE_STORAGE_KEY = 'yiveno.portraitClusterCache' as const

const clusterSchema = z.object({
  label: z.string(),
  items: z.array(z.string())
})

const cacheSchema = z.object({
  entries: z.record(
    z.string(),
    z.object({
      clusters: z.array(clusterSchema),
      locale: z.enum(['en', 'zh_CN'])
    })
  )
})

type PortraitClusterCacheBag = z.infer<typeof cacheSchema>

export type PortraitClusterCacheEntry = {
  label: string
  items: string[]
}

async function readBag(): Promise<PortraitClusterCacheBag> {
  const bag = await readChromeStorageLocal(PORTRAIT_CLUSTER_CACHE_STORAGE_KEY, cacheSchema)
  return bag ?? { entries: {} }
}

/** 按签名读取缓存；locale 不一致视为未命中。 */
export async function readPortraitClusterCache(
  signature: string,
  locale: 'en' | 'zh_CN'
): Promise<PortraitClusterCacheEntry[] | null> {
  if (!signature) {
    return null
  }
  const bag = await readBag()
  const hit = bag.entries[signature]
  if (!hit || hit.locale !== locale) {
    return null
  }
  return hit.clusters.map(c => ({ label: c.label, items: [...c.items] }))
}

/** 写入通过校验的划分。 */
export async function writePortraitClusterCache(
  signature: string,
  locale: 'en' | 'zh_CN',
  clusters: readonly PortraitClusterCacheEntry[]
): Promise<void> {
  if (!signature || clusters.length === 0) {
    return
  }
  const bag = await readBag()
  bag.entries[signature] = {
    clusters: clusters.map(c => ({ label: c.label, items: [...c.items] })),
    locale
  }
  const keys = Object.keys(bag.entries)
  if (keys.length > 40) {
    for (const key of keys.slice(0, keys.length - 40)) {
      delete bag.entries[key]
    }
  }
  await writeChromeStorageLocal(PORTRAIT_CLUSTER_CACHE_STORAGE_KEY, bag)
}
