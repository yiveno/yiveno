import { describe, expect, it } from 'vitest'

import {
  isContentScriptPath,
  pathInvalidatesContentScript
} from '../../vite/extension-post-build-paths'

describe('extension-post-build-paths', () => {
  it('content / core / infra 会使 IIFE 失效', () => {
    expect(
      pathInvalidatesContentScript('/repo/frontend/src/content/selection-toolbar/main.ts')
    ).toBe(true)
    expect(pathInvalidatesContentScript('/repo/frontend/src/core/recall/foo.ts')).toBe(true)
    expect(
      pathInvalidatesContentScript('/repo/frontend/src/infrastructure/logging/logger.ts')
    ).toBe(true)
    expect(pathInvalidatesContentScript('/repo/frontend/vite/content-scripts-iife.ts')).toBe(true)
  })

  it('pages / background / application 不单独使 IIFE 失效', () => {
    expect(
      pathInvalidatesContentScript('/repo/frontend/src/pages/sidepanel/SidePanelApp.vue')
    ).toBe(false)
    expect(pathInvalidatesContentScript('/repo/frontend/src/background/main.ts')).toBe(false)
    expect(
      pathInvalidatesContentScript('/repo/frontend/src/application/recall/recall-service.ts')
    ).toBe(false)
  })

  it('isContentScriptPath 仅划词源', () => {
    expect(isContentScriptPath('/repo/frontend/src/content/selection-toolbar/main.ts')).toBe(true)
    expect(isContentScriptPath('/repo/frontend/src/core/recall/foo.ts')).toBe(false)
  })
})
