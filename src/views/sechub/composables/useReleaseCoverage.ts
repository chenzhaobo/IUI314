/**
 * 发版质量「接口覆盖」页状态：迭代选择、筛选、分页与勾选。
 *
 * 勾选跨页保留（Map key = api_path|METHOD）；改筛选条件会清空勾选，
 * 避免把用户已经看不见的接口一并派发。
 */
import type {
  CoverageGroupRow,
  CoverageQuery,
  CoverageResponse,
  CoverageStatusFilter,
  CoverageTagFilter,
  ReleaseApi,
  ReleaseIteration,
} from '@/types/sechub-release'
import { computed, reactive, ref } from 'vue'

import { fetchCoverage, fetchIterations } from '../services/releaseService'
import { apiSelectionKey, groupSelectedApis, isSelectable } from './releaseCoverageRules'

export interface ReleaseFilters {
  projectGroup: string
  status: '' | CoverageStatusFilter
  tag: '' | CoverageTagFilter
  keyword: string
}

export function useReleaseCoverage() {
  const loading = ref(false)
  const iterations = ref<ReleaseIteration[]>([])
  const iterationId = ref('')
  const filters = reactive<ReleaseFilters>({ projectGroup: '', status: '', tag: '', keyword: '' })
  const pageNum = ref(1)
  const pageSize = ref(20)
  const data = ref<CoverageResponse | null>(null)
  /** 勾选：key → 接口；跨页保留，避免翻页丢选择 */
  const selected = ref(new Map<string, ReleaseApi>())

  const list = computed<ReleaseApi[]>(() => data.value?.list ?? [])
  const groups = computed<CoverageGroupRow[]>(() => data.value?.groups ?? [])
  const total = computed(() => data.value?.total ?? 0)
  const pagination = computed(() => ({
    current: pageNum.value,
    pageSize: pageSize.value,
    total: total.value,
    showTotal: true,
    showPageSize: true,
  }))

  const selectedApis = computed<ReleaseApi[]>(() => [...selected.value.values()])
  const selectedCount = computed(() => selected.value.size)
  /** 勾选键列表（供表格受控渲染） */
  const selectedKeys = computed(() => [...selected.value.keys()])
  /** 项目组编码 → api_path 列表（一键测试按组逐次派发） */
  const selectedByGroup = computed(() => groupSelectedApis(selectedApis.value))
  const selectedGroupCount = computed(() => Object.keys(selectedByGroup.value).length)
  /** 项目组编码 → 名称（弹窗展示用） */
  const selectedGroupNames = computed<Record<string, string>>(() => {
    const names: Record<string, string> = {}
    for (const api of selectedApis.value)
      names[api.project_group_code.trim()] = api.project_group_name
    return names
  })

  const pageSelectableApis = computed(() => list.value.filter(api => isSelectable(api.coverage)))
  const pageAllSelected = computed(() => pageSelectableApis.value.length > 0
    && pageSelectableApis.value.every(api => selected.value.has(apiSelectionKey(api.api_path, api.http_method))))

  function buildQuery(): CoverageQuery {
    const query: CoverageQuery = {
      page_num: pageNum.value,
      page_size: pageSize.value,
    }
    if (iterationId.value)
      query.iteration_id = iterationId.value
    if (filters.projectGroup)
      query.project_group = filters.projectGroup
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
    loading.value = true
    try {
      const result = await fetchCoverage(buildQuery())
      if (result)
        data.value = result
    }
    finally {
      loading.value = false
    }
  }

  /** 迭代下拉：默认选后端 current_id；没有当前迭代时保留首项 */
  async function loadIterations() {
    const result = await fetchIterations()
    if (!result)
      return
    iterations.value = result.list
    const preferred = result.current_id || result.list[0]?.id || ''
    const exists = result.list.some(item => item.id === iterationId.value)
    if (!exists)
      iterationId.value = preferred
  }

  async function init() {
    await loadIterations()
    await loadCoverage()
  }

  function clearSelection() {
    selected.value = new Map()
  }

  /** 筛选条件变化：回到第 1 页并清空勾选 */
  function handleSearch() {
    pageNum.value = 1
    clearSelection()
    void loadCoverage()
  }

  function handleReset() {
    filters.projectGroup = ''
    filters.status = ''
    filters.tag = ''
    filters.keyword = ''
    handleSearch()
  }

  function handleIterationChange() {
    handleSearch()
  }

  /** 项目组统计行点击：按该组过滤（再点同一行取消过滤） */
  function selectGroup(code: string) {
    filters.projectGroup = filters.projectGroup === code ? '' : code
    handleSearch()
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

  function isApiSelected(api: ReleaseApi): boolean {
    return selected.value.has(apiSelectionKey(api.api_path, api.http_method))
  }

  function toggleApi(api: ReleaseApi) {
    if (!isSelectable(api.coverage))
      return
    const key = apiSelectionKey(api.api_path, api.http_method)
    const next = new Map(selected.value)
    if (next.has(key))
      next.delete(key)
    else
      next.set(key, api)
    selected.value = next
  }

  /** 表头全选：本页可勾选行全选 / 取消 */
  function togglePageSelection() {
    const next = new Map(selected.value)
    if (pageAllSelected.value) {
      for (const api of pageSelectableApis.value)
        next.delete(apiSelectionKey(api.api_path, api.http_method))
    }
    else {
      for (const api of pageSelectableApis.value)
        next.set(apiSelectionKey(api.api_path, api.http_method), api)
    }
    selected.value = next
  }

  return {
    loading,
    iterations,
    iterationId,
    filters,
    pageNum,
    pageSize,
    data,
    list,
    groups,
    total,
    pagination,
    selectedCount,
    selectedKeys,
    selectedByGroup,
    selectedGroupCount,
    selectedGroupNames,
    pageAllSelected,
    hasPageSelectable: computed(() => pageSelectableApis.value.length > 0),
    init,
    loadCoverage,
    handleSearch,
    handleReset,
    handleIterationChange,
    selectGroup,
    handlePageChange,
    handlePageSizeChange,
    isApiSelected,
    toggleApi,
    togglePageSelection,
    clearSelection,
  }
}
