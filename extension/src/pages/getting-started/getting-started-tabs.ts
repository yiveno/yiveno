/** Getting Started 启动设置双源 tab（闭集）。 */

export const GETTING_STARTED_TAB_IDS = ['bookmarks', 'excerpts'] as const

/** bookmarks：书签灌库；excerpts：摘录划存 */
export type GettingStartedTabId = (typeof GETTING_STARTED_TAB_IDS)[number]

export const DEFAULT_GETTING_STARTED_TAB: GettingStartedTabId = 'bookmarks'

export function isGettingStartedTabId(value: string): value is GettingStartedTabId {
  return (GETTING_STARTED_TAB_IDS as readonly string[]).includes(value)
}
