<script setup lang="ts">
/**
 * 「按接口」结果表格（API 测试结果页的主表）。
 *
 * 展示型组件：分页 / 筛选由页面持有，这里只负责列渲染与「详情」事件。
 * 列定义放在 script 里，避免模板里堆十几个列插槽。
 */
import type { TableColumnData } from '@arco-design/web-vue'
import type { ApiResultRow } from '@/types/sechub-test-results'

import { formatTime } from '@/hooks'
import { testStatusMeta, verdictColor } from '../composables/testResultsRules'

export interface ResultTablePagination {
  current: number
  pageSize: number
  total: number
  showTotal: boolean
  showPageSize: boolean
}

defineProps<{
  rows: ApiResultRow[]
  loading: boolean
  pagination: ResultTablePagination
  tableHeight?: number
}>()

const emit = defineEmits<{
  detail: [row: ApiResultRow]
  pageChange: [page: number]
  pageSizeChange: [size: number]
}>()

const columns: TableColumnData[] = [
  { title: '接口', slotName: 'api', minWidth: 280 },
  { title: '应用', slotName: 'app', width: 170 },
  { title: '项目组', slotName: 'projectGroup', width: 140 },
  { title: '测试状态', slotName: 'status', width: 100 },
  { title: '各测试类型判定', slotName: 'byType', minWidth: 280 },
  { title: '用例数', slotName: 'cases', width: 140 },
  { title: '最近测试时间', slotName: 'testedAt', width: 160 },
  { title: '最近失败说明', dataIndex: 'last_fail_detail', minWidth: 200, ellipsis: true, tooltip: true },
  { title: '未关闭缺陷', slotName: 'defects', width: 110 },
  { title: '操作', slotName: 'actions', width: 80, fixed: 'right' },
]

function appText(row: ApiResultRow): string {
  return row.app_name || row.app_number || '--'
}

function groupText(row: ApiResultRow): string {
  return row.project_group_name || row.project_group_code || '--'
}
</script>

<template>
  <a-table
    :data="rows"
    :columns="columns"
    :loading="loading"
    :pagination="pagination"
    :scroll="{ minWidth: 1500, y: tableHeight }"
    row-key="api_path"
    @page-change="emit('pageChange', $event)"
    @page-size-change="emit('pageSizeChange', $event)"
  >
    <template #api="{ record }">
      <a-tag size="small" color="arcoblue">
        {{ record.http_method }}
      </a-tag>
      <span class="api-path">{{ record.api_path }}</span>
    </template>
    <template #app="{ record }">
      {{ appText(record) }}
    </template>
    <template #projectGroup="{ record }">
      {{ groupText(record) }}
    </template>
    <template #status="{ record }">
      <a-tag :color="testStatusMeta(record.test_status).color" size="small">
        {{ testStatusMeta(record.test_status).label }}
      </a-tag>
    </template>
    <template #byType="{ record }">
      <a-tag
        v-for="item in record.by_type"
        :key="item.test_type"
        :color="item.verdict ? verdictColor(item.verdict) : 'gray'"
        size="small"
        class="type-tag"
      >
        {{ item.label }}：{{ item.verdict || '未测' }}
      </a-tag>
      <span v-if="!record.by_type.length" class="hint">--</span>
    </template>
    <template #cases="{ record }">
      <a-tooltip content="总用例 / 通过 / 失败" mini>
        <span>{{ record.case_total }} / {{ record.case_passed }} / {{ record.case_failed }}</span>
      </a-tooltip>
    </template>
    <template #testedAt="{ record }">
      {{ formatTime(record.last_tested_at) }}
    </template>
    <template #defects="{ record }">
      <a-tag v-if="record.open_defect_cnt > 0" color="red" size="small">
        {{ record.open_defect_cnt }}
      </a-tag>
      <span v-else class="hint">0</span>
    </template>
    <template #actions="{ record }">
      <a-link @click="emit('detail', record)">
        详情
      </a-link>
    </template>
    <template #empty>
      <a-empty description="没有符合条件的接口：先同步测试环境并执行包含 OpenAPI 测试的任务" />
    </template>
  </a-table>
</template>

<style scoped>
.api-path { word-break: break-all; }
.type-tag { margin: 2px 4px 2px 0; }
.hint { color: var(--color-text-3); font-size: 12px; }
</style>
