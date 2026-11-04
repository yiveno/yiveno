/**
 * DEV-only：批量探针运行进度（chrome.storage.local；供 Console 轮询）。
 */

import { z } from 'zod'

import {
  readChromeStorageLocal,
  removeChromeStorageLocal,
  writeChromeStorageLocal
} from '@/infrastructure/storage/chrome-storage-local'

export const PROBE_BATCH_PROGRESS_STORAGE_KEY = 'yiveno.dev.probeBatchProgress.v1'

const progressSchema = z.object({
  runId: z.string(),
  phase: z.enum(['running', 'done', 'error']),
  current: z.number().int().min(0),
  total: z.number().int().min(0),
  lastClue: z.string().optional(),
  updatedAtIso: z.string(),
  error: z.string().optional()
})

export type ProbeBatchProgress = z.infer<typeof progressSchema>

export async function writeProbeBatchProgress(progress: ProbeBatchProgress): Promise<void> {
  await writeChromeStorageLocal(PROBE_BATCH_PROGRESS_STORAGE_KEY, progress)
}

export async function readProbeBatchProgress(): Promise<ProbeBatchProgress | null> {
  return readChromeStorageLocal(PROBE_BATCH_PROGRESS_STORAGE_KEY, progressSchema)
}

export async function clearProbeBatchProgress(): Promise<void> {
  await removeChromeStorageLocal(PROBE_BATCH_PROGRESS_STORAGE_KEY)
}
