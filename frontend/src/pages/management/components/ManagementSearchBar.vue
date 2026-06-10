<script setup lang="ts">
/**
 * 整理页顶部共用筛选栏：关键词 + 特征标签，同步裁剪左右书签树
 */
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useDebounceFn } from '@vueuse/core'
import { Input, LucideIcon, Loading } from '@/components'
import { useTraitFilterStore } from '@/stores'
import { useTraitDataStore } from '@/stores/trait-data-store'
import type { TraitTag } from '@/types/domain/trait'
import type { ManagementFilterRequestPayload } from '../composables/useManagementUnifiedSearch'
import { t } from '@/utils/i18n-helpers'

defineOptions({
  name: 'ManagementSearchBar'
})

const props = withDefaults(
  defineProps<{
    isFiltering?: boolean
    leftMatchCount?: number
    rightMatchCount?: number
    isLeftFiltered?: boolean
    isRightFiltered?: boolean
    disabled?: boolean
  }>(),
  {
    isFiltering: false,
    leftMatchCount: 0,
    rightMatchCount: 0,
    isLeftFiltered: false,
    isRightFiltered: false,
    disabled: false
  }
)

const emit = defineEmits<{
  filterRequest: [payload: ManagementFilterRequestPayload]
  clear: []
}>()

interface TraitQuickFilter {
  id: TraitTag
  labelKey: string
  icon: string
}

const TRAIT_QUICK_FILTERS: TraitQuickFilter[] = [
  { id: 'invalid', labelKey: 'management_trait_filter_invalid', icon: 'alert-circle' },
  { id: 'duplicate', labelKey: 'management_trait_filter_duplicate', icon: 'copy' }
]

const query = ref('')
const activeTraitFilters = ref<Set<TraitTag>>(new Set())
const traitFilterStore = useTraitFilterStore()
const { activeFilters: storeActiveFilters } = storeToRefs(traitFilterStore)
const traitDataStore = useTraitDataStore()

/** 将 store 筛选值规范为数组（storage 可能写入非数组） */
function normalizeStoreFilters(filters: unknown): TraitTag[] {
  if (!Array.isArray(filters)) return []
  return filters.filter((tag): tag is TraitTag => tag === 'invalid' || tag === 'duplicate')
}

const isBusy = computed(() => props.isFiltering)

const matchStatusText = computed(() => {
  if (!props.isLeftFiltered && !props.isRightFiltered) {
    return ''
  }

  const parts: string[] = []
  if (props.isLeftFiltered) {
    parts.push(t('management_search_left_matches', String(props.leftMatchCount)))
  }
  if (props.isRightFiltered) {
    parts.push(t('management_search_right_matches', String(props.rightMatchCount)))
  }
  return parts.join(' · ')
})

function getTraitCount(trait: TraitTag): number {
  return traitDataStore.getCount(trait)
}

function buildPayload(): ManagementFilterRequestPayload {
  return {
    query: query.value,
    activeFilterIds: Array.from(activeTraitFilters.value)
  }
}

function emitFilterRequest(): void {
  const payload = buildPayload()
  const hasQuery = payload.query.trim().length > 0
  const hasTraits = payload.activeFilterIds.length > 0

  if (!hasQuery && !hasTraits) {
    emit('clear')
    return
  }

  emit('filterRequest', payload)
}

const debouncedEmitFilterRequest = useDebounceFn(emitFilterRequest, 300)

function syncTraitFiltersToStore(): void {
  const tags = Array.from(activeTraitFilters.value)
  if (tags.length > 0) {
    traitFilterStore.setActiveFilters(tags)
    return
  }
  traitFilterStore.clearFilters()
}

function toggleTraitFilter(trait: TraitTag): void {
  if (activeTraitFilters.value.has(trait)) {
    activeTraitFilters.value.delete(trait)
  } else {
    activeTraitFilters.value.add(trait)
  }
  syncTraitFiltersToStore()
  void debouncedEmitFilterRequest()
}

function applyStoreFilters(storeFilters: unknown): void {
  activeTraitFilters.value = new Set(normalizeStoreFilters(storeFilters))
}

function handleClearQuery(): void {
  query.value = ''
  if (activeTraitFilters.value.size === 0) {
    emit('clear')
    return
  }
  void debouncedEmitFilterRequest()
}

function clearAll(): void {
  query.value = ''
  activeTraitFilters.value.clear()
  traitFilterStore.clearFilters()
  emit('clear')
}

function clearTraitFiltersOnly(): void {
  activeTraitFilters.value.clear()
  traitFilterStore.clearFilters()
  void debouncedEmitFilterRequest()
}

watch(query, () => {
  void debouncedEmitFilterRequest()
})

watch(storeActiveFilters, storeFilters => {
  const supported = normalizeStoreFilters(storeFilters)
  const current = Array.from(activeTraitFilters.value)
  const changed =
    supported.length !== current.length || supported.some(tag => !activeTraitFilters.value.has(tag))

  if (!changed) return

  applyStoreFilters(supported)
  void debouncedEmitFilterRequest()
})

onMounted(() => {
  if (!traitDataStore.isInitialized) {
    void traitDataStore.initialize()
  }

  const initialStoreFilters = normalizeStoreFilters(storeActiveFilters.value)
  if (initialStoreFilters.length > 0) {
    applyStoreFilters(initialStoreFilters)
    void debouncedEmitFilterRequest()
  }
})

defineExpose({
  clearAll,
  clearTraitFiltersOnly
})
</script>

<template>
  <section class="management-search-bar" aria-label="management unified search">
    <div class="management-search-bar__row">
      <Input
        v-model="query"
        class="management-search-bar__input"
        :placeholder="t('management_filter_bookmarks')"
        :disabled="disabled"
        variant="outlined"
        clearable
        leading-icon="search"
        :leading-icon-size="20"
        @clear="handleClearQuery"
      />
      <div v-if="isBusy" class="management-search-bar__loading" aria-live="polite">
        <Loading size="xs" />
        <span>{{ t('management_search_filtering') }}</span>
      </div>
      <p v-else-if="matchStatusText" class="management-search-bar__status">
        {{ matchStatusText }}
      </p>
    </div>

    <div class="management-search-bar__traits">
      <button
        v-for="traitFilter in TRAIT_QUICK_FILTERS"
        :key="traitFilter.id"
        type="button"
        class="management-search-bar__trait-chip"
        :class="{
          'management-search-bar__trait-chip--active': activeTraitFilters.has(traitFilter.id)
        }"
        :disabled="disabled"
        @click="toggleTraitFilter(traitFilter.id)"
      >
        <LucideIcon :name="traitFilter.icon" :size="14" />
        <span>{{ t(traitFilter.labelKey) }}</span>
        <span class="management-search-bar__trait-count">{{ getTraitCount(traitFilter.id) }}</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.management-search-bar {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  padding: var(--spacing-3) var(--spacing-4) 0;
}

.management-search-bar__row {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  min-width: 0;
}

.management-search-bar__input {
  flex: 1;
  min-width: 0;
}

.management-search-bar__loading,
.management-search-bar__status {
  flex-shrink: 0;
  margin: 0;
  font-size: var(--md-sys-typescale-body-small-size);
  white-space: nowrap;
  color: var(--md-sys-color-on-surface-variant);
}

.management-search-bar__loading {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-2);
}

.management-search-bar__traits {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-2);
}

.management-search-bar__trait-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-1);
  padding: var(--spacing-1) var(--spacing-3);
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: var(--md-sys-shape-corner-full);
  font-size: var(--md-sys-typescale-label-large-size);
  color: var(--md-sys-color-on-surface-variant);
  background: var(--md-sys-color-surface-container-low);
  cursor: pointer;
}

.management-search-bar__trait-chip:hover {
  background: var(--md-sys-color-surface-container-high);
}

.management-search-bar__trait-chip--active {
  border-color: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary-container);
  background: var(--md-sys-color-primary-container);
}

.management-search-bar__trait-count {
  min-width: 1.25rem;
  font-variant-numeric: tabular-nums;
  text-align: center;
  color: inherit;
  opacity: 0.85;
}
</style>
