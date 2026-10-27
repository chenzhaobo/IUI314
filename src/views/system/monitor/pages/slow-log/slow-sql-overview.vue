<script setup lang="ts">
import type { TableColumnData } from '@arco-design/web-vue'
import type { slowSqlOverview } from '@/types/system/slow-log'
import { computed } from 'vue'
import { parseTime } from '@/hooks'

defineOptions({ name: 'SlowSqlOverviewPanel' })
const props = defineProps<{ overview?: slowSqlOverview | null, loading?: boolean }>()
const columns = computed<TableColumnData[]>(() => [
  { title: 'SQL 摘要', dataIndex: 'sql_summary', ellipsis: true, tooltip: true },
  { title: '次数', dataIndex: 'count', width: 90, align: 'right' },
  { title: '平均', width: 100, align: 'right', render: ({ record }) => `${Math.round(record.avg_elapsed_ms)} ms` },
  { title: '最大', width: 100, align: 'right', render: ({ record }) => `${record.max_elapsed_ms} ms` },
  { title: '最近', width: 170, render: ({ record }) => parseTime(record.last_seen) },
])
</script>

<template>
  <a-spin :loading="props.loading" style="width: 100%">
    <a-grid :cols="4" :col-gap="12" class="m-b-12px">
      <a-grid-item>
        <a-card size="small">
          <a-statistic title="24h 慢 SQL" :value="props.overview?.total_24h || 0" />
        </a-card>
      </a-grid-item>
      <a-grid-item>
        <a-card size="small">
          <a-statistic title="24h 不同 SQL" :value="props.overview?.distinct_sql_24h || 0" />
        </a-card>
      </a-grid-item>
      <a-grid-item>
        <a-card size="small">
          <a-statistic title="24h 平均耗时" :value="Math.round(props.overview?.avg_elapsed_ms_24h || 0)" suffix="ms" />
        </a-card>
      </a-grid-item>
      <a-grid-item>
        <a-card size="small">
          <a-statistic title="7d 慢 SQL" :value="props.overview?.total_7d || 0" />
        </a-card>
      </a-grid-item>
    </a-grid>
    <a-collapse :bordered="false" class="m-b-12px">
      <a-collapse-item key="top" header="24 小时高频慢 SQL">
        <a-table :columns="columns" :data="props.overview?.top_sql || []" :pagination="false" row-key="sql_hash" size="small" />
      </a-collapse-item>
    </a-collapse>
  </a-spin>
</template>
