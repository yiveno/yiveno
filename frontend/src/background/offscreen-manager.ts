/**
 * Offscreen Document 管理器（re-export）
 *
 * ⚠️ 实际实现已移至 @/infrastructure/offscreen/manager
 * 此文件仅作向后兼容的 re-export
 */

export {
  ensureOffscreenDocument,
  dispatchOffscreenRequest,
  disposeOffscreenDocument,
  OffscreenManager
} from '@/infrastructure/offscreen/manager'

export type {
  OffscreenReason,
  OffscreenTaskType,
  OffscreenRequest,
  OffscreenResponse
} from '@/infrastructure/offscreen/manager'
