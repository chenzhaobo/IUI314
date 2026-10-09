/**
 * 摸底压测页的 DTO 与展示口径。
 *
 * 后端契约（已合入 `ttp-ro-be-aac3@aac3cac6`）：
 * `service/src/perf/observe/probe.rs`（`CreateProbeReq` / `ProbePlanView` / `OverrideReq`）、
 * `service/src/perf/observe/probe_logic.rs`（`ProbeState` / `StageRecord` / `Knee`）、
 * `service/src/perf/script/probe_conformance.rs`（`ConformanceReport`）。
 */

// ── 硬件档位 ────────────────────────────────────────

/** 档位内的一次硬件变更（`changes` 元素；replicas 与 container 至少一项） */
export interface HwChange {
  binding_id: string
  replicas?: number | null
  container?: string
  cpu?: string
  memory?: string
}

/** 单个硬件档位定义 */
export interface HwProfile {
  label: string
  changes: HwChange[]
}

// ── 计划 ────────────────────────────────────────────

/** `GET /perf/observe/probe/list|get` 行 */
export interface ProbePlanView {
  id: string
  name: string
  env_id: string
  env_name?: string | null
  script_id: string
  script_name?: string | null
  load_node_id?: string | null
  /** 目标 TPS；null = 倍增模式（从 10 起 ×2 上探） */
  target_tps?: number | null
  k_factor: number
  probe_threads: number
  rampup_sec: number
  steady_sec: number
  stability_sec: number
  max_threads: number
  hw_profiles: HwProfile[]
  status: string
  current_hw_index: number
  /** probe | estimate | verify | refine | stability | done | failed */
  current_step: string
  state?: ProbeStateView | null
  overrides?: OverrideEntry[] | null
  result?: ProbeResultView | null
  error?: string | null
  created_by: string
  created_at: string
  updated_at?: string | null
}

/** 创建请求（`POST /perf/observe/probe/create`） */
export interface CreateProbePayload {
  name: string
  env_id: string
  script_id: string
  load_node_id?: string
  target_tps?: number
  k_factor?: number
  probe_threads?: number
  rampup_sec?: number
  steady_sec?: number
  stability_sec?: number
  max_threads?: number
  hw_profiles?: HwProfile[]
}

/** 下一档并发改写（`POST /perf/observe/probe/override`） */
export interface OverridePayload {
  plan_id: string
  next_threads: number
  by?: string
}

/** 覆盖条目（`overrides` 元素） */
export interface OverrideEntry {
  at?: string | null
  by?: string | null
  next_threads: number
  consumed?: boolean | null
}

// ── 状态机状态（落 `perf_probe_plan.state`）─────────

export interface ProbeCfgView {
  probe_threads: number
  max_threads: number
  target_tps?: number | null
  k_factor: number
  hw_count: number
}

export interface HwMetaView {
  label: string
  hw_profile_id?: string | null
  /** {workload: 副本数} */
  replicas: Record<string, number>
  snapshot_id?: string | null
}

export interface HwProgressView {
  /** probe | verify | escalate | refine | stability | done | failed */
  phase: string
  p95_probe?: number | null
  rt_probe_ms?: number | null
  estimated_n?: number | null
  verify_queue: number[]
  verify_pos: number
  a?: number | null
  b?: number | null
  knee?: number | null
  stable?: boolean | null
  /** [tps, p95_ms] */
  a_stats?: [number, number] | null
  stability_rounds: number
  stages: StageRecordView[]
  retry_pending: boolean
  fail_reason?: string | null
}

export interface ProbeStateView {
  cfg: ProbeCfgView
  hw_index: number
  progress: HwProgressView
  hw_meta: HwMetaView[]
  overrides_consumed: number
  pending_overrides: OverrideEntry[]
}

// ── 结果（落 `perf_probe_plan.result`）───────────────

/** 单档记录（错误重跑会记两行，第二行 retried=true） */
export interface StageRecordView {
  run_id?: string | null
  threads: number
  /** probe | stage | stability */
  kind: string
  tps: number
  p95_ms: number
  errors: number
  ok: boolean
  retried: boolean
}

export interface KneeView {
  threads: number
  tps: number
  p95_ms: number
  stable: boolean
  per_replica_tps?: number | null
}

/** 拐点档的资源限制条件（缺数据时只给 notes，不猜） */
export interface HwLimitsView {
  throttled: boolean
  throttle_max?: number | null
  oomkilled: boolean
  middleware_saturated: boolean
  notes: string[]
}

export interface HwResultView {
  label: string
  hw_profile_id?: string | null
  /** {workload: 副本数} */
  replicas: Record<string, number>
  stages: StageRecordView[]
  knee: KneeView
  limits: HwLimitsView
}

/** 曲线 2 的一行：各硬件档位的最优 TPS */
export interface Curve2Row {
  label: string
  knee_tps: number
  replicas_total: number
  per_replica_tps?: number | null
}

export interface RestoreItemView {
  binding_id: string
  workload: string
  /** scale | patch_limits */
  action: string
  ok: boolean
  detail: string
}

export interface RestoreView {
  ok: boolean
  items: RestoreItemView[]
}

export interface ProbeResultView {
  plan_id: string
  target_tps?: number | null
  k_factor: number
  hw: HwResultView[]
  curve2: Curve2Row[]
  /** 未改硬件时为 `{ok:true, items:[]}`；改过则等 `restore_hw` 回填，回填前为 null */
  restore?: RestoreView | null
}

// ── 脚本规范校验 ────────────────────────────────────

export interface ConformanceIssue {
  thread_group: string
  field: string
  actual: string
  expected: string
}

/** `GET /perf/observe/probe/conformance` 响应（script-spec §1） */
export interface ConformanceReport {
  ok: boolean
  issues: ConformanceIssue[]
}

// ── 展示口径 ────────────────────────────────────────

const STATUS_TEXT: Record<string, string> = {
  pending: '排队中',
  running: '执行中',
  done: '已完成',
  failed: '失败',
  cancelled: '已取消',
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'gray',
  running: 'blue',
  done: 'green',
  failed: 'red',
  cancelled: 'gray',
}

export function planStatusText(status: string): string {
  return STATUS_TEXT[status] ?? status
}

export function planStatusColor(status: string): string {
  return STATUS_COLOR[status] ?? 'gray'
}

/** 阶段顺序（时间线用） */
export const PHASE_FLOW = ['probe', 'estimate', 'verify', 'refine', 'stability', 'done'] as const

const PHASE_TEXT: Record<string, string> = {
  probe: '探针档',
  estimate: '并发估算',
  verify: '验证 / 上探',
  escalate: '上探',
  refine: '拐点细分',
  stability: '稳定性确认',
  done: '完成',
  failed: '失败',
}

export function phaseText(phase?: string | null): string {
  if (!phase)
    return '—'
  return PHASE_TEXT[phase] ?? phase
}

/** 进度摘要（`state.progress`）：阶段 + 上探队列位置 + 拟合 + 重跑标记 */
export function progressText(progress?: HwProgressView | null): string {
  if (!progress)
    return '—'
  const parts = [phaseText(progress.phase)]
  const queue = progress.verify_queue ?? []
  if (queue.length > 0)
    parts.push(`上探队列 ${progress.verify_pos}/${queue.length}`)
  if (progress.a != null && progress.b != null)
    parts.push(`p95 拟合 a=${progress.a} b=${progress.b}`)
  if (progress.knee != null)
    parts.push(`拐点并发 ${progress.knee}`)
  if (progress.retry_pending)
    parts.push('错误重跑排队中')
  return parts.join(' · ')
}

/** `current_step` 与 `state.progress.phase` 的口径不同（verify_pos=0 时是 estimate），此处统一取 step */
export function stepText(step: string): string {
  return phaseText(step)
}

export function stageKindText(kind: string): string {
  if (kind === 'probe')
    return '探针'
  if (kind === 'stability')
    return '稳定性'
  return '验证'
}

/** 计划是否已结束（终态不可取消 / 改写） */
export function isTerminalStatus(status: string): boolean {
  return status === 'done' || status === 'failed' || status === 'cancelled'
}

/**
 * 当前硬件档位位置（`3/5`）。
 * 档位总数优先取状态机里的 `cfg.hw_count`（无档位定义时后端也按 1 档算），
 * 状态还没落库时回落到 `hw_profiles` 长度。
 */
export function hwPositionText(plan: Pick<ProbePlanView, 'current_hw_index' | 'hw_profiles' | 'state'>): string {
  const total = Math.max(plan.state?.cfg.hw_count ?? plan.hw_profiles?.length ?? 0, 1)
  const cur = Math.min((plan.current_hw_index ?? 0) + 1, total)
  return `${cur}/${total}`
}

/** 空档位（新建时的一行） */
export function emptyHwChange(): HwChange {
  return { binding_id: '', replicas: null, container: '', cpu: '', memory: '' }
}

export function emptyHwProfile(index: number): HwProfile {
  return { label: `档位 ${index + 1}`, changes: [emptyHwChange()] }
}

/** 提交前裁剪空字段：后端 `hw_profiles` 校验 changes 需有 binding_id，且 replicas / container 至少一项 */
export function normalizeHwProfiles(profiles: HwProfile[]): HwProfile[] {
  return profiles
    .filter(p => p.changes.some(c => c.binding_id.trim()))
    .map(p => ({
      label: p.label.trim(),
      changes: p.changes
        .filter(c => c.binding_id.trim())
        .map(c => ({
          binding_id: c.binding_id,
          replicas: c.replicas ?? null,
          // 空串一律转 undefined：JSON 里字段直接消失，后端按 None 处理
          container: c.container?.trim() || undefined,
          cpu: c.cpu?.trim() || undefined,
          memory: c.memory?.trim() || undefined,
        })),
    }))
}

/**
 * 档位表的行：同并发多次（错误重跑）时按出现顺序保留，便于看到「重跑」标记。
 * `rowKey` 用「档位下标-行下标」：run_id 在重跑行与未落盘行上可能缺失或重复，
 * 不能直接当表格 row-key。
 */
export function stageRows(result: ProbeResultView | null | undefined): Array<StageRecordView & { hwLabel: string, rowKey: string }> {
  const rows: Array<StageRecordView & { hwLabel: string, rowKey: string }> = []
  for (const [hi, hw] of (result?.hw ?? []).entries()) {
    for (const [si, stage] of (hw.stages ?? []).entries()) {
      rows.push({ ...stage, hwLabel: hw.label, rowKey: `${hi}-${si}` })
    }
  }
  return rows
}

/** 恢复动作文案（`restore_hw` 只有这两个动作） */
export function restoreActionText(action: string): string {
  if (action === 'scale')
    return '恢复副本数'
  if (action === 'patch_limits')
    return '恢复 limits'
  return action
}

/** 拐点限制条件提示文案（spec R11.7：限流 / OOM / 中间件饱和） */
export function limitHits(limits: HwLimitsView): string[] {
  const hits: string[] = []
  if (limits.throttled)
    hits.push(`CPU 限流（峰值 ${limits.throttle_max ?? '?'}）`)
  if (limits.oomkilled)
    hits.push('发生 OOMKilled')
  if (limits.middleware_saturated)
    hits.push('中间件先饱和')
  return hits
}
