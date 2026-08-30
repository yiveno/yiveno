<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { getChromeFaviconUrl } from '@/infrastructure/browser/chrome-favicon'
import AppIcon from '@/infrastructure/ui/icons/AppIcon.vue'
import type { AppIconName } from '@/infrastructure/ui/icons/icon-paths'

defineOptions({ name: 'AppLibraryItemFavicon' })

const props = defineProps<{
  /** 源页 URL（Chrome `/_favicon/` 缓存） */
  pageUrl: string
  /** favicon 加载失败时的 Lucide 回退图标 */
  fallbackIcon: AppIconName
}>()

const faviconBroken = ref(false)

const faviconUrl = computed(() => getChromeFaviconUrl(props.pageUrl, 32))

watch(
  () => props.pageUrl,
  () => {
    faviconBroken.value = false
  }
)
</script>

<template>
  <img
    v-if="!faviconBroken"
    class="lib-item-favicon"
    :src="faviconUrl"
    alt=""
    width="16"
    height="16"
    loading="lazy"
    decoding="async"
    @error="faviconBroken = true"
  />
  <AppIcon v-else :name="props.fallbackIcon" size="20px" />
</template>
