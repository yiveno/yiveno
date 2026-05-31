<script setup lang="ts">
defineProps<{
  icon: string
  title: string
  description: string
}>()
</script>

<template>
  <div class="feature-card">
    <div class="feature-icon">{{ icon }}</div>
    <h3>{{ title }}</h3>
    <p>{{ description }}</p>
  </div>
</template>

<style scoped>
.feature-card {
  padding: 2rem;
  border-radius: 8px;
  text-align: center;
  background: white;
  transition:
    transform 0.3s ease,
    box-shadow 0.3s ease;
  box-shadow: 0 2px 8px rgb(0 0 0 / 10%);
}

.feature-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 16px rgb(0 0 0 / 15%);
}

.feature-icon {
  margin-bottom: 1rem;
  font-size: 3rem;
}

.feature-card h3 {
  margin-bottom: 1rem;
  font-size: 1.5rem;
  color: #333;
}

.feature-card p {
  line-height: 1.6;
  color: #666;
}
</style>
