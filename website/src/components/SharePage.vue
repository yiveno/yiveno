<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getShareDetail, type ShareDetail } from '../services/share'

const share = ref<ShareDetail | null>(null)
const error = ref('')
const loading = ref(true)
const selectedIdx = ref<Set<number>>(new Set())
const importing = ref(false)
const importResult = ref<string | null>(null)

const allSelected = computed(
  () => share.value?.bookmarks.every((_, i) => selectedIdx.value.has(i)) ?? false
)
const selectedCount = computed(() => selectedIdx.value.size)

onMounted(async () => {
  const params = new URLSearchParams(window.location.search)
  const shortCode = params.get('code') || window.location.pathname.replace(/^\/share\//, '')
  if (!shortCode) {
    error.value = '无效的链接'
    loading.value = false
    return
  }
  const data = await getShareDetail(shortCode)
  if (data) share.value = data
  else error.value = '分享链接不存在或已失效'
  loading.value = false
})

function toggleAll() {
  if (!share.value) return
  selectedIdx.value = allSelected.value
    ? new Set()
    : new Set(share.value.bookmarks.map((_, i) => i))
}

function toggle(idx: number) {
  const next = new Set(selectedIdx.value)
  if (next.has(idx)) next.delete(idx)
  else next.add(idx)
  selectedIdx.value = next
}

async function importSelected() {
  if (!share.value) return
  const toImport = share.value.bookmarks.filter((_, i) => selectedIdx.value.has(i))
  if (toImport.length === 0) return
  importing.value = true
  importResult.value = null
  toImport.forEach(bm => window.open(bm.url, '_blank'))
  importResult.value = `已打开 ${toImport.length} 个书签`
  importing.value = false
}

function favicon(url: string) {
  try {
    return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=16`
  } catch {
    return ''
  }
}
</script>

<template>
  <div class="share-page">
    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <template v-else-if="share">
      <div class="header">
        <h1>{{ share.title }}</h1>
        <p class="meta">
          {{ share.bookmark_count }} 个书签 ·
          {{ new Date(share.created_at).toLocaleDateString('zh-CN') }}
        </p>
        <p v-if="share.description" class="desc">{{ share.description }}</p>
      </div>
      <div class="toolbar">
        <label class="select-all">
          <input type="checkbox" :checked="allSelected" @change="toggleAll" /> 全选
        </label>
        <span class="count">已选 {{ selectedCount }} / {{ share.bookmarks.length }}</span>
        <button
          class="btn-import"
          :disabled="selectedCount === 0 || importing"
          @click="importSelected"
        >
          {{ importing ? '导入中...' : `一键导入 (${selectedCount})` }}
        </button>
      </div>
      <div
        v-if="importResult"
        :class="['result', { 'result-warn': !importResult.includes('完成') }]"
      >
        {{ importResult }}
      </div>
      <ul class="bookmark-list">
        <li
          v-for="(bm, i) in share.bookmarks"
          :key="i"
          class="bookmark-item"
          :class="{ selected: selectedIdx.has(i) }"
          @click="toggle(i)"
        >
          <input type="checkbox" :checked="selectedIdx.has(i)" @click.stop="toggle(i)" />
          <img v-if="favicon(bm.url)" :src="favicon(bm.url)" class="favicon" alt="" />
          <div class="info">
            <a :href="bm.url" target="_blank" class="title" @click.stop>{{ bm.title }}</a>
            <span class="url" :title="bm.url">{{ bm.url }}</span>
            <p v-if="bm.description" class="desc">{{ bm.description }}</p>
          </div>
        </li>
      </ul>
    </template>
  </div>
</template>

<style scoped>
.share-page {
  max-width: 720px;
  margin: 0 auto;
  padding: 2rem 1rem 4rem;
}
.loading,
.error {
  text-align: center;
  padding: 4rem;
  color: #999;
}
.error {
  color: #e53e3e;
}
.header {
  margin-bottom: 1.5rem;
}
.header h1 {
  margin: 0 0 0.25rem;
  font-size: 1.5rem;
}
.meta {
  color: #888;
  font-size: 0.875rem;
  margin: 0 0 0.5rem;
}
.desc {
  color: #666;
  font-size: 0.9rem;
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 1rem;
  position: sticky;
  top: 0;
  z-index: 10;
}
.select-all {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  cursor: pointer;
  font-size: 0.9rem;
}
.count {
  flex: 1;
  font-size: 0.85rem;
  color: #888;
}
.btn-import {
  padding: 0.5rem 1.25rem;
  border: none;
  border-radius: 6px;
  background: #1a73e8;
  color: #fff;
  font-size: 0.9rem;
  cursor: pointer;
}
.btn-import:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.result {
  padding: 0.75rem 1rem;
  border-radius: 6px;
  margin-bottom: 1rem;
  background: #e8f5e9;
  color: #2e7d32;
  font-size: 0.9rem;
}
.result-warn {
  background: #fff3e0;
  color: #e65100;
}
.bookmark-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.bookmark-item {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  border: 1px solid transparent;
  margin-bottom: 4px;
  transition: all 0.15s;
}
.bookmark-item:hover {
  background: #f5f5f5;
}
.bookmark-item.selected {
  background: #e8f0fe;
  border-color: #1a73e8;
}
.bookmark-item input[type='checkbox'] {
  margin-top: 2px;
}
.favicon {
  width: 16px;
  height: 16px;
  margin-top: 3px;
  flex-shrink: 0;
}
.info {
  flex: 1;
  min-width: 0;
}
.title {
  color: #1a73e8;
  text-decoration: none;
  font-weight: 500;
  font-size: 0.95rem;
  display: block;
}
.title:hover {
  text-decoration: underline;
}
.url {
  color: #888;
  font-size: 0.8rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
}
.desc {
  color: #666;
  font-size: 0.85rem;
  margin: 2px 0 0;
}
</style>
