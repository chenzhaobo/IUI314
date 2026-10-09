/**
 * 性能可观测页面的指标值格式化（纯函数，无 Vue / 运行时依赖，可直接单测）。
 *
 * 单位口径与后端一致：`perf_metric_template.unit` 取 core / byte / ratio / count / flag / ms，
 * 曲线按 `perf_run_metric_series.unit` 回填；无 unit 的字段按字段语义选
 * （p95_ms → ms、tps → tps、其余最多 2 位小数）。
 *
 * 所有函数对空值（null / undefined / NaN / Infinity）统一返回 '—'，
 * 表格、描述、图表 tooltip 与坐标轴共用同一套口径，避免各页各写一份 toFixed。
 */

/** 空值占位（与页面既有文案一致） */
export const EMPTY_TEXT = '—'

const BYTE_UNITS = ['B', 'KiB', 'MiB', 'GiB', 'TiB']

/** 非有限值（含字符串数字）统一折算成有限 number，否则 null */
function toFinite(value: number | null | undefined): number | null {
  if (value === null || value === undefined)
    return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

/** 整数部分加千分位（保留原小数部分）：-1234.5 → -1,234.5 */
function withThousands(text: string): string {
  const sign = text.startsWith('-') ? '-' : ''
  const body = sign ? text.slice(1) : text
  const [intPart, fracPart] = body.split('.')
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return fracPart === undefined ? `${sign}${grouped}` : `${sign}${grouped}.${fracPart}`
}

/** 去掉尾随 0 与空小数点：3.50 → 3.5，3.00 → 3（-0.00 归一为 0，不显示 "-0"） */
function trimZeros(text: string): string {
  if (!text.includes('.'))
    return text
  const trimmed = text.replace(/0+$/, '').replace(/\.$/, '')
  return trimmed === '-0' ? '0' : trimmed
}

/** 1024 进制换算：6712859927.2727 → 6.3 GiB */
function formatBytes(bytes: number): string {
  let value = bytes
  let index = 0
  while (Math.abs(value) >= 1024 && index < BYTE_UNITS.length - 1) {
    value /= 1024
    index += 1
  }
  return index === 0 ? `${Math.round(value)} B` : `${value.toFixed(1)} ${BYTE_UNITS[index]}`
}

/** <1000 取整毫秒；≥1000 换算秒（2 位小数）：1640 → 1.64 s */
function formatMs(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`
}

/** 固定位数 + 千分位：1234.5, 2 → 1,234.50 */
export function formatNumber(value: number | null | undefined, digits = 2): string {
  const num = toFinite(value)
  if (num === null)
    return EMPTY_TEXT
  return withThousands(num.toFixed(digits))
}

/** ratio（0~1 的小数）→ 百分比：0.19734567 → 19.7% */
export function formatPercent(ratio: number | null | undefined, digits = 1): string {
  const num = toFinite(ratio)
  if (num === null)
    return EMPTY_TEXT
  return `${(num * 100).toFixed(digits)}%`
}

/**
 * 按单位格式化指标值；未知 / 缺失单位按「最多 2 位小数、去尾随 0」。
 *
 * | unit | 规则 | 例 |
 * |---|---|---|
 * | byte | 1024 进制自动换算 B/KiB/MiB/GiB/TiB，1 位小数 | 6.3 GiB |
 * | ratio | ×100 转百分比，1 位小数 | 19.7% |
 * | core | 2 位小数 + " 核" | 0.20 核 |
 * | ms | <1000 取整 ms；≥1000 换算 s（2 位小数） | 999 ms / 1.64 s |
 * | count | 取整 + 千分位 | 1,234 |
 * | tps / rps | 2 位小数 | 2.11 |
 * | 其他 | 最多 2 位小数、去尾随 0 | 3.5 |
 */
export function formatMetric(value: number | null | undefined, unit?: string | null): string {
  const num = toFinite(value)
  if (num === null)
    return EMPTY_TEXT
  switch (unit) {
    case 'byte':
      return formatBytes(num)
    case 'ratio':
      return formatPercent(num, 1)
    case 'core':
      return `${num.toFixed(2)} 核`
    case 'ms':
      return formatMs(num)
    case 'count':
      return withThousands(String(Math.round(num)))
    case 'tps':
    case 'rps':
      return num.toFixed(2)
    default:
      return withThousands(trimZeros(num.toFixed(2)))
  }
}
