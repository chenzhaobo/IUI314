<script lang="ts" setup>
import type { LineSeriesOption } from 'echarts/charts'
import type { GridComponentOption, LegendComponentOption, TooltipComponentOption } from 'echarts/components'
import type { ComposeOption } from 'echarts/core'
/**
 * 曲线 1：每个硬件档位一组「并发 → TPS / P95」折线（纯展示，不取数）。
 *
 * 档位之间的并发取值并不相同（验证上探与拐点细分各自取点），所以横轴用**数值轴**
 * 而不是类目轴 —— 类目轴会把 20 和 21 摆成等距，看不出拐点附近的密疏。
 * TPS 走左轴、P95 走右轴；同一档位两条线同色，P95 用虚线 + 三角点区分。
 */
import type { HwResultView } from './types'
import { LineChart } from 'echarts/charts'
import {
  GridComponent,

  LegendComponent,

  TooltipComponent,

} from 'echarts/components'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { formatMetric } from '@/utils/perfFormat'

const props = withDefaults(defineProps<{
  hw: HwResultView[]
  height?: string
}>(), {
  height: '340px',
})

type StageChartOption = ComposeOption<
  | LineSeriesOption
  | GridComponentOption
  | TooltipComponentOption
  | LegendComponentOption
>

use([GridComponent, TooltipComponent, LegendComponent, LineChart, CanvasRenderer])

const PALETTE = ['#165dff', '#00b42a', '#ff7d00', '#f53f3f', '#722ed1', '#0fc6c2']

/** tooltip 一行：TPS 与 P95 两个口径混在一张图里，按序列名各自选单位 */
function tooltipLine(item: { marker?: string, seriesName?: string, value?: unknown }): string {
  const raw = Array.isArray(item.value) ? item.value[1] : item.value
  const num = raw === null || raw === undefined ? null : Number(raw)
  const name = item.seriesName ?? ''
  return `${item.marker ?? ''} ${name}：${formatMetric(num, name.endsWith(' · P95') ? 'ms' : 'tps')}`
}

const option = computed<StageChartOption | undefined>(() => {
  const tiers = props.hw.filter(h => (h.stages?.length ?? 0) > 0)
  if (tiers.length === 0)
    return undefined

  const legend: string[] = []
  const series: LineSeriesOption[] = []

  for (const [i, tier] of tiers.entries()) {
    const color = PALETTE[i % PALETTE.length]
    // 折线按并发升序才连成单调曲线（stages 里含错误重跑的第二行，顺序不保证）
    const stages = [...tier.stages].sort((a, b) => a.threads - b.threads)
    const tpsName = `${tier.label} · TPS`
    const p95Name = `${tier.label} · P95`
    legend.push(tpsName, p95Name)
    series.push({
      name: tpsName,
      type: 'line',
      yAxisIndex: 0,
      data: stages.map(s => [s.threads, s.tps] as [number, number]),
      itemStyle: { color },
      lineStyle: { color, width: 2 },
      symbolSize: 6,
    })
    series.push({
      name: p95Name,
      type: 'line',
      yAxisIndex: 1,
      data: stages.map(s => [s.threads, s.p95_ms] as [number, number]),
      itemStyle: { color },
      lineStyle: { color, width: 1, type: 'dashed' },
      symbol: 'triangle',
      symbolSize: 5,
    })
  }

  return {
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => {
        const list = params as Array<{ marker?: string, seriesName?: string, value?: unknown, axisValueLabel?: string }>
        if (!list.length)
          return ''
        return [`并发 ${list[0]?.axisValueLabel ?? ''}`, ...list.map(tooltipLine)].join('<br/>')
      },
    },
    legend: { type: 'scroll', top: 2, textStyle: { fontSize: 11 } },
    // ECharts 6 弃用 grid.containLabel，改用 outerBounds（见 TxnTrendChart）
    grid: { outerBounds: { left: 8, right: 8, top: 48, bottom: 28 } },
    xAxis: {
      type: 'value',
      name: '并发',
      nameTextStyle: { fontSize: 10 },
      min: 0,
      axisLabel: { fontSize: 10 },
    },
    yAxis: [
      {
        type: 'value',
        name: 'TPS',
        nameTextStyle: { fontSize: 10 },
        axisLabel: { fontSize: 10, formatter: (v: number) => formatMetric(v, 'tps') },
      },
      {
        type: 'value',
        name: 'P95',
        nameTextStyle: { fontSize: 10 },
        axisLabel: { fontSize: 10, formatter: (v: number) => formatMetric(v, 'ms') },
        splitLine: { show: false },
      },
    ],
    series,
  }
})
</script>

<template>
  <VChart
    v-if="option"
    :option="option"
    :style="{ height, width: '100%' }"
    :autoresize="true"
  />
  <a-empty v-else description="暂无档位曲线数据" />
</template>
