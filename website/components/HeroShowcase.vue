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
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.window {
  border: 1px solid rgb(148 163 184 / 18%);
  border-radius: 24px;
  background: rgb(2 8 23 / 85%);
  animation: float 10s ease-in-out infinite;
  overflow: hidden;
  box-shadow: 0 20px 60px rgb(2 8 23 / 50%);
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
  border-bottom: 1px solid rgb(148 163 184 / 10%);
  font-size: 0.9rem;
  background: rgb(15 23 42 / 70%);
}

.popup ul {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  padding: 1rem;
  list-style: none;
}

.popup li {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.9rem 1rem;
  border: 1px solid rgb(148 163 184 / 15%);
  border-radius: 18px;
  background: rgb(15 23 42 / 80%);
}

.title {
  font-weight: 600;
}

small {
  color: var(--text-muted);
}

.badge {
  padding: 0.2rem 0.9rem;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 600;
}

.badge.ai {
  color: #38bdf8;
  background: rgb(56 189 248 / 20%);
}

.badge.pin {
  border: 1px solid rgb(148 163 184 / 30%);
}

.badge.fresh {
  color: #c084fc;
  background: rgb(124 58 237 / 20%);
}

.board {
  padding-bottom: 1.25rem;
}

.columns {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  padding: 1rem 1.25rem;
}

.column {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.75rem;
  border: 1px solid rgb(148 163 184 / 10%);
  border-radius: 18px;
  background: rgb(2 8 23 / 40%);
}

.column-name {
  font-size: 0.9rem;
  color: var(--text-muted);
}

.card {
  height: 46px;
  border: 1px solid rgb(56 189 248 / 25%);
  border-radius: 14px;
  background: linear-gradient(120deg, rgb(56 189 248 / 15%), rgb(99 102 241 / 10%));
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
  border: 1px solid rgb(148 163 184 / 18%);
  border-radius: 16px;
}

.chip {
  padding: 0.25rem 0.9rem;
  border: 1px solid rgb(148 163 184 / 30%);
  border-radius: 999px;
  font-size: 0.8rem;
}

header .dot {
  display: inline-flex;
  width: 8px;
  height: 8px;
  margin-right: 0.35rem;
  border-radius: 50%;
  background: rgb(148 163 184 / 50%);
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
