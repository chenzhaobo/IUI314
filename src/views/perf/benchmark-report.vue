<script lang="ts" setup>
import { ref, computed, watch } from 'vue'
import { Message } from '@arco-design/web-vue'
import * as XLSX from 'xlsx'
import { formatTime, useGet, usePost, usePut, useToken } from '@/hooks'
import { ApiPerfBenchmark, ApiPerfIteration, ApiSysDictData, ApiSecProjectGroup } from '@/api/apis'
import TxnTrendChart from './components/TxnTrendChart.vue'

defineOptions({ name: 'benchmark-report' })

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

// ── 产品领域字典（sec_pg_product_domain）──────────────────────────
const { data: domainDictRaw } = useGet<any>(ApiSysDictData.getByType, { dict_type: 'sec_pg_product_domain' }, { immediate: true })
const domainOptions = computed(() => (Array.isArray(domainDictRaw.value) ? domainDictRaw.value : []).map((d: any) => ({ label: d.dict_label, value: d.dict_value })))

// ── 业务领域字典（sec_pg_business_area）──────────────────────────
const { data: bizAreaDictRaw } = useGet<any>(ApiSysDictData.getByType, { dict_type: 'sec_pg_business_area' }, { immediate: true })
const bizAreaOptions = computed(() => {
  const list = Array.isArray(bizAreaDictRaw.value) ? bizAreaDictRaw.value : []
  return list.map((d: any) => ({ label: d.dict_label, value: d.dict_value }))
})

// ── 项目组选项（从 sec_project_group 获取，按领域过滤）──────────────────────────
const { data: pgRawData } = useGet<any>(ApiSecProjectGroup.getAll, {}, { immediate: true })
const projectGroupOptions = computed(() => {
  const all = Array.isArray(pgRawData.value) ? pgRawData.value : []
  const dc = queryParams.value.domain_code
  const filtered = dc ? all.filter((pg: any) => pg.product_group_name === dc) : all
  return filtered.map((pg: any) => ({ label: pg.name, value: pg.name }))
})

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
  page_size: 10,
  product_line: '',
  domain_code: '',
  business_area: '',
  project_group_name: '',
  txn_type: '',
  iteration_id: '',
  pass_status: '',
  compare_status: '',
  keyword: '',
})

// 产品线变化时同步到 queryParams（实际重新查询在下方 watch 中触发）
// 注意：getList 和 fetchStats 定义在后，watch 回调在它们定义后才会触发
const { isFetching: isLoading, data: rawListData, execute: getList } = useGet<any>(
  ApiPerfBenchmark.report,
  queryParams,
  { immediate: true },
)
const dataList = computed(() => rawListData.value?.list || [])
const total = computed(() => rawListData.value?.total || 0)

// ── 基准报告统计 ──────────────────────────────────
const { data: statsData, isFetching: statsLoading, execute: fetchStats } = useGet<any>(ApiPerfBenchmark.reportStats, queryParams, { immediate: true })

// 产品线变化时同步到 queryParams 并重新查询
watch(productLine, (val) => {
  queryParams.value.product_line = val
  queryParams.value.page_num = 1
  getList()
  fetchStats()
})

function handleSearch() {
  queryParams.value.page_num = 1
  getList()
  fetchStats()
}
function handlePageChange(page: number) {
  queryParams.value.page_num = page
  getList()
}
function handlePageSizeChange(size: number) {
  queryParams.value.page_size = size
  queryParams.value.page_num = 1
  getList()
}

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
  await doManualPass()
  Message.success('已标记为通过')
  getList()
  fetchStats()
}

// ── 工具函数 ──────────────────────────────────
function fmtSec(ms?: number | null): string {
  if (ms === null || ms === undefined) return '-'
  return (ms / 1000).toFixed(2)
}

function fmtPct(v?: number | null): string {
  if (v === null || v === undefined) return '-'
  return v.toFixed(2) + '%'
}

function fmtSuccessRate(errorPct?: number | null): string {
  if (errorPct === null || errorPct === undefined) return '-'
  return (100 - errorPct).toFixed(2) + '%'
}

// ── 补偿重建 ──────────────────────────────────
const rebuilding = ref(false)
const { execute: doRebuild } = usePost<any>(ApiPerfBenchmark.rebuildHistory, {})

// ── 导入历史数据 ──────────────────────────────────
const importHistoryRef = ref<HTMLInputElement | null>(null)
const importingHistory = ref(false)

function handleImportHistoryClick() {
  importHistoryRef.value?.click()
}

function downloadHistoryTemplate() {
  const header = [
    '脚本编码', '迭代名称', '执行时间',
    '事务编码', '事务名称',
    '样本数', '平均响应时间(ms)', 'P90(ms)', 'P95(ms)', 'P99(ms)',
    '错误率(%)', '吞吐量(req/s)', '是否关键事务',
  ]
  const sample = [
    [
      'tda02084', 'V2024Q4', '2024-12-15 14:30:00',
      'am01437-search001', '[A]-(am01437-search001)-销户申请',
      1000, 120.5, 180.0, 220.0, 350.0,
      0.5, 15.3, 'Y',
    ],
    [
      'tda02084', 'V2024Q4', '2024-12-15 14:30:00',
      'am01438-save001', '[A]-(am01438-save001)-保存数据',
      500, 85.2, 120.0, 150.0, 200.0,
      0.0, 10.1, 'Y',
    ],
  ]
  const ws = XLSX.utils.aoa_to_sheet([header, ...sample])
  ws['!cols'] = [
    { wch: 14 }, { wch: 12 }, { wch: 20 },
    { wch: 22 }, { wch: 36 },
    { wch: 8 }, { wch: 16 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
    { wch: 10 }, { wch: 14 }, { wch: 12 },
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '历史数据导入模板')
  XLSX.writeFile(wb, '历史数据导入模板.xlsx')
}

async function handleImportHistoryFile(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  // 校验文件类型
  if (!file.name.match(/\.xlsx$/i)) {
    Message.warning('请上传 .xlsx 文件')
    target.value = ''
    return
  }

  importingHistory.value = true
  try {
    const formData = new FormData()
    formData.append('file', file)

    const { token } = useToken()
    const resp = await fetch(import.meta.env.VITE_API_BASE_URL + ApiPerfBenchmark.importHistory, {
      method: 'POST',
      body: formData,
      headers: { Authorization: token },
    })
    const result = await resp.json()
    if (result.code === 200) {
      const d = result.data || {}
      const rebuildInfo = d.rebuild || {}
      let msg = `导入完成：共 ${d.total_rows || 0} 行，创建 ${d.run_created || 0} 个执行记录，${d.detail_created || 0} 条事务明细`
      if (rebuildInfo.total !== undefined) {
        msg += `\n补偿重建：处理 ${rebuildInfo.total} 个，成功 ${rebuildInfo.success}，失败 ${rebuildInfo.failed}`
      }
      if (d.errors && d.errors.length > 0) {
        msg += `\n警告：${d.errors.join('；')}`
      }
      Message.success({ content: msg, duration: 8000 })
      getList()
      fetchStats()
    } else {
      Message.error(result.msg || '导入失败')
    }
  } catch (err: any) {
    Message.error('导入失败: ' + (err?.message || err))
  } finally {
    importingHistory.value = false
    target.value = ''
  }
}

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
    fetchStats()
  } catch (e: any) {
    Message.error('补偿重建失败: ' + (e?.message || e))
  } finally {
    rebuilding.value = false
  }
}

const allColumns = [
  { key: 'cloud', title: '云', dataIndex: 'cloud', width: 120, ellipsis: true, tooltip: true, fixed: 'left' as const },
  { key: 'app', title: '应用', dataIndex: 'app', width: 120, ellipsis: true, tooltip: true },
  { key: 'domain', title: '领域', dataIndex: 'domain', width: 100, ellipsis: true, tooltip: true },
  { key: 'menu', title: '菜单', dataIndex: 'menu', width: 120, ellipsis: true, tooltip: true },
  { key: 'txn_code', title: '事务编码', dataIndex: 'txn_code', width: 140, ellipsis: true, tooltip: true },
  { key: 'txn_type', title: '事务类型', dataIndex: 'txn_type', width: 100, align: 'center' as const, slotName: 'txn_type' },
  { key: 'txn_name', title: '事务名称', dataIndex: 'txn_name', width: 200, ellipsis: true, tooltip: true },
  { key: 'target_value_ms', title: '目标值', dataIndex: 'target_value_ms', width: 90, align: 'center' as const, slotName: 'target_value' },
  { key: 'baseline_value_ms', title: '比对值', dataIndex: 'baseline_value_ms', width: 90, align: 'center' as const, slotName: 'baseline_value' },
  { key: 'average_ms', title: '最新结果', dataIndex: 'average_ms', width: 100, align: 'center' as const, slotName: 'avg_value' },
  { key: 'iteration_name', title: '最新结果迭代', dataIndex: 'iteration_name', width: 140, ellipsis: true, tooltip: true },
  { key: 'created_at', title: '最新结果时间', dataIndex: 'created_at', width: 160, slotName: 'created_at' },
  { key: 'error_pct', title: '成功率', dataIndex: 'error_pct', width: 100, align: 'center' as const, slotName: 'error_pct' },
  { key: 'pass_status', title: '达标状态', dataIndex: 'pass_status', width: 90, align: 'center' as const, slotName: 'pass_status' },
  { key: 'compare_status', title: '比对状态', dataIndex: 'compare_status', width: 90, align: 'center' as const, slotName: 'compare_status' },
  { key: 'baseline_updated_at', title: '比对值更新时间', dataIndex: 'baseline_updated_at', width: 160, slotName: 'baseline_updated_at' },
  { key: 'baseline_iteration_name', title: '比对值更新迭代', dataIndex: 'baseline_iteration_name', width: 140, ellipsis: true, tooltip: true },
  { title: '操作', key: 'action', width: 150, align: 'center' as const, slotName: 'action', fixed: 'right' as const },
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
    <!-- 搜索栏 + 统计 -->
    <a-card :bordered="false" class="mb-12px">
      <div class="filter-row">
        <div class="filter-item">
          <span class="filter-label">产品线</span>
          <a-select v-model="productLine" :options="productLineOptions" placeholder="选择产品线" allow-search style="width: 130px" />
        </div>
        <div class="filter-item">
          <span class="filter-label">产品领域</span>
          <a-select v-model="queryParams.domain_code" :options="domainOptions" placeholder="全部领域" allow-clear style="width: 130px" />
        </div>
        <div class="filter-item">
          <span class="filter-label">业务领域</span>
          <a-select v-model="queryParams.business_area" :options="bizAreaOptions" placeholder="全部" allow-clear allow-search style="width: 130px" />
        </div>
        <div class="filter-item">
          <span class="filter-label">项目组</span>
          <a-select v-model="queryParams.project_group_name" :options="projectGroupOptions" placeholder="全部" allow-clear allow-search style="width: 130px" />
        </div>
        <div class="filter-item">
          <span class="filter-label">事务类型</span>
          <a-select v-model="queryParams.txn_type" :options="txnTypeOptions" placeholder="全部" allow-clear style="width: 110px" />
        </div>
        <div class="filter-item">
          <span class="filter-label">迭代</span>
          <a-select v-model="queryParams.iteration_id" :options="iterOptions" placeholder="全部" allow-clear allow-search style="width: 130px" />
        </div>
        <div class="filter-item">
          <span class="filter-label">达标状态</span>
          <a-select v-model="queryParams.pass_status" placeholder="全部" allow-clear style="width: 110px">
            <a-option value="pass">达标</a-option>
            <a-option value="fail">不达标</a-option>
            <a-option value="no_target">无目标值</a-option>
          </a-select>
        </div>
        <div class="filter-item">
          <span class="filter-label">比对状态</span>
          <a-select v-model="queryParams.compare_status" placeholder="全部" allow-clear style="width: 110px">
            <a-option value="improved">改善</a-option>
            <a-option value="normal">正常</a-option>
            <a-option value="degraded">腐化</a-option>
            <a-option value="initial">首次</a-option>
            <a-option value="failed">失败</a-option>
          </a-select>
        </div>
        <div class="filter-item">
          <span class="filter-label">事务名称</span>
          <a-input v-model="queryParams.keyword" placeholder="编码/名称" allow-clear style="width: 130px" @press-enter="handleSearch" />
        </div>
        <a-button type="primary" @click="handleSearch">
          <template #icon><icon-search /></template>
          搜索
        </a-button>
      </div>

      <!-- 统计数字 -->
      <div class="stats-row" :class="{ 'stats-loading': statsLoading }">
        <a-spin v-if="statsLoading" class="stats-spin" />
        <template v-if="statsData && !statsLoading">
        <a-statistic title="事务总数" :value="statsData.total || 0" />
        <a-divider direction="vertical" />
        <a-statistic title="达标" :value="statsData.pass_count || 0" :value-style="{ color: '#00b42a' }" />
        <a-divider direction="vertical" />
        <a-statistic title="达标率" :value="statsData.pass_rate || 0" suffix="%" :value-style="{ color: (statsData.pass_rate || 0) >= 80 ? '#00b42a' : '#ff7d00' }" />
        <a-divider direction="vertical" />
        <a-statistic title="无目标值" :value="statsData.no_target_count || 0" :value-style="{ color: '#86909c' }" />
        <a-divider direction="vertical" />
        <a-statistic title="有目标值" :value="statsData.with_target || 0" />
        <a-divider direction="vertical" />
        <a-statistic title="有比对值" :value="statsData.with_baseline || 0" />
        <a-divider direction="vertical" />
        <a-statistic title="改善" :value="statsData.improved_count || 0" :value-style="{ color: '#00b42a' }" />
        <a-divider direction="vertical" />
        <a-statistic title="正常" :value="statsData.normal_count || 0" :value-style="{ color: '#165dff' }" />
        <a-divider direction="vertical" />
        <a-statistic title="腐化" :value="statsData.degraded_count || 0" :value-style="{ color: '#f53f3f' }" />
        <a-divider direction="vertical" />
        <a-statistic title="首次" :value="statsData.initial_count || 0" :value-style="{ color: '#ff7d00' }" />
        <a-divider direction="vertical" />
        <a-statistic title="失败" :value="statsData.failed_count || 0" :value-style="{ color: '#f53f3f' }" />
        </template>
      </div>
    </a-card>

    <!-- 列表 -->
    <a-card :bordered="false">
      <div style="margin-bottom: 12px">
        <a-space>
          <a-button type="primary" status="warning" :loading="rebuilding" @click="handleRebuild">
            补偿重建
          </a-button>
          <a-button type="primary" :loading="importingHistory" @click="handleImportHistoryClick">
            导入历史数据
          </a-button>
          <a-button @click="downloadHistoryTemplate">下载导入模板</a-button>
          <input ref="importHistoryRef" type="file" accept=".xlsx" style="display: none" @change="handleImportHistoryFile" />
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
        column-resizable
        :pagination="{
          total,
          current: queryParams.page_num,
          pageSize: queryParams.page_size,
          showTotal: true,
          showPageSize: true,
          pageSizeOptions: [10, 20, 50, 100],
        }"
        row-key="txn_code"
        :scroll="{ x: 2000 }"
        @page-change="handlePageChange"
        @page-size-change="handlePageSizeChange"
      >
        <template #target_value="{ record }">{{ fmtSec(record.target_value_ms) }}</template>
        <template #baseline_value="{ record }">{{ fmtSec(record.baseline_value_ms) }}</template>
        <template #avg_value="{ record }">{{ fmtSec(record.average_ms) }}</template>
        <template #error_pct="{ record }"><span style="white-space: nowrap">{{ fmtSuccessRate(record.error_pct) }}</span></template>
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
        <template #baseline_updated_at="{ record }">{{ formatTime(record.baseline_updated_at) }}</template>
        <template #created_at="{ record }">{{ formatTime(record.created_at) }}</template>
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

<style scoped>
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
</style>
