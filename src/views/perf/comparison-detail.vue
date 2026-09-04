<script lang="ts" setup>
import { ref, computed } from 'vue'
import { Message } from '@arco-design/web-vue'
import { useRouter, useRoute } from 'vue-router'
import { useGet, usePut, useTableAutoHeight, withTableDefaults } from '@/hooks'
import { ApiPerfComparison } from '@/api/apis'
import TxnTrendChart from './components/TxnTrendChart.vue'

defineOptions({ name: 'comparison-detail' })

const router = useRouter()
const route = useRoute()

const comparisonId = computed(() => ((route.query.id as string) || '').trim())

// ── 比对主记录 ──────────────────────────────────
const mainQuery = ref({ id: '' })
const { data: mainData, execute: fetchMain } = useGet<any>(ApiPerfComparison.getById, mainQuery)
const mainRecord = computed(() => mainData.value || {})

// ── 比对明细（服务端分页+过滤） ──────────────────────────────────
const loadingDetails = ref(false)
const detailList = ref<any[]>([])
const detailTotal = ref(0)
const detailQuery = ref({
  id: '',
  page_num: 1,
  page_size: 20,
  status: '',
  analysis_status: '',
  keyword: '',
})

const { execute: fetchDetails, data: detailsData } = useGet<any>(ApiPerfComparison.details, detailQuery)

async function loadDetails() {
  if (!comparisonId.value) return
  loadingDetails.value = true
  try {
    detailQuery.value.id = comparisonId.value
    await fetchDetails()
    detailList.value = detailsData.value?.list || []
    detailTotal.value = detailsData.value?.total || 0
  } catch {
    detailList.value = []
    detailTotal.value = 0
  } finally {
    loadingDetails.value = false
  }
}

function handlePageChange(page: number) {
  detailQuery.value.page_num = page
  loadDetails()
}

function handlePageSizeChange(size: number) {
  detailQuery.value.page_size = size
  detailQuery.value.page_num = 1
  loadDetails()
}

function handleSearch() {
  detailQuery.value.page_num = 1
  loadDetails()
}

function handleResetFilter() {
  detailQuery.value.status = ''
  detailQuery.value.analysis_status = ''
  detailQuery.value.keyword = ''
  detailQuery.value.page_num = 1
  loadDetails()
}

async function loadData() {
  if (!comparisonId.value) {
    Message.warning('缺少比对记录ID')
    return
  }
  mainQuery.value.id = comparisonId.value
  await fetchMain()
  await loadDetails()
}

loadData()

// ── 摘要统计（从主记录字段获取，不依赖分页数据） ──────────────────────────────────
const summary = computed(() => {
  const r = mainRecord.value
  return {
    total: (r.txn_regression_count || 0) + (r.txn_improvement_count || 0) + (r.txn_unchanged_count || 0) + (r.txn_new_count || 0) + (r.txn_removed_count || 0),
    regression: r.txn_regression_count || 0,
    improvement: r.txn_improvement_count || 0,
    unchanged: r.txn_unchanged_count || 0,
    newTxn: r.txn_new_count || 0,
    removed: r.txn_removed_count || 0,
  }
})

// ── 分析状态 ──────────────────────────────────
const analysisStatusMap: Record<string, { color: string; text: string }> = {
  pending: { color: 'gray', text: '待分析' },
  script_error: { color: 'orange', text: '脚本错误' },
  has_bug: { color: 'red', text: '确认有bug' },
  bug_fixing: { color: 'blue', text: '修复中' },
  resolved: { color: 'green', text: '已解决' },
  ignored: { color: 'gray', text: '忽略' },
}

const compareStatusMap: Record<string, { color: string; text: string }> = {
  regression: { color: 'red', text: '劣化' },
  improvement: { color: 'green', text: '改善' },
  unchanged: { color: 'blue', text: '持平' },
  new: { color: 'orange', text: '新增' },
  removed: { color: 'gray', text: '移除' },
}

// ── 标记分析状态 ──────────────────────────────────
const analysisModalVisible = ref(false)
const analysisForm = ref({ detail_id: '', analysis_status: 'pending', analysis_remark: '' })
const { execute: doUpdateAnalysis } = usePut<any>(ApiPerfComparison.updateAnalysis, analysisForm)

function openAnalysisModal(record: any) {
  analysisForm.value = {
    detail_id: record.id,
    analysis_status: record.analysis_status || 'pending',
    analysis_remark: record.analysis_remark || '',
  }
  analysisModalVisible.value = true
}

async function handleUpdateAnalysis() {
  try {
    await doUpdateAnalysis()
    Message.success('分析状态已更新')
    analysisModalVisible.value = false
    await loadDetails()
  } catch (e: any) {
    Message.error('更新失败: ' + (e?.message || e))
  }
}

// ── 重跑脚本 ──────────────────────────────────
function handleRerun(record: any) {
  if (record.script_id) {
    router.push({ path: '/perf/run-group/task', query: { script_id: record.script_id } })
  } else {
    Message.warning('未找到关联脚本')
  }
}

// ── 趋势图 ──────────────────────────────────
const trendVisible = ref(false)
const trendTxnCode = ref('')
const trendTxnName = ref('')

function handleViewTrend(record: any) {
  trendTxnCode.value = record.txn_code || ''
  trendTxnName.value = record.txn_name || ''
  trendVisible.value = true
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

const detailColumns = withTableDefaults([
  { title: '事务编码', dataIndex: 'txn_code', width: 140, fixed: 'left' as const },
  { title: '事务名称', dataIndex: 'txn_name', width: 200 },
  { title: '脚本名称', dataIndex: 'script_name', width: 150 },
  { title: '基线Avg(秒)', dataIndex: 'baseline_avg', width: 100, align: 'center' as const, slotName: 'baseline_avg' },
  { title: '当前Avg(秒)', dataIndex: 'current_avg', width: 100, align: 'center' as const, slotName: 'current_avg' },
  { title: 'Avg变化(%)', dataIndex: 'delta_avg_pct', width: 100, align: 'center' as const, slotName: 'delta_avg_pct' },
  { title: '基线P95(秒)', dataIndex: 'baseline_p95', width: 100, align: 'center' as const, slotName: 'baseline_p95' },
  { title: '当前P95(秒)', dataIndex: 'current_p95', width: 100, align: 'center' as const, slotName: 'current_p95' },
  { title: 'P95变化(%)', dataIndex: 'delta_p95_pct', width: 100, align: 'center' as const, slotName: 'delta_p95_pct' },
  { title: '比对状态', dataIndex: 'status', width: 90, align: 'center' as const, slotName: 'status' },
  { title: '分析状态', dataIndex: 'analysis_status', width: 90, align: 'center' as const, slotName: 'analysis_status' },
  { title: '分析备注', dataIndex: 'analysis_remark', width: 150 },
  { title: '操作', key: 'action', width: 180, align: 'center' as const, slotName: 'action', fixed: 'right' as const },
])

// 表格高度自适应（滚动条在表格内、表头固定）
const tableWrap = ref<HTMLElement>()
const { tableHeight } = useTableAutoHeight(tableWrap)
</script>

<template>
  <div class="page-container">
    <!-- 返回 + 标题 -->
    <a-card :bordered="false" class="mb-12px">
      <a-space>
        <a-button @click="router.back()">返回</a-button>
        <span style="font-size: 16px; font-weight: 600">比对详情</span>
      </a-space>
    </a-card>

    <!-- 维度信息摘要 -->
    <a-card :bordered="false" class="mb-12px" title="维度信息">
      <a-descriptions :column="4" bordered size="small">
        <a-descriptions-item label="产品领域">{{ mainRecord.domain_code || '-' }}</a-descriptions-item>
        <a-descriptions-item label="业务领域">{{ mainRecord.business_domain || '-' }}</a-descriptions-item>
        <a-descriptions-item label="云">{{ mainRecord.cloud || '-' }}</a-descriptions-item>
        <a-descriptions-item label="应用">{{ mainRecord.app_code || '-' }}</a-descriptions-item>
      </a-descriptions>
    </a-card>

    <!-- 比对统计 -->
    <a-card :bordered="false" class="mb-12px">
      <a-row :gutter="12">
        <a-col :span="4"><a-statistic title="总事务数" :value="summary.total" /></a-col>
        <a-col :span="4"><a-statistic title="劣化" :value="summary.regression" :value-style="{ color: '#f53f3f' }" /></a-col>
        <a-col :span="4"><a-statistic title="改善" :value="summary.improvement" :value-style="{ color: '#00b42a' }" /></a-col>
        <a-col :span="4"><a-statistic title="新增" :value="summary.newTxn" :value-style="{ color: '#ff7d00' }" /></a-col>
        <a-col :span="4"><a-statistic title="持平" :value="summary.unchanged" :value-style="{ color: '#165dff' }" /></a-col>
        <a-col :span="4"><a-statistic title="移除" :value="summary.removed" :value-style="{ color: '#86909c' }" /></a-col>
      </a-row>
    </a-card>

    <!-- 比对明细表格 -->
    <a-card :bordered="false" title="比对明细">
      <!-- 过滤条件 -->
      <a-form layout="inline" class="mb-12px" :model="detailQuery">
        <a-form-item label="比对状态">
          <a-select v-model="detailQuery.status" placeholder="全部" allow-clear style="width: 120px">
            <a-option value="regression">劣化</a-option>
            <a-option value="improvement">改善</a-option>
            <a-option value="unchanged">持平</a-option>
            <a-option value="new">新增</a-option>
            <a-option value="removed">移除</a-option>
          </a-select>
        </a-form-item>
        <a-form-item label="分析状态">
          <a-select v-model="detailQuery.analysis_status" placeholder="全部" allow-clear style="width: 120px">
            <a-option value="pending">待分析</a-option>
            <a-option value="script_error">脚本错误</a-option>
            <a-option value="has_bug">确认有bug</a-option>
            <a-option value="bug_fixing">修复中</a-option>
            <a-option value="resolved">已解决</a-option>
            <a-option value="ignored">忽略</a-option>
          </a-select>
        </a-form-item>
        <a-form-item label="关键词">
          <a-input v-model="detailQuery.keyword" placeholder="事务编码/名称" allow-clear style="width: 200px" @press-enter="handleSearch" />
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" @click="handleSearch">查询</a-button>
            <a-button @click="handleResetFilter">重置</a-button>
          </a-space>
        </a-form-item>
      </a-form>

      <div ref="tableWrap">
<a-table
  column-resizable
        :columns="detailColumns"
        :data="detailList"
        :loading="loadingDetails"
        :pagination="{
          total: detailTotal,
          current: detailQuery.page_num,
          pageSize: detailQuery.page_size,
          showTotal: true,
          showPageSize: true,
        }"
        row-key="id"
        :scroll="{ minWidth: 1700, y: tableHeight }"
        @page-change="handlePageChange"
        @page-size-change="handlePageSizeChange"
      >
        <template #baseline_avg="{ record }">{{ fmtSec(record.baseline_avg) }}</template>
        <template #current_avg="{ record }">{{ fmtSec(record.current_avg) }}</template>
        <template #delta_avg_pct="{ record }">
          <span :style="{ color: record.delta_avg_pct > 20 ? '#f53f3f' : record.delta_avg_pct < -10 ? '#00b42a' : '' }">
            {{ fmtPct(record.delta_avg_pct) }}
          </span>
        </template>
        <template #baseline_p95="{ record }">{{ fmtSec(record.baseline_p95) }}</template>
        <template #current_p95="{ record }">{{ fmtSec(record.current_p95) }}</template>
        <template #delta_p95_pct="{ record }">
          <span :style="{ color: record.delta_p95_pct > 30 ? '#f53f3f' : record.delta_p95_pct < -10 ? '#00b42a' : '' }">
            {{ fmtPct(record.delta_p95_pct) }}
          </span>
        </template>
        <template #status="{ record }">
          <a-tag :color="(compareStatusMap[record.status]?.color) || 'gray'">
            {{ compareStatusMap[record.status]?.text || record.status || '-' }}
          </a-tag>
        </template>
        <template #analysis_status="{ record }">
          <a-tag :color="(analysisStatusMap[record.analysis_status]?.color) || 'gray'">
            {{ analysisStatusMap[record.analysis_status]?.text || '待分析' }}
          </a-tag>
        </template>
        <template #action="{ record }">
          <a-space>
            <a-button type="text" size="small" @click="openAnalysisModal(record)">标记状态</a-button>
            <a-button type="text" size="small" @click="handleRerun(record)" :disabled="!record.script_id">重跑</a-button>
            <a-button type="text" size="small" @click="handleViewTrend(record)">趋势</a-button>
          </a-space>
        </template>
      </a-table>
      </div>
    </a-card>

    <!-- 分析状态弹窗 -->
    <a-modal v-model:visible="analysisModalVisible" title="标记分析状态" @ok="handleUpdateAnalysis" @cancel="analysisModalVisible = false">
      <a-form :model="analysisForm" layout="vertical">
        <a-form-item label="分析状态">
          <a-select v-model="analysisForm.analysis_status">
            <a-option value="pending">待分析</a-option>
            <a-option value="script_error">脚本错误</a-option>
            <a-option value="has_bug">确认有bug</a-option>
            <a-option value="bug_fixing">修复中</a-option>
            <a-option value="resolved">已解决</a-option>
            <a-option value="ignored">忽略</a-option>
          </a-select>
        </a-form-item>
        <a-form-item label="分析备注">
          <a-textarea v-model="analysisForm.analysis_remark" placeholder="填写分析备注" :auto-size="{ minRows: 3 }" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 趋势图弹窗 -->
    <TxnTrendChart
      v-model:visible="trendVisible"
      :txn-code="trendTxnCode"
      :txn-name="trendTxnName"
    />
  </div>
</template>
