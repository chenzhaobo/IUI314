<script lang="ts" setup>
import type { BarSeriesOption } from 'echarts/charts'
import type { GridComponentOption, LegendComponentOption, TooltipComponentOption } from 'echarts/components'
import type { ComposeOption } from 'echarts/core'
/**
 * 曲线 2：硬件档位 → 拐点最优 TPS 与单副本容量（纯展示，不取数）。
 *
 * 两个系列同为 TPS 口径，共用一根纵轴；单副本容量取后端算好的
 * `per_replica_tps`（= 拐点 TPS / 副本总数），这里不重算，避免与后端口径漂移。
 */
import type { Curve2Row } from './types'
import { BarChart } from 'echarts/charts'
import {
  GridComponent,

  LegendComponent,

  TooltipComponent,

} from 'echarts/components'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { computed } from 'vue'
import VChart from 'vue-echarts'

const props = withDefaults(defineProps<{
  rows: Curve2Row[]
  height?: string
}>(), {
  height: '300px',
})

type HwChartOption = ComposeOption<
  | BarSeriesOption
  | GridComponentOption
  | TooltipComponentOption
  | LegendComponentOption
>

use([GridComponent, TooltipComponent, LegendComponent, BarChart, CanvasRenderer])

const option = computed<HwChartOption | undefined>(() => {
  if (props.rows.length === 0)
    return undefined

  const perReplica = props.rows.map(r => r.per_replica_tps ?? null)

  return {
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => {
        const list = params as Array<{ dataIndex: number, marker: string, seriesName: string, value: number | null }>
        const idx = list[0]?.dataIndex ?? 0
        const row = props.rows[idx]
        if (!row)
          return ''
        const lines = [`<b>${row.label}</b>`, `副本总数：${row.replicas_total}`]
        for (const p of list) {
          lines.push(`${p.marker} ${p.seriesName}：${p.value ?? '—'}`)
        }
        return lines.join('<br/>')
      },
    },
    legend: { top: 2, textStyle: { fontSize: 11 } },
    grid: { outerBounds: { left: 8, right: 8, top: 40, bottom: 24 } },
    xAxis: {
      type: 'category',
      data: props.rows.map(r => r.label),
      axisLabel: { fontSize: 10 },
    },
    yAxis: {
      type: 'value',
      name: 'TPS',
      nameTextStyle: { fontSize: 10 },
      axisLabel: { fontSize: 10 },
    },
    series: [
      {
        name: '拐点最优 TPS',
        type: 'bar',
        barMaxWidth: 40,
        data: props.rows.map(r => r.knee_tps),
        itemStyle: { color: '#165dff' },
      },
      {
        name: '单副本容量',
        type: 'bar',
        barMaxWidth: 40,
        data: perReplica,
        itemStyle: { color: '#00b42a' },
      },
    ],
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
  <a-empty v-else description="暂无档位对比数据" />
</template>
