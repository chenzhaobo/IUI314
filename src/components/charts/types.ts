/**
 * 通用图表组件的入参类型（纯展示，组件内不取数）。
 *
 * 点位统一用 `[ts_ms, value]` 二元组：与后端 `perf_run_metric_series.points`
 * / Prometheus range query 的口径一致，调用方不需要再转换。
 */

/** 一条时间序列 */
export interface TimeSeriesSeries {
  /** 图例名（一般是 target_ref） */
  name: string
  /** 单位（同一张图内应一致，用于 Y 轴格式化） */
  unit: string
  /** [[时间戳(ms), 值], ...]，按时间升序 */
  points: Array<[number, number]>
}

/** 时间轴上的区间标注（如每个脚本的执行窗口） */
export interface TimeSeriesMarkArea {
  name: string
  /** 区间起点（ms）。缺失时该区间不画 */
  start_ms?: number | null
  /** 区间终点（ms）。缺失时该区间不画 */
  end_ms?: number | null
}
