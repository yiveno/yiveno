<script setup lang="ts">
import { ref } from 'vue'

defineOptions({ name: 'PopupPage' })

const clue = ref('')

function handleRecallSubmit() {
  // v4 Recall 服务接入前仅占位
  if (!clue.value.trim()) return
}
</script>

<template>
  <main class="recall-shell">
    <header class="recall-header">
      <p class="recall-eyebrow">Yiveno</p>
      <h1 class="recall-title">找到它！</h1>
      <p class="recall-subtitle">在你存过的东西里找，不用再去网上搜。</p>
    </header>

    <form class="recall-form" @submit.prevent="handleRecallSubmit">
      <label class="recall-label" for="recall-clue">还记得的任意一点线索</label>
      <textarea
        id="recall-clue"
        v-model="clue"
        class="recall-input"
        rows="3"
        placeholder="例如：上周那篇讲留存的、某个产品的分析…"
      />
      <button class="recall-submit" type="submit" :disabled="!clue.trim()">开始找回</button>
    </form>

    <p class="recall-hint">Recall 引擎接入中，当前为 v4 基础设施预览。</p>
  </main>
</template>

<style scoped>
.recall-shell {
  width: 360px;
  padding: 20px;
  background: var(--recall-bg, #f8fafc);
  color: var(--recall-fg, #17202a);
}

.recall-header {
  margin-bottom: 16px;
}

.recall-eyebrow {
  margin: 0 0 4px;
  color: #64748b;
  font-size: 12px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.recall-title {
  margin: 0 0 8px;
  font-size: 24px;
  line-height: 1.2;
}

.recall-subtitle {
  margin: 0;
  color: #52606d;
  font-size: 14px;
  line-height: 1.5;
}

.recall-form {
  display: grid;
  gap: 10px;
}

.recall-label {
  font-size: 13px;
  font-weight: 600;
}

.recall-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  background: #fff;
  color: inherit;
  font: inherit;
  line-height: 1.5;
  resize: vertical;
}

.recall-input:focus {
  border-color: #0891b2;
  outline: 2px solid rgb(8 145 178 / 20%);
}

.recall-submit {
  padding: 10px 14px;
  border: none;
  border-radius: 10px;
  background: #0891b2;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.recall-submit:disabled {
  background: #94a3b8;
  cursor: not-allowed;
}

.recall-submit:not(:disabled):hover {
  background: #0e7490;
}

.recall-hint {
  margin: 14px 0 0;
  color: #64748b;
  font-size: 12px;
  line-height: 1.4;
}
</style>
