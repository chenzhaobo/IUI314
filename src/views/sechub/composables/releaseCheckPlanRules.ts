/**
 * 「发版检查计划」的纯规则：范围文案、测试项明细、耗时与确认框文案。
 *
 * 独立成模块（同 `releaseDashboardRules.ts`）是为了能脱离 Vue / 请求层单测；
 * 只允许 `import type`，避免编译到 node:test 时引入 `@` 别名与运行时依赖。
 */
import type {
  ReleaseCheckPlanItem,
  ReleaseCheckPlanResponse,
  ReleaseCheckPlanRule,
} from '@/types/sechub-release'

/** 范围一行里的一项 */
export interface PlanRangePart {
  label: string
  value: string
}

/** 计划查询：只带非空产品线 */
export function buildReleasePlanQuery(productLine: string): { product_line?: string } {
  const line = productLine.trim()
  return line ? { product_line: line } : {}
}

function listText(values: string[]): string {
  return values.length ? values.join('、') : '全部'
}

/** 范围一行：产品线 / 环境 / 迭代（剩余天数）/ 产品领域 / 业务领域 / 项目组 */
export function planRangeParts(plan: ReleaseCheckPlanResponse): PlanRangePart[] {
  const env = plan.env?.name ?? (plan.env_error ? '未配置' : '-')
  const iteration = plan.iteration
    ? `${plan.iteration.name}（${plan.iteration.code}）· 剩余 ${plan.iteration.days_left} 天`
    : '-'
  return [
    { label: '产品线', value: plan.product_line || '-' },
    { label: '环境', value: env },
    { label: '迭代', value: iteration },
    { label: '产品领域', value: listText(plan.scope.product_domains) },
    { label: '业务领域', value: listText(plan.scope.business_areas) },
    { label: '项目组', value: listText(plan.scope.project_groups) },
  ]
}

/** 本次会执行 / 不执行的测试项 */
export function includedPlanItems(plan: ReleaseCheckPlanResponse): ReleaseCheckPlanItem[] {
  return plan.items.filter(item => item.included)
}

export function excludedPlanItems(plan: ReleaseCheckPlanResponse): ReleaseCheckPlanItem[] {
  return plan.items.filter(item => !item.included)
}

/** 测试项明细：用例数优先，其次规则编号，最后判定口径 */
export function planItemDetail(item: ReleaseCheckPlanItem): string {
  if (item.case_count !== undefined)
    return item.case_count === null ? '用例数未统计' : `用例 ${item.case_count} 条`
  if (item.rules?.length)
    return `规则 ${item.rules.join('、')}`
  if (item.verdicts)
    return `判定 ${item.verdicts}`
  return ''
}

/** 预计耗时：null 表示没有历史耗时 */
export function estimateText(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined)
    return '首次执行，暂无历史耗时'
  return `约 ${minutes} 分钟`
}

/** 运行耗时：不足一分钟按秒，其余向上取整到分钟 */
export function durationText(milliseconds: number | null | undefined): string {
  if (milliseconds === null || milliseconds === undefined)
    return '-'
  const ms = Math.max(0, milliseconds)
  if (ms < 60_000)
    return `${Math.round(ms / 1000)} 秒`
  return `${Math.ceil(ms / 60_000)} 分钟`
}

/** 规则编号 → 规则定义，用于标签悬停提示 */
export function ruleMap(rules: ReleaseCheckPlanRule[]): Record<string, ReleaseCheckPlanRule> {
  const index: Record<string, ReleaseCheckPlanRule> = {}
  for (const rule of rules)
    index[rule.code] = rule
  return index
}

/** 规则悬停提示：标题 + 说明；缺失规则时返回空串 */
export function ruleTip(rule: ReleaseCheckPlanRule | undefined): string {
  if (!rule)
    return ''
  return `${rule.title}：${rule.description}`
}

/** 确认框文案：列出会执行的项目、用例数 / 规则与预计耗时 */
export function confirmLines(plan: ReleaseCheckPlanResponse): string[] {
  const included = includedPlanItems(plan)
  const lines = [`本次将执行 ${included.length} 项：`]
  for (const item of included) {
    const detail = planItemDetail(item)
    lines.push(detail ? `${item.code} ${item.name} · ${detail}` : `${item.code} ${item.name}`)
  }
  lines.push(`预计耗时：${estimateText(plan.estimate_minutes)}`)
  return lines
}
