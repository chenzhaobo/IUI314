/**
 * 发版质量「接口覆盖」页状态：范围（产品线 / 迭代 / 领域 / 项目组）、
 * 明细筛选（覆盖状态 / 标签 / 关键字）、分页与勾选。
 *
 * 范围 query 与明细筛选分开：范围变化影响汇总与项目组统计，明细筛选只影响接口列表。
 * 两者任一变化都回到第 1 页并清空勾选。
 */
import type {
  CoverageCounts,
  CoverageGroupRow,
  CoverageQuery,
  CoverageResponse,
  CoverageStatusFilter,
  CoverageTagFilter,
  ReleaseApi,
  ReleaseIterationScope,
} from '@/types/sechub-release'
import { computed, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { fetchCoverage } from '../services/releaseService'
import { COVERAGE_STATUS_OPTIONS } from './releaseCoverageRules'
import { useCoverageSelection } from './useCoverageSelection'
import { useReleaseScope } from './useReleaseScope'

export interface ReleaseFilters {
  status: '' | CoverageStatusFilter
  tag: '' | CoverageTagFilter
  keyword: string
}

/** query 里的 status 只接受状态下拉里的取值 */
function isCoverageStatusFilter(value: string): value is CoverageStatusFilter {
  return COVERAGE_STATUS_OPTIONS.some(option => option.value === value)
}

export function useReleaseCoverage() {
  const route = useRoute()
  const scope = useReleaseScope()
  const selection = useCoverageSelection()
  const loading = ref(false)
  const filters = reactive<ReleaseFilters>({ status: '', tag: '', keyword: '' })
  const pageNum = ref(1)
  const pageSize = ref(20)
  const data = ref<CoverageResponse | null>(null)

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
  } = scope

  const list = computed<ReleaseApi[]>(() => data.value?.list ?? [])
  const groups = computed<CoverageGroupRow[]>(() => data.value?.groups ?? [])
  const summary = computed<CoverageCounts | null>(() => data.value?.summary ?? null)
  const iterationScope = computed<ReleaseIterationScope | null>(() => data.value?.iteration ?? null)
  const removedTotal = computed(() => data.value?.removed_total ?? 0)
  const envUnavailable = computed(() => Boolean(envError.value))
  const total = computed(() => data.value?.total ?? 0)
  const pagination = computed(() => ({
    current: pageNum.value,
    pageSize: pageSize.value,
    total: total.value,
    showTotal: true,
    showPageSize: true,
  }))
  const pageAllSelected = computed(() => selection.pageAllSelected(list.value))
  const hasPageSelectable = computed(() => selection.hasPageSelectable(list.value))

  function buildQuery(): CoverageQuery {
    const query: CoverageQuery = {
      ...scope.toQuery(),
      page_num: pageNum.value,
      page_size: pageSize.value,
    }
    if (filters.status)
      query.status = filters.status
    if (filters.tag)
      query.tag = filters.tag
    const keyword = filters.keyword.trim()
    if (keyword)
      query.keyword = keyword
    return query
  }

  async function loadCoverage() {
    if (envError.value) {
      data.value = null
      syncEffectiveDomains([])
      return
    }
    loading.value = true
    try {
      const result = await fetchCoverage(buildQuery())
      if (result) {
        data.value = result
        syncEffectiveDomains(result.scope.product_domains)
      }
    }
    finally {
      loading.value = false
    }
  }

  /** 路由 query 预填明细筛选（质量看板的「新增未覆盖」跳转会带 tag / status） */
  function applyRouteFilters() {
    const { tag, status } = route.query
    if (tag === 'new' || tag === 'changed')
      filters.tag = tag
    if (typeof status === 'string' && isCoverageStatusFilter(status))
      filters.status = status
  }

  async function init() {
    applyRouteFilters()
    await initScope()
    await loadCoverage()
  }

  /** 范围变化：回到第 1 页、清空勾选、重新取数 */
  watch(scopeVersion, () => {
    pageNum.value = 1
    selection.clearSelection()
    void loadCoverage()
  })

  /** 明细筛选变化：回到第 1 页、清空勾选 */
  function handleSearch() {
    pageNum.value = 1
    selection.clearSelection()
    void loadCoverage()
  }

  function handleReset() {
    filters.status = ''
    filters.tag = ''
    filters.keyword = ''
    handleSearch()
  }

  function selectGroup(code: string) {
    selectProjectGroup(code)
  }

  function handlePageChange(page: number) {
    pageNum.value = page
    void loadCoverage()
  }

  function handlePageSizeChange(size: number) {
    pageSize.value = size
    pageNum.value = 1
    void loadCoverage()
  }

  function togglePageSelection() {
    selection.togglePageSelection(list.value)
  }

  return {
    loading,
    scopeLoading,
    scopeOptions,
    productLine,
    iterationId,
    productDomain,
    businessArea,
    projectGroup,
    effectiveDomains,
    envError,
    envUnavailable,
    summaryText,
    filters,
    list,
    groups,
    summary,
    iterationScope,
    removedTotal,
    pagination,
    pageAllSelected,
    hasPageSelectable,
    selectedCount: selection.selectedCount,
    selectedKeys: selection.selectedKeys,
    selectedByGroup: selection.selectedByGroup,
    selectedGroupCount: selection.selectedGroupCount,
    selectedGroupNames: selection.selectedGroupNames,
    init,
    handleSearch,
    handleReset,
    handleScopeChange,
    selectGroup,
    handlePageChange,
    handlePageSizeChange,
    toggleApi: selection.toggleApi,
    togglePageSelection,
  }
}
