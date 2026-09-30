<script lang="ts" setup>
import type { LineSeriesOption } from 'echarts/charts'
import type { DataZoomComponentOption, GridComponentOption, LegendComponentOption, MarkAreaComponentOption, TooltipComponentOption } from 'echarts/components'
import type { ComposeOption } from 'echarts/core'
/**
 * 通用时间序列图：time 轴 + dataZoom + markArea，纯展示不取数。
 *
 * 用在批次资源曲线（多脚本窗口标区）与摸底压测曲线。为保持"纯展示"，
 * 组件只接受调用方算好的点位与区间，不感知任何 `/perf/observe/*` 结构。
 */
import type { TimeSeriesMarkArea, TimeSeriesSeries } from './types'
import { LineChart } from 'echarts/charts'
import {
  DataZoomComponent,

  GridComponent,

  LegendComponent,

  MarkAreaComponent,

  TooltipComponent,

} from 'echarts/components'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { computed } from 'vue'
import VChart from 'vue-echarts'

defineOptions({ name: 'TimeSeriesChart' })

const props = withDefaults(defineProps<{
  series: TimeSeriesSeries[]
  markAreas?: TimeSeriesMarkArea[]
  /** 高亮的区间名（点击排行行时联动），与 markAreas[].name 比对 */
  activeMarkArea?: string
  /** 画布高度（CSS 长度），默认 320px */
  height?: string
  /** Y 轴刻度格式化；缺省按 series[0].unit 做紧凑格式化 */
  yFormatter?: (value: number) => string
}>(), {
  markAreas: () => [],
  activeMarkArea: '',
  height: '320px',
  yFormatter: undefined,
})

type EChartsOption = ComposeOption<
  | LineSeriesOption
  | GridComponentOption
  | TooltipComponentOption
  | LegendComponentOption
  | DataZoomComponentOption
  | MarkAreaComponentOption
>

use([GridComponent, TooltipComponent, LegendComponent, DataZoomComponent, MarkAreaComponent, LineChart, CanvasRenderer])

const PALETTE = ['#165dff', '#00b42a', '#ff7d00', '#f53f3f', '#722ed1', '#0fc6c2', '#86909c', '#d91ad9']

/** 大数值紧凑化：1.2K / 3.4M；CPU 核数这类小数保持原样 */
function compact(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1e9)
    return `${(value / 1e9).toFixed(2)}G`
  if (abs >= 1e6)
    return `${(value / 1e6).toFixed(2)}M`
  if (abs >= 1e3)
    return `${(value / 1e3).toFixed(2)}K`
  if (abs >= 1)
    return value.toFixed(2)
  return value.toFixed(4)
}

const unit = computed(() => props.series[0]?.unit ?? '')

const option = computed<EChartsOption>(() => {
  const marks = props.markAreas
    .filter(a => a.start_ms != null && a.end_ms != null)
    .map(a => ({ name: a.name, start: a.start_ms as number, end: a.end_ms as number }))

  const series: LineSeriesOption[] = props.series.map((s, idx) => ({
    name: s.name,
    type: 'line',
    showSymbol: false,
    sampling: 'lttb',
    lineStyle: { width: 1.5 },
    itemStyle: { color: PALETTE[idx % PALETTE.length] },
    data: s.points,
  }))

  if (marks.length > 0 && series.length > 0) {
    // markArea 的 data 是「区间数组的数组」：每个元素是 [起点, 终点] 两个端点
    series[0] = {
      ...series[0],
      markArea: {
        silent: true,
        data: marks.map((m) => {
          const active = m.name === props.activeMarkArea
          return [
            {
              name: m.name,
              xAxis: m.start,
              itemStyle: { color: active ? 'rgba(22, 93, 255, 0.22)' : 'rgba(134, 144, 156, 0.12)' },
              label: {
                show: marks.length <= 12 || active,
                position: 'insideTop' as const,
                fontSize: 10,
                color: '#4e5969',
                formatter: m.name.length > 10 ? `${m.name.slice(0, 10)}…` : m.name,
              },
            },
            { xAxis: m.end },
          ]
        }),
      },
    }
  }

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
    },
    legend: {
      type: 'scroll',
      top: 2,
      textStyle: { fontSize: 11 },
    },
    grid: {
      outerBounds: { left: 8, right: 16, top: 46, bottom: 46 },
    },
    xAxis: {
      type: 'time',
      axisLabel: { fontSize: 10 },
    },
    yAxis: {
      type: 'value',
      name: unit.value,
      nameTextStyle: { fontSize: 10 },
      axisLabel: {
        fontSize: 10,
        formatter: (v: number) => (props.yFormatter ? props.yFormatter(v) : compact(v)),
      },
    },
    dataZoom: [
      { type: 'inside', start: 0, end: 100 },
      { type: 'slider', height: 16, bottom: 8, start: 0, end: 100 },
    ],
    series,
  }
})
</script>

<template>
  <VChart
    v-if="series.length"
    class="tsc-chart"
    :option="option"
    :style="{ height, width: '100%' }"
    :autoresize="true"
  />
  <a-empty v-else description="暂无数据" class="tsc-empty" />
</template>

<style scoped>
.tsc-chart {
  display: block;
}

.tsc-empty {
  padding: 24px 0;
}
</style>
