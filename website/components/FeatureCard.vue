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
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  text-align: center;
  transition:
    transform 0.3s ease,
    box-shadow 0.3s ease;
}

.feature-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.feature-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.feature-card h3 {
  font-size: 1.5rem;
  margin-bottom: 1rem;
  color: #333;
}

.feature-card p {
  color: #666;
  line-height: 1.6;
}
</style>
