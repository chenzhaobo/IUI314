/**
 * 「表单测试结果」页状态：按表单分组列表 + 详情抽屉 + 原始结果流水筛选。
 *
 * 结果流水列表由 `FormResultFlowPanel` 取数；这里只保存筛选条件与触发。
 */
import type {
  FormResultListResponse,
  FormResultRow,
} from '@/types/sechub-test-results'
import { computed, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'

import { fetchFormResults } from '../services/testResultsService'
import { formNumberFromQuery } from './testResultsRules'

export type FormResultTab = 'forms' | 'flow'

export interface FormFlowQuery {
  form_number: string
  case_type: string
  verdict: string
  keyword: string
}

function emptyFlowQuery(): FormFlowQuery {
  return { form_number: '', case_type: '', verdict: '', keyword: '' }
}

export function useFormTestResults() {
  const route = useRoute()
  const activeTab = ref<FormResultTab>('forms')

  // ── 按表单 ────────────────────────────────────
  const filters = reactive({ case_type: '', verdict: '', keyword: '' })
  const pageNum = ref(1)
  const pageSize = ref(20)
  const loading = ref(false)
  const data = ref<FormResultListResponse | null>(null)

  const rows = computed<FormResultRow[]>(() => data.value?.list ?? [])
  const total = computed(() => Number(data.value?.total ?? 0))
  const pagination = computed(() => ({
    current: pageNum.value,
    pageSize: pageSize.value,
    total: total.value,
    showTotal: true,
    showPageSize: true,
  }))

  async function load() {
    loading.value = true
    try {
      const res = await fetchFormResults({
        case_type: filters.case_type || undefined,
        verdict: filters.verdict || undefined,
        keyword: filters.keyword.trim() || undefined,
        page_num: pageNum.value,
        page_size: pageSize.value,
      })
      if (res)
        data.value = res
    }
    finally {
      loading.value = false
    }
  }

  function handleSearch() {
    pageNum.value = 1
    void load()
  }

  function handleReset() {
    filters.case_type = ''
    filters.verdict = ''
    filters.keyword = ''
    handleSearch()
  }

  function handlePageChange(page: number) {
    pageNum.value = page
    void load()
  }

  function handlePageSizeChange(size: number) {
    pageSize.value = size
    pageNum.value = 1
    void load()
  }

  // ── 结果流水（列表由 FormResultFlowPanel 取数）──
  const flowSearchForm = reactive<FormFlowQuery>(emptyFlowQuery())
  const flowQuery = ref<FormFlowQuery>(emptyFlowQuery())

  function applyFlowSearch() {
    flowQuery.value = { ...flowSearchForm }
  }

  function resetFlowSearch() {
    Object.assign(flowSearchForm, emptyFlowQuery())
    applyFlowSearch()
  }

  // ── 详情抽屉（取数在 FormResultDetailDrawer 内）──
  const detailVisible = ref(false)
  const detailFormNumber = ref('')

  function openDetail(row: FormResultRow) {
    detailFormNumber.value = row.form_number
    detailVisible.value = true
  }

  /** 路由 query 带 form_number 时直接打开详情 */
  function openSeedDetail() {
    const formNumber = formNumberFromQuery(route.query as Record<string, unknown>)
    if (!formNumber)
      return
    detailFormNumber.value = formNumber
    detailVisible.value = true
  }

  return {
    activeTab,
    filters,
    loading,
    rows,
    total,
    pagination,
    load,
    handleSearch,
    handleReset,
    handlePageChange,
    handlePageSizeChange,
    flowSearchForm,
    flowQuery,
    applyFlowSearch,
    resetFlowSearch,
    detailVisible,
    detailFormNumber,
    openDetail,
    openSeedDetail,
  }
}
