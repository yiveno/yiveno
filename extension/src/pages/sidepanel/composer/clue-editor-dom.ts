/**
 * Contenteditable clue 编辑器：纯文本 ↔ DOM（含 URL 原子芯片）。
 * 不依赖 Vue；芯片节点 contenteditable=false。
 */

import { getChromeFaviconUrl } from '@/infrastructure/browser/chrome-favicon'
import {
  formatClueUrlDisplayLabel,
  parseCluePlainSegments,
  type CluePlainSegment,
  type ParseCluePlainSegmentsOptions
} from '@/pages/sidepanel/composer/clue-url'

/** 芯片根节点标记。 */
export const CLUE_URL_CHIP_ATTR = 'data-clue-url'

/** 芯片 class（与 CSS / 气泡共用）。 */
export const CLUE_URL_CHIP_CLASS = 'clue-url-chip'

/**
 * 芯片后占位的零宽空格：保证 ce=false 芯片后有可编辑插入点。
 * 序列化时剥离；不进入 clue 文案。
 */
export const CLUE_EDITOR_ZWSP = '\u200B'

/**
 * 从 contenteditable 根序列化为 clue 纯文本（芯片 → 完整 href；br/块 → \\n）。
 */
export function serializeClueEditorPlain(root: HTMLElement): string {
  let out = ''

  const walk = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += (node.textContent ?? '').replaceAll(CLUE_EDITOR_ZWSP, '')
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return
    }
    const el = node as HTMLElement
    if (el.hasAttribute(CLUE_URL_CHIP_ATTR)) {
      const href = el.getAttribute(CLUE_URL_CHIP_ATTR)?.trim() ?? ''
      if (href) {
        out += href
      }
      return
    }
    if (el.tagName === 'BR') {
      out += '\n'
      return
    }
    const isBlock = el.tagName === 'DIV' || el.tagName === 'P' || el.tagName === 'LI'
    if (isBlock && el !== root && out.length > 0 && !out.endsWith('\n')) {
      out += '\n'
    }
    for (const child of Array.from(el.childNodes)) {
      walk(child)
    }
  }

  walk(root)
  return out
}

/**
 * 创建不可编辑的 URL 芯片（favicon + 缩短文案）。
 */
export function createClueUrlChipElement(href: string): HTMLSpanElement {
  const chip = document.createElement('span')
  chip.className = CLUE_URL_CHIP_CLASS
  chip.contentEditable = 'false'
  chip.setAttribute(CLUE_URL_CHIP_ATTR, href)
  chip.setAttribute('role', 'link')
  chip.setAttribute('tabindex', '-1')
  chip.setAttribute('aria-label', href)
  chip.title = href

  const favicon = document.createElement('img')
  favicon.className = `${CLUE_URL_CHIP_CLASS}__favicon`
  favicon.alt = ''
  favicon.draggable = false
  try {
    favicon.src = getChromeFaviconUrl(href, 16)
  } catch {
    // 测试/无 chrome 时无图标
  }
  favicon.addEventListener('error', () => {
    favicon.hidden = true
  })

  const label = document.createElement('span')
  label.className = `${CLUE_URL_CHIP_CLASS}__label`
  label.textContent = formatClueUrlDisplayLabel(href)

  chip.append(favicon, label)
  return chip
}

/**
 * 芯片后确保有可编辑文本节点（已有普通字则不动；否则补 ZWSP）。
 */
export function ensureZwspAfterClueUrlChip(chip: HTMLElement): Text {
  const next = chip.nextSibling
  if (next?.nodeType === Node.TEXT_NODE) {
    return next as Text
  }
  const zwsp = document.createTextNode(CLUE_EDITOR_ZWSP)
  chip.parentNode?.insertBefore(zwsp, next)
  return zwsp
}

/** 遍历根下所有芯片，补齐其后插入点。 */
export function ensureClueEditorCaretSlots(root: HTMLElement): void {
  const chips = root.querySelectorAll(`[${CLUE_URL_CHIP_ATTR}]`)
  for (const chip of chips) {
    ensureZwspAfterClueUrlChip(chip as HTMLElement)
  }
}

/** 选区是否落在某 URL 芯片内部（打字会进芯片 → 须改插到芯片后）。 */
export function findClueUrlChipContainingSelection(root: HTMLElement): HTMLElement | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) {
    return null
  }
  const node = selection.getRangeAt(0).startContainer
  const el = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement
  if (!el) {
    return null
  }
  const chip = el.closest(`[${CLUE_URL_CHIP_ATTR}]`)
  if (!chip || !root.contains(chip)) {
    return null
  }
  return chip as HTMLElement
}

/**
 * 用片段重建编辑器 DOM（清空后写入）。
 */
export function renderClueSegmentsIntoEditor(
  root: HTMLElement,
  segments: CluePlainSegment[]
): void {
  root.replaceChildren()
  if (segments.length === 0) {
    return
  }

  for (const segment of segments) {
    if (segment.kind === 'url') {
      const chip = createClueUrlChipElement(segment.href)
      root.appendChild(chip)
      continue
    }
    appendTextWithNewlines(root, segment.text)
  }
  ensureClueEditorCaretSlots(root)
}

/** 把含 \\n 的文本拆成 text + br。 */
function appendTextWithNewlines(parent: HTMLElement, text: string): void {
  const parts = text.split('\n')
  parts.forEach((part, index) => {
    if (part) {
      parent.appendChild(document.createTextNode(part))
    }
    if (index < parts.length - 1) {
      parent.appendChild(document.createElement('br'))
    }
  })
}

/**
 * 纯文本写入编辑器并按策略收 URL 芯片。
 */
export function setClueEditorFromPlainText(
  root: HTMLElement,
  plain: string,
  options: ParseCluePlainSegmentsOptions = { chipTrailing: true }
): void {
  const segments = parseCluePlainSegments(plain, options)
  if (segments.length === 0 && plain.length === 0) {
    root.replaceChildren()
    return
  }
  // 无 URL 时仍按换行渲染，避免丢 \\n
  if (!segments.some(s => s.kind === 'url')) {
    root.replaceChildren()
    appendTextWithNewlines(root, plain)
    return
  }
  renderClueSegmentsIntoEditor(root, segments)
}

/**
 * 若纯文本相对当前 DOM 需要更多/更新 URL 芯片，则重建并返回 true。
 */
export function maybeRebuildClueEditorChips(
  root: HTMLElement,
  plain: string,
  options: ParseCluePlainSegmentsOptions
): boolean {
  const segments = parseCluePlainSegments(plain, options)
  const wantsUrl = segments.some(s => s.kind === 'url')
  const hasChip = Boolean(root.querySelector(`[${CLUE_URL_CHIP_ATTR}]`))
  if (!wantsUrl && !hasChip) {
    return false
  }
  const current = serializeClueEditorPlain(root)
  // 已有芯片且序列化一致、片段也只要同样 href 集合时可跳过——简化：有 URL 片段就按片段重建
  const nextPlain = segments.length
    ? segments.map(s => (s.kind === 'url' ? s.href : s.text)).join('')
    : plain
  if (wantsUrl) {
    renderClueSegmentsIntoEditor(root, segments)
    return true
  }
  if (hasChip && current !== nextPlain) {
    setClueEditorFromPlainText(root, plain, options)
    return true
  }
  if (hasChip && !wantsUrl) {
    setClueEditorFromPlainText(root, plain, { chipTrailing: false })
    return true
  }
  return false
}

/**
 * 选区在编辑器内的纯文本偏移（芯片计为完整 href 长度）。
 */
export function getClueEditorPlainCaretOffset(root: HTMLElement): number | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) {
    return null
  }
  const range = selection.getRangeAt(0)
  if (!root.contains(range.startContainer)) {
    return null
  }

  const pre = document.createRange()
  pre.selectNodeContents(root)
  pre.setEnd(range.startContainer, range.startOffset)

  return plainLengthOfRangeContents(pre.cloneContents())
}

/**
 * 按纯文本偏移放置 caret（芯片为原子，落在芯片上时跳到芯片后）。
 */
export function setClueEditorPlainCaretOffset(root: HTMLElement, offset: number): void {
  const target = Math.max(0, offset)
  let walked = 0

  const placeAt = (node: Node, localOffset: number): boolean => {
    const selection = window.getSelection()
    if (!selection) {
      return true
    }
    const range = document.createRange()
    range.setStart(node, localOffset)
    range.collapse(true)
    selection.removeAllRanges()
    selection.addRange(range)
    return true
  }

  const walk = (node: Node): boolean => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? ''
      if (walked + text.length >= target) {
        return placeAt(node, Math.min(text.length, target - walked))
      }
      walked += text.length
      return false
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return false
    }
    const el = node as HTMLElement
    if (el.hasAttribute(CLUE_URL_CHIP_ATTR)) {
      const href = el.getAttribute(CLUE_URL_CHIP_ATTR) ?? ''
      if (walked + href.length >= target) {
        // 原子：偏移落在芯片内 / 芯片末 → 放到芯片后的可编辑文本节点
        const slot = ensureZwspAfterClueUrlChip(el)
        return placeAt(slot, 0)
      }
      walked += href.length
      return false
    }
    if (el.tagName === 'BR') {
      if (walked + 1 >= target) {
        const parent = el.parentNode
        if (!parent) {
          return true
        }
        const index = Array.from(parent.childNodes).indexOf(el)
        return placeAt(parent, index + 1)
      }
      walked += 1
      return false
    }
    for (const child of Array.from(el.childNodes)) {
      if (walk(child)) {
        return true
      }
    }
    return false
  }

  if (!walk(root)) {
    // 落到末尾
    const selection = window.getSelection()
    if (!selection) {
      return
    }
    const range = document.createRange()
    range.selectNodeContents(root)
    range.collapse(false)
    selection.removeAllRanges()
    selection.addRange(range)
  }
}

function plainLengthOfRangeContents(fragment: DocumentFragment): number {
  let len = 0
  const walk = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      len += (node.textContent ?? '').replaceAll(CLUE_EDITOR_ZWSP, '').length
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return
    }
    const el = node as HTMLElement
    if (el.hasAttribute(CLUE_URL_CHIP_ATTR)) {
      len += el.getAttribute(CLUE_URL_CHIP_ATTR)?.length ?? 0
      return
    }
    if (el.tagName === 'BR') {
      len += 1
      return
    }
    for (const child of Array.from(el.childNodes)) {
      walk(child)
    }
  }
  for (const child of Array.from(fragment.childNodes)) {
    walk(child)
  }
  return len
}

/**
 * 在当前选区插入纯文本（粘贴用），返回插入后应有的完整 plain（调用方再 maybeRebuild）。
 * 若选区在芯片内，改插到芯片后。
 */
export function insertPlainTextAtClueCaret(root: HTMLElement, plainPiece: string): string {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0 || !root.contains(selection.anchorNode)) {
    const existing = serializeClueEditorPlain(root)
    const next = existing + plainPiece
    setClueEditorFromPlainText(root, next, { chipTrailing: true })
    return next
  }

  const insideChip = findClueUrlChipContainingSelection(root)
  if (insideChip) {
    const slot = ensureZwspAfterClueUrlChip(insideChip)
    const range = document.createRange()
    range.setStart(slot, 0)
    range.collapse(true)
    selection.removeAllRanges()
    selection.addRange(range)
  }

  const range = selection.getRangeAt(0)
  range.deleteContents()
  const textNode = document.createTextNode(plainPiece)
  range.insertNode(textNode)
  range.setStartAfter(textNode)
  range.collapse(true)
  selection.removeAllRanges()
  selection.addRange(range)
  ensureClueEditorCaretSlots(root)
  return serializeClueEditorPlain(root)
}
