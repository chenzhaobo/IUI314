/**
 * 问题清单：筛选 / 左树范围 / 分页 / 勾选 / 下拉选项（View → Composable → Service）。
 *
 * 右侧筛选用 sessionStorage 暂存（页内往返恢复）；从看板带 ?project_group= 跳进来时不恢复，并以它为范围。
 */
import type { IssueOptions } from '../shared/types'
import type { IssueFilter, IssueRow, IssueScope } from './types'
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useFilterPersistence, usePagedQuery } from '@/hooks'
import { fetchIssueOptions } from '../shared/service'
import { emptyIssueOptions } from '../shared/types'
import { fetchIssues } from './service'
import { emptyIssueFilter, ISSUE_PAGE_SIZE } from './types'

export function useIssueList() {
  const route = useRoute()
  const filter = ref<IssueFilter>(emptyIssueFilter())
  const scope = ref<IssueScope>({})
  const options = ref<IssueOptions>(emptyIssueOptions())
  const dataList = ref<IssueRow[]>([])
  const loading = ref(false)
  const selectedKeys = ref<string[]>([])
  let seq = 0

  const { query, total, pagination, onPageChange, onPageSizeChange }
    = usePagedQuery({}, () => void loadList(), { pageSize: ISSUE_PAGE_SIZE })

  /** 给左树的筛选：右侧条件，不含范围与分页 */
  const treeFilters = computed(() => ({ ...filter.value }))

  async function loadList() {
    const current = ++seq
    loading.value = true
    try {
      const page = await fetchIssues({ ...filter.value, ...scope.value, page_num: query.value.page_num, page_size: query.value.page_size })
      if (current !== seq)
        return
      dataList.value = page?.list ?? []
      total.value = page?.total ?? 0
      selectedKeys.value = []
    }
    finally {
      if (current === seq)
        loading.value = false
    }
  }

  function search() {
    query.value.page_num = 1
    void loadList()
  }

  function resetFilter() {
    filter.value = emptyIssueFilter()
    search()
  }

  function onScopeChange(next: IssueScope) {
    scope.value = next
    search()
  }

  const selectedRows = computed(() => {
    const keys = new Set(selectedKeys.value)
    return dataList.value.filter(r => keys.has(r.id))
  })

  async function loadOptions() {
    const res = await fetchIssueOptions()
    if (res)
      options.value = res
  }

  const routeGroup = typeof route.query.project_group === 'string' ? route.query.project_group : ''
  // 只暂存右侧筛选：左树范围若被静默恢复，树上没有对应高亮，列表被收窄的原因就看不出来
  useFilterPersistence('monaudit-issues', { filter }, { skipRestore: () => !!routeGroup })

  /** 首次进入：选项 + 列表（路由带项目组时以它为范围） */
  async function init() {
    if (routeGroup)
      scope.value = { project_group: routeGroup }
    void loadOptions()
    await loadList()
  }

  return {
    filter,
    scope,
    options,
    dataList,
    loading,
    total,
    pagination,
    onPageChange,
    onPageSizeChange,
    selectedKeys,
    selectedRows,
    treeFilters,
    loadList,
    search,
    resetFilter,
    onScopeChange,
    init,
  }
}
