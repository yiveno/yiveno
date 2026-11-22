<script setup lang="ts">
/**
 * 绑定 OTP 共享弹窗：Settings 试用区 + Side Panel 配额尽提示共用。
 * 自持状态机与倒计时；每次打开重置；进行中禁 Esc/关闭。
 */
import { computed, onUnmounted, ref, watch } from 'vue'

import {
  bindOtpCanSendCode,
  bindOtpCanVerify,
  bindOtpConfirmFail,
  bindOtpConfirmOk,
  bindOtpIsBusy,
  bindOtpSendFail,
  bindOtpSendOk,
  bindOtpSetCode,
  bindOtpSetEmail,
  bindOtpStartSend,
  bindOtpStartVerify,
  bindOtpTickCooldown,
  bindOtpVerifyFail,
  bindOtpVerifyOk,
  createBindOtpState,
  type BindOtpState
} from '@/core/identity/bind-otp-flow'
import {
  bindRequestCode,
  bindVerifyCode,
  convertAnonymousAccount
} from '@/infrastructure/messaging/background-client'
import { getEffectiveUiLocale, t } from '@/infrastructure/i18n/t'
import AppButton from '@/infrastructure/ui/AppButton.vue'
import AppModal from '@/infrastructure/ui/AppModal.vue'
import { tBindOtpError } from '@/pages/shared/bind-otp-error-copy'

defineOptions({ name: 'BindOtpModal' })

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
  /** 成功步点完成后发出；调用方刷新账号状态 */
  success: [payload: { branch: 'promote' | 'claim' }]
}>()

const state = ref<BindOtpState>(createBindOtpState())
const loading = computed(() => bindOtpIsBusy(state.value))
const errorText = computed(() =>
  state.value.errorKind ? tBindOtpError(state.value.errorKind, state.value.remainingAttempts) : ''
)
const isSuccess = computed(() => state.value.phase === 'success')
const successCopy = computed(() => {
  if (state.value.branch === 'claim') {
    return t('bind_otp_modal_success_claim')
  }
  return t('bind_otp_modal_success_promote')
})

let cooldownTimer: ReturnType<typeof setInterval> | null = null

function stopCooldown(): void {
  if (cooldownTimer != null) {
    clearInterval(cooldownTimer)
    cooldownTimer = null
  }
}

function startCooldown(): void {
  stopCooldown()
  cooldownTimer = setInterval(() => {
    state.value = bindOtpTickCooldown(state.value)
    if (state.value.resendCooldownSec <= 0) {
      stopCooldown()
    }
  }, 1000)
}

function resetSession(): void {
  stopCooldown()
  state.value = createBindOtpState()
}

watch(
  () => props.open,
  open => {
    if (open) {
      // 每次打开必须全新状态，避免 success/code_sent 残留
      resetSession()
      return
    }
    stopCooldown()
  }
)

onUnmounted(() => {
  stopCooldown()
})

function bindOtpLocale(): 'en' | 'zh' {
  return getEffectiveUiLocale() === 'zh_CN' ? 'zh' : 'en'
}

function onEmailInput(event: Event): void {
  const target = event.target as HTMLInputElement | null
  state.value = bindOtpSetEmail(state.value, target?.value ?? '')
}

function onCodeInput(event: Event): void {
  const target = event.target as HTMLInputElement | null
  state.value = bindOtpSetCode(state.value, target?.value ?? '')
}

function requestClose(): void {
  if (loading.value) {
    return
  }
  emit('close')
}

function finishSuccess(): void {
  if (loading.value || state.value.phase !== 'success') {
    return
  }
  const branch = state.value.branch
  emit('close')
  if (branch === 'promote' || branch === 'claim') {
    emit('success', { branch })
  }
}

/** 发绑定验证码（含 captcha 前景重试）。 */
async function handleSendCode(options?: { foreground?: boolean }): Promise<void> {
  const allowCaptchaRetry = options?.foreground === true && state.value.captchaRetryNeeded
  if (!allowCaptchaRetry && !bindOtpCanSendCode(state.value)) {
    return
  }
  state.value = bindOtpStartSend(state.value)
  try {
    const response = await bindRequestCode({
      email: state.value.email.trim(),
      locale: bindOtpLocale(),
      ...(options?.foreground === true ? { foreground: true } : {})
    })
    if (!response.ok) {
      state.value = bindOtpSendFail(
        state.value,
        response.errorCode === 'AUTH_BIND_CAPTCHA_REQUIRED' ? 'captcha_required' : response.error
      )
      return
    }
    state.value = bindOtpSendOk(state.value)
    startCooldown()
  } catch {
    state.value = bindOtpSendFail(state.value, 'failed')
  }
}

/** 验码 → promote/claim。 */
async function handleVerifyCode(): Promise<void> {
  if (!bindOtpCanVerify(state.value)) {
    return
  }
  state.value = bindOtpStartVerify(state.value)
  try {
    const verify = await bindVerifyCode({
      email: state.value.email.trim(),
      code: state.value.code.trim()
    })
    if (!verify.ok) {
      state.value = bindOtpVerifyFail(state.value, verify.error, verify.remainingAttempts)
      return
    }
    state.value = bindOtpVerifyOk(state.value, {
      branch: verify.branch,
      claimToken: verify.claimToken
    })
    const claimToken = state.value.claimToken
    if (!claimToken) {
      state.value = bindOtpConfirmFail(state.value, 'failed')
      return
    }
    const convert = await convertAnonymousAccount({
      email: state.value.email.trim(),
      claimToken,
      branch: verify.branch
    })
    if (!convert.ok) {
      state.value = bindOtpConfirmFail(state.value, convert.error)
      return
    }
    state.value = bindOtpConfirmOk(state.value)
    stopCooldown()
  } catch {
    state.value = bindOtpConfirmFail(state.value, 'failed')
  }
}

const sendDisabled = computed(
  () =>
    loading.value ||
    !state.value.email.trim() ||
    state.value.resendCooldownSec > 0 ||
    isSuccess.value
)
const verifyDisabled = computed(
  () => loading.value || !state.value.code.trim() || state.value.phase === 'idle' || isSuccess.value
)
const sendLabel = computed(() => {
  if (state.value.phase === 'code_sending') {
    return t('settings_bind_send_code')
  }
  if (state.value.resendCooldownSec > 0) {
    return t('settings_bind_resend_cooldown', [String(state.value.resendCooldownSec)])
  }
  if (state.value.phase === 'code_sent' || state.value.phase === 'error') {
    return t('settings_bind_resend')
  }
  return t('settings_bind_send_code')
})
</script>

<template>
  <AppModal
    :open="open"
    :title="t('bind_otp_modal_title')"
    :description="t('bind_otp_modal_description')"
    :loading="loading"
    :close-on-escape="true"
    size="sm"
    @close="requestClose"
  >
    <template v-if="isSuccess">
      <p class="bind-otp-modal__success" role="status">{{ successCopy }}</p>
    </template>
    <template v-else>
      <label class="bind-otp-modal__label" for="bind-otp-modal-email">{{
        t('settings_promote_email_label')
      }}</label>
      <input
        id="bind-otp-modal-email"
        class="bind-otp-modal__input"
        type="email"
        autocomplete="email"
        :placeholder="t('settings_promote_email_placeholder')"
        :value="state.email"
        :disabled="loading"
        @input="onEmailInput"
      />
      <label class="bind-otp-modal__label" for="bind-otp-modal-code">{{
        t('settings_bind_code_label')
      }}</label>
      <input
        id="bind-otp-modal-code"
        class="bind-otp-modal__input"
        type="text"
        inputmode="numeric"
        autocomplete="one-time-code"
        maxlength="8"
        :placeholder="t('settings_bind_code_placeholder')"
        :value="state.code"
        :disabled="loading || state.phase === 'idle'"
        @input="onCodeInput"
      />
      <div class="bind-otp-modal__actions-row">
        <AppButton
          type="button"
          variant="outlined"
          :disabled="sendDisabled"
          :title="sendLabel"
          @click="handleSendCode()"
        >
          {{ sendLabel }}
        </AppButton>
        <AppButton
          type="button"
          variant="tonal"
          :disabled="verifyDisabled"
          :title="t('settings_bind_verify')"
          @click="handleVerifyCode"
        >
          {{
            state.phase === 'verifying' || state.phase === 'confirming'
              ? t('settings_bind_verifying')
              : t('settings_bind_verify')
          }}
        </AppButton>
        <AppButton
          v-if="state.captchaRetryNeeded"
          type="button"
          variant="outlined"
          :disabled="loading"
          :title="t('settings_bind_captcha_retry')"
          @click="handleSendCode({ foreground: true })"
        >
          {{ t('settings_bind_captcha_retry') }}
        </AppButton>
      </div>
    </template>

    <template v-if="errorText && !isSuccess" #error>{{ errorText }}</template>

    <template #actions>
      <template v-if="isSuccess">
        <AppButton type="button" variant="filled" @click="finishSuccess">
          {{ t('bind_otp_modal_done') }}
        </AppButton>
      </template>
      <template v-else>
        <AppButton type="button" variant="text" :disabled="loading" @click="requestClose">
          {{ t('settings_sign_out_cancel') }}
        </AppButton>
      </template>
    </template>
  </AppModal>
</template>

<style scoped>
.bind-otp-modal__label {
  display: block;
  font-size: var(--text-meta);
  line-height: var(--leading-snug);
  color: var(--on-surface-muted);
}

.bind-otp-modal__input {
  width: 100%;
  box-sizing: border-box;
  min-height: 40px;
  padding: 0 var(--space-sm);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-white);
  color: var(--on-surface);
  font: inherit;
  font-size: var(--text-body);
}

.bind-otp-modal__input:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.bind-otp-modal__input:disabled {
  opacity: var(--disabled-opacity);
}

.bind-otp-modal__actions-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
}

.bind-otp-modal__success {
  margin: 0;
  font-size: var(--text-body);
  line-height: var(--leading-relaxed);
  color: var(--on-surface);
}
</style>
