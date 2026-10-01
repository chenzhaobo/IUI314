/**
 * 批次观测抽屉的 DTO 与展示口径。
 *
 * 后端契约（已合入 `ttp-ro-be-final@dbf4f25d`）：
 * `service/src/perf/observe/query.rs` 的 `TaskResourceView`（`runs` / `series` / `windows`）
 * 与 `service/src/perf/observe/rerun.rs` 的 `TaskRerunView`；
 * 取证跑见文件末尾（`flame.rs::start_evidence`，已核对）。
 *
 * `WorkloadRankRow` 的取值有两层「无」：**键缺失** = 该 run 没有这一行指标；
 * **键值为 null** = 有指标行但值为 NULL。前端统一按「无数据」展示。
 */

/** 排行行里的一个 workload */
export interface WorkloadRankRow {
  confidence?: string | null
  cpu_avg?: number | null
  cpu_max?: number | null
  cpu_net?: number | null
  mem_max?: number | null
  sample_count?: number | null
  throttle_ratio?: number | null
  workload: string
}

/** 一个 run 的 workload 汇总 */
export interface RunRankRow {
  max_net_cpu?: number | null
  run_id: string
  script_id: string
  script_name?: string | null
  workloads: WorkloadRankRow[]
}

/** run 执行窗口（批次曲线上标区间用） */
export interface RunWindow {
  exec_finished_at?: string | null
  exec_started_at?: string | null
  run_id: string
}

/** `perf_run_metric_series` 行：批次级降采样曲线 */
export interface PerfRunMetricSeriesRow {
  id: string
  task_id?: string | null
  run_id?: string | null
  target_ref: string
  metric_key: string
  unit: string
  step_seconds: number
  /** [[ts_ms, value], ...] */
  points: Array<[number, number]>
  created_at: string
}

/** `GET /perf/observe/task/resource` 响应 */
export interface TaskResourceView {
  runs: RunRankRow[]
  series: PerfRunMetricSeriesRow[]
  task_id: string
  windows: RunWindow[]
}

/** 单脚本复跑裁决 */
export interface RerunDecisionView {
  script_id: string
  script_name?: string | null
  origin_run_id: string
  best_run_id?: string | null
  rounds: number
  /** pending | confirmed_regression | env_fluctuation */
  verdict: string
  detail?: Record<string, unknown> | null
}

/** `GET /perf/observe/task/rerun` 响应 */
export interface TaskRerunView {
  /** filling | rerunning | env_suspect | done */
  observe_state?: string | null
  env_suspect_reason?: string | null
  decisions: RerunDecisionView[]
}

// ── 展示口径 ────────────────────────────────────────

const OBSERVE_STATE_TEXT: Record<string, string> = {
  filling: '指标填充中',
  rerunning: '自动复跑中',
  env_suspect: '疑似环境异常',
  done: '观测完成',
}

const OBSERVE_STATE_COLOR: Record<string, string> = {
  filling: 'blue',
  rerunning: 'orange',
  env_suspect: 'red',
  done: 'green',
}

export function observeStateText(state?: string | null): string {
  if (!state)
    return '未开始观测'
  return OBSERVE_STATE_TEXT[state] ?? state
}

export function observeStateColor(state?: string | null): string {
  if (!state)
    return 'gray'
  return OBSERVE_STATE_COLOR[state] ?? 'gray'
}

/** 裁决结论中文（spec R9.5：3 轮后仍不合格 = 确认腐化） */
export function verdictText(verdict: string): string {
  if (verdict === 'confirmed_regression')
    return '确认腐化'
  if (verdict === 'env_fluctuation')
    return '环境波动'
  if (verdict === 'pending')
    return '进行中'
  return verdict
}

export function verdictColor(verdict: string): string {
  if (verdict === 'confirmed_regression')
    return 'red'
  if (verdict === 'env_fluctuation')
    return 'green'
  return 'blue'
}

/** 排行行上要展示的指标：取净 CPU 最大的那个部署（后端排序口径一致） */
export function mainWorkload(row: RunRankRow): WorkloadRankRow | undefined {
  return row.workloads[0]
}

/** 批次曲线按 metric_key 分组，一组一张图 */
export interface SeriesGroup {
  metricKey: string
  unit: string
  series: Array<{ name: string, unit: string, points: Array<[number, number]> }>
}

export function groupSeries(rows: PerfRunMetricSeriesRow[]): SeriesGroup[] {
  const map = new Map<string, SeriesGroup>()
  for (const row of rows) {
    let group = map.get(row.metric_key)
    if (!group) {
      group = { metricKey: row.metric_key, unit: row.unit, series: [] }
      map.set(row.metric_key, group)
    }
    group.series.push({ name: row.target_ref, unit: row.unit, points: row.points ?? [] })
  }
  return [...map.values()]
}

/** 曲线图的标题（键 → 中文） */
const METRIC_TITLE: Record<string, string> = {
  cpu_cores: 'CPU（核）',
  mem_ws_bytes: '内存工作集（字节）',
  throttle_ratio: 'CPU 限流比例',
}

export function metricTitle(key: string): string {
  return METRIC_TITLE[key] ?? key
}

/** RFC3339 / 时间字符串 → ms（markArea 的 time 轴用） */
export function toMs(value?: string | null): number | null {
  if (!value)
    return null
  const ms = Date.parse(value)
  return Number.isNaN(ms) ? null : ms
}

/** 取证事件（后端 `FLAME_EVENTS` 全集；基准回归取证默认 wall） */
export const EVIDENCE_EVENTS = [
  { label: 'wall（墙钟，基准回归默认）', value: 'wall' },
  { label: 'cpu', value: 'cpu' },
  { label: 'alloc', value: 'alloc' },
  { label: 'lock', value: 'lock' },
  { label: 'itimer', value: 'itimer' },
]

/** 取证跑请求体（后端 `EvidenceReq`：event 缺省 wall，非法值报错） */
export interface EvidenceRunPayload {
  run_id: string
  event: string
}

/** 排行行在表格里要展示的指标（取净 CPU 最大的那个部署，与后端排序口径一致） */
export function rowMetrics(row: RunRankRow) {
  const w = mainWorkload(row)
  return {
    netCpu: w?.cpu_net ?? null,
    maxCpu: w?.cpu_max ?? null,
    memMax: w?.mem_max ?? null,
    throttle: w?.throttle_ratio ?? null,
    sampleCount: w?.sample_count ?? null,
    confidence: w?.confidence ?? '',
  }
}

/** 复跑结论排序：进行中 > 确认腐化 > 环境波动，同级看轮数（多的在前） */
export function sortDecisions(view: TaskRerunView | null): RerunDecisionView[] {
  const order: Record<string, number> = { pending: 0, confirmed_regression: 1, env_fluctuation: 2 }
  return [...(view?.decisions ?? [])].sort((a, b) => {
    const oa = order[a.verdict] ?? 9
    const ob = order[b.verdict] ?? 9
    if (oa !== ob)
      return oa - ob
    if (a.rounds !== b.rounds)
      return b.rounds - a.rounds
    return a.script_id < b.script_id ? -1 : 1
  })
}
