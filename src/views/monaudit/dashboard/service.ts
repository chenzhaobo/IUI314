/**
 * 问题看板取数（service 层）：按当前用户的数据范围汇总。
 */
import type { DashboardSummary } from './types'
import { ApiMonauditDashboard } from '@/api/monauditApis'
import { getAction } from '@/hooks'

export function fetchDashboardSummary(): Promise<DashboardSummary | null> {
  return getAction<DashboardSummary>(ApiMonauditDashboard.summary)
}
