/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  CLUE_EDITOR_ZWSP,
  CLUE_URL_CHIP_ATTR,
  ensureClueEditorCaretSlots,
  maybeRebuildClueEditorChips,
  serializeClueEditorPlain,
  setClueEditorFromPlainText
} from '@/pages/sidepanel/composer/clue-editor-dom'

vi.mock('@/infrastructure/browser/chrome-favicon', () => ({
  getChromeFaviconUrl: (pageUrl: string) => `chrome-extension://test/_favicon/?pageUrl=${pageUrl}`
}))

describe('clue-editor-dom', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it('setFromPlainText 收 URL 芯片且序列化回完整 href', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    setClueEditorFromPlainText(root, 'open https://example.com/a now', { chipTrailing: true })
    const chip = root.querySelector(`[${CLUE_URL_CHIP_ATTR}]`)
    expect(chip).not.toBeNull()
    expect(chip?.getAttribute(CLUE_URL_CHIP_ATTR)).toBe('https://example.com/a')
    expect(serializeClueEditorPlain(root)).toBe('open https://example.com/a now')
  })

  it('拒绝把 javascript 收成芯片', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    setClueEditorFromPlainText(root, 'x javascript:alert(1) y', { chipTrailing: true })
    expect(root.querySelector(`[${CLUE_URL_CHIP_ATTR}]`)).toBeNull()
    expect(serializeClueEditorPlain(root)).toContain('javascript:alert(1)')
  })

  it('maybeRebuild：空格后的 URL 收芯片', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    root.textContent = 'go https://example.com/z '
    const rebuilt = maybeRebuildClueEditorChips(root, serializeClueEditorPlain(root), {
      chipTrailing: false
    })
    expect(rebuilt).toBe(true)
    expect(root.querySelector(`[${CLUE_URL_CHIP_ATTR}]`)).not.toBeNull()
  })

  it('仅 URL 芯片后有 ZWSP 插入点；序列化不含 ZWSP', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    setClueEditorFromPlainText(root, 'https://example.com/', { chipTrailing: true })
    const chip = root.querySelector(`[${CLUE_URL_CHIP_ATTR}]`)
    expect(chip).not.toBeNull()
    ensureClueEditorCaretSlots(root)
    const next = chip?.nextSibling
    expect(next?.nodeType).toBe(Node.TEXT_NODE)
    expect(next?.textContent).toContain(CLUE_EDITOR_ZWSP)
    expect(serializeClueEditorPlain(root)).toBe('https://example.com/')
  })

  it('maybeRebuild：URL 后中文保持芯片 + 文本', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    setClueEditorFromPlainText(root, 'https://example.com/', { chipTrailing: true })
    // 模拟芯片后键入
    root.appendChild(document.createTextNode('跟'))
    const rebuilt = maybeRebuildClueEditorChips(root, serializeClueEditorPlain(root), {
      chipTrailing: false
    })
    expect(rebuilt).toBe(true)
    expect(root.querySelector(`[${CLUE_URL_CHIP_ATTR}]`)?.getAttribute(CLUE_URL_CHIP_ATTR)).toBe(
      'https://example.com/'
    )
    expect(serializeClueEditorPlain(root)).toBe('https://example.com/跟')
  })
})
