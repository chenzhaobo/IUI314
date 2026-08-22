<script lang="ts" setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { Message, type TableColumnData } from '@arco-design/web-vue'
import { useGet, usePost } from '@/hooks'
import { ApiPerfEnv, ApiPerfTableStats, ApiSysDictData } from '@/api/apis'

defineOptions({ name: 'entity-meta' })

// ── 产品线选择（数据字典）──────────────────────────
const productLine = ref('')
const { data: dictRaw } = useGet<any>(ApiSysDictData.getByType, { dict_type: 'perf_product_line' }, { immediate: true })
const productLineOptions = computed(() => (Array.isArray(dictRaw.value) ? dictRaw.value : []).map((d: any) => ({ label: d.dict_label, value: d.dict_value })))

watch(dictRaw, (val) => {
  if (!productLine.value && Array.isArray(val) && val.length > 0) {
    const defaultItem = val.find((d: any) => d.is_default === 'Y')
    productLine.value = defaultItem?.dict_value || val[0]?.dict_value || ''
  }
}, { immediate: true })

// ── 环境选择（按产品线过滤）──────────────────────────
const sourceEnvId = ref('')
const { data: envData, execute: fetchEnvList } = useGet<any>(ApiPerfEnv.getList, computed(() => ({ page_num: 1, page_size: 100, product_line: productLine.value })), { immediate: false })
const envOptions = computed(() => (envData.value?.list || []).map((e: any) => ({ label: e.env_name, value: e.id })))

watch(productLine, () => {
  sourceEnvId.value = ''
  if (productLine.value) {
    fetchEnvList()
  }
})

// ── Tab 切换 ──────────────────────────────────
const activeTab = ref<'stats' | 'entity' | 'dbsizes'>('stats')

// ── 统计汇总（全局统计，从预检查API获取）──────────────────────────
const statsSummary = ref<any>(null)
const { data: statsSummaryData, isFetching: statsSummaryLoading, execute: fetchStatsSummary } = useGet<any>(ApiPerfTableStats.syncPreview, computed(() => ({
  env_id: sourceEnvId.value,
  product_line: productLine.value,
})), { immediate: false })

watch(statsSummaryData, (val) => {
  if (val) statsSummary.value = val
})

// 格式化字节为人类可读
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

// 数字千分位格式化
function formatNumber(val: any): string {
  const n = Number(val)
  return isNaN(n) ? '-' : n.toLocaleString('en-US')
}

// ── 表统计列表（主 Tab，分页）──────────────────────────
const statsQuery = ref({
  keyword: '',
  db_route_key: '',
  row_count_type: '',
})
const statsPage = ref(1)
const statsPageSize = ref(50)

const { isFetching: statsLoading, data: statsRawData, execute: fetchTableStatsList } = useGet<any>(ApiPerfTableStats.list, computed(() => {
  const params: Record<string, any> = {
    env_id: sourceEnvId.value,
    product_line: productLine.value,
    page_num: statsPage.value,
    page_size: statsPageSize.value,
  }
  if (statsQuery.value.keyword) params.keyword = statsQuery.value.keyword
  if (statsQuery.value.db_route_key) params.db_route_key = statsQuery.value.db_route_key
  if (statsQuery.value.row_count_type) params.row_count_type = statsQuery.value.row_count_type
  return params
}), { immediate: false })

const statsList = computed(() => statsRawData.value?.list || [])
const statsTotal = computed(() => statsRawData.value?.total || 0)

function handleStatsSearch() {
  statsPage.value = 1
  fetchTableStatsList()
}

function handleStatsPageChange(page: number) {
  statsPage.value = page
  fetchTableStatsList()
}

function handleStatsPageSizeChange(size: number) {
  statsPageSize.value = size
  statsPage.value = 1
  fetchTableStatsList()
}

const statsColumns: TableColumnData[] = [
  { title: '数据库', dataIndex: 'db_route_key', width: 100, ellipsis: true, tooltip: true },
  { title: 'Schema', dataIndex: 'schema_name', width: 90, ellipsis: true, tooltip: true },
  { title: '表名', dataIndex: 'table_name', width: 220, ellipsis: true, tooltip: true },
  { title: '行数', dataIndex: 'row_count', width: 120, align: 'right' as const, sortable: { sortDirections: ['descend', 'ascend'] }, render: ({ record }: any) => formatNumber(record.row_count) },
  { title: '字段数', dataIndex: 'column_count', width: 80, align: 'right' as const, sortable: { sortDirections: ['descend', 'ascend'] }, render: ({ record }: any) => formatNumber(record.column_count) },
  { title: '类型', dataIndex: 'row_count_type', width: 80, slotName: 'row_count_type' },
  { title: '空间大小', dataIndex: 'total_size_human', width: 100, ellipsis: true, tooltip: true, sortable: { sortDirections: ['descend', 'ascend'], sorter: (a: any, b: any) => (a.total_size_bytes || 0) - (b.total_size_bytes || 0) }},
  { title: '同步时间', dataIndex: 'synced_at', width: 160, slotName: 'synced_at' },
]

// ── 实体元数据列表（次 Tab，分页）──────────────────────────
const entityQuery = ref({
  keyword: '',
  db_route_key: '',
})
const entityPage = ref(1)
const entityPageSize = ref(50)

const { isFetching: entityLoading, data: entityRawData, execute: getEntityList } = useGet<any>(ApiPerfTableStats.entityList, computed(() => {
  const params: Record<string, any> = {
    env_id: sourceEnvId.value,
    product_line: productLine.value,
    page_num: entityPage.value,
    page_size: entityPageSize.value,
  }
  if (entityQuery.value.keyword) params.keyword = entityQuery.value.keyword
  if (entityQuery.value.db_route_key) params.db_route_key = entityQuery.value.db_route_key
  return params
}), { immediate: false })

const entityList = computed(() => entityRawData.value?.list || [])
const entityTotal = computed(() => entityRawData.value?.total || 0)

function handleEntitySearch() {
  entityPage.value = 1
  getEntityList()
}

function handleEntityPageChange(page: number) {
  entityPage.value = page
  getEntityList()
}

function handleEntityPageSizeChange(size: number) {
  entityPageSize.value = size
  entityPage.value = 1
  getEntityList()
}

const entityColumns: TableColumnData[] = [
  { title: '元数据编码', dataIndex: 'form_number', width: 160, ellipsis: true, tooltip: true },
  { title: '名称', dataIndex: 'entity_name', width: 150, ellipsis: true, tooltip: true },
  { title: '类型', dataIndex: 'entity_type', width: 100, slotName: 'entity_type' },
  { title: '模型类型', dataIndex: 'model_type', width: 120, slotName: 'model_type' },
  { title: 'DB路由键', dataIndex: 'db_route_key', width: 120, ellipsis: true, tooltip: true },
  { title: '主表名', dataIndex: 'main_table', width: 200, ellipsis: true, tooltip: true },
  { title: '行数', dataIndex: 'row_count', width: 120, align: 'right' as const, sortable: { sortDirections: ['descend', 'ascend'] }, render: ({ record }: any) => formatNumber(record.row_count) },
  { title: '行数类型', dataIndex: 'row_count_type', width: 80, slotName: 'entity_row_count_type' },
  { title: '空间大小', dataIndex: 'total_size_human', width: 100, ellipsis: true, tooltip: true },
  { title: '表统计同步时间', dataIndex: 'stats_synced_at', width: 160, slotName: 'stats_synced_at' },
  { title: '实体同步时间', dataIndex: 'entity_synced_at', width: 160, slotName: 'entity_synced_at' },
]

watch(activeTab, (val) => {
  if (val === 'entity' && entityList.value.length === 0 && sourceEnvId.value) {
    getEntityList()
  }
  if (val === 'dbsizes' && !dbSizesRawData.value && sourceEnvId.value) {
    getDbSizes()
  }
})

// ── 数据库大小（第三个 Tab）──────────────────────────
const { isFetching: dbSizesLoading, data: dbSizesRawData, execute: getDbSizes } = useGet<any>(ApiPerfTableStats.dbSizes, computed(() => ({
  env_id: sourceEnvId.value,
  product_line: productLine.value,
})), { immediate: false })

const dbSizesList = computed(() => Array.isArray(dbSizesRawData.value) ? dbSizesRawData.value : [])
const dbSizesTotalBytes = computed(() => dbSizesList.value.reduce((sum: number, d: any) => sum + (d.size_bytes || 0), 0))
const dbSizesTotalHuman = computed(() => formatBytes(dbSizesTotalBytes.value))
const dbSizesTableTotal = computed(() => dbSizesList.value.reduce((sum: number, d: any) => sum + (d.table_count || 0), 0))

const dbSizesColumns: TableColumnData[] = [
  { title: '数据库名', dataIndex: 'db_name', width: 250, ellipsis: true, tooltip: true },
  { title: '路由键', dataIndex: 'db_route_key', width: 120, ellipsis: true, tooltip: true },
  { title: '空间大小', dataIndex: 'size_human', width: 120, align: 'right' as const, sortable: { sortDirections: ['descend', 'ascend'], sorter: (a: any, b: any) => (a.size_bytes || 0) - (b.size_bytes || 0) }},
  { title: '表数量', dataIndex: 'table_count', width: 100, align: 'right' as const, sortable: { sortDirections: ['descend', 'ascend'], sorter: (a: any, b: any) => (a.table_count || 0) - (b.table_count || 0) }, render: ({ record }: any) => formatNumber(record.table_count) },
]

watch(sourceEnvId, () => {
  statsPage.value = 1
  entityPage.value = 1
  dbSizesRawData.value = null
  fetchTableStatsList()
  fetchSyncStatusIfNeeded()
  fetchStatsSummary()
})

// ════════════════════════════════════════════════════
// 同步表统计 — 弹窗 + 预检查
// ════════════════════════════════════════════════════

const syncStatsVisible = ref(false)
const syncStatsLoading = ref(false)
const syncStatsProductLine = ref('')
const syncStatsEnvId = ref('')
const syncMode = ref<'estimated' | 'actual'>('estimated')
const statsConcurrency = ref(4)
const syncStatsEnvIdForPolling = ref('')

// 弹窗内的环境列表
const { data: syncStatsEnvData, execute: fetchSyncStatsEnvList } = useGet<any>(ApiPerfEnv.getList, computed(() => ({ page_num: 1, page_size: 100, product_line: syncStatsProductLine.value })), { immediate: false })
const syncStatsEnvOptions = computed(() => (syncStatsEnvData.value?.list || []).map((e: any) => ({ label: e.env_name, value: e.id })))

// 预检查数据
const syncPreviewLoading = ref(false)
const syncPreviewData = ref<any>(null)

function openSyncStatsModal() {
  if (isSyncing.value) { Message.warning('当前已有同步任务在运行'); return }
  syncStatsProductLine.value = productLine.value
  syncStatsEnvId.value = sourceEnvId.value
  syncMode.value = 'estimated'
  syncPreviewData.value = null
  syncStatsVisible.value = true
  if (syncStatsProductLine.value) {
    fetchSyncStatsEnvList()
  }
}

watch(syncStatsProductLine, () => {
  syncStatsEnvId.value = ''
  syncPreviewData.value = null
  if (syncStatsProductLine.value) {
    fetchSyncStatsEnvList()
  }
})

// 选择环境后自动预检查
watch(syncStatsEnvId, async (val) => {
  syncPreviewData.value = null
  if (!val || !syncStatsProductLine.value) return
  // 如果与当前页面环境一致，复用 statsSummary
  if (val === sourceEnvId.value && syncStatsProductLine.value === productLine.value && statsSummary.value) {
    syncPreviewData.value = statsSummary.value
    return
  }
  syncPreviewLoading.value = true
  try {
    const { execute, error, data } = useGet<any>(ApiPerfTableStats.syncPreview, { env_id: val, product_line: syncStatsProductLine.value }, { immediate: false })
    await execute()
    if (!error.value) {
      syncPreviewData.value = data.value
    }
  } finally {
    syncPreviewLoading.value = false
  }
})

async function confirmTableStatsSync() {
  if (!syncStatsProductLine.value) { Message.warning('请选择产品线'); return }
  if (!syncStatsEnvId.value) { Message.warning('请选择环境'); return }
  syncStatsLoading.value = true
  try {
    const payload: any = {
      env_id: syncStatsEnvId.value,
      product_line: syncStatsProductLine.value,
      sync_mode: syncMode.value,
    }
    if (syncMode.value === 'actual') {
      payload.concurrency = statsConcurrency.value
    }
    const { execute, error } = usePost<string>(ApiPerfTableStats.sync, payload)
    await execute()
    if (error.value) { Message.error('触发同步失败'); return }
    Message.success(syncMode.value === 'estimated' ? '估算同步已启动' : '精确同步已启动')
    syncStatsEnvIdForPolling.value = syncStatsEnvId.value
    syncStatsVisible.value = false
    startPolling()
  } finally {
    syncStatsLoading.value = false
  }
}

async function handleTableStatsCancel() {
  const { execute, error } = usePost(ApiPerfTableStats.cancel, { env_id: syncStatsEnvIdForPolling.value })
  await execute()
  if (error.value) { Message.error('取消失败'); return }
  Message.info('已发送取消信号')
}

// ── 同步状态轮询 ──────────────────────────────────
const syncStatus = ref<any>({ status: 'idle', done_count: 0, total_count: 0, error_count: 0, sync_mode: null })
let syncPollTimer: ReturnType<typeof setInterval> | null = null

const isSyncing = computed(() => syncStatus.value?.status === 'running')
const syncProgress = computed(() => {
  if (!syncStatus.value || syncStatus.value.total_count === 0) return 0
  return syncStatus.value.done_count / syncStatus.value.total_count
})

const { data: syncStatusData, execute: fetchSyncStatus } = useGet<any>(ApiPerfTableStats.status, computed(() => ({ env_id: syncStatsEnvIdForPolling.value })), { immediate: false })

watch(syncStatusData, (val) => {
  if (val) syncStatus.value = val
})

function startPolling() {
  stopPolling()
  fetchSyncStatus()
  syncPollTimer = setInterval(() => {
    fetchSyncStatus()
    if (syncStatus.value && ['completed', 'failed', 'cancelled', 'idle'].includes(syncStatus.value.status)) {
      stopPolling()
      // 同步完成后刷新列表和统计
      fetchTableStatsList()
      fetchStatsSummary()
      if (activeTab.value === 'entity') {
        getEntityList()
      }
      if (activeTab.value === 'dbsizes') {
        getDbSizes()
      }
    }
  }, 3000)
}

function stopPolling() {
  if (syncPollTimer) {
    clearInterval(syncPollTimer)
    syncPollTimer = null
  }
}

function fetchSyncStatusIfNeeded() {
  if (sourceEnvId.value) {
    syncStatsEnvIdForPolling.value = sourceEnvId.value
    fetchSyncStatus()
  }
}

onUnmounted(() => {
  stopPolling()
})
</script>

<template>
  <div class="perf-entity-meta">
    <!-- 顶部操作栏 -->
    <a-card :bordered="false" class="m-b-8px top-bar">
      <!-- 查询筛选行 -->
      <div class="filter-row">
        <div class="filter-item">
          <span class="filter-label">产品线</span>
          <a-select v-model="productLine" :options="productLineOptions" placeholder="选择产品线" allow-search style="width: 150px" />
        </div>
        <div class="filter-item">
          <span class="filter-label">环境</span>
          <a-select v-model="sourceEnvId" :options="envOptions" placeholder="选择环境" allow-search :disabled="!productLine" style="width: 180px" />
        </div>
        <template v-if="activeTab === 'stats'">
          <div class="filter-item">
            <span class="filter-label">表名</span>
            <a-input v-model="statsQuery.keyword" placeholder="搜索表名" allow-clear style="width: 160px" @press-enter="handleStatsSearch" />
          </div>
          <div class="filter-item">
            <span class="filter-label">数据库</span>
            <a-input v-model="statsQuery.db_route_key" placeholder="筛选库" allow-clear style="width: 120px" @press-enter="handleStatsSearch" />
          </div>
          <a-select v-model="statsQuery.row_count_type" placeholder="行数类型" allow-clear style="width: 120px">
            <a-option value="estimated">估算</a-option>
            <a-option value="actual">精确</a-option>
          </a-select>
        </template>
        <template v-else-if="activeTab === 'entity'">
          <div class="filter-item">
            <span class="filter-label">编码/名称</span>
            <a-input v-model="entityQuery.keyword" placeholder="搜索编码或名称" allow-clear style="width: 180px" @press-enter="handleEntitySearch" />
          </div>
          <div class="filter-item">
            <span class="filter-label">DB路由键</span>
            <a-input v-model="entityQuery.db_route_key" placeholder="筛选路由键" allow-clear style="width: 140px" @press-enter="handleEntitySearch" />
          </div>
        </template>
        <a-button v-if="activeTab !== 'dbsizes'" type="primary" :disabled="!sourceEnvId" @click="activeTab === 'stats' ? handleStatsSearch() : handleEntitySearch()">
          <template #icon><icon-search /></template>
          搜索
        </a-button>
      </div>

     <!-- 统计数字 -->
      <div class="stats-row" :class="{ 'stats-loading': statsSummaryLoading }" v-if="sourceEnvId && activeTab === 'stats'">
        <a-spin v-if="statsSummaryLoading" class="stats-spin" />
        <template v-if="statsSummary && !statsSummaryLoading">
        <a-statistic title="表总数" :value="statsSummary.stats_existing ?? 0" show-group-separator />
        <a-divider direction="vertical" />
        <a-statistic title="估算行数" :value="statsSummary.estimated_row_sum ?? 0" :value-style="{ color: '#00b42a' }" show-group-separator />
        <a-divider direction="vertical" />
        <a-statistic title="精确行数" :value="statsSummary.actual_row_sum ?? 0" :value-style="{ color: '#165dff' }" show-group-separator />
        <a-divider direction="vertical" />
        <div class="stat-item">
          <div class="stat-title">总空间大小</div>
          <div class="stat-value">{{ statsSummary.total_size_human ?? '-' }}</div>
        </div>
        </template>
      </div>

      <!-- 表统计同步进度条 -->
      <a-progress
        v-if="isSyncing || (syncStatus.status === 'completed' && syncStatus.total_count > 0)"
        :percent="syncProgress"
        :status="syncStatus.status === 'completed' ? 'success' : 'normal'"
        :format="() => `${syncStatus.done_count || 0} / ${syncStatus.total_count || 0}${syncStatus.sync_mode ? ' (' + (syncStatus.sync_mode === 'estimated' ? '估算' : '精确') + ')' : ''}`"
        style="margin-top: 8px"
      />
    </a-card>

    <a-card :bordered="false" v-if="!productLine">
      <a-empty description="请先选择产品线" />
    </a-card>

    <a-card :bordered="false" v-else-if="!sourceEnvId">
      <a-empty description="请选择环境" />
    </a-card>

    <a-card :bordered="false" v-else>
      <!-- 操作按钮行 -->
      <div class="action-bar">
        <a-button
          :type="isSyncing ? 'outline' : 'primary'"
          :status="isSyncing ? 'warning' : 'normal'"
          :disabled="!productLine || isSyncing"
          @click="openSyncStatsModal"
        >
          <template #icon><icon-storage /></template>
          同步表统计
        </a-button>
        <a-button v-if="isSyncing" status="danger" @click="handleTableStatsCancel">停止</a-button>
        <a-tabs v-model:active-key="activeTab" type="rounded" style="margin-left: auto">
          <a-tab-pane key="stats" title="表统计列表" />
          <a-tab-pane key="entity" title="实体元数据" />
          <a-tab-pane key="dbsizes" title="数据库概览" />
        </a-tabs>
      </div>

      <!-- 表统计列表 -->
<a-table
  column-resizable
        v-if="activeTab === 'stats'"
        :loading="statsLoading"
        :data="statsList"
        :columns="statsColumns"
        :pagination="{
          total: statsTotal,
          current: statsPage,
          pageSize: statsPageSize,
          showTotal: true,
          showPageSize: true,
        }"
        @page-change="handleStatsPageChange"
        @page-size-change="handleStatsPageSizeChange"
        :scroll="{ y: 'calc(100vh - 420px)', x: 1050 }"
        row-key="id"
      >
        <template #row_count_type="{ record }">
          <a-tag v-if="record.row_count_type === 'actual'" color="blue" size="small">精确</a-tag>
          <a-tag v-else color="green" size="small">估算</a-tag>
        </template>
        <template #synced_at="{ record }">{{ record.synced_at ? record.synced_at.replace('T', ' ').substring(0, 19) : '-' }}</template>
      </a-table>

      <!-- 实体元数据列表 -->
<a-table
  column-resizable
        v-else-if="activeTab === 'entity'"
        :loading="entityLoading"
        :data="entityList"
        :columns="entityColumns"
        :pagination="{
          total: entityTotal,
          current: entityPage,
          pageSize: entityPageSize,
          showTotal: true,
          showPageSize: true,
        }"
        @page-change="handleEntityPageChange"
        @page-size-change="handleEntityPageSizeChange"
        :scroll="{ y: 'calc(100vh - 420px)', x: 1570 }"
        row-key="id"
      >
        <template #entity_type="{ record }">
          <a-tag v-if="record.entity_type === 'MainEntityType'" color="arcoblue" size="small">主实体</a-tag>
          <a-tag v-else-if="record.entity_type === 'BasedataEntityType'" color="green" size="small">基础资料</a-tag>
          <a-tag v-else-if="record.entity_type === 'BillEntityType'" color="orange" size="small">业务单据</a-tag>
          <a-tag v-else-if="record.entity_type === 'ParameterEntityType'" color="purple" size="small">参数实体</a-tag>
          <a-tag v-else-if="record.entity_type === 'QueryEntityType'" color="cyan" size="small">查询实体</a-tag>
          <a-tag v-else-if="record.entity_type === 'LogBillEntityType'" color="gray" size="small">日志单据</a-tag>
          <a-tag v-else-if="record.entity_type === 'ReportQueryEntityType'" color="pinkpurple" size="small">报表查询</a-tag>
          <a-tag v-else-if="record.entity_type === 'KMEntityType'" color="magenta" size="small">知识管理</a-tag>
          <span v-else>-</span>
        </template>
        <template #model_type="{ record }">
          <a-tag v-if="record.model_type === 'BaseFormModel'" color="green" size="small">BaseForm</a-tag>
          <a-tag v-else-if="record.model_type === 'BillFormModel'" color="orange" size="small">BillForm</a-tag>
          <a-tag v-else-if="record.model_type === 'DynamicFormModel'" color="blue" size="small">DynamicForm</a-tag>
          <a-tag v-else-if="record.model_type === 'MobileFormModel'" color="purple" size="small">MobileForm</a-tag>
          <a-tag v-else-if="record.model_type === 'ReportFormModel'" color="cyan" size="small">ReportForm</a-tag>
          <a-tag v-else-if="record.model_type" size="small">{{ record.model_type }}</a-tag>
          <span v-else>-</span>
        </template>
        <template #entity_row_count_type="{ record }">
          <a-tag v-if="record.row_count_type === 'actual'" color="blue" size="small">精确</a-tag>
          <a-tag v-else-if="record.row_count_type === 'estimated'" color="green" size="small">估算</a-tag>
          <span v-else>-</span>
        </template>
        <template #stats_synced_at="{ record }">{{ record.stats_synced_at ? record.stats_synced_at.replace('T', ' ').substring(0, 19) : '-' }}</template>
        <template #entity_synced_at="{ record }">{{ record.entity_synced_at ? record.entity_synced_at.replace('T', ' ').substring(0, 19) : '-' }}</template>
      </a-table>

      <!-- 数据库概览 -->
      <div v-else-if="activeTab === 'dbsizes'">
        <div class="stats-row" style="border-top: none; padding-top: 0; margin-bottom: 10px">
          <a-statistic title="数据库总数" :value="dbSizesList.length" />
          <a-divider direction="vertical" />
          <div class="stat-item">
            <div class="stat-title">总空间大小</div>
            <div class="stat-value">{{ dbSizesTotalHuman }}</div>
          </div>
          <a-divider direction="vertical" />
          <a-statistic title="表总数" :value="dbSizesTableTotal" show-group-separator />
        </div>
<a-table
  column-resizable
          :loading="dbSizesLoading"
          :data="dbSizesList"
          :columns="dbSizesColumns"
          :pagination="false"
          :scroll="{ y: 'calc(100vh - 480px)' }"
          row-key="db_name"
        />
      </div>
    </a-card>

    <!-- 同步表统计弹窗 -->
    <a-modal v-model:visible="syncStatsVisible" title="同步表统计" @ok="confirmTableStatsSync" :ok-loading="syncStatsLoading" :width="540">
      <a-alert type="info" :show-icon="true" style="margin-bottom: 12px">
        估算模式用 pg_class 系统目录快速获取行数（快），精确模式执行实际 COUNT(*)（慢但准确）。
      </a-alert>
      <a-form :model="{ }" layout="vertical">
        <a-form-item label="产品线">
          <a-select v-model="syncStatsProductLine" :options="productLineOptions" placeholder="选择产品线" allow-search />
        </a-form-item>
        <a-form-item label="来源环境">
          <a-select v-model="syncStatsEnvId" :options="syncStatsEnvOptions" placeholder="选择环境" allow-search :disabled="!syncStatsProductLine" />
        </a-form-item>
        <a-form-item label="同步模式">
          <a-radio-group v-model="syncMode">
            <a-radio value="estimated">快速同步（估算行数）</a-radio>
            <a-radio value="actual">精确同步（实际COUNT）</a-radio>
          </a-radio-group>
        </a-form-item>
      </a-form>

      <!-- 预检查结果 -->
      <a-spin :loading="syncPreviewLoading" style="width: 100%">
        <div v-if="syncPreviewData" style="margin-bottom: 12px">
          <a-divider orientation="left" :style="{ fontSize: '13px', margin: '8px 0' }">数据概览</a-divider>
          <a-descriptions :column="2" layout="inline-horizontal" bordered size="small">
            <a-descriptions-item label="数据库数量">{{ formatNumber(syncPreviewData.db_count) }}</a-descriptions-item>
            <a-descriptions-item label="表总数">{{ formatNumber(syncPreviewData.stats_existing) }}</a-descriptions-item>
            <a-descriptions-item label="估算行数表数">
              <a-tag color="green" size="small">{{ formatNumber(syncPreviewData.estimated_count) }}</a-tag>
            </a-descriptions-item>
            <a-descriptions-item label="精确行数表数">
              <a-tag color="blue" size="small">{{ formatNumber(syncPreviewData.actual_count) }}</a-tag>
            </a-descriptions-item>
            <a-descriptions-item label="总空间大小">{{ syncPreviewData.total_size_human ?? '-' }}</a-descriptions-item>
            <a-descriptions-item label="估算行数总和">{{ formatNumber(syncPreviewData.estimated_row_sum) }}</a-descriptions-item>
            <a-descriptions-item label="精确行数总和">{{ formatNumber(syncPreviewData.actual_row_sum) }}</a-descriptions-item>
            <a-descriptions-item label="总空间大小(字节)">{{ formatNumber(syncPreviewData.total_size_bytes) }}</a-descriptions-item>
          </a-descriptions>
          <a-alert v-if="syncPreviewData.last_synced_at" type="normal" :show-icon="true" style="margin-top: 8px">
            上次同步时间: {{ syncPreviewData.last_synced_at.replace('T', ' ').substring(0, 19) }}
          </a-alert>
        </div>
      </a-spin>

      <a-form v-if="syncMode === 'actual'" :model="{ }" layout="vertical">
        <a-form-item label="并发数" help="同时连接的业务库数量，建议 2~8">
          <a-input-number v-model="statsConcurrency" :min="1" :max="20" style="width: 100%" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<style scoped>
.perf-entity-meta { padding: 0; }
.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  margin-bottom: 10px;
}
.filter-item {
  display: flex;
  align-items: center;
  gap: 4px;
}
.filter-label {
  font-size: 13px;
  color: var(--color-text-2);
  white-space: nowrap;
}
.action-bar {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 10px;
}
.stats-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding-top: 10px;
  border-top: 1px solid var(--color-border-2);
  position: relative;
  min-height: 48px;
}
.stats-loading {
  justify-content: center;
}
.stats-spin {
  /* Arco spin centered in stats row */
}
.stat-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.stat-title {
  font-size: 12px;
  color: var(--color-text-2);
  white-space: nowrap;
}
.stat-value {
  font-size: 24px;
  font-weight: 500;
  line-height: 1.5;
  color: var(--color-text-1);
  white-space: nowrap;
}
</style>
