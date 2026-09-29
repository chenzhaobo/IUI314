<script setup lang="ts">
// 缺陷治理看板：按项目组 × 领域（安全/性能）汇总治理指标。
// 口径（与后端 issue_governance.rs 一致）：
//   处理中 = 待修复(open/reopened)/修复中 + 验证不通过（复核确认仍在，回待修复）+ AI 复核中（窗口期）；
//   已处理 = 已修复+已验证且未失活（失活自动关闭不计入人工修复）；
//   不处理 = 不处理；修复进度 = 已处理 ÷ (总数 − 不处理)，分母为 0 时显示「— 无待修复」；
//   误报率 = 误报数 ÷ 总数。
//   优先级分档 = 仅统计处理中，按 risk_level 分 6 档（严重/高/中/低/提示/未定级），
//   六档之和恒等于处理中；「未定级」= risk_level 为空的存量缺陷。
//   计划完成 = 也仅统计处理中（已处理/不处理不该被催）：标注率 = 已标注 ÷ (已标注+未标注)；
//   已超期 = 业务时区今天 > 计划日（计划日当天不算）；3天内到期 = 今天 ≤ 计划日 ≤ 今天+3；
//   高危超期 = 超期且 risk_level 为 critical/high。
// 过滤：来源（扫描/导入）+ 产品领域（默认集团财务）+ 业务领域，三者同时生效。
import type { TableColumnData } from '@arco-design/web-vue'
import type { DefectGovernanceDashboard, DefectGovernanceGroupRow, DefectGovernanceMetrics, DefectGovernancePlanStats, DefectGovernancePriorityCounts } from '@/types/static-scan'
import { Message, Progress } from '@arco-design/web-vue'
import { BarChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { computed, h, ref } from 'vue'
import VChart from 'vue-echarts'
import { ApiSecPrescan } from '@/api/sechubApis'
import { formatTime, useDicts, useGet } from '@/hooks'

// 组件名必须与路由 name（= sys_menu.path 'defect-governance'）逐字一致，
// keep-alive :include 才能缓存本页（见 app-main.vue 注释）。
// lint 的 PascalCase 提示只是警告，改名却会让页签缓存失效，所以保持 kebab-case。
// eslint-disable-next-line vue/component-definition-name-casing
defineOptions({ name: 'defect-governance' })

use([BarChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer])

/**
 * 过滤条件：来源（scan=扫描检出 / import=Excel 导入）、产品领域（默认集团财务）、业务领域。
 * vueuse 的 useFetch 不监听 url，筛选项变更后必须显式 reload()。
 */
const queryParams = ref({ source: '', product_domain: '集团财务', business_area: '' })

const { data: rawData, isFetching: loading, execute: reload } = useGet<DefectGovernanceDashboard>(ApiSecPrescan.defectGovernance, queryParams, { immediate: true })
const dashboard = computed(() => rawData.value ?? null)
const summaries = computed(() => dashboard.value?.summaries ?? [])
const groups = computed(() => dashboard.value?.groups ?? [])

// 领域下拉取自项目组字典（与项目组管理页同源），过滤按值精确匹配项目组字段
const dicts = useDicts('sec_pg_product_domain', 'sec_pg_business_area')
const productDomainOptions = computed(() => (dicts.value.sec_pg_product_domain ?? []).map(d => ({ label: d.label, value: d.value })))
const businessAreaOptions = computed(() => (dicts.value.sec_pg_business_area ?? []).map(d => ({ label: d.label, value: d.value })))

const domainLabels: Record<string, string> = { security: '安全', performance: '性能' }
const domainColors: Record<string, string> = { security: 'red', performance: 'blue' }

/** 明细行：一个项目组一行，安全/性能各占一组指标列（表头按领域分组，避免同一项目组出现两行） */
interface DetailGroupRow {
  row_key: string
  project_group_name: string
  security: DefectGovernanceGroupRow | null
  performance: DefectGovernanceGroupRow | null
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

/** 计划标注率 = 已标注 ÷ (已标注 + 未标注)，即「处理中里标了日期的比例」；没有处理中时返回 null */
function planSetRate(plan?: DefectGovernancePlanStats): number | null {
  const denom = (plan?.set ?? 0) + (plan?.missing ?? 0)
  return denom > 0 ? (plan?.set ?? 0) / denom : null
}

function planRateText(plan?: DefectGovernancePlanStats): string {
  const rate = planSetRate(plan)
  return rate === null ? '—' : `${(rate * 100).toFixed(0)}%`
}

/** 标注率低于 60% 时给个提醒色（通报里它是催标注的抓手） */
function planRateClass(plan?: DefectGovernancePlanStats): string | undefined {
  const rate = planSetRate(plan)
  return rate !== null && rate < 0.6 ? 'metric-warn' : undefined
}

/** 卡片那行计划摘要的完整明细（悬停看） */
function planHint(plan?: DefectGovernancePlanStats): string {
  if (!plan)
    return ''
  return `已标注 ${plan.set} · 未标注 ${plan.missing} · 已超期 ${plan.overdue} · 3天内到期 ${plan.due_soon} · 高危超期 ${plan.high_overdue} · 计划日距今>30天 ${plan.far_future}（都只算处理中）`
}

// ===== 通报文本：把当前筛选下的看板排成可直接粘进群里的周报 =====
// 口径与看板一致（都只算处理中）；不做自动推送 —— 平台已有一套周期报告任务，
// 要做群推送应复用它，而不是在这里再写一套。

/** 通报里带出的项目组条数（处理中降序） */
const REPORT_TOP_N = 15
const reportVisible = ref(false)
const reportText = ref('')

const FILTER_LABELS: Record<string, string> = {
  project_group_id: '项目组',
  repository_id: '应用',
  domain: '领域',
  status: '状态',
  risk_level: '风险',
  source: '来源',
  business_area: '业务领域',
  product_domain: '产品领域',
  plan_finish: '计划完成',
  wont_fix_reason_code: '不处理原因',
  dmp_defect_code: 'DMP 编码',
  defect_code: '缺陷编号',
  assignee: '负责人',
  rule_version_id: '规则',
  scan_point_id: '扫描点',
}
const VALUE_LABELS: Record<string, string> = {
  scan: '扫描',
  import: '导入',
  security: '安全',
  performance: '性能',
  __overdue__: '已超期',
  __due_soon__: '3天内到期',
  __none__: '未标注',
  __planned__: '已标注',
  __ai_direct__: 'AI 直判',
  __pending_fix__: '待修复',
  __unclassified__: '未分类',
}

/** 两个领域的计划统计相加（通报按项目组合计，不拆领域） */
function mergedPlan(row: DetailGroupRow): DefectGovernancePlanStats {
  const out: DefectGovernancePlanStats = { set: 0, missing: 0, overdue: 0, due_soon: 0, high_overdue: 0, far_future: 0, overdue_max_days: 0 }
  for (const metrics of [row.security, row.performance]) {
    const plan = metrics?.plan
    if (!plan)
      continue
    out.set += plan.set
    out.missing += plan.missing
    out.overdue += plan.overdue
    out.due_soon += plan.due_soon
    out.high_overdue += plan.high_overdue
    out.far_future += plan.far_future
    out.overdue_max_days = Math.max(out.overdue_max_days, plan.overdue_max_days)
  }
  return out
}

function groupInProgress(row: DetailGroupRow): number {
  return (row.security?.in_progress ?? 0) + (row.performance?.in_progress ?? 0)
}

function fmtPercent(value: number): string {
  return `${(value * 100).toFixed(0)}%`
}

/** 生成通报正文（当前筛选范围 + 领域汇总 + 项目组点名） */
function buildReportText(): string {
  const dash = dashboard.value
  if (!dash)
    return ''
  const scope = Object.entries(queryParams.value)
    .filter(([key, value]) => !['page_num', 'page_size', 'sort_by', 'sort_order'].includes(key) && value !== '' && value != null)
    .map(([key, value]) => `${FILTER_LABELS[key] ?? key}=${VALUE_LABELS[String(value)] ?? value}`)
  const lines: string[] = [
    `缺陷治理进展（数据时间 ${formatTime(dash.generated_at)}）`,
    `范围：${scope.length ? scope.join('；') : '全部'}`,
    '',
  ]
  for (const s of summaries.value) {
    const plan = s.plan
    const overdue = plan.overdue > 0 && plan.overdue_max_days > 0 ? `${plan.overdue}（最久 ${plan.overdue_max_days} 天）` : String(plan.overdue)
    lines.push(`【${domainLabels[s.domain] ?? s.domain}】总数 ${s.total} · 处理中 ${s.in_progress} · 已处理 ${s.handled} · 不处理 ${s.wont_fix} · 修复进度 ${fmtPercent(s.fix_progress)} · 误报率 ${fmtPercent(s.false_positive_rate)}`)
    lines.push(`  计划完成：标注率 ${planRateText(plan)} · 已超期 ${overdue} · 未标注 ${plan.missing} · 3天内到期 ${plan.due_soon} · 高危超期 ${plan.high_overdue}${plan.far_future > 0 ? ` · 计划日>30天 ${plan.far_future}` : ''}`)
  }
  const rows = [...detailRows.value].sort((a, b) => groupInProgress(b) - groupInProgress(a)).slice(0, REPORT_TOP_N)
  const named = rows.filter(row => groupInProgress(row) > 0)
  lines.push('', `【按项目组（处理中降序，共 ${named.length} 个组）】`)
  for (const [index, row] of named.entries()) {
    const plan = mergedPlan(row)
    const rate = plan.set + plan.missing > 0 ? fmtPercent(plan.set / (plan.set + plan.missing)) : '—'
    lines.push(`${index + 1}. ${row.project_group_name}：处理中 ${groupInProgress(row)} · 已超期 ${plan.overdue}${plan.overdue_max_days > 0 ? `（最久 ${plan.overdue_max_days} 天）` : ''} · 高危超期 ${plan.high_overdue} · 未标注 ${plan.missing} · 标注率 ${rate}`)
  }
  lines.push('', '口径：都只算「处理中」（待修复/修复中/验证不通过/AI 复核中）；超期 = 业务时区今天 > 计划完成时间，计划日当天不算超期。')
  return lines.join('\n')
}

async function copyReport() {
  try {
    await navigator.clipboard.writeText(reportText.value)
    Message.success('已复制，可直接粘贴到群里')
  }
  catch {
    // 非安全上下文（http://内网IP）下 clipboard 不可用，退回手动全选复制
    Message.info('浏览器不允许直接复制，请手动全选文本复制')
  }
}

function openReport() {
  reportText.value = buildReportText()
  reportVisible.value = true
}

/** 一个领域的 6 个指标列（挂到「安全」「性能」两个分组表头下）。
 *  单元格用列级 render 渲染：这样 12 个指标列不用写 12 个具名插槽 */
function metricColumns(domain: 'security' | 'performance'): TableColumnData[] {
  const pick = (record: Record<string, unknown>): DefectGovernanceGroupRow | null => (record[domain] as DefectGovernanceGroupRow | null) ?? null
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
    // —— 计划完成（只算处理中；见后端 PlanStats 的口径）——
    // 单元格一律用行内样式：render 出来的 vnode 在 Arco 表格上下文里，scoped 类名挂不上
    { dataIndex: `${domain}_plan_set`, title: '已标注', width: 76, align: 'center', render: ({ record }) => String(pick(record)?.plan?.set ?? 0) },
    {
      dataIndex: `${domain}_plan_missing`,
      title: '未标注',
      width: 76,
      align: 'center',
      render: ({ record }) => {
        const v = pick(record)?.plan?.missing ?? 0
        return h('span', { style: v > 0 ? { color: 'rgb(var(--orange-6))' } : undefined, title: v > 0 ? '处理中但没标计划完成时间 —— 通报要按这个数催标注（不填就无从判断延期）' : undefined }, String(v))
      },
    },
    { dataIndex: `${domain}_plan_due_soon`, title: '3天内到期', width: 92, align: 'center', render: ({ record }) => String(pick(record)?.plan?.due_soon ?? 0) },
    {
      dataIndex: `${domain}_plan_overdue`,
      title: '已超期',
      width: 80,
      align: 'center',
      render: ({ record }) => {
        const plan = pick(record)?.plan
        const v = plan?.overdue ?? 0
        const hint = `已超期 ${v} · 其中高危 ${plan?.high_overdue ?? 0} · 3天内到期 ${plan?.due_soon ?? 0} · 计划日>30天 ${plan?.far_future ?? 0}`
        return h('span', { style: v > 0 ? { color: 'rgb(var(--red-6))', fontWeight: 600 } : undefined, title: hint }, String(v))
      },
    },
  ]
}

const columns: TableColumnData[] = [
  { title: '项目组', dataIndex: 'project_group_name', width: 220, ellipsis: true, tooltip: true, fixed: 'left' },
  { title: '安全', dataIndex: 'group_security', children: metricColumns('security') },
  { title: '性能', dataIndex: 'group_performance', children: metricColumns('performance') },
]

/** 优先级档位（列序：严重 → 未定级，与后端 PriorityCounts 字段序一致） */
const priorityBuckets: { key: keyof DefectGovernancePriorityCounts, label: string }[] = [
  { key: 'critical', label: '严重' },
  { key: 'high', label: '高' },
  { key: 'medium', label: '中' },
  { key: 'low', label: '低' },
  { key: 'info', label: '提示' },
  { key: 'unclassified', label: '未定级' },
]

/** 优先级明细的列：处理中 + 六个档位的数量（同样挂到「安全」「性能」分组表头下） */
function priorityMetricColumns(domain: 'security' | 'performance'): TableColumnData[] {
  const pick = (record: Record<string, unknown>): DefectGovernanceGroupRow | null => (record[domain] as DefectGovernanceGroupRow | null) ?? null
  return [
    { dataIndex: `${domain}_pri_in_progress`, title: '处理中', width: 80, align: 'center', render: ({ record }) => String(pick(record)?.in_progress ?? 0) },
    ...priorityBuckets.map((bucket): TableColumnData => ({
      dataIndex: `${domain}_pri_${bucket.key}`,
      title: bucket.label,
      width: 72,
      align: 'center',
      render: ({ record }) => String(pick(record)?.in_progress_by_priority?.[bucket.key] ?? 0),
    })),
    // 优先级 × 超期的交叉：高危且超期才是真正要催的那批
    {
      dataIndex: `${domain}_pri_high_overdue`,
      title: '高危超期',
      width: 84,
      align: 'center',
      render: ({ record }) => {
        const v = pick(record)?.plan?.high_overdue ?? 0
        return h('span', { style: v > 0 ? { color: 'rgb(var(--red-6))', fontWeight: 600 } : undefined, title: '处理中 · 已超期 · 且风险为严重/高' }, String(v))
      },
    },
  ]
}

const priorityColumns: TableColumnData[] = [
  { title: '项目组', dataIndex: 'project_group_name', width: 220, ellipsis: true, tooltip: true, fixed: 'left' },
  { title: '安全', dataIndex: 'group_security_priority', children: priorityMetricColumns('security') },
  { title: '性能', dataIndex: 'group_performance_priority', children: priorityMetricColumns('performance') },
]

/** TOP15 图当前口径：汇总（安全+性能合并）/ 单领域（对应卡片右上角的切换按钮） */
const chartScope = ref<'summary' | 'security' | 'performance'>('summary')

interface ChartRow {
  name: string
  total: number
  in_progress: number
  handled: number
  wont_fix: number
  /** 处理中里已超期的部分（是 in_progress 的子集，堆叠时把它从处理中里拆出来） */
  overdue: number
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
      overdue: (r.security?.plan?.overdue ?? 0) + (r.performance?.plan?.overdue ?? 0),
    }))
  }
  else {
    rows = groups.value
      .filter(g => g.domain === chartScope.value)
      .map(g => ({ name: g.project_group_name, total: g.total, in_progress: g.in_progress, handled: g.handled, wont_fix: g.wont_fix, overdue: g.plan?.overdue ?? 0 }))
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
      // 处理中拆成「已超期（红）+ 未超期（蓝）」两段：超期是处理中的子集，
      // 拆开显示既不破坏「堆叠 = 总数」，又能把超期一眼顶出来
      { name: '处理中·已超期', type: 'bar', stack: 'total', data: col(r => r.overdue), itemStyle: { color: '#f53f3f' }, barMaxWidth: 16 },
      { name: '处理中·未超期', type: 'bar', stack: 'total', data: col(r => r.in_progress - r.overdue), itemStyle: { color: '#165dff' }, barMaxWidth: 16 },
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
        <a-select v-model="queryParams.source" allow-clear placeholder="来源" style="width: 110px" @change="reload()">
          <a-option value="scan">
            扫描
          </a-option>
          <a-option value="import">
            导入
          </a-option>
        </a-select>
        <a-select v-model="queryParams.product_domain" allow-clear placeholder="产品领域" style="width: 160px" @change="reload()">
          <a-option v-for="opt in productDomainOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </a-option>
        </a-select>
        <a-select v-model="queryParams.business_area" allow-clear placeholder="业务领域" style="width: 140px" @change="reload()">
          <a-option v-for="opt in businessAreaOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </a-option>
        </a-select>
        <a-button :loading="loading" @click="reload()">
          刷新
        </a-button>
        <!-- 通报文本：按当前筛选排好直接粘进群（口径与看板列一致） -->
        <a-tooltip content="把当前筛选范围下的看板排成周报文本，可直接粘贴到群里" mini>
          <a-button :disabled="!dashboard" @click="openReport">
            通报文本
          </a-button>
        </a-tooltip>
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
              <!-- 计划完成：只算处理中；「未标注」必须露出来 —— 项目组不填日期就无从判断延期 -->
              <a-col :span="24">
                <div class="plan-line" :title="planHint(s.plan)">
                  计划完成：标注率
                  <span :class="planRateClass(s.plan)">{{ planRateText(s.plan) }}</span>
                  · 已超期 <span :class="{ 'metric-alert': (s.plan?.overdue ?? 0) > 0 }">{{ s.plan?.overdue ?? 0 }}</span>
                  · 未标注 <span :class="{ 'metric-warn': (s.plan?.missing ?? 0) > 0 }">{{ s.plan?.missing ?? 0 }}</span>
                  · 3天内到期 {{ s.plan?.due_soon ?? 0 }}
                  · 高危超期 <span :class="{ 'metric-alert': (s.plan?.high_overdue ?? 0) > 0 }">{{ s.plan?.high_overdue ?? 0 }}</span>
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
          :scroll="{ x: 2020 }"
        />
      </a-card>

      <!-- 优先级明细：只统计处理中的缺陷，行序与上方「按项目组明细」一致，便于上下对照 -->
      <a-card :bordered="false" size="small" class="m-t-12px">
        <template #title>
          按项目组优先级明细（处理中）
          <span class="title-hint">未定级 = 风险等级为空的存量缺陷</span>
        </template>
        <a-table
          :data="detailRows"
          :columns="priorityColumns"
          :pagination="false"
          row-key="row_key"
          size="small"
          column-resizable
          :scroll="{ x: 1420 }"
        />
      </a-card>
    </a-spin>

    <!-- 通报文本：只读文本框（内网 http 下 clipboard 常被浏览器禁掉，手动全选也能拿） -->
    <a-modal
      v-model:visible="reportVisible"
      title="缺陷治理通报文本"
      :width="760"
      :footer="false"
      unmount-on-close
    >
      <a-textarea v-model="reportText" :auto-size="{ minRows: 14, maxRows: 22 }" readonly />
      <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px">
        <a-button type="primary" @click="copyReport">
          复制
        </a-button>
        <a-button @click="reportVisible = false">
          关闭
        </a-button>
      </div>
    </a-modal>
  </div>
</template>

<style scoped>
.defect-governance { padding: 0; }
.gen-at { color: var(--color-text-3); font-size: 12px; }
/* 卡片标题旁的补充说明（未定级口径），压小压暗避免抢主标题 */
.title-hint { margin-left: 8px; color: var(--color-text-3); font-size: 12px; font-weight: 400; }
.metric-label { margin-bottom: 6px; color: var(--color-text-3); font-size: 12px; }
.metric-value { font-size: 20px; line-height: 1.2; }
/* 分母为 0 的修复进度：显示「—」，压暗一号免得被当成有效指标 */
.progress-none { color: var(--color-text-3); }
.fp-high { color: rgb(var(--red-6)); font-weight: 600; }
/* 计划完成那行摘要：紧跟六个统计指标之下，压小压暗不抢主指标 */
.plan-line { margin-top: 10px; color: var(--color-text-3); font-size: 12px; line-height: 20px; }
/* 超期/高危超期用红，未标注/低标注率用橙（橙色是「该去推了」而不是「已出问题」） */
.metric-alert { color: rgb(var(--red-6)); font-weight: 600; }
.metric-warn { color: rgb(var(--orange-6)); font-weight: 600; }
</style>
