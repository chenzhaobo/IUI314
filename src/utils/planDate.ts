/**
 * 计划完成时间（纯日期）的公共算法：业务时区今天、加天数、剩余/超期提示。
 *
 * 计划日是业务日期（+08 自然日），不能用浏览器时区算 —— 与静态扫描「计划处理完成时间」
 * 同一口径（views/sechub/static-scan/defects.vue），性能缺陷转单与问题列表共用这一份。
 */

const DAY_MS = 86_400_000

/** 业务时区（+08）的今天，YYYY-MM-DD */
export function businessToday(now: number = Date.now()): string {
  return new Date(now + 8 * 3600 * 1000).toISOString().slice(0, 10)
}

/** YYYY-MM-DD 加减天数（按 UTC 日历运算，与时区无关） */
export function addDays(date: string, days: number): string {
  const ms = Date.parse(`${date}T00:00:00Z`)
  if (Number.isNaN(ms))
    return date
  return new Date(ms + days * DAY_MS).toISOString().slice(0, 10)
}

/** 当月最后一天 */
export function monthEnd(date: string): string {
  const [y, m] = date.split('-').map(Number)
  if (!y || !m)
    return date
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
}

export interface PlanDateHint {
  text: string
  /** overdue 超期 / soon 3 天内 / far 其余 / '' 未设 */
  level: 'overdue' | 'soon' | 'far' | ''
}

/** 计划完成提示：今天晚于计划日才算超期（计划日当天算「今天到期」） */
export function planDateHint(plan: string | null | undefined, today: string = businessToday()): PlanDateHint {
  const value = (plan ?? '').trim().slice(0, 10)
  if (!value)
    return { text: '', level: '' }
  const planMs = Date.parse(`${value}T00:00:00Z`)
  const todayMs = Date.parse(`${today}T00:00:00Z`)
  if (Number.isNaN(planMs) || Number.isNaN(todayMs))
    return { text: '', level: '' }
  const days = Math.round((planMs - todayMs) / DAY_MS)
  if (days < 0)
    return { text: `超期 ${-days} 天`, level: 'overdue' }
  if (days === 0)
    return { text: '今天到期', level: 'soon' }
  return { text: `剩 ${days} 天`, level: days <= 3 ? 'soon' : 'far' }
}
