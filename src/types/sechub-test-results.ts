/**
 * API / 表单「测试结果」页的响应形状。
 *
 * 以后端实际出参为准（`axum_admin/api/src/sechub/test_results.rs` 与
 * `service/src/sechub/test_results_view/` 的 aggregate 组包）：
 *   - `GET /sechub/test-results/apis`        → 接口列表 + 五格 summary
 *   - `GET /sechub/test-results/apis/detail` → { api, cases, open_defects }
 *   - `GET /sechub/test-results/forms`       → 表单分组列表（无 summary）
 *   - `GET /sechub/test-results/forms/detail`→ { form, cases, open_defects }
 */

/** 接口测试状态（sec_api_test_status.test_status） */
export type ApiTestStatus = 'untested' | 'testing' | 'passed' | 'failed'

/** 单个测试类型的最新判定（verdict 为 null 表示该类型还没跑过） */
export interface TestTypeVerdict {
  test_type: string
  label: string
  verdict: string | null
  case_cnt: number
}

/** 接口维度一行（列表若查不到接口级状态，后端只给 api_path/http_method/test_status） */
export interface ApiResultRow {
  api_path: string
  http_method: string
  api_version: string | null
  app_number: string | null
  app_name: string | null
  project_group_code: string | null
  project_group_name: string | null
  business_area: string | null
  product_domain: string | null
  test_status: string
  case_total: number
  case_passed: number
  case_failed: number
  by_type: TestTypeVerdict[]
  last_tested_at: string | null
  last_fail_detail: string | null
  open_defect_cnt: number
}

/** 五格汇总（按测试状态计数，不受 test_status 筛选影响） */
export interface ApiResultSummary {
  total: number
  untested: number
  testing: number
  passed: number
  failed: number
}

export interface ApiResultListResponse {
  list: ApiResultRow[]
  total: number
  page_num: number
  page_size: number
  summary: ApiResultSummary
}

/** 接口列表查询参数（后端 ApiResultQuery） */
export interface ApiResultQuery {
  env_id?: string
  project_group?: string
  business_area?: string
  product_domain?: string
  test_status?: string
  test_type?: string
  verdict?: string
  keyword?: string
  page_num?: number
  page_size?: number
}

/** 详情里的接口信息 */
export interface ApiDetailInfo {
  env_id?: string
  api_path: string
  http_method?: string | null
  api_version?: string | null
  app_number?: string | null
  app_name?: string | null
  project_group_code?: string | null
  business_area?: string | null
  product_domain?: string | null
  test_status: string
  case_total?: number
  case_passed?: number
  case_failed?: number
}

/** 用例最近一次执行（每次执行都带运行 / 任务 / 套件信息） */
export interface CaseResultItem {
  id: string
  verdict: string
  detail: string | null
  http_status_code: number | null
  response_time_ms: number | null
  tested_at: string | null
  review_verdict: string | null
  review_comment: string | null
  run_id: string
  run_name: string | null
  run_status: string | null
  trigger_mode: string | null
  task_id: string | null
  task_name: string | null
  suite_id: string | null
  suite_code: string | null
  suite_name: string | null
}

/** 详情里的一条用例（最多带最近 5 次结果） */
export interface CaseResultInfo {
  id: string
  case_code: string | null
  title: string | null
  case_type: string
  test_type: string | null
  test_type_code: string
  test_type_label: string
  test_role: string | null
  latest_verdict: string | null
  results: CaseResultItem[]
}

/** 详情里的未关闭缺陷 */
export interface TestResultDefect {
  id: string
  defect_code: string
  defect_title: string
  defect_status: string
  priority: string | null
  source_no: string | null
}

export interface ApiResultDetailResponse {
  api: ApiDetailInfo
  cases: CaseResultInfo[]
  open_defects: TestResultDefect[]
}

export interface ApiResultDetailQuery {
  api_path: string
  http_method?: string
  env_id?: string
}

/** 按表单分组的一行 */
export interface FormResultRow {
  form_number: string
  form_name: string | null
  case_total: number
  by_type: FormTypeVerdict[]
  last_tested_at: string | null
  last_fail_detail: string | null
}

/** 表单各用例类型的最新判定 */
export interface FormTypeVerdict {
  case_type: string
  label: string
  verdict: string | null
  case_cnt: number
}

export interface FormResultListResponse {
  list: FormResultRow[]
  total: number
  page_num: number
  page_size: number
}

/** 表单列表查询参数（后端 FormResultGroupQuery） */
export interface FormResultQuery {
  keyword?: string
  case_type?: string
  verdict?: string
  page_num?: number
  page_size?: number
}

export interface FormDetailInfo {
  form_number: string
  form_name: string | null
}

export interface FormResultDetailResponse {
  form: FormDetailInfo
  cases: CaseResultInfo[]
  open_defects: TestResultDefect[]
}

/** 左侧树选中节点（与 ApiInventoryTree 的 select 事件同形） */
export interface TestResultTreeScope {
  dimension?: string
  kind: 'all' | 'group' | 'app' | 'api'
  code: string
}
