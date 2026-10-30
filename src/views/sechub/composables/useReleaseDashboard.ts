/**
 * 发版质量「质量看板」页状态：范围筛选（产品线 / 迭代 / 产品领域 / 业务领域 / 项目组）、
 * 看板与趋势取数、生成报告。
 *
 * 看板与趋势都按同一范围 query 取数；范围变化后并行重取。产品线没有测试环境时
 * 不再请求看板，由页面展示空状态；看板只读实时计算，趋势与看板独立加载。
 */
import type {
  ReleaseDashboardData,
  ReleaseScopeQuery,
  ReleaseSnapshotGenerateResult,
  ReleaseTrendResponse,
} from '@/types/sechub-release'
import { computed, ref, watch } from 'vue'

import {
  fetchReleaseDashboard,
  fetchReleaseTrend,
  generateReleaseSnapshot,
} from '../services/releaseDashboardService'
import { locateProjectGroup } from './releaseScopeRules'
import { useReleaseScope } from './useReleaseScope'

export function useReleaseDashboard() {
  const scope = useReleaseScope()
  const loading = ref(false)
  const trendLoading = ref(false)
  const generating = ref(false)
  const data = ref<ReleaseDashboardData | null>(null)
  const trend = ref<ReleaseTrendResponse | null>(null)

  const {
    loading: scopeLoading,
    options: scopeOptions,
    productLine,
    iterationId,
    productDomain,
    businessArea,
    projectGroup,
    effectiveDomains,
    envError,
    summaryText,
    version: scopeVersion,
    syncEffectiveDomains,
    selectProjectGroup,
    init: initScope,
    handleChange: handleScopeChange,
    toQuery,
  } = scope

  const envUnavailable = computed(() => Boolean(envError.value))

  /** 本迭代新增未覆盖 = 新增总数 - 新增已覆盖（不含免测，不为负） */
  const newUncovered = computed(() => {
    if (!data.value)
      return 0
    return Math.max(0, data.value.scope.new_total - data.value.coverage.new_covered)
  })

  function scopeQuery(): ReleaseScopeQuery {
    return toQuery()
  }

  async function loadDashboard() {
    if (envUnavailable.value) {
      data.value = null
      syncEffectiveDomains([])
      return
    }
    loading.value = true
    try {
      const result = await fetchReleaseDashboard(scopeQuery())
      if (result) {
        data.value = result
        syncEffectiveDomains(result.product_domains)
      }
    }
    finally {
      loading.value = false
    }
  }

  async function loadTrend() {
    if (envUnavailable.value) {
      trend.value = null
      return
    }
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
    await initScope()
    await Promise.all([loadDashboard(), loadTrend()])
  }

  async function refresh() {
    await Promise.all([loadDashboard(), loadTrend()])
  }

  /** 范围变化：看板与趋势并行重取 */
  watch(scopeVersion, () => {
    void refresh()
  })

  /**
   * 项目组矩阵点选：设置范围项目组。能在范围树里定位时补齐上级领域；
   * 定位不到（例如没有产品领域的项目组）时只按项目组过滤。
   */
  function selectGroup(code: string) {
    if (!code)
      return
    if (locateProjectGroup(scopeOptions.value, code)) {
      selectProjectGroup(code)
      return
    }
    productDomain.value = ''
    businessArea.value = ''
    projectGroup.value = code
    scopeVersion.value += 1
  }

  /** 生成发版报告（快照）；带完整范围，成功后由页面提示并决定是否跳转 */
  async function generateReport(): Promise<ReleaseSnapshotGenerateResult | null> {
    if (envUnavailable.value)
      return null
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
    scopeLoading,
    scopeOptions,
    productLine,
    iterationId,
    productDomain,
    businessArea,
    projectGroup,
    effectiveDomains,
    summaryText,
    envUnavailable,
    newUncovered,
    data,
    trend,
    init,
    refresh,
    handleScopeChange,
    selectGroup,
    generateReport,
  }
}
