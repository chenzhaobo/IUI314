/**
 * 并发基准（111）的 DTO 与展示口径。
 *
 * 后端契约（只读核对）：
 * - `api/src/perf/conc.rs`（7 个路由）
 * - `service/src/perf/conc/profile.rs`（promote / accept / list_profiles / list_baselines / list_results）
 * - `service/src/perf/conc/judge.rs`（阈值与 verdict 取值、reasons 为中文原因数组）
 * - `db/src/perf/entities/perf_conc_{profile,baseline,result}.rs`
 *
 * 与单用户基准的区别：并发 run 不比对 `perf_txn` 基线，只对固化 profile 的并发基线，
 * 且「人工确认才更新」——所以页面上所有更新基线的入口都带二次确认。
 */
import { EMPTY_TEXT, formatMetric } from '@/utils/perfFormat'

// ── 模式 ────────────────────────────────────────────

/** 基准模式：单用户（默认，行为不变）| 并发（固定并发 + 固定时长 + 固定硬件档位） */
export type BenchMode = 'single' | 'concurrent'

/** `perf_task.bench_mode` / `perf_test_plan.bench_mode` 的取值（后端 VARCHAR(16)） */
export const BENCH_MODE_SINGLE: BenchMode = 'single'
export const BENCH_MODE_CONCURRENT: BenchMode = 'concurrent'

// ── profile（脚本的固化执行条件，一个脚本最多一条生效）──

export interface ConcProfile {
  id: string
  script_id: string
  env_id: string
  /** 固定并发（平台下发 -Jthreads） */
  threads: number
  /** 爬坡秒数（-Jrampup） */
  rampup_sec: number
  /** 稳态窗口秒数（-Jduration = rampup_sec + steady_sec） */
  steady_sec: number
  hw_profile_id: string
  /** 冗余硬件签名，判定比对直接用（环境快照签名不一致即 not_comparable） */
  hw_signature: string
  source_run_id: string
  create_by: string
  created_at?: string | null
  updated_at?: string | null
  deleted_at?: string | null
}

/** `profile/list` 行：profile + 脚本名 + 基线事务数 */
export interface ConcProfileRow extends ConcProfile {
  script_name?: string | null
  baseline_txn_count: number
}

// ── 并发基线（逐事务，人工确认才更新）────────────────

export interface ConcBaselineRow {
  id: string
  profile_id: string
  txn_code: string
  p95_ms: number
  avg_ms: number
  tps: number
  /** 0~100 的百分数（不是 0~1 的 ratio） */
  error_pct: number
  /** 稳态窗口容器 cpu_cores 之和 / 事务总 TPS；没采到指标为 null */
  cpu_per_tps?: number | null
  source_run_id: string
  confirmed_by: string
  confirmed_at: string
}

// ── 判定结果（每个并发 run 逐事务一行）────────────────

export type ConcVerdict = 'ok' | 'degraded' | 'failed' | 'no_baseline' | 'not_comparable'

export interface ConcResultRow {
  id: string
  run_id: string
  profile_id: string
  txn_code: string
  p95_ms: number
  avg_ms: number
  tps: number
  /** 0~100 的百分数（不是 0~1 的 ratio） */
  error_pct: number
  cpu_per_tps?: number | null
  /** ok | degraded | failed | no_baseline | not_comparable */
  verdict: string
  /** 中文原因字符串数组（后端 JSONB；空数组表示无原因） */
  reasons: unknown
  created_at: string
}

/** `promote` / `baseline/accept` 的返回 */
export interface ConcTxnOutcome {
  profile_id: string
  txn_count: number
}

/** 分页壳（后端 `ListData<T>`） */
export interface PageList<T> {
  list: T[]
  total: number
  total_pages: number
  page_num: number
}

/** 下拉/单选选项（并发模块自足，不跨模块借静态扫描的类型） */
export interface ConcOption<T extends string = string> {
  label: string
  value: T
}

// ── 展示口径 ────────────────────────────────────────

export function benchModeText(mode?: string | null): string {
  return mode === BENCH_MODE_CONCURRENT ? '并发基准' : '单用户基准'
}

const VERDICT_TEXT: Record<string, string> = {
  ok: '达标',
  degraded: '退化',
  failed: '失败',
  no_baseline: '无基线',
  not_comparable: '不可比',
}

/** 结论文案（未知取原值，避免后端新增取值时页面空白） */
export function verdictText(verdict?: string | null): string {
  if (!verdict)
    return EMPTY_TEXT
  return VERDICT_TEXT[verdict] ?? verdict
}

/** 结论标签色：ok 绿 / degraded 橙 / failed 红 / no_baseline 灰 / not_comparable 紫 */
export function verdictColor(verdict?: string | null): string {
  switch (verdict) {
    case 'ok':
      return 'green'
    case 'degraded':
      return 'orange'
    case 'failed':
      return 'red'
    case 'no_baseline':
      return 'gray'
    case 'not_comparable':
      return 'purple'
    default:
      return 'gray'
  }
}

/**
 * 退化原因逐条化。后端 `reasons` 是 JSONB，正常是字符串数组；
 * 读到非数组（历史脏值 / 未预期形状）时原样折成一行，不静默丢信息。
 */
export function concReasons(raw: unknown): string[] {
  if (Array.isArray(raw))
    return raw.map(r => (typeof r === 'string' ? r : JSON.stringify(r)))
  if (raw === null || raw === undefined || raw === '')
    return []
  if (typeof raw === 'string')
    return [raw]
  return [JSON.stringify(raw)]
}

/** 硬件签名短码（profile 摘要与列表用；完整签名放 tooltip） */
export function hwShort(signature?: string | null): string {
  if (!signature)
    return EMPTY_TEXT
  return signature.slice(0, 8)
}

/** run / id 短码（列表窄列与二次确认文案用；完整值放 tooltip） */
export function idShort(id?: string | null): string {
  if (!id)
    return EMPTY_TEXT
  return id.length > 10 ? id.slice(0, 8) : id
}

/** profile 固化条件摘要：并发数、爬坡+稳态、硬件签名短码 */
export function profileSummary(profile?: ConcProfile | null): string {
  if (!profile)
    return '未固化并发 profile'
  return `${profile.threads} 并发 · 爬坡 ${profile.rampup_sec}s + 稳态 ${profile.steady_sec}s · 硬件 ${hwShort(profile.hw_signature)}`
}

/**
 * 错误率格式化：后端 `error_pct` 是 0~100 的百分数，而 `formatMetric` 的
 * `ratio` 口径按 0~1 处理（×100），所以先折成 ratio 再走统一格式化，避免出现 "150%"
 * 这种把 1.5% 放大一百倍的显示。
 */
export function fmtErrorPct(value?: number | null): string {
  if (value === null || value === undefined || !Number.isFinite(value))
    return EMPTY_TEXT
  return formatMetric(value / 100, 'ratio')
}

/** cpu_per_tps：统一走 formatMetric 的默认口径（最多 2 位小数、去尾随 0） */
export function fmtCpuPerTps(value?: number | null): string {
  return formatMetric(value)
}

/** 毫秒 / TPS 的统一格式化（p95、均值、TPS 列共用） */
export function fmtMs(value?: number | null): string {
  return formatMetric(value, 'ms')
}

export function fmtTps(value?: number | null): string {
  return formatMetric(value, 'tps')
}
