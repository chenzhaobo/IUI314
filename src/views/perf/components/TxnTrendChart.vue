<script lang="ts" setup>
import { ref, watch } from 'vue'
import { LineChart, type LineSeriesOption } from 'echarts/charts'
import {
  GridComponent,
  type GridComponentOption,
  TooltipComponent,
  type TooltipComponentOption,
  LegendComponent,
  type LegendComponentOption,
  DataZoomComponent,
  type DataZoomComponentOption,
} from 'echarts/components'
import { type ComposeOption, use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import type { ECBasicOption } from 'echarts/types/dist/shared'
import VChart from 'vue-echarts'
import { useGet } from '@/hooks'
import { ApiPerfBenchmark } from '@/api/apis'

defineOptions({ name: 'TxnTrendChart' })

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  txnCode: {
    type: String,
    default: '',
  },
  txnName: {
    type: String,
    default: '',
  },
})

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
}>()

type EChartsOption = ComposeOption<
  | LineSeriesOption
  | GridComponentOption
  | TooltipComponentOption
  | LegendComponentOption
  | DataZoomComponentOption
>

use([GridComponent, TooltipComponent, LegendComponent, DataZoomComponent, LineChart, CanvasRenderer])

const chartRef = ref<InstanceType<typeof VChart>>()
const option = ref<EChartsOption>()

const { data: trendData, execute: fetchTrend, isFetching: loading } = useGet<any[]>(
  ApiPerfBenchmark.trend,
  { txn_code: '' },
  { immediate: false },
)

function fmtTime(time?: string | null) {
  if (!time) return ''
  return time.replace('T', ' ').substring(0, 19)
}

function msToSec(ms?: number | null): number | null {
  if (ms === null || ms === undefined) return null
  return Number((ms / 1000).toFixed(3))
}

function initChart(data: any[]) {
  const xLabels = data.map((d) => fmtTime(d.created_at) || d.iteration_name || '')
  const actualData = data.map((d) => msToSec(d.average_ms))
  const baselineData = data.map((d) => msToSec(d.baseline_value_ms))
  const targetData = data.map((d) => msToSec(d.target_value_ms))

  option.value = {
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const idx = params[0].dataIndex
        const d = data[idx]
        let html = `<b>${fmtTime(d.created_at)}</b><br/>`
        html += `迭代: ${d.iteration_name || '-'}<br/>`
        for (const p of params) {
          html += `${p.marker} ${p.seriesName}: ${p.value ?? '-'} 秒<br/>`
        }
        if (d.compare_status) {
          html += `比对状态: ${d.compare_status}<br/>`
        }
        if (d.pass_status) {
          html += `达标状态: ${d.pass_status}`
        }
        return html
      },
    },
    legend: {
      data: ['最新结果', '比对值', '目标值'],
      top: 5,
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: '15%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: xLabels,
      axisLabel: {
        rotate: 30,
        formatter: (val: string) => {
          if (val.length > 16) return val.substring(5, 16)
          return val
        },
      },
    },
    yAxis: {
      type: 'value',
      name: '平均时间(秒)',
      axisLabel: {
        formatter: '{value} s',
      },
    },
    dataZoom: [
      { type: 'inside', start: 0, end: 100 },
      { type: 'slider', start: 0, end: 100 },
    ],
    series: [
      {
        name: '最新结果',
        type: 'line',
        data: actualData,
        itemStyle: { color: '#1890ff' },
        lineStyle: { width: 2 },
        symbol: 'circle',
        symbolSize: 6,
      },
      {
        name: '比对值',
        type: 'line',
        data: baselineData,
        itemStyle: { color: '#52c41a' },
        lineStyle: { width: 2 },
        symbol: 'diamond',
        symbolSize: 6,
      },
      {
        name: '目标值',
        type: 'line',
        data: targetData,
        itemStyle: { color: '#f5222d' },
        lineStyle: { width: 2, type: 'dashed' },
        symbol: 'triangle',
        symbolSize: 6,
      },
    ],
  }

  chartRef.value?.setOption(option.value as ECBasicOption, { notMerge: true })
}

watch(
  () => props.visible,
  async (val) => {
    if (val && props.txnCode) {
      await fetchTrend({ txn_code: props.txnCode })
      const data = trendData.value || []
      if (data.length > 0) {
        initChart(data)
      }
    }
  },
  { immediate: true },
)

watch(
  () => props.txnCode,
  async (val) => {
    if (val && props.visible) {
      await fetchTrend({ txn_code: val })
      const data = trendData.value || []
      if (data.length > 0) {
        initChart(data)
      }
    }
  },
)
</script>

<template>
  <a-modal
    :visible="visible"
    :width="900"
    :title="`事务趋势 - ${txnName || txnCode}`"
    :footer="false"
    @update:visible="(v: boolean) => emit('update:visible', v)"
  >
    <a-spin :loading="loading" style="width: 100%">
      <VChart
        v-if="option"
        ref="chartRef"
        :style="{ height: '420px', width: '100%' }"
        :autoresize="true"
      />
      <a-empty v-else description="暂无趋势数据" style="padding: 80px 0" />
    </a-spin>
  </a-modal>
</template>
