import {
  buildSettingsSectionLocationSearch,
  parseSettingsSectionFromLocationSearch,
  type SettingsSectionId
} from '@/core/settings/settings-sections'

/** history 写入方式：首屏归一 replace；用户切 tab push；popstate 恢复 skip。 */
export type SettingsHistoryWriteMode = 'replace' | 'push' | 'skip'

/** 从 location.search 读取当前设置分区。 */
export function readSettingsSectionFromLocation(
  location: Pick<Location, 'search'>
): SettingsSectionId {
  return parseSettingsSectionFromLocationSearch(location.search)
}

/** 写入分区后的完整路径（pathname + search + hash）。 */
export function buildSettingsPageUrl(
  section: SettingsSectionId,
  location: Pick<Location, 'pathname' | 'search' | 'hash'>
): string {
  const nextSearch = buildSettingsSectionLocationSearch(section, location.search)
  return `${location.pathname}${nextSearch}${location.hash}`
}

/** 写入 history 前判断 URL 是否真的变化。 */
export function shouldWriteSettingsHistoryUrl(currentUrl: string, nextUrl: string): boolean {
  return currentUrl !== nextUrl
}

/** @deprecated 使用 shouldWriteSettingsHistoryUrl */
export const shouldReplaceSettingsHistoryUrl = shouldWriteSettingsHistoryUrl

/** 决定 tab 切换时如何写 history（popstate 恢复时 skip）。 */
export function resolveSettingsHistoryWriteMode(input: {
  isInitialSync: boolean
  fromPopstate: boolean
}): SettingsHistoryWriteMode {
  if (input.fromPopstate) {
    return 'skip'
  }
  if (input.isInitialSync) {
    return 'replace'
  }
  return 'push'
}

/** 将分区同步到地址栏；返回是否实际写入 history。 */
export function writeSettingsSectionToHistory(
  section: SettingsSectionId,
  location: Pick<Location, 'pathname' | 'search' | 'hash'>,
  history: Pick<History, 'pushState' | 'replaceState'>,
  mode: Exclude<SettingsHistoryWriteMode, 'skip'>
): boolean {
  const nextUrl = buildSettingsPageUrl(section, location)
  const currentUrl = `${location.pathname}${location.search}${location.hash}`
  if (!shouldWriteSettingsHistoryUrl(currentUrl, nextUrl)) {
    return false
  }
  if (mode === 'push') {
    history.pushState(null, '', nextUrl)
  } else {
    history.replaceState(null, '', nextUrl)
  }
  return true
}
