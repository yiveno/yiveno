<script setup lang="ts">
useHead({
  titleTemplate: titleChunk => {
    return titleChunk ? `${titleChunk} - otterSage` : 'otterSage'
  },
  htmlAttrs: {
    'data-theme': 'dark'
  },
  bodyAttrs: {
    class: 'bg-bg-default text-content'
  }
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
