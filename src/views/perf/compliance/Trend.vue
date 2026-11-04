<template>
  <div class="page-container">
    <a-card :bordered="false" :body-style="{ padding: '16px' }">
      <!-- 顶部选择器 -->
      <a-row :gutter="12" style="margin-bottom: 12px" align="center">
        <a-col :span="2">
          <a-select v-model="productLine" @change="onProductLineChange">
            <a-option value="星瀚">星瀚</a-option>
            <a-option value="星空">星空</a-option>
          </a-select>
        </a-col>
        <a-col :span="2">
          <a-select v-model="periodType" @change="onPeriodTypeChange">
            <a-option value="monthly">按月</a-option>
            <a-option value="weekly">按周</a-option>
          </a-select>
        </a-col>
        <a-col :span="5">
          <a-select v-model="selectedPeriod" placeholder="选择周期" @change="onPeriodChange">
            <a-option v-for="p in periodOptions" :key="p.period" :value="p.period">{{ p.label }}</a-option>
          </a-select>
        </a-col>
        <a-col :span="4">
          <a-select v-model="customFilter" placeholder="二开过滤">
            <a-option value="">全部</a-option>
            <a-option value="standard_only">仅标品</a-option>
            <a-option value="custom_only">仅二开</a-option>
          </a-select>
        </a-col>
        <a-col :span="11" style="text-align: right">
          <a-button size="small" @click="handleExport">导出CSV</a-button>
        </a-col>
      </a-row>
      <!-- 维度过滤：产品领域/业务领域/项目组/客户/版本，客户与版本走远程搜索 -->
      <a-row :gutter="12" style="margin-bottom: 12px" align="center">
        <a-col :span="3">
          <a-select v-model="productDomain" placeholder="产品领域" allow-clear allow-search @change="onProductDomainFilterChange">
            <a-option v-for="o in productDomainOptions" :key="o.code" :value="o.code">{{ o.name }}</a-option>
          </a-select>
        </a-col>
        <a-col :span="3">
          <a-select v-model="businessArea" placeholder="业务领域" allow-clear allow-search @change="onBusinessAreaFilterChange">
            <a-option v-for="o in businessAreaOptions" :key="o.code" :value="o.code">{{ o.name }}</a-option>
          </a-select>
        </a-col>
        <a-col :span="3">
          <a-select v-model="projectGroupCode" placeholder="项目组" allow-clear allow-search @change="onDimFilterChange">
            <a-option v-for="o in projectGroupOptions" :key="o.code" :value="o.code">{{ o.name }}</a-option>
          </a-select>
        </a-col>
        <a-col :span="4">
          <a-select
            v-model="customer"
            placeholder="客户（可多选）"
            multiple
            :max-tag-count="2"
            allow-clear
            allow-search
            :loading="customerLoading"
            @search="searchCustomerOptions"
            @change="onCustomerFilterChange"
          >
            <a-option v-for="o in customerOptions" :key="o.code" :value="o.code">{{ o.name }}</a-option>
          </a-select>
        </a-col>
        <a-col :span="4">
          <a-select
            v-model="productVersion"
            placeholder="产品版本（可多选）"
            multiple
            :max-tag-count="2"
            allow-clear
            allow-search
            :loading="versionLoading"
            @search="searchProductVersionOptions"
            @change="onVersionFilterChange"
          >
            <a-option v-for="o in productVersionOptions" :key="o.code" :value="o.code">{{ o.name }}</a-option>
          </a-select>
        </a-col>
        <a-col :span="4">
          <a-select
            v-model="cosmicVersion"
            placeholder="苍穹版本（可多选）"
            multiple
            :max-tag-count="2"
            allow-clear
            allow-search
            :loading="versionLoading"
            @search="searchCosmicVersionOptions"
            @change="onVersionFilterChange"
          >
            <a-option v-for="o in cosmicVersionOptions" :key="o.code" :value="o.code">{{ o.name }}</a-option>
          </a-select>
        </a-col>
        <a-col :span="3">
          <a-button size="small" @click="handleResetFilters">重置过滤</a-button>
        </a-col>
      </a-row>

      <!-- 左树右图：高度占满视口剩余空间，利用页面下方空白 -->
      <!-- 外层 flex 行定高：子项靠 flex 派生高度，需父级有确定 height（maxHeight 不算），故用实测 height -->
      <div ref="layoutRow" :style="{ display: 'flex', gap: '16px', minHeight: '480px', height: layoutRowH + 'px' }">
        <!-- 左树 -->
        <!--
          左栏是纵向 flex：搜索框固定、只让树滚（与达标率看板一致）。
          原来 panel-scroll-y 加在整个左栏上，搜索框会跟着滚走。
          min-height:0 是 flex 子项能被压缩的前提，缺了它内部 overflow 不触发。
        -->
        <div style="width: 280px; flex-shrink: 0; border-right: 1px solid #e5e6eb; padding-right: 12px; display: flex; flex-direction: column; min-height: 0">
          <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px">
            <span style="font-size: 12px; color: #86909c; white-space: nowrap">维度</span>
            <a-select v-model="dimension" class="dimension-select" size="small" style="flex: 1" @change="onDimensionChange">
              <a-option v-for="d in DIMENSION_OPTIONS" :key="d.value" :value="d.value">{{ d.label }}</a-option>
            </a-select>
          </div>
          <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px">
            <a-input-search v-model="treeSearch" placeholder="搜索节点" allow-clear style="flex: 1" />
            <a-switch v-model="showCode" size="small" />
            <span style="font-size: 12px; color: #86909c; white-space: nowrap">显示编码</span>
          </div>
          <!-- flex:1 让树区吃掉左栏剩余高度：高度自动派生，无需写死像素 -->
          <div class="panel-scroll-y" style="flex: 1">
            <a-spin :loading="treeLoading" style="width: 100%">
              <a-tree
                v-if="displayTree.length"
                :data="displayTree"
                :field-names="{ key: 'key', title: 'title', children: 'children', isLeaf: 'is_leaf' }"
                :load-more="handleLoadMore"
                show-line
                block-node
                :default-expand-all="false"
                v-model:expanded-keys="expandedKeys"
                :selected-keys="selectedKeys"
                @select="onTreeSelect"
              >
                <template #title="node">
                  <a-tooltip :content="node.subtitle ? `产品版本：${node.subtitle}` : ''" :disabled="!node.subtitle" mini>
                    <span>{{ displayTitle(node) }}</span>
                  </a-tooltip>
                  <span style="margin-left: 6px; font-size: 12px" :style="{ color: rateColor(node.compliance_rate) }">
                    {{ node.compliance_rate?.toFixed(2) }}%
                  </span>
                </template>
              </a-tree>
              <a-empty v-else description="暂无树数据" />
            </a-spin>
          </div>
        </div>

        <!-- 右侧图表 -->
        <!-- 纵向 flex：节点信息条固定，图表吃掉剩余高度，不再写死 calc 留出空白 -->
        <div style="flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column">
          <!-- 当前节点信息 -->
          <div v-if="selectedNode" style="margin-bottom: 12px; padding: 8px 12px; background: #f7f8fa; border-radius: 4px">
            <span style="font-weight: 500">{{ selectedNode.title }}</span>
            <span style="margin-left: 12px; color: #666">最新达标率:</span>
            <span style="margin-left: 4px; font-weight: 500" :style="{ color: rateColor(selectedNode.compliance_rate) }">
              {{ selectedNode.compliance_rate?.toFixed(2) }}%
            </span>
          </div>
          <!--
            原来图表高度写死一个 calc 偏移，比外层行的偏移还多 80px ——
            两者不一致，底部就留出一段空白。改成 flex:1 由外层派生，天然对齐。
            a-spin 是组件，需 :deep 才能让它的根节点参与 flex，故给它显式样式。
          -->
          <a-spin :loading="chartLoading" style="width: 100%; flex: 1; min-height: 0" class="chart-spin">
            <div ref="chartRef" style="height: 100%; min-height: 320px"></div>
          </a-spin>
        </div>
      </div>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted, nextTick } from 'vue'
import * as echarts from 'echarts'
import { ApiPerfCompliance, type ComplianceTreeNode } from '@/api/perfApis'
import { getQueryUrl, rateColor, useAutoHeight, useDownload, useGet, useRequest } from '@/hooks'
import { useComplianceFilters } from '@/views/perf/composables/useComplianceFilters'
import { DIMENSION_OPTIONS, DIMENSION_PARAM, contextParams, useComplianceTree } from '@/views/perf/composables/useComplianceTree'

defineOptions({ name: 'compliance-trend' })

// 左树右图外层 flex 行：实测顶边反推确定高度，供子项 flex:1 派生（详见模板注释）
const layoutRow = ref<HTMLElement>()
const { height: layoutRowH } = useAutoHeight(layoutRow)

const chartRef = ref<HTMLElement>()
let chart: echarts.ECharts | null = null

// ── 周期选择（按周/按月，默认按月） ──────────────────────────────────
const productLine = ref('星瀚')
const dimension = ref('menu')
// 二开过滤：''=全部 | standard_only=仅标品 | custom_only=仅二开
const customFilter = ref('')
const periodType = ref('monthly')
const selectedPeriod = ref('')
const periodOptions = ref<any[]>([])
const periodOptionsPayload = ref<any>({ period_type: 'monthly', product_line: '星瀚' })
const { execute: fetchPeriodOptions } = useGet<any>(ApiPerfCompliance.periodOptions, periodOptionsPayload, {
  immediate: true,
  onSuccess(data: any) {
    periodOptions.value = Array.isArray(data) ? data : []
    if (periodOptions.value.length && !selectedPeriod.value) {
      selectedPeriod.value = periodOptions.value[0].period
      onPeriodChange(selectedPeriod.value)
    }
  },
})

type ArcoSelectionValue = string | number | boolean | Record<string, unknown> | (string | number | boolean | Record<string, unknown>)[]

const onPeriodTypeChange = (pt: ArcoSelectionValue) => {
  if (typeof pt !== 'string') return
  selectedPeriod.value = ''
  periodOptions.value = []
  // 清空树后新周期加载完成会自动重选「全部」，趋势随之重绘
  treeData.value = []
  periodOptionsPayload.value = { period_type: pt, product_line: productLine.value }
  fetchPeriodOptions()
}

// 切换产品线：重置周期/树与全部维度过滤，按新产品线重载可选周期
// （onSuccess 会自动选中首个周期并联动加载）
const onProductLineChange = () => {
  selectedPeriod.value = ''
  periodOptions.value = []
  treeData.value = []
  selectedKeys.value = []
  resetFilters()
  periodOptionsPayload.value = { period_type: periodType.value, product_line: productLine.value }
  fetchPeriodOptions()
}

const onPeriodChange = (period: ArcoSelectionValue) => {
  if (typeof period !== 'string') return
  selectedKeys.value = []
  if (period) reloadTree()
}

const onDimensionChange = () => {
  selectedKeys.value = []
  reloadTree()
}

// ── 维度过滤（与达标率看板共用）：产品领域/业务领域/项目组/客户/版本 ──
const {
  productDomain,
  businessArea,
  projectGroupCode,
  customer,
  productVersion,
  cosmicVersion,
  productDomainOptions,
  businessAreaOptions,
  projectGroupOptions,
  customerOptions,
  productVersionOptions,
  cosmicVersionOptions,
  customerLoading,
  versionLoading,
  onProductDomainFilterChange,
  onBusinessAreaFilterChange,
  onCustomerFilterChange,
  onVersionFilterChange,
  searchCustomerOptions,
  searchProductVersionOptions,
  searchCosmicVersionOptions,
  dimFilterParams,
  resetFilters,
} = useComplianceFilters(productLine, { onChange: onDimFilterChange })

// ── 左树（与达标率看板共用）：树加载、懒加载与维度作用域 key ──
const {
  treeData,
  treeLoading,
  treeSearch,
  selectedKeys,
  expandedKeys,
  showCode,
  wrappedTree,
  displayTree,
  displayTitle,
  findTreeNode,
  reloadTree,
  onLoadMore,
  onTreeSelect,
} = useComplianceTree({
  productLine,
  periodType,
  selectedPeriod,
  dimension,
  customFilter,
  dimFilterParams,
})

// 维度过滤变化 → 重载左树（树加载成功后自动重选「全部」并重拉趋势）
function onDimFilterChange() {
  reloadTree()
}

const handleResetFilters = () => {
  resetFilters()
  onDimFilterChange()
}

const handleLoadMore = (node: unknown) => onLoadMore(node as ComplianceTreeNode)

// 选中节点对象（「全部」用包装节点，保证统计量为整体汇总）
const selectedNode = computed<ComplianceTreeNode | null>(() => {
  const key = selectedKeys.value[0]
  if (!key || key === 'root:all') return wrappedTree.value[0] || null
  return findTreeNode(treeData.value, key)
})

// 树每次重载后自动选中「全部」，触发整体趋势拉取
watch(treeData, () => {
  selectedKeys.value = wrappedTree.value.length ? ['root:all'] : []
})

watch(selectedKeys, () => {
  fetchChildTrends()
})

// ── 趋势数据（按选中节点的下一层级拆分多系列趋势线） ──────────────────────────────────
const chartLoading = ref(false)
// 单图最多展示的趋势线条数（按请求量取 Top N，避免应用/表单级数百条线不可读）
const MAX_TREND_SERIES = 12

// 节点 → trend 接口过滤参数：维度节点用自身值，app/form 额外带上所属客户/版本上下文
const childFilter = (c: ComplianceTreeNode): Record<string, string> => {
  const params: Record<string, string> = {}
  const dimensionParam = DIMENSION_PARAM[c.level]
  if (dimensionParam) params[dimensionParam] = c.code
  else if (c.level === 'cloud') params.cloud_number = c.code
  else if (c.level === 'app') params.app_number = c.code
  else if (c.level === 'form') params.form_id = c.code
  Object.assign(params, contextParams(c))
  return params
}

// 解析选中节点的直接子级：root=树顶层；cloud=树自带应用子级；
// 维度节点/应用=drill 懒加载（顺带回填树）；form=自身（趋势到 form 为止）
const resolveChildren = async (node: ComplianceTreeNode): Promise<ComplianceTreeNode[]> => {
  if (node.level === 'root') return treeData.value
  if (node.level === 'form') return [node]
  if (node.level === 'cloud') return node.children || []
  if (node.children?.length) return node.children
  if (node.level === 'app' || DIMENSION_PARAM[node.level]) {
    await onLoadMore(node)
    const children = node.children || []
    // 趋势视图只到 form 级，表单节点强制标叶子，避免树里出现无法展开的箭头
    if (node.level === 'app') children.forEach(c => { c.is_leaf = true })
    return children
  }
  return []
}

// 拉取并渲染下级多系列趋势：选中「全部」显示顶层各维度/云趋势，选中维度节点显示其下应用趋势，依次类推
const fetchChildTrends = async () => {
  const node = selectedNode.value
  if (!node) return
  chartLoading.value = true
  try {
    let children = await resolveChildren(node)
    // 无子级时显示自身单线（叶子或空节点）
    if (!children.length) children = node.level === 'root' ? [] : [node]
    const top = [...children].sort((a, b) => (b.total_count || 0) - (a.total_count || 0)).slice(0, MAX_TREND_SERIES)
    const base: Record<string, string> = { period_type: periodType.value, product_line: productLine.value, ...dimFilterParams() }
    if (customFilter.value) base.custom_filter = customFilter.value
    const results = await Promise.all(top.map(async (c) => {
      const url = getQueryUrl(ApiPerfCompliance.trend, { ...base, ...childFilter(c) }).value
      const res = await useRequest(url, { immediate: true }).get().json()
      return { name: c.title || c.code, points: Array.isArray(res.data.value) ? res.data.value : [] }
    }))
    renderChart(results, children.length > MAX_TREND_SERIES ? children.length : 0)
  } finally {
    chartLoading.value = false
  }
}

// 构建树节点选中后的趋势过滤参数（图表与导出共用同一套映射）
const buildTrendParams = (): Record<string, string> => {
  const params: Record<string, string> = { period_type: periodType.value, product_line: productLine.value, ...dimFilterParams() }
  if (customFilter.value) params.custom_filter = customFilter.value
  if (selectedNode.value) Object.assign(params, childFilter(selectedNode.value))
  return params
}

// 二开过滤变化 → 重载左树（树加载完成后自动重选「全部」并重拉趋势）
watch(customFilter, () => {
  if (selectedPeriod.value) reloadTree()
})

// ── 图表渲染 ──────────────────────────────────
const resizeChart = () => chart?.resize()

// 渲染多系列趋势：每条线 = 选中节点的一个直接子级；单子级（叶子）时附加超3秒数线
const renderChart = (seriesList: { name: string; points: any[] }[], truncatedTotal = 0) => {
  nextTick(() => {
    if (!chartRef.value) return
    if (!chart) {
      chart = echarts.init(chartRef.value)
      window.addEventListener('resize', resizeChart)
    }

    // x 轴：所有系列周期末日（period_end）并集升序——数据为整周期聚合，标在月/周最后一天比第一天更准确
    const dateSet = new Set<string>()
    seriesList.forEach((s) => s.points.forEach((p: any) => { const d = p.period_end || p.period_start; if (d) dateSet.add(String(d)) }))
    const dates = [...dateSet].sort()
    const hasData = dates.length > 0 && seriesList.length > 0
    const single = seriesList.length === 1

    const series: any[] = seriesList.map((s) => {
      const map = new Map(s.points.map((p: any) => [String(p.period_end || p.period_start), p]))
      return {
        name: s.name,
        type: 'line',
        smooth: true,
        connectNulls: true,
        data: dates.map((d) => { const p: any = map.get(d); return p ? p.compliance_rate : null }),
      }
    })
    if (single) {
      const map = new Map(seriesList[0].points.map((p: any) => [String(p.period_end || p.period_start), p]))
      series.push({
        name: '超3秒数',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        itemStyle: { color: '#f53f3f' },
        data: dates.map((d) => { const p: any = map.get(d); return p ? p.over_3s_count : null }),
      })
    }

    chart.setOption({
      title: !hasData
        ? { text: '暂无趋势数据', left: 'center', top: 'middle', textStyle: { color: '#86909c', fontSize: 14, fontWeight: 'normal' } }
        : truncatedTotal > 0
          ? { text: `共 ${truncatedTotal} 个下级，仅显示请求量 Top ${MAX_TREND_SERIES}`, right: 12, top: 10, textStyle: { color: '#86909c', fontSize: 12, fontWeight: 'normal' } }
          : { text: '' },
      tooltip: {
        trigger: 'axis',
        // 达标率两位小数加百分号；超3秒数保持计数（千分位）
        formatter: (params: any) => {
          const list = Array.isArray(params) ? params : [params]
          // 按达标率值降序排列；超3秒数（计数轴）与无数据系列置底
          list.sort((a: any, b: any) => {
            if (a.seriesName === '超3秒数') return 1
            if (b.seriesName === '超3秒数') return -1
            return (b.value ?? -Infinity) - (a.value ?? -Infinity)
          })
          const lines = [list[0]?.axisValueLabel || list[0]?.name || '']
          list.forEach((p: any) => {
            const v = p.value == null ? '-'
              : p.seriesName === '超3秒数' ? Number(p.value).toLocaleString()
              : `${Number(p.value).toFixed(2)}%`
            lines.push(`${p.marker}${p.seriesName}: ${v}`)
          })
          return lines.join('<br/>')
        },
      },
      // 图例放图表下方，宽度不足自动换行（多系列不再与坐标轴挤压）
      legend: { data: series.map((s) => s.name), bottom: 0, left: 'center' },
      grid: { left: 60, right: 60, bottom: 110, top: 40 },
      xAxis: {
        type: 'category',
        data: dates,
        axisLabel: { rotate: dates.length > 8 ? 30 : 0, hideOverlap: true },
      },
      yAxis: [
        { type: 'value', name: '达标率(%)', min: (v: any) => Math.max(0, Math.floor(v.min - 2)), max: 100 },
        { type: 'value', name: '超3秒数', show: single },
      ],
      series,
    }, true)
    // 容器布局稳定后再测量一次，避免初始宽度未定型导致横轴挤压变形
    chart.resize()
  })
}

// ── 导出 ──────────────────────────────────
// 同 Dashboard：window.open 带不了 Authorization，401 响应会被存成假的导出文件。
const { downloadWithTip } = useDownload()

const handleExport = async () => {
  const params = new URLSearchParams(buildTrendParams()).toString()
  await downloadWithTip(`/perf/compliance/trend/export?${params}`, '达标率趋势.csv', '达标率趋势导出失败')
}

// ── 辅助 ──────────────────────────────────
// 达标率配色与达标率看板/左树共用一份（见 @/hooks 的 rateColor）

onUnmounted(() => {
  window.removeEventListener('resize', resizeChart)
  chart?.dispose()
})
</script>
