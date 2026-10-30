import type { SummaryCardKey, TestStatusFilter } from './testResultsRules'
/**
 * 「API 测试结果」页状态：按接口列表 + 筛选 + 详情抽屉 + 执行记录筛选。
 *
 * 取数走 service（页面不直接请求）；执行记录列表本身由 `ApiRunListPanel` 负责，
 * 这里只保存它的筛选条件与「查询 / 重置」触发。
 */
import type {
  ApiResultDetailQuery,
  ApiResultRow,
  ApiResultSummary,
  TestResultTreeScope,
} from '@/types/sechub-test-results'
import { computed, reactive, ref } from 'vue'

import { useRoute } from 'vue-router'
import { fetchApiResults } from '../services/testResultsService'
import {
  apiDetailSeed,
  nextStatusFilter,
  scopeQuery,
  summaryCards,
  tabFromQuery,
  testTypeOptions,
} from './testResultsRules'

export type ApiResultTab = 'apis' | 'runs'

export interface RunListQuery {
  keyword: string
  status: string
}

export function useApiTestResults() {
  const route = useRoute()
  const activeTab = ref<ApiResultTab>(tabFromQuery(route.query as Record<string, unknown>))
  const dimension = ref('app')
  const scope = ref<TestResultTreeScope | null>(null)

  // ── 按接口 ────────────────────────────────────
  const filters = reactive({ test_status: '' as TestStatusFilter, test_type: '', verdict: '', keyword: '' })
  const pageNum = ref(1)
  const pageSize = ref(20)
  const loading = ref(false)
  const rows = ref<ApiResultRow[]>([])
  const summary = ref<ApiResultSummary | null>(null)
  const total = ref(0)

  const scopeFilters = computed(() => scopeQuery(dimension.value, scope.value))
  const summaryCardList = computed(() => summaryCards(summary.value))
  const typeOptions = computed(() => testTypeOptions(rows.value))
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
      const data = await fetchApiResults({
        ...scopeFilters.value,
        test_status: filters.test_status || undefined,
        test_type: filters.test_type || undefined,
        verdict: filters.verdict || undefined,
        keyword: filters.keyword.trim() || undefined,
        page_num: pageNum.value,
        page_size: pageSize.value,
      })
      if (!data)
        return
      rows.value = Array.isArray(data.list) ? data.list : []
      total.value = Number(data.total ?? 0)
      summary.value = data.summary ?? null
    }
    finally {
      loading.value = false
    }
  }

  /** 左树每次刷新都会 emit 一次 all，这也是首屏列表的加载入口 */
  function handleTreeSelect(selected: TestResultTreeScope) {
    scope.value = selected
    pageNum.value = 1
    void load()
  }

  function handleSearch() {
    pageNum.value = 1
    void load()
  }

  function handleReset() {
    filters.test_status = ''
    filters.test_type = ''
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

  function applyStatusCard(key: SummaryCardKey) {
    filters.test_status = nextStatusFilter(filters.test_status, key)
    handleSearch()
  }

  // ── 执行记录（列表由 ApiRunListPanel 取数，这里只放筛选条件）──
  const runSearchForm = reactive<RunListQuery>({ keyword: '', status: '' })
  const runQuery = ref<RunListQuery>({ keyword: '', status: '' })

  function applyRunSearch() {
    runQuery.value = { ...runSearchForm }
  }

  function resetRunSearch() {
    runSearchForm.keyword = ''
    runSearchForm.status = ''
    applyRunSearch()
  }

  // ── 详情抽屉（取数在 ApiResultDetailDrawer 内）──
  const detailVisible = ref(false)
  const detailTarget = ref<ApiResultDetailQuery | null>(null)

  function openDetail(row: ApiResultRow) {
    detailTarget.value = { api_path: row.api_path, http_method: row.http_method }
    detailVisible.value = true
  }

  /** 路由 query 带 api_path 时（E09 穿透）直接打开详情 */
  function openSeedDetail() {
    const seed = apiDetailSeed(route.query as Record<string, unknown>)
    if (!seed)
      return
    detailTarget.value = { api_path: seed.apiPath, http_method: seed.httpMethod, env_id: seed.envId }
    detailVisible.value = true
  }

  return {
    activeTab,
    dimension,
    scope,
    filters,
    loading,
    rows,
    summary,
    summaryCardList,
    typeOptions,
    pagination,
    handleTreeSelect,
    handleSearch,
    handleReset,
    handlePageChange,
    handlePageSizeChange,
    applyStatusCard,
    runSearchForm,
    runQuery,
    applyRunSearch,
    resetRunSearch,
    detailVisible,
    detailTarget,
    openDetail,
    openSeedDetail,
  }
}
