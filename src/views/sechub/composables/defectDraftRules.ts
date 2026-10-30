/**
 * 「发版缺陷草稿」页纯规则：状态流转、行操作、筛选查询、导出路径与展示映射。
 *
 * 独立成模块（同 `releaseCoverageRules.ts`）以便脱离 Vue / 请求层单测；
 * 状态流转矩阵必须与后端 `defect_draft::can_transition` 保持一致。
 */
import type {
  DefectFilters,
  DefectQuery,
  DefectSource,
  DefectStatus,
  ReleaseDefect,
} from '@/types/sechub-release'

export interface DefectStatusMeta {
  label: string
  color: string
}

/** 状态中文名与 Arco Tag 颜色（draft → submitted → fixed → closed） */
export const DEFECT_STATUS_META: Record<DefectStatus, DefectStatusMeta> = {
  draft: { label: '草稿', color: 'gray' },
  submitted: { label: '已提交', color: 'arcoblue' },
  fixed: { label: '已修复', color: 'green' },
  closed: { label: '已关闭', color: 'gray' },
}

export const DEFECT_STATUS_OPTIONS: Array<{ value: DefectStatus, label: string }> = [
  { value: 'draft', label: '草稿' },
  { value: 'submitted', label: '已提交' },
  { value: 'fixed', label: '已修复' },
  { value: 'closed', label: '已关闭' },
]

const DEFECT_SOURCE_META: Record<DefectSource, string> = {
  release_api: 'API 测试',
  release_config: '配置检查',
}

export const DEFECT_SOURCE_OPTIONS: Array<{ value: DefectSource, label: string }> = [
  { value: 'release_api', label: 'API 测试' },
  { value: 'release_config', label: '配置检查' },
]

const DEFECT_PRIORITY_META: Record<string, DefectStatusMeta> = {
  critical: { label: '严重', color: 'red' },
  high: { label: '高', color: 'red' },
  medium: { label: '中', color: 'orange' },
  low: { label: '低', color: 'blue' },
  info: { label: '提示', color: 'gray' },
}

export function defectStatusLabel(status: string): string {
  return DEFECT_STATUS_META[status as DefectStatus]?.label ?? status
}

export function defectStatusColor(status: string): string {
  return DEFECT_STATUS_META[status as DefectStatus]?.color ?? 'gray'
}

export function defectSourceLabel(source: string | null | undefined): string {
  if (!source)
    return '-'
  return DEFECT_SOURCE_META[source as DefectSource] ?? source
}

export function defectPriorityLabel(priority: string | null | undefined): string {
  if (!priority)
    return '-'
  return DEFECT_PRIORITY_META[priority]?.label ?? priority
}

export function defectPriorityColor(priority: string | null | undefined): string {
  return DEFECT_PRIORITY_META[priority ?? '']?.color ?? 'gray'
}

/** 状态流转矩阵（与后端 `defect_draft::can_transition` 一致） */
export function canTransition(from: DefectStatus, to: DefectStatus): boolean {
  return (from === 'draft' && to === 'submitted')
    || (from === 'submitted' && to === 'draft')
    || (from === 'submitted' && to === 'fixed')
    || to === 'closed'
}

export type DefectActionKey = 'submit' | 'fix' | 'draft' | 'close'

export interface DefectAction {
  key: DefectActionKey
  label: string
  target: DefectStatus
  /** 标记已提交时允许补录外部缺陷编号 */
  needsExternalNo: boolean
}

const CLOSE_ACTION: DefectAction = { key: 'close', label: '关闭', target: 'closed', needsExternalNo: false }
const SUBMIT_ACTION: DefectAction = { key: 'submit', label: '标记已提交', target: 'submitted', needsExternalNo: true }
const FIX_ACTION: DefectAction = { key: 'fix', label: '标记已修复', target: 'fixed', needsExternalNo: false }
const BACK_TO_DRAFT_ACTION: DefectAction = { key: 'draft', label: '退回草稿', target: 'draft', needsExternalNo: false }

/** 当前状态允许的操作（不含到自身的流转） */
export function defectActions(status: DefectStatus): DefectAction[] {
  switch (status) {
    case 'draft':
      return [SUBMIT_ACTION, CLOSE_ACTION]
    case 'submitted':
      return [FIX_ACTION, BACK_TO_DRAFT_ACTION, CLOSE_ACTION]
    case 'fixed':
      return [CLOSE_ACTION]
    case 'closed':
      return []
  }
}

/** 页面筛选 → 查询参数：空值不下发，项目组与关键词 trim */
export function defectQueryOf(filters: DefectFilters, pageNum: number, pageSize: number): DefectQuery {
  const query: DefectQuery = { page_num: pageNum, page_size: pageSize }
  if (filters.productLine)
    query.product_line = filters.productLine
  if (filters.iterationId)
    query.iteration_id = filters.iterationId
  const projectGroup = filters.projectGroup?.trim() ?? ''
  if (projectGroup)
    query.project_group = projectGroup
  if (filters.status)
    query.status = filters.status
  if (filters.source)
    query.source = filters.source
  const keyword = filters.keyword.trim()
  if (keyword)
    query.keyword = keyword
  return query
}

/** 导出路径：只带筛选条件，翻页参数不下发 */
export function defectExportPath(base: string, query: DefectQuery): string {
  const params = new URLSearchParams()
  if (query.product_line)
    params.set('product_line', query.product_line)
  if (query.iteration_id)
    params.set('iteration_id', query.iteration_id)
  if (query.project_group)
    params.set('project_group', query.project_group)
  if (query.status)
    params.set('status', query.status)
  if (query.source)
    params.set('source', query.source)
  if (query.keyword)
    params.set('keyword', query.keyword)
  const search = params.toString()
  return search ? `${base}?${search}` : base
}

/** 复制标题：去掉首尾空白 */
export function defectTitleText(defect: Pick<ReleaseDefect, 'title'>): string {
  return defect.title.trim()
}

/** 复制内容：Markdown 原文，空值返回空串 */
export function defectContentText(defect: Pick<ReleaseDefect, 'content'>): string {
  return defect.content ?? ''
}
