/** 自动化成功用例采集与跨批次耗时横比 DTO。 */

export interface AutomationSourceOption {
  id: string
  code: string
  name: string
  base_url: string
  task_id: string
  task_name: string
  status: string
  remark?: string | null
}

export interface AutomationReport {
  task_id: string
  task_name: string
  execute_id: string
  execute_state?: number | null
  started_at?: string | null
  finished_at?: string | null
  duration_ms?: number | null
  environment_domain?: string | null
  data_centre?: string | null
  raw_json: string
}

export interface CaseRoundRef {
  round_id: string
  round_no: string
  name: string
  automation_execute_id?: string | null
  automation_started_at?: string | null
  automation_finished_at?: string | null
  environment_domain?: string | null
  data_centre?: string | null
}

export interface CaseCompareSummary {
  matched: number
  improved: number
  regressed: number
  unchanged: number
  current_only: number
  baseline_only: number
  invalid_duration: number
}

export type CaseVerdict = 'improved' | 'regressed' | 'unchanged'

export interface CaseComparisonRow {
  case_key: string
  case_name?: string | null
  case_path?: string | null
  current_duration_ms: number
  baseline_duration_ms: number
  delta_ms: number
  delta_pct?: number | null
  verdict: CaseVerdict
}

export interface CaseCompareVo {
  current_round: CaseRoundRef
  baseline_round?: CaseRoundRef | null
  baseline_options: CaseRoundRef[]
  summary: CaseCompareSummary
  list: CaseComparisonRow[]
  total: number
  total_pages: number
  page_num: number
}

export interface CaseCompareQuery {
  baseline_round_id?: string
  keyword?: string
  verdict?: string
  page_num: number
  page_size: number
}

export const CASE_VERDICT_OPTIONS = [
  { value: 'improved', label: '性能提升（耗时下降）' },
  { value: 'regressed', label: '性能下降（耗时上升）' },
  { value: 'unchanged', label: '持平' },
]

export function verdictMeta(verdict: CaseVerdict): { label: string, color: string } {
  if (verdict === 'improved')
    return { label: '性能提升', color: 'green' }
  if (verdict === 'regressed')
    return { label: '性能下降', color: 'red' }
  return { label: '持平', color: 'gray' }
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined)
    return '-'
  if (Math.abs(ms) >= 1000)
    return `${(ms / 1000).toFixed(2)} s`
  return `${ms} ms`
}

export function formatDelta(ms: number): string {
  return `${ms > 0 ? '+' : ''}${formatDuration(ms)}`
}

export function formatDeltaPct(pct: number | null | undefined): string {
  if (pct === null || pct === undefined)
    return '-'
  return `${pct > 0 ? '+' : ''}${pct.toFixed(2)}%`
}
