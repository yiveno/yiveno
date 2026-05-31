<script setup lang="ts">
const features = [
  {
    icon: '⚡',
    tag: 'Search',
    title: '多索引极速检索',
    description: 'Fuse.js、标签、备注、语义向量并行搜索，毫秒级返回。',
    preview: 'list'
  },
  {
    icon: '🤖',
    tag: 'AI',
    title: '可解释的智能推荐',
    description: 'AI 卡片展示推荐原因和引用来源，可一键采纳。',
    preview: 'grid'
  },
  {
    icon: '📊',
    tag: 'Analytics',
    title: '使用统计与健康监控',
    description: '实时了解失效检测状态、同步进度与收藏趋势。',
    preview: 'chart'
  }
]

const chartValues = [30, 70, 45, 90, 55]
</script>

<template>
  <div class="feature-gallery">
    <article v-for="feature in features" :key="feature.title">
      <div class="head">
        <span class="icon">{{ feature.icon }}</span>
        <div>
          <p class="tag">{{ feature.tag }}</p>
          <h3>{{ feature.title }}</h3>
        </div>
      </div>
      <p>{{ feature.description }}</p>
      <div class="preview" :class="feature.preview">
        <template v-if="feature.preview === 'list'">
          <div v-for="n in 4" :key="n" class="row">
            <div class="bar long" />
            <div class="bar short" />
          </div>
        </template>
        <template v-else-if="feature.preview === 'chart'">
          <div class="bars">
            <span v-for="(val, idx) in chartValues" :key="idx" :style="{ height: val + '%' }" />
          </div>
        </template>
        <template v-else>
          <div class="grid">
            <span v-for="n in 6" :key="n" />
          </div>
        </template>
      </div>
    </article>
  </div>
</template>

<style scoped>
.feature-gallery {
  display: grid;
  gap: 1.5rem;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
}

article {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.75rem;
  border: 1px solid rgb(148 163 184 / 15%);
  border-radius: var(--radius-sm);
  background: rgb(15 23 42 / 65%);
}

.head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.icon {
  font-size: 1.8rem;
}

.tag {
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  color: rgb(56 189 248 / 70%);
}

.preview {
  min-height: 150px;
  padding: 1rem;
  border: 1px solid rgb(148 163 184 / 12%);
  border-radius: 18px;
  background: rgb(2 8 23 / 70%);
}

.preview.list .row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.45rem;
}

.bar {
  height: 12px;
  border-radius: 999px;
  background: linear-gradient(120deg, rgb(56 189 248 / 20%), rgb(124 58 237 / 20%));
}

.bar.long {
  flex: 1;
}

.bar.short {
  width: 20%;
}

.preview.chart .bars {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
  height: 120px;
}

.preview.chart span {
  flex: 1;
  border-radius: 8px 8px 4px 4px;
  background: linear-gradient(180deg, rgb(56 189 248 / 90%), rgb(56 189 248 / 10%));
  animation: pulse 4s ease-in-out infinite;
}

.preview.grid .grid {
  display: grid;
  gap: 0.5rem;
  grid-template-columns: repeat(3, 1fr);
}

.preview.grid span {
  height: 36px;
  border-radius: 8px;
  background: rgb(124 58 237 / 30%);
}

@keyframes pulse {
  0% {
    opacity: 0.6;
  }

  50% {
    opacity: 1;
  }

  100% {
    opacity: 0.6;
  }
}
</style>
