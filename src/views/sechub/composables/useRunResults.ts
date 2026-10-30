/**
 * 执行记录 → 用例结果明细（筛选 / 分页 / 摘要下钻）。
 *
 * 从 `scan-runs.vue` 抽出：一次全量运行可达 4 万+ 条结果，必须分页 + 服务端筛选，
 * 页面只负责「打开哪条运行」，明细状态都在这里。
 */
import { Message } from '@arco-design/web-vue'
import { computed, reactive, ref } from 'vue'

import { ApiSecScan, resolveStaticScanApi } from '@/api/sechubApis'
import { getAction } from '@/hooks'

export interface RunResultCase {
  case_type?: string | null
  entity_number?: string | null
  api_path?: string | null
  http_method?: string | null
  test_type?: string | null
}

export interface RunResultRow {
  id: string
  case_id?: string | null
  verdict?: string | null
  detail?: string | null
  error_message?: string | null
  response_time_ms?: number | null
  case?: RunResultCase | null
}

interface RunResultListResponse {
  list?: RunResultRow[]
  total?: number
}

export interface RunResultFilter {
  verdict: string
  test_type: string
  keyword: string
}

export interface RunResultPagination {
  current: number
  pageSize: number
  total: number
  showTotal: boolean
  showPageSize: boolean
  pageSizeOptions: number[]
}

/** 结果判定（sec_sec_result.verdict） */
const VERDICT_COLOR: Record<string, string> = {
  PASS: 'green',
  FAIL: 'red',
  REVIEW: 'orange',
  BLOCKED: 'gray',
  ERROR: 'orangered',
}

const CASE_TYPE_LABELS: Record<string, string> = {
  form_perm: '表单权限',
  form_inject: '表单注入',
  openapi_perm: 'OpenAPI权限',
  openapi_inject: 'OpenAPI注入',
  script: 'Python脚本',
}

const TEST_TYPE_LABELS: Record<string, string> = {
  perm: '权限',
  anon: '未鉴权访问',
  xss: 'XSS注入',
  sqli: 'SQL注入',
  java_reflect: 'Java反射',
  idor: '越权(IDOR)',
  base: '正向基线',
  robustness: '健壮性',
  form_url: '表单URL直达',
  // 静态扫描（meta_collect）产出的用例类型
  meta_perm: '元数据-权限配置',
  meta_anon: '元数据-匿名访问',
  meta_log: '元数据-操作日志',
}

/** 结果筛选下拉的选项（值与 case.test_type 一致） */
export const RESULT_TEST_TYPE_OPTIONS = [
  { value: 'perm', label: '权限' },
  { value: 'anon', label: '未鉴权访问' },
  { value: 'idor', label: '越权(IDOR)' },
  { value: 'base', label: '正向基线' },
  { value: 'robustness', label: '健壮性' },
  { value: 'xss', label: 'XSS注入' },
  { value: 'sqli', label: 'SQL注入' },
  { value: 'java_reflect', label: 'Java反射' },
  { value: 'form_url', label: '表单URL直达' },
  { value: 'meta_perm', label: '元数据-权限配置' },
  { value: 'meta_anon', label: '元数据-匿名访问' },
  { value: 'meta_log', label: '元数据-操作日志' },
]

export const VERDICT_OPTIONS = ['PASS', 'FAIL', 'REVIEW', 'BLOCKED', 'ERROR']

export function verdictColor(verdict?: string | null): string {
  return VERDICT_COLOR[verdict || ''] ?? 'gray'
}

/** 结果行优先展示测试类型（越权/注入/正向），没有时退回用例类型 */
export function resultTypeText(item?: RunResultCase | null): string {
  if (!item)
    return '--'
  if (item.test_type)
    return TEST_TYPE_LABELS[item.test_type] || item.test_type
  if (item.case_type)
    return CASE_TYPE_LABELS[item.case_type] || item.case_type
  return '--'
}

/** 摘要分组的形状（GET /runs/{id}/summary 的 groups[]） */
export interface RunSummaryGroup {
  test_type?: string | null
  counts?: Record<string, number>
}

export function useRunResults() {
  const resultsLoading = ref(false)
  const currentRunId = ref('')
  const results = ref<RunResultRow[]>([])
  const resultPageNum = ref(1)
  const resultPageSize = ref(20)
  const resultTotal = ref(0)
  const resultFilter = reactive<RunResultFilter>({ verdict: '', test_type: '', keyword: '' })

  const resultPagination = computed<RunResultPagination>(() => ({
    current: resultPageNum.value,
    pageSize: resultPageSize.value,
    total: resultTotal.value,
    showTotal: true,
    showPageSize: true,
    pageSizeOptions: [20, 50, 100],
  }))

  async function fetchResults() {
    const id = currentRunId.value
    if (!id)
      return
    resultsLoading.value = true
    try {
      const res = await getAction<RunResultListResponse>(
        resolveStaticScanApi(ApiSecScan.runResults, { id }),
        {
          page_num: resultPageNum.value,
          page_size: resultPageSize.value,
          verdict: resultFilter.verdict,
          test_type: resultFilter.test_type,
          keyword: resultFilter.keyword,
        },
      )
      results.value = res?.list ?? []
      resultTotal.value = res?.total ?? 0
    }
    finally {
      resultsLoading.value = false
    }
  }

  /** 换一条运行：清空筛选 / 分页后加载第一页 */
  async function loadForRun(runId: string) {
    currentRunId.value = runId
    results.value = []
    resultTotal.value = 0
    resultPageNum.value = 1
    resultFilter.verdict = ''
    resultFilter.test_type = ''
    resultFilter.keyword = ''
    await fetchResults()
  }

  function handleSearch() {
    resultPageNum.value = 1
    void fetchResults()
  }

  function handleReset() {
    resultFilter.verdict = ''
    resultFilter.test_type = ''
    resultFilter.keyword = ''
    handleSearch()
  }

  function handlePageChange(page: number) {
    resultPageNum.value = page
    void fetchResults()
  }

  function handlePageSizeChange(size: number) {
    resultPageSize.value = size
    resultPageNum.value = 1
    void fetchResults()
  }

  /** 点摘要分组卡片下钻：把该组「测试类型 + 占比最大的判定」灌进明细筛选 */
  function drillGroup(group?: RunSummaryGroup | null) {
    const counts = group?.counts ?? {}
    const topVerdict = Object.keys(counts).sort((a, b) => Number(counts[b]) - Number(counts[a]))[0] || ''
    resultFilter.keyword = ''
    resultFilter.verdict = topVerdict
    resultFilter.test_type = group?.test_type || ''
    if (!group?.test_type)
      Message.info('该分组用例没有测试类型，已按判定筛选')
    handleSearch()
  }

  return {
    resultsLoading,
    results,
    resultTotal,
    resultFilter,
    resultPagination,
    loadForRun,
    fetchResults,
    handleSearch,
    handleReset,
    handlePageChange,
    handlePageSizeChange,
    drillGroup,
  }
}
