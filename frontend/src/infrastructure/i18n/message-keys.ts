/**
 * 与 `public/_locales/{en,zh_CN}/messages.json` 同步。
 * 新增文案：先改两份 messages.json，再追加本数组。
 */
export const MESSAGE_KEYS = [
  'app_name',
  'app_description',
  'context_menu_save_selection',
  'omnibox_default_suggestion',
  'omnibox_no_match',
  'command_open_recall'
] as const

/** Chrome `_locales` message key。 */
export type MessageKey = (typeof MESSAGE_KEYS)[number]

/** 可注入 core 的翻译函数（避免 core 依赖 chrome）。 */
export type TranslateFn = (key: MessageKey, substitutions?: string | string[]) => string
