<script setup lang="ts">
import { ref } from 'vue'

defineOptions({ name: 'WaitlistForm' })

const apiBase = (import.meta.env.PUBLIC_API_BASE_URL || 'https://api.yiveno.com').replace(/\/$/, '')

const email = ref('')
const company = ref('')
const status = ref<'idle' | 'submitting' | 'success' | 'error'>('idle')
const errorMessage = ref('')

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254
}

async function onSubmit(event: Event): Promise<void> {
  event.preventDefault()
  errorMessage.value = ''
  const trimmed = email.value.trim()

  if (!isValidEmail(trimmed)) {
    status.value = 'error'
    errorMessage.value = 'Enter a valid email.'
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
      errorMessage.value = 'Could not reach Yiveno. Try again.'
      return
    }

    status.value = 'success'
  } catch {
    status.value = 'error'
    errorMessage.value = 'Could not reach Yiveno. Try again.'
  }
}
</script>

<template>
  <form class="waitlist" novalidate @submit="onSubmit">
    <p v-if="status === 'success'" class="waitlist__ok" role="status">
      You’re on the list. We’ll email you when there’s a spot.
    </p>
    <div v-else class="waitlist__row">
      <label class="waitlist__label" for="waitlist-email">Email</label>
      <input
        id="waitlist-email"
        v-model="email"
        class="waitlist__input"
        type="email"
        name="email"
        autocomplete="email"
        inputmode="email"
        placeholder="you@example.com"
        :disabled="status === 'submitting'"
        required
      />
      <div class="waitlist__hp" aria-hidden="true">
        <label for="waitlist-company">Company</label>
        <input
          id="waitlist-company"
          v-model="company"
          type="text"
          name="company"
          tabindex="-1"
          autocomplete="off"
        />
      </div>
      <button class="waitlist__submit" type="submit" :disabled="status === 'submitting'">
        {{ status === 'submitting' ? 'Saving…' : 'Notify me' }}
      </button>
    </div>
    <p v-if="status === 'error'" class="waitlist__err" role="alert">{{ errorMessage }}</p>
    <p class="waitlist__note">
      We’ll only write when Yiveno is ready to install.
      <a href="/privacy">Privacy</a>
    </p>
  </form>
</template>

<style scoped>
.waitlist {
  width: 100%;
  max-width: 32rem;
}

.waitlist__row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  align-items: stretch;
}

.waitlist__label {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}

.waitlist__input {
  flex: 1 1 12rem;
  min-height: 2.85rem;
  padding: 0.7rem 0.9rem;
  border: 1px solid color-mix(in oklch, currentcolor 28%, transparent);
  border-radius: var(--radius, 10px);
  background: color-mix(in oklch, white 12%, transparent);
  color: inherit;
  font: inherit;
  font-size: 1rem;
}

.waitlist__input::placeholder {
  color: var(--hero-muted, oklch(82% 0.02 155deg));
  opacity: 1;
}

.waitlist__input:focus-visible {
  outline: 2px solid var(--sage-on, #f4f7f5);
  outline-offset: 2px;
}

.waitlist__submit {
  flex: 0 0 auto;
  min-height: 2.85rem;
  padding: 0.7rem 1.15rem;
  border: 0;
  border-radius: var(--radius, 10px);
  background: var(--sage-on, #f4f7f5);
  color: var(--ink, #1c2a24);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.waitlist__submit:hover,
.waitlist__submit:focus-visible {
  background: color-mix(in oklch, var(--sage-on, #f4f7f5) 88%, white);
}

.waitlist__submit:focus-visible {
  outline: 2px solid var(--sage-on, #f4f7f5);
  outline-offset: 2px;
}

.waitlist__submit:disabled {
  opacity: 0.7;
  cursor: wait;
}

body:not([data-chrome='home']) .waitlist__input::placeholder {
  color: var(--muted);
}

body:not([data-chrome='home']) .waitlist__submit {
  background: var(--sage);
  color: var(--sage-on);
}

body:not([data-chrome='home']) .waitlist__input:focus-visible,
body:not([data-chrome='home']) .waitlist__submit:focus-visible {
  outline-color: var(--sage);
}

body:not([data-chrome='home']) .waitlist__submit:hover,
body:not([data-chrome='home']) .waitlist__submit:focus-visible {
  background: var(--sage-hover);
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
  margin: 0.7rem 0 0;
  font-size: 0.9rem;
  line-height: 1.45;
}

.waitlist__ok {
  color: inherit;
}

.waitlist__err {
  color: color-mix(in oklch, #c45c4a 70%, white);
}

body:not([data-chrome='home']) .waitlist__err {
  color: var(--danger);
}

.waitlist__note {
  color: color-mix(in oklch, currentcolor 72%, transparent);
}

.waitlist__note a {
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 0.15em;
}
</style>
