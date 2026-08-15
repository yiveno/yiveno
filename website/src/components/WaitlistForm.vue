<script setup lang="ts">
import { computed, ref, useId } from 'vue'

defineOptions({ name: 'WaitlistForm' })

const props = withDefaults(
  defineProps<{
    /** 深色底（Hero / Final CTA）或浅色底 */
    tone?: 'dark' | 'light'
    /** 居中排版（Final CTA） */
    centered?: boolean
  }>(),
  {
    tone: 'dark',
    centered: false
  }
)

const apiBase = (import.meta.env.PUBLIC_API_BASE_URL || 'https://api.yiveno.com').replace(/\/$/, '')
const emailId = useId()
const companyId = useId()

const email = ref('')
const company = ref('')
const status = ref<'idle' | 'submitting' | 'success' | 'invalid' | 'error'>('idle')
const errorMessage = ref('')

const rootClass = computed(() => [
  'waitlist',
  `waitlist--${props.tone}`,
  props.centered ? 'waitlist--centered' : null
])

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254
}

async function onSubmit(event: Event): Promise<void> {
  event.preventDefault()
  errorMessage.value = ''
  const trimmed = email.value.trim()

  if (!isValidEmail(trimmed)) {
    status.value = 'invalid'
    errorMessage.value = 'Enter a valid email so we can reach you.'
    return
  }

  status.value = 'submitting'
  try {
    const response = await fetch(`${apiBase}/api/website/waitlist`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: trimmed,
        company: company.value
      })
    })

    if (response.status === 429) {
      status.value = 'error'
      errorMessage.value = 'Too many tries from here. Please try again tomorrow.'
      return
    }

    if (!response.ok) {
      status.value = 'error'
      errorMessage.value = 'Something went wrong. Try again.'
      return
    }

    status.value = 'success'
  } catch {
    status.value = 'error'
    errorMessage.value = 'Something went wrong. Try again.'
  }
}

function onEmailInput(): void {
  if (status.value === 'invalid' || status.value === 'error') {
    status.value = 'idle'
    errorMessage.value = ''
  }
}
</script>

<template>
  <div :class="rootClass">
    <p v-if="status === 'success'" class="waitlist__ok" role="status">
      You're on the list. We'll write when Yiveno is ready.
    </p>
    <template v-else>
      <form class="waitlist__form" novalidate @submit="onSubmit">
        <label class="waitlist__label" :for="emailId">Email</label>
        <input
          :id="emailId"
          v-model="email"
          class="waitlist__input"
          :class="{ 'waitlist__input--error': status === 'invalid' || status === 'error' }"
          type="email"
          name="email"
          autocomplete="email"
          inputmode="email"
          placeholder="you@example.com"
          :disabled="status === 'submitting'"
          required
          @input="onEmailInput"
        />
        <div class="waitlist__hp" aria-hidden="true">
          <label :for="companyId">Company</label>
          <input
            :id="companyId"
            v-model="company"
            type="text"
            name="company"
            tabindex="-1"
            autocomplete="off"
          />
        </div>
        <button class="waitlist__submit" type="submit" :disabled="status === 'submitting'">
          {{ status === 'submitting' ? '···' : 'Notify me' }}
        </button>
      </form>
      <p v-if="status === 'invalid' || status === 'error'" class="waitlist__err" role="alert">
        {{ errorMessage }}
      </p>
      <p class="waitlist__note">
        Coming soon for Chrome. We'll only write when Yiveno is ready to install.
        <a href="/privacy">Privacy</a>
      </p>
    </template>
  </div>
</template>

<style scoped>
.waitlist {
  width: 100%;
  max-width: 440px;
}

.waitlist--centered {
  margin-inline: auto;
  text-align: center;
}

.waitlist__form {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: stretch;
}

.waitlist--centered .waitlist__form {
  justify-content: center;
}

.waitlist__label {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}

.waitlist__input {
  flex: 1 1 180px;
  height: 50px;
  padding: 0 18px;
  border: 1px solid rgba(255, 255, 255, 0.11);
  border-radius: var(--radius, 10px);
  background: rgba(255, 255, 255, 0.07);
  color: #dce8de;
  font: inherit;
  font-size: 14px;
  outline: none;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}

.waitlist__input::placeholder {
  color: rgba(176, 202, 184, 0.45);
  opacity: 1;
}

.waitlist__input:focus-visible {
  border-color: rgba(130, 165, 145, 0.5);
  box-shadow: 0 0 0 3px rgba(75, 96, 84, 0.18);
}

.waitlist__input--error {
  border-color: rgba(188, 120, 90, 0.55);
}

.waitlist__input--error:focus-visible {
  border-color: rgba(188, 120, 90, 0.55);
  box-shadow: 0 0 0 3px rgba(188, 120, 90, 0.12);
}

.waitlist__submit {
  flex: 0 0 auto;
  height: 50px;
  padding: 0 26px;
  border: 0;
  border-radius: var(--radius, 10px);
  background: var(--sage);
  color: var(--sage-on);
  font: inherit;
  font-weight: 500;
  font-size: 14px;
  letter-spacing: 0.015em;
  cursor: pointer;
  white-space: nowrap;
  transition:
    background 0.18s,
    opacity 0.18s;
}

.waitlist__submit:hover,
.waitlist__submit:focus-visible {
  background: var(--sage-dark);
}

.waitlist__submit:focus-visible {
  outline: 2px solid var(--sage-on);
  outline-offset: 2px;
}

.waitlist__submit:disabled {
  opacity: 0.7;
  cursor: wait;
  background: var(--sage-dark);
}

/* 浅色底变体（定价区旁等） */
.waitlist--light .waitlist__input {
  border-color: var(--border);
  background: rgba(25, 36, 32, 0.04);
  color: var(--ink);
}

.waitlist--light .waitlist__input::placeholder {
  color: var(--sage-muted);
}

.waitlist--light .waitlist__input:focus-visible {
  outline: none;
  border-color: rgba(130, 165, 145, 0.5);
  box-shadow: 0 0 0 3px rgba(75, 96, 84, 0.18);
}

.waitlist--light .waitlist__submit:focus-visible {
  outline-color: var(--sage);
}

.waitlist__hp {
  position: absolute;
  left: -9999px;
  width: 1px;
  height: 1px;
  overflow: hidden;
}

.waitlist__ok,
.waitlist__err,
.waitlist__note {
  margin: 0;
  line-height: 1.55;
}

.waitlist__ok {
  font-size: 15px;
  font-weight: 300;
  color: rgba(148, 188, 165, 0.82);
}

.waitlist--light .waitlist__ok {
  color: var(--sage);
}

.waitlist__err {
  margin-top: 8px;
  font-size: 12.5px;
  font-weight: 300;
  color: rgba(210, 155, 120, 0.82);
}

.waitlist--light .waitlist__err {
  color: rgba(160, 90, 60, 0.85);
}

.waitlist__note {
  margin-top: 12px;
  font-size: 11.5px;
  font-weight: 300;
  color: rgba(120, 152, 135, 0.52);
  line-height: 1.6;
}

.waitlist--light .waitlist__note {
  color: var(--sage-muted);
}

.waitlist__err + .waitlist__note {
  margin-top: 6px;
}

.waitlist__note a {
  color: rgba(120, 152, 135, 0.7);
  text-decoration: underline;
  text-decoration-color: rgba(120, 152, 135, 0.28);
  text-underline-offset: 2px;
}

.waitlist--light .waitlist__note a {
  color: var(--sage-muted);
  text-decoration-color: rgba(130, 155, 140, 0.3);
}

@media (max-width: 600px) {
  .waitlist__form {
    flex-direction: column;
  }

  .waitlist__input,
  .waitlist__submit {
    width: 100%;
    flex: none;
  }
}
</style>
