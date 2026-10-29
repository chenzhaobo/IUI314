/**
 * 「缺陷草稿」页状态：迭代默认当前、筛选、分页、状态流转与 Markdown 导出。
 *
 * 仿 `useReleaseCoverage`：筛选变化回到第 1 页重新取数；
 * 导出直接走鉴权下载 hook，按当前筛选（不含翻页）请求 export.md。
 */
import type { DefectAction } from './defectDraftRules'
import type {
  DefectFilters,
  DefectListResponse,
  DefectQuery,
  DefectStatusPayload,
  ReleaseDefect,
  ReleaseIteration,
} from '@/types/sechub-release'
import { Message } from '@arco-design/web-vue'
import { computed, reactive, ref } from 'vue'

import { ApiSecRelease } from '@/api/sechubApis'
import { useDownload } from '@/hooks'
import { fetchDefects, updateDefectStatus } from '../services/defectDraftService'
import { fetchIterations } from '../services/releaseService'
import { defectExportPath, defectQueryOf } from './defectDraftRules'

export function useDefectDrafts() {
  const loading = ref(false)
  const exporting = ref(false)
  const iterations = ref<ReleaseIteration[]>([])
  const iterationId = ref('')
  const filters = reactive<DefectFilters>({ projectGroup: '', status: '', source: '', keyword: '' })
  const pageNum = ref(1)
  const pageSize = ref(20)
  const data = ref<DefectListResponse | null>(null)
  const { downloadWithTip } = useDownload()

  const list = computed<ReleaseDefect[]>(() => data.value?.list ?? [])
  const total = computed(() => data.value?.total ?? 0)
  const pagination = computed(() => ({
    current: pageNum.value,
    pageSize: pageSize.value,
    total: total.value,
    showTotal: true,
    showPageSize: true,
  }))

  function buildQuery(): DefectQuery {
    return defectQueryOf({ ...filters, iterationId: iterationId.value }, pageNum.value, pageSize.value)
  }

  async function loadDefects() {
    loading.value = true
    try {
      const result = await fetchDefects(buildQuery())
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
    if (!result.list.some(item => item.id === iterationId.value))
      iterationId.value = preferred
  }

  async function init() {
    await loadIterations()
    await loadDefects()
  }

  function handleSearch() {
    pageNum.value = 1
    void loadDefects()
  }

  function handleReset() {
    filters.projectGroup = ''
    filters.status = ''
    filters.source = ''
    filters.keyword = ''
    handleSearch()
  }

  function handleIterationChange() {
    handleSearch()
  }

  function handlePageChange(page: number) {
    pageNum.value = page
    void loadDefects()
  }

  function handlePageSizeChange(size: number) {
    pageSize.value = size
    pageNum.value = 1
    void loadDefects()
  }

  /** 执行状态流转；成功后重载列表 */
  async function applyAction(defect: ReleaseDefect, action: DefectAction, externalNo = ''): Promise<boolean> {
    const payload: DefectStatusPayload = { status: action.target }
    const trimmed = externalNo.trim()
    if (action.needsExternalNo && trimmed)
      payload.external_no = trimmed
    const result = await updateDefectStatus(defect.id, payload)
    if (!result)
      return false
    Message.success('状态已更新')
    await loadDefects()
    return true
  }

  /** 按当前筛选导出 Markdown（翻页参数不参与） */
  async function exportMarkdown() {
    exporting.value = true
    try {
      const path = defectExportPath(ApiSecRelease.defectsExport, buildQuery())
      await downloadWithTip(path, 'release-defects.md', '导出失败，请稍后重试')
    }
    finally {
      exporting.value = false
    }
  }

  return {
    loading,
    exporting,
    iterations,
    iterationId,
    filters,
    pageNum,
    pageSize,
    data,
    list,
    total,
    pagination,
    init,
    loadDefects,
    handleSearch,
    handleReset,
    handleIterationChange,
    handlePageChange,
    handlePageSizeChange,
    applyAction,
    exportMarkdown,
  }
}
