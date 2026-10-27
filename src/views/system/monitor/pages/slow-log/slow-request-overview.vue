<script setup lang="ts">
import type { TableColumnData } from '@arco-design/web-vue'
import type { slowRequestOverview } from '@/types/system/slow-log'
import { computed } from 'vue'

defineOptions({ name: 'SlowRequestOverviewPanel' })
const props = defineProps<{ overview?: slowRequestOverview | null, loading?: boolean }>()
const columns = computed<TableColumnData[]>(() => [
  { title: '归一化路径', dataIndex: 'path', ellipsis: true, tooltip: true },
  { title: '次数', dataIndex: 'count', width: 90, align: 'right' },
  { title: '平均', width: 100, align: 'right', render: ({ record }) => `${Math.round(record.avg_elapsed_ms)} ms` },
  { title: '最大', width: 100, align: 'right', render: ({ record }) => `${record.max_elapsed_ms} ms` },
])
</script>

<template>
  <a-spin :loading="props.loading" style="width: 100%">
    <a-grid :cols="4" :col-gap="12" class="m-b-12px">
      <a-grid-item>
        <a-card size="small">
          <a-statistic title="24h 慢请求" :value="props.overview?.total_24h || 0" />
        </a-card>
      </a-grid-item>
      <a-grid-item>
        <a-card size="small">
          <a-statistic title="7d 慢请求" :value="props.overview?.total_7d || 0" />
        </a-card>
      </a-grid-item>
      <a-grid-item>
        <a-card size="small">
          <a-statistic title="24h 平均耗时" :value="Math.round(props.overview?.avg_elapsed_ms_24h || 0)" suffix="ms" />
        </a-card>
      </a-grid-item>
      <a-grid-item>
        <a-card size="small">
          <a-statistic title="24h 最大耗时" :value="props.overview?.max_elapsed_ms_24h || 0" suffix="ms" />
        </a-card>
      </a-grid-item>
    </a-grid>
    <a-collapse :bordered="false" class="m-b-12px">
      <a-collapse-item key="top" header="24 小时高频慢接口">
        <a-table :columns="columns" :data="props.overview?.top_paths || []" :pagination="false" row-key="path" size="small" />
      </a-collapse-item>
    </a-collapse>
  </a-spin>
</template>
