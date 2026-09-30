/**
 * 指标模板页的 DTO 与展示口径。
 *
 * 后端契约（已合入 `ttp-ro-be-aac3@aac3cac6`）：
 * `service/src/perf/observe/query.rs`（`TemplatesList` / `TemplateEditReq` / `TemplateAddReq`）
 * 与迁移 `migration/data/m20261001_000103_perf_observe_metrics/up.sql` 的
 * `perf_metric_template` 表（内置 16 条为 builtin，只可停用不可删）。
 */

export interface MetricTemplateRow {
  id: string
  /** container | jvm | postgresql | redis | host */
  service_type: string
  metric_key: string
  display_name: string
  /** 占位符：{{namespace}} {{pod_re}} {{instance}} {{env_label}} {{app}} */
  promql_tpl: string
  unit: string
  /** avg | max | p95 | sum | last（展示口径） */
  agg: string
  /** container | host_middleware（决定用哪个 Prometheus） */
  prom_purpose: string
  enabled: boolean
  /** builtin | custom */
  source: string
  sort: number
  remark?: string | null
  updated_at?: string | null
}

/** 编辑：只允许改这四个字段（+ 删除标记） */
export interface TemplateEditPayload {
  id: string
  display_name?: string
  promql_tpl?: string
  enabled?: boolean
  remark?: string
  deleted?: boolean
}

/** 新增（source 由后端固定 custom） */
export interface TemplateAddPayload {
  service_type: string
  metric_key: string
  display_name: string
  promql_tpl: string
  unit: string
  agg: string
  prom_purpose: string
  remark?: string
  sort?: number
}

/**
 * 编辑 / 新增共用的表单模型。
 * 编辑模式下 service_type / metric_key / unit / agg / prom_purpose 是身份字段，
 * 后端 `TemplateEditReq` 不接受它们，界面里只读；新增模式下全部可填。
 */
export interface TemplateForm {
  id: string
  service_type: string
  metric_key: string
  display_name: string
  promql_tpl: string
  unit: string
  agg: string
  prom_purpose: string
  enabled: boolean
  remark: string
  sort: number
}

export function blankTemplateForm(): TemplateForm {
  return {
    id: '',
    service_type: 'container',
    metric_key: '',
    display_name: '',
    promql_tpl: '',
    unit: 'core',
    agg: 'avg',
    prom_purpose: 'container',
    enabled: true,
    remark: '',
    sort: 0,
  }
}

// ── 枚举与文案 ──────────────────────────────────────

export const SERVICE_TYPE_OPTIONS = [
  { label: '容器', value: 'container' },
  { label: 'JVM', value: 'jvm' },
  { label: 'PostgreSQL', value: 'postgresql' },
  { label: 'Redis', value: 'redis' },
  { label: '主机', value: 'host' },
]

export const UNIT_OPTIONS = ['core', 'byte', 'ratio', 'count', 'flag', 'ms'].map(v => ({ label: v, value: v }))

export const AGG_OPTIONS = [
  { label: '均值', value: 'avg' },
  { label: '峰值', value: 'max' },
  { label: 'P95', value: 'p95' },
  { label: '求和', value: 'sum' },
  { label: '末值', value: 'last' },
]

export const PROM_PURPOSE_OPTIONS = [
  { label: '容器（K8s 指标）', value: 'container' },
  { label: '主机 / 中间件（PMM）', value: 'host_middleware' },
]

export function serviceTypeText(value: string): string {
  return SERVICE_TYPE_OPTIONS.find(o => o.value === value)?.label ?? value
}

export function aggText(value: string): string {
  return AGG_OPTIONS.find(o => o.value === value)?.label ?? value
}

export function promPurposeText(value: string): string {
  return PROM_PURPOSE_OPTIONS.find(o => o.value === value)?.label ?? value
}

/** 内置模板只可停用，不可删除（后端也会拒绝，这里提前禁用按钮） */
export function isBuiltin(row: Pick<MetricTemplateRow, 'source'>): boolean {
  return row.source === 'builtin'
}

/** 表格行：`groupStart` 标记 service_type 分组的第一行，只在它上面渲染分组名 */
export interface TemplateTableRow extends MetricTemplateRow {
  groupStart: boolean
}

export function withGroupStart(rows: MetricTemplateRow[]): TemplateTableRow[] {
  return rows.map((row, i) => ({
    ...row,
    groupStart: i === 0 || rows[i - 1].service_type !== row.service_type,
  }))
}
