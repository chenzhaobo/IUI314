<script setup lang="ts">
/** 详情弹窗 · Monitor 日志索引 + 日志内容弹窗 */
import type { TraceLogLine, TraceLogRow } from '../types'
import { formatTime } from '@/hooks'
import { tagMeta } from '../../shared/types'
import { LOG_COLUMNS, logField, TRACE_LOG_STATUS } from '../types'

defineProps<{
  logs: TraceLogRow[]
  canRefetch: boolean
  refetching: boolean
  logLoading: boolean
  logLines: TraceLogLine[]
  logTitle: string
}>()

const emit = defineEmits<{
  (e: 'open', row: TraceLogRow): void
  (e: 'refetch'): void
}>()

const logVisible = defineModel<boolean>('logVisible', { required: true })
</script>

<template>
  <div class="trace-logs">
    <div class="trace-toolbar">
      <span class="muted">Monitor 侧日志 7 天过期，平台已落盘的可随时查看</span>
      <a-button v-if="canRefetch" size="mini" :loading="refetching" @click="emit('refetch')">
        重新抓取日志
      </a-button>
    </div>
    <a-table :data="logs" :pagination="false" row-key="id" size="small">
      <template #columns>
        <a-table-column title="traceId" data-index="trace_id" :width="220" ellipsis tooltip />
        <a-table-column title="状态" data-index="status" :width="90">
          <template #cell="{ record }">
            <a-tag :color="tagMeta(TRACE_LOG_STATUS, record.status).color" size="small">
              {{ tagMeta(TRACE_LOG_STATUS, record.status).label }}
            </a-tag>
          </template>
        </a-table-column>
        <a-table-column title="行数" data-index="line_count" :width="70" />
        <a-table-column title="抓取时间" data-index="fetched_at" :width="170">
          <template #cell="{ record }">
            {{ formatTime(record.fetched_at) }}
          </template>
        </a-table-column>
        <a-table-column title="错误" data-index="error" ellipsis tooltip />
        <a-table-column title="操作" :width="90">
          <template #cell="{ record }">
            <a-button size="mini" type="text" :disabled="record.status !== 'ok'" @click="emit('open', record)">
              查看日志
            </a-button>
          </template>
        </a-table-column>
      </template>
    </a-table>

    <a-modal v-model:visible="logVisible" :title="logTitle" :footer="false" width="90%">
      <a-table
        :data="logLines"
        :loading="logLoading"
        :pagination="{ pageSize: 100, showTotal: true }"
        size="small"
        :scroll="{ minWidth: 1100, y: 'calc(100vh - 320px)' }"
      >
        <template #columns>
          <a-table-column v-for="col in LOG_COLUMNS" :key="col.key" :title="col.title" :width="col.width">
            <template #cell="{ record }">
              <span class="log-cell">{{ logField(record, col.key) }}</span>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </a-modal>
  </div>
</template>

<style scoped>
.trace-toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.muted { color: var(--color-text-3); font-size: 12px; }
.log-cell { font-family: var(--font-family-mono, monospace); font-size: 12px; white-space: pre-wrap; word-break: break-all; }
</style>
