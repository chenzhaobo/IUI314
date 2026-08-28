/**
 * 前端唯一时间入口
 *
 * ## 约定
 *
 * - 后端返回的时间一律是**带偏移的 RFC3339**（`2026-08-28T06:00:29+00:00`），代表一个
 *   时间点，不含任何展示意图。
 * - 显示一律经过本模块，按**用户设置的时区**（`sys_user.timezone`，默认 `Asia/Shanghai`）
 *   渲染成 local time。
 * - 提交给后端一律用 {@link toApiParam} 转成 RFC3339，不要把日期控件的原始绑定值直接扔进
 *   请求体。
 *
 * ## 为什么不用 toLocaleString / dayjs
 *
 * `toLocaleString()` 用的是**浏览器所在时区**，不是用户设置的时区，两者不一定相同；
 * 而且各 locale 的输出格式不同（zh-CN 会给 `2026/8/28 14:00:29`）。这里用
 * `Intl.DateTimeFormat` 的 `timeZone` 选项显式指定时区，再用 `formatToParts` 自己拼装，
 * 保证格式恒定为 `YYYY-MM-DD HH:mm:ss`。
 *
 * 不引 dayjs：后端改成带偏移 RFC3339 后 `new Date()` 解析已经可靠，不需要额外解析库。
 * （改造前收到的是无偏移的 `"2026-08-28 14:00:29"`，Safari 直接 Invalid Date，这才是
 * 静态扫描等页面时间显示异常的原因。）
 */

import { useUserStore } from '@/stores'

/** 默认时区：东八区 */
export const DEFAULT_TIMEZONE = 'Asia/Shanghai'

/** 兼容期：后端未迁移模块可能仍返回无偏移字符串，按这个偏移解释 */
const LEGACY_OFFSET = '+08:00'

/** 时区设置下拉候选。value 是 IANA 时区名，后端原样存储。 */
export const TIMEZONE_OPTIONS: { label: string, value: string }[] = [
  { label: '(UTC+08:00) 中国标准时间 — 北京/上海', value: 'Asia/Shanghai' },
  { label: '(UTC+08:00) 香港', value: 'Asia/Hong_Kong' },
  { label: '(UTC+08:00) 新加坡', value: 'Asia/Singapore' },
  { label: '(UTC+09:00) 东京', value: 'Asia/Tokyo' },
  { label: '(UTC+07:00) 曼谷/雅加达', value: 'Asia/Bangkok' },
  { label: '(UTC+05:30) 印度标准时间', value: 'Asia/Kolkata' },
  { label: '(UTC+04:00) 迪拜', value: 'Asia/Dubai' },
  { label: '(UTC+01:00) 柏林/巴黎（夏令时 +02:00）', value: 'Europe/Berlin' },
  { label: '(UTC+00:00) 伦敦（夏令时 +01:00）', value: 'Europe/London' },
  { label: '(UTC+00:00) 协调世界时 UTC', value: 'UTC' },
  { label: '(UTC-05:00) 纽约（夏令时 -04:00）', value: 'America/New_York' },
  { label: '(UTC-08:00) 洛杉矶（夏令时 -07:00）', value: 'America/Los_Angeles' },
]

/**
 * 当前生效的时区。
 *
 * 优先用户设置，其次默认东八区。不回退到浏览器时区 —— 那会让同一条记录在不同电脑上
 * 显示不同的时间，且用户无法解释原因。
 */
export function userTimeZone(): string {
  try {
    const tz = useUserStore().user.timezone
    if (tz)
      return tz
  }
  catch {
    // store 尚未初始化（例如登录页之前的早期渲染），走默认值
  }
  return DEFAULT_TIMEZONE
}

/** 时间入参：后端字符串、时间戳、Date 或空值 */
export type TimeInput = string | number | Date | null | undefined

/**
 * 把任意后端时间值解析成 Date（时间点）。无法解析时返回 null，由调用方决定占位符。
 *
 * 解析顺序：
 * 1. `Date` 实例 / 毫秒数（>1e11）/ 秒数 —— 直接构造；
 * 2. 带偏移或 `Z` 的 RFC3339 —— 直接 `new Date()`，语义无歧义；
 * 3. 无偏移的 `YYYY-MM-DD HH:mm:ss` / `YYYY-MM-DDTHH:mm:ss` —— 补 `+08:00` 再解析。
 *    这一步是**兼容期专用**：模块迁移完成后后端不会再返回这种形态。注意不能直接
 *    `new Date('2026-08-28 14:00:29')`，那在 Safari 是 Invalid Date、在 Chrome 会
 *    按浏览器时区解释，两者都不对。
 * 4. 纯日期 `YYYY-MM-DD` —— 按业务时区当天 00:00 解释。
 */
export function parseTimeInput(value: TimeInput): Date | null {
  if (value === null || value === undefined || value === '')
    return null

  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? null : value

  if (typeof value === 'number') {
    if (!Number.isFinite(value))
      return null
    // 十位数是秒、十三位数是毫秒
    const ms = Math.abs(value) < 1e11 ? value * 1000 : value
    const d = new Date(ms)
    return Number.isNaN(d.getTime()) ? null : d
  }

  const s = value.trim()
  if (!s)
    return null

  // 已带时区信息
  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(s)) {
    const d = new Date(s)
    return Number.isNaN(d.getTime()) ? null : d
  }

  // 无偏移的日期时间
  const dt = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2})?)(\.\d+)?$/.exec(s)
  if (dt) {
    const seconds = dt[2].length === 5 ? `${dt[2]}:00` : dt[2]
    const d = new Date(`${dt[1]}T${seconds}${dt[3] ?? ''}${LEGACY_OFFSET}`)
    return Number.isNaN(d.getTime()) ? null : d
  }

  // 纯日期
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T00:00:00${LEGACY_OFFSET}`)
    return Number.isNaN(d.getTime()) ? null : d
  }

  const fallback = new Date(s)
  return Number.isNaN(fallback.getTime()) ? null : fallback
}

interface Parts {
  year: string
  month: string
  day: string
  hour: string
  minute: string
  second: string
}

const formatterCache = new Map<string, Intl.DateTimeFormat>()

function partsOf(date: Date, timeZone: string): Parts {
  let fmt = formatterCache.get(timeZone)
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      // h23 避免部分 ICU 版本把午夜输出成 24
      hourCycle: 'h23',
    })
    formatterCache.set(timeZone, fmt)
  }
  const out: Record<string, string> = {}
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== 'literal')
      out[p.type] = p.value
  }
  return out as unknown as Parts
}

/** 显示精度 */
export type TimePrecision = 'datetime' | 'minute' | 'date' | 'time'

export interface FormatOptions {
  /** 精度，默认 datetime（到秒） */
  precision?: TimePrecision
  /** 解析失败或空值时的占位符，默认 '-' */
  placeholder?: string
  /** 覆盖时区，默认用户设置 */
  timeZone?: string
}

/**
 * 主入口：按用户时区渲染成 `YYYY-MM-DD HH:mm:ss`。
 *
 * ```ts
 * formatTime(row.created_at)                          // 2026-08-28 14:00:29
 * formatTime(row.created_at, { precision: 'minute' }) // 2026-08-28 14:00
 * formatTime(row.due_at, { precision: 'date' })       // 2026-08-28
 * ```
 */
export function formatTime(value: TimeInput, options: FormatOptions = {}): string {
  const { precision = 'datetime', placeholder = '-', timeZone } = options
  const date = parseTimeInput(value)
  if (!date)
    return placeholder

  const p = partsOf(date, timeZone ?? userTimeZone())
  const day = `${p.year}-${p.month}-${p.day}`
  switch (precision) {
    case 'date':
      return day
    case 'time':
      return `${p.hour}:${p.minute}:${p.second}`
    case 'minute':
      return `${day} ${p.hour}:${p.minute}`
    default:
      return `${day} ${p.hour}:${p.minute}:${p.second}`
  }
}

/** 仅日期 */
export function formatDate(value: TimeInput, placeholder = '-'): string {
  return formatTime(value, { precision: 'date', placeholder })
}

/** 到分钟 */
export function formatMinute(value: TimeInput, placeholder = '-'): string {
  return formatTime(value, { precision: 'minute', placeholder })
}

/**
 * 提交给后端：转成 RFC3339（带偏移）。
 *
 * 日期控件（`a-date-picker` / `a-range-picker`）的绑定值形态不统一——项目里 15 个控件
 * 只有 4 个设了 `value-format`——所以提交前统一过这个函数，避免后端收到无法判定时区的
 * 字符串。空值返回 undefined，便于直接展开进请求体。
 */
export function toApiParam(value: TimeInput): string | undefined {
  const date = parseTimeInput(value)
  return date ? date.toISOString() : undefined
}

/**
 * 提交给后端：只要日历日期（`YYYY-MM-DD`），按用户时区取。
 *
 * 用于 `period_start` / `run_date` 这类后端是 `date` 列的字段——它们是业务日历日期，
 * 不是时间点，不能带时区。
 */
export function toApiDate(value: TimeInput): string | undefined {
  const date = parseTimeInput(value)
  if (!date)
    return undefined
  const p = partsOf(date, userTimeZone())
  return `${p.year}-${p.month}-${p.day}`
}

/**
 * 当前时区相对 UTC 的偏移文本，如 `UTC+08:00`。用于在设置界面上给用户确认。
 */
export function timeZoneLabel(timeZone = userTimeZone(), at: Date = new Date()): string {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
    const part = fmt.formatToParts(at).find(p => p.type === 'timeZoneName')
    return part?.value ?? timeZone
  }
  catch {
    return timeZone
  }
}
