<template>
  <div class="container">
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
        <a-col :span="4">
          <a-select v-model="selectedPeriod" placeholder="选择周期" @change="onPeriodChange">
            <a-option v-for="p in periodOptions" :key="p.period" :value="p.period">{{ p.label }}</a-option>
          </a-select>
        </a-col>
        <a-col :span="3">
          <a-select v-model="customFilter" placeholder="二开过滤">
            <a-option value="">全部</a-option>
            <a-option value="standard_only">仅标品</a-option>
            <a-option value="custom_only">仅二开</a-option>
          </a-select>
        </a-col>
        <!-- 维度过滤：产品领域/业务领域/项目组，级联收窄选项 -->
        <a-col :span="5">
          <a-select v-model="productDomain" placeholder="产品领域" allow-clear allow-search @change="onProductDomainFilterChange">
            <a-option v-for="o in productDomainOptions" :key="o.code" :value="o.code">{{ o.name }}</a-option>
          </a-select>
        </a-col>
        <a-col :span="4">
          <a-select v-model="businessArea" placeholder="业务领域" allow-clear allow-search @change="onBusinessAreaFilterChange">
            <a-option v-for="o in businessAreaOptions" :key="o.code" :value="o.code">{{ o.name }}</a-option>
          </a-select>
        </a-col>
        <a-col :span="4">
          <a-select v-model="projectGroupCode" placeholder="项目组" allow-clear allow-search @change="onDimFilterChange">
            <a-option v-for="o in projectGroupOptions" :key="o.code" :value="o.code">{{ o.name }}</a-option>
          </a-select>
        </a-col>
      </a-row>
      <a-row :gutter="16" style="margin-bottom: 12px" align="center">
        <a-col :span="20">
          <a-radio-group v-model="dimension" type="button" @change="onDimensionChange">
            <a-radio value="menu">菜单</a-radio>
            <a-radio value="project_group">项目组</a-radio>
            <a-radio value="business_area">业务领域</a-radio>
            <a-radio value="product_domain">产品领域</a-radio>
          </a-radio-group>
        </a-col>
        <a-col :span="4" style="text-align: right">
          <a-button size="small" @click="handleExport">导出CSV</a-button>
        </a-col>
      </a-row>

      <!-- 左树右图：高度占满视口剩余空间，利用页面下方空白 -->
      <div :style="{ display: 'flex', gap: '16px', minHeight: '480px', height: 'calc(100vh - 300px)' }">
        <!-- 左树 -->
        <div style="width: 280px; flex-shrink: 0; border-right: 1px solid #e5e6eb; padding-right: 12px; overflow-y: auto">
          <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px">
            <a-input-search v-model="treeSearch" placeholder="搜索节点" allow-clear style="flex: 1" />
            <a-switch v-model="showCode" size="small" />
            <span style="font-size: 12px; color: #86909c; white-space: nowrap">显示编码</span>
          </div>
          <a-spin :loading="treeLoading" style="width: 100%">
            <a-tree
              v-if="displayTree.length"
              :data="displayTree"
              :field-names="{ key: 'key', title: 'title', children: 'children', isLeaf: 'is_leaf' }"
              :load-more="onLoadMore"
              show-line
              block-node
              :selected-keys="selectedKeys"
              @select="onTreeSelect"
            >
              <template #title="node">
                <span>{{ displayTitle(node) }}</span>
                <span style="margin-left: 6px; font-size: 12px" :style="{ color: getRateColor(node.compliance_rate) }">
                  {{ node.compliance_rate?.toFixed(2) }}%
                </span>
              </template>
            </a-tree>
            <a-empty v-else description="暂无树数据" />
          </a-spin>
        </div>

        <!-- 右侧图表 -->
        <div style="flex: 1; min-width: 0">
          <!-- 当前节点信息 -->
          <div v-if="selectedNode" style="margin-bottom: 12px; padding: 8px 12px; background: #f7f8fa; border-radius: 4px">
            <span style="font-weight: 500">{{ selectedNode.title }}</span>
            <span style="margin-left: 12px; color: #666">最新达标率:</span>
            <span style="margin-left: 4px; font-weight: 500" :style="{ color: getRateColor(selectedNode.compliance_rate) }">
              {{ selectedNode.compliance_rate?.toFixed(2) }}%
            </span>
          </div>
          <a-spin :loading="chartLoading" style="width: 100%">
            <div ref="chartRef" :style="{ height: 'calc(100vh - 380px)', minHeight: '420px' }"></div>
          </a-spin>
        </div>
      </div>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted, nextTick } from 'vue'
import * as echarts from 'echarts'
import { ApiPerfCompliance } from '@/api/perfApis'
import { useGet, useRequest, getQueryUrl, useDownload } from '@/hooks'

defineOptions({ name: 'compliance-trend' })

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
  treeData.value = []
  periodOptionsPayload.value = { period_type: pt, product_line: productLine.value }
  fetchPeriodOptions()
  // 趋势图粒度随周期类型变化
  fetchChildTrends()
}

// 切换产品线：重置周期/树，按新产品线重载可选周期（onSuccess 会自动选中首个周期并联动加载）
const onProductLineChange = () => {
  selectedPeriod.value = ''
  periodOptions.value = []
  treeData.value = []
  selectedKeys.value = []
  selectedNode.value = null
  periodOptionsPayload.value = { period_type: periodType.value, product_line: productLine.value }
  fetchPeriodOptions()
}

const onPeriodChange = (period: ArcoSelectionValue) => {
  if (typeof period !== 'string') return
  selectedKeys.value = []
  selectedNode.value = null
  if (period) reloadTree()
}

const onDimensionChange = () => {
  selectedKeys.value = []
  selectedNode.value = null
  reloadTree()
  // 选中节点变化会触发 watch 自动重拉趋势，此处不重复调用
}

// ── 树数据（来自所选周期） ──────────────────────────────────
const treeData = ref<any[]>([])
const treeLoading = ref(false)
const treeSearch = ref('')
const selectedKeys = ref<string[]>([])
const selectedNode = ref<any>(null)

const treePayload = ref<any>({})
const { execute: fetchTree } = useGet<any>(ApiPerfCompliance.tree, treePayload, {
  immediate: false,
  onSuccess(data: any) {
    treeData.value = Array.isArray(data) ? data : []
    // 自动选中“全部”根节点，触发整体趋势拉取（点全部展示其下所有汇总趋势）
    if (wrappedTree.value.length) {
      selectedKeys.value = ['root:all']
      selectedNode.value = wrappedTree.value[0]
    } else {
      selectedKeys.value = []
      selectedNode.value = null
    }
  },
})

// 包装“全部”根节点（聚合顶层节点统计量），点全部展示其下所有汇总趋势
const wrappedTree = computed(() => {
  if (!treeData.value.length) return []
  const tc = treeData.value.reduce((s: number, n: any) => s + (n.total_count || 0), 0)
  const oc = treeData.value.reduce((s: number, n: any) => s + (n.over_3s_count || 0), 0)
  return [{
    key: 'root:all',
    code: 'all',
    title: '全部',
    level: 'root',
    total_count: tc,
    over_3s_count: oc,
    compliance_rate: tc > 0 ? ((tc - oc) / tc) * 100 : 100,
    is_leaf: false,
    children: treeData.value,
  }]
})

// ── 维度过滤（产品领域/业务领域/项目组）：级联收窄选项，树与趋势图同步过滤 ──
const productDomain = ref('')
const businessArea = ref('')
const projectGroupCode = ref('')
const productDomainOptions = ref<any[]>([])
const businessAreaOptions = ref<any[]>([])
const projectGroupOptions = ref<any[]>([])
const productDomainPayload = ref<any>({ level: 'product_domain' })
useGet<any>(ApiPerfCompliance.dimensionOptions, productDomainPayload, {
  immediate: true,
  onSuccess(d: any) { productDomainOptions.value = Array.isArray(d) ? d : [] },
})
const businessAreaPayload = ref<any>({ level: 'business_area' })
const { execute: fetchBusinessAreas } = useGet<any>(ApiPerfCompliance.dimensionOptions, businessAreaPayload, {
  immediate: true,
  onSuccess(d: any) { businessAreaOptions.value = Array.isArray(d) ? d : [] },
})
const projectGroupPayload = ref<any>({ level: 'project_group' })
const { execute: fetchProjectGroups } = useGet<any>(ApiPerfCompliance.dimensionOptions, projectGroupPayload, {
  immediate: true,
  onSuccess(d: any) { projectGroupOptions.value = Array.isArray(d) ? d : [] },
})

// 维度过滤请求参数（空值不带）
const dimFilterParams = () => {
  const p: any = {}
  if (productDomain.value) p.product_domain = productDomain.value
  if (businessArea.value) p.business_area = businessArea.value
  if (projectGroupCode.value) p.project_group_code = projectGroupCode.value
  return p
}

// 重载左树（带维度+二开过滤）；树加载成功后自动重选根节点并联动趋势
const reloadTree = () => {
  if (!selectedPeriod.value) return
  treePayload.value = { period_type: periodType.value, period: selectedPeriod.value, product_line: productLine.value, dimension: dimension.value, ...(customFilter.value ? { custom_filter: customFilter.value } : {}), ...dimFilterParams() }
  treeLoading.value = true
  fetchTree().finally(() => { treeLoading.value = false })
}

// 维度过滤变化 → 重载树（树 onSuccess 自动重选根节点并联动趋势图）
const onDimFilterChange = () => {
  reloadTree()
}
// 级联：产品领域变化 → 清空下级并收窄业务领域/项目组选项
const onProductDomainFilterChange = () => {
  businessArea.value = ''
  projectGroupCode.value = ''
  businessAreaPayload.value = { level: 'business_area', ...(productDomain.value ? { product_domain: productDomain.value } : {}) }
  fetchBusinessAreas()
  projectGroupPayload.value = { level: 'project_group', ...(productDomain.value ? { product_domain: productDomain.value } : {}) }
  fetchProjectGroups()
  onDimFilterChange()
}
// 级联：业务领域变化 → 清空项目组并收窄其选项
const onBusinessAreaFilterChange = () => {
  projectGroupCode.value = ''
  projectGroupPayload.value = { level: 'project_group', ...(productDomain.value ? { product_domain: productDomain.value } : {}), ...(businessArea.value ? { business_area: businessArea.value } : {}) }
  fetchProjectGroups()
  onDimFilterChange()
}

// 树节点编码显示开关：默认显示名称；开启后显示“名称 (编码)”，无名称时直接显示编码
const showCode = ref(false)
const displayTitle = (node: any) => {
  if (!showCode.value) return node.title
  return node.title && node.title !== node.code ? `${node.title} (${node.code})` : node.code
}

// 树子节点懒加载：展开时复用 drill 接口逐级加载（app→form、维度顶层→app）；趋势视图 form 即为叶子
const lazyDrillPayload = ref<any>({})
const lazyDrill = useGet<any>(ApiPerfCompliance.drill, lazyDrillPayload, { immediate: false })

// 递归查找树节点
const findTreeNode = (nodes: any[], key: string): any => {
  for (const n of nodes) {
    if (n.key === key) return n
    if (n.children?.length) {
      const found = findTreeNode(n.children, key)
      if (found) return found
    }
  }
  return null
}

// 展开非叶子节点时懒加载子节点
const onLoadMore = async (node: any) => {
  const params: any = { period_type: periodType.value, period: selectedPeriod.value, product_line: productLine.value, ...dimFilterParams() }
  if (customFilter.value) params.custom_filter = customFilter.value
  if (node.level === 'app') {
    params.level = 'form'
    params.app_number = node.code
  } else if (node.level === 'project_group') {
    params.level = 'app'
    params.project_group_code = node.code
  } else if (node.level === 'business_area') {
    params.level = 'app'
    params.business_area = node.code
  } else if (node.level === 'product_domain') {
    params.level = 'app'
    params.product_domain = node.code
  } else {
    return
  }
  lazyDrillPayload.value = params
  await lazyDrill.execute()
  const items = Array.isArray(lazyDrill.data.value) ? lazyDrill.data.value : []
  const children = items
    .map((it: any) => ({
      key: `${it.level}:${it.code}`,
      code: it.code,
      title: it.name,
      level: it.level,
      total_count: it.total_count,
      over_3s_count: it.over_3s_count,
      compliance_rate: it.compliance_rate,
      is_leaf: it.level === 'form', // 趋势仅支持到 form 级，form 为叶子
      children: [],
    }))
    .sort((a: any, b: any) => b.total_count - a.total_count)
  node.children = children
  if (!children.length) node.is_leaf = true
  // 搜索过滤模式下 node 为拷贝对象，需把子节点同步回原始树
  const origin = findTreeNode(treeData.value, node.key)
  if (origin && origin !== node) {
    origin.children = children
    if (!children.length) origin.is_leaf = true
  }
}

// 搜索过滤树（仅影响渲染视图，treeData 始终保持完整树）
const displayTree = computed(() => {
  if (!treeSearch.value) return wrappedTree.value
  const kw = treeSearch.value.toLowerCase()
  const filterNodes = (nodes: any[]): any[] => {
    return nodes.reduce((acc: any[], node) => {
      const children = node.children?.length ? filterNodes(node.children) : []
      if (node.title?.toLowerCase().includes(kw) || children.length) {
        acc.push({ ...node, children })
      }
      return acc
    }, [])
  }
  return filterNodes(wrappedTree.value)
})

const onTreeSelect = (keys: (string | number)[]) => {
  selectedKeys.value = keys.map(String)
  // 从包含“全部”根节点的完整树中查找，保证 root 节点也能正确定位
  selectedNode.value = keys.length ? findTreeNode(wrappedTree.value, String(keys[0])) : null
  // 选中节点变化会触发 watch 自动重拉趋势
}

// ── 趋势数据（按选中节点的下一层级拆分多系列趋势线） ──────────────────────────────────
const chartLoading = ref(false)
// 单图最多展示的趋势线条数（按请求量取 Top N，避免应用/表单级数百条线不可读）
const MAX_TREND_SERIES = 12

// 节点 → trend 接口过滤参数（与 buildTrendParams 同套映射）
const childFilter = (c: any) => {
  switch (c.level) {
    case 'cloud': return { cloud_number: c.code }
    case 'app': return { app_number: c.code }
    case 'form': return { form_id: c.code }
    case 'project_group': return { project_group_code: c.code }
    case 'business_area': return { business_area: c.code }
    case 'product_domain': return { product_domain: c.code }
    default: return {}
  }
}

// drill 返回项 → 树节点（与 onLoadMore 同一映射）
const mapDrillItems = (items: any[]) =>
  items
    .map((it: any) => ({
      key: `${it.level}:${it.code}`,
      code: it.code,
      title: it.name,
      level: it.level,
      total_count: it.total_count,
      over_3s_count: it.over_3s_count,
      compliance_rate: it.compliance_rate,
      is_leaf: it.level === 'form',
      children: [],
    }))
    .sort((a: any, b: any) => b.total_count - a.total_count)

// 解析选中节点的直接子级：root=树顶层；cloud=树自带应用子级；维度节点/应用=drill 懒加载（顺带回填树）；form=自身
const resolveChildren = async (node: any): Promise<any[]> => {
  if (node.level === 'root') return treeData.value
  if (node.level === 'form') return [node]
  if (node.level === 'cloud') return node.children || []
  if (node.children?.length) return node.children
  const params: any = { period_type: periodType.value, period: selectedPeriod.value, product_line: productLine.value, ...dimFilterParams() }
  if (customFilter.value) params.custom_filter = customFilter.value
  if (node.level === 'app') { params.level = 'form'; params.app_number = node.code }
  else if (node.level === 'project_group') { params.level = 'app'; params.project_group_code = node.code }
  else if (node.level === 'business_area') { params.level = 'app'; params.business_area = node.code }
  else if (node.level === 'product_domain') { params.level = 'app'; params.product_domain = node.code }
  else return []
  lazyDrillPayload.value = params
  await lazyDrill.execute()
  const items = Array.isArray(lazyDrill.data.value) ? lazyDrill.data.value : []
  const children = mapDrillItems(items)
  node.children = children
  if (!children.length) node.is_leaf = true
  const origin = findTreeNode(treeData.value, node.key)
  if (origin && origin !== node) {
    origin.children = children
    if (!children.length) origin.is_leaf = true
  }
  return children
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
    const top = [...children].sort((a: any, b: any) => (b.total_count || 0) - (a.total_count || 0)).slice(0, MAX_TREND_SERIES)
    const base: any = { period_type: periodType.value, product_line: productLine.value, ...dimFilterParams() }
    if (customFilter.value) base.custom_filter = customFilter.value
    const results = await Promise.all(top.map(async (c: any) => {
      const url = getQueryUrl(ApiPerfCompliance.trend, { ...base, ...childFilter(c) }).value
      const res = await useRequest(url, { immediate: true }).get().json()
      return { name: c.title || c.code, points: Array.isArray(res.data.value) ? res.data.value : [] }
    }))
    renderChart(results, children.length > MAX_TREND_SERIES ? children.length : 0)
  } finally {
    chartLoading.value = false
  }
}

// 构建树节点选中后的趋势过滤参数
const buildTrendParams = () => {
  const params: any = { period_type: periodType.value, product_line: productLine.value, ...dimFilterParams() }
  if (customFilter.value) params.custom_filter = customFilter.value

  if (!selectedNode.value) return params

  const node = selectedNode.value
  const dim = dimension.value
  if (dim === 'menu') {
    if (node.level === 'cloud') params.cloud_number = node.code
    else if (node.level === 'app') params.app_number = node.code
    else if (node.level === 'form') params.form_id = node.code
  } else {
    if (node.level === dim) {
      if (dim === 'project_group') params.project_group_code = node.code
      else if (dim === 'business_area') params.business_area = node.code
      else if (dim === 'product_domain') params.product_domain = node.code
    } else if (node.level === 'app') {
      params.app_number = node.code
    } else if (node.level === 'form') {
      params.form_id = node.code
    }
  }
  return params
}

watch(selectedNode, () => {
  fetchChildTrends()
})

// 二开过滤变化 → 重载左树 + 趋势图
watch(customFilter, () => {
  if (selectedPeriod.value) {
    reloadTree()
    fetchChildTrends()
  }
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
const getRateColor = (rate: number) => {
  if (rate >= 99) return '#00b42a'
  if (rate >= 95) return '#ff7d00'
  return '#f53f3f'
}

onUnmounted(() => {
  window.removeEventListener('resize', resizeChart)
  chart?.dispose()
})
</script>
