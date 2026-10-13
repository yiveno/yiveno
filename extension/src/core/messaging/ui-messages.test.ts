import { describe, expect, it } from 'vitest'

import {
  isUiScopedMessage,
  parseChromeBookmarkTreeChangedMessage,
  parseRecallVisibleProgressMessage,
  UI_MESSAGE_SCOPE
} from '@/core/messaging/ui-messages'

describe('ui-messages', () => {
  it('解析 CHROME_BOOKMARK_TREE_CHANGED', () => {
    expect(
      parseChromeBookmarkTreeChangedMessage({
        scope: UI_MESSAGE_SCOPE,
        type: 'CHROME_BOOKMARK_TREE_CHANGED'
      })
    ).toEqual({ scope: 'ui', type: 'CHROME_BOOKMARK_TREE_CHANGED' })
  })

  it('解析 RECALL_VISIBLE_PROGRESS', () => {
    expect(
      parseRecallVisibleProgressMessage({
        scope: UI_MESSAGE_SCOPE,
        type: 'RECALL_VISIBLE_PROGRESS',
        payload: { progressRequestId: 'req-1', stage: 'narrowing' }
      })
    ).toEqual({
      scope: 'ui',
      type: 'RECALL_VISIBLE_PROGRESS',
      payload: { progressRequestId: 'req-1', stage: 'narrowing' }
    })
  })

  it('拒绝 background scope 与未知 type', () => {
    expect(
      parseChromeBookmarkTreeChangedMessage({
        scope: 'background',
        type: 'CHROME_BOOKMARK_TREE_CHANGED'
      })
    ).toBeNull()
    expect(
      parseChromeBookmarkTreeChangedMessage({
        scope: UI_MESSAGE_SCOPE,
        type: 'UNKNOWN'
      })
    ).toBeNull()
    expect(
      parseRecallVisibleProgressMessage({
        scope: UI_MESSAGE_SCOPE,
        type: 'RECALL_VISIBLE_PROGRESS',
        payload: { progressRequestId: 'x', stage: 'thinking' }
      })
    ).toBeNull()
    expect(isUiScopedMessage({ scope: 'ui', type: 'x' })).toBe(true)
    expect(isUiScopedMessage({ scope: 'background', type: 'x' })).toBe(false)
  })
})
