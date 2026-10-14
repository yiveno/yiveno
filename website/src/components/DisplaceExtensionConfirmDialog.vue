<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

defineOptions({ name: 'DisplaceExtensionConfirmDialog' })

const props = defineProps<{
  /** 确认后异步交接（先废前者再 mint）；失败时弹窗内提示并可再试 */
  onConfirm: () => Promise<boolean>
}>()

const emit = defineEmits<{
  resolve: [confirmed: boolean]
}>()

const busy = ref(false)
const error = ref('')
const continueBtn = ref<HTMLButtonElement | null>(null)

function cancel(): void {
  if (busy.value) {
    return
  }
  emit('resolve', false)
}

async function continueDisplace(): Promise<void> {
  if (busy.value) {
    return
  }
  busy.value = true
  error.value = ''
  try {
    const ok = await props.onConfirm()
    if (ok) {
      emit('resolve', true)
      return
    }
    error.value =
      "Couldn't sign out the other extension session. Check your connection and try again."
  } catch (e: unknown) {
    console.warn('[DisplaceConfirm] onConfirm failed', e)
    error.value =
      "Couldn't sign out the other extension session. Check your connection and try again."
  } finally {
    busy.value = false
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    cancel()
  }
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  continueBtn.value?.focus()
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="displace-dialog" role="presentation">
    <!-- 遮罩仅挡操作，点击不关闭（须显式选 Cancel / Continue） -->
    <div class="displace-dialog__backdrop" aria-hidden="true" />
    <div
      class="displace-dialog__panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="displace-dialog-title"
      aria-describedby="displace-dialog-desc"
    >
      <h2 id="displace-dialog-title" class="displace-dialog__title">Continue signing in?</h2>
      <p id="displace-dialog-desc" class="displace-dialog__body">
        This account already has an active extension session. Continuing signs that one out so this
        install can connect. Continue?
      </p>
      <p v-if="error" class="displace-dialog__error" role="alert">{{ error }}</p>
      <div class="displace-dialog__actions">
        <button type="button" class="ui-btn" :disabled="busy" @click="cancel">Not now</button>
        <button
          ref="continueBtn"
          type="button"
          class="ui-btn ui-btn--primary"
          :disabled="busy"
          @click="continueDisplace"
        >
          {{ busy ? 'Signing out the other session…' : 'Continue' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.displace-dialog {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.displace-dialog__backdrop {
  position: absolute;
  inset: 0;
  background: color-mix(in srgb, var(--ink) 42%, transparent);
}

.displace-dialog__panel {
  position: relative;
  z-index: 1;
  width: min(100%, 420px);
  padding: 28px 24px 22px;
  border-radius: var(--radius-md, 12px);
  border: 1px solid var(--border);
  background: var(--surface);
  box-shadow: 0 16px 48px color-mix(in srgb, var(--ink) 18%, transparent);
}

.displace-dialog__title {
  margin: 0 0 12px;
  font-family: var(--font-display);
  font-size: 1.35rem;
  font-weight: 500;
  line-height: 1.25;
  color: var(--on-surface);
}

.displace-dialog__body {
  margin: 0 0 20px;
  font-size: 15px;
  font-weight: 300;
  line-height: 1.55;
  color: var(--on-surface-muted, var(--muted));
}

.displace-dialog__error {
  margin: -8px 0 16px;
  font-size: 14px;
  font-weight: 400;
  line-height: 1.45;
  color: var(--danger);
}

.displace-dialog__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}
</style>
