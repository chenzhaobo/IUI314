<script lang="ts" setup>
import { ref, computed } from 'vue'
import { Message } from '@arco-design/web-vue'
import { useGet, usePut, usePost } from '@/hooks'
import { ApiPerfBenchmark, ApiPerfIteration, ApiSysDictData } from '@/api/apis'
import TxnTrendChart from './components/TxnTrendChart.vue'

defineOptions({ name: 'benchmark-report' })

// ── 迭代列表（下拉用） ──────────────────────────────────
const { data: iterData } = useGet<any>(ApiPerfIteration.getList, { page_num: 1, page_size: 100 }, { immediate: true })
const iterOptions = computed(() => iterData.value?.list?.map((i: any) => ({ label: i.name, value: i.id })) || [])

// ── 事务类型字典 ──────────────────────────────────
const { data: txnTypeDictRaw } = useGet<any>(ApiSysDictData.getByType, { dict_type: 'sys_txn_type' }, { immediate: true })
const txnTypeOptions = computed(() => {
  const list = Array.isArray(txnTypeDictRaw.value) ? txnTypeDictRaw.value : []
  return list.map((d: any) => ({ label: d.dict_label, value: d.dict_value }))
})
const txnTypeMap = computed(() => {
  const map: Record<string, string> = {}
  txnTypeOptions.value.forEach((d: any) => { map[d.value] = d.label })
  return map
})

// ── 基准报告列表 ──────────────────────────────────
const queryParams = ref({
  page_num: 1,
  page_size: 20,
  cloud: '',
  app: '',
  domain: '',
  menu: '',
  txn_type: '',
  iteration_id: '',
  pass_status: '',
  compare_status: '',
  keyword: '',
})

const { isFetching: isLoading, data: rawListData, execute: getList } = useGet<any>(
  ApiPerfBenchmark.report,
  queryParams,
  { immediate: true },
)
const dataList = computed(() => rawListData.value?.list || [])
const total = computed(() => rawListData.value?.total || 0)

function handleSearch() {
  queryParams.value.page_num = 1
  getList()
}
function handlePageChange(page: number) {
  queryParams.value.page_num = page
  getList()
}

// ── 下拉选项（从列表数据中提取去重值） ──────────────────────────────────
const allClouds = computed(() => {
  const set = new Set<string>()
  dataList.value.forEach((r: any) => { if (r.cloud) set.add(r.cloud) })
  return Array.from(set).map(v => ({ label: v, value: v }))
})
const allApps = computed(() => {
  const set = new Set<string>()
  dataList.value.forEach((r: any) => { if (r.app) set.add(r.app) })
  return Array.from(set).map(v => ({ label: v, value: v }))
})
const allDomains = computed(() => {
  const set = new Set<string>()
  dataList.value.forEach((r: any) => { if (r.domain) set.add(r.domain) })
  return Array.from(set).map(v => ({ label: v, value: v }))
})
const allMenus = computed(() => {
  const set = new Set<string>()
  dataList.value.forEach((r: any) => { if (r.menu) set.add(r.menu) })
  return Array.from(set).map(v => ({ label: v, value: v }))
})

// ── 状态映射 ──────────────────────────────────
const passStatusMap: Record<string, { color: string; text: string }> = {
  pass: { color: 'green', text: '达标' },
  fail: { color: 'red', text: '不达标' },
  no_target: { color: 'gray', text: '无目标值' },
}

const compareStatusMap: Record<string, { color: string; text: string }> = {
  improved: { color: 'green', text: '改善' },
  normal: { color: 'blue', text: '正常' },
  degraded: { color: 'red', text: '腐化' },
  initial: { color: 'orange', text: '首次' },
  failed: { color: 'red', text: '失败' },
}

// ── 趋势图弹窗 ──────────────────────────────────
const trendVisible = ref(false)
const trendTxnCode = ref('')
const trendTxnName = ref('')

function handleViewTrend(record: any) {
  trendTxnCode.value = record.txn_code
  trendTxnName.value = record.txn_name
  trendVisible.value = true
}

// ── 手工标记通过 ──────────────────────────────────
const passForm = ref({ txn_code: '' })
const { execute: doManualPass, isFetching: passing } = usePut(ApiPerfBenchmark.manualPass, passForm)

async function handleManualPass(record: any) {
  passForm.value = { txn_code: record.txn_code }
  await doManualPass({ txn_code: record.txn_code })
  Message.success('已标记为通过')
  getList()
}

// ── 工具函数 ──────────────────────────────────
function fmtSec(ms?: number | null): string {
  if (ms === null || ms === undefined) return '-'
  return (ms / 1000).toFixed(1)
}

function fmtTime(time?: string | null): string {
  if (!time) return '-'
  return time.replace('T', ' ').substring(0, 19)
}

function fmtPct(v?: number | null): string {
  if (v === null || v === undefined) return '-'
  return v.toFixed(2) + '%'
}

// ── 补偿重建 ──────────────────────────────────
const rebuilding = ref(false)
const { execute: doRebuild } = usePost<any>(ApiPerfBenchmark.rebuildHistory, {})

async function handleRebuild() {
  rebuilding.value = true
  try {
    const res = await doRebuild()
    const data = res?.value || res
    if (data) {
      Message.success(`补偿重建完成：处理 ${data.total} 条，成功 ${data.success} 条，失败 ${data.failed} 条`)
    } else {
      Message.success('补偿重建完成')
    }
    getList()
  } catch (e: any) {
    Message.error('补偿重建失败: ' + (e?.message || e))
  } finally {
    rebuilding.value = false
  }
}

const allColumns = [
  { key: 'cloud', title: '云', dataIndex: 'cloud', width: 90, ellipsis: true, tooltip: true, fixed: 'left' as const },
  { key: 'app', title: '应用', dataIndex: 'app', width: 90, ellipsis: true, tooltip: true },
  { key: 'domain', title: '领域', dataIndex: 'domain', width: 90, ellipsis: true, tooltip: true },
  { key: 'menu', title: '菜单', dataIndex: 'menu', width: 100, ellipsis: true, tooltip: true },
  { key: 'txn_code', title: '事务编码', dataIndex: 'txn_code', width: 140, ellipsis: true, tooltip: true },
  { key: 'txn_type', title: '事务类型', dataIndex: 'txn_type', width: 100, align: 'center' as const, slotName: 'txn_type' },
  { key: 'txn_name', title: '事务名称', dataIndex: 'txn_name', width: 200, ellipsis: true, tooltip: true },
  { key: 'target_value_ms', title: '目标值(秒)', dataIndex: 'target_value_ms', width: 90, align: 'center' as const, slotName: 'target_value' },
  { key: 'baseline_value_ms', title: '比对值(秒)', dataIndex: 'baseline_value_ms', width: 90, align: 'center' as const, slotName: 'baseline_value' },
  { key: 'average_ms', title: '最新结果(秒)', dataIndex: 'average_ms', width: 100, align: 'center' as const, slotName: 'avg_value' },
  { key: 'iteration_name', title: '最新结果迭代', dataIndex: 'iteration_name', width: 140, ellipsis: true, tooltip: true },
  { key: 'created_at', title: '最新结果时间', dataIndex: 'created_at', width: 160, slotName: 'created_at' },
  { key: 'error_pct', title: '错误率', dataIndex: 'error_pct', width: 80, align: 'center' as const, slotName: 'error_pct' },
  { key: 'pass_status', title: '达标状态', dataIndex: 'pass_status', width: 90, align: 'center' as const, slotName: 'pass_status' },
  { key: 'compare_status', title: '比对状态', dataIndex: 'compare_status', width: 90, align: 'center' as const, slotName: 'compare_status' },
  { key: 'baseline_updated_at', title: '比对值更新时间', dataIndex: 'baseline_updated_at', width: 160, slotName: 'baseline_updated_at' },
  { key: 'baseline_iteration_name', title: '比对值更新迭代', dataIndex: 'baseline_iteration_name', width: 140, ellipsis: true, tooltip: true },
  { key: 'action', title: '操作', key: 'action', width: 150, align: 'center' as const, slotName: 'action', fixed: 'right' as const },
]

// ── 列配置（拖拽排序 + 显示/隐藏） ──────────────────────────────────
const STORAGE_KEY = 'benchmark_report_columns'
const columnSettingVisible = ref(false)

// 从 localStorage 恢复用户上次配置，否则全部显示
function loadColumnConfig(): { keys: string[]; hidden: string[] } {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return JSON.parse(saved)
  } catch {}
  return { keys: allColumns.map(c => c.key), hidden: [] }
}

const columnConfig = ref(loadColumnConfig())

const visibleColumns = computed(() => {
  const hiddenSet = new Set(columnConfig.value.hidden)
  // 按用户排序的 keys 顺序，过滤掉隐藏列
  return columnConfig.value.keys
    .filter(k => !hiddenSet.has(k))
    .map(k => allColumns.find(c => c.key === k))
    .filter(Boolean) as typeof allColumns
})

function toggleColumnVisible(key: string) {
  const hidden = new Set(columnConfig.value.hidden)
  if (hidden.has(key)) {
    hidden.delete(key)
  } else {
    hidden.add(key)
  }
  columnConfig.value.hidden = Array.from(hidden)
  saveColumnConfig()
}

function moveColumn(key: string, direction: 'up' | 'down') {
  const keys = [...columnConfig.value.keys]
  const idx = keys.indexOf(key)
  if (idx < 0) return
  if (direction === 'up' && idx > 0) {
    [keys[idx], keys[idx - 1]] = [keys[idx - 1], keys[idx]]
  } else if (direction === 'down' && idx < keys.length - 1) {
    [keys[idx], keys[idx + 1]] = [keys[idx + 1], keys[idx]]
  }
  columnConfig.value.keys = keys
  saveColumnConfig()
}

function resetColumns() {
  columnConfig.value = { keys: allColumns.map(c => c.key), hidden: [] }
  saveColumnConfig()
}

function saveColumnConfig() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(columnConfig.value))
}
</script>

<template>
  <div class="page-container">
    <!-- 搜索栏 -->
    <a-card :bordered="false" class="mb-12px">
      <a-row :gutter="12">
        <a-col :span="4">
          <a-select v-model="queryParams.cloud" :options="allClouds" placeholder="云" allow-search allow-clear />
        </a-col>
        <a-col :span="4">
          <a-select v-model="queryParams.app" :options="allApps" placeholder="应用" allow-search allow-clear />
        </a-col>
        <a-col :span="4">
          <a-select v-model="queryParams.domain" :options="allDomains" placeholder="领域" allow-search allow-clear />
        </a-col>
        <a-col :span="4">
          <a-select v-model="queryParams.menu" :options="allMenus" placeholder="菜单" allow-search allow-clear />
        </a-col>
        <a-col :span="4">
          <a-select v-model="queryParams.txn_type" :options="txnTypeOptions" placeholder="事务类型" allow-search allow-clear />
        </a-col>
        <a-col :span="4">
          <a-select v-model="queryParams.iteration_id" :options="iterOptions" placeholder="迭代" allow-search allow-clear />
        </a-col>
        <a-col :span="4">
          <a-input v-model="queryParams.keyword" placeholder="事务编码/名称" allow-clear @press-enter="handleSearch" />
        </a-col>
      </a-row>
      <a-row :gutter="12" style="margin-top: 8px">
        <a-col :span="4">
          <a-select v-model="queryParams.pass_status" placeholder="达标状态" allow-clear>
            <a-option value="pass">达标</a-option>
            <a-option value="fail">不达标</a-option>
            <a-option value="no_target">无目标值</a-option>
          </a-select>
        </a-col>
        <a-col :span="4">
          <a-select v-model="queryParams.compare_status" placeholder="比对状态" allow-clear>
            <a-option value="improved">改善</a-option>
            <a-option value="normal">正常</a-option>
            <a-option value="degraded">腐化</a-option>
            <a-option value="initial">首次</a-option>
            <a-option value="failed">失败</a-option>
          </a-select>
        </a-col>
        <a-col :span="4">
          <a-space>
            <a-button type="primary" @click="handleSearch">查询</a-button>
          </a-space>
        </a-col>
      </a-row>
    </a-card>

    <!-- 列表 -->
    <a-card :bordered="false">
      <div style="margin-bottom: 12px">
        <a-space>
          <a-button type="primary" status="warning" :loading="rebuilding" @click="handleRebuild">
            补偿重建
          </a-button>
          <a-popover v-model:popup-visible="columnSettingVisible" trigger="click" position="bottom">
            <a-button>列设置</a-button>
            <template #content>
              <div style="width: 260px; max-height: 420px; overflow-y: auto">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px">
                  <span style="font-weight: 600">列顺序与显示</span>
                  <a-button type="text" size="mini" @click="resetColumns">重置</a-button>
                </div>
                <div v-for="key in columnConfig.keys" :key="key" style="display: flex; align-items: center; padding: 4px 0; gap: 8px">
                  <a-checkbox :model-value="!columnConfig.hidden.includes(key)" @change="toggleColumnVisible(key)">
                    {{ allColumns.find(c => c.key === key)?.title || key }}
                  </a-checkbox>
                  <span style="margin-left: auto; display: flex; gap: 2px">
                    <a-button type="text" size="mini" :disabled="columnConfig.keys.indexOf(key) === 0" @click="moveColumn(key, 'up')">↑</a-button>
                    <a-button type="text" size="mini" :disabled="columnConfig.keys.indexOf(key) === columnConfig.keys.length - 1" @click="moveColumn(key, 'down')">↓</a-button>
                  </span>
                </div>
              </div>
            </template>
          </a-popover>
        </a-space>
      </div>
      <a-table
        :columns="visibleColumns"
        :data="dataList"
        :loading="isLoading"
        :pagination="{
          total,
          current: queryParams.page_num,
          pageSize: queryParams.page_size,
          showTotal: true,
        }"
        row-key="txn_code"
        :scroll="{ x: 2000 }"
        @page-change="handlePageChange"
      >
        <template #target_value="{ record }">{{ fmtSec(record.target_value_ms) }}</template>
        <template #baseline_value="{ record }">{{ fmtSec(record.baseline_value_ms) }}</template>
        <template #avg_value="{ record }">{{ fmtSec(record.average_ms) }}</template>
        <template #error_pct="{ record }">{{ fmtPct(record.error_pct) }}</template>
        <template #txn_type="{ record }">
          {{ txnTypeMap[record.txn_type] || '-' }}
        </template>
        <template #pass_status="{ record }">
          <a-tag :color="(passStatusMap[record.pass_status]?.color) || 'gray'">
            {{ passStatusMap[record.pass_status]?.text || record.pass_status || '-' }}
          </a-tag>
        </template>
        <template #compare_status="{ record }">
          <a-tag :color="(compareStatusMap[record.compare_status]?.color) || 'gray'">
            {{ compareStatusMap[record.compare_status]?.text || record.compare_status || '-' }}
          </a-tag>
        </template>
        <template #baseline_updated_at="{ record }">{{ fmtTime(record.baseline_updated_at) }}</template>
        <template #created_at="{ record }">{{ fmtTime(record.created_at) }}</template>
        <template #action="{ record }">
          <a-space>
            <a-button type="text" size="small" @click="handleViewTrend(record)">趋势</a-button>
            <a-button
              type="text"
              size="small"
              status="success"
              :loading="passing"
              @click="handleManualPass(record)"
              v-if="record.compare_status === 'degraded'"
            >
              标记通过
            </a-button>
          </a-space>
        </template>
      </a-table>
    </a-card>

    <!-- 趋势图弹窗 -->
    <TxnTrendChart
      v-model:visible="trendVisible"
      :txn-code="trendTxnCode"
      :txn-name="trendTxnName"
    />
  </div>
</template>
