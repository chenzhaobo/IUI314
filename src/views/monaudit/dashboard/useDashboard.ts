/**
 * 问题看板：拉汇总、生成图表配置；点项目组条形跳到问题清单。
 */
import type { DashboardChartOption } from './charts'
import type { DashboardSummary } from './types'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { counterBarOption, statusPieOption, trendLineOption } from './charts'
import { fetchDashboardSummary } from './service'
import { emptySummary } from './types'

/** 问题清单路由名（= sys_menu.path） */
const ISSUES_ROUTE = 'monaudit-issues'

export function useDashboard() {
  const router = useRouter()
  const summary = ref<DashboardSummary>(emptySummary())
  const loading = ref(false)

  async function load() {
    loading.value = true
    try {
      summary.value = (await fetchDashboardSummary()) ?? emptySummary()
    }
    finally {
      loading.value = false
    }
  }

  const typeOption = computed<DashboardChartOption>(() => counterBarOption(summary.value.by_type))
  const groupOption = computed<DashboardChartOption>(() => counterBarOption(summary.value.by_group))
  const statusOption = computed<DashboardChartOption>(() => statusPieOption(summary.value.by_status))
  const trendOption = computed<DashboardChartOption>(() => trendLineOption(summary.value.trend))

  /** 条形图按 reverse 后的顺序渲染：dataIndex 要换算回原数组 */
  function onGroupClick(params: { dataIndex?: number }) {
    const rows = summary.value.by_group
    if (params.dataIndex === undefined)
      return
    const row = rows[rows.length - 1 - params.dataIndex]
    if (!row || !router.hasRoute(ISSUES_ROUTE))
      return
    void router.push({ name: ISSUES_ROUTE, query: { project_group: row.key } })
  }

  return { summary, loading, load, typeOption, groupOption, statusOption, trendOption, onGroupClick }
}
