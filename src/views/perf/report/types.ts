/**
 * 报告页「资源数据」页签的 DTO 与展示口径。
 *
 * 后端契约（已合入 `ttp-ro-be-aac3@aac3cac6`）：
 * `service/src/perf/observe/query.rs` 的 `RunMetricsView` / `SnapshotView`
 * 与实体 `perf_run_metric` / `perf_txn_resource` / `perf_env_snapshot` / `perf_hw_profile`。
 */

/** `perf_run_metric` 行：一个（目标, 指标）的窗口聚合值 */
export interface PerfRunMetricRow {
  id: string
  run_id: string
  task_id?: string | null
  /** workload | middleware | host */
  target_kind: string
  /** workload 名 / Prometheus 实例标签值 */
  target_ref: string
  metric_key: string
  unit: string
  avg_value?: number | null
  max_value?: number | null
  p95_value?: number | null
  /** 仅 cpu_cores：窗口均值 − 静默期均值 */
  net_value?: number | null
  sample_count: number
  /** high | low */
  confidence: string
  prometheus_id: string
  /** 已替换占位符的 PromQL（可展开复制） */
  promql: string
  collected_at: string
}

/** `perf_txn_resource` 行：单个长事务在某个部署上的 CPU */
export interface PerfTxnResourceRow {
  id: string
  run_id: string
  txn_sample_id: string
  txn_label: string
  txn_start_ms: number
  txn_elapsed_ms: number
  workload: string
  net_cpu?: number | null
  max_cpu?: number | null
  sample_count: number
  /** high | low */
  confidence: string
}

/** run 视图内嵌的快照摘要（不含 workloads 明细） */
export interface SnapshotSummary {
  captured_at: string
  error?: string | null
  hw_label?: string | null
  hw_profile_id?: string | null
  hw_signature: string
  id: string
  warnings?: string[] | null
}

/** 容器限额 */
export interface ContainerLimits {
  cpu?: string | null
  memory?: string | null
}

/** 工作负载快照行（`perf_env_snapshot.workloads` 元素） */
export interface WorkloadSnapshotRow {
  workload: string
  namespace: string
  replicas: number
  ready: number
  updated: number
  images: string[]
  /** {container: {cpu, memory}} */
  limits: Record<string, ContainerLimits>
}

/** `perf_env_snapshot` 行 */
export interface EnvSnapshotRow {
  id: string
  env_id: string
  captured_at: string
  workloads: WorkloadSnapshotRow[]
  idle?: Record<string, number> | null
  warnings?: string[] | null
  hw_signature: string
  hw_profile_id?: string | null
  error?: string | null
}

/** `perf_hw_profile` 行：硬件档位（副本数 + 限额组合） */
export interface HwProfileRow {
  id: string
  env_id: string
  signature: string
  /** {workload: 副本数} */
  replicas: Record<string, number>
  /** {workload: {container: {cpu, memory}}} */
  limits: Record<string, Record<string, ContainerLimits>>
  label?: string | null
  created_at: string
}

/** `GET /perf/observe/snapshot/get` 响应 */
export interface SnapshotView {
  profile?: HwProfileRow | null
  snapshot: EnvSnapshotRow
}

/** `GET /perf/observe/run/metrics` 响应 */
export interface RunMetricsView {
  clock_offset_ms?: number | null
  env_id?: string | null
  env_snapshot_id?: string | null
  exec_finished_at?: string | null
  exec_started_at?: string | null
  hw_profile_id?: string | null
  metrics: PerfRunMetricRow[]
  /** pending | collecting | collected | failed | skipped */
  metrics_state?: string | null
  run_id: string
  script_id: string
  snapshot?: SnapshotSummary | null
  task_id?: string | null
  txn_resources: PerfTxnResourceRow[]
}

/** 事务级资源的入选门槛（spec R8.2：耗时 ≥ 4 秒） */
export const TXN_RESOURCE_MIN_MS = 4000

const METRICS_STATE_TEXT: Record<string, string> = {
  pending: '待采集',
  collecting: '采集中',
  collected: '已采集',
  failed: '采集失败',
  skipped: '已跳过',
}

const METRICS_STATE_COLOR: Record<string, string> = {
  pending: 'gray',
  collecting: 'blue',
  collected: 'green',
  failed: 'red',
  skipped: 'gray',
}

export function metricsStateText(state?: string | null): string {
  if (!state)
    return '状态未知'
  return METRICS_STATE_TEXT[state] ?? state
}

export function metricsStateColor(state?: string | null): string {
  if (!state)
    return 'gray'
  return METRICS_STATE_COLOR[state] ?? 'gray'
}

/** 目标类型中文名 */
export function targetKindText(kind: string): string {
  if (kind === 'workload')
    return '工作负载'
  if (kind === 'middleware')
    return '中间件'
  if (kind === 'host')
    return '主机'
  return kind
}

/** 低置信行：采样点数 < 2（spec R8.3） */
export function isLowConfidence(row: { confidence: string }): boolean {
  return row.confidence === 'low'
}

/** 低置信提示文案（点数必须显示出来） */
export function lowConfidenceTip(row: { sample_count: number }): string {
  return `采样点数 ${row.sample_count}，低置信`
}

/** 指标分组键：同一目标的行聚在一起 */
export function targetGroupKey(row: { target_kind: string, target_ref: string }): string {
  return `${row.target_kind}::${row.target_ref}`
}

/** 快照告警行数（横幅与徽标用） */
export function warningCount(snapshot?: SnapshotSummary | null): number {
  return snapshot?.warnings?.length ?? 0
}

/** 副本摘要：`{workload: n}` → "wl=1, wl2=2" */
export function replicasText(replicas: Record<string, number> | undefined | null): string {
  if (!replicas)
    return '—'
  const parts = Object.entries(replicas).map(([name, n]) => `${name}=${n}`)
  return parts.length ? parts.join('，') : '—'
}

/** 限额摘要：`{workload: {container: {cpu, memory}}}` → "wl[app: 2/4Gi]" */
export function limitsText(limits: Record<string, Record<string, ContainerLimits>> | undefined | null): string {
  if (!limits)
    return '—'
  const parts: string[] = []
  for (const [workload, containers] of Object.entries(limits)) {
    const inner = Object.entries(containers ?? {})
      .map(([name, l]) => `${name}: ${l?.cpu ?? '-'} / ${l?.memory ?? '-'}`)
      .join('，')
    if (inner)
      parts.push(`${workload}[${inner}]`)
  }
  return parts.length ? parts.join('；') : '—'
}
