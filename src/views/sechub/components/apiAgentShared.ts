export const STATUS_META: Record<string, { label: string, color: string }> = {
  queued: { label: '排队中', color: 'gray' },
  running: { label: '执行中', color: 'blue' },
  completed: { label: '已完成', color: 'green' },
  failed: { label: '失败', color: 'red' },
  timeout: { label: '超时', color: 'orangered' },
}

export const PIPELINE_MODE_OPTIONS = [
  { value: 'hybrid', label: 'hybrid（推荐：连续执行 + 执行前评审 + 最终审计）' },
  { value: 'strict', label: 'strict（逐步接力：生成/评审/修复/结果复核）' },
  { value: 'continuous', label: 'continuous（全自主：仅最终审计）' },
]

export const PIPELINE_MODE_META: Record<string, { label: string, color: string }> = {
  strict: { label: 'strict', color: 'gray' },
  hybrid: { label: 'hybrid', color: 'arcoblue' },
  continuous: { label: 'continuous', color: 'purple' },
}

export const GATE_META: Record<string, { label: string, color: string }> = {
  none: { label: '未开始', color: 'gray' },
  running: { label: '进行中', color: 'blue' },
  passed: { label: '通过', color: 'green' },
  needs_fix: { label: '待修复', color: 'orange' },
  failed: { label: '失败', color: 'red' },
  completed: { label: '完成', color: 'green' },
}

export const STAGE_LABELS: Record<string, string> = {
  prepared: '准备',
  strict: '逐步接力',
  requirements: '需求/风险',
  cases: '用例编写',
  cases_gate: '用例评审',
  scripts: '脚本/执行前',
  trial: '试跑',
  results: '结果复核',
  report: '报告',
  audit: '最终审计',
  audit_fix: '审计修复',
  completed: '已完成',
}

export const NEXT_ACTION_LABELS: Record<string, string> = {
  strict: '逐步接力模式',
  fix_context: '修需求/风险清单',
  fix_cases: '修用例/finding',
  wait_cases_review: '等待用例评审',
  fix_scripts: '修脚本/执行前问题',
  wait_result_review: '等待结果复核',
  fix_and_retry: '修用例后重跑',
  write_report: '写报告',
  complete: '提交 complete',
  wait_audit: '等待最终审计',
  fix_audit: '修复审计问题',
  human_review: '转人工处理',
  done: '已完成',
}

export const RESULT_VERDICT_META: Record<string, { label: string, color: string }> = {
  true_positive: { label: '真实漏洞', color: 'red' },
  false_positive: { label: '误报', color: 'orange' },
  test_defect: { label: '用例缺陷', color: 'orange' },
  env_blocked: { label: '环境阻塞', color: 'gray' },
  needs_deeper_audit: { label: '需深挖', color: 'blue' },
}

export function statusMeta(s?: string) {
  return STATUS_META[s || ''] || { label: s || '--', color: 'gray' }
}

export function modeMeta(s?: string) {
  return PIPELINE_MODE_META[s || ''] || { label: s || '--', color: 'gray' }
}

export function gateMeta(s?: string) {
  return GATE_META[s || ''] || { label: s || '--', color: 'gray' }
}

export function resultVerdictMeta(s?: string) {
  return RESULT_VERDICT_META[s || ''] || { label: s || '待复核', color: 'gray' }
}

export function stageLabel(s?: string) {
  return STAGE_LABELS[s || ''] || s || '--'
}

export function nextActionLabel(s?: string) {
  return NEXT_ACTION_LABELS[s || ''] || s || '--'
}
