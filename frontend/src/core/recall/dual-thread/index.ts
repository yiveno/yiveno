/**
 * 双线程暗线基建（core 导出面）。
 */

export {
  RecallFailureStageSchema,
  RecallFailureDetailCodeSchema,
  RecallFailureAttributionSchema,
  suggestFailureStageFromDetailCodes,
  parseRecallFailureAttribution,
  assessKnownGoldRecallGap,
  attributionDraftFromGoldGap,
  type RecallFailureStage,
  type RecallFailureDetailCode,
  type RecallFailureAttribution,
  type KnownGoldRecallGapInput,
  type KnownGoldRecallGapResult
} from '@/core/recall/dual-thread/recall-failure-attribution'

export {
  RECALL_ADAPTATION_CONFIG_VERSION,
  RECALL_ADAPTATION_CONFIG,
  RecallAdaptationConfigSchema,
  getAdaptationKnob,
  listOmniboxForbiddenAdaptationKnobIds,
  type RecallAdaptationConfig,
  type RecallAdaptationKnob,
  type RecallAdaptationLayer
} from '@/core/recall/dual-thread/recall-adaptation-config'

export {
  DualThreadAggregateSketchSchema,
  buildDualThreadAggregateSketch,
  type DualThreadAggregateSketch
} from '@/core/recall/dual-thread/dual-thread-aggregate'
