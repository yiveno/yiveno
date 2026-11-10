/**
 * Capture dreaming 预处理入口（application 侧再导出）。
 * 纯计算在 core；IDB 写入在 repository put 路径。
 */

export {
  buildCaptureDreamingPreprocess,
  buildDreamingDuplicateGroupId,
  type DreamingDuplicateGroupLink
} from '@/core/dreaming/capture-dreaming-preprocess'
