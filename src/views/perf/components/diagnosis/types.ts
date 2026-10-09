/**
 * 资源四步诊断（101i）的 DTO 与展示口径。
 *
 * 后端契约（已合入 `ttp-ro-be-final@dbf4f25d`）：
 * `service/src/perf/observe/diagnosis.rs`（`perf_run_diagnosis` 行、四步顺序、转缺陷结果）
 * 与 `diagnosis_ai.rs`（`InterpretResult`）。
 */
import { formatMetric, formatNumber, formatPercent } from '@/utils/perfFormat'

/** 四步固定顺序（后端 `STEPS`；展示与缺失占位都以此为准） */
export const DIAGNOSIS_STEPS = ['pod_restart', 'throttling', 'middleware', 'application']

/** `perf_run_diagnosis` 行 */
export interface DiagnosisRow {
  id: string
  /** run | task | stage */
  scope: string
  scope_id: string
  /** pod_restart | throttling | middleware | application */
  step: string
  /** hit | clear | unknown */
  verdict: string
  /** 判据原始数值（{runs, items}，JSON 列，按原文展开） */
  evidence?: unknown
  summary: string
  /** 转缺陷后的 perf_issue.id 反链 */
  issue_id?: string | null
  created_at?: string | null
}

/** 转缺陷结果（created=false 为同指纹未关闭缺陷去重复用） */
export interface ToIssueResult {
  issue_id: string
  created: boolean
  fingerprint: string
}

/** AI 解读结果（报告存 perf_analysis_report） */
export interface DiagnosisAiResult {
  execution_id: string
  report_id: string
}

const STEP_TEXT: Record<string, string> = {
  pod_restart: '容器重启 / OOMKilled',
  throttling: 'CPU 限流',
  middleware: '中间件与主机资源',
  application: '应用侧',
}

export function stepNameText(step: string): string {
  return STEP_TEXT[step] ?? step
}

const VERDICT_TEXT: Record<string, string> = {
  hit: '命中',
  clear: '未见异常',
  unknown: '数据不足',
}

const VERDICT_COLOR: Record<string, string> = {
  hit: 'red',
  clear: 'green',
  unknown: 'gray',
}

export function verdictText(verdict: string): string {
  return VERDICT_TEXT[verdict] ?? verdict
}

export function verdictColor(verdict: string): string {
  return VERDICT_COLOR[verdict] ?? 'gray'
}

/** 证据里的数值按 metric_key 推断单位（与后端 `rules.rs` 的判据 KEYS 一致） */
function evidenceUnit(metricKey: unknown): string | undefined {
  if (typeof metricKey !== 'string')
    return undefined
  if (metricKey.endsWith('_bytes'))
    return 'byte'
  if (metricKey.endsWith('_ratio'))
    return 'ratio'
  if (metricKey === 'restarts' || metricKey === 'connections' || metricKey === 'max_connections')
    return 'count'
  return undefined
}

/** 证据里的单个数值：判据字段（avg/max/ratio）按上下文单位，其余数值去超长小数 */
function evidenceNumber(key: string, value: number, unit: string | undefined): string {
  if (key === 'ratio')
    return formatPercent(value, 1)
  if (key === 'avg_value' || key === 'max_value')
    return formatMetric(value, unit)
  return formatNumber(value, 2)
}

/** 证据 JSON 的缩进渲染：数值按 判据字段 / metric_key 单位格式化，字符串仍带 JSON 引号 */
function renderEvidence(value: unknown, pad: string): string {
  if (value === null || value === undefined)
    return 'null'
  if (typeof value === 'number')
    return formatNumber(value, 2)
  if (typeof value === 'string')
    return JSON.stringify(value)
  if (typeof value === 'boolean')
    return String(value)
  if (Array.isArray(value)) {
    if (value.length === 0)
      return '[]'
    const inner = value.map(item => `${pad}  ${renderEvidence(item, `${pad}  `)}`).join(',\n')
    return `[\n${inner}\n${pad}]`
  }
  const obj = value as Record<string, unknown>
  const entries = Object.entries(obj)
  if (entries.length === 0)
    return '{}'
  const unit = evidenceUnit(obj.metric_key)
  const inner = entries.map(([key, item]) => {
    const text = typeof item === 'number'
      ? evidenceNumber(key, item, unit)
      : renderEvidence(item, `${pad}  `)
    return `${pad}  ${JSON.stringify(key)}: ${text}`
  }).join(',\n')
  return `{\n${inner}\n${pad}}`
}

/** 证据 JSON 原文（evidence 为 JSON 列，结构任意；空值返回空串不渲染） */
export function evidenceText(evidence: unknown): string {
  if (evidence === null || evidence === undefined)
    return ''
  try {
    return renderEvidence(evidence, '')
  }
  catch {
    return String(evidence)
  }
}

/** 一步的展示视图（缺失的步骤补 unknown 占位，保证四行顺序恒定） */
export interface DiagnosisStepView {
  step: string
  name: string
  verdict: string
  summary: string
  evidence: unknown
  issueId: string
  diagnosisId: string
}

export function buildStepViews(rows: DiagnosisRow[]): DiagnosisStepView[] {
  return DIAGNOSIS_STEPS.map((step) => {
    const row = rows.find(r => r.step === step)
    if (!row) {
      return {
        step,
        name: stepNameText(step),
        verdict: 'unknown',
        summary: '该步骤暂无诊断记录（指标回填完成后平台自动执行四步诊断）。',
        evidence: null,
        issueId: '',
        diagnosisId: '',
      }
    }
    return {
      step,
      name: stepNameText(step),
      verdict: row.verdict,
      summary: row.summary,
      evidence: row.evidence ?? null,
      issueId: row.issue_id ?? '',
      diagnosisId: row.id,
    }
  })
}
