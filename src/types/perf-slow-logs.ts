/** 达标率看板「查看慢日志」：后端 `form_slow_logs` 的响应形状。 */

/** 统计周期口径，与达标率看板一致 */
export type SlowLogPeriodType = 'monthly' | 'weekly'

/** 列表 / 打包的查询条件（date / control_name / tenant_key 仅打包时作为二次筛选下发） */
export interface SlowLogQuery {
  product_line: string
  period_type: SlowLogPeriodType
  period: string
  form_id: string
  date?: string
  control_name?: string
  tenant_key?: string
}

/** 单个已下载的天梯日志文件；`task_id + path` 是下载凭据 */
export interface SlowLogFile {
  task_id: string
  /** 相对任务工作目录：<日期>/<维度目录>/<客户>/<文件> */
  path: string
  date: string
  bucket: string
  event_name: string
  control_name: string
  tenant_key: string
  customer_name: string
  trace_id: string
  /** 请求耗时（毫秒）；缺 manifest 时为空 */
  cost: number | null
  file_name: string
  size: number
}

export interface SlowLogList {
  period_start: string
  period_end: string
  files: SlowLogFile[]
  total: number
  truncated: boolean
  root_count: number
}
