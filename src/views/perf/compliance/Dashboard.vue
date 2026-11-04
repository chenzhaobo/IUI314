<template>
  <div class="page-container">
    <a-card :bordered="false" :body-style="{ padding: '16px' }">
      <!-- 顶部选择器 -->
      <template v-if="!filtersCollapsed">
      <a-row :gutter="12" style="margin-bottom: 12px" align="center">
        <a-col :span="3">
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
        <a-col :span="6">
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
        <a-col :span="2" style="text-align: right">
          <a-link @click="filtersCollapsed = true">收起筛选</a-link>
        </a-col>
      </a-row>
      <!-- 维度过滤：产品领域/业务领域/项目组/客户/版本，客户与版本支持远程搜索 -->
      <a-row :gutter="12" style="margin-bottom: 12px" align="center">
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
        <a-col :span="3">
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
        <a-col :span="3">
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
        <a-col :span="4">
          <a-button size="small" @click="handleResetFilters">重置过滤</a-button>
        </a-col>
      </a-row>
      </template>
      <a-row v-else :gutter="12" style="margin-bottom: 12px" align="center">
        <a-col :span="22">
          <div class="filter-summary" :title="filterSummaryText">{{ filterSummaryText || '未设置查询条件' }}</div>
        </a-col>
        <a-col :span="2" style="text-align: right">
          <a-link @click="filtersCollapsed = false">展开筛选</a-link>
        </a-col>
      </a-row>

      <!-- 左树右表：高度占满视口剩余空间，随分辨率自适应 -->
      <!-- 外层 flex 行定高：子项靠 flex 派生高度，需父级有确定 height（maxHeight 不算），故用实测 height -->
      <div ref="layoutRow" :style="{ display: 'flex', gap: '16px', height: layoutRowH + 'px', minHeight: '420px' }">
        <!-- 左树 -->
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
          <div class="panel-scroll-y" style="flex: 1">
            <a-spin :loading="treeLoading" style="width: 100%">
              <a-tree
                v-if="displayTree.length"
                :data="displayTree"
                :field-names="{ key: 'key', title: 'title', children: 'children', isLeaf: 'is_leaf' }"
                :load-more="handleLoadMore"
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
import { ApiPerfCompliance, type ComplianceDrillItem, type ComplianceTreeNode } from '@/api/perfApis'
import { rateColor, useAutoHeight, useDownload, useGet, useTableAutoHeight } from '@/hooks'
import { ComplianceSlowLogsRouteName } from '@/router/constant'
import { useComplianceFilters } from '@/views/perf/composables/useComplianceFilters'
import { DIMENSION_OPTIONS, useComplianceTree } from '@/views/perf/composables/useComplianceTree'

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

// 切换产品线：重置周期/树/表与全部维度过滤，按新产品线重载可选周期
// （onSuccess 会自动选中首个周期并联动加载）
const onProductLineChange = () => {
  selectedPeriod.value = ''
  periodOptions.value = []
  treeData.value = []
  tableData.value = []
  selectedKeys.value = []
  resetFilters()
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

// ── 维度与过滤 ──────────────────────────────────
const dimension = ref('menu')
// 筛选区折叠：展开时显示两行完整条件，折叠时只留一行“字段：值”摘要
const filtersCollapsed = ref(false)
// 达标状态过滤：''=全部 | pass=达标(≥99%) | fail=不达标(<99%)
const complianceFilter = ref('')
// 二开过滤：''=全部 | standard_only=仅标品 | custom_only=仅二开
const customFilter = ref('')

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

const {
  treeData,
  treeLoading,
  treeSearch,
  selectedKeys,
  showCode,
  wrappedTree,
  displayTree,
  displayTitle,
  findTreeNode,
  findTreePath,
  reloadTree,
  onLoadMore,
  onTreeSelect,
  buildDrillParams,
} = useComplianceTree({
  productLine,
  periodType,
  selectedPeriod,
  dimension,
  complianceFilter,
  customFilter,
  dimFilterParams,
})

// 折叠态摘要：只展示“字段：当前值”，一行展示不下时用省略号，title 看全文
function optionLabel(options: { code: string; name: string }[], code: string) {
  return options.find(o => o.code === code)?.name || code
}

const filterSummaryText = computed(() => {
  const periodLabel = periodOptions.value.find(p => p.period === selectedPeriod.value)?.label || selectedPeriod.value
  const dimensionLabel = DIMENSION_OPTIONS.find(d => d.value === dimension.value)?.label || dimension.value
  const parts = [`产品线：${productLine.value}`, `周期：${periodLabel || '--'}`, `维度：${dimensionLabel}`]
  if (complianceFilter.value) {
    parts.push(`达标状态：${complianceFilter.value === 'pass' ? '达标(≥99%)' : '不达标(<99%)'}`)
  }
  if (customFilter.value) {
    parts.push(`二开：${customFilter.value === 'standard_only' ? '仅标品' : '仅二开'}`)
  }
  if (productDomain.value) parts.push(`产品领域：${optionLabel(productDomainOptions.value, productDomain.value)}`)
  if (businessArea.value) parts.push(`业务领域：${optionLabel(businessAreaOptions.value, businessArea.value)}`)
  if (projectGroupCode.value) parts.push(`项目组：${optionLabel(projectGroupOptions.value, projectGroupCode.value)}`)
  if (customer.value.length) parts.push(`客户：${customer.value.join('、')}`)
  if (productVersion.value.length) parts.push(`产品版本：${productVersion.value.join('、')}`)
  if (cosmicVersion.value.length) parts.push(`苍穹版本：${cosmicVersion.value.join('、')}`)
  return parts.join(' ｜ ')
})

const onDimensionChange = () => {
  const hadSelection = selectedKeys.value.length > 0
  selectedKeys.value = []
  reloadTree()
  // 原来没有选中节点时 watch 不会触发；维度切换后右表也要回到新维度的「全部」汇总
  if (!hadSelection) refreshDrill()
}

// 过滤条件变化 → 重载树 + 明细 + 总览（清空选中节点，过滤后原节点可能不存在）
function reloadFiltered() {
  if (!selectedPeriod.value) return
  reloadTree()
  refreshDrill()
  overviewPayload.value = { ...buildDrillParams() }
  fetchOverview()
}

function onDimFilterChange() {
  selectedKeys.value = []
  reloadFiltered()
}

const handleResetFilters = () => {
  resetFilters()
  onDimFilterChange()
}

const handleLoadMore = (node: unknown) => onLoadMore(node as ComplianceTreeNode)

// ── 总览 ──────────────────────────────────
const overview = ref<any>({ total_count: 0, over_3s_count: 0, compliance_rate: 100, period_start: '', period_end: '' })
const overviewPayload = ref<Record<string, unknown>>({})
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
const tableData = ref<ComplianceDrillItem[]>([])
const tableLoading = ref(false)
const drillPayload = ref<Record<string, unknown>>({})
const { execute: fetchDrill } = useGet<ComplianceDrillItem[]>(ApiPerfCompliance.drill, drillPayload, {
  immediate: false,
  onSuccess(data) { tableData.value = Array.isArray(data) ? data : [] },
})

function refreshDrill() {
  drillPayload.value = buildDrillParams()
  tableLoading.value = true
  fetchDrill().finally(() => { tableLoading.value = false })
}

watch(selectedKeys, () => {
  if (selectedPeriod.value) {
    refreshDrill()
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

const UNATTRIBUTED_CONTROL = '__unattributed__'

const rowScope = (record: DrillRow): RowScope => {
  const scope: RowScope = {}
  const assign = (level: string, code: string, name: string) => {
    if (level === 'cloud') scope.cloud_number = code
    else if (level === 'app') scope.app_number = code
    else if (level === 'form') scope.form_id = code
    // 按钮级 code 是操作名；「未归因操作」用同名文案，慢日志页按它筛出没有按钮名的请求
    else if (level === 'button') scope.control_name = code === UNATTRIBUTED_CONTROL ? '未归因操作' : (name || code)
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
  // 按钮级行：台账左树定位到表单下的按钮；未归因操作在台账侧用哨兵编码
  if (scope.form_id && scope.control_name)
    query.control_name = scope.control_name === '未归因操作' ? UNATTRIBUTED_CONTROL : scope.control_name
  router.push({ name: 'pattern-ledger', query })
}

/** 查看慢日志：带上看板当前周期口径（按月/按周），列出报告任务已下载的日志 */
const gotoSlowLogs = (record: DrillRow) => {
  const scope = rowScope(record)
  if (!scope.form_id) return
  // 维度树里的表单 key 带维度前缀（如 customer:xx/app:yy/form:zz），
  // 按选中节点的祖先链取表单名，不能再按全局 form:xx 查找。
  const selectedPath = selectedKeys.value[0] ? findTreePath(treeData.value, selectedKeys.value[0]) : []
  const formNode = selectedPath.find(n => n.level === 'form') || findTreeNode(treeData.value, `form:${scope.form_id}`)
  const formRowName = record.level === 'form' ? record.name : (formNode?.title || '')
  const label = periodOptions.value.find((p: { period: string }) => p.period === selectedPeriod.value)?.label || selectedPeriod.value
  router.push({
    name: ComplianceSlowLogsRouteName,
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
  const params = new URLSearchParams(drillPayload.value as Record<string, string>).toString()
  await downloadWithTip(`/perf/compliance/export?${params}`, '达标率明细.csv', '达标率明细导出失败')
}
</script>

<style scoped>
.filter-summary {
  overflow: hidden;
  color: var(--color-text-2);
  font-size: 13px;
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>
