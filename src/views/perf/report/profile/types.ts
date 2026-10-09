/**
 * 「性能剖析」页签的 DTO 与展示口径。
 *
 * 后端契约（已合入 `ttp-ro-be-final@dbf4f25d`）：
 * `service/src/perf/observe/flame.rs` 的 `FlameVo` / `TopRow` / `DiffRow`
 * 与实体 `perf_run_flame`；差分行结构在 `flame_parse.rs`。
 */

/** 火焰图台账行（`FlameVo`） */
export interface FlameRow {
  id: string
  run_id: string
  app_name: string
  instance_ip: string
  pod_name?: string | null
  /** cpu | alloc | wall | lock | itimer */
  event: string
  sample_seconds: number
  /** 摸底档位标签（仅摸底场景） */
  stage_label?: string | null
  /** evidence | live_anomaly | manual */
  trigger: string
  /** pinned（已定点）| unknown（多实例，无法唯一归属） */
  attribution: string
  /** pending | sampling | archived | failed */
  status: string
  /** 折叠栈可用（差分前置条件） */
  diffable: boolean
  html_bytes?: number | null
  error?: string | null
  created_at?: string | null
  expire_at: string
}

/** 热点方法行（self 为栈顶自耗占比、total 为栈中出现占比，%） */
export interface FlameTopRow {
  frame: string
  self_pct: number
  total_pct: number
}

/** 差分行：占比单位为百分点，delta = cur_pct − base_pct */
export interface FlameDiffRow {
  frame: string
  base_pct: number
  cur_pct: number
  delta: number
}

/** 取证事件（后端 `FLAME_EVENTS` 全集；基准回归取证默认 wall） */
export const FLAME_EVENT_OPTIONS = [
  { label: 'wall（墙钟，默认）', value: 'wall' },
  { label: 'cpu', value: 'cpu' },
  { label: 'alloc', value: 'alloc' },
  { label: 'lock', value: 'lock' },
  { label: 'itimer', value: 'itimer' },
]

const STATUS_TEXT: Record<string, string> = {
  pending: '待采样',
  sampling: '采样中',
  archived: '已归档',
  failed: '失败',
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'gray',
  sampling: 'blue',
  archived: 'green',
  failed: 'red',
}

export function flameStatusText(status: string): string {
  return STATUS_TEXT[status] ?? status
}

export function flameStatusColor(status: string): string {
  return STATUS_COLOR[status] ?? 'gray'
}

const TRIGGER_TEXT: Record<string, string> = {
  evidence: '取证跑',
  live_anomaly: '事中异常',
  manual: '手动',
}

export function flameTriggerText(trigger: string): string {
  return TRIGGER_TEXT[trigger] ?? trigger
}

const EVENT_TEXT: Record<string, string> = {
  wall: 'wall（墙钟）',
}

export function flameEventText(event: string): string {
  return EVENT_TEXT[event] ?? event
}

/** 归因：pinned=单实例可定点；unknown=多实例，结果不代表具体 Pod */
export function attributionText(attribution: string): string {
  return attribution === 'pinned' ? '已定点' : '实例归因不确定'
}

export function attributionColor(attribution: string): string {
  return attribution === 'pinned' ? 'green' : 'orange'
}

export function attributionTip(attribution: string): string {
  return attribution === 'pinned'
    ? '该应用在当前环境只有 1 个实例，火焰图可归属到具体 Pod'
    : '该应用有多个实例，无法唯一归属到 Pod，结论只代表该应用整体'
}

/** 采样时刻（ms；无法解析按 0，仅用于差分方向判定） */
function timeMs(v?: string | null): number {
  if (!v)
    return 0
  const ms = Date.parse(v)
  return Number.isNaN(ms) ? 0 : ms
}

/** 差分方向：勾选两图时按采集时刻取「早=基准 base，晚=对比 cur」 */
export function pickDiffPair(selected: FlameRow[]): { base: FlameRow, cur: FlameRow } | null {
  if (selected.length !== 2)
    return null
  const [a, b] = selected
  return timeMs(a.created_at) <= timeMs(b.created_at) ? { base: a, cur: b } : { base: b, cur: a }
}

/** 差分按钮置灰原因（空串=可点） */
export function diffDisabledReason(selected: FlameRow[]): string {
  if (selected.length !== 2)
    return '差分需勾选两张已归档的火焰图（不可差分的行不可勾选）'
  if (selected.some(r => !r.diffable))
    return '所选火焰图折叠栈不可用（解析失败或已过期清理），无法差分'
  return ''
}

/** 差分结果按 |delta| 降序（后端已排序，这里兜底保证展示口径一致） */
export function sortDiffRows(rows: FlameDiffRow[]): FlameDiffRow[] {
  return [...rows].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
}
