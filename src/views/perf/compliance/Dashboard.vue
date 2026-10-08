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
              <a-col :span="3">
          <!-- 「未分类」节点只能看出有多少量没归类，看不出是哪些应用。
               导出的列格式与模块管理导入模板一致，填好项目组编码就能直接导回去 -->
          <a-space :size="8">
            <a-tooltip content="导出未归类应用清单（CSV），列格式对齐模块管理导入模板" mini>
              <a-button size="small" :loading="unclsExporting" @click="handleExportUnclassified">
                导出未归类
              </a-button>
            </a-tooltip>
            <!-- 原在每行操作列，但导出的始终是右侧整张明细（与行无关），挪到工具栏 -->
            <a-tooltip content="导出右侧当前明细（CSV）" mini>
              <a-button size="small" @click="handleExport">导出明细</a-button>
            </a-tooltip>
          </a-space>
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
      <!-- 外层 flex 行定高：子项靠 flex 派生高度，需父级有确定 height（maxHeight 不算），故用实测 height -->
      <div ref="layoutRow" :style="{ display: 'flex', gap: '16px', height: layoutRowH + 'px', minHeight: '420px' }">
        <!-- 左树 -->
        <div style="width: 280px; flex-shrink: 0; border-right: 1px solid #e5e6eb; padding-right: 12px; display: flex; flex-direction: column; min-height: 0">
          <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px">
            <a-input-search v-model="treeSearch" placeholder="搜索节点" allow-clear style="flex: 1" />
            <a-switch v-model="showCode" size="small" />
            <span style="font-size: 12px; color: #86909c; white-space: nowrap">显示编码</span>
          </div>
          <div class="panel-scroll-y" style="flex: 1">
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
                  <span style="margin-left: 6px; font-size: 12px" :style="{ color: rateColor(node.compliance_rate) }">
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
              <a-statistic title="3秒达标率" :value="overview.compliance_rate" :precision="2" suffix="%" :value-style="{ color: rateColor(overview.compliance_rate) }" />
            </a-col>
            <a-col :span="6">
              <div class="arco-statistic">
                <div class="arco-statistic-title">统计周期</div>
                <div class="arco-statistic-content"><span class="arco-statistic-value" style="font-size: 14px">{{ periodText }}</span></div>
              </div>
            </a-col>
          </a-row>

          <!-- 明细表格 -->
          <div ref="tableWrap" style="flex: 1; min-height: 0">
          <a-table :data="tableData" :loading="tableLoading" :pagination="false" size="small" row-key="code" :scroll="{ y: tableHeight }" style="flex: 1; min-height: 0">
            <template #columns>
              <a-table-column title="名称" data-index="name" :width="180" ellipsis :sortable="{ sortDirections: ['ascend', 'descend'], sorter: nameSorter }" />
              <a-table-column title="3秒达标率" data-index="compliance_rate" :width="90" :sortable="{ sortDirections: ['descend', 'ascend'], sorter: numSorter('compliance_rate') }">
                <template #cell="{ record }">
                  <span :style="{ color: rateColor(record.compliance_rate) }">{{ record.compliance_rate?.toFixed(2) }}%</span>
                </template>
              </a-table-column>
              <a-table-column title="1秒达标率" data-index="rate_1s" :width="90" :sortable="{ sortDirections: ['descend', 'ascend'], sorter: numSorter('rate_1s') }">
                <template #cell="{ record }">
                  <a-tooltip :content="thresholdTip(record, '1')" :disabled="record.rate_1s == null">
                    <span v-if="record.rate_1s != null" :style="{ color: rateColor(record.rate_1s) }">{{ record.rate_1s.toFixed(2) }}%</span>
                    <span v-else style="color: #86909c">--</span>
                  </a-tooltip>
                </template>
              </a-table-column>
              <a-table-column title="2秒达标率" data-index="rate_2s" :width="90" :sortable="{ sortDirections: ['descend', 'ascend'], sorter: numSorter('rate_2s') }">
                <template #cell="{ record }">
                  <a-tooltip :content="thresholdTip(record, '2')" :disabled="record.rate_2s == null">
                    <span v-if="record.rate_2s != null" :style="{ color: rateColor(record.rate_2s) }">{{ record.rate_2s.toFixed(2) }}%</span>
                    <span v-else style="color: #86909c">--</span>
                  </a-tooltip>
                </template>
              </a-table-column>
              <a-table-column title="10秒达标率" data-index="rate_10s" :width="94" :sortable="{ sortDirections: ['descend', 'ascend'], sorter: numSorter('rate_10s') }">
                <template #cell="{ record }">
                  <a-tooltip :content="thresholdTip(record, '10')" :disabled="record.rate_10s == null">
                    <span v-if="record.rate_10s != null" :style="{ color: rateColor(record.rate_10s) }">{{ record.rate_10s.toFixed(2) }}%</span>
                    <span v-else style="color: #86909c">--</span>
                  </a-tooltip>
                </template>
              </a-table-column>
              <a-table-column title="总请求" data-index="total_count" :width="80" :sortable="{ sortDirections: ['descend', 'ascend'], sorter: numSorter('total_count') }" />
              <a-table-column title="超3秒" data-index="over_3s_count" :width="70" :sortable="{ sortDirections: ['descend', 'ascend'], sorter: numSorter('over_3s_count') }">
                <template #cell="{ record }">
                  <span :style="{ color: record.over_3s_count > 0 ? '#f53f3f' : '' }">{{ record.over_3s_count }}</span>
                </template>
              </a-table-column>
              <a-table-column title="平均耗时(秒)" data-index="avg_cost" :width="90" align="right" :sortable="{ sortDirections: ['descend', 'ascend'], sorter: numSorter('avg_cost') }">
                <template #cell="{ record }">{{ (record.avg_cost / 1000).toFixed(3) }}</template>
              </a-table-column>
              <a-table-column title="最大耗时(秒)" data-index="max_cost" :width="90" align="right" :sortable="{ sortDirections: ['descend', 'ascend'], sorter: numSorter('max_cost') }">
                <template #cell="{ record }">{{ (record.max_cost / 1000).toFixed(3) }}</template>
              </a-table-column>
              <a-table-column title="操作" :width="90">
                <template #cell="{ record }">
                  <a-dropdown v-if="rowActionable(record)" trigger="click" @select="(key: unknown) => handleRowAction(String(key), record)">
                    <a-link>更多<icon-down /></a-link>
                    <template #content>
                      <a-doption value="issues">联查问题</a-doption>
                      <a-doption v-if="slowLogFormId(record)" value="slow-logs">查看慢日志</a-doption>
                    </template>
                  </a-dropdown>
                </template>
              </a-table-column>
            </template>
          </a-table>
          </div>
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
import { rateColor, useAutoHeight, useDownload, useGet, useTableAutoHeight } from '@/hooks'

defineOptions({ name: 'compliance-dashboard' })

const router = useRouter()

// 左树右表外层 flex 行：实测顶边反推确定高度，供子项 flex:1 派生（详见模板注释）
const layoutRow = ref<HTMLElement>()
const { height: layoutRowH } = useAutoHeight(layoutRow)

// 表格高度自适应（滚动条在表格内，表头固定）
const tableWrap = ref<HTMLElement>()
// fillParent：这个容器是外层实测定高 flex 行里的 `flex:1` 子项，高度已确定。
// 用视口反推会与父级实际剩余空间差出一截（两者各减不同余量），
// 表现为表格下方留白 —— 直接取容器自身高度才严丝合缝。
const { tableHeight } = useTableAutoHeight(tableWrap, { fillParent: true })

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

type ArcoSelectValue = string | number | boolean | Record<string, unknown> | (string | number | boolean | Record<string, unknown>)[]

const onPeriodTypeChange = (value: ArcoSelectValue) => {
  if (typeof value !== 'string') return
  const pt = value
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

const onPeriodChange = (value: ArcoSelectValue) => {
  if (typeof value !== 'string') return
  const period = value
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

const onTreeSelect = (keys: (string | number)[]) => {
  selectedKeys.value = keys.map(String)
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
// 达标率配色与问题台账/问题列表左树共用一份（见 @/hooks 的 rateColor），
// 阈值 99/95 与后端 COMPLIANCE_PASS_THRESHOLD 对齐。

// ── 列排序（明细一次全量取回、无分页，直接在内存里排） ──
type SortDirection = 'ascend' | 'descend'
// 数值列：空值恒排最后 —— 1/2/10 秒达标率无数据时后端给 null（界面显示 --），
// 不兜底的话升序会把一串 -- 顶到最前，看不出真正最差的行；Arco 默认比较器
// 直接比大小（null 被当成最小值），且自定义 sorter 需自行处理升降序。
function numSorter(field: string) {
  return (a: any, b: any, extra: { direction: SortDirection }) => {
    const av = a[field]
    const bv = b[field]
    if (av == null || bv == null)
      return av == null ? (bv == null ? 0 : 1) : -1
    return extra.direction === 'descend' ? bv - av : av - bv
  }
}
// 名称按中文习惯排：Arco 默认比较器按 UTF-16 码位比字符串，中文名排出来是乱序
function nameSorter(a: any, b: any, extra: { direction: SortDirection }) {
  const byName = String(a.name ?? '').localeCompare(String(b.name ?? ''), 'zh')
  return extra.direction === 'descend' ? -byName : byName
}

// 多阈值达标率悬停提示：显示具体数量（达标数/总数 + 超标数）
const thresholdTip = (record: any, sec: '1' | '2' | '10') => {
  const over = record[`over_${sec}s_count`]
  if (over == null) return ''
  const total = record.total_count || 0
  const pass = total - over
  return `达标 ${pass.toLocaleString()} / ${total.toLocaleString()}（超${sec}秒 ${over.toLocaleString()}）`
}

// ── 行操作（更多）：联查问题 / 查看慢日志 ──────────────────────────────
interface DrillRow {
  code: string
  name: string
  level: string
}

/** 明细行所在的完整范围：选中树节点的祖先链（云/应用/表单） + 行本身 */
interface RowScope {
  cloud_number?: string
  app_number?: string
  form_id?: string
  control_name?: string
}

/** 树里从根到目标节点的路径（含目标），找不到返回空 */
interface TreeNodeLike {
  key: string
  code: string
  title?: string
  level: string
  children?: TreeNodeLike[]
}
const findTreePath = (nodes: TreeNodeLike[], key: string, trail: TreeNodeLike[] = []): TreeNodeLike[] => {
  for (const n of nodes) {
    const path = [...trail, n]
    if (n.key === key) return path
    if (n.children?.length) {
      const found = findTreePath(n.children, key, path)
      if (found.length) return found
    }
  }
  return []
}

const UNATTRIBUTED_CONTROL = '__unattributed__'

const rowScope = (record: DrillRow): RowScope => {
  const scope: RowScope = {}
  const assign = (level: string, code: string, name: string) => {
    if (level === 'cloud') scope.cloud_number = code
    else if (level === 'app') scope.app_number = code
    else if (level === 'form') scope.form_id = code
    // 按钮级 code 是操作名（未归因为占位编码），慢日志按操作名筛
    else if (level === 'button' && code !== UNATTRIBUTED_CONTROL) scope.control_name = name || code
  }
  const key = selectedKeys.value[0]
  if (key && key !== 'root:all') {
    for (const n of findTreePath(treeData.value, key)) assign(n.level, n.code, n.title || '')
  }
  assign(record.level, record.code, record.name)
  return scope
}

const rowActionable = (record: DrillRow) => Boolean(record?.level && record.code)
const slowLogFormId = (record: DrillRow) => (record.level === 'form' || record.level === 'button' ? rowScope(record).form_id || '' : '')

/** 联查问题：跳问题台账，左树定位到行对应的云/应用/表单 */
const gotoIssues = (record: DrillRow) => {
  const scope = rowScope(record)
  const query: Record<string, string> = { product_line: productLine.value }
  if (scope.cloud_number) query.cloud_number = scope.cloud_number
  if (scope.app_number) query.app_number = scope.app_number
  if (scope.form_id) query.form_id = scope.form_id
  router.push({ name: 'pattern-ledger', query })
}

/** 查看慢日志：带上看板当前周期口径（按月/按周），列出报告任务已下载的日志 */
const gotoSlowLogs = (record: DrillRow) => {
  const scope = rowScope(record)
  if (!scope.form_id) return
  const formRowName = record.level === 'form' ? record.name : (findTreeNode(treeData.value, `form:${scope.form_id}`)?.title || '')
  const label = periodOptions.value.find((p: { period: string }) => p.period === selectedPeriod.value)?.label || selectedPeriod.value
  router.push({
    name: 'compliance-slow-logs',
    query: {
      product_line: productLine.value,
      period_type: periodType.value,
      period: selectedPeriod.value,
      period_label: label,
      form_id: scope.form_id,
      form_name: formRowName,
      ...(scope.control_name ? { control_name: scope.control_name } : {}),
    },
  })
}

const handleRowAction = (key: string, record: DrillRow) => {
  if (key === 'issues') gotoIssues(record)
  else if (key === 'slow-logs') gotoSlowLogs(record)
}

// window.open 无法携带 Authorization 头，接口又要求鉴权（Claims），
// 结果是 401 的响应体被浏览器当成文件存下来 —— 用户看到的就是一个
// 一两 KB、打不开的“导出文件”。必须走带 token 的 useDownload。
const { downloadWithTip } = useDownload()

// 未归类应用清单：按当前产品线导出，附请求量与"待办"分档
// （应用目录无此应用 / 应用未填项目组 / 项目组未填业务领域），
// 好判断先补哪批 —— 三种情况的处理方式完全不同。
const unclsExporting = ref(false)
const handleExportUnclassified = async () => {
  unclsExporting.value = true
  try {
    const params = new URLSearchParams({ product_line: productLine.value }).toString()
    await downloadWithTip(
      `/perf/compliance/export-unclassified?${params}`,
      `未归类应用_${productLine.value}.csv`,
      '未归类应用导出失败',
    )
  }
  finally {
    unclsExporting.value = false
  }
}

const handleExport = async () => {
  const params = new URLSearchParams(drillPayload.value).toString()
  await downloadWithTip(`/perf/compliance/export?${params}`, '达标率明细.csv', '达标率明细导出失败')
}
</script>
