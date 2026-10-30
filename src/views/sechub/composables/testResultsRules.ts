/**
 * 「API / 表单测试结果」的纯规则：状态映射、左树 → 查询参数、汇总卡、路由 query 解析。
 *
 * 不依赖 Vue / 请求，便于用 node:test 直接覆盖（见 __tests__/testResultsRules.spec.ts）。
 */
import type {
  ApiResultRow,
  ApiResultSummary,
  TestResultTreeScope,
} from '@/types/sechub-test-results'
import { TEST_TYPE_LABELS, VERDICT_OPTIONS, verdictColor } from '../components/apiTestShared'

/** 接口测试状态（与后端 sec_api_test_status.test_status 一致） */
export const TEST_STATUS_META: Record<string, { label: string, color: string }> = {
  untested: { label: '未测', color: 'gray' },
  testing: { label: '测试中', color: 'blue' },
  passed: { label: '通过', color: 'green' },
  failed: { label: '失败', color: 'red' },
}

export function testStatusMeta(status?: string | null): { label: string, color: string } {
  const key = (status || '').trim()
  if (!key)
    return TEST_STATUS_META.untested
  return TEST_STATUS_META[key] ?? { label: key, color: 'gray' }
}

/** 顶部五格汇总卡；`filter` 是点击后要应用的测试状态筛选（'' = 不筛） */
export type SummaryCardKey = 'total' | 'untested' | 'testing' | 'passed' | 'failed'
export type TestStatusFilter = '' | 'untested' | 'testing' | 'passed' | 'failed'

export interface SummaryCard {
  key: SummaryCardKey
  label: string
  value: number
  color: string
  filter: TestStatusFilter
}

const SUMMARY_CARD_META: Array<Omit<SummaryCard, 'value'>> = [
  { key: 'total', label: '接口总数', color: 'arcoblue', filter: '' },
  { key: 'untested', label: '未测', color: 'gray', filter: 'untested' },
  { key: 'testing', label: '测试中', color: 'blue', filter: 'testing' },
  { key: 'passed', label: '通过', color: 'green', filter: 'passed' },
  { key: 'failed', label: '失败', color: 'red', filter: 'failed' },
]

export function summaryCards(summary?: ApiResultSummary | null): SummaryCard[] {
  return SUMMARY_CARD_META.map(card => ({
    ...card,
    value: summary ? Number(summary[card.key] ?? 0) : 0,
  }))
}

/** 点汇总卡：总数 = 清空筛选；点已选中的状态 = 取消筛选 */
export function nextStatusFilter(current: TestStatusFilter, cardKey: SummaryCardKey | ''): TestStatusFilter {
  const meta = SUMMARY_CARD_META.find(card => card.key === cardKey)
  if (!meta || !meta.filter)
    return ''
  return current === meta.filter ? '' : meta.filter
}

/** 左树选中节点 → 后端查询参数（app 维度没有独立参数，按 keyword 兜住应用编码） */
export function scopeQuery(
  dimension: string,
  scope?: TestResultTreeScope | null,
): { project_group?: string, business_area?: string, product_domain?: string, keyword?: string } {
  const code = (scope?.code || '').trim()
  if (!scope || !code || scope.kind === 'all')
    return {}
  if (scope.kind === 'api')
    return { keyword: code }
  switch (dimension) {
    case 'project_group':
      return { project_group: code }
    case 'business_area':
      return { business_area: code }
    case 'product_domain':
      return { product_domain: code }
    default:
      return { keyword: code }
  }
}

/** 下拉的固定选项：与后端 normalize_test_type 的规范码一一对应（不重复列别名） */
const DEFAULT_TEST_TYPE_CODES = [
  'perm',
  'horizon',
  'idor',
  'anon',
  'base',
  'robust',
  'injection',
  'leak',
  'deserialization',
  'diag',
  'xss',
  'java_reflect',
]

/** 测试类型下拉：常量表打底 + 列表里出现过的类型（label 以后端为准） */
export function testTypeOptions(rows: ApiResultRow[]): Array<{ value: string, label: string }> {
  const seen = new Map<string, string>()
  for (const row of rows) {
    for (const item of row.by_type) {
      const code = (item.test_type || '').trim()
      if (code)
        seen.set(code, item.label || TEST_TYPE_LABELS[code] || code)
    }
  }
  const defaults = DEFAULT_TEST_TYPE_CODES.map(value => ({
    value,
    label: seen.get(value) ?? TEST_TYPE_LABELS[value] ?? value,
  }))
  const extras = [...seen.entries()]
    .filter(([value]) => !DEFAULT_TEST_TYPE_CODES.includes(value))
    .map(([value, label]) => ({ value, label }))
  return [...defaults, ...extras]
}

/** 判定下拉（PASS/FAIL/…），与结果表 verdict 同域 */
export const RESULT_VERDICT_OPTIONS = VERDICT_OPTIONS

export { verdictColor }

/** 路由 query 取值：支持 string / string[] / null */
function queryText(value: unknown): string {
  if (Array.isArray(value))
    return queryText(value[0])
  return typeof value === 'string' ? value.trim() : ''
}

export interface ApiDetailSeed {
  apiPath: string
  httpMethod: string
  envId: string
}

/** 从路由 query 解析「直接打开某接口详情」的种子（E09 穿透） */
export function apiDetailSeed(query: Record<string, unknown>): ApiDetailSeed | null {
  const apiPath = queryText(query.api_path)
  if (!apiPath)
    return null
  return {
    apiPath,
    httpMethod: queryText(query.http_method).toUpperCase(),
    envId: queryText(query.env_id),
  }
}

/** tab=query：只有 `runs` 有效，其余落到默认「按接口」 */
export function tabFromQuery(query: Record<string, unknown>): 'apis' | 'runs' {
  return queryText(query.tab) === 'runs' ? 'runs' : 'apis'
}

/** 从路由 query 解析要直接打开的表单编码 */
export function formNumberFromQuery(query: Record<string, unknown>): string | null {
  const formNumber = queryText(query.form_number)
  return formNumber || null
}

/** 表单用例类型（种子数据：sec_sec_case.case_type；含 F4 表单URL直达） */
export const CASE_TYPE_OPTIONS = [
  { label: '表单权限', value: 'form_perm' },
  { label: '表单注入', value: 'form_inject' },
  { label: '表单URL直达', value: 'form_url' },
  { label: '静态权限检查', value: 'meta_perm_check' },
  { label: '静态日志检查', value: 'meta_log_check' },
  { label: '静态匿名访问', value: 'meta_anon_check' },
]

export function caseTypeLabel(code?: string | null): string {
  if (!code)
    return '--'
  return CASE_TYPE_OPTIONS.find(option => option.value === code)?.label || code
}

/** 未关闭缺陷 → 发版缺陷页（按编号检索） */
export function defectLink(defectCode: string): string {
  return `/sechub/release/release-defects?keyword=${encodeURIComponent(defectCode)}`
}
