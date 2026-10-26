<script setup lang="ts">
import type { TableColumnData } from '@arco-design/web-vue'
import type { slowSqlLog } from '@/types/system/slow-log'
import { Tag } from '@arco-design/web-vue'
import { computed, h } from 'vue'
import { parseTime } from '@/hooks'

defineOptions({ name: 'SlowSqlTable' })
const props = defineProps<{ tableData: slowSqlLog[], loading?: boolean }>()
const emits = defineEmits(['view'])

const columns = computed<TableColumnData[]>(() => [
  { title: '时间', width: 180, render: ({ record }) => parseTime(record.created_at) },
  {
    title: '耗时',
    width: 110,
    align: 'right',
    render: ({ record }) => `${record.elapsed_ms} ms`,
  },
  {
    title: '来源',
    width: 100,
    align: 'center',
    render: ({ record }) => h(Tag, { color: record.source === 'http' ? 'arcoblue' : 'orange' }, () => record.source === 'http' ? 'HTTP' : '后台'),
  },
  { title: 'SQL 摘要', dataIndex: 'sql_summary', ellipsis: true, tooltip: true },
  { title: '请求路径', dataIndex: 'request_path', width: 230, ellipsis: true, tooltip: true },
  { title: 'Trace ID', dataIndex: 'trace_id', width: 220, ellipsis: true, tooltip: true },
  {
    title: '影响行',
    width: 110,
    align: 'right',
    render: ({ record }) => `${record.rows_affected} / ${record.rows_returned}`,
  },
  { title: '操作', slotName: 'operation', width: 80, fixed: 'right', align: 'center' },
])
</script>

<template>
  <a-table
    :columns="columns"
    :data="props.tableData"
    :loading="props.loading"
    :pagination="false"
    :scroll="{ x: 1400 }"
    row-key="slow_sql_id"
  >
    <template #operation="{ record }">
      <a-button type="text" size="small" @click="emits('view', record)">
        详情
      </a-button>
    </template>
  </a-table>
</template>
