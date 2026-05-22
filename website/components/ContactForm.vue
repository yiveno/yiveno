<script setup lang="ts">
const { loading, error, successMessage, submitContact } = useContactForm()

const form = reactive({
  name: '',
  email: '',
  message: '',
  website: ''
})

const reset = () => {
  form.name = ''
  form.email = ''
  form.message = ''
  form.website = ''
}

const handleSubmit = async () => {
  try {
    await submitContact(form)
    reset()
  } catch (_err) {
    // 错误在 composable 中已处理
  }
}
</script>

<template>
  <form class="contact-form" @submit.prevent="handleSubmit">
    <div class="field">
      <label for="name">姓名 *</label>
      <input id="name" v-model="form.name" required type="text" placeholder="请输入您的姓名" />
    </div>
    <div class="field">
      <label for="email">邮箱 *</label>
      <input id="email" v-model="form.email" required type="email" placeholder="your@email.com" />
    </div>
    <div class="field">
      <label for="message">消息 *</label>
      <textarea
        id="message"
        v-model="form.message"
        required
        rows="5"
        placeholder="告诉我们需求、场景或问题…"
      />
    </div>

    <input
      v-model="form.website"
      type="text"
      name="website"
      autocomplete="off"
      tabindex="-1"
      class="honeypot"
      aria-hidden="true"
    />

    <button class="btn" type="submit" :disabled="loading">
      {{ loading ? '提交中…' : '提交' }}
    </button>

    <transition name="fade">
      <p v-if="successMessage" class="message success">
        {{ successMessage }}
      </p>
    </transition>
    <transition name="fade">
      <p v-if="error" class="message error">
        {{ error }}
      </p>
    </transition>
  </form>
</template>

<style scoped>
.contact-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

label {
  font-size: 0.9rem;
  letter-spacing: 0.05em;
  color: var(--text-muted);
}

input,
textarea {
  border-radius: 14px;
  border: 1px solid rgb(148 163 184 / 30%);
  background: rgb(15 23 42 / 60%);
  padding: 0.85rem 1rem;
  color: var(--text-primary);
  font-size: 0.95rem;
  font-family: inherit;
  transition:
    border 0.2s ease,
    box-shadow 0.2s ease;
}

input:focus,
textarea:focus {
  border-color: rgb(56 189 248 / 60%);
  box-shadow: 0 0 0 3px rgb(56 189 248 / 15%);
  outline: none;
}

.btn {
  border-radius: 999px;
  background: linear-gradient(120deg, #38bdf8, #7c3aed);
  color: #050f1f;
  border: none;
  padding: 0.85rem 1.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn:not(:disabled):hover {
  transform: translateY(-2px);
}

.message {
  font-size: 0.9rem;
}

.message.success {
  color: #6ee7b7;
}

.message.error {
  color: #fca5a5;
}

.honeypot {
  position: absolute;
  left: -9999px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
