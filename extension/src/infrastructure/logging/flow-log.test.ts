import { describe, expect, it } from 'vitest'

import { WorkerApiError } from '@/infrastructure/ai/worker-api-error'
import { formatFlowError } from '@/infrastructure/logging/flow-log'

describe('formatFlowError', () => {
  it('透传 WorkerApiError 的 detail/status/code/requestId', () => {
    const error = new WorkerApiError('quota_exceeded', {
      status: 429,
      detail: 'free，今日 100/100，UTC 午夜重置',
      requestId: 'req-abc'
    })
    expect(formatFlowError(error)).toEqual({
      name: 'WorkerApiError',
      message: 'quota_exceeded',
      detail: 'free，今日 100/100，UTC 午夜重置',
      status: 429,
      code: 'quota_exceeded',
      requestId: 'req-abc'
    })
  })

  it('普通 Error 仅 name + message', () => {
    expect(formatFlowError(new Error('plain'))).toEqual({
      name: 'Error',
      message: 'plain'
    })
  })
})
