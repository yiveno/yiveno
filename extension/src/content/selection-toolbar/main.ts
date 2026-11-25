import type { CaptureEntry } from '@/core/memory/capture-entry'
import { buildCaptureSavedPreview, buildRecallPrefillClue } from '@/core/recall/build-prefill-clue'
import { extractSelectionContextOnPage } from '@/infrastructure/browser/selection-context-page'
import {
  isGettingStartedPageUrl,
  isSavablePageUrl
} from '@/infrastructure/browser/active-tab-reader'
import { captureTextExcerpt, openRecallShell } from '@/infrastructure/messaging/background-client'
import {
  computeSelectionToolbarAnchor,
  matchNoteDraft,
  resolveScrolledSelectionAnchor,
  resolveSelectionAnchorRect,
  SELECTION_TOOLBAR_SHOW_DELAY_MS,
  shouldEvaluateSelectionOnChange,
  shouldHideToolbarOnEmptySelection,
  shouldShowSelectionToolbar,
  shouldStashNoteDraft
} from '@/content/selection-toolbar/selection-toolbar-logic'
import {
  isSelectionToolbarStatusLocked,
  type SelectionToolbarButtonState
} from '@/content/selection-toolbar/selection-toolbar-guards'
import { createSelectionToolbarScrollDismissHandler } from '@/content/selection-toolbar/selection-toolbar-scroll'
import {
  parseContentSelectionCommandMessage,
  parseContentSelectionErrorMessage,
  parseContentVoiceFeedbackMessage,
  SELECTION_TOOLBAR_KEEPALIVE_PORT,
  SELECTION_TOOLBAR_PAGE_API_KEY,
  type ContentSelectionCommandResponse,
  type ContentSelectionErrorResponse,
  type ContentVoiceFeedbackResponse,
  type SelectionToolbarCommandType,
  type SelectionToolbarPageApi
} from '@/core/messaging/content-messages'
import {
  dismissVoiceFeedbackBanner,
  showVoiceFeedbackBanner
} from '@/content/selection-toolbar/voice-feedback-banner'
import {
  DEFAULT_USER_SETTINGS,
  parseUserSettings,
  USER_SETTINGS_STORAGE_KEY
} from '@/core/settings/user-settings'
import { initUiLocaleFromSettings, t } from '@/infrastructure/i18n/t'
import { warnIfContentScriptMessagesMissing } from '@/infrastructure/i18n/extension-i18n-boot'
import { isMemoryErrorCode, tMemoryError } from '@/infrastructure/i18n/memory-error'
import type { MessageKey } from '@/infrastructure/i18n/message-keys'
import { writeRecallPrefill } from '@/infrastructure/storage/first-recall-onboarding-storage'
import {
  getAppIconNodes,
  getAppIconViewBox,
  type AppIconName
} from '@/infrastructure/ui/icons/icon-paths'
import { getSelectionToolbarShadowStyles } from '@/content/selection-toolbar/selection-toolbar-shadow-styles'

const TOOLBAR_HOST_ID = 'yiveno-selection-toolbar-host'
const NOTE_MAX_LENGTH = 500
/** 存成抓住感展示时长（含「用这段来找」按钮可读可点窗口）。 */
const SAVED_FEEDBACK_HIDE_MS = 5000

/** 划词浮层 UI 模式。 */
type ToolbarUiMode =
  | 'actions' // 操作按钮
  | 'note' // 附注输入

/** 划词浮层主按钮状态。 */
type ToolbarButtonState = SelectionToolbarButtonState

/** 打开浮层/附注时快照的选区；textarea 聚焦后页内选区会丢，保存必须用这份。 */
interface PendingSelectionCapture {
  selectedText: string
  contextBefore?: string
  contextAfter?: string
  anchorRect: { top: number; left: number; width: number; height: number }
  /** 快照时的滚动量（附注滚动跟随用） */
  scrollX: number
  scrollY: number
}

let toolbarEnabled = DEFAULT_USER_SETTINGS.selectionToolbarEnabled
let showTimer: ReturnType<typeof setTimeout> | null = null
let hideTimer: ReturnType<typeof setTimeout> | null = null
let hostElement: HTMLElement | null = null
let shadowRoot: ShadowRoot | null = null
/** 浮层外壳（量 offsetWidth 做防溢出钳制） */
let shellElement: HTMLElement | null = null
let actionsRow: HTMLElement | null = null
let notePanel: HTMLElement | null = null
/** 存成后的抓住感面板（预览 + 「用这段来找」入口）。 */
let savedFeedbackPanel: HTMLElement | null = null
let savedPreviewEl: HTMLElement | null = null
let savedHintEl: HTMLElement | null = null
let savedRecallButton: HTMLButtonElement | null = null
let saveButton: HTMLButtonElement | null = null
/** 划选「用这段来找」：选区当 clue 预填 composer，不要求先存。 */
let findButton: HTMLButtonElement | null = null
let noteButton: HTMLButtonElement | null = null
let noteInput: HTMLTextAreaElement | null = null
let noteSaveButton: HTMLButtonElement | null = null
let noteCancelButton: HTMLButtonElement | null = null
let statusButton: HTMLButtonElement | null = null
let uiMode: ToolbarUiMode = 'actions'
let buttonState: ToolbarButtonState = 'idle'
let pendingCapture: PendingSelectionCapture | null = null
/** 附注草稿：Esc/失焦/滚动出视口时 stash，同选区重开附注时恢复 */
let pendingNoteDraft: { selectedText: string; note: string } | null = null
/** 存成后「用这段来找」用的正文（保存成功后已清页内选区） */
let lastSavedSelectionText: string | null = null
/** 鼠标按下中（拖拽选词过程中 selectionchange 不评估展示） */
let mouseDown = false
/** 最近一次选区类按键时间（键盘唤出守卫） */
let lastSelectionKeyDownAt: number | null = null
/** 扩展热重载后旧 content script 仍存活时置 true，停止一切 Chrome API / DOM 交互 */
let tornDown = false
let listenersRegistered = false
/** 用于在扩展重载时立刻收到 onDisconnect，早于用户交互拆卸 */
let keepalivePort: chrome.runtime.Port | null = null
/** 页面是否正因历史导航停在 bfcache（port 已被 Chrome 主动断开）。 */
let pageFrozenInBfCache = false

const SELECTION_KEY_NAMES = [
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  'PageUp',
  'PageDown'
] as const

/**
 * 扩展重载后 `chrome.runtime.id` 会变为 undefined；
 * 继续调用 i18n / storage / sendMessage 会抛 Extension context invalidated。
 */
function isExtensionContextValid(): boolean {
  try {
    return Boolean(chrome.runtime?.id)
  } catch {
    return false
  }
}

function isContextInvalidatedError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }
  return error.message.includes('Extension context invalidated')
}

/** 上下文已失效时静默拆卸，避免控制台刷屏。 */
function ensureLiveContext(): boolean {
  if (tornDown) {
    return false
  }
  if (isExtensionContextValid()) {
    return true
  }
  teardown()
  return false
}

/**
 * 安全读文案：上下文失效时拆卸并返回 null，禁止把 i18n 异常抛到页面控制台。
 */
function safeT(key: MessageKey, substitutions?: string | string[]): string | null {
  if (!ensureLiveContext()) {
    return null
  }
  try {
    return substitutions === undefined ? t(key) : t(key, substitutions)
  } catch (error) {
    if (isContextInvalidatedError(error) || !isExtensionContextValid()) {
      teardown()
      return null
    }
    throw error
  }
}

/** 事件 / 定时器入口：吞掉上下文失效，其余错误仍抛出。 */
function runGuarded(action: () => void): void {
  if (tornDown) {
    return
  }
  try {
    if (!ensureLiveContext()) {
      return
    }
    action()
  } catch (error) {
    if (isContextInvalidatedError(error) || !isExtensionContextValid()) {
      teardown()
      return
    }
    throw error
  }
}

function clearShowTimer(): void {
  if (showTimer !== null) {
    clearTimeout(showTimer)
    showTimer = null
  }
}

function clearHideTimer(): void {
  if (hideTimer !== null) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
}

function getSelectionRect(): DOMRect | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null
  }
  const range = selection.getRangeAt(0)
  const resolved = resolveSelectionAnchorRect(range)
  if (!resolved) {
    return null
  }
  return new DOMRect(resolved.left, resolved.top, resolved.width, resolved.height)
}

function getSelectedText(): string {
  return window.getSelection()?.toString().trim() ?? ''
}

/** 在选区仍有效时写入快照；已有快照且当前选区为空则保留旧快照。 */
function capturePendingSelection(): void {
  const context = extractSelectionContextOnPage()
  const selectedText = context?.selectedText ?? getSelectedText()
  if (!selectedText) {
    return
  }

  const rect = getSelectionRect()
  const anchorRect = rect
    ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
    : (pendingCapture?.anchorRect ?? { top: 80, left: 80, width: 40, height: 20 })

  pendingCapture = {
    selectedText,
    anchorRect,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    ...(context?.contextBefore ? { contextBefore: context.contextBefore } : {}),
    ...(context?.contextAfter ? { contextAfter: context.contextAfter } : {})
  }
}

function clearPendingCapture(): void {
  pendingCapture = null
}

/** 优先用快照；页内选区仍在时再刷新一次。 */
function resolveCaptureForSave(): PendingSelectionCapture | null {
  capturePendingSelection()
  return pendingCapture
}

async function refreshToolbarEnabledFromStorage(): Promise<void> {
  if (!ensureLiveContext()) {
    return
  }
  try {
    const result = await chrome.storage.local.get(USER_SETTINGS_STORAGE_KEY)
    if (!ensureLiveContext()) {
      return
    }
    const settings = parseUserSettings(result[USER_SETTINGS_STORAGE_KEY])
    toolbarEnabled = settings.selectionToolbarEnabled
  } catch (error) {
    if (isContextInvalidatedError(error) || !isExtensionContextValid()) {
      teardown()
      return
    }
    throw error
  }
}

function preserveSelectionOnMouseDown(event: MouseEvent): void {
  event.preventDefault()
  event.stopPropagation()
}

/** 划词浮层图标按钮：可见图标 + title/aria-label 完整文案。 */
function createIconActionButton(icon: AppIconName, label: string): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'action-button action-button--icon'
  button.title = label
  button.setAttribute('aria-label', label)

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', getAppIconViewBox(icon))
  svg.setAttribute('width', '18')
  svg.setAttribute('height', '18')
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke', 'currentColor')
  svg.setAttribute('stroke-width', '2')
  svg.setAttribute('stroke-linecap', 'round')
  svg.setAttribute('stroke-linejoin', 'round')
  svg.setAttribute('aria-hidden', 'true')
  svg.classList.add('action-icon')

  for (const [tag, attrs] of getAppIconNodes(icon)) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag)
    for (const [key, value] of Object.entries(attrs)) {
      el.setAttribute(key, value)
    }
    svg.appendChild(el)
  }
  button.appendChild(svg)
  return button
}

function ensureToolbarHost(): void {
  if (!ensureLiveContext()) {
    return
  }
  if (hostElement?.isConnected) {
    return
  }

  // 扩展热重载后旧 host 可能残留；先清再挂，避免只剩旧版单按钮
  document.getElementById(TOOLBAR_HOST_ID)?.remove()

  const saveLabel = safeT('context_menu_save_selection')
  const findLabel = safeT('selection_toolbar_try_recall')
  const noteLabel = safeT('selection_toolbar_add_note')
  const notePlaceholder = safeT('selection_toolbar_note_placeholder')
  if (saveLabel === null || findLabel === null || noteLabel === null || notePlaceholder === null) {
    return
  }

  hostElement = document.createElement('div')
  hostElement.id = TOOLBAR_HOST_ID
  hostElement.style.position = 'fixed'
  hostElement.style.top = '0'
  hostElement.style.left = '0'
  hostElement.style.zIndex = '2147483646'
  hostElement.style.pointerEvents = 'none'

  shadowRoot = hostElement.attachShadow({ mode: 'closed' })

  const style = document.createElement('style')
  style.textContent = getSelectionToolbarShadowStyles()

  actionsRow = document.createElement('div')
  actionsRow.className = 'toolbar'
  actionsRow.setAttribute('role', 'toolbar')
  actionsRow.setAttribute('aria-label', `${saveLabel}. ${findLabel}. ${noteLabel}`)

  saveButton = createIconActionButton('bookmark_add', saveLabel)
  saveButton.addEventListener('mousedown', preserveSelectionOnMouseDown)
  saveButton.addEventListener('click', event => {
    event.preventDefault()
    event.stopPropagation()
    void handleSaveClick()
  })

  const dividerAfterSave = document.createElement('span')
  dividerAfterSave.className = 'divider'
  dividerAfterSave.setAttribute('aria-hidden', 'true')

  // 选区当 clue 开 Recall（不必先存）；GS 页隐藏，避免与 Step 2 抢路径
  findButton = createIconActionButton('format_quote', findLabel)
  findButton.addEventListener('mousedown', preserveSelectionOnMouseDown)
  findButton.addEventListener('click', event => {
    event.preventDefault()
    event.stopPropagation()
    void handleFindWithSelectionClick()
  })

  const dividerAfterFind = document.createElement('span')
  dividerAfterFind.className = 'divider'
  dividerAfterFind.setAttribute('aria-hidden', 'true')

  noteButton = createIconActionButton('edit_note', noteLabel)
  noteButton.addEventListener('mousedown', preserveSelectionOnMouseDown)
  noteButton.addEventListener('click', event => {
    event.preventDefault()
    event.stopPropagation()
    openNotePanel()
  })

  statusButton = document.createElement('button')
  statusButton.type = 'button'
  statusButton.className = 'status-button is-hidden'
  statusButton.disabled = true

  actionsRow.append(
    saveButton,
    dividerAfterSave,
    findButton,
    dividerAfterFind,
    noteButton,
    statusButton
  )
  syncFindButtonVisibility()

  notePanel = document.createElement('div')
  notePanel.className = 'note-panel'

  noteInput = document.createElement('textarea')
  noteInput.className = 'note-input'
  noteInput.rows = 2
  noteInput.maxLength = NOTE_MAX_LENGTH
  noteInput.placeholder = notePlaceholder
  noteInput.setAttribute('aria-label', notePlaceholder)
  noteInput.addEventListener('mousedown', event => {
    // 聚焦输入时保留页内选区，避免浮层一开选区就丢
    event.stopPropagation()
  })
  noteInput.addEventListener('keydown', event => {
    event.stopPropagation()
    if (event.key === 'Escape') {
      event.preventDefault()
      closeNotePanel()
      return
    }
    // Enter 保存；Shift+Enter 换行；IME 合成中不触发
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault()
      void handleSaveClick({ withNote: true })
    }
  })
  noteInput.addEventListener('blur', () => {
    // 延迟一拍：让 Enter 保存先进入 saving，避免失焦误取消
    window.setTimeout(() => {
      if (tornDown || !ensureLiveContext()) {
        return
      }
      if (uiMode !== 'note') {
        return
      }
      if (buttonState === 'saving' || buttonState === 'saved' || buttonState === 'error') {
        return
      }
      closeNotePanel()
    }, 0)
  })

  const noteActions = document.createElement('div')
  noteActions.className = 'note-actions'

  noteSaveButton = document.createElement('button')
  noteSaveButton.type = 'button'
  noteSaveButton.className = 'note-action-button note-action-button--primary'
  noteSaveButton.textContent = safeT('selection_toolbar_note_save') ?? 'Save'
  noteSaveButton.addEventListener('mousedown', preserveSelectionOnMouseDown)
  noteSaveButton.addEventListener('click', event => {
    event.preventDefault()
    event.stopPropagation()
    void handleSaveClick({ withNote: true })
  })

  noteCancelButton = document.createElement('button')
  noteCancelButton.type = 'button'
  noteCancelButton.className = 'note-action-button'
  noteCancelButton.textContent = safeT('selection_toolbar_note_cancel') ?? 'Cancel'
  noteCancelButton.addEventListener('mousedown', preserveSelectionOnMouseDown)
  noteCancelButton.addEventListener('click', event => {
    event.preventDefault()
    event.stopPropagation()
    closeNotePanel()
  })

  noteActions.append(noteSaveButton, noteCancelButton)
  notePanel.append(noteInput, noteActions)

  savedFeedbackPanel = document.createElement('div')
  savedFeedbackPanel.className = 'saved-feedback'
  savedPreviewEl = document.createElement('p')
  savedPreviewEl.className = 'saved-preview'
  savedHintEl = document.createElement('p')
  savedHintEl.className = 'saved-hint'
  savedHintEl.classList.add('is-hidden')
  savedRecallButton = document.createElement('button')
  savedRecallButton.type = 'button'
  savedRecallButton.className = 'saved-recall-button is-hidden'
  savedRecallButton.textContent = safeT('selection_toolbar_try_recall') ?? findLabel
  savedRecallButton.addEventListener('mousedown', preserveSelectionOnMouseDown)
  savedRecallButton.addEventListener('click', event => {
    event.preventDefault()
    event.stopPropagation()
    void handleSavedRecallClick()
  })
  savedFeedbackPanel.append(savedPreviewEl, savedHintEl, savedRecallButton)

  shellElement = document.createElement('div')
  shellElement.className = 'shell'
  shellElement.append(actionsRow, notePanel, savedFeedbackPanel)
  shadowRoot.append(style, shellElement)
  document.documentElement.appendChild(hostElement)
  uiMode = 'actions'
  buttonState = 'idle'
}

/** Getting Started 有独立试找；普通页才展示划选「用这段来找」。 */
function syncFindButtonVisibility(): void {
  if (!findButton || !actionsRow) {
    return
  }
  const onGettingStarted = isGettingStartedPageUrl(window.location.href)
  // DOM: save | d0 | find | d1 | note → GS 藏 find+d1，剩下 save | d0 | note
  const afterFindDivider = actionsRow.querySelectorAll('.divider').item(1)
  if (onGettingStarted) {
    findButton.classList.add('is-hidden')
    if (afterFindDivider instanceof HTMLElement) {
      afterFindDivider.classList.add('is-hidden')
    }
    return
  }
  findButton.classList.remove('is-hidden')
  if (afterFindDivider instanceof HTMLElement && buttonState === 'idle' && uiMode === 'actions') {
    afterFindDivider.classList.remove('is-hidden')
  }
}

function setBusy(busy: boolean): void {
  if (saveButton) {
    saveButton.disabled = busy
  }
  if (findButton) {
    findButton.disabled = busy
  }
  if (noteButton) {
    noteButton.disabled = busy
  }
  if (noteInput) {
    noteInput.disabled = busy
  }
}

function showStatus(state: 'saving' | 'saved' | 'error', label: string): void {
  buttonState = state
  if (!statusButton || !actionsRow || !saveButton || !noteButton) {
    return
  }

  setBusy(state === 'saving')
  saveButton.classList.add('is-hidden')
  if (findButton) {
    findButton.classList.add('is-hidden')
  }
  noteButton.classList.add('is-hidden')
  for (const divider of actionsRow.querySelectorAll('.divider')) {
    if (divider instanceof HTMLElement) {
      divider.classList.add('is-hidden')
    }
  }

  statusButton.classList.remove('is-hidden', 'status-button--saved', 'status-button--error')
  if (state === 'saved') {
    statusButton.classList.add('status-button--saved')
  }
  if (state === 'error') {
    statusButton.classList.add('status-button--error')
    hideSavedFeedback()
  }
  statusButton.textContent = label
  // saved/error 仅作状态展示，勿用 disabled 置灰（易误解为不可保存）
  statusButton.disabled = state === 'saving'
  statusButton.setAttribute(
    'aria-disabled',
    state === 'saved' || state === 'error' ? 'true' : 'false'
  )
}

/**
 * 展示存成抓住感：预览正文 + 存成后「用这段来找」入口（预填开 Side Panel，不自动发）。
 * GS 页例外：hint/按钮隐藏（试找走独立 Step 2）。
 */
function showSavedFeedback(input: { preview: string; savedText?: string }): void {
  if (!savedFeedbackPanel || !savedPreviewEl || !savedHintEl) {
    return
  }
  savedPreviewEl.textContent = input.preview
  const onGettingStarted = isGettingStartedPageUrl(window.location.href)
  const textForPrefill = input.savedText ?? input.preview
  lastSavedSelectionText = input.savedText ?? textForPrefill
  const prefill = buildRecallPrefillClue(textForPrefill)

  if (onGettingStarted || !savedRecallButton) {
    savedHintEl.textContent = ''
    savedHintEl.classList.add('is-hidden')
    if (savedRecallButton) {
      savedRecallButton.classList.add('is-hidden')
    }
  } else {
    try {
      if (prefill) {
        savedHintEl.textContent = t('selection_toolbar_saved_hint', [prefill])
        savedRecallButton.title = t('selection_toolbar_try_recall_aria', [prefill])
        savedRecallButton.setAttribute(
          'aria-label',
          t('selection_toolbar_try_recall_aria', [prefill])
        )
      } else {
        savedHintEl.textContent = ''
        savedRecallButton.title = t('selection_toolbar_try_recall_aria_generic')
        savedRecallButton.setAttribute('aria-label', t('selection_toolbar_try_recall_aria_generic'))
      }
    } catch {
      savedHintEl.textContent = ''
    }
    if (prefill) {
      savedHintEl.classList.remove('is-hidden')
      savedRecallButton.classList.remove('is-hidden')
    } else {
      savedHintEl.classList.add('is-hidden')
      savedRecallButton.classList.add('is-hidden')
    }
  }
  savedFeedbackPanel.classList.add('is-open')
}

/** 预填开 Side Panel（不自动发）；成功收起浮层，失败报错。 */
async function openRecallWithPrefill(prefill: string): Promise<boolean> {
  try {
    // 预填交给 SW：先开火开壳再写 session（content 先 await storage 会丢手势且与 Panel mount 竞态）。
    const response = await openRecallShell({ clue: prefill, autoSubmit: false })
    if (!ensureLiveContext()) {
      return false
    }
    if (response?.ok) {
      hideToolbar()
      return true
    }
    const failed = safeT('selection_toolbar_open_recall_failed')
    if (failed !== null) {
      showStatus('error', failed)
    }
    scheduleHideToolbar(3200)
    return false
  } catch (error) {
    if (isContextInvalidatedError(error) || !isExtensionContextValid()) {
      teardown()
      return false
    }
    const failed = safeT('selection_toolbar_open_recall_failed')
    if (failed !== null) {
      showStatus('error', failed)
    }
    scheduleHideToolbar(3200)
    return false
  }
}

/**
 * 划选「用这段来找」：选区 → composer 预填（可改、不自动发）。
 * 不要求先 Capture；找的是库里已有痕迹，不是「刚划的这段本身」。
 */
async function handleFindWithSelectionClick(): Promise<void> {
  if (!ensureLiveContext() || !findButton || buttonState === 'saving') {
    return
  }
  if (isGettingStartedPageUrl(window.location.href)) {
    return
  }

  clearHideTimer()
  capturePendingSelection()
  const selectedText = pendingCapture?.selectedText || getSelectedText()
  const prefill = buildRecallPrefillClue(selectedText)
  if (!prefill) {
    const gone = safeT('selection_toolbar_selection_gone')
    if (gone !== null) {
      showStatus('error', gone)
      scheduleHideToolbar(1600)
    }
    return
  }

  findButton.disabled = true
  const ok = await openRecallWithPrefill(prefill)
  if (!ok && findButton) {
    findButton.disabled = false
  }
}

/** 存成后「用这段来找」：用 lastSavedSelectionText 预填开壳（页内选区已清）。 */
async function handleSavedRecallClick(): Promise<void> {
  if (!ensureLiveContext() || buttonState === 'saving') {
    return
  }
  const text = lastSavedSelectionText
  if (!text) {
    return
  }
  const prefill = buildRecallPrefillClue(text)
  if (!prefill) {
    return
  }
  if (savedRecallButton) {
    savedRecallButton.disabled = true
  }
  const ok = await openRecallWithPrefill(prefill)
  if (!ok && savedRecallButton) {
    savedRecallButton.disabled = false
  }
}

function hideSavedFeedback(): void {
  if (savedFeedbackPanel) {
    savedFeedbackPanel.classList.remove('is-open')
  }
  if (savedPreviewEl) {
    savedPreviewEl.textContent = ''
  }
  if (savedHintEl) {
    savedHintEl.textContent = ''
    savedHintEl.classList.add('is-hidden')
  }
  if (savedRecallButton) {
    savedRecallButton.classList.add('is-hidden')
    savedRecallButton.disabled = false
    savedRecallButton.removeAttribute('title')
    savedRecallButton.removeAttribute('aria-label')
  }
  lastSavedSelectionText = null
}

function resetActionsView(): void {
  buttonState = 'idle'
  uiMode = 'actions'
  setBusy(false)
  hideSavedFeedback()

  if (saveButton) {
    saveButton.classList.remove('is-hidden')
  }
  if (noteButton) {
    noteButton.classList.remove('is-hidden')
  }
  if (actionsRow) {
    for (const divider of actionsRow.querySelectorAll('.divider')) {
      if (divider instanceof HTMLElement) {
        divider.classList.remove('is-hidden')
      }
    }
  }
  syncFindButtonVisibility()
  if (statusButton) {
    statusButton.classList.add('is-hidden')
    statusButton.classList.remove('status-button--saved', 'status-button--error')
    statusButton.textContent = ''
  }
  if (notePanel) {
    notePanel.classList.remove('is-open')
  }
  // 收起前 stash 非空附注草稿（所有收起路径经此；保存成功前会先清 noteInput）
  if (noteInput && shouldStashNoteDraft(noteInput.value)) {
    pendingNoteDraft = {
      selectedText: pendingCapture?.selectedText ?? '',
      note: noteInput.value
    }
  }
  if (noteInput) {
    noteInput.value = ''
  }
}

function openNotePanel(): void {
  if (!ensureLiveContext() || buttonState === 'saving') {
    return
  }
  ensureToolbarHost()
  if (!notePanel || !noteInput) {
    return
  }

  // 必须在 textarea.focus() 之前快照：聚焦会清掉页内选区
  capturePendingSelection()
  if (!pendingCapture?.selectedText) {
    const gone = safeT('selection_toolbar_selection_gone')
    if (gone !== null) {
      showStatus('error', gone)
      scheduleHideToolbar(1600)
    }
    return
  }

  // 同选区恢复草稿；不同选区丢弃旧草稿
  const restored = matchNoteDraft(pendingNoteDraft, pendingCapture.selectedText)
  if (restored !== null) {
    noteInput.value = restored
    pendingNoteDraft = null
    const len = restored.length
    noteInput.setSelectionRange(len, len)
  } else {
    pendingNoteDraft = null
    noteInput.value = ''
  }

  uiMode = 'note'
  notePanel.classList.add('is-open')
  const liveRect = getSelectionRect()
  const anchor = liveRect ?? pendingCapture.anchorRect
  positionToolbar(anchor, 120)
  noteInput.focus()
}

function closeNotePanel(): void {
  if (buttonState === 'saving') {
    return
  }
  resetActionsView()
  const rect = getSelectionRect() ?? pendingCapture?.anchorRect
  if (rect && hostElement) {
    positionToolbar(rect, 36)
  }
}

function positionToolbar(
  rect: { top: number; left: number; width: number; height: number },
  estimatedHeight: number
): void {
  if (!hostElement) {
    return
  }
  // 先显示再量宽：display:none 时 offsetWidth 为 0
  hostElement.style.display = 'block'
  const toolbarWidth = shellElement?.offsetWidth || 320
  const anchor = computeSelectionToolbarAnchor(rect, {
    estimatedHeight,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    toolbarWidth
  })
  hostElement.style.top = `${anchor.top}px`
  hostElement.style.left = `${anchor.left}px`
}

/** 附注模式滚动：按快照锚点跟随；滚出视口则收起（走草稿 stash）。 */
function repositionNoteToolbar(): void {
  if (uiMode !== 'note' || !pendingCapture) {
    return
  }
  const next = resolveScrolledSelectionAnchor({
    snapshotRect: pendingCapture.anchorRect,
    snapshotScroll: { x: pendingCapture.scrollX, y: pendingCapture.scrollY },
    currentScroll: { x: window.scrollX, y: window.scrollY },
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight
  })
  if (!next) {
    closeNotePanel()
    return
  }
  positionToolbar(next, 120)
}

function hideToolbar(): void {
  clearShowTimer()
  clearHideTimer()
  if (hostElement) {
    hostElement.style.display = 'none'
  }
  resetActionsView()
  clearPendingCapture()
}

function showToolbarAt(rect: DOMRect): void {
  if (!ensureLiveContext()) {
    return
  }
  ensureToolbarHost()
  if (!hostElement) {
    return
  }

  resetActionsView()
  capturePendingSelection()
  positionToolbar(rect, 36)
}

function scheduleHideToolbar(delayMs = 0): void {
  clearHideTimer()
  hideTimer = setTimeout(() => {
    hideTimer = null
    runGuarded(() => {
      hideToolbar()
    })
  }, delayMs)
}

async function handleSaveClick(
  options: {
    withNote?: boolean
    captureEntry?: CaptureEntry
  } = {}
): Promise<boolean> {
  if (!ensureLiveContext() || buttonState === 'saving') {
    return false
  }

  try {
    const capture = resolveCaptureForSave()
    const selectedText = capture?.selectedText ?? ''
    if (!selectedText) {
      const gone = safeT('selection_toolbar_selection_gone')
      if (gone === null) {
        return false
      }
      if (notePanel) {
        notePanel.classList.remove('is-open')
      }
      showStatus('error', gone)
      scheduleHideToolbar(1600)
      return false
    }

    let note: string | undefined
    if (options.withNote) {
      const raw = noteInput?.value.trim() ?? ''
      if (!raw) {
        noteInput?.focus()
        return false
      }
      note = raw.slice(0, NOTE_MAX_LENGTH)
    }

    const saving = safeT('selection_toolbar_saving')
    if (saving === null) {
      return false
    }
    if (notePanel) {
      notePanel.classList.remove('is-open')
    }
    showStatus('saving', saving)

    const response = await captureTextExcerpt({
      selectedText,
      sourceUrl: window.location.href,
      pageTitle: document.title,
      ...(capture?.contextBefore ? { contextBefore: capture.contextBefore } : {}),
      ...(capture?.contextAfter ? { contextAfter: capture.contextAfter } : {}),
      ...(note === undefined ? {} : { note }),
      captureEntry:
        options.captureEntry ??
        (isGettingStartedPageUrl(window.location.href) ? 'getting_started' : 'selection_toolbar')
    })

    if (!ensureLiveContext()) {
      return false
    }

    if (!response?.ok) {
      let message = safeT('selection_toolbar_failed')
      if (message === null) {
        return false
      }
      if (response && 'errorCode' in response && isMemoryErrorCode(response.errorCode)) {
        try {
          message = tMemoryError(response.errorCode)
        } catch (error) {
          if (isContextInvalidatedError(error) || !isExtensionContextValid()) {
            teardown()
            return false
          }
          throw error
        }
      }
      showStatus('error', message)
      scheduleHideToolbar(1800)
      return false
    }

    const isDuplicate = response && 'duplicate' in response && response.duplicate === true
    const saved = isDuplicate
      ? safeT('selection_toolbar_saved_duplicate')
      : safeT('selection_toolbar_saved')
    if (saved === null) {
      return false
    }
    // 保存成功：先清附注输入，避免 resetActionsView stash 已存附注
    if (noteInput) {
      noteInput.value = ''
    }
    // 先切到 saved 态再清选区，避免 selectionchange 在 idle 时立刻 hideToolbar
    showStatus('saved', saved)

    const preview = buildCaptureSavedPreview(selectedText)
    try {
      // Getting Started：清预填，避免误带进 Side Panel；试找走独立 Step 2
      if (isGettingStartedPageUrl(window.location.href)) {
        await writeRecallPrefill('')
      }
    } catch {
      // storage 失败不影响抓住感主文案
    }
    // 存成后给「用这段来找」入口（预填开 Side Panel，不自动发）
    showSavedFeedback({ preview, savedText: selectedText })

    clearPageSelection()
    clearPendingCapture()
    scheduleHideToolbar(SAVED_FEEDBACK_HIDE_MS)
    return true
  } catch (error) {
    if (isContextInvalidatedError(error) || !isExtensionContextValid()) {
      teardown()
      return false
    }
    const failed = safeT('selection_toolbar_failed')
    if (failed === null) {
      return false
    }
    showStatus('error', failed)
    scheduleHideToolbar(1800)
    return false
  }
}

/** 保存成功后清掉页内选区高亮（与浮层收起一起给「已收进」反馈）。 */
function clearPageSelection(): void {
  try {
    window.getSelection()?.removeAllRanges()
  } catch {
    // 部分页面 Selection API 可能抛错，忽略
  }
}

/** 快捷键：保存当前选区（无附注）。无选区则静默忽略。 */
async function handleShortcutSave(): Promise<ContentSelectionCommandResponse> {
  if (!ensureLiveContext()) {
    return { ok: false, errorCode: 'SELECTION_COMMAND_FAILED' }
  }
  if (!isSavablePageUrl(window.location.href)) {
    return { ok: false, errorCode: 'CAPTURE_UNSAVABLE_PAGE' }
  }

  clearPendingCapture()
  capturePendingSelection()
  if (!pendingCapture?.selectedText) {
    return { ok: true, skipped: true }
  }

  ensureToolbarHost()
  positionToolbar(pendingCapture.anchorRect, 36)
  const saved = await handleSaveClick({ captureEntry: 'shortcut' })
  return saved ? { ok: true } : { ok: false, errorCode: 'SELECTION_COMMAND_FAILED' }
}

/** 快捷键：打开附注面板（先快照选区）。无选区则静默忽略。 */
async function handleShortcutOpenNote(): Promise<ContentSelectionCommandResponse> {
  if (!ensureLiveContext()) {
    return { ok: false, errorCode: 'SELECTION_COMMAND_FAILED' }
  }
  if (!isSavablePageUrl(window.location.href)) {
    return { ok: false, errorCode: 'CAPTURE_UNSAVABLE_PAGE' }
  }

  clearPendingCapture()
  capturePendingSelection()
  if (!pendingCapture?.selectedText) {
    return { ok: true, skipped: true }
  }

  openNotePanel()
  return { ok: true }
}

/** 右键等路径失败：页内浮层展示具体原因（浮层关闭时不强弹）。 */
function handleShowSelectionError(errorCode: string): boolean {
  if (!ensureLiveContext() || !toolbarEnabled) {
    return false
  }
  ensureToolbarHost()
  if (!hostElement) {
    return false
  }
  resetActionsView()
  const liveRect = getSelectionRect()
  const anchor = liveRect
    ? { top: liveRect.top, left: liveRect.left, width: liveRect.width, height: liveRect.height }
    : (pendingCapture?.anchorRect ?? { top: 80, left: 80, width: 40, height: 20 })
  positionToolbar(anchor, 36)

  let message: string
  if (isMemoryErrorCode(errorCode)) {
    try {
      message = tMemoryError(errorCode)
    } catch {
      message = safeT('selection_toolbar_failed') ?? 'Failed'
    }
  } else {
    message = safeT('selection_toolbar_failed') ?? 'Failed'
  }
  showStatus('error', message)
  scheduleHideToolbar(1800)
  return true
}

function handleShowVoiceFeedback(message: string, title?: string): boolean {
  if (!ensureLiveContext()) {
    return false
  }
  const dismissLabel = safeT('app_toast_dismiss') ?? 'Dismiss'
  showVoiceFeedbackBanner({
    message,
    dismissLabel,
    ...(title ? { title } : {})
  })
  return true
}

function handleRuntimeMessage(
  message: unknown,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (
    response:
      ContentSelectionCommandResponse | ContentSelectionErrorResponse | ContentVoiceFeedbackResponse
  ) => void
): boolean {
  const voiceFeedback = parseContentVoiceFeedbackMessage(message)
  if (voiceFeedback) {
    const shown = handleShowVoiceFeedback(voiceFeedback.message, voiceFeedback.title)
    sendResponse({ shown })
    return false
  }

  const errorMessage = parseContentSelectionErrorMessage(message)
  if (errorMessage) {
    const shown = handleShowSelectionError(errorMessage.errorCode)
    sendResponse({ shown })
    return false
  }

  const command = parseContentSelectionCommandMessage(message)
  if (!command) {
    return false
  }

  const run = command.type === 'SELECTION_SAVE' ? handleShortcutSave() : handleShortcutOpenNote()

  void run
    .then(response => {
      sendResponse(response)
    })
    .catch(() => {
      sendResponse({ ok: false, errorCode: 'SELECTION_COMMAND_FAILED' })
    })
  return true
}

function evaluateSelectionAndMaybeShow(): void {
  if (!ensureLiveContext()) {
    return
  }
  // 保存反馈期间勿因选区变化重建/拆掉浮层
  if (isStatusFeedbackLocked()) {
    return
  }
  clearShowTimer()

  const selectedText = getSelectedText()
  if (
    !shouldShowSelectionToolbar({
      enabled: toolbarEnabled,
      selectedText,
      isSavablePage: isSavablePageUrl(window.location.href)
    })
  ) {
    hideToolbar()
    return
  }

  // 同步快照：delay 期间部分页面会清选区（中文站点更常见），仍要能弹出浮层
  capturePendingSelection()

  showTimer = setTimeout(() => {
    showTimer = null
    runGuarded(() => {
      if (isStatusFeedbackLocked()) {
        return
      }
      const latestText = getSelectedText()
      const rect = getSelectionRect()
      const snapshot = pendingCapture
      const text = latestText || snapshot?.selectedText || ''
      const anchorRect = rect
        ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
        : snapshot?.anchorRect

      if (!text || !anchorRect) {
        hideToolbar()
        return
      }

      if (!latestText && snapshot?.selectedText) {
        pendingCapture = snapshot
      }

      showToolbarAt(
        new DOMRect(anchorRect.left, anchorRect.top, anchorRect.width, anchorRect.height)
      )
    })
  }, SELECTION_TOOLBAR_SHOW_DELAY_MS)
}

function isEventInsideToolbar(event: Event): boolean {
  return hostElement !== null && event.composedPath().includes(hostElement)
}

/** 保存中 / 结果提示期间锁定浮层，避免滚动、点页、Esc 拆掉反馈。 */
function isStatusFeedbackLocked(): boolean {
  return isSelectionToolbarStatusLocked(buttonState)
}

const scrollDismiss = createSelectionToolbarScrollDismissHandler({
  getUiMode: () => uiMode,
  getButtonState: () => buttonState,
  onDismiss: () => hideToolbar(),
  onReposition: () => repositionNoteToolbar()
})

function handleScroll(): void {
  runGuarded(() => {
    scrollDismiss.onScroll()
  })
}

function handleMouseDownTracker(): void {
  mouseDown = true
}

function handleMouseUpTracker(): void {
  mouseDown = false
}

function handleMouseUp(event: MouseEvent): void {
  runGuarded(() => {
    if (event.button !== 0) {
      return
    }
    if (isEventInsideToolbar(event)) {
      return
    }
    evaluateSelectionAndMaybeShow()
  })
}

function handleDocumentMouseDown(event: MouseEvent): void {
  runGuarded(() => {
    if (isEventInsideToolbar(event)) {
      return
    }
    if (isStatusFeedbackLocked()) {
      return
    }
    hideToolbar()
  })
}

function handleKeyDown(event: KeyboardEvent): void {
  runGuarded(() => {
    const isSelectionArrow =
      event.shiftKey && (SELECTION_KEY_NAMES as readonly string[]).includes(event.key)
    const isSelectAll = (event.ctrlKey || event.metaKey) && (event.key === 'a' || event.key === 'A')
    if (isSelectionArrow || isSelectAll) {
      lastSelectionKeyDownAt = Date.now()
    }

    if (event.key !== 'Escape') {
      return
    }
    if (isStatusFeedbackLocked()) {
      return
    }
    if (uiMode === 'note') {
      closeNotePanel()
      return
    }
    hideToolbar()
  })
}

function handleSelectionChange(): void {
  runGuarded(() => {
    // 附注输入聚焦时 selectionchange 可能抖动；有打开的附注面板时不因空选区立刻关掉
    if (uiMode === 'note') {
      return
    }
    if (isStatusFeedbackLocked()) {
      return
    }
    const text = getSelectedText()
    if (text) {
      if (
        shouldEvaluateSelectionOnChange({
          mouseDown,
          msSinceSelectionKeyDown:
            lastSelectionKeyDownAt === null ? null : Date.now() - lastSelectionKeyDownAt,
          enabled: toolbarEnabled,
          selectedText: text,
          isSavablePage: isSavablePageUrl(window.location.href)
        })
      ) {
        evaluateSelectionAndMaybeShow()
      }
      return
    }
    // 勿在 delay / 快照撑起展示期间因短暂空选区取消弹出（与 evaluateSelection 快照策略一致）
    const toolbarVisible = hostElement !== null && hostElement.style.display !== 'none'
    if (
      !shouldHideToolbarOnEmptySelection({
        showTimerPending: showTimer !== null,
        hasPendingCapture: Boolean(pendingCapture?.selectedText),
        toolbarVisible
      })
    ) {
      return
    }
    hideToolbar()
  })
}

function handleStorageChanged(
  changes: { [key: string]: chrome.storage.StorageChange },
  areaName: string
): void {
  runGuarded(() => {
    if (areaName !== 'local' || !(USER_SETTINGS_STORAGE_KEY in changes)) {
      return
    }
    const next = parseUserSettings(changes[USER_SETTINGS_STORAGE_KEY]?.newValue)
    toolbarEnabled = next.selectionToolbarEnabled
    if (!toolbarEnabled) {
      hideToolbar()
    }
  })
}

/**
 * 划词 content ↔ SW keepalive。
 * Chrome 123+：页面进入 bfcache 时会主动关 port，并设置 runtime.lastError；
 * 须读取 lastError 避免控制台 Unchecked runtime.lastError，且勿在冻结态立刻重连——
 * 等 pageshow(persisted) 再 connect（见官方 bfcache-extension-messaging-changes）。
 *
 * 扩展 Reload 时：SW 销毁 → 全页 port disconnect。若同步立刻 reconnect，
 * 会在旧脚本失效窗口内形成 connect 风暴，已知可触发 Chrome 主进程 SIGSEGV。
 */
const KEEPALIVE_RECONNECT_DELAY_MS = 750

function connectKeepalivePort(): void {
  if (tornDown || keepalivePort || pageFrozenInBfCache || !isExtensionContextValid()) {
    return
  }
  try {
    keepalivePort = chrome.runtime.connect({ name: SELECTION_TOOLBAR_KEEPALIVE_PORT })
    keepalivePort.onDisconnect.addListener(() => {
      // 必须同步读取，否则 Chrome 打出 Unchecked runtime.lastError
      const disconnectMessage = chrome.runtime.lastError?.message ?? ''
      const closedByBfCache =
        pageFrozenInBfCache || disconnectMessage.includes('back/forward cache')
      keepalivePort = null
      // 扩展被重载/禁用：runtime.id 消失 → 拆卸旧脚本
      if (!isExtensionContextValid()) {
        teardown()
        return
      }
      // bfcache 冻结中：等 pageshow 再连；SW 休眠 disconnect 则延迟重建
      if (closedByBfCache) {
        pageFrozenInBfCache = true
        return
      }
      window.setTimeout(() => {
        if (tornDown || keepalivePort || pageFrozenInBfCache || !isExtensionContextValid()) {
          if (!isExtensionContextValid()) {
            teardown()
          }
          return
        }
        connectKeepalivePort()
      }, KEEPALIVE_RECONNECT_DELAY_MS)
    })
  } catch {
    if (!isExtensionContextValid()) {
      teardown()
    }
  }
}

function handlePageHide(event: PageTransitionEvent): void {
  if (event.persisted) {
    pageFrozenInBfCache = true
  }
}

function handlePageShow(event: PageTransitionEvent): void {
  if (!event.persisted) {
    return
  }
  // 从 bfcache 恢复：官方要求重新建立 message port
  pageFrozenInBfCache = false
  runGuarded(() => {
    if (tornDown || keepalivePort || !isExtensionContextValid()) {
      return
    }
    connectKeepalivePort()
  })
}

/**
 * 同页防重复挂载。值存当前 `chrome.runtime.id`：扩展 Reload 后 id 变化，
 * 旧实例留下的布尔/旧 id 不会挡住新注入（否则附注快捷键会「注入后仍无接收端」）。
 */
const BOOT_FLAG = '__yivenoSelectionToolbarBootId' as const

type BootFlagWindow = Window & { [BOOT_FLAG]?: string }

/** 本脚本启动时的 runtime id；teardown 只清自己写下的标记；可在 bootSelectionToolbar 补写。 */
let bootRuntimeId = (() => {
  try {
    return chrome.runtime?.id ?? ''
  } catch {
    return ''
  }
})()

function readBootFlag(): string | undefined {
  try {
    return (window as BootFlagWindow)[BOOT_FLAG]
  } catch {
    return undefined
  }
}

function writeBootFlag(runtimeId: string): void {
  try {
    ;(window as BootFlagWindow)[BOOT_FLAG] = runtimeId
  } catch {
    // 跨域 / 冻结页面上写 window 可能失败，忽略
  }
}

function clearBootFlagIfOwned(): void {
  try {
    const target = window as BootFlagWindow
    if (!bootRuntimeId || target[BOOT_FLAG] === bootRuntimeId) {
      delete target[BOOT_FLAG]
    }
  } catch {
    // ignore
  }
}

type PageApiGlobal = typeof globalThis & {
  [SELECTION_TOOLBAR_PAGE_API_KEY]?: SelectionToolbarPageApi & { ownerRuntimeId?: string }
}

function installPageApi(): void {
  const target = globalThis as PageApiGlobal
  target[SELECTION_TOOLBAR_PAGE_API_KEY] = {
    ownerRuntimeId: bootRuntimeId,
    runCommand: (type: SelectionToolbarCommandType) =>
      type === 'SELECTION_SAVE' ? handleShortcutSave() : handleShortcutOpenNote()
  }
}

function uninstallPageApi(): void {
  try {
    const target = globalThis as PageApiGlobal
    const current = target[SELECTION_TOOLBAR_PAGE_API_KEY]
    // 仅卸本实例挂上的 API，避免扩展 Reload 后旧 teardown 删掉新实例 API
    if (current?.ownerRuntimeId === bootRuntimeId) {
      delete target[SELECTION_TOOLBAR_PAGE_API_KEY]
    }
  } catch {
    // ignore
  }
}

/** 是否应由本实例完成挂载（同 runtime 已挂载则跳过）。 */
function shouldBootThisInstance(): boolean {
  if (!bootRuntimeId) {
    return false
  }
  return readBootFlag() !== bootRuntimeId
}

function teardown(): void {
  if (tornDown) {
    return
  }
  tornDown = true
  clearBootFlagIfOwned()
  uninstallPageApi()
  scrollDismiss.cancel()
  clearShowTimer()
  clearHideTimer()

  try {
    keepalivePort?.disconnect()
  } catch {
    // 上下文已失效时 disconnect 可能抛错
  }
  keepalivePort = null
  pageFrozenInBfCache = false

  if (listenersRegistered) {
    document.removeEventListener('mouseup', handleMouseUp, true)
    document.removeEventListener('mouseup', handleMouseUpTracker, true)
    document.removeEventListener('mousedown', handleDocumentMouseDown, true)
    document.removeEventListener('mousedown', handleMouseDownTracker, true)
    document.removeEventListener('keydown', handleKeyDown, true)
    window.removeEventListener('scroll', handleScroll, true)
    document.removeEventListener('selectionchange', handleSelectionChange)
    window.removeEventListener('pagehide', handlePageHide)
    window.removeEventListener('pageshow', handlePageShow)
    try {
      chrome.runtime.onMessage.removeListener(handleRuntimeMessage)
    } catch {
      // 上下文已失效时 removeListener 也可能抛错，忽略即可
    }
    try {
      chrome.storage.onChanged.removeListener(handleStorageChanged)
    } catch {
      // 上下文已失效时 removeListener 也可能抛错，忽略即可
    }
    listenersRegistered = false
  }

  hostElement?.remove()
  hostElement = null
  shadowRoot = null
  shellElement = null
  actionsRow = null
  notePanel = null
  savedFeedbackPanel = null
  savedPreviewEl = null
  savedHintEl = null
  savedRecallButton = null
  saveButton = null
  findButton = null
  noteButton = null
  noteInput = null
  noteSaveButton = null
  noteCancelButton = null
  statusButton = null
  uiMode = 'actions'
  buttonState = 'idle'
  pendingNoteDraft = null
  lastSavedSelectionText = null
  mouseDown = false
  lastSelectionKeyDownAt = null
  clearPendingCapture()
  dismissVoiceFeedbackBanner()
}

function registerListeners(): void {
  if (tornDown || listenersRegistered || !isExtensionContextValid()) {
    return
  }

  document.addEventListener('mouseup', handleMouseUp, true)
  document.addEventListener('mouseup', handleMouseUpTracker, true)
  document.addEventListener('mousedown', handleDocumentMouseDown, true)
  document.addEventListener('mousedown', handleMouseDownTracker, true)
  document.addEventListener('keydown', handleKeyDown, true)
  window.addEventListener('scroll', handleScroll, true)
  document.addEventListener('selectionchange', handleSelectionChange)
  window.addEventListener('pagehide', handlePageHide)
  window.addEventListener('pageshow', handlePageShow)
  try {
    chrome.runtime.onMessage.addListener(handleRuntimeMessage)
    chrome.storage.onChanged.addListener(handleStorageChanged)
  } catch {
    teardown()
    return
  }
  listenersRegistered = true
  connectKeepalivePort()
}

/**
 * 挂载划词浮层（content script IIFE 与 Getting Started 扩展页共用）。
 * 扩展页在 `getting-started/main` 再显式调用一次，避免仅靠顶层 side-effect。
 */
export function bootSelectionToolbar(): boolean {
  if (tornDown) {
    return false
  }
  const runtimeId = (() => {
    try {
      return chrome.runtime?.id ?? ''
    } catch {
      return ''
    }
  })()
  if (!runtimeId) {
    return false
  }
  if (!bootRuntimeId) {
    bootRuntimeId = runtimeId
  }
  if (readBootFlag() === runtimeId && isSelectionToolbarBooted()) {
    return true
  }

  writeBootFlag(runtimeId)
  document.getElementById(TOOLBAR_HOST_ID)?.remove()
  installPageApi()
  registerListeners()
  void initUiLocaleFromSettings()
    .catch(() => undefined)
    .finally(() => {
      warnIfContentScriptMessagesMissing('selection_toolbar')
    })
  void refreshToolbarEnabledFromStorage().catch(() => {
    if (!isExtensionContextValid()) {
      teardown()
      return
    }
    toolbarEnabled = DEFAULT_USER_SETTINGS.selectionToolbarEnabled
  })
  return isSelectionToolbarBooted()
}

/** 划词页内 API 是否已挂上（扩展页自检用）。 */
export function isSelectionToolbarBooted(): boolean {
  try {
    return Boolean((globalThis as PageApiGlobal)[SELECTION_TOOLBAR_PAGE_API_KEY])
  } catch {
    return false
  }
}

if (shouldBootThisInstance()) {
  bootSelectionToolbar()
}
