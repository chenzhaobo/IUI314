<template>
  <div class="page-container">
    <a-card :bordered="false" :body-style="{ padding: '16px' }">
      <!-- 顶部选择器 -->
      <a-row :gutter="16" style="margin-bottom: 16px" align="center">
        <a-col :span="4">
          <a-select v-model="productLine" placeholder="产品线" @change="onProductLineChange">
            <a-option value="星瀚">星瀚</a-option>
            <a-option value="星空">星空</a-option>
          </a-select>
        </a-col>
        <a-col :span="6">
          <a-select v-model="caliber" placeholder="压测口径" @change="onCaliberChange">
            <a-option value="all">全部生产操作</a-option>
            <a-option value="in_menu">仅菜单内表单</a-option>
            <a-option value="high_freq">高频操作(使用≥100次)</a-option>
          </a-select>
        </a-col>
        <a-col :span="4">
          <a-input-search v-model="treeSearch" placeholder="搜索节点" allow-clear />
        </a-col>
        <a-col :span="10" style="text-align: right">
          <a-space>
            <a-button @click="handleExport">导出</a-button>
            <a-button type="outline" :loading="syncing" @click="handleSync">同步覆盖率</a-button>
          </a-space>
        </a-col>
      </a-row>

      <!-- 左树右表：高度占满视口剩余空间 -->
      <!-- 外层 flex 行定高：子项靠 flex 派生高度，需父级有确定 height（maxHeight 不算），故用实测 height -->
      <div ref="layoutRow" :style="{ display: 'flex', gap: '16px', height: layoutRowH + 'px', minHeight: '420px' }">
        <!-- 左树 -->
        <div style="width: 300px; flex-shrink: 0; border-right: 1px solid #e5e6eb; padding-right: 12px; display: flex; flex-direction: column; min-height: 0">
          <div class="panel-scroll-y" style="flex: 1">
            <a-spin :loading="treeLoading" style="width: 100%">
              <a-tree
                v-if="displayTree.length"
                :data="displayTree"
                :field-names="{ key: 'key', title: 'title', children: 'children' }"
                show-line
                block-node
                :selected-keys="selectedKeys"
                :default-expand-all="false"
                @select="onTreeSelect"
              >
                <template #title="node">
                  <span>{{ node.title }}</span>
                  <span style="margin-left: 6px; font-size: 11px; color: #86909c">
                    <a-tag size="small" :color="getRateColor(node.load_rate)" style="margin-right: 2px">压 {{ node.load_rate?.toFixed(1) }}%</a-tag>
                    <a-tag size="small" :color="getRateColor(node.btn_rate)">基 {{ node.btn_rate?.toFixed(1) }}%</a-tag>
                  </span>
                </template>
              </a-tree>
              <a-empty v-else description="暂无树数据，请先同步覆盖率" />
            </a-spin>
          </div>
        </div>

        <!-- 右侧 -->
        <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; min-height: 0">
          <!-- 总览统计：压测覆盖率 / 基准覆盖率 / 高频事务基准覆盖率 -->
          <a-row :gutter="16" style="margin-bottom: 16px">
            <a-col :span="8">
              <a-card size="small" :bordered="true">
                <a-statistic title="压测覆盖率（表单操作级）" :value="overview.load_coverage_rate" :precision="2" suffix="%"
                  :value-style="{ color: getRateColor(overview.load_coverage_rate) }" />
                <div style="font-size: 12px; color: #86909c; margin-top: 4px">{{ overview.covered_forms }} / {{ overview.total_forms }} 表单已覆盖</div>
              </a-card>
            </a-col>
            <a-col :span="8">
              <a-card size="small" :bordered="true">
                <a-statistic title="基准覆盖率（按钮级）" :value="overview.baseline_coverage_rate" :precision="2" suffix="%"
                  :value-style="{ color: getRateColor(overview.baseline_coverage_rate) }" />
                <div style="font-size: 12px; color: #86909c; margin-top: 4px">{{ overview.covered_buttons }} / {{ overview.total_buttons }} 按钮已关联事务</div>
              </a-card>
            </a-col>
            <a-col :span="8">
              <a-card size="small" :bordered="true">
                <a-statistic title="高频事务基准覆盖率" :value="overview.high_freq_rate" :precision="2" suffix="%"
                  :value-style="{ color: getRateColor(overview.high_freq_rate) }" />
                <div style="font-size: 12px; color: #86909c; margin-top: 4px">{{ overview.high_freq_covered }} / {{ overview.high_freq_total }} 高频按钮已关联事务</div>
              </a-card>
            </a-col>
          </a-row>

          <!-- 明细表格（按钮级，服务端分页） -->
          <div ref="tableWrap" style="flex: 1; min-height: 0">
          <!-- scroll 用 minWidth 而非 x：x 会被 Arco 当成固定 width，容器更宽时表格停在那个宽度、右边留白 -->
          <a-table
            :data="detailList"
            :loading="detailLoading"
            :pagination="{ current: detailPage, pageSize: detailPageSize, total: detailTotal, showTotal: true, showPageSize: true }"
            size="small"
            row-key="button_key"
            :scroll="{ minWidth: 1080, y: tableHeight }"
            @page-change="handleDetailPageChange"
            @page-size-change="handleDetailPageSizeChange"
          >
            <template #columns>
              <a-table-column title="云" data-index="cloud_name" :width="100" ellipsis />
              <a-table-column title="应用" data-index="app_name" :width="130" ellipsis />
              <a-table-column title="表单" data-index="form_name" :width="150" ellipsis />
              <a-table-column title="按钮名" data-index="button_name" :width="120" ellipsis />
              <a-table-column title="按钮Key" data-index="button_key" :width="110" ellipsis />
              <a-table-column title="是否查询" data-index="is_query" :width="80" align="center">
                <template #cell="{ record }">
                  <a-tag :color="record.is_query === '1' ? 'blue' : 'gray'" size="small">{{ record.is_query === '1' ? '是' : '否' }}</a-tag>
                </template>
              </a-table-column>
              <a-table-column title="是否高频" data-index="is_important" :width="80" align="center">
                <template #cell="{ record }">
                  <a-tag :color="record.is_important === '1' ? 'orangered' : 'gray'" size="small">{{ record.is_important === '1' ? '是' : '否' }}</a-tag>
                </template>
              </a-table-column>
              <a-table-column title="已关联事务" data-index="has_txn" :width="90" align="center">
                <template #cell="{ record }">
                  <a-tag :color="record.has_txn === '1' ? 'green' : 'red'" size="small">{{ record.has_txn === '1' ? '是' : '否' }}</a-tag>
                </template>
              </a-table-column>
              <a-table-column title="事务编码" data-index="txn_code" :width="140" ellipsis />
              <a-table-column title="有基准值" data-index="has_baseline" :width="80" align="center">
                <template #cell="{ record }">
                  <a-tag :color="record.has_baseline === '1' ? 'green' : 'gray'" size="small">{{ record.has_baseline === '1' ? '是' : '否' }}</a-tag>
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
import { ref, computed } from 'vue'
import { Message } from '@arco-design/web-vue'
import { ApiPerfCoverage } from '@/api/perfApis'
import { useDownload, useGet, usePost, useTableAutoHeight, useAutoHeight } from '@/hooks'

const { downloadWithTip } = useDownload()

defineOptions({ name: 'coverage-dashboard' })

// 左树右表外层 flex 行：实测顶边反推确定高度，供子项 flex:1 派生（详见模板注释）
const layoutRow = ref<HTMLElement>()
const { height: layoutRowH } = useAutoHeight(layoutRow)

// 表格高度自适应（滚动条在表格内，表头固定）
const tableWrap = ref<HTMLElement>()
// fillParent：这个容器是外层实测定高 flex 行里的 `flex:1` 子项，高度已确定。
// 用视口反推会与父级实际剩余空间差出一截（两者各减不同余量），
// 表现为表格下方留白 —— 直接取容器自身高度才严丝合缝。
const { tableHeight } = useTableAutoHeight(tableWrap, { fillParent: true })

const productLine = ref('星瀚')
const caliber = ref('all')
const treeSearch = ref('')
const selectedKeys = ref<string[]>([])

// ── 树数据（固定层级：全部→云→应用→菜单分组→表单） ──────────────────────────────────
const treeData = ref<any[]>([])
const treeLoading = ref(false)
const treePayload = ref<any>({ product_line: productLine.value, caliber: caliber.value })
const { execute: fetchTree } = useGet<any>(ApiPerfCoverage.tree, treePayload, {
  immediate: true,
  onSuccess(data: any) {
    treeData.value = Array.isArray(data) ? data : []
  },
})

// 搜索过滤树（仅影响渲染视图）
const displayTree = computed(() => {
  if (!treeSearch.value) return treeData.value
  const kw = treeSearch.value.toLowerCase()
  const filterNodes = (nodes: any[]): any[] =>
    nodes.reduce((acc: any[], node) => {
      const children = node.children?.length ? filterNodes(node.children) : []
      if (node.title?.toLowerCase().includes(kw) || children.length) acc.push({ ...node, children })
      return acc
    }, [])
  return filterNodes(treeData.value)
})

// ── 总览（双覆盖率 + 高频） ──────────────────────────────────
const overviewPayload = ref<any>({ product_line: productLine.value, caliber: caliber.value })
const { execute: fetchOverview, data: overviewData } = useGet<any>(ApiPerfCoverage.overview, overviewPayload, { immediate: true })
const overview = computed(() => overviewData.value || {
  total_forms: 0, covered_forms: 0, load_coverage_rate: 0,
  total_buttons: 0, covered_buttons: 0, baseline_coverage_rate: 0,
  high_freq_total: 0, high_freq_covered: 0, high_freq_rate: 0,
})

// ── 明细（按钮级，服务端分页） ──────────────────────────────────
const detailPage = ref(1)
const detailPageSize = ref(20)
const detailFilter = ref<any>({})

const detailParams = computed(() => ({
  product_line: productLine.value,
  ...detailFilter.value,
  page_num: detailPage.value,
  page_size: detailPageSize.value,
}))
const { isFetching: detailLoading, data: detailRawData, execute: fetchDetail } = useGet<any>(ApiPerfCoverage.detail, detailParams, { immediate: true })
const detailList = computed(() => detailRawData.value?.list || [])
const detailTotal = computed(() => detailRawData.value?.total || 0)

function handleDetailPageChange(page: number) {
  detailPage.value = page
  fetchDetail()
}
function handleDetailPageSizeChange(size: number) {
  detailPageSize.value = size
  detailPage.value = 1
  fetchDetail()
}

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

// 选中树节点 → 联动 overview + detail 过滤
const onTreeSelect = (keys: (string | number)[]) => {
  selectedKeys.value = keys.map(String)
  const filter: any = {}
  if (keys.length) {
    const node = findTreeNode(treeData.value, String(keys[0]))
    if (node?.level === 'cloud') filter.cloud_number = node.code
    else if (node?.level === 'app') filter.app_number = node.code
    else if (node?.level === 'menu') filter.menu_group = node.code
    else if (node?.level === 'form') filter.form_id = node.code
  }
  detailFilter.value = filter
  overviewPayload.value = { product_line: productLine.value, caliber: caliber.value, ...filter }
  detailPage.value = 1
  fetchOverview()
  fetchDetail()
}

const onProductLineChange = () => {
  selectedKeys.value = []
  detailFilter.value = {}
  treePayload.value = { product_line: productLine.value, caliber: caliber.value }
  treeLoading.value = true
  fetchTree().finally(() => {
    treeLoading.value = false
  })
  overviewPayload.value = { product_line: productLine.value, caliber: caliber.value }
  detailPage.value = 1
  fetchOverview()
  fetchDetail()
}

// 切换压测覆盖率分母口径：重新拉取树（load_rate 变化）+ 总览；基准明细不受影响
const onCaliberChange = () => {
  treePayload.value = { product_line: productLine.value, caliber: caliber.value }
  treeLoading.value = true
  fetchTree().finally(() => {
    treeLoading.value = false
  })
  overviewPayload.value = { ...overviewPayload.value, caliber: caliber.value }
  fetchOverview()
}

const getRateColor = (rate: number) => {
  if (rate >= 80) return 'green'
  if (rate >= 50) return 'orangered'
  return 'red'
}

const handleExport = () => {
  const params: any = { product_line: productLine.value, ...detailFilter.value }
  const qs = new URLSearchParams(params).toString()
  downloadWithTip(`${ApiPerfCoverage.export}?${qs}`, 'coverage_export.csv', '导出失败')
}

// 同步覆盖率（后端双同步：压测 + 基准）
const syncPayload = ref({ product_line: productLine.value })
const { execute: doSync, isFetching: syncing } = usePost<any>(ApiPerfCoverage.sync, syncPayload, { immediate: false })
const handleSync = async () => {
  syncPayload.value = { product_line: productLine.value }
  const res = await doSync()
  if (res.data.value !== undefined) {
    Message.success(`同步完成，更新 ${res.data.value} 条记录`)
    onProductLineChange()
  }
}
</script>
