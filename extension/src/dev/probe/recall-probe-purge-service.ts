/**
 * DEV：清除半仿真 / 无关干扰；保留手写精选；移除种库主题文件夹（含历史沙盒夹）。
 * 仅 import.meta.env.DEV。实现委托 cleanupProbeLibrary。
 */

import {
  cleanupProbeLibrary,
  type ProbeCleanupResult
} from '@/dev/probe/recall-probe-cleanup-service'

export type PurgeProbeNoiseResult = ProbeCleanupResult

/**
 * 清除半仿真 / 无关干扰 Memory；保留手写精选；移除种库 Chrome 主题文件夹。
 */
export async function purgeProbeNoiseFromLibrary(): Promise<PurgeProbeNoiseResult> {
  return cleanupProbeLibrary({
    noiseOrDiversity: true,
    curatedProbe: false,
    allMemory: false,
    types: 'all',
    removeProbeFolder: true,
    wipeChromeBookmarkChildren: false
  })
}
