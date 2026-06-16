/**
 * Background 层 re-export（实现位于 infrastructure/state）
 */

export {
  STATE_KEYS,
  CURRENT_SCHEMA_VERSION,
  getDatabaseReady,
  setDatabaseReady,
  getExtensionState,
  updateExtensionState
} from '@/infrastructure/state/extension-state'

export type { StateKey, ExtensionState } from '@/infrastructure/state/extension-state'
