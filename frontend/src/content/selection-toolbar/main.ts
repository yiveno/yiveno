import { BACKGROUND_MESSAGE_SCOPE } from '@/core/messaging/constants'
import { extractSelectionContextOnPage } from '@/infrastructure/browser/selection-context-page'
import {
  computeSelectionToolbarAnchor,
  shouldShowSelectionToolbar
} from '@/content/selection-toolbar/selection-toolbar-logic'
import {
  DEFAULT_USER_SETTINGS,
  parseUserSettings,
  USER_SETTINGS_STORAGE_KEY
} from '@/core/settings/user-settings'
import { t } from '@/infrastructure/i18n/t'
import { tMemoryError } from '@/infrastructure/i18n/memory-error'

const TOOLBAR_HOST_ID = 'yiveno-selection-toolbar-host'
const SHOW_DELAY_MS = 120

type ToolbarButtonState = 'idle' | 'saving' | 'saved' | 'error'

let toolbarEnabled = DEFAULT_USER_SETTINGS.selectionToolbarEnabled
let showTimer: ReturnType<typeof setTimeout> | null = null
let hideTimer: ReturnType<typeof setTimeout> | null = null
let hostElement: HTMLElement | null = null
let shadowRoot: ShadowRoot | null = null
let buttonElement: HTMLButtonElement | null = null
let buttonState: ToolbarButtonState = 'idle'
/** 扩展热重载后旧 content script 仍存活时置 true，停止一切 Chrome API / DOM 交互 */
let tornDown = false
let listenersRegistered = false

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

function isSavablePageUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
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
  const rect = range.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) {
    return null
  }
  return rect
}

function getSelectedText(): string {
  return window.getSelection()?.toString().trim() ?? ''
}

async function refreshToolbarEnabledFromStorage(): Promise<void> {
  if (!ensureLiveContext()) {
    return
  }
  const result = await chrome.storage.local.get(USER_SETTINGS_STORAGE_KEY)
  if (!ensureLiveContext()) {
    return
  }
  const settings = parseUserSettings(result[USER_SETTINGS_STORAGE_KEY])
  toolbarEnabled = settings.selectionToolbarEnabled
}

function ensureToolbarHost(): void {
  if (!ensureLiveContext()) {
    return
  }
  if (hostElement?.isConnected) {
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
  style.textContent = `
    .toolbar {
      pointer-events: auto;
      transform: translateX(-50%);
      display: inline-flex;
      align-items: center;
      padding: 2px;
      border: 1px solid #99d5df;
      border-radius: 999px;
      background: #f0fbfd;
      box-shadow: 0 4px 16px rgb(15 23 42 / 12%);
    }
    .save-button {
      margin: 0;
      padding: 6px 12px;
      border: none;
      border-radius: 999px;
      font: 600 13px/1.2 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: #0e7490;
      background: transparent;
      cursor: pointer;
      white-space: nowrap;
    }
    .save-button:hover:not(:disabled) {
      background: rgb(8 145 178 / 12%);
    }
    .save-button:disabled {
      cursor: wait;
      opacity: 0.75;
    }
    .save-button--saved {
      color: #0f766e;
    }
    .save-button--error {
      color: #b42318;
    }
  `

  const toolbar = document.createElement('div')
  toolbar.className = 'toolbar'

  buttonElement = document.createElement('button')
  buttonElement.type = 'button'
  buttonElement.className = 'save-button'
  buttonElement.textContent = t('context_menu_save_selection')
  buttonElement.addEventListener('mousedown', event => {
    event.preventDefault()
    event.stopPropagation()
  })
  buttonElement.addEventListener('click', event => {
    event.preventDefault()
    event.stopPropagation()
    void handleSaveClick()
  })

  toolbar.appendChild(buttonElement)
  shadowRoot.append(style, toolbar)
  document.documentElement.appendChild(hostElement)
}

function setButtonState(state: ToolbarButtonState, label?: string): void {
  buttonState = state
  if (!buttonElement || !ensureLiveContext()) {
    return
  }

  buttonElement.disabled = state === 'saving'
  buttonElement.classList.remove('save-button--saved', 'save-button--error')

  if (state === 'saving') {
    buttonElement.textContent = t('selection_toolbar_saving')
    return
  }
  if (state === 'saved') {
    buttonElement.classList.add('save-button--saved')
    buttonElement.textContent = label ?? t('selection_toolbar_saved')
    return
  }
  if (state === 'error') {
    buttonElement.classList.add('save-button--error')
    buttonElement.textContent = label ?? t('selection_toolbar_failed')
    return
  }

  buttonElement.textContent = label ?? t('context_menu_save_selection')
}

function hideToolbar(): void {
  clearShowTimer()
  clearHideTimer()
  if (hostElement) {
    hostElement.style.display = 'none'
  }
  if (!tornDown && isExtensionContextValid()) {
    setButtonState('idle')
  } else {
    buttonState = 'idle'
  }
}

function showToolbarAt(rect: DOMRect): void {
  if (!ensureLiveContext()) {
    return
  }
  ensureToolbarHost()
  if (!hostElement) {
    return
  }

  const anchor = computeSelectionToolbarAnchor(rect)
  hostElement.style.display = 'block'
  hostElement.style.top = `${anchor.top}px`
  hostElement.style.left = `${anchor.left}px`
  setButtonState('idle')
}

function scheduleHideToolbar(delayMs = 0): void {
  clearHideTimer()
  hideTimer = setTimeout(() => {
    hideTimer = null
    hideToolbar()
  }, delayMs)
}

async function handleSaveClick(): Promise<void> {
  if (!ensureLiveContext() || buttonState === 'saving') {
    return
  }

  const context = extractSelectionContextOnPage()
  const selectedText = context?.selectedText ?? getSelectedText()
  if (!selectedText) {
    setButtonState('error', t('selection_toolbar_selection_gone'))
    scheduleHideToolbar(1600)
    return
  }

  setButtonState('saving')

  try {
    if (!ensureLiveContext()) {
      return
    }
    const response = await chrome.runtime.sendMessage({
      scope: BACKGROUND_MESSAGE_SCOPE,
      type: 'CAPTURE_TEXT_EXCERPT',
      payload: {
        selectedText,
        sourceUrl: window.location.href,
        pageTitle: document.title,
        contextBefore: context?.contextBefore,
        contextAfter: context?.contextAfter,
        captureEntry: 'selection_toolbar'
      }
    })

    if (!ensureLiveContext()) {
      return
    }

    if (!response?.ok) {
      const message =
        response && 'errorCode' in response && response.errorCode
          ? tMemoryError(response.errorCode)
          : t('selection_toolbar_failed')
      setButtonState('error', message)
      scheduleHideToolbar(1800)
      return
    }

    setButtonState('saved')
    scheduleHideToolbar(1200)
  } catch {
    // sendMessage / t 在上下文失效时都会抛；优先静默拆卸
    if (!ensureLiveContext()) {
      return
    }
    setButtonState('error', t('selection_toolbar_failed'))
    scheduleHideToolbar(1800)
  }
}

function evaluateSelectionAndMaybeShow(): void {
  if (!ensureLiveContext()) {
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

  showTimer = setTimeout(() => {
    showTimer = null
    if (!ensureLiveContext()) {
      return
    }
    const rect = getSelectionRect()
    const latestText = getSelectedText()
    if (!rect || !latestText) {
      hideToolbar()
      return
    }
    showToolbarAt(rect)
  }, SHOW_DELAY_MS)
}

function isEventInsideToolbar(event: Event): boolean {
  return hostElement !== null && event.composedPath().includes(hostElement)
}

function handleMouseUp(event: MouseEvent): void {
  if (!ensureLiveContext()) {
    return
  }
  if (event.button !== 0) {
    return
  }
  if (isEventInsideToolbar(event)) {
    return
  }
  evaluateSelectionAndMaybeShow()
}

function handleDocumentMouseDown(event: MouseEvent): void {
  if (!ensureLiveContext()) {
    return
  }
  if (isEventInsideToolbar(event)) {
    return
  }
  hideToolbar()
}

function handleKeyDown(event: KeyboardEvent): void {
  if (!ensureLiveContext()) {
    return
  }
  if (event.key === 'Escape') {
    hideToolbar()
  }
}

function handleScroll(): void {
  if (!ensureLiveContext()) {
    return
  }
  hideToolbar()
}

function handleSelectionChange(): void {
  if (!ensureLiveContext()) {
    return
  }
  if (!getSelectedText()) {
    hideToolbar()
  }
}

function handleStorageChanged(
  changes: { [key: string]: chrome.storage.StorageChange },
  areaName: string
): void {
  if (!ensureLiveContext()) {
    return
  }
  if (areaName !== 'local' || !(USER_SETTINGS_STORAGE_KEY in changes)) {
    return
  }
  const next = parseUserSettings(changes[USER_SETTINGS_STORAGE_KEY]?.newValue)
  toolbarEnabled = next.selectionToolbarEnabled
  if (!toolbarEnabled) {
    hideToolbar()
  }
}

function teardown(): void {
  if (tornDown) {
    return
  }
  tornDown = true
  clearShowTimer()
  clearHideTimer()

  if (listenersRegistered) {
    document.removeEventListener('mouseup', handleMouseUp, true)
    document.removeEventListener('mousedown', handleDocumentMouseDown, true)
    document.removeEventListener('keydown', handleKeyDown, true)
    window.removeEventListener('scroll', handleScroll, true)
    document.removeEventListener('selectionchange', handleSelectionChange)
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
  buttonElement = null
  buttonState = 'idle'
}

function registerListeners(): void {
  if (tornDown || listenersRegistered || !isExtensionContextValid()) {
    return
  }

  document.addEventListener('mouseup', handleMouseUp, true)
  document.addEventListener('mousedown', handleDocumentMouseDown, true)
  document.addEventListener('keydown', handleKeyDown, true)
  window.addEventListener('scroll', handleScroll, true)
  document.addEventListener('selectionchange', handleSelectionChange)
  chrome.storage.onChanged.addListener(handleStorageChanged)
  listenersRegistered = true
}

void refreshToolbarEnabledFromStorage()
  .catch(() => {
    if (!isExtensionContextValid()) {
      teardown()
      return
    }
    toolbarEnabled = DEFAULT_USER_SETTINGS.selectionToolbarEnabled
  })
  .finally(() => {
    if (!tornDown && isExtensionContextValid()) {
      registerListeners()
    }
  })
