<script setup lang="ts">
/** 详情弹窗 · 历史出现情况（轮次 × 同步源）。 */
import type { OccurrenceRow } from '../types'
import { computed } from 'vue'

const props = defineProps<{
  occurrences: OccurrenceRow[]
}>()

const rows = computed(() => props.occurrences.map(o => ({ ...o, row_key: `${o.round_id}:${o.source_id}` })))

function sampleText(row: OccurrenceRow): string {
  return (row.samples ?? []).map(s => s.trace_id).join('\n') || '-'
}
</script>

<template>
  <a-table :data="rows" :pagination="false" row-key="row_key" size="small" :scroll="{ minWidth: 720 }">
    <template #columns>
      <a-table-column title="轮次" data-index="round_no" :width="140" ellipsis tooltip />
      <a-table-column title="同步源" data-index="source_name" :width="170" ellipsis tooltip />
      <a-table-column title="原始条数" data-index="raw_count" :width="90" />
      <a-table-column title="最大实际值" data-index="max_act_value" :width="110" />
      <a-table-column title="样例 traceId">
        <template #cell="{ record }">
          <span class="mono pre-line">{{ sampleText(record) }}</span>
        </template>
      </a-table-column>
    </template>
  </a-table>
</template>

<style scoped>
.mono { font-family: var(--font-family-mono, monospace); font-size: 12px; }
.pre-line { white-space: pre-line; }
</style>
