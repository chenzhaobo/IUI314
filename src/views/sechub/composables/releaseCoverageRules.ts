/**
 * 「接口覆盖」页的纯规则：勾选键、可勾选判定、按项目组聚合、比率与展示格式。
 *
 * 独立成模块（同 `caseBatchReviewRules.ts`）是为了能脱离 Vue / 请求层单测。
 */
import type { CoverageStatus, CoverageStatusFilter, CoverageTagFilter, ReleaseApi } from '@/types/sechub-release'

/** 只有「未覆盖 / 待评审」允许勾选派发 Agent */
export const SELECTABLE_STATUSES: readonly CoverageStatus[] = ['uncovered', 'pending_review']

/** 覆盖状态筛选项（含 covered / not_covered 两个聚合口径） */
export const COVERAGE_STATUS_OPTIONS: Array<{ value: CoverageStatusFilter, label: string }> = [
  { value: 'covered', label: '已覆盖' },
  { value: 'not_covered', label: '未覆盖（含待评审 / 免测）' },
  { value: 'uncovered', label: '未覆盖' },
  { value: 'pending_review', label: '待评审' },
  { value: 'exempt', label: '免测' },
  { value: 'not_run', label: '未执行' },
  { value: 'partial', label: '部分执行' },
  { value: 'passed', label: '通过' },
  { value: 'failed', label: '未通过' },
  { value: 'review', label: '待复核' },
  { value: 'blocked', label: '阻塞' },
]

/** 标签筛选项 */
export const COVERAGE_TAG_OPTIONS: Array<{ value: CoverageTagFilter, label: string }> = [
  { value: 'new', label: '本迭代新增' },
  { value: 'changed', label: '本迭代变更' },
]

/** 勾选键：`api_path|HTTP_METHOD`（方法 trim + 大写，与后端豁免键同口径） */
export function apiSelectionKey(apiPath: string, httpMethod: string | null | undefined): string {
  const method = (httpMethod ?? '').trim().toUpperCase()
  return `${apiPath.trim()}|${method}`
}

/** 该覆盖状态是否允许勾选 */
export function isSelectable(status: CoverageStatus): boolean {
  return SELECTABLE_STATUSES.includes(status)
}

/** 勾选的接口按项目组编码聚合为 api_path 列表（组内去重、保持勾选顺序） */
export function groupSelectedApis(
  apis: Array<Pick<ReleaseApi, 'api_path' | 'project_group_code'>>,
): Record<string, string[]> {
  const grouped: Record<string, string[]> = {}
  for (const api of apis) {
    const code = api.project_group_code.trim()
    const paths = grouped[code] ?? (grouped[code] = [])
    if (!paths.includes(api.api_path))
      paths.push(api.api_path)
  }
  return grouped
}

/** 覆盖状态的中文名与 Arco Tag 颜色 */
export const COVERAGE_STATUS_META: Record<CoverageStatus, { label: string, color: string }> = {
  uncovered: { label: '未覆盖', color: 'red' },
  pending_review: { label: '待评审', color: 'orange' },
  exempt: { label: '免测', color: 'gray' },
  not_run: { label: '未执行', color: 'arcoblue' },
  partial: { label: '部分执行', color: 'blue' },
  passed: { label: '通过', color: 'green' },
  failed: { label: '未通过', color: 'red' },
  review: { label: '待复核', color: 'orange' },
  blocked: { label: '阻塞', color: 'purple' },
}

export function coverageStatusLabel(status: CoverageStatus): string {
  return COVERAGE_STATUS_META[status]?.label ?? status
}

export function coverageStatusColor(status: CoverageStatus): string {
  return COVERAGE_STATUS_META[status]?.color ?? 'gray'
}

/** 覆盖率文案：保留 1 位小数；总数为 0 显示 `-` */
export function coverageRateText(covered: number, total: number): string {
  if (total <= 0)
    return '-'
  return `${((covered / total) * 100).toFixed(1)}%`
}

/** 测试类型展示：`authz / inject`；空数组显示 `-` */
export function formatTestTypes(types: string[]): string {
  return types.length ? types.join(' / ') : '-'
}
