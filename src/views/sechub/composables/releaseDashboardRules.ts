/**
 * 「质量看板 / 发版检查」的纯规则：比率与目标线文案、KPI 卡、结论与状态映射、阻塞归类。
 *
 * 独立成模块（同 `releaseCoverageRules.ts`）是为了能脱离 Vue / 请求层单测；
 * 只允许 `import type`，避免编译到 node:test 时引入 `@` 别名与运行时依赖。
 */
import type {
  ReleaseConclusion,
  ReleaseCoverageMetrics,
  ReleaseExecutionMetrics,
  ReleaseIssueInputs,
  ReleaseTargetCheck,
  ReleaseTargetKey,
} from '@/types/sechub-release'

/** 结论展示：阻断红 / 有风险黄 / 通过绿 */
export interface ConclusionMeta {
  key: string
  label: string
  color: string
}

/** 指标着色：ok 绿 / bad 红 / muted 灰 */
export type MetricTone = 'ok' | 'bad' | 'muted'

/** KPI 卡（看板顶部 6 个指标） */
export interface KpiCard {
  key: string
  label: string
  value: string
  hint: string
  tone: MetricTone
  /** 「目标 ≥ 90.0%」/「未设目标线」 */
  target: string
}

/** 比率文案：1 位小数百分比；null 显示 `-` */
export function rateText(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value))
    return '-'
  return `${(value * 100).toFixed(1)}%`
}

/** 结论的中文名与 Arco Tag 颜色；未知值兜底「未评估」 */
export function conclusionMeta(value: string | null | undefined): ConclusionMeta {
  switch ((value ?? '').trim()) {
    case 'blocked':
      return { key: 'blocked', label: '阻断', color: 'red' }
    case 'risky':
      return { key: 'risky', label: '有风险', color: 'orange' }
    case 'passed':
      return { key: 'passed', label: '通过', color: 'green' }
    default:
      return { key: '', label: '未评估', color: 'gray' }
  }
}

/** 目标线着色：达标绿 / 未达标红 / 无判定灰 */
export function targetTone(check: ReleaseTargetCheck | undefined | null): MetricTone {
  if (!check || check.met === null || check.met === undefined)
    return 'muted'
  return check.met ? 'ok' : 'bad'
}

/** 目标值是否为比率（其余按整数计数展示） */
const RATE_TARGET_KEYS: readonly ReleaseTargetKey[] = ['new_coverage', 'exec_rate', 'new_minimal', 'block_rate']

/** 目标方向为「≤」的键（其余为「≥」） */
const AT_MOST_TARGET_KEYS: readonly ReleaseTargetKey[] = ['open_high_defects', 'new_high_config', 'block_rate']

function targetValueText(key: ReleaseTargetKey, value: number): string {
  return RATE_TARGET_KEYS.includes(key) ? rateText(value) : String(Math.round(value))
}

/** 目标线文案：「目标 ≥ 90.0%」/「目标 ≤ 0」/「未设目标线」 */
export function targetText(check: ReleaseTargetCheck | undefined | null): string {
  if (!check || check.target === null || check.target === undefined)
    return '未设目标线'
  const operator = AT_MOST_TARGET_KEYS.includes(check.key) ? '≤' : '≥'
  return `目标 ${operator} ${targetValueText(check.key, check.target)}`
}

/** 6 个 KPI：实际值取比例 / 问题数据，目标线按 key 匹配 `targets[]` */
export function buildKpiCards(
  coverage: ReleaseCoverageMetrics,
  execution: ReleaseExecutionMetrics,
  issues: ReleaseIssueInputs,
  targets: ReleaseTargetCheck[],
): KpiCard[] {
  const byKey = new Map(targets.map(check => [check.key, check]))
  const lines: Array<{ key: string, label: string, value: string, hint: string, targetKey: ReleaseTargetKey | null }> = [
    {
      key: 'coverage',
      label: '接口覆盖率',
      value: rateText(coverage.coverage_rate),
      hint: `已覆盖 ${coverage.covered}，免测 ${coverage.exempt}`,
      targetKey: null,
    },
    {
      key: 'new_coverage',
      label: '新增接口覆盖率',
      value: rateText(coverage.new_coverage_rate),
      hint: `新增已覆盖 ${coverage.new_covered}，新增免测 ${coverage.new_exempt}`,
      targetKey: 'new_coverage',
    },
    {
      key: 'pass_rate',
      label: '用例通过率',
      value: rateText(execution.pass_rate),
      hint: `PASS ${execution.verdicts.pass} / 已执行 ${execution.executed}`,
      targetKey: null,
    },
    {
      key: 'block_rate',
      label: '阻塞率',
      value: rateText(execution.block_rate),
      hint: `BLOCKED ${execution.verdicts.blocked} / 已执行 ${execution.executed}`,
      targetKey: 'block_rate',
    },
    {
      key: 'open_high_defects',
      label: '未关闭高危缺陷',
      value: String(issues.open_high_defects),
      hint: `未关闭缺陷共 ${issues.open_defects} 个`,
      targetKey: 'open_high_defects',
    },
    {
      key: 'new_high_config',
      label: '本迭代新增高危配置',
      value: String(issues.new_high_config_open),
      hint: `存量高危配置未处理 ${issues.legacy_high_config_open} 个`,
      targetKey: 'new_high_config',
    },
  ]
  return lines.map((line) => {
    const check = line.targetKey ? byKey.get(line.targetKey) : undefined
    return {
      key: line.key,
      label: line.label,
      value: line.value,
      hint: line.hint,
      tone: targetTone(check),
      target: targetText(check),
    }
  })
}

/** 阻塞归类的中文标签（与 metrics::block_reason_label 一致） */
const BLOCK_REASON_LABELS: Record<string, string> = {
  env: '环境不可达或服务未部署',
  auth_603: '第三方应用授权',
  contract: '接口契约不符(404/405)',
  data: '缺业务数据',
  script: '脚本异常',
  other: '其他',
}

export interface BlockReasonRow {
  code: string
  label: string
  count: number
}

/** 阻塞原因汇总：接口数倒序、同数按归类编码升序；未知归类回退编码 */
export function blockReasonRows(reasons: Record<string, number> | undefined | null): BlockReasonRow[] {
  if (!reasons)
    return []
  return Object.entries(reasons)
    .map(([code, count]) => ({ code, label: BLOCK_REASON_LABELS[code] ?? code, count }))
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code))
}

/** Agent 总耗时（分钟，1 位小数）；负数视为无效 */
export function agentMinutesText(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || ms < 0 || Number.isNaN(ms))
    return '-'
  return (ms / 60_000).toFixed(1)
}

/** 距迭代结束：已结束 N 天 / 今天结束 / 剩余 N 天 */
export function daysLeftText(days: number | null | undefined): string {
  if (days === null || days === undefined || Number.isNaN(days))
    return '-'
  if (days < 0)
    return `已结束 ${-days} 天`
  if (days === 0)
    return '今天结束'
  return `剩余 ${days} 天`
}

/** 套件运行状态（sec_sec_run.status） */
const RUN_STATUS_META: Record<string, { label: string, color: string }> = {
  pending: { label: '待执行', color: 'gray' },
  running: { label: '运行中', color: 'blue' },
  success: { label: 'PASS', color: 'green' },
  failed: { label: 'FAIL', color: 'red' },
  partial: { label: '部分通过', color: 'orange' },
  cancelled: { label: '已取消', color: 'gray' },
}

export function runStatusMeta(status: string | null | undefined): { label: string, color: string } {
  const key = (status ?? '').trim()
  if (!key)
    return { label: '--', color: 'gray' }
  return RUN_STATUS_META[key] ?? { label: key, color: 'gray' }
}

/** 回归后 AI 复核状态（D20b：running / succeeded / failed / timeout） */
const REVIEW_STATUS_META: Record<string, { label: string, color: string }> = {
  running: { label: '复核中', color: 'blue' },
  succeeded: { label: '已复核', color: 'green' },
  failed: { label: '复核失败', color: 'red' },
  timeout: { label: '复核超时', color: 'red' },
}

export function reviewStatusMeta(status: string | null | undefined): { label: string, color: string } {
  if (!status)
    return { label: '未复核', color: 'gray' }
  return REVIEW_STATUS_META[status] ?? { label: status, color: 'gray' }
}

/** 套件定时开关（schedule_enabled：'1' 启用） */
export function suiteEnabledText(enabled: string | null | undefined): string {
  return enabled === '1' ? '启用' : '停用'
}

/** 结论是否为发版阻断（避免组件里散落字符串比较） */
export function isBlockedConclusion(value: ReleaseConclusion | string | null | undefined): boolean {
  return (value ?? '').trim() === 'blocked'
}
