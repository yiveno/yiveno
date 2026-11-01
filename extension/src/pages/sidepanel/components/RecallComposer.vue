<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, toRef, watch } from 'vue'

import { t } from '@/infrastructure/i18n/t'
import AppIcon from '@/infrastructure/ui/icons/AppIcon.vue'
import { useComposerSpeechDictation } from '@/pages/sidepanel/use-composer-speech-dictation'
import { useVoiceInputMeter } from '@/pages/sidepanel/use-voice-input-meter'

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
const inputRef = ref<HTMLTextAreaElement | null>(null)

const disabledRef = toRef(props, 'disabled')
const speech = useComposerSpeechDictation({
  model,
  disabled: computed(() => Boolean(disabledRef.value))
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

function resizeInput(): void {
  const el = inputRef.value
  if (!el) {
    return
  }
  if (el.value.length === 0) {
    el.style.height = `${INPUT_MIN_HEIGHT_PX}px`
    pinDocumentScroll()
    return
  }
  el.style.height = 'auto'
  const next = Math.min(Math.max(el.scrollHeight, INPUT_MIN_HEIGHT_PX), INPUT_MAX_HEIGHT_PX)
  el.style.height = `${next}px`
  pinDocumentScroll()
}

function handleKeydown(event: KeyboardEvent): void {
  // Enter 发送；Shift+Enter 换行
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    emit('send')
  }
}

/** 听写中 textarea 隐藏，Esc 挂在 window。 */
function handleListeningEscape(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || !isListening.value) {
    return
  }
  event.preventDefault()
  speech.cancelListening()
}

function handleInput(): void {
  resizeInput()
}

function focus(): void {
  inputRef.value?.focus({ preventScroll: true })
  pinDocumentScroll()
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

watch(model, async () => {
  await nextTick()
  resizeInput()
})

watch(
  () => props.prominent,
  async () => {
    await nextTick()
    resizeInput()
  }
)

watch(isListening, async listening => {
  if (listening) {
    window.addEventListener('keydown', handleListeningEscape)
  } else {
    window.removeEventListener('keydown', handleListeningEscape)
    await nextTick()
    resizeInput()
    focus()
  }
})

onMounted(() => {
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
      <!-- 听写态：取消（还原点麦前 clue） -->
      <button
        v-if="isListening"
        type="button"
        class="recall-voice-cancel"
        :aria-label="t('sidepanel_voice_cancel')"
        :title="t('sidepanel_voice_cancel')"
        :disabled="props.disabled"
        @click="handleCancelVoice"
      >
        <AppIcon name="close" size="16px" />
      </button>
      <!-- 输入框内左侧工具（如 Recall settings）；听写态让位给波形 -->
      <slot v-if="!isListening" name="leading" />
      <textarea
        v-show="!isListening"
        ref="inputRef"
        v-model="model"
        class="recall-input"
        rows="1"
        :aria-label="props.ariaLabel"
        :placeholder="props.placeholder"
        :disabled="props.disabled"
        @keydown="handleKeydown"
        @input="handleInput"
        @focus="pinDocumentScroll"
      />
      <!-- 听写态：跟麦能量的波形（失败则氛围起伏） -->
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
      <button
        v-if="speech.supported"
        type="button"
        class="recall-voice-button"
        :class="{ 'recall-voice-button--listening': isListening }"
        :aria-label="voiceButtonLabel"
        :title="voiceTitle"
        :aria-pressed="isListening"
        :disabled="props.disabled"
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
        @click="emit('send')"
      >
        <AppIcon name="arrow_upward" size="18px" />
      </button>
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
  align-items: center;
  gap: var(--space-xs);
  box-sizing: border-box;
  width: 100%;
  min-width: 0;

  /* 单行高：按钮 36px + 上下 padding；文案与发送钮垂直居中 */
  min-height: 52px;
  max-height: calc(160px + 2 * var(--space-xs));
  padding: var(--space-xs);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface-white);
  box-shadow:
    0 1px 2px color-mix(in srgb, var(--ink) 8%, transparent),
    0 8px 24px color-mix(in srgb, var(--ink) 6%, transparent);
  /* 可见：壳内 leading 的悬浮设置面板可向上溢出 */
  overflow: visible;
}

.recall-composer-shell--listening {
  border-color: color-mix(in srgb, var(--accent) 36%, var(--border));
}

.recall-form--prominent .recall-composer-shell {
  box-shadow:
    0 1px 2px color-mix(in srgb, var(--ink) 10%, transparent),
    0 12px 32px color-mix(in srgb, var(--ink) 8%, transparent);
}

.recall-composer-shell:focus-within {
  border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
  box-shadow:
    0 1px 2px color-mix(in srgb, var(--ink) 8%, transparent),
    0 8px 24px color-mix(in srgb, var(--ink) 6%, transparent),
    0 0 0 3px color-mix(in srgb, var(--accent) 12%, transparent);
}

.recall-input {
  flex: 1 1 auto;
  align-self: center;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  height: 22px;
  min-height: 22px;
  max-height: 160px;

  /* 不用 field-sizing：见 resizeInput 注释（Edge 首字回落 + 整页下移） */
  field-sizing: fixed;
  margin: 0;
  padding: 0;
  border: 0;
  outline: none;
  font-family: inherit;
  font-size: 15px;
  line-height: 1.45;
  color: inherit;
  background: transparent;
  resize: none;
  overflow-x: hidden;
  overflow-y: auto;
  overflow-anchor: none;
}

.recall-input:focus {
  outline: none;
}

.recall-input::placeholder {
  color: var(--on-surface-muted);
}

.recall-voice-cancel {
  display: inline-flex;
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
  width: 32px;
  height: 32px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: var(--radius-full);
  color: var(--on-surface-muted);
  background: color-mix(in srgb, var(--ink) 5%, transparent);
  cursor: pointer;
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
  min-width: 0;
  height: 28px;
  padding: 0 var(--space-2xs);
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
