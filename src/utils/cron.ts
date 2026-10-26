/** 6 段 cron（秒 分 时 日 月 周）基础校验；后端按北京时间解释。 */
export function validateCron(expr: string): boolean {
  if (!expr.trim())
    return false
  return expr.trim().split(/\s+/).length === 6
}

export const CRON_HINT = '6 段：秒 分 时 日 月 周，按北京时间执行；周字段 1=周日 … 7=周六'
