<script setup lang="ts">
/**
 * 结果流水（表单测试结果 → 「结果流水」Tab）。
 *
 * 从 form-results.vue 原样抽出：一条条原始测试结果（sec_sec_result join 用例 + 运行），
 * 按结果维度筛选与分页。数据：GET /sechub/form-test/results。
 */
import type { TableColumnData } from '@arco-design/web-vue'
import type { FormFlowQuery } from '../composables/useFormTestResults'
import { computed, ref, watch } from 'vue'

import { ApiSecFormTest } from '@/api/sechubApis'
import { useGet, withTableDefaults } from '@/hooks'
import { CASE_TYPE_OPTIONS } from '../composables/testResultsRules'

interface FormFlowRow {
  id: string
  form_number: string
  entity_name: string | null
  case_type: string | null
  test_type: string | null
  verdict: string
  detail: string | null
  http_status_code: number | null
  response_time_ms: number | null
  run_name: string | null
  tested_at: string | null
}

interface FormFlowResponse {
  list: FormFlowRow[]
  total: number
}

const props = defineProps<{
  query: FormFlowQuery
  tableHeight?: number
}>()

const VERDICT_COLOR: Record<string, string> = {
  PASS: 'green',
  FAIL: 'red',
  REVIEW: 'orange',
  BLOCKED: 'gray',
  ERROR: 'orangered',
}

const pageNum = ref(1)
const pageSize = ref(20)

const { isFetching: loading, data: rawData, execute: fetchList } = useGet<FormFlowResponse>(
  ApiSecFormTest.results,
  computed(() => ({
    page_num: pageNum.value,
    page_size: pageSize.value,
    form_number: props.query.form_number || undefined,
    case_type: props.query.case_type || undefined,
    verdict: props.query.verdict || undefined,
    keyword: props.query.keyword || undefined,
  })),
  { immediate: true },
)

const rows = computed<FormFlowRow[]>(() => rawData.value?.list || [])
const total = computed(() => Number(rawData.value?.total || 0))

const pagination = computed(() => ({
  current: pageNum.value,
  pageSize: pageSize.value,
  total: total.value,
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

function formatTimeText(val: unknown): string {
  if (!val)
    return '--'
  const d = new Date(String(val))
  return Number.isNaN(d.getTime()) ? String(val) : d.toLocaleString('zh-CN', { hour12: false })
}

const columns: TableColumnData[] = withTableDefaults([
  { title: '表单', dataIndex: 'form_number', width: 180, ellipsis: true, tooltip: true },
  { title: '表单名称', dataIndex: 'entity_name', width: 160, ellipsis: true, tooltip: true },
  { title: '用例类型', dataIndex: 'case_type', width: 130, slotName: 'case_type' },
  { title: '测试类型', dataIndex: 'test_type', width: 110 },
  { title: '判定', dataIndex: 'verdict', width: 90, slotName: 'verdict' },
  { title: '判定说明', dataIndex: 'detail', ellipsis: true, tooltip: true },
  { title: 'HTTP', dataIndex: 'http_status_code', width: 70 },
  { title: '耗时(ms)', dataIndex: 'response_time_ms', width: 90 },
  { title: '运行', dataIndex: 'run_name', width: 220, ellipsis: true, tooltip: true },
  { title: '执行时间', dataIndex: 'tested_at', width: 170, slotName: 'tested_at' },
])
</script>

<template>
  <a-table
    :data="rows"
    :columns="columns"
    :loading="loading"
    :pagination="pagination"
    :scroll="{ y: tableHeight, x: 1500 }"
    row-key="id"
    size="small"
    @page-change="handlePageChange"
    @page-size-change="handlePageSizeChange"
  >
    <template #case_type="{ record }">
      <a-tag v-if="record.case_type" size="small">
        {{ CASE_TYPE_OPTIONS.find(t => t.value === record.case_type)?.label || record.case_type }}
      </a-tag>
    </template>
    <template #verdict="{ record }">
      <a-tag :color="VERDICT_COLOR[String(record.verdict)] || 'gray'" size="small">
        {{ record.verdict }}
      </a-tag>
    </template>
    <template #tested_at="{ record }">
      {{ formatTimeText(record.tested_at) }}
    </template>
  </a-table>
</template>
