<script setup lang="ts">
const { loading, error, success, submitSubscription } = useSubscriptionForm()

const form = reactive({
  email: '',
  source: 'landing-page',
  channel: 'newsletter'
})

const handleSubmit = async () => {
  try {
    await submitSubscription(form)
    // 表单重置是串行执行的，ESLint 在 reactive 对象上会误报 require-atomic-updates
    // eslint-disable-next-line require-atomic-updates
    form.email = ''
  } catch (_err) {
    // handled already
  }
}
</script>

<template>
  <form class="subscription" @submit.prevent="handleSubmit">
    <div class="inputs">
      <input v-model="form.email" type="email" required placeholder="输入邮箱，获取产品更新" />
      <button type="submit" :disabled="loading">
        {{ loading ? '发送中…' : '订阅' }}
      </button>
    </div>
    <transition name="fade">
      <p v-if="success" class="toast success">订阅成功，我们会在每次更新时通知你。</p>
    </transition>
    <transition name="fade">
      <p v-if="error" class="toast error">{{ error }}</p>
    </transition>
  </form>
</template>

<style scoped>
.subscription {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.inputs {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

input {
  flex: 1;
  border-radius: 999px;
  border: 1px solid rgb(148 163 184 / 35%);
  background: rgb(3 6 17 / 75%);
  padding: 0.85rem 1.2rem;
  color: var(--text-primary);
  min-width: 220px;
}

input:focus {
  outline: none;
  border-color: rgb(56 189 248 / 60%);
  box-shadow: 0 0 0 3px rgb(56 189 248 / 15%);
}

button {
  border-radius: 999px;
  border: none;
  padding: 0.85rem 1.75rem;
  background: linear-gradient(120deg, #38bdf8, #7c3aed);
  color: #050f1f;
  font-weight: 600;
  cursor: pointer;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.toast {
  font-size: 0.9rem;
}

.success {
  color: #6ee7b7;
}

.error {
  color: #fca5a5;
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
