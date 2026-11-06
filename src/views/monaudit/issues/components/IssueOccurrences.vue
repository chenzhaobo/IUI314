<script setup lang="ts">
/** 详情弹窗 · 出现情况（轮次 × 同步源）与最近的原始记录 */
import type { OccurrenceRow, RawSampleRow } from '../types'
import { computed } from 'vue'
import { formatTime } from '@/hooks'

const props = defineProps<{
  occurrences: OccurrenceRow[]
  rawSamples: RawSampleRow[]
}>()

/** 同一轮次可能有多个同步源：行键用 轮次 + 同步源 */
const rows = computed(() => props.occurrences.map(o => ({ ...o, row_key: `${o.round_id}:${o.source_id}` })))

function sampleText(row: OccurrenceRow): string {
  return (row.samples ?? []).map(s => s.trace_id).join('\n') || '-'
}
</script>

<template>
  <div class="occ-panel">
    <a-table :data="rows" :pagination="false" row-key="row_key" size="small" :scroll="{ minWidth: 720 }">
      <template #columns>
        <a-table-column title="轮次" data-index="round_no" :width="120" ellipsis tooltip />
        <a-table-column title="同步源" data-index="source_name" :width="150" ellipsis tooltip />
        <a-table-column title="原始条数" data-index="raw_count" :width="90" />
        <a-table-column title="最大实际值" data-index="max_act_value" :width="110" />
        <a-table-column title="样例 traceId">
          <template #cell="{ record }">
            <span class="mono pre-line">{{ sampleText(record) }}</span>
          </template>
        </a-table-column>
      </template>
    </a-table>

    <div class="section-title">
      最近原始记录
    </div>
    <a-empty v-if="!rawSamples.length" description="暂无原始记录" />
    <a-collapse v-else :bordered="false">
      <a-collapse-item v-for="raw in rawSamples" :key="raw.id">
        <template #header>
          <span class="raw-head">
            {{ raw.source_name }} · {{ raw.src_number || raw.id }} · 实际值 {{ raw.act_value ?? '-' }} / 阈值 {{ raw.threshold ?? '-' }}
            · {{ formatTime(raw.src_created_at) }}
          </span>
        </template>
        <div class="raw-meta mono">
          traceId：{{ raw.trace_id || '-' }}
        </div>
        <div v-if="raw.invoke_param" class="raw-meta">
          <div class="raw-label">
            调用参数
          </div>
          <pre class="raw-pre">{{ raw.invoke_param }}</pre>
        </div>
        <div class="raw-label">
          审计日志
        </div>
        <pre class="raw-pre">{{ raw.audit_log || '-' }}</pre>
      </a-collapse-item>
    </a-collapse>
  </div>
</template>

<style scoped>
.mono { font-family: var(--font-family-mono, monospace); font-size: 12px; }
.pre-line { white-space: pre-line; }
.section-title { margin: 14px 0 6px; font-weight: 600; }
.raw-head { font-size: 13px; }
.raw-meta { margin-bottom: 6px; }
.raw-label { margin: 4px 0; color: var(--color-text-3); font-size: 12px; }
.raw-pre {
  max-height: 50vh;
  margin: 0;
  padding: 8px;
  overflow: auto;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
  background: var(--color-fill-2);
  border-radius: 4px;
}
</style>
