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
  const result = await chrome.storage.local.get(USER_SETTINGS_STORAGE_KEY)
  const settings = parseUserSettings(result[USER_SETTINGS_STORAGE_KEY])
  toolbarEnabled = settings.selectionToolbarEnabled
}

function ensureToolbarHost(): void {
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
  if (!buttonElement) {
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
  setButtonState('idle')
}

function showToolbarAt(rect: DOMRect): void {
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
  if (buttonState === 'saving') {
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
    setButtonState('error', t('selection_toolbar_failed'))
    scheduleHideToolbar(1800)
  }
}

function evaluateSelectionAndMaybeShow(): void {
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
  if (event.button !== 0) {
    return
  }
  if (isEventInsideToolbar(event)) {
    return
  }
  evaluateSelectionAndMaybeShow()
}

function handleDocumentMouseDown(event: MouseEvent): void {
  if (isEventInsideToolbar(event)) {
    return
  }
  hideToolbar()
}

function handleKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    hideToolbar()
  }
}

function handleScroll(): void {
  hideToolbar()
}

function registerListeners(): void {
  document.addEventListener('mouseup', handleMouseUp, true)
  document.addEventListener('mousedown', handleDocumentMouseDown, true)
  document.addEventListener('keydown', handleKeyDown, true)
  window.addEventListener('scroll', handleScroll, true)
  document.addEventListener('selectionchange', () => {
    if (!getSelectedText()) {
      hideToolbar()
    }
  })

  chrome.storage.onChanged.addListener((changes, areaName) => {
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

void refreshToolbarEnabledFromStorage()
  .catch(() => {
    toolbarEnabled = DEFAULT_USER_SETTINGS.selectionToolbarEnabled
  })
  .finally(() => {
    registerListeners()
  })
