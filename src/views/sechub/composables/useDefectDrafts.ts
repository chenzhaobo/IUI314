/**
 * 「缺陷草稿」页状态：范围筛选（产品线 / 迭代 / 领域 / 项目组）、状态 / 来源 / 关键字、
 * 分页、状态流转与 Markdown 导出。
 *
 * 仿 `useReleaseCoverage`：范围或筛选变化都回到第 1 页重新取数；
 * 导出直接走鉴权下载 hook，按当前范围与筛选（不含翻页）请求 export.md。
 */
import type { DefectAction } from './defectDraftRules'
import type {
  DefectFilters,
  DefectListResponse,
  DefectQuery,
  DefectStatusPayload,
  ReleaseDefect,
} from '@/types/sechub-release'
import { Message } from '@arco-design/web-vue'
import { computed, reactive, ref, watch } from 'vue'

import { ApiSecRelease } from '@/api/sechubApis'
import { useDownload } from '@/hooks'
import { fetchDefects, updateDefectStatus } from '../services/defectDraftService'
import { defectExportPath, defectQueryOf } from './defectDraftRules'
import { useReleaseScope } from './useReleaseScope'

/** 表格上方的明细筛选（范围由 ReleaseScopeBar 提供） */
type DefectTableFilters = Pick<DefectFilters, 'status' | 'source' | 'keyword'>

export function useDefectDrafts() {
  const scope = useReleaseScope()
  const loading = ref(false)
  const exporting = ref(false)
  const filters = reactive<DefectTableFilters>({ status: '', source: '', keyword: '' })
  const pageNum = ref(1)
  const pageSize = ref(20)
  const data = ref<DefectListResponse | null>(null)
  const { downloadWithTip } = useDownload()

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
    init: initScope,
    handleChange: handleScopeChange,
  } = scope

  const envUnavailable = computed(() => Boolean(envError.value))
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
    return defectQueryOf({
      productLine: productLine.value,
      iterationId: iterationId.value,
      projectGroup: projectGroup.value,
      ...filters,
    }, pageNum.value, pageSize.value)
  }

  async function loadDefects() {
    if (envUnavailable.value) {
      data.value = null
      return
    }
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

  async function init() {
    await initScope()
    await loadDefects()
  }

  /** 范围变化：回到第 1 页重新取数 */
  watch(scopeVersion, () => {
    pageNum.value = 1
    void loadDefects()
  })

  function handleSearch() {
    pageNum.value = 1
    void loadDefects()
  }

  function handleReset() {
    filters.status = ''
    filters.source = ''
    filters.keyword = ''
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

  /** 按当前范围与筛选导出 Markdown（翻页参数不参与） */
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
    filters,
    pageNum,
    pageSize,
    data,
    list,
    total,
    pagination,
    init,
    loadDefects,
    handleScopeChange,
    handleSearch,
    handleReset,
    handlePageChange,
    handlePageSizeChange,
    applyAction,
    exportMarkdown,
  }
}
