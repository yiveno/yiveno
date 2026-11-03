/** 设置页左侧分区 id（与 `?section=` 一致）。 */
export type SettingsSectionId =
  | 'capture' // 保存：划词浮层 / 书签灌库
  | 'shortcuts' // 快捷键：展示绑定；改键跳转 Chrome 原生页
  | 'account_sync' // 账户与同步：同步 / 冲突 / 孤儿桶 / 退出
  | 'privacy' // 数据与隐私：说明 / MCP / 政策外链 / 导入备份 / 本机适应 / 清除删除
  | 'ai' // AI：开关与模型说明
  | 'language' // 界面语言：system / en / zh_CN

/** 设置分区文案 key（由 UI `t()` 解析；core 不依赖 chrome）。 */
export interface SettingsSectionTabDef {
  id: SettingsSectionId
  labelKey:
    | 'settings_tab_capture'
    | 'settings_tab_shortcuts'
    | 'settings_tab_account_sync'
    | 'settings_tab_privacy'
    | 'settings_tab_ai'
    | 'settings_tab_language'
}

/** 默认分区：划词保存相关开关。 */
export const DEFAULT_SETTINGS_SECTION: SettingsSectionId = 'capture'

/**
 * Settings 深链 hash：滚到书签灌库开关（Side Panel 空库「导入」链接）。
 * 对应 DOM `id`；打开 `settings.html#…`（capture 为默认分区，无需 `?section=`）。
 */
export const SETTINGS_HASH_CHROME_BOOKMARK_INGEST = 'chrome-bookmark-ingest' as const

/** URL 查询参数：设置分区（刷新后恢复）。 */
export const SETTINGS_SECTION_QUERY_KEY = 'section'

/** 设置左侧分区定义（顺序即侧栏顺序）。 */
export const SETTINGS_SECTION_TABS: readonly SettingsSectionTabDef[] = [
  { id: 'capture', labelKey: 'settings_tab_capture' },
  { id: 'shortcuts', labelKey: 'settings_tab_shortcuts' },
  { id: 'account_sync', labelKey: 'settings_tab_account_sync' },
  { id: 'privacy', labelKey: 'settings_tab_privacy' },
  { id: 'ai', labelKey: 'settings_tab_ai' },
  { id: 'language', labelKey: 'settings_tab_language' }
] as const

/**
 * 旧深链别名 → 现分区。
 * `usage` → 保存；`data` → 数据与隐私（原独立「数据」已并入 `privacy`）。
 */
const LEGACY_SECTION_ALIASES: Readonly<Record<string, SettingsSectionId>> = {
  usage: 'capture',
  data: 'privacy'
}

/** 解析分区定义；非法值回退默认「保存」。 */
export function resolveSettingsSectionTab(id: string | null | undefined): SettingsSectionTabDef {
  const normalized = id == null ? '' : (LEGACY_SECTION_ALIASES[id] ?? id)
  const found = SETTINGS_SECTION_TABS.find(tab => tab.id === normalized)
  return found ?? SETTINGS_SECTION_TABS[0]!
}

/** search 是否显式带了 section（用于冲突时是否自动跳转）。 */
export function hasSettingsSectionInLocationSearch(search: string): boolean {
  const normalized = search.startsWith('?') ? search.slice(1) : search
  const value = new URLSearchParams(normalized).get(SETTINGS_SECTION_QUERY_KEY)
  return value != null && value.trim().length > 0
}

/** 从 location.search 解析设置分区。 */
export function parseSettingsSectionFromLocationSearch(search: string): SettingsSectionId {
  const normalized = search.startsWith('?') ? search.slice(1) : search
  const value = new URLSearchParams(normalized).get(SETTINGS_SECTION_QUERY_KEY)
  return resolveSettingsSectionTab(value).id
}

/**
 * 将设置分区写入 search 字符串。
 * 默认「保存」时去掉 section，避免多余 `?section=capture`。
 */
export function buildSettingsSectionLocationSearch(
  section: SettingsSectionId,
  currentSearch = ''
): string {
  const normalized = currentSearch.startsWith('?') ? currentSearch.slice(1) : currentSearch
  const params = new URLSearchParams(normalized)
  if (section === DEFAULT_SETTINGS_SECTION) {
    params.delete(SETTINGS_SECTION_QUERY_KEY)
  } else {
    params.set(SETTINGS_SECTION_QUERY_KEY, section)
  }
  const query = params.toString()
  return query ? `?${query}` : ''
}
