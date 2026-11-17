import { describe, expect, it } from 'vitest'
import {
  resolveRecallFailedResponseCopy,
  resolveRecallThrownCopy
} from '@/pages/sidepanel/resolve-recall-failed-copy'

const OFFLINE = '网络已断开，Recall 需要联网。请联网后再试。'
const ONLINE_FAILED = 'Recall 暂时失败，请稍后再试。'
const MAPPED = 'mapped_recall_error'

describe('resolveRecallFailedResponseCopy', () => {
  it('RECALL_FAILED + 离线 → 离线文案', () => {
    expect(
      resolveRecallFailedResponseCopy({
        errorCode: 'RECALL_FAILED',
        browserOnline: false,
        offlineMessage: OFFLINE,
        mappedErrorMessage: MAPPED
      })
    ).toBe(OFFLINE)
  })

  it('RECALL_FAILED + 在线 → mapped（非离线文案）', () => {
    expect(
      resolveRecallFailedResponseCopy({
        errorCode: 'RECALL_FAILED',
        browserOnline: true,
        offlineMessage: OFFLINE,
        mappedErrorMessage: MAPPED
      })
    ).toBe(MAPPED)
  })

  it('其它 errorCode + 离线 → 仍用 mapped（不误盖离线）', () => {
    expect(
      resolveRecallFailedResponseCopy({
        errorCode: 'QUOTA_EXCEEDED',
        browserOnline: false,
        offlineMessage: OFFLINE,
        mappedErrorMessage: MAPPED
      })
    ).toBe(MAPPED)
  })
})

describe('resolveRecallThrownCopy', () => {
  it('离线 → 离线文案', () => {
    expect(
      resolveRecallThrownCopy({
        browserOnline: false,
        offlineMessage: OFFLINE,
        onlineFailedMessage: ONLINE_FAILED
      })
    ).toBe(OFFLINE)
  })

  it('在线 → 通用失败文案', () => {
    expect(
      resolveRecallThrownCopy({
        browserOnline: true,
        offlineMessage: OFFLINE,
        onlineFailedMessage: ONLINE_FAILED
      })
    ).toBe(ONLINE_FAILED)
  })
})
