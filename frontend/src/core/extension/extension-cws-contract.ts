/**
 * Chrome Web Store 披露 ↔ manifest 权威对照表。
 * 改 manifest 权限/host_permissions 须同批更新 `CHROMEWEBSTORE.md` 与本文件。
 */
import { EXTENSION_CWS_HOST_PERMISSIONS_DEVELOPMENT } from '@/core/extension/extension-manifest-profile'

export const EXTENSION_CWS_PERMISSIONS = [
  'storage',
  'alarms',
  'activeTab',
  'bookmarks',
  'contextMenus',
  'scripting',
  'tabs',
  'sidePanel',
  'favicon'
] as const

/** public/manifest.json 开发源（含 localhost API）。 */
export const EXTENSION_CWS_HOST_PERMISSIONS = EXTENSION_CWS_HOST_PERMISSIONS_DEVELOPMENT

/** content_scripts 产物名（须与 CHROMEWEBSTORE「Content scripts」表一致）。 */
export const EXTENSION_CWS_CONTENT_SCRIPT_JS = 'content-selection-toolbar.js' as const

/** 商店短描述与 _locales/en `app_description` 同源。 */
export const EXTENSION_CWS_SHORT_DESCRIPTION = 'Save what matters. Recall it later.' as const

/** 相对仓库根的 CWS 元数据路径。 */
export const CHROMEWEBSTORE_DOC_PATH = 'CHROMEWEBSTORE.md' as const
