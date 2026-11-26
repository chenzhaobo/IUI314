/**
 * 问题看板 DTO（后端 dashboard.rs Summary 的前端镜像）。
 */

export interface DashboardCounter {
  key: string
  label: string
  total: number
  open: number
  overdue: number
}

export interface DashboardTrendPoint {
  round_id: string
  round_no: string
  /** 本轮出现的问题数 */
  hit: number
  /** 本轮首次出现 */
  new_issues: number
  reproduced: number
  status: string
}

export interface DashboardSummary {
  total: number
  open: number
  overdue: number
  unclassified: number
  by_status: DashboardCounter[]
  by_repro: DashboardCounter[]
  by_type: DashboardCounter[]
  by_group: DashboardCounter[]
  trend: DashboardTrendPoint[]
}

export function emptySummary(): DashboardSummary {
  return {
    total: 0,
    open: 0,
    overdue: 0,
    unclassified: 0,
    by_status: [],
    by_repro: [],
    by_type: [],
    by_group: [],
    trend: [],
  }
}
