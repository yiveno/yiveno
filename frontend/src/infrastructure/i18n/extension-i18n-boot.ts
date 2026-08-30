import type { MessageKey } from '@/infrastructure/i18n/message-keys'
import { applyDocumentLocale } from '@/infrastructure/i18n/apply-document-locale'
import { t } from '@/infrastructure/i18n/t'
import { logger } from '@/infrastructure/logging/logger'

/** 扩展 HTML 页面入口 id（与 Vite 多页入口一一对应）。 */
export type ExtensionPageId = 'sidepanel' | 'settings' | 'library' | 'detail' | 'getting_started'

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
  getting_started: ['getting_started_hero_title', 'getting_started_steps_aria', 'nav_aria_label']
}

/** 合并页面 title 与首屏关键 key，供启动门禁使用。 */
export function getCriticalMessageKeysForPage(page: ExtensionPageId): readonly MessageKey[] {
  const titleKey = EXTENSION_PAGE_TITLE_KEYS[page]
  const pageKeys = CRITICAL_MESSAGE_KEYS_BY_PAGE[page]
  return [titleKey, ...pageKeys]
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
    hint: '运行 frontend build/build:watch 同步 dist/_locales，并在 chrome://extensions 刷新 Yiveno'
  })
}

/**
 * 扩展 HTML 页统一冷启动：document lang/title + 关键 i18n 门禁。
 */
export function bootExtensionPage(page: ExtensionPageId): void {
  applyDocumentLocale({ titleKey: EXTENSION_PAGE_TITLE_KEYS[page] })
  warnIfExtensionPageMessagesMissing(page)
}
