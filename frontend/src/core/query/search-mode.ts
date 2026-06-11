/**
 * 书签检索模式：Free 仅 FlexSearch；Pro + 语义开关开启时为 Hybrid
 */

import { AUTH_STORAGE_KEY } from '@/config/auth-sync-env'
import { parseWebsiteAuthStorage } from '@/config/auth-sync-session'
import { isSemanticSearchEnabled, SEMANTIC_SEARCH_STORAGE_KEY } from '@/core/ai/ai-feature-settings'
import type { SearchStrategy } from '@/types/domain/query'

/** 订阅缓存键（与 useSubscription 一致） */
export const SUBSCRIPTION_CACHE_KEY = 'ottersage_subscription_cache'

/** 对外有效检索策略（与 SearchStrategy 一致） */
export type EffectiveSearchStrategy = SearchStrategy

/** 检索权限快照 */
export interface SearchModeSnapshot {
  isLoggedIn: boolean
  isPro: boolean
  semanticSearchEnabled: boolean
}

interface SubscriptionCachePayload {
  subscriptionStatus?: {
    tier?: string
    status?: string
  } | null
}

/**
 * 根据登录态、Pro 与语义开关解析有效检索策略
 */
export function resolveSearchStrategyFromSnapshot(
  snapshot: SearchModeSnapshot
): EffectiveSearchStrategy {
  if (snapshot.isLoggedIn && snapshot.isPro && snapshot.semanticSearchEnabled) {
    return 'hybrid'
  }
  return 'flexsearch'
}

/**
 * 从 chrome.storage.local 原始条目解析登录态（Service Worker / Background 可用）
 */
export function parseIsLoggedInFromAuthStorage(raw: unknown): boolean {
  if (typeof raw !== 'string' || !raw.trim()) return false
  return parseWebsiteAuthStorage(raw) !== null
}

/**
 * 从订阅缓存解析 Pro 状态
 */
export function parseIsProFromSubscriptionCache(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false
  const cache = raw as SubscriptionCachePayload
  return cache.subscriptionStatus?.tier === 'pro' && cache.subscriptionStatus?.status === 'active'
}

/**
 * 从 chrome.storage.local 读取检索权限快照
 */
export async function readSearchModeSnapshotFromStorage(): Promise<SearchModeSnapshot> {
  const stored = await chrome.storage.local.get([
    AUTH_STORAGE_KEY,
    SUBSCRIPTION_CACHE_KEY,
    SEMANTIC_SEARCH_STORAGE_KEY
  ])

  return {
    isLoggedIn: parseIsLoggedInFromAuthStorage(stored[AUTH_STORAGE_KEY]),
    isPro: parseIsProFromSubscriptionCache(stored[SUBSCRIPTION_CACHE_KEY]),
    semanticSearchEnabled: isSemanticSearchEnabled(stored[SEMANTIC_SEARCH_STORAGE_KEY])
  }
}

/**
 * 解析当前有效检索策略（统一入口）
 */
export async function resolveEffectiveSearchStrategy(): Promise<EffectiveSearchStrategy> {
  const snapshot = await readSearchModeSnapshotFromStorage()
  return resolveSearchStrategyFromSnapshot(snapshot)
}

/**
 * 是否应执行 Embedding 同步（仅 Pro 开启语义检索时）
 */
export async function shouldSyncBookmarkEmbeddings(): Promise<boolean> {
  return (await resolveEffectiveSearchStrategy()) === 'hybrid'
}
