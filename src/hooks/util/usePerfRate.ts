/**
 * 3 秒达标率的展示口径（达标率看板 Dashboard/Trend、问题台账与问题列表左树共用）。
 *
 * 阈值与后端 `COMPLIANCE_PASS_THRESHOLD`（99%）一致：≥99 达标（绿）、
 * ≥95 观察（橙）、否则不达标（红）。三处各写一份必然慢慢长歪 —— 同一个数字
 * 在左树是绿的、在看板是红的，没人能解释。
 */
export const COMPLIANCE_PASS_RATE = 99
export const COMPLIANCE_WATCH_RATE = 95

export function rateColor(rate: number | null | undefined): string {
  if (rate === null || rate === undefined)
    return 'var(--color-text-3)'
  if (rate >= COMPLIANCE_PASS_RATE)
    return '#00b42a'
  if (rate >= COMPLIANCE_WATCH_RATE)
    return '#ff7d00'
  return '#f53f3f'
}
