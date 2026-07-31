/**
 * 将 ClueFlowTrace 接到基础设施 logger（SW / 页面控制台可见）。
 */

import type { ClueFlowTrace } from '@/core/recall/understand/clue-flow-trace'
import { logger } from '@/infrastructure/logging/logger'

/** 默认 scope：过滤控制台时可搜 Yiveno:RecallFlow */
export function createRecallFlowTrace(scope = 'RecallFlow'): ClueFlowTrace {
  return (level, step, data) => {
    if (data === undefined) {
      logger[level](scope, step)
      return
    }
    logger[level](scope, step, data)
  }
}
