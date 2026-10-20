/**
 * 公有云性能达标治理（后端 `perf/governance/*`）。
 *
 * 看板按项目组一行：达标率 → 分析覆盖 → 台账处置 → 缺陷承诺 → 验证；
 * 方案初稿给出「修哪几个能达标、哪些要补日志、哪些还没分析」。
 */

export interface GovernanceRow {
  project_group_code: string
  project_group_name: string
  business_area: string
  total: number
  over: number
  rate: number
  pass: boolean
  over_to_cut: number
  failing_forms: number
  analyzed_forms: number
  ledger_total: number
  ledger_pending: number
  ledger_observing: number
  ledger_wont_fix: number
  ledger_issued: number
  issue_total: number
  issue_with_plan: number
  issue_unclaimed: number
  issue_in_progress: number
  issue_overdue: number
  issue_released: number
  issue_verified: number
  issue_wont_fix: number
}

export interface GovernanceBoard {
  period_start: string
  period_end: string
  target_rate: number
  rows: GovernanceRow[]
  summary: GovernanceRow
}

export interface GovernancePlanItem {
  pattern_id: string
  pattern_no: string
  title: string
  form_id: string
  form_name: string
  attribution_tag: string
  status: string
  est_recover: number
  needs_logging: boolean
  issue_no?: string | null
  process_status?: string | null
  process_owner?: string | null
  plan_date?: string | null
  overdue: boolean
}

export interface GovernancePlan {
  project_group_code: string
  project_group_name: string
  period_start: string
  period_end: string
  total: number
  over: number
  rate: number
  target_rate: number
  over_to_cut: number
  path: GovernancePlanItem[]
  path_reaches_target: boolean
  est_rate_all_fixed: number
  others: GovernancePlanItem[]
  needs_logging: GovernancePlanItem[]
  uncovered_over: number
  markdown: string
}

export interface GovernancePushPreview {
  project_group_code: string
  project_group_name: string
  yzj_group_id: string
  pass: boolean
  content: string
}

/** 查询范围（与达标率看板同口径） */
export interface GovernanceQuery {
  product_domain?: string
  period_type?: string
  period?: string
  project_group_code?: string
  only_failing?: boolean
}
