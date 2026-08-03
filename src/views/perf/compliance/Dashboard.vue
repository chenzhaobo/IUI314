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
          <a-select v-model="complianceFilter" placeholder="达标状态">
            <a-option value="">全部状态</a-option>
            <a-option value="pass">达标(≥99%)</a-option>
            <a-option value="fail">不达标(&lt;99%)</a-option>
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
        <a-col :span="4">
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
      </a-row>
      <a-row :gutter="16" style="margin-bottom: 12px" align="center">
        <a-col :span="24">
          <a-radio-group v-model="dimension" type="button" @change="onDimensionChange">
            <a-radio value="menu">菜单</a-radio>
            <a-radio value="project_group">项目组</a-radio>
            <a-radio value="business_area">业务领域</a-radio>
            <a-radio value="product_domain">产品领域</a-radio>
          </a-radio-group>
        </a-col>
      </a-row>

      <!-- 左树右表：高度占满视口剩余空间，随分辨率自适应 -->
      <div style="display: flex; gap: 16px; height: calc(100vh - 250px); min-height: 420px">
        <!-- 左树 -->
        <div style="width: 280px; flex-shrink: 0; border-right: 1px solid #e5e6eb; padding-right: 12px; display: flex; flex-direction: column; min-height: 0">
          <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px">
            <a-input-search v-model="treeSearch" placeholder="搜索节点" allow-clear style="flex: 1" />
            <a-switch v-model="showCode" size="small" />
            <span style="font-size: 12px; color: #86909c; white-space: nowrap">显示编码</span>
          </div>
          <div style="flex: 1; overflow-y: auto; min-height: 0">
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
        </div>

        <!-- 右侧 -->
        <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; min-height: 0">
          <!-- 总览统计 -->
          <a-row :gutter="16" style="margin-bottom: 16px">
            <a-col :span="6"><a-statistic title="总请求数" :value="overview.total_count" /></a-col>
            <a-col :span="6"><a-statistic title="超3秒数" :value="overview.over_3s_count" :value-style="{ color: '#f53f3f' }" /></a-col>
            <a-col :span="6">
              <a-statistic title="3秒达标率" :value="overview.compliance_rate" :precision="2" suffix="%" :value-style="{ color: getRateColor(overview.compliance_rate) }" />
            </a-col>
            <a-col :span="6">
              <div class="arco-statistic">
                <div class="arco-statistic-title">统计周期</div>
                <div class="arco-statistic-content"><span class="arco-statistic-value" style="font-size: 14px">{{ periodText }}</span></div>
              </div>
            </a-col>
          </a-row>

          <!-- 明细表格 -->
          <a-table :data="tableData" :loading="tableLoading" :pagination="false" size="small" row-key="code" :scroll="{ y: 'calc(100vh - 380px)' }" style="flex: 1; min-height: 0">
            <template #columns>
              <a-table-column title="名称" data-index="name" :width="180" ellipsis />
              <a-table-column title="3秒达标率" :width="90">
                <template #cell="{ record }">
                  <span :style="{ color: getRateColor(record.compliance_rate) }">{{ record.compliance_rate?.toFixed(2) }}%</span>
                </template>
              </a-table-column>
              <a-table-column title="1秒达标率" :width="90">
                <template #cell="{ record }">
                  <a-tooltip :content="thresholdTip(record, '1')" :disabled="record.rate_1s == null">
                    <span v-if="record.rate_1s != null" :style="{ color: getRateColor(record.rate_1s) }">{{ record.rate_1s.toFixed(2) }}%</span>
                    <span v-else style="color: #86909c">--</span>
                  </a-tooltip>
                </template>
              </a-table-column>
              <a-table-column title="2秒达标率" :width="90">
                <template #cell="{ record }">
                  <a-tooltip :content="thresholdTip(record, '2')" :disabled="record.rate_2s == null">
                    <span v-if="record.rate_2s != null" :style="{ color: getRateColor(record.rate_2s) }">{{ record.rate_2s.toFixed(2) }}%</span>
                    <span v-else style="color: #86909c">--</span>
                  </a-tooltip>
                </template>
              </a-table-column>
              <a-table-column title="10秒达标率" :width="94">
                <template #cell="{ record }">
                  <a-tooltip :content="thresholdTip(record, '10')" :disabled="record.rate_10s == null">
                    <span v-if="record.rate_10s != null" :style="{ color: getRateColor(record.rate_10s) }">{{ record.rate_10s.toFixed(2) }}%</span>
                    <span v-else style="color: #86909c">--</span>
                  </a-tooltip>
                </template>
              </a-table-column>
              <a-table-column title="总请求" data-index="total_count" :width="80" />
              <a-table-column title="超3秒" :width="70">
                <template #cell="{ record }">
                  <span :style="{ color: record.over_3s_count > 0 ? '#f53f3f' : '' }">{{ record.over_3s_count }}</span>
                </template>
              </a-table-column>
              <a-table-column title="平均耗时(秒)" :width="90" align="right">
                <template #cell="{ record }">{{ (record.avg_cost / 1000).toFixed(3) }}</template>
              </a-table-column>
              <a-table-column title="最大耗时(秒)" :width="90" align="right">
                <template #cell="{ record }">{{ (record.max_cost / 1000).toFixed(3) }}</template>
              </a-table-column>
              <a-table-column title="操作" :width="120">
                <template #cell="{ record }">
                  <a-space>
                    <a-link @click="handleCreateIssue(record)">提问题</a-link>
                    <a-link @click="handleExport(record)">导出</a-link>
                  </a-space>
                </template>
              </a-table-column>
            </template>
          </a-table>
        </div>
      </div>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Message } from '@arco-design/web-vue'
import { ApiPerfCompliance } from '@/api/perfApis'
import { useGet } from '@/hooks'

defineOptions({ name: 'compliance-dashboard' })

const router = useRouter()

// ── 产品线选择（星瀚/星空，默认星瀚） ──────────────────────────────────
const productLine = ref('星瀚')

// ── 周期选择（按周/按月，默认按月） ──────────────────────────────────
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

const onPeriodTypeChange = (pt: string) => {
  selectedPeriod.value = ''
  periodOptions.value = []
  treeData.value = []
  tableData.value = []
  periodOptionsPayload.value = { period_type: pt, product_line: productLine.value }
  fetchPeriodOptions()
}

// 切换产品线：重置周期/树/表，按新产品线重载可选周期（onSuccess 会自动选中首个周期并联动加载）
const onProductLineChange = () => {
  selectedPeriod.value = ''
  periodOptions.value = []
  treeData.value = []
  tableData.value = []
  selectedKeys.value = []
  periodOptionsPayload.value = { period_type: periodType.value, product_line: productLine.value }
  fetchPeriodOptions()
}

const onPeriodChange = (period: string) => {
  selectedKeys.value = []
  if (period) {
    reloadTree()
    overviewPayload.value = { period_type: periodType.value, period, product_line: productLine.value, ...dimFilterParams() }
    fetchOverview()
    drillPayload.value = buildDrillParams()
    tableLoading.value = true
    fetchDrill().finally(() => { tableLoading.value = false })
  }
}

// ── 维度切换 ──────────────────────────────────
const dimension = ref('menu')
const onDimensionChange = () => {
  selectedKeys.value = []
  reloadTree()
}

// ── 树数据 ──────────────────────────────────
const treeData = ref<any[]>([])
const treeLoading = ref(false)
const treeSearch = ref('')
const selectedKeys = ref<string[]>([])
const treePayload = ref<any>({})
const { execute: fetchTree } = useGet<any>(ApiPerfCompliance.tree, treePayload, {
  immediate: false,
  onSuccess(data: any) { treeData.value = Array.isArray(data) ? data : [] },
})

// ── 维度过滤（产品领域/业务领域/项目组）：级联收窄选项，树/总览/明细同步过滤 ──
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

// 重载左树（带达标状态/二开/维度过滤）
const reloadTree = () => {
  if (!selectedPeriod.value) return
  treePayload.value = { period_type: periodType.value, period: selectedPeriod.value, product_line: productLine.value, dimension: dimension.value, ...(complianceFilter.value ? { compliance_filter: complianceFilter.value } : {}), ...(customFilter.value ? { custom_filter: customFilter.value } : {}), ...dimFilterParams() }
  treeLoading.value = true
  fetchTree().finally(() => { treeLoading.value = false })
}

// 过滤条件变化 → 重载树 + 明细 + 总览（清空选中节点，过滤后原节点可能不存在）
const reloadFiltered = () => {
  if (!selectedPeriod.value) return
  reloadTree()
  drillPayload.value = buildDrillParams()
  tableLoading.value = true
  fetchDrill().finally(() => { tableLoading.value = false })
  overviewPayload.value = { ...buildDrillParams() }
  fetchOverview()
}

const onDimFilterChange = () => {
  selectedKeys.value = []
  reloadFiltered()
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

// 包装“全部”根节点（聚合顶层节点统计量），便于总览全局并逐层穿透
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

// 树节点编码显示开关：默认显示名称；开启后显示“名称 (编码)”，无名称时直接显示编码
const showCode = ref(false)
const displayTitle = (node: any) => {
  if (!showCode.value) return node.title
  return node.title && node.title !== node.code ? `${node.title} (${node.code})` : node.code
}

// 树子节点懒加载：展开时复用 drill 接口逐级加载（app→form、form→button、维度顶层→app）
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
  if (complianceFilter.value) params.compliance_filter = complianceFilter.value
  if (customFilter.value) params.custom_filter = customFilter.value
  if (node.level === 'app') {
    params.level = 'form'
    params.app_number = node.code
  } else if (node.level === 'form') {
    params.level = 'button'
    params.form_id = node.code
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
  const childIsLeaf = params.level === 'button' // button 为叶子；form 可继续展开按钮
  const children = items
    .map((it: any) => ({
      key: `${it.level}:${it.code}`,
      code: it.code,
      title: it.name,
      level: it.level,
      total_count: it.total_count,
      over_3s_count: it.over_3s_count,
      compliance_rate: it.compliance_rate,
      is_leaf: childIsLeaf,
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

const onTreeSelect = (keys: string[]) => {
  selectedKeys.value = keys
  // watch(selectedKeys) 会自动联动更新 drill 明细与总览
}

// 搜索过滤树（仅影响渲染视图，treeData 始终保持完整树，懒加载子节点可正常回写）
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

// ── 总览 ──────────────────────────────────
const overview = ref<any>({ total_count: 0, over_3s_count: 0, compliance_rate: 100, period_start: '', period_end: '' })
const overviewPayload = ref<any>({})
const { execute: fetchOverview } = useGet<any>(ApiPerfCompliance.overview, overviewPayload, {
  immediate: false,
  onSuccess(data: any) { if (data && typeof data === 'object') overview.value = data },
})
const periodText = computed(() => {
  const s = overview.value.period_start || ''
  const e = overview.value.period_end || ''
  return s ? `${s} ~ ${e}` : '--'
})

// ── 明细表格（drill） ──────────────────────────────────
const tableData = ref<any[]>([])
const tableLoading = ref(false)
const drillPayload = ref<any>({})
const { execute: fetchDrill } = useGet<any>(ApiPerfCompliance.drill, drillPayload, {
  immediate: false,
  onSuccess(data: any) { tableData.value = Array.isArray(data) ? data : [] },
})

// 达标状态过滤：''=全部 | pass=达标(≥99%) | fail=不达标(<99%)
const complianceFilter = ref('')
// 二开过滤：''=全部 | standard_only=仅标品 | custom_only=仅二开
const customFilter = ref('')

// 构建树节点选中后的 drill 请求参数
const buildDrillParams = () => {
  const params: any = { period_type: periodType.value, period: selectedPeriod.value, product_line: productLine.value, level: 'cloud', ...dimFilterParams() }
  if (complianceFilter.value) params.compliance_filter = complianceFilter.value
  if (customFilter.value) params.custom_filter = customFilter.value
  if (!selectedKeys.value.length) return params

  const nodeKey = selectedKeys.value[0]
  // “全部”根节点 → 不加过滤，展示整体云级汇总
  if (nodeKey === 'root:all') return params
  // 在树中找到选中节点，确定其 level 和过滤条件
  const node = findTreeNode(treeData.value, nodeKey)
  if (!node) return params

  // 根据维度和层级设置过滤参数
  const dim = dimension.value
  if (dim === 'menu') {
    if (node.level === 'cloud') { params.level = 'app'; params.cloud_number = node.code }
    else if (node.level === 'app') { params.level = 'form'; params.app_number = node.code }
    else if (node.level === 'form') { params.level = 'button'; params.form_id = node.code }
    else { params.level = 'cloud' }
  } else {
    // 维度树: 顶层节点 → 展示其下 app 级
    if (node.level === dim) {
      params.level = 'app'
      if (dim === 'project_group') params.project_group_code = node.code
      else if (dim === 'business_area') params.business_area = node.code
      else if (dim === 'product_domain') params.product_domain = node.code
    } else if (node.level === 'app') {
      params.level = 'form'; params.app_number = node.code
    } else if (node.level === 'form') {
      params.level = 'button'; params.form_id = node.code
    }
  }
  return params
}

watch(selectedKeys, () => {
  if (selectedPeriod.value) {
    drillPayload.value = buildDrillParams()
    tableLoading.value = true
    fetchDrill().finally(() => { tableLoading.value = false })
    // 更新总览（带维度过滤）
    overviewPayload.value = { ...buildDrillParams() }
    fetchOverview()
  }
})

// 达标状态/二开过滤变化 → 重载左树 + 明细表 + 总览
watch(complianceFilter, reloadFiltered)
watch(customFilter, reloadFiltered)

// ── 辅助 ──────────────────────────────────
const getRateColor = (rate: number) => {
  if (rate >= 99) return '#00b42a'
  if (rate >= 95) return '#ff7d00'
  return '#f53f3f'
}

// 多阈值达标率悬停提示：显示具体数量（达标数/总数 + 超标数）
const thresholdTip = (record: any, sec: '1' | '2' | '10') => {
  const over = record[`over_${sec}s_count`]
  if (over == null) return ''
  const total = record.total_count || 0
  const pass = total - over
  return `达标 ${pass.toLocaleString()} / ${total.toLocaleString()}（超${sec}秒 ${over.toLocaleString()}）`
}

const handleCreateIssue = (record: any) => {
  router.push({ path: '/cloud-perf/issue/issue-list', query: { app_number: record.code, form_name: record.name } })
}

const handleExport = () => {
  const params = new URLSearchParams(drillPayload.value).toString()
  window.open(`/api/perf/compliance/export?${params}`, '_blank')
}
</script>
