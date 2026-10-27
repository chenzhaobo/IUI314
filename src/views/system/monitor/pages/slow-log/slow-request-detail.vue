<script setup lang="ts">
import type { TableColumnData } from '@arco-design/web-vue'
import type { slowRequestLog, slowSqlLog } from '@/types/system/slow-log'
import { computed } from 'vue'
import { parseTime } from '@/hooks'

defineOptions({ name: 'SlowRequestDetail' })
const props = defineProps<{
  detail?: slowRequestLog | null
  relatedSql?: slowSqlLog[] | null
  detailLoading?: boolean
  sqlLoading?: boolean
}>()
const visible = defineModel<boolean>('visible', { required: true })
const sqlColumns = computed<TableColumnData[]>(() => [
  { title: '时间', width: 170, render: ({ record }) => parseTime(record.created_at) },
  { title: '耗时', width: 90, align: 'right', render: ({ record }) => `${record.elapsed_ms} ms` },
  { title: 'SQL 摘要', dataIndex: 'sql_summary', ellipsis: true, tooltip: true },
])
</script>

<template>
  <a-drawer v-model:visible="visible" :width="880" :footer="false" unmount-on-close title="慢请求详情">
    <a-spin :loading="props.detailLoading" style="width: 100%">
      <a-descriptions v-if="props.detail" :column="1" bordered size="small">
        <a-descriptions-item label="时间">
          {{ parseTime(props.detail.created_at) }}
        </a-descriptions-item>
        <a-descriptions-item label="耗时">
          {{ props.detail.elapsed_ms }} ms
        </a-descriptions-item>
        <a-descriptions-item label="方法 / 状态">
          {{ props.detail.request_method }} / {{ props.detail.http_status }}
        </a-descriptions-item>
        <a-descriptions-item label="请求路径">
          {{ props.detail.request_path }}
        </a-descriptions-item>
        <a-descriptions-item label="归一化路径">
          {{ props.detail.normalized_path || '-' }}
        </a-descriptions-item>
        <a-descriptions-item label="Trace ID">
          <a-typography-text copyable>
            {{ props.detail.trace_id }}
          </a-typography-text>
        </a-descriptions-item>
        <a-descriptions-item label="用户">
          {{ props.detail.user_name || '-' }}
        </a-descriptions-item>
      </a-descriptions>
      <a-divider>关联慢 SQL</a-divider>
      <a-table
        :columns="sqlColumns"
        :data="props.relatedSql || []"
        :loading="props.sqlLoading"
        :pagination="false"
        row-key="slow_sql_id"
        :scroll="{ x: 700 }"
      />
    </a-spin>
  </a-drawer>
</template>
