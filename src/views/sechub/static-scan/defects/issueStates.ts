/**
 * 缺陷页（defects.vue）的 007a 状态/来源口径，抽出来避免主页面继续膨胀。
 *
 * · pending_repro（待复现）：仅由 AI 发现产生的 issue，等权威规则或另一 run 的 AI 发现复现后升级为 open，
 *   也可人工「确认复现」；
 * · unstable（不稳定）：连续 3 次覆盖该文件却未复现，退出默认视图但保留记录；
 * · source=ai_discovery：AI 发现通道产生的缺陷。
 */
import type { ScanIssueRow } from '@/types/static-scan'

/**
 * 默认列表剔除的状态（逗号分隔，后端 exclude_status 按列表解析）：
 * merged = 身份归并产物行；unstable = 多次未复现。用户显式选状态时清空（见 defects.vue onStatusChange）。
 */
export const DEFAULT_EXCLUDE_STATUS = 'merged,unstable'

/** 007a 新增状态的标签（并入 defects.vue 的 statusLabels） */
export const REPRO_STATUS_LABELS: Record<string, { label: string, color: string }> = {
  pending_repro: { label: '待复现', color: 'gold' },
  unstable: { label: '不稳定', color: 'gray' },
}

const SCAN_SOURCE = { label: '扫描', color: 'arcoblue' }
const SOURCE_LABELS: Record<string, { label: string, color: string }> = {
  scan: SCAN_SOURCE,
  import: { label: '导入', color: 'orange' },
  ai_discovery: { label: 'AI 发现', color: 'purple' },
}

/** 来源筛选项（与 SOURCE_LABELS 同序） */
export const ISSUE_SOURCE_OPTIONS = Object.entries(SOURCE_LABELS).map(([value, { label }]) => ({ value, label }))

/** 来源标签：缺省/未知来源按「扫描」显示（与历史行为一致：非 import 即扫描） */
export function issueSourceLabel(source: string | undefined): { label: string, color: string } {
  return SOURCE_LABELS[source ?? ''] ?? SCAN_SOURCE
}

/** 只有待复现的缺陷可人工确认复现 */
export function canConfirmRepro(row: Pick<ScanIssueRow, 'status'>): boolean {
  return row.status === 'pending_repro'
}
