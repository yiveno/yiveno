<script setup lang="ts">
const popupEntries = [
  {
    title: 'LLM Research Starter Kit',
    meta: 'Knowledge · Updated 2h ago',
    tag: 'AI 推荐',
    type: 'ai'
  },
  {
    title: 'Brand Guideline - 2025',
    meta: 'Design · Saved yesterday',
    tag: '固定',
    type: 'pin'
  },
  {
    title: 'Supabase Edge Functions',
    meta: 'Dev · Indexed just now',
    tag: '最新',
    type: 'fresh'
  }
]

const boardColumns = [
  { name: '阅读中', cards: [1, 2, 3] },
  { name: '归档', cards: [1, 2, 3, 4] },
  { name: '复习', cards: [1, 2] }
]

const aiSuggestions = [
  {
    title: '与当前页面相关：TypeScript Decorators',
    context: '根据你的阅读记录',
    action: '查看'
  },
  {
    title: '新增 3 条来自 Supabase 的文档',
    context: '自动抓取完成',
    action: '审阅'
  },
  {
    title: '推荐保存：Chrome Storage 性能优化',
    context: '来自研究合集',
    action: '收藏'
  }
]
</script>

<template>
  <div class="hero-showcase">
    <div class="window popup">
      <header>
        <span v-for="n in 3" :key="n" class="dot" />
        <p>Popup · 即时搜索</p>
      </header>
      <ul>
        <li v-for="entry in popupEntries" :key="entry.title">
          <div>
            <p class="title">{{ entry.title }}</p>
            <small>{{ entry.meta }}</small>
          </div>
          <span class="badge" :class="entry.type">{{ entry.tag }}</span>
        </li>
      </ul>
    </div>

    <div class="window board">
      <header>
        <p>Management · Kanban</p>
        <span>20,184 bookmarks</span>
      </header>
      <div class="columns">
        <div v-for="column in boardColumns" :key="column.name" class="column">
          <p class="column-name">{{ column.name }}</p>
          <article v-for="card in column.cards" :key="card" class="card" />
        </div>
      </div>
    </div>

    <div class="window panel">
      <header>
        <p>Side Panel · 推荐</p>
        <span>AI Suggestions</span>
      </header>
      <div class="panel-body">
        <article v-for="item in aiSuggestions" :key="item.title">
          <div>
            <p class="title">{{ item.title }}</p>
            <small>{{ item.context }}</small>
          </div>
          <span class="chip">{{ item.action }}</span>
        </article>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hero-showcase {
  position: relative;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
}

.window {
  border-radius: 24px;
  border: 1px solid rgb(148 163 184 / 18%);
  background: rgb(2 8 23 / 85%);
  box-shadow: 0 20px 60px rgb(2 8 23 / 50%);
  overflow: hidden;
  animation: float 10s ease-in-out infinite;
}

.window:nth-child(2) {
  animation-delay: 1.5s;
}

.window:nth-child(3) {
  animation-delay: 3s;
}

@keyframes float {
  0% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-8px);
  }

  100% {
    transform: translateY(0);
  }
}

.window header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  background: rgb(15 23 42 / 70%);
  font-size: 0.9rem;
  border-bottom: 1px solid rgb(148 163 184 / 10%);
}

.popup ul {
  list-style: none;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.popup li {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.9rem 1rem;
  border-radius: 18px;
  background: rgb(15 23 42 / 80%);
  border: 1px solid rgb(148 163 184 / 15%);
}

.title {
  font-weight: 600;
}

small {
  color: var(--text-muted);
}

.badge {
  border-radius: 999px;
  padding: 0.2rem 0.9rem;
  font-size: 0.8rem;
  font-weight: 600;
}

.badge.ai {
  background: rgb(56 189 248 / 20%);
  color: #38bdf8;
}

.badge.pin {
  border: 1px solid rgb(148 163 184 / 30%);
}

.badge.fresh {
  background: rgb(124 58 237 / 20%);
  color: #c084fc;
}

.board {
  padding-bottom: 1.25rem;
}

.columns {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
  padding: 1rem 1.25rem;
}

.column {
  background: rgb(2 8 23 / 40%);
  border-radius: 18px;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  border: 1px solid rgb(148 163 184 / 10%);
}

.column-name {
  font-size: 0.9rem;
  color: var(--text-muted);
}

.card {
  border-radius: 14px;
  height: 46px;
  background: linear-gradient(120deg, rgb(56 189 248 / 15%), rgb(99 102 241 / 10%));
  border: 1px solid rgb(56 189 248 / 25%);
}

.panel {
  padding-bottom: 1rem;
}

.panel-body {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  padding: 1rem;
}

.panel article {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 0.9rem 1rem;
  border-radius: 16px;
  border: 1px solid rgb(148 163 184 / 18%);
}

.chip {
  border-radius: 999px;
  border: 1px solid rgb(148 163 184 / 30%);
  padding: 0.25rem 0.9rem;
  font-size: 0.8rem;
}

header .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgb(148 163 184 / 50%);
  display: inline-flex;
  margin-right: 0.35rem;
}

@media (width <= 640px) {
  .window header {
    flex-direction: column;
    gap: 0.5rem;
  }

  .columns {
    grid-template-columns: 1fr;
  }
}
</style>
