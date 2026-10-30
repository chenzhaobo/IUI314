<script setup lang="ts">
/**
 * 执行记录（API 测试结果 → 「执行记录」Tab）。
 *
 * 从 api-test-results.vue 原样抽出：运行列表（GET /sechub/scan/runs）+ 运行结果抽屉。
 * 筛选条件由页面持有（`query`），这里负责分页取数；行为与抽出前一致。
 */
import type { RunListQuery } from '../composables/useApiTestResults'
import { computed, ref, watch } from 'vue'

import { ApiSecScan } from '@/api/sechubApis'
import { formatTime, useGet } from '@/hooks'
import ApiRunResultsDrawer from './ApiRunResultsDrawer.vue'

interface SecRunRow {
  id: string
  run_name: string
  iteration_phase: string | null
  status: string
  total_cases: number
  pass_cnt: number
  fail_cnt: number
  started_at: string | null
}

interface RunListResponse {
  list: SecRunRow[]
  total: number
}

const props = defineProps<{
  query: RunListQuery
  presetKeyword?: string
  tableHeight?: number
}>()

const RUN_STATUS: Record<string, { label: string, color: string }> = {
  pending: { label: '待执行', color: 'gray' },
  running: { label: '运行中', color: 'blue' },
  success: { label: 'PASS', color: 'green' },
  failed: { label: 'FAIL', color: 'red' },
  partial: { label: '部分通过', color: 'orange' },
  cancelled: { label: '已取消', color: 'gray' },
}

function runStatusMeta(status?: string | null) {
  return RUN_STATUS[status || ''] ?? { label: status || '--', color: 'gray' }
}

const pageNum = ref(1)
const pageSize = ref(20)

const queryParams = computed(() => ({
  page_num: pageNum.value,
  page_size: pageSize.value,
  keyword: props.query.keyword,
  filters: props.query.status
    ? JSON.stringify([{ field: 'status', op: 'eq', value: props.query.status }])
    : '',
}))

const { isFetching: loading, data: rawData, execute: fetchList } = useGet<RunListResponse>(
  ApiSecScan.runList,
  queryParams,
  { immediate: true },
)

const rows = computed(() => rawData.value?.list || [])
const pagination = computed(() => ({
  current: pageNum.value,
  pageSize: pageSize.value,
  total: Number(rawData.value?.total || 0),
  showTotal: true,
  showPageSize: true,
}))

// 页面点「查询 / 重置」会换一个新对象：回到第 1 页再取
watch(() => props.query, () => {
  pageNum.value = 1
  void fetchList()
}, { deep: true })

function handlePageChange(page: number) {
  pageNum.value = page
  void fetchList()
}

function handlePageSizeChange(size: number) {
  pageSize.value = size
  pageNum.value = 1
  void fetchList()
}

// ── 运行结果抽屉 ──────────────────────────────────
const drawerVisible = ref(false)
const currentRun = ref<SecRunRow | null>(null)

function openResults(record: SecRunRow) {
  currentRun.value = record
  drawerVisible.value = true
}
</script>

<template>
  <div class="run-list-panel">
    <a-table
      :data="rows"
      :loading="loading"
      :pagination="pagination"
      :scroll="{ minWidth: 1000, y: tableHeight }"
      row-key="id"
      @page-change="handlePageChange"
      @page-size-change="handlePageSizeChange"
    >
      <template #columns>
        <a-table-column title="运行名称" data-index="run_name" :width="260" ellipsis tooltip />
        <a-table-column title="迭代阶段" :width="130" ellipsis tooltip>
          <template #cell="{ record }">
            {{ record.iteration_phase || '--' }}
          </template>
        </a-table-column>
        <a-table-column title="状态" :width="100">
          <template #cell="{ record }">
            <a-tag :color="runStatusMeta(record.status).color">
              {{ runStatusMeta(record.status).label }}
            </a-tag>
          </template>
        </a-table-column>
        <a-table-column title="用例统计" :width="150">
          <template #cell="{ record }">
            <a-tooltip content="总用例 / 通过 / 失败" mini>
              <span>{{ record.total_cases }} / {{ record.pass_cnt }} / {{ record.fail_cnt }}</span>
            </a-tooltip>
          </template>
        </a-table-column>
        <a-table-column title="开始时间" :width="160">
          <template #cell="{ record }">
            {{ formatTime(record.started_at) }}
          </template>
        </a-table-column>
        <a-table-column title="操作" :width="110" fixed="right">
          <template #cell="{ record }">
            <a-link @click="openResults(record)">
              查看结果
            </a-link>
          </template>
        </a-table-column>
      </template>
      <template #empty>
        <a-empty description="暂无运行记录：在「扫描任务」里执行包含 OpenAPI 测试的任务" />
      </template>
    </a-table>

    <ApiRunResultsDrawer
      v-model:visible="drawerVisible"
      :run="currentRun"
      :preset-keyword="presetKeyword"
    />
  </div>
</template>
