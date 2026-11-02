/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  CLUE_URL_CHIP_ATTR,
  insertPlainTextAtClueCaret,
  maybeRebuildClueEditorChips,
  serializeClueEditorPlain,
  setClueEditorFromPlainText
} from '@/pages/sidepanel/composer/clue-editor-dom'

vi.mock('@/infrastructure/browser/chrome-favicon', () => ({
  getChromeFaviconUrl: (pageUrl: string) => `mock-favicon://${pageUrl}`
}))

describe('clue-editor 粘贴 / 往返', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it('粘贴长 URL 后收芯片，序列化为完整 https', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    root.contentEditable = 'true'
    document.body.appendChild(root)

    const pasted = 'https://en.wikipedia.org/wiki/Hydration_reaction?utm_source=test&x=1'
    insertPlainTextAtClueCaret(root, pasted)
    maybeRebuildClueEditorChips(root, serializeClueEditorPlain(root), {
      chipTrailing: true
    })

    const chip = root.querySelector(`[${CLUE_URL_CHIP_ATTR}]`)
    expect(chip).not.toBeNull()
    expect(chip?.getAttribute(CLUE_URL_CHIP_ATTR)).toMatch(/^https:\/\/en\.wikipedia\.org\//)
    expect(serializeClueEditorPlain(root)).toMatch(/^https:\/\/en\.wikipedia\.org\//)
    expect(chip?.textContent ?? '').toContain('en.wikipedia.org')
  })

  it('口语 + URL 混排 setFromPlainText 往返稳定', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const plain = 'that article https://example.com/docs/guide please'
    setClueEditorFromPlainText(root, plain, { chipTrailing: true })
    const again = serializeClueEditorPlain(root)
    expect(again).toBe('that article https://example.com/docs/guide please')
    setClueEditorFromPlainText(root, again, { chipTrailing: true })
    expect(serializeClueEditorPlain(root)).toBe(again)
    expect(root.querySelectorAll(`[${CLUE_URL_CHIP_ATTR}]`).length).toBe(1)
  })

  it('prefill 清空后无残留芯片', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    setClueEditorFromPlainText(root, 'https://example.com/', { chipTrailing: true })
    expect(root.querySelector(`[${CLUE_URL_CHIP_ATTR}]`)).not.toBeNull()
    setClueEditorFromPlainText(root, '', { chipTrailing: true })
    expect(serializeClueEditorPlain(root)).toBe('')
    expect(root.querySelector(`[${CLUE_URL_CHIP_ATTR}]`)).toBeNull()
  })
})
