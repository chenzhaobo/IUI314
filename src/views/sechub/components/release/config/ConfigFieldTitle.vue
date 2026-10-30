<script setup lang="ts">
/**
 * 明细表列头：文案与悬停说明都来自 `GET /config-check/fields`，前端不另写说明。
 *
 * 接口失败（defs 为空）时退回 fallback 列名，不阻塞表格。
 */
import type { ConfigFieldDef } from '@/types/sechub-release'
import { computed } from 'vue'

const props = defineProps<{
  defs: Record<string, ConfigFieldDef>
  field: string
  fallback: string
}>()

const def = computed(() => props.defs[props.field])
const label = computed(() => def.value?.label || props.fallback)
const tip = computed(() => def.value?.description || '')
</script>

<template>
  <a-tooltip v-if="tip" :content="tip" position="top">
    <span class="field-title">{{ label }}</span>
  </a-tooltip>
  <span v-else>{{ label }}</span>
</template>

<style scoped>
.field-title {
  border-bottom: 1px dashed var(--color-text-4);
  cursor: help;
}
</style>
