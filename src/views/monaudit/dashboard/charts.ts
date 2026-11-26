/**
 * 问题看板的 ECharts 配置（纯函数，不取数）。
 */
import type { BarSeriesOption, LineSeriesOption, PieSeriesOption } from 'echarts/charts'
import type { GridComponentOption, LegendComponentOption, TooltipComponentOption } from 'echarts/components'
import type { ComposeOption } from 'echarts/core'
import type { DashboardCounter, DashboardTrendPoint } from './types'
import { ISSUE_STATUS, tagMeta } from '../shared/types'

export type DashboardChartOption = ComposeOption<
  | BarSeriesOption
  | LineSeriesOption
  | PieSeriesOption
  | GridComponentOption
  | TooltipComponentOption
  | LegendComponentOption
>

/** 横向条形图：未关闭 / 总数（类目多时横向更易读） */
export function counterBarOption(rows: DashboardCounter[]): DashboardChartOption {
  const list = [...rows].reverse()
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { top: 0 },
    grid: { left: 8, right: 24, top: 32, bottom: 8, containLabel: true },
    xAxis: { type: 'value' },
    yAxis: { type: 'category', data: list.map(r => r.label), axisLabel: { width: 140, overflow: 'truncate' } },
    series: [
      { name: '未关闭', type: 'bar', data: list.map(r => r.open), itemStyle: { color: '#f53f3f' } },
      { name: '总数', type: 'bar', data: list.map(r => r.total), itemStyle: { color: '#86909c' } },
    ],
  }
}

/** 状态饼图：状态码翻成中文 */
export function statusPieOption(rows: DashboardCounter[]): DashboardChartOption {
  return {
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, type: 'scroll' },
    series: [
      {
        name: '状态',
        type: 'pie',
        radius: ['40%', '68%'],
        center: ['50%', '45%'],
        data: rows.map(r => ({ name: tagMeta(ISSUE_STATUS, r.key).label, value: r.total })),
      },
    ],
  }
}

/** 轮次趋势：本轮出现 / 新增 / 重现 */
export function trendLineOption(points: DashboardTrendPoint[]): DashboardChartOption {
  return {
    tooltip: { trigger: 'axis' },
    legend: { top: 0 },
    grid: { left: 8, right: 24, top: 32, bottom: 8, containLabel: true },
    xAxis: { type: 'category', data: points.map(p => p.round_no) },
    yAxis: { type: 'value', minInterval: 1 },
    series: [
      { name: '本轮出现', type: 'line', data: points.map(p => p.hit) },
      { name: '新增', type: 'line', data: points.map(p => p.new_issues) },
      { name: '重现', type: 'line', data: points.map(p => p.reproduced) },
    ],
  }
}
