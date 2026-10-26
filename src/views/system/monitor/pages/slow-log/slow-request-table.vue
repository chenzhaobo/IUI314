<script setup lang="ts">
import type { TableColumnData } from '@arco-design/web-vue'
import type { slowRequestLog } from '@/types/system/slow-log'
import { computed } from 'vue'
import { parseTime } from '@/hooks'

defineOptions({ name: 'SlowRequestTable' })
const props = defineProps<{ tableData: slowRequestLog[], loading?: boolean }>()
const columns = computed<TableColumnData[]>(() => [
  { title: '时间', width: 180, render: ({ record }) => parseTime(record.created_at) },
  { title: 'Trace ID', dataIndex: 'trace_id', width: 240, ellipsis: true, tooltip: true },
  { title: '方法', dataIndex: 'request_method', width: 90, align: 'center' },
  { title: '路径', dataIndex: 'request_path', ellipsis: true, tooltip: true },
  { title: '状态码', dataIndex: 'http_status', width: 100, align: 'center' },
  {
    title: '耗时',
    width: 110,
    align: 'right',
    render: ({ record }) => `${record.elapsed_ms} ms`,
  },
  { title: '用户', dataIndex: 'user_name', width: 130, ellipsis: true, tooltip: true },
])
</script>

<template>
  <a-table
    :columns="columns"
    :data="props.tableData"
    :loading="props.loading"
    :pagination="false"
    :scroll="{ x: 1150 }"
    row-key="request_id"
  />
</template>
