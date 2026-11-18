/**
 * 暗线同意相关 Background handlers（ADR-027）。
 */

import {
  deleteDualThreadContributedSketches,
  getDualThreadLearningStatus,
  maybeUploadDualThreadSketch
} from '@/application/recall/dual-thread-learning-service'
import type {
  DeleteDualThreadContributedSketchesResponse,
  GetDualThreadLearningStatusResponse,
  MaybeUploadDualThreadSketchResponse
} from '@/core/messaging/dual-thread-messages'

export async function handleGetDualThreadLearningStatus(): Promise<GetDualThreadLearningStatusResponse> {
  return getDualThreadLearningStatus()
}

export async function handleDeleteDualThreadContributedSketches(): Promise<DeleteDualThreadContributedSketchesResponse> {
  return deleteDualThreadContributedSketches()
}

export async function handleMaybeUploadDualThreadSketch(): Promise<MaybeUploadDualThreadSketchResponse> {
  return maybeUploadDualThreadSketch()
}
