<script lang="ts" setup>
import { ref, computed } from 'vue'
import { Message } from '@arco-design/web-vue'
import { useGet, usePut, usePost } from '@/hooks'
import { ApiPerfBenchmark, ApiPerfIteration } from '@/api/apis'
import TxnTrendChart from './components/TxnTrendChart.vue'

defineOptions({ name: 'benchmark-report' })

// ── 迭代列表（下拉用） ──────────────────────────────────
const { data: iterData } = useGet<any>(ApiPerfIteration.getList, { page_num: 1, page_size: 100 }, { immediate: true })
const iterOptions = computed(() => iterData.value?.list?.map((i: any) => ({ label: i.name, value: i.id })) || [])

// ── 基准报告列表 ──────────────────────────────────
const queryParams = ref({
  page_num: 1,
  page_size: 20,
  cloud: '',
  app: '',
  domain: '',
  menu: '',
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

const columns = [
  { title: '云', dataIndex: 'cloud', width: 90, ellipsis: true, tooltip: true, fixed: 'left' as const },
  { title: '应用', dataIndex: 'app', width: 90, ellipsis: true, tooltip: true },
  { title: '领域', dataIndex: 'domain', width: 90, ellipsis: true, tooltip: true },
  { title: '菜单', dataIndex: 'menu', width: 100, ellipsis: true, tooltip: true },
  { title: '事务编码', dataIndex: 'txn_code', width: 140, ellipsis: true, tooltip: true },
  { title: '事务名称', dataIndex: 'txn_name', width: 200, ellipsis: true, tooltip: true },
  { title: '目标值(秒)', dataIndex: 'target_value_ms', width: 90, align: 'center' as const, slotName: 'target_value' },
  { title: '比对值(秒)', dataIndex: 'baseline_value_ms', width: 90, align: 'center' as const, slotName: 'baseline_value' },
  { title: '最新结果(秒)', dataIndex: 'average_ms', width: 100, align: 'center' as const, slotName: 'avg_value' },
  { title: '最新结果迭代', dataIndex: 'iteration_name', width: 140, ellipsis: true, tooltip: true },
  { title: '最新结果时间', dataIndex: 'created_at', width: 160, slotName: 'created_at' },
  { title: '错误率', dataIndex: 'error_pct', width: 80, align: 'center' as const, slotName: 'error_pct' },
  { title: '达标状态', dataIndex: 'pass_status', width: 90, align: 'center' as const, slotName: 'pass_status' },
  { title: '比对状态', dataIndex: 'compare_status', width: 90, align: 'center' as const, slotName: 'compare_status' },
  { title: '比对值更新时间', dataIndex: 'baseline_updated_at', width: 160, slotName: 'baseline_updated_at' },
  { title: '比对值更新迭代', dataIndex: 'baseline_iteration_name', width: 140, ellipsis: true, tooltip: true },
  { title: '操作', key: 'action', width: 150, align: 'center' as const, slotName: 'action', fixed: 'right' as const },
]
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
        </a-space>
      </div>
      <a-table
        :columns="columns"
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
