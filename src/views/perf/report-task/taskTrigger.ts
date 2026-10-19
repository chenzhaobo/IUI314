/**
 * 报告任务「手动触发 / 重试」的纯函数：归因日期状态汇总、默认区间、重试计划。
 *
 * 归因任务的范围是「全部未归因」：一轮会把所有已提取、还没归因的日期合并分析，
 * 运行记录却只挂在区间末天。界面必须把「这一轮覆盖了哪些天」「选的区间里哪些分析过」
 * 摆出来，否则只看到一个日期，无从判断（生产实测 10-09 那轮实际覆盖 09-01 起 34 天）。
 */

/** 后端 /task/attr-days 的返回项 */
export interface AttrDayStatus {
  date: string
  /** pending 待归因 / running 归因中 / failed 上次失败（仍待归因）/ attributed 已归因 / no_data 无产物 */
  status: 'pending' | 'running' | 'failed' | 'attributed' | 'no_data'
  /** 归属的那一轮（运行记录的数据日期） */
  round: string | null
}

/** 运行记录里一轮归因覆盖的区间（后端补的 attr_range） */
export interface AttrRange {
  start: string
  end: string
  count: number
  days: string[]
}

/** 运行记录行（只列本模块用到的字段） */
export interface TaskRunRow {
  task_id: string
  run_date: string
  stage: string
  status: string
  attr_range?: AttrRange | null
  stage_detail?: { merged_into?: string } | null
}

export interface TriggerPayload {
  task_id?: string
  run_date?: string
  /** 下载/提取范围补跑：起止日期，后端按日期串行执行 */
  run_date_from?: string
  run_date_to?: string
  attr_from?: string
  stage?: string
  force?: boolean
}

export interface AttrDaySummary {
  total: number
  pending: number
  failed: number
  running: number
  attributed: number
  noData: number
}

export const ATTR_STATUS_TEXT: Record<AttrDayStatus['status'], string> = {
  pending: '待归因',
  failed: '上次失败',
  running: '归因中',
  attributed: '已归因',
  no_data: '无数据',
}

export const ATTR_STATUS_COLOR: Record<AttrDayStatus['status'], string> = {
  pending: 'arcoblue',
  failed: 'red',
  running: 'orange',
  attributed: 'green',
  no_data: 'gray',
}

/** 区间内（含端点）的日期状态；未给区间返回全部 */
export function daysInRange(days: AttrDayStatus[], from?: string, to?: string): AttrDayStatus[] {
  return days.filter(d => (!from || d.date >= from) && (!to || d.date <= to))
}

export function summarizeAttrDays(days: AttrDayStatus[]): AttrDaySummary {
  const summary: AttrDaySummary = { total: days.length, pending: 0, failed: 0, running: 0, attributed: 0, noData: 0 }
  for (const d of days) {
    if (d.status === 'pending')
      summary.pending++
    else if (d.status === 'failed')
      summary.failed++
    else if (d.status === 'running')
      summary.running++
    else if (d.status === 'attributed')
      summary.attributed++
    else
      summary.noData++
  }
  return summary
}

/**
 * 默认归因区间：最早一个还没归因的日期 ~ 最近一个已提取的日期。
 * 全部归因过则返回最近一天（便于强制重跑最后一天）；没有任何已提取日期返回空。
 */
export function defaultAttrRange(days: AttrDayStatus[]): [string, string] | [] {
  if (!days.length)
    return []
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date))
  const last = sorted[sorted.length - 1].date
  const firstTodo = sorted.find(d => d.status === 'pending' || d.status === 'failed')
  return [firstTodo?.date ?? last, last]
}

/** 运行记录的「归因区间」列文案 */
export function attrRangeText(row: TaskRunRow): string {
  if (row.stage !== 'defect_attribution')
    return ''
  if (row.attr_range)
    return row.attr_range.start === row.attr_range.end ? row.attr_range.start : `${row.attr_range.start} ~ ${row.attr_range.end}（${row.attr_range.count} 天）`
  if (row.stage_detail?.merged_into)
    return `已并入 ${row.stage_detail.merged_into} 那一轮`
  return ''
}

/**
 * 运行记录行「重试」：直接按这一行原来的范围重跑，不再让人选日期。
 *
 * 归因行必须带上原区间起点：只给末天的话，后端只分析末天，维度账本里其他日期的
 * 维度会被判「分桶结果里已无此维度」整批作废（生产 10-02 那轮就是这样）。
 * 不强制：已完成的维度断点续跑跳过，只做失败 / 没做完的。
 */
export function retryPlan(row: TaskRunRow): { payload: TriggerPayload, description: string } {
  const runDate = String(row.run_date || '').slice(0, 10)
  if (row.stage === 'defect_attribution') {
    const start = row.attr_range?.start ?? runDate
    const span = row.attr_range && row.attr_range.start !== row.attr_range.end
      ? `区间 ${row.attr_range.start} ~ ${row.attr_range.end}（${row.attr_range.count} 天）`
      : `日期 ${runDate}`
    return {
      payload: { task_id: row.task_id, run_date: runDate, stage: 'defect_attribution', attr_from: start },
      description: `继续 ${runDate} 这一轮归因：${span}。已完成的维度不会重做，只处理失败和未完成的。`,
    }
  }
  return {
    payload: { task_id: row.task_id, run_date: runDate, stage: row.stage },
    description: `重新执行数据日期 ${runDate} 的这个阶段（已成功的条目断点续跑跳过）。`,
  }
}

/** 触发结果提示：「什么都没跑」不能用绿色成功提示 */
export function isSkippedResult(text: string): boolean {
  return text.startsWith('未执行')
}
