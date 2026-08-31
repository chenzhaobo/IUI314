/**
 * 表格列过滤器（前端过滤，配合 Arco 的 column.filterable）。
 *
 * 为什么自己做而不用 Arco 自带的 filters：
 * 自带的是「枚举多选」——先给一组固定候选值，用户勾选。但这两个表格里要过滤的是
 * 文件路径、匹配文本、AI 理由这类**自由文本**，候选值是无穷的，枚举不适用。
 * 用户要的是「包含某个关键字」「不等于某个值」这种运算符语义。
 *
 * 三类字段各给一组运算符：
 *   文本  等于 / 不等于 / 包含 / 不包含
 *   数字  大于 / 小于（含等于的边界由用户自己用相邻值表达，避免面板过于复杂）
 *   时间  从…到…（区间，两端都可留空表示不限）
 *
 * 过滤在前端做：这两个表格的数据量都是一页几十条（结果详情分页、扫描运行是聚合行），
 * 走后端要给每个字段加查询参数，改动面大且收益有限。
 */

export type ColumnFilterKind = 'text' | 'number' | 'date'

export type TextOp = 'eq' | 'ne' | 'contains' | 'notContains'
export type NumberOp = 'gt' | 'lt'

export interface ColumnFilterState {
  kind: ColumnFilterKind
  /** 文本/数字运算符；时间类不用 */
  op?: TextOp | NumberOp
  /** 文本与数字的比较值 */
  value?: string
  /** 时间区间 [从, 到]，元素可为空串表示该端不限 */
  range?: [string, string]
}

export const TEXT_OPS: Array<{ value: TextOp, label: string }> = [
  { value: 'contains', label: '包含' },
  { value: 'notContains', label: '不包含' },
  { value: 'eq', label: '等于' },
  { value: 'ne', label: '不等于' },
]

export const NUMBER_OPS: Array<{ value: NumberOp, label: string }> = [
  { value: 'gt', label: '大于' },
  { value: 'lt', label: '小于' },
]

/** 该过滤条件是否真的会生效（空条件不参与过滤，避免把全部数据滤掉） */
export function isFilterActive(f: ColumnFilterState | undefined): boolean {
  if (!f)
    return false
  if (f.kind === 'date')
    return Boolean(f.range?.[0] || f.range?.[1])
  return Boolean(f.value && f.value.trim())
}

/**
 * 判断一行的某个字段是否通过过滤。
 *
 * 空值处理：字段为 null/undefined/'' 时，除「不等于」「不包含」外一律不通过 ——
 * 否则「包含 abc」会把一堆空值行也留下，反直觉。
 */
export function matchFilter(raw: unknown, f: ColumnFilterState): boolean {
  if (!isFilterActive(f))
    return true

  const text = raw == null ? '' : String(raw)

  if (f.kind === 'date') {
    const [from, to] = f.range ?? ['', '']
    if (!text)
      return false
    // 直接比字符串：这两个表格的时间都是 'YYYY-MM-DD HH:MM:SS' 或 ISO，
    // 同格式下字典序等价于时间序，不用引入 dayjs 解析。
    // 取前 10 位与日期选择器的 'YYYY-MM-DD' 对齐，避免同一天因带时分秒被判超出上界。
    const day = text.slice(0, 10)
    if (from && day < from)
      return false
    if (to && day > to)
      return false
    return true
  }

  if (f.kind === 'number') {
    const n = Number(text)
    const target = Number(f.value)
    if (!Number.isFinite(n) || !Number.isFinite(target))
      return false
    return f.op === 'lt' ? n < target : n > target
  }

  const needle = (f.value ?? '').trim()
  const hay = text.toLowerCase()
  const nee = needle.toLowerCase()
  switch (f.op) {
    case 'eq': return text === needle
    case 'ne': return text !== needle
    case 'notContains': return !hay.includes(nee)
    default: return hay.includes(nee)
  }
}

/** 把多个列的过滤条件应用到一批行上 */
export function applyColumnFilters<T extends Record<string, any>>(
  rows: T[],
  filters: Record<string, ColumnFilterState>,
): T[] {
  const active = Object.entries(filters).filter(([, f]) => isFilterActive(f))
  if (active.length === 0)
    return rows
  return rows.filter(row => active.every(([key, f]) => matchFilter(row[key], f)))
}

/** 新建一个空过滤条件 */
export function emptyFilter(kind: ColumnFilterKind): ColumnFilterState {
  if (kind === 'date')
    return { kind, range: ['', ''] }
  return { kind, op: kind === 'number' ? 'gt' : 'contains', value: '' }
}
