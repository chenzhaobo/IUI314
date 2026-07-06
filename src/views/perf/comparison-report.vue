<script lang="ts" setup>
import { ref, computed } from 'vue'
import { Message, Modal } from '@arco-design/web-vue'
import { useRouter } from 'vue-router'
import { useGet, usePost, usePut, useDelete } from '@/hooks'
import { ApiPerfComparison, ApiPerfIteration, ApiPerfScript, ApiSysDictData } from '@/api/apis'
import TxnTrendChart from './components/TxnTrendChart.vue'

defineOptions({ name: 'comparison-report' })

const router = useRouter()

// ── 迭代列表 ──────────────────────────────────
const { data: iterData } = useGet<any>(ApiPerfIteration.getList, { page_num: 1, page_size: 100 }, { immediate: true })
const iterOptions = computed(() => iterData.value?.list?.map((i: any) => ({ label: i.name, value: i.id })) || [])

// ── 产品线字典 ──────────────────────────────────
const { data: domainDictRaw } = useGet<any>(ApiSysDictData.getByType, { dict_type: 'sec_pg_product_domain' }, { immediate: true })
const domainOptions = computed(() => (Array.isArray(domainDictRaw.value) ? domainDictRaw.value : []).map((d: any) => ({ label: d.dict_label, value: d.dict_value })))

// ── 业务领域：从脚本表获取 ──────────────────────────────────
const { data: bizDomainRaw } = useGet<any>(ApiPerfScript.domainList, {}, { immediate: true })
const bizDomainOptions = computed(() => {
  const list = Array.isArray(bizDomainRaw.value) ? bizDomainRaw.value : (bizDomainRaw.value?.list || [])
  return list.map((d: any) => ({ label: d, value: d }))
})

// ── 生成比对报告 ──────────────────────────────────
const compareForm = ref({
  baseline_iteration_id: '',
  current_iteration_id: '',
  domain_code: '',
  business_domain: '',
})

const comparing = ref(false)
const { execute: doCompare, data: compareData } = usePost<any>(ApiPerfComparison.compare, compareForm)

const currentComparison = ref<any>(null)
const detailList = ref<any[]>([])

async function handleCompare() {
  if (!compareForm.value.baseline_iteration_id || !compareForm.value.current_iteration_id) {
    Message.warning('请选择基线迭代和当前迭代')
    return
  }
  if (compareForm.value.baseline_iteration_id === compareForm.value.current_iteration_id) {
    Message.warning('基线迭代和当前迭代不能相同')
    return
  }
  comparing.value = true
  try {
    await doCompare()
    const data = compareData.value
    if (data) {
      currentComparison.value = data
      // 加载明细
      if (data.comparison_id) {
        await loadDetails(data.comparison_id)
      }
      Message.success(`比对完成：共 ${data.txn_rows?.length || 0} 个事务`)
      // 刷新历史列表
      historyParams.value.page_num = 1
      await getHistory()
    } else {
      Message.warning('比对结果为空')
    }
  } catch (e: any) {
    Message.error('比对失败: ' + (e?.message || e))
  } finally {
    comparing.value = false
  }
}

// ── 比对明细 ──────────────────────────────────
const loadingDetails = ref(false)
const { execute: fetchDetails, data: detailsData } = useGet<any>(ApiPerfComparison.details, { id: '' })

async function loadDetails(comparisonId: string) {
  loadingDetails.value = true
  try {
    await fetchDetails({ id: comparisonId })
    detailList.value = detailsData.value || []
  } catch {
    detailList.value = []
  } finally {
    loadingDetails.value = false
  }
}

// ── 摘要统计 ──────────────────────────────────
const summary = computed(() => {
  const list = detailList.value
  return {
    total: list.length,
    regression: list.filter(d => d.status === 'regression').length,
    improvement: list.filter(d => d.status === 'improvement').length,
    unchanged: list.filter(d => d.status === 'unchanged').length,
    newTxn: list.filter(d => d.status === 'new').length,
    removed: list.filter(d => d.status === 'removed').length,
    pending: list.filter(d => !d.analysis_status || d.analysis_status === 'pending').length,
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
    await doUpdateAnalysis(analysisForm.value)
    Message.success('分析状态已更新')
    analysisModalVisible.value = false
    if (currentComparison.value?.comparison_id) {
      await loadDetails(currentComparison.value.comparison_id)
    }
  } catch (e: any) {
    Message.error('更新失败: ' + (e?.message || e))
  }
}

// ── 重跑脚本 ──────────────────────────────────
function handleRerun(record: any) {
  if (record.script_id) {
    router.push({ path: '/perf/task-group/task', query: { script_id: record.script_id } })
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

// ── 历史比对记录 ──────────────────────────────────
const historyParams = ref({ page_num: 1, page_size: 10 })
const { isFetching: historyLoading, data: historyRaw, execute: getHistory } = useGet<any>(
  ApiPerfComparison.getList,
  historyParams,
  { immediate: true },
)
const historyList = computed(() => historyRaw.value?.list || [])
const historyTotal = computed(() => historyRaw.value?.total || 0)

function handleHistoryPageChange(page: number) {
  historyParams.value.page_num = page
  getHistory()
}

// ── 删除比对记录 ──────────────────────────────
function handleDeleteComparison(record: any) {
  Modal.warning({
    title: '确认删除',
    content: `确定删除该比对记录吗？（基线: ${record.baseline_iteration_name || '-'} → 当前: ${record.current_iteration_name || '-'}）`,
    okText: '删除',
    cancelText: '取消',
    onOk: async () => {
      const { execute, error } = useDelete<any>(ApiPerfComparison.delete, { ids: [record.id] })
      await execute()
      if (error.value) {
        Message.error('删除失败')
        return
      }
      Message.success('删除成功')
      // 如果当前展开的就是被删除的记录，收起展开
      if (expandedComparisonId.value === record.id) {
        expandedComparisonId.value = ''
        detailList.value = []
      }
      await getHistory()
    },
  })
}

// ── 查看历史比对明细 ──────────────────────────────────
const expandedComparisonId = ref('')

async function toggleHistoryDetails(comparisonId: string) {
  if (expandedComparisonId.value === comparisonId) {
    expandedComparisonId.value = ''
    return
  }
  expandedComparisonId.value = comparisonId
  currentComparison.value = { comparison_id: comparisonId }
  await loadDetails(comparisonId)
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

function fmtTime(time?: string | null): string {
  if (!time) return '-'
  return time.replace('T', ' ').substring(0, 19)
}

const detailColumns = [
  { title: '事务编码', dataIndex: 'txn_code', width: 140, ellipsis: true, tooltip: true, fixed: 'left' as const },
  { title: '事务名称', dataIndex: 'txn_name', width: 200, ellipsis: true, tooltip: true },
  { title: '脚本名称', dataIndex: 'script_name', width: 150, ellipsis: true, tooltip: true },
  { title: '基线Avg(秒)', dataIndex: 'baseline_avg', width: 100, align: 'center' as const, slotName: 'baseline_avg' },
  { title: '当前Avg(秒)', dataIndex: 'current_avg', width: 100, align: 'center' as const, slotName: 'current_avg' },
  { title: 'Avg变化(%)', dataIndex: 'delta_avg_pct', width: 100, align: 'center' as const, slotName: 'delta_avg_pct' },
  { title: '基线P95(秒)', dataIndex: 'baseline_p95', width: 100, align: 'center' as const, slotName: 'baseline_p95' },
  { title: '当前P95(秒)', dataIndex: 'current_p95', width: 100, align: 'center' as const, slotName: 'current_p95' },
  { title: 'P95变化(%)', dataIndex: 'delta_p95_pct', width: 100, align: 'center' as const, slotName: 'delta_p95_pct' },
  { title: '比对状态', dataIndex: 'status', width: 90, align: 'center' as const, slotName: 'status' },
  { title: '分析状态', dataIndex: 'analysis_status', width: 90, align: 'center' as const, slotName: 'analysis_status' },
  { title: '分析备注', dataIndex: 'analysis_remark', width: 150, ellipsis: true, tooltip: true },
  { title: '操作', key: 'action', width: 180, align: 'center' as const, slotName: 'action', fixed: 'right' as const },
]

const historyColumns = [
  { title: '业务领域', dataIndex: 'business_domain', width: 120, ellipsis: true, tooltip: true },
  { title: '基线迭代', dataIndex: 'baseline_iteration_name', width: 140, ellipsis: true, tooltip: true },
  { title: '当前迭代', dataIndex: 'current_iteration_name', width: 140, ellipsis: true, tooltip: true },
  { title: '劣化数', dataIndex: 'regression_count', width: 80, align: 'center' as const },
  { title: '改善数', dataIndex: 'improvement_count', width: 80, align: 'center' as const },
  { title: '创建时间', dataIndex: 'created_at', width: 160, slotName: 'created_at' },
  { title: '操作', key: 'action', width: 160, align: 'center' as const, slotName: 'history_action' },
]
</script>

<template>
  <div class="page-container">
    <!-- 生成比对报告 -->
    <a-card :bordered="false" class="mb-12px" title="生成比对报告">
      <a-row :gutter="12">
        <a-col :span="5">
          <a-select v-model="compareForm.baseline_iteration_id" :options="iterOptions" placeholder="选择基线迭代" allow-search allow-clear />
        </a-col>
        <a-col :span="5">
          <a-select v-model="compareForm.current_iteration_id" :options="iterOptions" placeholder="选择当前迭代" allow-search allow-clear />
        </a-col>
        <a-col :span="4">
          <a-select v-model="compareForm.domain_code" :options="domainOptions" placeholder="产品线（可选）" allow-search allow-clear />
        </a-col>
        <a-col :span="4">
          <a-select v-model="compareForm.business_domain" :options="bizDomainOptions" placeholder="业务领域（可选）" allow-search allow-clear />
        </a-col>
        <a-col :span="6">
          <a-button type="primary" :loading="comparing" @click="handleCompare">生成比对报告</a-button>
        </a-col>
      </a-row>
    </a-card>

    <!-- 比对结果摘要 -->
    <a-card v-if="detailList.length > 0" :bordered="false" class="mb-12px">
      <a-row :gutter="12">
        <a-col :span="4"><a-statistic title="总事务数" :value="summary.total" /></a-col>
        <a-col :span="4"><a-statistic title="劣化" :value="summary.regression" :value-style="{ color: '#f53f3f' }" /></a-col>
        <a-col :span="4"><a-statistic title="改善" :value="summary.improvement" :value-style="{ color: '#00b42a' }" /></a-col>
        <a-col :span="4"><a-statistic title="新增" :value="summary.newTxn" :value-style="{ color: '#ff7d00' }" /></a-col>
        <a-col :span="4"><a-statistic title="待分析" :value="summary.pending" :value-style="{ color: '#86909c' }" /></a-col>
        <a-col :span="4"><a-statistic title="移除" :value="summary.removed" :value-style="{ color: '#86909c' }" /></a-col>
      </a-row>
    </a-card>

    <!-- 比对明细表格 -->
    <a-card v-if="detailList.length > 0" :bordered="false" class="mb-12px" title="比对明细">
      <a-table
        :columns="detailColumns"
        :data="detailList"
        :loading="loadingDetails"
        :pagination="false"
        row-key="id"
        :scroll="{ x: 1700 }"
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
    </a-card>

    <!-- 历史比对记录 -->
    <a-card :bordered="false" title="历史比对记录">
      <a-table
        :columns="historyColumns"
        :data="historyList"
        :loading="historyLoading"
        :pagination="{
          total: historyTotal,
          current: historyParams.page_num,
          pageSize: historyParams.page_size,
          showTotal: true,
        }"
        row-key="id"
        @page-change="handleHistoryPageChange"
      >
        <template #created_at="{ record }">{{ fmtTime(record.created_at) }}</template>
        <template #history_action="{ record }">
          <a-space>
            <a-button type="text" size="small" @click="toggleHistoryDetails(record.id)">
              {{ expandedComparisonId === record.id ? '收起' : '查看明细' }}
            </a-button>
            <a-button type="text" size="small" status="danger" @click="handleDeleteComparison(record)">删除</a-button>
          </a-space>
        </template>
      </a-table>

      <!-- 展开的历史明细 -->
      <div v-if="expandedComparisonId" style="margin-top: 16px">
        <a-divider />
        <h4>比对明细</h4>
        <a-table
          :columns="detailColumns"
          :data="detailList"
          :loading="loadingDetails"
          :pagination="false"
          row-key="id"
          :scroll="{ x: 1700 }"
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
