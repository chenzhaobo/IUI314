/**
 * 缺陷页「检出记录」（契约 A）的 DTO 与展示口径。
 * 数据源：GET /sechub/prescan/issue-detections?issue_id=（按检出时间倒序）。
 */

/** 一条检出：某次 run 里指向该缺陷的一个候选 */
export interface IssueDetectionRow {
  detection_id: string
  run_id: string
  run_created_at: string
  /** unified / repository / form / microservice */
  run_target_type: string
  candidate_id: string
  rule_version_id: string
  rule_key: string
  rule_name: string
  scan_point_name: string
  /** 权威规则检出（非权威 = 证据/辅助规则） */
  is_authoritative: boolean
  /** 当前缺陷显示内容（风险/报告/行号…）就取自这条检出 */
  is_representative: boolean
  ai_status: string
  risk_level?: string | null
  ai_model?: string | null
  file_path: string
  start_line?: number | null
  method_name?: string | null
  ai_detail_report?: string | null
}

/** 风险等级 → 中文 + 色值（与缺陷列表同口径，多一个 critical） */
export const DETECTION_RISK_LABELS: Record<string, { label: string, color: string }> = {
  critical: { label: '严重', color: 'magenta' },
  high: { label: '高', color: 'red' },
  medium: { label: '中', color: 'orange' },
  low: { label: '低', color: 'blue' },
}

/** 位置文案：文件:行号 · 方法名 */
export function detectionLocation(row: IssueDetectionRow): string {
  const line = row.start_line ? `:${row.start_line}` : ''
  const method = row.method_name ? ` · ${row.method_name}` : ''
  return `${row.file_path}${line}${method}`
}
