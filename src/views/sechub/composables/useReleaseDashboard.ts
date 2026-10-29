/**
 * 发版质量「质量看板」页状态：迭代筛选（默认当前）、看板与趋势取数、生成报告。
 *
 * 看板只读实时计算；趋势与看板独立加载，其中一个失败不影响另一个已加载的数据。
 */
import type {
  ReleaseDashboardData,
  ReleaseIteration,
  ReleaseSnapshotGenerateResult,
  ReleaseTrendResponse,
} from '@/types/sechub-release'
import { computed, ref } from 'vue'

import {
  fetchReleaseDashboard,
  fetchReleaseTrend,
  generateReleaseSnapshot,
} from '../services/releaseDashboardService'
import { fetchIterations } from '../services/releaseService'

export function useReleaseDashboard() {
  const loading = ref(false)
  const trendLoading = ref(false)
  const generating = ref(false)
  const iterations = ref<ReleaseIteration[]>([])
  const iterationId = ref('')
  const data = ref<ReleaseDashboardData | null>(null)
  const trend = ref<ReleaseTrendResponse | null>(null)

  const iterationOptions = computed(() => iterations.value.map(item => ({
    value: item.id,
    label: `${item.name}（${item.code}）`,
  })))

  /** 本迭代新增未覆盖 = 新增总数 - 新增已覆盖（不含免测，不为负） */
  const newUncovered = computed(() => {
    if (!data.value)
      return 0
    return Math.max(0, data.value.scope.new_total - data.value.coverage.new_covered)
  })

  async function loadIterations() {
    const result = await fetchIterations()
    if (!result)
      return
    iterations.value = result.list
    const preferred = result.current_id || result.list[0]?.id || ''
    if (!result.list.some(item => item.id === iterationId.value))
      iterationId.value = preferred
  }

  function scopeQuery() {
    return iterationId.value ? { iteration_id: iterationId.value } : {}
  }

  async function loadDashboard() {
    loading.value = true
    try {
      const result = await fetchReleaseDashboard(scopeQuery())
      if (result)
        data.value = result
    }
    finally {
      loading.value = false
    }
  }

  async function loadTrend() {
    trendLoading.value = true
    try {
      const result = await fetchReleaseTrend(scopeQuery())
      if (result)
        trend.value = result
    }
    finally {
      trendLoading.value = false
    }
  }

  async function init() {
    await loadIterations()
    await Promise.all([loadDashboard(), loadTrend()])
  }

  /** 切换迭代：看板与趋势并行重取 */
  function handleIterationChange() {
    void Promise.all([loadDashboard(), loadTrend()])
  }

  async function refresh() {
    await Promise.all([loadDashboard(), loadTrend()])
  }

  /** 生成发版报告（快照）；成功后由页面提示并决定是否跳转 */
  async function generateReport(): Promise<ReleaseSnapshotGenerateResult | null> {
    generating.value = true
    try {
      return await generateReleaseSnapshot(scopeQuery())
    }
    finally {
      generating.value = false
    }
  }

  return {
    loading,
    trendLoading,
    generating,
    iterations,
    iterationId,
    iterationOptions,
    newUncovered,
    data,
    trend,
    init,
    refresh,
    handleIterationChange,
    generateReport,
  }
}
