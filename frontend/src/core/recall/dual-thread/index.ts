/**
 * 双线程暗线基建（core 导出面）。
 * 仅 re-export 当前调用方已用符号；Schema / 旋钮细项请直引子模块。
 */

export {
  suggestFailureStageFromDetailCodes,
  parseRecallFailureAttribution,
  assessKnownGoldRecallGap,
  attributionDraftFromGoldGap,
  type KnownGoldRecallGapInput,
  type KnownGoldRecallGapResult
} from '@/core/recall/dual-thread/recall-failure-attribution'

export {
  RECALL_ADAPTATION_CONFIG_VERSION,
  RECALL_ADAPTATION_CONFIG,
  listOmniboxForbiddenAdaptationKnobIds
} from '@/core/recall/dual-thread/recall-adaptation-config'

export {
  buildDualThreadAggregateSketch,
  type DualThreadAggregateSketch
} from '@/core/recall/dual-thread/dual-thread-aggregate'
