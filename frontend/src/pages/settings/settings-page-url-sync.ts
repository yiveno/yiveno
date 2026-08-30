import {
  buildSettingsSectionLocationSearch,
  parseSettingsSectionFromLocationSearch,
  type SettingsSectionId
} from '@/core/settings/settings-sections'

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

/** replaceState 前判断 URL 是否真的变化。 */
export function shouldReplaceSettingsHistoryUrl(currentUrl: string, nextUrl: string): boolean {
  return currentUrl !== nextUrl
}
