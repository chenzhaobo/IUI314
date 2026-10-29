<script setup lang="ts">
/**
 * 趋势：近 6 个迭代的覆盖率 / 新增覆盖率 / 通过率（折线）+ 新增缺陷 / 高危配置（表）。
 *
 * 没有快照的迭代折线断点、表格显示「无快照」，不做任何插值，避免把缺失当 0。
 */
import type { LineSeriesOption } from 'echarts/charts'
import type { GridComponentOption, LegendComponentOption, TooltipComponentOption } from 'echarts/components'
import type { ComposeOption } from 'echarts/core'
import type { ReleaseTrendPoint, ReleaseTrendResponse } from '@/types/sechub-release'
import { LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { computed } from 'vue'
import VChart from 'vue-echarts'

import { conclusionMeta, rateText } from '../../../composables/releaseDashboardRules'

const props = defineProps<{
  trend: ReleaseTrendResponse | null
  loading: boolean
}>()

use([LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])

type TrendOption = ComposeOption<
  | LineSeriesOption
  | GridComponentOption
  | TooltipComponentOption
  | LegendComponentOption
>

/** 后端最多返回 7 个点（当前 + 6 个更早），页面按任务卡只展示近 6 个 */
const points = computed<ReleaseTrendPoint[]>(() => (props.trend?.list ?? []).slice(-6))

/** 比率折线：缺失点为 `-`（ECharts 断点），按百分比数值展示 */
function rateSeries(key: 'coverage_rate' | 'new_coverage_rate' | 'pass_rate'): Array<number | string> {
  return points.value.map((point) => {
    const value = point[key]
    return value === null ? '-' : Math.round(value * 1000) / 10
  })
}

const option = computed<TrendOption>(() => ({
  tooltip: {
    trigger: 'axis',
    valueFormatter: (value: unknown) => (typeof value === 'number' ? `${value}%` : '无快照'),
  },
  legend: { top: 0 },
  grid: { left: 52, right: 20, top: 36, bottom: 28 },
  xAxis: { type: 'category', data: points.value.map(point => point.iteration_name) },
  yAxis: { type: 'value', min: 0, max: 100, axisLabel: { formatter: '{value}%' } },
  series: [
    { name: '覆盖率', type: 'line', data: rateSeries('coverage_rate') },
    { name: '新增覆盖率', type: 'line', data: rateSeries('new_coverage_rate') },
    { name: '通过率', type: 'line', data: rateSeries('pass_rate') },
  ],
}))

function isMissing(point: ReleaseTrendPoint): boolean {
  return point.conclusion === null && point.coverage_rate === null
}
</script>

<template>
  <a-spin :loading="loading" style="width: 100%">
    <template v-if="points.length">
      <VChart class="trend-chart" :option="option" autoresize />
      <a-table :data="points" :pagination="false" row-key="iteration_id" size="small">
        <template #columns>
          <a-table-column title="迭代" data-index="iteration_name" :width="180" ellipsis tooltip />
          <a-table-column title="快照" :width="150">
            <template #cell="{ record }">
              <a-tag v-if="isMissing(record)" color="gray" size="small">
                无快照
              </a-tag>
              <a-space v-else size="mini">
                <a-tag :color="conclusionMeta(record.conclusion).color" size="small">
                  {{ conclusionMeta(record.conclusion).label }}
                </a-tag>
                <span class="final-hint">{{ record.is_final ? '已定稿' : '未定稿' }}</span>
              </a-space>
            </template>
          </a-table-column>
          <a-table-column title="覆盖率" :width="100">
            <template #cell="{ record }">
              {{ isMissing(record) ? '-' : rateText(record.coverage_rate) }}
            </template>
          </a-table-column>
          <a-table-column title="新增覆盖率" :width="110">
            <template #cell="{ record }">
              {{ isMissing(record) ? '-' : rateText(record.new_coverage_rate) }}
            </template>
          </a-table-column>
          <a-table-column title="通过率" :width="100">
            <template #cell="{ record }">
              {{ isMissing(record) ? '-' : rateText(record.pass_rate) }}
            </template>
          </a-table-column>
          <a-table-column title="新增缺陷" :width="100">
            <template #cell="{ record }">
              {{ isMissing(record) ? '-' : record.new_defects }}
            </template>
          </a-table-column>
          <a-table-column title="高危配置" :width="100">
            <template #cell="{ record }">
              {{ isMissing(record) ? '-' : record.high_config_open }}
            </template>
          </a-table-column>
        </template>
      </a-table>
    </template>
    <a-empty v-else description="暂无趋势数据" />
  </a-spin>
</template>

<style scoped>
.trend-chart {
  height: 260px;
  width: 100%;
}
.final-hint {
  color: var(--color-text-3);
  font-size: 12px;
}
</style>
