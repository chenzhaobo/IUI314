<script setup lang="ts">
// 缺陷治理看板：按项目组 × 领域（安全/性能）汇总治理指标。
// 口径（与后端 issue_governance.rs 一致）：
//   处理中 = 待修复(open/reopened)/修复中 + 验证不通过（复核确认仍在，回待修复）+ AI 复核中（窗口期）；
//   已处理 = 已修复+已验证且未失活（失活自动关闭不计入人工修复）；
//   不处理 = 不处理；修复进度 = 已处理 ÷ (总数 − 不处理)，分母为 0 时显示「— 无待修复」；
//   误报率 = 误报数 ÷ 总数。
import type { TableColumnData } from '@arco-design/web-vue'
import type { DefectGovernanceDashboard, DefectGovernanceMetrics } from '@/types/static-scan'
import { Progress } from '@arco-design/web-vue'
import { BarChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { computed, h, ref } from 'vue'
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

const domainLabels: Record<string, string> = { security: '安全', performance: '性能' }
const domainColors: Record<string, string> = { security: 'red', performance: 'blue' }

/** 明细行：一个项目组一行，安全/性能各占一组指标列（表头按领域分组，避免同一项目组出现两行） */
interface DetailGroupRow {
  row_key: string
  project_group_name: string
  security: DefectGovernanceMetrics | null
  performance: DefectGovernanceMetrics | null
}

const detailRows = computed<DetailGroupRow[]>(() => {
  const byGroup = new Map<string, DetailGroupRow>()
  for (const g of groups.value) {
    const key = g.project_group_id || g.project_group_name
    let row = byGroup.get(key)
    if (!row) {
      row = { row_key: key, project_group_name: g.project_group_name, security: null, performance: null }
      byGroup.set(key, row)
    }
    if (g.domain === 'performance')
      row.performance = g
    else
      row.security = g
  }
  const sum = (r: DetailGroupRow) => (r.security?.total ?? 0) + (r.performance?.total ?? 0)
  return [...byGroup.values()].sort((a, b) => sum(b) - sum(a))
})

/** 修复进度按阈值着色：≥80% 绿、≥40% 蓝、其余橙 */
function progressStatus(v: number): 'success' | 'normal' | 'warning' {
  if (v >= 0.8)
    return 'success'
  if (v >= 0.4)
    return 'normal'
  return 'warning'
}

/**
 * 修复进度的分母（总数 − 不处理）是否 > 0。
 *
 * 全部标不处理（或暂无缺陷）时进度是 0/0，后端兜底给 0 —— 那是「没有分母」，
 * 不是「一条没修」。界面按 0% 渲染会与旁边的「已处理 0 / 不处理 17」自相矛盾，
 * 所以这种情况显示「— 无待修复」。
 */
function hasFixDenominator(m: DefectGovernanceMetrics | null | undefined): boolean {
  return !!m && m.total - m.wont_fix > 0
}

const NO_FIX_DENOMINATOR_HINT = '没有需要修复的缺陷（全部标记为不处理或暂无缺陷），修复进度无分母'

/** 一个领域的 6 个指标列（挂到「安全」「性能」两个分组表头下）。
 *  单元格用列级 render 渲染：这样 12 个指标列不用写 12 个具名插槽 */
function metricColumns(domain: 'security' | 'performance'): TableColumnData[] {
  const pick = (record: Record<string, unknown>): DefectGovernanceMetrics | null => (record[domain] as DefectGovernanceMetrics | null) ?? null
  // 指标列没有对应的顶层字段，用 dataIndex 作列标识（Arco 需要唯一列键，且 render 会覆盖取值）
  return [
    { dataIndex: `${domain}_total`, title: '总数', width: 72, align: 'center', render: ({ record }) => String(pick(record)?.total ?? 0) },
    { dataIndex: `${domain}_in_progress`, title: '处理中', width: 80, align: 'center', render: ({ record }) => String(pick(record)?.in_progress ?? 0) },
    { dataIndex: `${domain}_handled`, title: '已处理', width: 80, align: 'center', render: ({ record }) => String(pick(record)?.handled ?? 0) },
    { dataIndex: `${domain}_wont_fix`, title: '不处理', width: 80, align: 'center', render: ({ record }) => String(pick(record)?.wont_fix ?? 0) },
    {
      dataIndex: `${domain}_progress`,
      title: '修复进度',
      width: 170,
      render: ({ record }) => {
        const m = pick(record)
        // 分母为 0（全不处理 / 无缺陷）：不渲染进度条，别把 0/0 显示成 0%。
        // 这里用行内样式：渲染发生在 Arco 表格的上下文里，scoped 类名挂不上
        if (!hasFixDenominator(m))
          return h('span', { style: { color: 'var(--color-text-3)' }, title: NO_FIX_DENOMINATOR_HINT }, '— 无待修复')
        const v = m?.fix_progress ?? 0
        // Arco 的 percent 是 0~1 比率（组件内部 ×100 才是显示文本），直接传原始比率
        return h(Progress, { percent: v, size: 'small', status: progressStatus(v) })
      },
    },
    {
      dataIndex: `${domain}_fp_rate`,
      title: '误报率',
      width: 92,
      align: 'center',
      render: ({ record }) => {
        const v = pick(record)?.false_positive_rate ?? 0
        return h('span', { class: v > 0.2 ? 'fp-high' : undefined }, `${(v * 100).toFixed(1)}%`)
      },
    },
  ]
}

const columns: TableColumnData[] = [
  { title: '项目组', dataIndex: 'project_group_name', width: 220, ellipsis: true, tooltip: true, fixed: 'left' },
  { title: '安全', dataIndex: 'group_security', children: metricColumns('security') },
  { title: '性能', dataIndex: 'group_performance', children: metricColumns('performance') },
]

/** TOP15 图当前口径：汇总（安全+性能合并）/ 单领域（对应卡片右上角的切换按钮） */
const chartScope = ref<'summary' | 'security' | 'performance'>('summary')

interface ChartRow {
  name: string
  total: number
  in_progress: number
  handled: number
  wont_fix: number
}

/** TOP15 堆叠柱状图：取总数前 15 个项目组 */
const topOption = computed(() => {
  let rows: ChartRow[]
  if (chartScope.value === 'summary') {
    // 汇总口径：一个项目组一根柱，两个领域的指标相加
    rows = detailRows.value.map(r => ({
      name: r.project_group_name,
      total: (r.security?.total ?? 0) + (r.performance?.total ?? 0),
      in_progress: (r.security?.in_progress ?? 0) + (r.performance?.in_progress ?? 0),
      handled: (r.security?.handled ?? 0) + (r.performance?.handled ?? 0),
      wont_fix: (r.security?.wont_fix ?? 0) + (r.performance?.wont_fix ?? 0),
    }))
  }
  else {
    rows = groups.value
      .filter(g => g.domain === chartScope.value)
      .map(g => ({ name: g.project_group_name, total: g.total, in_progress: g.in_progress, handled: g.handled, wont_fix: g.wont_fix }))
  }
  const list = rows.sort((a, b) => b.total - a.total).slice(0, 15).reverse()
  const col = (fn: (r: ChartRow) => number) => list.map(fn)
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { top: 0 },
    // ECharts 6 弃用 grid.containLabel（会打 LegacyGridContainLabel 告警），改用 outerBounds
    grid: { outerBounds: { left: 10, right: 40, top: 30, bottom: 10 } },
    xAxis: { type: 'value', minInterval: 1 },
    yAxis: {
      type: 'category',
      data: list.map(r => r.name),
      axisLabel: { width: 160, overflow: 'truncate' },
    },
    series: [
      { name: '处理中', type: 'bar', stack: 'total', data: col(r => r.in_progress), itemStyle: { color: '#165dff' }, barMaxWidth: 16 },
      { name: '已处理', type: 'bar', stack: 'total', data: col(r => r.handled), itemStyle: { color: '#00b42a' }, barMaxWidth: 16 },
      { name: '不处理', type: 'bar', stack: 'total', data: col(r => r.wont_fix), itemStyle: { color: '#86909c' }, barMaxWidth: 16 },
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
                <!-- 分母为 0（全不处理 / 无缺陷）时进度无意义：显示「—」，别显示 0% -->
                <div v-if="!hasFixDenominator(s)" class="metric-value progress-none" :title="NO_FIX_DENOMINATOR_HINT">
                  —
                </div>
                <!-- Arco 的 percent 是 0~1 比率（组件内部 ×100 才是显示文本），直接传原始比率 -->
                <a-progress v-else :percent="s.fix_progress" size="small" :status="progressStatus(s.fix_progress)" />
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

      <!-- TOP15 项目组分布：右上角切换口径（默认汇总=安全+性能合并） -->
      <a-card :bordered="false" class="m-b-12px" size="small" title="TOP15 项目组缺陷分布">
        <template #extra>
          <a-radio-group v-model="chartScope" type="button" size="small">
            <a-radio value="summary">
              汇总
            </a-radio>
            <a-radio value="security">
              安全
            </a-radio>
            <a-radio value="performance">
              性能
            </a-radio>
          </a-radio-group>
        </template>
        <VChart v-if="topOption.series[0].data.length" :option="topOption" style="height: 320px" autoresize />
        <a-empty v-else description="暂无缺陷数据" />
      </a-card>

      <!-- 项目组明细：一行一个项目组，安全/性能按分组表头并列展示 -->
      <a-card :bordered="false" size="small" title="按项目组明细">
        <a-table
          :data="detailRows"
          :columns="columns"
          :pagination="false"
          row-key="row_key"
          size="small"
          column-resizable
          :scroll="{ x: 1400 }"
        />
      </a-card>
    </a-spin>
  </div>
</template>

<style scoped>
.defect-governance { padding: 0; }
.gen-at { color: var(--color-text-3); font-size: 12px; }
.metric-label { margin-bottom: 6px; color: var(--color-text-3); font-size: 12px; }
.metric-value { font-size: 20px; line-height: 1.2; }
/* 分母为 0 的修复进度：显示「—」，压暗一号免得被当成有效指标 */
.progress-none { color: var(--color-text-3); }
.fp-high { color: rgb(var(--red-6)); font-weight: 600; }
</style>
