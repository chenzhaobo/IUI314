<script setup lang="ts">
// 缺陷治理看板：按项目组 × 领域（安全/性能）汇总治理指标。
// 口径（与后端 issue_governance.rs 一致）：
//   处理中 = 打开/重新打开/修复中；已处理 = 已修复+已验证且未失活（失活自动关闭不计入人工修复）；
//   不处理 = 不处理；修复进度 = 已处理 ÷ (总数 − 不处理)；误报率 = 误报数 ÷ 总数。
import type { DefectGovernanceDashboard, DefectGovernanceGroupRow } from '@/types/static-scan'
import { BarChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { computed, ref } from 'vue'
import VChart from 'vue-echarts'
import { ApiSecPrescan } from '@/api/sechubApis'
import { formatTime, useGet } from '@/hooks'

// 组件名必须与路由 name（= sys_menu.path 'defect-governance'）逐字一致，
// keep-alive :include 才能缓存本页（见 app-main.vue 注释）。
// lint 的 PascalCase 提示只是警告，改名却会让页签缓存失效，所以保持 kebab-case。
// eslint-disable-next-line vue/component-definition-name-casing
defineOptions({ name: 'defect-governance' })

use([BarChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer])

const { data: rawData, isFetching: loading, execute: reload } = useGet<DefectGovernanceDashboard>(ApiSecPrescan.defectGovernance, {}, { immediate: true })
const dashboard = computed(() => rawData.value ?? null)
const summaries = computed(() => dashboard.value?.summaries ?? [])
const groups = computed(() => dashboard.value?.groups ?? [])

/** 表格/图表当前展示的领域 */
const activeDomain = ref<'security' | 'performance'>('security')
const domainGroups = computed(() => groups.value.filter(g => g.domain === activeDomain.value))

const domainLabels: Record<string, string> = { security: '安全', performance: '性能' }
const domainColors: Record<string, string> = { security: 'red', performance: 'blue' }

/** 修复进度按阈值着色：≥80% 绿、≥40% 蓝、其余橙 */
function progressStatus(v: number): 'success' | 'normal' | 'warning' {
  if (v >= 0.8)
    return 'success'
  if (v >= 0.4)
    return 'normal'
  return 'warning'
}

function percent(v: number): number {
  return Math.round((v ?? 0) * 100)
}

const columns: Array<Record<string, unknown>> = [
  { title: '项目组', dataIndex: 'project_group_name', width: 200 },
  { title: '总数', dataIndex: 'total', width: 80 },
  { title: '处理中', dataIndex: 'in_progress', width: 80 },
  { title: '已处理', dataIndex: 'handled', width: 80 },
  { title: '不处理', dataIndex: 'wont_fix', width: 80 },
  { title: '修复进度', dataIndex: 'fix_progress', slotName: 'progress', width: 220 },
  { title: '误报率', dataIndex: 'false_positive_rate', slotName: 'fpRate', width: 120 },
]

/** TOP15 项目组堆叠柱状图（当前领域） */
const topOption = computed(() => {
  const list = [...domainGroups.value].sort((a, b) => b.total - a.total).slice(0, 15).reverse()
  const col = (fn: (g: DefectGovernanceGroupRow) => number) => list.map(fn)
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { top: 0 },
    // ECharts 6 弃用 grid.containLabel（会打 LegacyGridContainLabel 告警），改用 outerBounds
    grid: { outerBounds: { left: 10, right: 40, top: 30, bottom: 10 } },
    xAxis: { type: 'value', minInterval: 1 },
    yAxis: {
      type: 'category',
      data: list.map(g => g.project_group_name),
      axisLabel: { width: 140, overflow: 'truncate' },
    },
    series: [
      { name: '处理中', type: 'bar', stack: 'total', data: col(g => g.in_progress), itemStyle: { color: '#165dff' }, barMaxWidth: 16 },
      { name: '已处理', type: 'bar', stack: 'total', data: col(g => g.handled), itemStyle: { color: '#00b42a' }, barMaxWidth: 16 },
      { name: '不处理', type: 'bar', stack: 'total', data: col(g => g.wont_fix), itemStyle: { color: '#86909c' }, barMaxWidth: 16 },
    ],
  }
})
</script>

<template>
  <div class="defect-governance">
    <a-card :bordered="false" class="m-b-12px">
      <a-space>
        <a-button :loading="loading" @click="reload()">
          刷新
        </a-button>
        <span v-if="dashboard" class="gen-at">数据时间：{{ formatTime(dashboard.generated_at) }}</span>
      </a-space>
    </a-card>

    <a-spin :loading="loading" style="width: 100%">
      <!-- 全平台汇总：安全 / 性能 各一张 -->
      <a-row :gutter="12" class="m-b-12px">
        <a-col v-for="s in summaries" :key="s.domain" :span="12">
          <a-card :bordered="false" size="small">
            <template #title>
              <a-tag :color="domainColors[s.domain] ?? 'gray'" size="small">
                {{ domainLabels[s.domain] ?? s.domain }}
              </a-tag>
            </template>
            <a-row :gutter="8" align="center">
              <a-col :span="4">
                <a-statistic title="总数" :value="s.total" />
              </a-col>
              <a-col :span="4">
                <a-statistic title="处理中" :value="s.in_progress" :value-style="{ color: '#165dff' }" />
              </a-col>
              <a-col :span="4">
                <a-statistic title="已处理" :value="s.handled" :value-style="{ color: '#00b42a' }" />
              </a-col>
              <a-col :span="4">
                <a-statistic title="不处理" :value="s.wont_fix" />
              </a-col>
              <a-col :span="4">
                <div class="metric-label">
                  修复进度
                </div>
                <a-progress :percent="percent(s.fix_progress)" size="small" :status="progressStatus(s.fix_progress)" />
              </a-col>
              <a-col :span="4">
                <div class="metric-label">
                  误报率
                </div>
                <div class="metric-value" :class="{ 'fp-high': s.false_positive_rate > 0.2 }">
                  {{ (s.false_positive_rate * 100).toFixed(1) }}%
                </div>
              </a-col>
            </a-row>
          </a-card>
        </a-col>
      </a-row>

      <!-- TOP15 项目组分布 -->
      <a-card :bordered="false" class="m-b-12px" size="small" title="TOP15 项目组缺陷分布">
        <VChart v-if="topOption.series[0].data.length" :option="topOption" style="height: 320px" autoresize />
        <a-empty v-else description="暂无缺陷数据" />
      </a-card>

      <!-- 项目组明细（按领域切换） -->
      <a-card :bordered="false" size="small" title="按项目组明细">
        <template #extra>
          <a-radio-group v-model="activeDomain" type="button" size="small">
            <a-radio value="security">
              安全领域
            </a-radio>
            <a-radio value="performance">
              性能领域
            </a-radio>
          </a-radio-group>
        </template>
        <a-table
          :data="domainGroups"
          :columns="columns"
          :pagination="false"
          row-key="project_group_id"
          size="small"
          column-resizable
        >
          <template #progress="{ record }">
            <a-progress :percent="percent(record.fix_progress)" size="small" :status="progressStatus(record.fix_progress)" />
          </template>
          <template #fpRate="{ record }">
            <span :class="{ 'fp-high': record.false_positive_rate > 0.2 }">
              {{ (record.false_positive_rate * 100).toFixed(1) }}%
            </span>
          </template>
        </a-table>
      </a-card>
    </a-spin>
  </div>
</template>

<style scoped>
.defect-governance { padding: 0; }
.gen-at { color: var(--color-text-3); font-size: 12px; }
.metric-label { margin-bottom: 6px; color: var(--color-text-3); font-size: 12px; }
.metric-value { font-size: 20px; line-height: 1.2; }
.fp-high { color: rgb(var(--red-6)); font-weight: 600; }
</style>
