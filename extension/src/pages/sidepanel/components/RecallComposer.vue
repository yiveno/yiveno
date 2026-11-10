<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, toRef, watch } from 'vue'

import { RECALL_CLUE_MAX_CHARS } from '@/core/messaging/recall-messages'
import {
  clampRecallClueText,
  remainingRecallClueInsertCapacity
} from '@/core/recall/clamp-recall-clue-text'
import { t } from '@/infrastructure/i18n/t'
import { navigateActiveTab } from '@/infrastructure/messaging/background-client'
import AppIcon from '@/infrastructure/ui/icons/AppIcon.vue'
import { useAppToast } from '@/infrastructure/ui/use-app-toast'
import {
  CLUE_URL_CHIP_ATTR,
  ensureClueEditorCaretSlots,
  ensureZwspAfterClueUrlChip,
  findClueUrlChipContainingSelection,
  getClueEditorPlainCaretOffset,
  insertPlainTextAtClueCaret,
  maybeRebuildClueEditorChips,
  serializeClueEditorPlain,
  setClueEditorFromPlainText,
  setClueEditorPlainCaretOffset
} from '@/pages/sidepanel/composer/clue-editor-dom'
import { enrichClueUrlChipsInEditor } from '@/pages/sidepanel/composer/enrich-clue-url-chips'
import { normalizeClueUrl } from '@/pages/sidepanel/composer/clue-url'
import { useComposerSpeechDictation } from '@/pages/sidepanel/use-composer-speech-dictation'
import { useVoiceInputMeter } from '@/pages/sidepanel/use-voice-input-meter'

import '@/pages/sidepanel/composer/clue-url-chip.css'

defineOptions({ name: 'RecallComposer' })

const props = defineProps<{
  ariaLabel: string
  placeholder: string
  sendLabel: string
  /** 麦克风开始听写 */
  voiceStartLabel: string
  /** 麦克风停止听写 */
  voiceStopLabel: string
  /** 不可用时 title（无 SpeechRecognition） */
  voiceUnavailableLabel: string
  disabled?: boolean
  /** 空线程时加重阴影（高度与有字态一致，避免跳变） */
  prominent?: boolean
}>()

const emit = defineEmits<{
  send: []
}>()
const model = defineModel<string>({ required: true })
const editorRef = ref<HTMLDivElement | null>(null)

/** 外部写 model（prefill / 听写）时跳过 DOM→model 回写环。 */
let syncingFromModel = false
/** IME 组字中不收芯片。 */
let isComposing = false
/** 异步标题 enrich 代数；过期结果丢弃。 */
let enrichGeneration = 0
/** 超长 tip 节流，避免连按刷屏。 */
let lastClueTooLongTipAt = 0

const toast = useAppToast()

/** 线索超长 tip（与 RECALL_WITH_CLUE 上限一致）。 */
function notifyClueTooLong(): void {
  const now = Date.now()
  if (now - lastClueTooLongTipAt < 2500) {
    return
  }
  lastClueTooLongTipAt = now
  toast.warning(t('sidepanel_clue_too_long', String(RECALL_CLUE_MAX_CHARS)))
}

/** 选区将被替换的近似纯文本长度（芯片选中时偏短，靠事后 clamp 兜底）。 */
function approxSelectedPlainLength(root: HTMLElement): number {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return 0
  }
  if (!root.contains(selection.anchorNode) || !root.contains(selection.focusNode)) {
    return 0
  }
  return selection.toString().length
}

/**
 * 按剩余容量插入纯文本；超限则截断并 tip。
 * @returns 实际插入长度
 */
function insertPlainTextWithinClueLimit(el: HTMLElement, piece: string): number {
  if (!piece) {
    return 0
  }
  const plainLen = serializeClueEditorPlain(el).length
  const selected = approxSelectedPlainLength(el)
  const room = remainingRecallClueInsertCapacity(plainLen, selected)
  if (room <= 0) {
    notifyClueTooLong()
    return 0
  }
  if (piece.length <= room) {
    insertPlainTextAtClueCaret(el, piece)
    return piece.length
  }
  insertPlainTextAtClueCaret(el, piece.slice(0, room))
  notifyClueTooLong()
  return room
}

/** 若 DOM/model 已超上限，截回并 tip（IME / 旁路兜底）。 */
function enforceClueLengthCap(el: HTMLElement): string {
  const plain = serializeClueEditorPlain(el)
  const clamped = clampRecallClueText(plain)
  if (!clamped.truncated) {
    return plain
  }
  notifyClueTooLong()
  const caret = getClueEditorPlainCaretOffset(el)
  syncingFromModel = true
  try {
    setClueEditorFromPlainText(el, clamped.text, { chipTrailing: false })
    updateEmptyAttr()
    setClueEditorPlainCaretOffset(
      el,
      caret !== null ? Math.min(caret, clamped.text.length) : clamped.text.length
    )
  } finally {
    syncingFromModel = false
  }
  return clamped.text
}

/** 粘贴/重建芯片后异步补库内/tab 标题（不阻塞输入）。 */
function scheduleEnrichUrlChipTitles(): void {
  const el = editorRef.value
  if (!el) {
    return
  }
  const generation = ++enrichGeneration
  void enrichClueUrlChipsInEditor(el).then(() => {
    if (generation !== enrichGeneration || editorRef.value !== el) {
      return
    }
    resizeInput()
  })
}

const disabledRef = toRef(props, 'disabled')
/**
 * 点麦 mousedown 时快照的插入偏移（click 抢焦前）。
 * startListening 消费后清空。
 */
let pendingSpeechInsertOffset: number | null = null

function captureSpeechInsertOffsetFromEditor(): void {
  const el = editorRef.value
  if (!el) {
    pendingSpeechInsertOffset = model.value.length
    return
  }
  const offset = getClueEditorPlainCaretOffset(el)
  pendingSpeechInsertOffset = offset ?? model.value.length
}

const speech = useComposerSpeechDictation({
  model,
  disabled: computed(() => Boolean(disabledRef.value)),
  getInsertOffset: () => {
    if (pendingSpeechInsertOffset !== null) {
      const offset = pendingSpeechInsertOffset
      pendingSpeechInsertOffset = null
      return offset
    }
    const el = editorRef.value
    if (!el) {
      return model.value.length
    }
    return getClueEditorPlainCaretOffset(el) ?? model.value.length
  }
})

const isListening = computed(() => speech.status.value === 'listening')
const voiceMeter = useVoiceInputMeter(isListening)

const voiceButtonLabel = computed(() =>
  isListening.value ? props.voiceStopLabel : props.voiceStartLabel
)

const showMicPermissionStrip = computed(
  () => speech.supported && speech.status.value === 'requesting_permission'
)

const voiceTitle = computed(() => {
  if (!speech.supported) {
    return props.voiceUnavailableLabel
  }
  const errorKey = speech.lastErrorKey.value
  if (errorKey) {
    return t(errorKey)
  }
  return voiceButtonLabel.value
})

/** 柱高 px：跟电平；装饰用，不用 transform。 */
const meterBarStyles = computed(() => {
  const minPx = 4
  const maxPx = 22
  return voiceMeter.barLevels.value.map(ratio => ({
    height: `${Math.round(minPx + ratio * (maxPx - minPx))}px`
  }))
})

/** 与 CSS `.recall-input` 单行行高对齐；多行由 scrollHeight 撑开，空态固定单行。 */
const INPUT_MIN_HEIGHT_PX = 22
const INPUT_MAX_HEIGHT_PX = 160

/**
 * 随内容长高（仅 JS，不用 field-sizing）。
 * Edge Side Panel 窄栏下 field-sizing:content 会按长 placeholder 撑高，
 * 首字输入后回落并触发 focus scroll，整页下移、底栏贴边裁切；Chrome 宽栏不易复现。
 * 空态固定单行；有字再按 scrollHeight 长高。长高后钉死文档滚动，防止 Edge 滚视口。
 */
function pinDocumentScroll(): void {
  if (typeof window === 'undefined') {
    return
  }
  if (window.scrollY !== 0 || document.documentElement.scrollTop !== 0) {
    window.scrollTo(0, 0)
  }
  if (document.body.scrollTop !== 0) {
    document.body.scrollTop = 0
  }
}

function isEditorEmpty(): boolean {
  const el = editorRef.value
  if (!el) {
    return true
  }
  return serializeClueEditorPlain(el).trim().length === 0
}

function updateEmptyAttr(): void {
  const el = editorRef.value
  if (!el) {
    return
  }
  if (isEditorEmpty()) {
    el.setAttribute('data-empty', 'true')
  } else {
    el.removeAttribute('data-empty')
  }
}

function resizeInput(): void {
  const el = editorRef.value
  if (!el) {
    return
  }
  if (isEditorEmpty()) {
    el.style.height = `${INPUT_MIN_HEIGHT_PX}px`
    updateEmptyAttr()
    pinDocumentScroll()
    return
  }
  el.style.height = 'auto'
  const next = Math.min(Math.max(el.scrollHeight, INPUT_MIN_HEIGHT_PX), INPUT_MAX_HEIGHT_PX)
  el.style.height = `${next}px`
  updateEmptyAttr()
  pinDocumentScroll()
}

/**
 * DOM → model。
 * @param formatUrls 是否扫描收 URL 芯片。键入 / IME **禁止**；仅 blur / 发送 / 粘贴路径为 true。
 */
function syncModelFromEditor(options?: { chipTrailing?: boolean; formatUrls?: boolean }): void {
  const el = editorRef.value
  if (!el || syncingFromModel) {
    return
  }
  const caret = getClueEditorPlainCaretOffset(el)
  let plain = enforceClueLengthCap(el)
  const chipTrailing = options?.chipTrailing === true
  const formatUrls = options?.formatUrls === true
  // 手动键入保持纯文本；不在 @input 路径做 URL→芯片
  if (!isComposing && formatUrls) {
    const rebuilt = maybeRebuildClueEditorChips(el, plain, { chipTrailing })
    if (rebuilt) {
      plain = enforceClueLengthCap(el)
      if (caret !== null) {
        setClueEditorPlainCaretOffset(el, Math.min(caret, plain.length))
      }
      scheduleEnrichUrlChipTitles()
    }
  }
  if (plain !== model.value) {
    model.value = plain
  }
  resizeInput()
}

/**
 * 外部 clue 写入编辑器（听写 / prefill / 取消还原）。
 * @param caret 重建后光标；听写结束用转写段末偏移，勿一律 `'end'`（否则会跳过光标后原文）。
 */
function applyModelToEditor(
  plain: string,
  chipTrailing: boolean,
  options?: { caret?: 'end' | 'start' | number }
): void {
  const el = editorRef.value
  if (!el) {
    return
  }
  const clamped = clampRecallClueText(plain)
  if (clamped.truncated) {
    notifyClueTooLong()
    if (clamped.text !== model.value) {
      model.value = clamped.text
    }
  }
  const nextPlain = clamped.text
  syncingFromModel = true
  try {
    setClueEditorFromPlainText(el, nextPlain, { chipTrailing })
    updateEmptyAttr()
    const caretMode = options?.caret ?? 'end'
    if (caretMode === 'end') {
      setClueEditorPlainCaretOffset(el, nextPlain.length)
    } else if (caretMode === 'start') {
      setClueEditorPlainCaretOffset(el, 0)
    } else {
      setClueEditorPlainCaretOffset(el, Math.min(caretMode, nextPlain.length))
    }
  } finally {
    syncingFromModel = false
  }
  resizeInput()
  scheduleEnrichUrlChipTitles()
}

/** focus 后再钉光标（部分浏览器 focus contenteditable 会甩到开头）。 */
function focusWithCaretAt(offset: number): void {
  const el = editorRef.value
  focus()
  if (!el) {
    return
  }
  setClueEditorPlainCaretOffset(el, offset)
}

function handleKeydown(event: KeyboardEvent): void {
  if (props.disabled) {
    return
  }
  // Enter 发送；Shift+Enter 换行；IME 组字中不拦截（避免拼音选词误发）
  if (event.key === 'Enter' && !event.shiftKey) {
    if (event.isComposing || isComposing) {
      return
    }
    event.preventDefault()
    // 发送前收文末 URL 芯片（手打完整 URL 的收口）
    syncModelFromEditor({ chipTrailing: true, formatUrls: true })
    emit('send')
    return
  }
}

function handleBeforeInput(event: InputEvent): void {
  if (props.disabled) {
    event.preventDefault()
    return
  }
  const el = editorRef.value
  if (!el) {
    return
  }
  const insertType =
    event.inputType === 'insertText' ||
    event.inputType === 'insertCompositionText' ||
    event.inputType === 'insertFromPaste' ||
    event.inputType === 'insertParagraph' ||
    event.inputType === 'insertLineBreak'
  // 粘贴由 @paste 统一处理（含截断）；此处跳过以免双插
  if (event.inputType === 'insertFromPaste') {
    return
  }

  const data =
    event.data ??
    (event.inputType === 'insertParagraph' || event.inputType === 'insertLineBreak' ? '\n' : '')

  // 选区落在 ce=false 芯片内时，浏览器仍可能把字打进芯片 → 改插到芯片后
  const insideChip = findClueUrlChipContainingSelection(el)
  if (insideChip) {
    if (!insertType) {
      return
    }
    event.preventDefault()
    const slot = ensureZwspAfterClueUrlChip(insideChip)
    const selection = window.getSelection()
    if (selection) {
      const range = document.createRange()
      range.setStart(slot, Math.min(1, slot.data.length))
      range.collapse(true)
      selection.removeAllRanges()
      selection.addRange(range)
    }
    if (!data) {
      return
    }
    insertPlainTextWithinClueLimit(el, data)
    const next = serializeClueEditorPlain(el)
    if (next !== model.value) {
      model.value = next
    }
    resizeInput()
    return
  }

  // 普通键入：超限物理拦截（截断可写入部分）
  if (!insertType || !data) {
    return
  }
  const plainLen = serializeClueEditorPlain(el).length
  const selected = approxSelectedPlainLength(el)
  const room = remainingRecallClueInsertCapacity(plainLen, selected)
  if (data.length <= room) {
    return
  }
  event.preventDefault()
  if (room > 0) {
    insertPlainTextWithinClueLimit(el, data)
    const next = serializeClueEditorPlain(el)
    if (next !== model.value) {
      model.value = next
    }
    resizeInput()
  } else {
    notifyClueTooLong()
  }
}

function handleInput(): void {
  if (syncingFromModel) {
    return
  }
  const el = editorRef.value
  if (el) {
    ensureClueEditorCaretSlots(el)
  }
  // 键入：只同步纯文本 model，不做 URL→芯片
  syncModelFromEditor()
}

function handleCompositionStart(): void {
  isComposing = true
}

function handleCompositionEnd(): void {
  isComposing = false
  syncModelFromEditor()
}

function handlePaste(event: ClipboardEvent): void {
  event.preventDefault()
  if (props.disabled) {
    return
  }
  const el = editorRef.value
  if (!el) {
    return
  }
  const piece = event.clipboardData?.getData('text/plain') ?? ''
  if (!piece) {
    return
  }
  const caretBefore = getClueEditorPlainCaretOffset(el)
  const insertedLen = insertPlainTextWithinClueLimit(el, piece)
  if (insertedLen === 0) {
    return
  }
  let plain = serializeClueEditorPlain(el)
  maybeRebuildClueEditorChips(el, plain, { chipTrailing: true })
  plain = enforceClueLengthCap(el)
  if (plain !== model.value) {
    model.value = plain
  }
  if (caretBefore !== null) {
    setClueEditorPlainCaretOffset(el, Math.min(caretBefore + insertedLen, plain.length))
  }
  resizeInput()
  scheduleEnrichUrlChipTitles()
}

function handleBlur(): void {
  // 失焦收文末完整 URL（粘贴为主；手打打完失焦也可成芯片）
  syncModelFromEditor({ chipTrailing: true, formatUrls: true })
}

/** 点在 URL 芯片上：避免 contenteditable 抢 caret；返回芯片根。 */
function chipFromEventTarget(target: EventTarget | null): Element | null {
  if (!(target instanceof Element) || !editorRef.value) {
    return null
  }
  const chip = target.closest(`[${CLUE_URL_CHIP_ATTR}]`)
  if (!chip || !editorRef.value.contains(chip)) {
    return null
  }
  return chip
}

/**
 * mousedown 先拦住：否则 Chrome contenteditable 会先改选区，click 像「没点开」。
 */
function handleEditorMouseDown(event: MouseEvent): void {
  const chip = chipFromEventTarget(event.target)
  if (!chip) {
    return
  }
  event.preventDefault()
}

function handleEditorClick(event: MouseEvent): void {
  const chip = chipFromEventTarget(event.target)
  if (!chip) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  const href = normalizeClueUrl(chip.getAttribute(CLUE_URL_CHIP_ATTR) ?? '')
  if (!href) {
    return
  }
  // 芯片像超链接：默认新开前台标签（活动标签已是同 URL 时 currentTab 无感）
  // Shift+点击 → 当前活动标签（对齐结果卡默认）
  const disposition =
    event.shiftKey && !event.metaKey && !event.ctrlKey ? 'currentTab' : 'newForegroundTab'
  void navigateActiveTab({
    url: href,
    disposition
  }).catch(() => {
    // 忽略：导航失败不打断输入
  })
}

/** 听写中编辑器隐藏，Esc 挂在 window。 */
function handleListeningEscape(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || !isListening.value) {
    return
  }
  event.preventDefault()
  speech.cancelListening()
}

function focus(): void {
  editorRef.value?.focus({ preventScroll: true })
  pinDocumentScroll()
}

/**
 * 点麦前 mousedown：禁止按钮抢焦（保住 contenteditable 选区），并快照插入偏移。
 * 停止听写时不必快照。
 */
function handleVoiceMouseDown(event: MouseEvent): void {
  if (props.disabled) {
    return
  }
  // 避免 mic 按钮拿到 focus → 编辑器选区丢失
  event.preventDefault()
  if (!isListening.value) {
    captureSpeechInsertOffsetFromEditor()
  }
}

function handleVoiceClick(): void {
  if (!speech.supported || props.disabled) {
    return
  }
  speech.toggleListening()
}

function handleCancelVoice(): void {
  if (props.disabled) {
    return
  }
  speech.cancelListening()
}

function handleSendClick(): void {
  if (props.disabled || !model.value.trim()) {
    return
  }
  syncModelFromEditor({ chipTrailing: true })
  emit('send')
}

watch(model, async (next, prev) => {
  // 听写中编辑器隐藏，结束时再一次性重建（避免 interim 把 caret 钉到全文末）
  if (isListening.value) {
    return
  }
  const el = editorRef.value
  if (!el) {
    return
  }
  const current = serializeClueEditorPlain(el)
  // 外部写入（prefill / 取消还原 / 清空）才重建；用户键入已由 input 同步
  if (next === current) {
    await nextTick()
    resizeInput()
    return
  }
  if (next === prev) {
    return
  }
  applyModelToEditor(next, true, { caret: 'end' })
  await nextTick()
  resizeInput()
})

watch(
  () => props.disabled,
  disabled => {
    const el = editorRef.value
    if (!el) {
      return
    }
    el.contentEditable = disabled ? 'false' : 'true'
  }
)

watch(
  () => props.prominent,
  async () => {
    await nextTick()
    resizeInput()
  }
)

watch(
  () => props.placeholder,
  () => {
    const el = editorRef.value
    if (!el) {
      return
    }
    el.setAttribute('data-placeholder', props.placeholder)
  }
)

watch(isListening, async listening => {
  if (listening) {
    window.addEventListener('keydown', handleListeningEscape)
  } else {
    window.removeEventListener('keydown', handleListeningEscape)
    await nextTick()
    // 听写结束：光标钉在转写段末尾（其后仍是点麦时的原文，如 URL 芯片）
    const caretOffset = speech.caretAfterInsert.value
    const caret = caretOffset !== null ? caretOffset : 'end'
    applyModelToEditor(model.value, true, { caret })
    resizeInput()
    await nextTick()
    const plainLen = model.value.length
    focusWithCaretAt(caretOffset !== null ? Math.min(caretOffset, plainLen) : plainLen)
  }
})

onMounted(() => {
  const el = editorRef.value
  if (el) {
    el.setAttribute('data-placeholder', props.placeholder)
    el.contentEditable = props.disabled ? 'false' : 'true'
    applyModelToEditor(model.value, true)
  }
  resizeInput()
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleListeningEscape)
})

defineExpose({ focus })
</script>

<template>
  <div class="recall-form" :class="{ 'recall-form--prominent': prominent }">
    <div v-if="showMicPermissionStrip" class="recall-voice-permission" role="status">
      <p class="recall-voice-permission__text">{{ t('sidepanel_voice_permission_hint') }}</p>
      <div class="recall-voice-permission__actions">
        <button
          type="button"
          class="recall-voice-permission__allow"
          :disabled="props.disabled || speech.permissionBusy.value"
          @click="speech.allowMicrophoneFromPanel()"
        >
          {{
            speech.permissionBusy.value
              ? t('sidepanel_voice_permission_busy')
              : t('sidepanel_voice_permission_allow')
          }}
        </button>
        <button
          type="button"
          class="recall-voice-permission__dismiss"
          :aria-label="t('sidepanel_voice_permission_dismiss')"
          :disabled="speech.permissionBusy.value"
          @click="speech.dismissPermissionPrompt()"
        >
          <AppIcon name="close" size="16px" />
        </button>
      </div>
    </div>
    <div class="recall-composer-shell" :class="{ 'recall-composer-shell--listening': isListening }">
      <!-- 上行：线索编辑 / 听写波形（与工具图标分行，ChatGPT 式） -->
      <div class="recall-composer-main">
        <div
          v-show="!isListening"
          ref="editorRef"
          class="recall-input"
          role="textbox"
          aria-multiline="true"
          :aria-label="props.ariaLabel"
          :aria-disabled="props.disabled ? 'true' : undefined"
          data-empty="true"
          spellcheck="true"
          @keydown="handleKeydown"
          @beforeinput="handleBeforeInput"
          @input="handleInput"
          @paste="handlePaste"
          @compositionstart="handleCompositionStart"
          @compositionend="handleCompositionEnd"
          @blur="handleBlur"
          @focus="pinDocumentScroll"
          @mousedown="handleEditorMouseDown"
          @click="handleEditorClick"
        />
        <div
          v-if="isListening"
          class="recall-voice-meter"
          role="status"
          :aria-label="t('sidepanel_voice_listening')"
        >
          <span
            v-for="(style, index) in meterBarStyles"
            :key="index"
            class="recall-voice-meter__bar"
            :style="style"
          />
        </div>
      </div>

      <!-- 下行：设置 / 取消 · 语音 · 发送 -->
      <div class="recall-composer-toolbar">
        <button
          v-if="isListening"
          type="button"
          class="recall-voice-cancel"
          :aria-label="t('sidepanel_voice_cancel')"
          :title="t('sidepanel_voice_cancel')"
          :disabled="props.disabled"
          @click="handleCancelVoice"
        >
          {{ t('sidepanel_voice_cancel') }}
        </button>
        <slot v-else name="leading" />
        <div class="recall-composer-toolbar__end">
          <button
            v-if="speech.supported"
            type="button"
            class="recall-voice-button"
            :class="{ 'recall-voice-button--listening': isListening }"
            :aria-label="voiceButtonLabel"
            :title="voiceTitle"
            :aria-pressed="isListening"
            :disabled="props.disabled"
            @mousedown="handleVoiceMouseDown"
            @click="handleVoiceClick"
          >
            <span v-if="isListening" class="recall-voice-stop-glyph" aria-hidden="true" />
            <AppIcon v-else name="mic" size="18px" />
          </button>
          <button
            type="button"
            class="recall-send-button"
            :aria-label="props.sendLabel"
            :disabled="props.disabled || !model.trim()"
            @click="handleSendClick"
          >
            <AppIcon name="arrow_upward" size="18px" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.recall-form {
  flex-shrink: 0;
  margin-top: var(--space-xs);
  padding-top: var(--space-2xs);
}

.recall-form--prominent {
  margin-top: 0;
  padding-top: 0;
}

.recall-voice-permission {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2xs) var(--space-xs);
  margin: 0 0 var(--space-2xs);
  padding: var(--space-2xs) var(--space-xs);
  border: 1px solid color-mix(in srgb, var(--accent) 28%, var(--border));
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--accent) 8%, var(--surface-white));
}

.recall-voice-permission__text {
  flex: 1 1 10rem;
  margin: 0;
  color: var(--on-surface);
  font-size: 12px;
  line-height: 1.4;
}

.recall-voice-permission__actions {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: var(--space-2xs);
}

.recall-voice-permission__allow {
  margin: 0;
  padding: 4px 10px;
  border: 0;
  border-radius: var(--radius-full);
  color: var(--on-accent);
  background: var(--accent);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.recall-voice-permission__allow:hover:not(:disabled) {
  background: color-mix(in srgb, var(--accent) 88%, var(--ink) 12%);
}

.recall-voice-permission__allow:disabled {
  opacity: 0.6;
  cursor: default;
}

.recall-voice-permission__allow:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.recall-voice-permission__dismiss {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  width: 28px;
  height: 28px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: var(--radius-full);
  color: var(--on-surface-muted);
  background: transparent;
  cursor: pointer;
}

.recall-voice-permission__dismiss:hover:not(:disabled) {
  color: var(--on-surface);
  background: color-mix(in srgb, var(--ink) 6%, transparent);
}

.recall-voice-permission__dismiss:disabled {
  opacity: 0.5;
  cursor: default;
}

.recall-voice-permission__dismiss:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.recall-composer-shell {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
  box-sizing: border-box;
  width: 100%;
  min-width: 0;

  /* 上行编辑 + 下行 36px 工具条 + 内边距 */
  min-height: 0;
  max-height: calc(160px + 36px + var(--space-2xs) + 2 * var(--space-sm));
  padding: var(--space-sm) var(--space-sm) var(--space-xs);
  border: 1px solid color-mix(in srgb, var(--border) 85%, var(--ink));
  border-radius: var(--radius-xl);
  /* ChatGPT 式浮底：半透明毛玻璃；扁平——无抬升阴影，靠边框分区 */
  background: color-mix(in srgb, var(--surface-white) 62%, transparent);
  box-shadow: none;
  -webkit-backdrop-filter: blur(18px) saturate(1.15);
  backdrop-filter: blur(18px) saturate(1.15);
  /* 可见：壳内 leading 的悬浮设置面板可向上溢出 */
  overflow: visible;
}

.recall-composer-shell--listening {
  border-color: color-mix(in srgb, var(--accent) 36%, var(--border));
}

.recall-form--prominent .recall-composer-shell {
  box-shadow: none;
}

.recall-composer-shell:focus-within {
  border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
  outline: 2px solid color-mix(in srgb, var(--accent) 35%, transparent);
  outline-offset: 1px;
  box-shadow: none;
}

.recall-composer-main {
  display: flex;
  flex: 1 1 auto;
  align-items: stretch;
  min-width: 0;
  min-height: 22px;
}

.recall-composer-toolbar {
  display: flex;
  flex-shrink: 0;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2xs);
  min-width: 0;
  min-height: 36px;
}

.recall-composer-toolbar__end {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 2px;
  margin-left: auto;
}

.recall-input {
  flex: 1 1 auto;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  height: 22px;
  min-height: 22px;
  max-height: 160px;
  margin: 0;
  padding: 0;
  border: 0;
  outline: none;
  font-family: inherit;
  font-size: 15px;
  line-height: 1.45;
  color: inherit;
  background: transparent;
  overflow-x: hidden;
  overflow-y: auto;
  overflow-anchor: none;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
  caret-color: var(--on-surface);
}

.recall-input:focus {
  outline: none;
}

.recall-input[data-empty='true']::before {
  content: attr(data-placeholder);
  color: var(--on-surface-muted);
  pointer-events: none;
  float: left;
  height: 0;
}

.recall-input[aria-disabled='true'] {
  opacity: 0.6;
  cursor: default;
}

.recall-voice-cancel {
  display: inline-flex;
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
  min-height: 32px;
  margin: 0;
  padding: 0 var(--space-sm);
  border: 0;
  border-radius: var(--radius-full);
  color: var(--on-surface-muted);
  background: color-mix(in srgb, var(--ink) 5%, transparent);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  line-height: 1.2;
  white-space: nowrap;
  transition:
    background-color 140ms ease-out,
    color 140ms ease-out;
}

.recall-voice-cancel:hover:not(:disabled) {
  color: var(--on-surface);
  background: color-mix(in srgb, var(--ink) 10%, transparent);
}

.recall-voice-cancel:disabled {
  opacity: 0.5;
  cursor: default;
}

.recall-voice-cancel:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.recall-voice-meter {
  display: flex;
  flex: 1 1 auto;
  justify-content: center;
  align-items: center;
  gap: 3px;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  min-height: 28px;
  padding: 2px 0;
}

.recall-voice-meter__bar {
  display: block;
  flex: 0 0 auto;
  width: 3px;
  min-height: 4px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--on-surface-muted) 72%, var(--accent) 28%);
  transition: height 70ms linear;
}

@media (prefers-reduced-motion: reduce) {
  .recall-voice-meter__bar {
    transition: none;
    height: 8px !important;
    opacity: 0.7;
  }
}

.recall-voice-button {
  display: inline-flex;
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
  width: 36px;
  height: 36px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: var(--radius-full);
  color: var(--on-surface-muted);
  background: transparent;
  cursor: pointer;
  transition:
    background-color 140ms ease-out,
    color 140ms ease-out,
    opacity 140ms ease-out;
}

.recall-voice-button:hover:not(:disabled) {
  color: var(--on-surface);
  background: color-mix(in srgb, var(--ink) 6%, transparent);
}

.recall-voice-button--listening {
  color: var(--on-surface);
  background: color-mix(in srgb, var(--ink) 8%, transparent);
  box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--accent) 55%, var(--border));
}

.recall-voice-button--listening:hover:not(:disabled) {
  background: color-mix(in srgb, var(--ink) 12%, transparent);
}

.recall-voice-stop-glyph {
  display: block;
  width: 10px;
  height: 10px;
  border-radius: 2px;
  background: currentColor;
}

.recall-voice-button:disabled {
  opacity: 0.5;
  cursor: default;
}

.recall-voice-button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.recall-send-button {
  display: inline-flex;
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
  width: 36px;
  height: 36px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: var(--radius-full);
  color: var(--on-accent);
  background: var(--accent);
  cursor: pointer;
  transition:
    background-color 140ms ease-out,
    opacity 140ms ease-out;
}

.recall-send-button:disabled {
  color: var(--on-surface-muted);
  background: var(--surface-chrome);
  cursor: default;
}

.recall-send-button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.recall-send-button:hover:not(:disabled) {
  background: color-mix(in srgb, var(--accent) 88%, var(--ink) 12%);
}
</style>
