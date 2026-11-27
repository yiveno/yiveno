/**
 * 轻量确定性哈希（报告可复现对拍用）。
 */

import { stringHashU32 } from '../string-hash-u32'
import type { ArmCaseResult } from './types'

/** 逐条排名指纹：taskId|arm|rank|top1|rankedIds。 */
export function hashArmCaseResults(cases: readonly ArmCaseResult[]): string {
  const lines = [...cases]
    .map(
      row =>
        `${row.taskId}\t${row.arm}\t${row.rank ?? 'miss'}\t${row.top1Id ?? ''}\t${row.rankedIds.join(',')}`
    )
    .sort()
  const joined = lines.join('\n')
  const h1 = stringHashU32(joined)
  const h2 = stringHashU32(`${joined}::tail`)
  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`
}
