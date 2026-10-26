import type { MessageKey } from '@/infrastructure/i18n/message-keys'
import { applyDocumentLocale } from '@/infrastructure/i18n/apply-document-locale'
import { initUiLocaleFromSettings, t } from '@/infrastructure/i18n/t'
import { logger } from '@/infrastructure/logging/logger'

/** 扩展 HTML 页面入口 id（与 Vite 多页入口一一对应）。 */
export type ExtensionPageId = 'sidepanel' | 'settings' | 'library' | 'detail' | 'getting_started'

/** Content script bundle id（独立入口，无 document title）。 */
export type ContentScriptBundleId = 'selection_toolbar'

const EXTENSION_PAGE_TITLE_KEYS: Record<ExtensionPageId, MessageKey> = {
  sidepanel: 'page_title_sidepanel',
  settings: 'page_title_settings',
  library: 'page_title_library',
  detail: 'page_title_detail',
  getting_started: 'page_title_getting_started'
}

/**
 * 各扩展页首屏关键文案：缺 dist/_locales 同步时会露出 raw key。
 * 含页面 title、主导航与首屏 landmark，不含全量 MESSAGE_KEYS。
 */
const CRITICAL_MESSAGE_KEYS_BY_PAGE: Record<ExtensionPageId, readonly MessageKey[]> = {
  sidepanel: [
    'popup_dismiss_candidates',
    'popup_outcome_exit_prompt',
    'popup_outcome_exit_found',
    'popup_outcome_exit_none',
    'nav_aria_label'
  ],
  settings: ['settings_title', 'settings_tabs_aria', 'nav_aria_label'],
  library: ['library_title', 'library_tabs_aria', 'nav_aria_label'],
  detail: ['detail_title', 'nav_aria_label'],
  getting_started: [
    'getting_started_eyebrow',
    'getting_started_consent_title',
    'getting_started_hero_title',
    'getting_started_tab_bookmarks',
    'getting_started_tab_excerpts',
    'nav_aria_label'
  ]
}

/** 划词浮层首屏关键文案（Save / Note / Try recall / 错误态）。 */
export const SELECTION_TOOLBAR_CRITICAL_MESSAGE_KEYS: readonly MessageKey[] = [
  'context_menu_save_selection',
  'selection_toolbar_add_note',
  'selection_toolbar_note_placeholder',
  'selection_toolbar_note_cancel',
  'selection_toolbar_note_save',
  'selection_toolbar_try_recall',
  'selection_toolbar_try_recall_aria',
  'selection_toolbar_try_recall_aria_generic',
  'selection_toolbar_open_recall_failed',
  'selection_toolbar_selection_gone',
  'selection_toolbar_saving',
  'selection_toolbar_failed',
  'selection_toolbar_saved',
  'selection_toolbar_saved_hint',
  'selection_toolbar_saved_hint_generic'
]

const CRITICAL_MESSAGE_KEYS_BY_CONTENT_SCRIPT: Record<
  ContentScriptBundleId,
  readonly MessageKey[]
> = {
  selection_toolbar: SELECTION_TOOLBAR_CRITICAL_MESSAGE_KEYS
}

/** 合并页面 title 与首屏关键 key，供启动门禁使用。 */
export function getCriticalMessageKeysForPage(page: ExtensionPageId): readonly MessageKey[] {
  const titleKey = EXTENSION_PAGE_TITLE_KEYS[page]
  const pageKeys = CRITICAL_MESSAGE_KEYS_BY_PAGE[page]
  return [titleKey, ...pageKeys]
}

/** 合并 content script bundle 关键 key，供启动门禁使用。 */
export function getCriticalMessageKeysForContentScript(
  bundle: ContentScriptBundleId
): readonly MessageKey[] {
  return CRITICAL_MESSAGE_KEYS_BY_CONTENT_SCRIPT[bundle]
}

/** 返回 `t(key) === key` 的 key 列表（未解析或缺文案）。 */
export function findMissingExtensionMessages(keys: readonly MessageKey[]): MessageKey[] {
  const missing: MessageKey[] = []
  for (const key of keys) {
    if (t(key) === key) {
      missing.push(key)
    }
  }
  return missing
}

/**
 * 启动时校验当前扩展页关键文案是否已由 chrome.i18n 解析。
 * 若返回 key 本身，通常是 dist/_locales 未同步 → rebuild + 刷新扩展。
 */
export function warnIfExtensionPageMessagesMissing(page: ExtensionPageId): void {
  const missing = findMissingExtensionMessages(getCriticalMessageKeysForPage(page))
  if (missing.length === 0) {
    return
  }
  logger.warn('i18n', '关键扩展页文案未解析（将露出 message key）', {
    page,
    missingKeys: missing,
    hint: '运行 extension build/build:watch 同步 dist/_locales，并在 chrome://extensions 刷新 Yiveno'
  })
}

/**
 * Content script 冷启动门禁：校验浮层关键文案是否已由 chrome.i18n 解析。
 */
export function warnIfContentScriptMessagesMissing(bundle: ContentScriptBundleId): void {
  const missing = findMissingExtensionMessages(getCriticalMessageKeysForContentScript(bundle))
  if (missing.length === 0) {
    return
  }
  logger.warn('i18n', '关键 content script 文案未解析（将露出 message key）', {
    bundle,
    missingKeys: missing,
    hint: '运行 extension build/build:watch 同步 dist/_locales，并在 chrome://extensions 刷新 Yiveno'
  })
}

/**
 * 扩展 HTML 页统一冷启动：加载语言偏好与文案目录 → document lang/title → 关键 i18n 门禁。
 */
export async function bootExtensionPage(page: ExtensionPageId): Promise<void> {
  await initUiLocaleFromSettings()
  applyDocumentLocale({ titleKey: EXTENSION_PAGE_TITLE_KEYS[page] })
  warnIfExtensionPageMessagesMissing(page)
}
