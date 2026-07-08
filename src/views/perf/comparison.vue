<script lang="ts" setup>
import { ref, computed } from 'vue'
import { Message } from '@arco-design/web-vue'
import { useGet, usePost } from '@/hooks'
import { ApiPerfComparison, ApiPerfIteration } from '@/api/apis'

defineOptions({ name: 'comparison' })

// ── 迭代列表（下拉用） ──────────────────────────────────
const { data: iterData } = useGet<any>(ApiPerfIteration.getList, { page_num: 1, page_size: 100 }, { immediate: true })
const iterOptions = computed(() => iterData.value?.list?.map((i: any) => ({ label: `${i.name} (${i.code})`, value: i.id })) || [])
const iterMap = computed(() => {
  const m: Record<string, any> = {}
  for (const i of (iterData.value?.list || [])) m[i.id] = i
  return m
})

// ── 比对列表 ──────────────────────────────────
const queryParams = ref({
  page_num: 1,
  page_size: 10,
  domain_code: '',
  cloud: '',
  app: '',
})
const { isFetching: isLoading, data: rawListData, execute: getList } = useGet<any>(ApiPerfComparison.getList, queryParams, { immediate: true })
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

// ── 触发比对弹窗 ──────────────────────────────────
const cmpVisible = ref(false)
const cmpForm = ref({ baseline_iteration_id: '', current_iteration_id: '', domain_code: '' })
const { execute: doCompare, isFetching: cmpLoading } = usePost(ApiPerfComparison.compare, cmpForm)

async function handleCompare() {
  if (!cmpForm.value.baseline_iteration_id) { Message.warning('请选择基线迭代'); return }
  if (!cmpForm.value.current_iteration_id) { Message.warning('请选择当前迭代'); return }
  if (cmpForm.value.baseline_iteration_id === cmpForm.value.current_iteration_id) {
    Message.warning('基线迭代与当前迭代不能相同'); return
  }
  await doCompare()
  Message.success('比对完成')
  cmpVisible.value = false
  getList()
}

function handleCompareClick() {
  cmpForm.value = { baseline_iteration_id: '', current_iteration_id: '', domain_code: '' }
  cmpVisible.value = true
}

// ── 查看详情 ──────────────────────────────────
const detailVisible = ref(false)
const detailData = ref<any>(null)
const txnRows = computed(() => detailData.value?.txn_comparison_json || [])

const { execute: fetchDetail } = useGet<any>(ApiPerfComparison.getById, { id: '' })

async function handleDetail(id: string) {
  detailData.value = await fetchDetail({ id })
  detailVisible.value = true
}

// ── 状态映射 ──────────────────────────────────
const overallStatusMap: Record<string, { color: string; text: string }> = {
  pass: { color: 'green', text: '通过' },
  warn: { color: 'red', text: '有劣化' },
}

const txnStatusMap: Record<string, { color: string; text: string }> = {
  regression: { color: 'red', text: '劣化' },
  improvement: { color: 'green', text: '改善' },
  unchanged: { color: 'gray', text: '持平' },
  new: { color: 'blue', text: '新增' },
  removed: { color: 'orange', text: '移除' },
}

function fmtNum(v?: number | null, digits = 1) {
  if (v === null || v === undefined) return '-'
  return v.toFixed(digits)
}

function fmtPct(v?: number | null) {
  if (v === null || v === undefined) return '-'
  const s = v > 0 ? '+' : ''
  return s + v.toFixed(1) + '%'
}

function fmtTime(time?: string | null) {
  if (!time) return '-'
  return time.replace('T', ' ').substring(0, 19)
}

const columns = [
  { title: '领域', dataIndex: 'domain_code', width: 100 },
  { title: '基线迭代', dataIndex: 'baseline_iteration_id', width: 160, slotName: 'baseline_iter', ellipsis: true, tooltip: true },
  { title: '当前迭代', dataIndex: 'current_iteration_id', width: 160, slotName: 'current_iter', ellipsis: true, tooltip: true },
  { title: '劣化', dataIndex: 'txn_regression_count', width: 70, align: 'center' as const },
  { title: '改善', dataIndex: 'txn_improvement_count', width: 70, align: 'center' as const },
  { title: '持平', dataIndex: 'txn_unchanged_count', width: 70, align: 'center' as const },
  { title: '新增', dataIndex: 'txn_new_count', width: 70, align: 'center' as const },
  { title: '移除', dataIndex: 'txn_removed_count', width: 70, align: 'center' as const },
  { title: '总体状态', dataIndex: 'overall_status', width: 100, align: 'center' as const, slotName: 'overall_status' },
  { title: '创建时间', dataIndex: 'created_at', width: 160, slotName: 'created_at' },
  { title: '操作', key: 'action', width: 80, align: 'center' as const, slotName: 'action' },
]

const txnColumns = [
  { title: '事务编码', dataIndex: 'txn_code', width: 180, ellipsis: true, tooltip: true },
  { title: '事务名称', dataIndex: 'txn_name', width: 200, ellipsis: true, tooltip: true },
  { title: '基线Avg(ms)', dataIndex: 'baseline_avg', width: 110, align: 'right' as const, render: ({ record }: any) => fmtNum(record.baseline_avg) },
  { title: '当前Avg(ms)', dataIndex: 'current_avg', width: 110, align: 'right' as const, render: ({ record }: any) => fmtNum(record.current_avg) },
  { title: 'ΔAvg(ms)', dataIndex: 'delta_avg', width: 90, align: 'right' as const, slotName: 'delta_avg' },
  { title: 'ΔAvg(%)', dataIndex: 'delta_avg_pct', width: 90, align: 'right' as const, slotName: 'delta_avg_pct' },
  { title: '基线P95(ms)', dataIndex: 'baseline_p95', width: 110, align: 'right' as const, render: ({ record }: any) => fmtNum(record.baseline_p95) },
  { title: '当前P95(ms)', dataIndex: 'current_p95', width: 110, align: 'right' as const, render: ({ record }: any) => fmtNum(record.current_p95) },
  { title: 'ΔP95(%)', dataIndex: 'delta_p95_pct', width: 90, align: 'right' as const, slotName: 'delta_p95_pct' },
  { title: '基线错误率(%)', dataIndex: 'baseline_error_pct', width: 120, align: 'right' as const, render: ({ record }: any) => fmtNum(record.baseline_error_pct, 2) },
  { title: '当前错误率(%)', dataIndex: 'current_error_pct', width: 120, align: 'right' as const, render: ({ record }: any) => fmtNum(record.current_error_pct, 2) },
  { title: '状态', key: 'status', width: 80, align: 'center' as const, slotName: 'status' },
]
</script>

<template>
  <div class="page-container">
    <!-- 搜索栏 -->
    <a-card :bordered="false" class="mb-12px">
      <a-row :gutter="12">
        <a-col :span="5">
          <a-input v-model="queryParams.cloud" placeholder="云" allow-clear @press-enter="handleSearch" />
        </a-col>
        <a-col :span="5">
          <a-input v-model="queryParams.app" placeholder="应用" allow-clear @press-enter="handleSearch" />
        </a-col>
        <a-col :span="5">
          <a-input v-model="queryParams.domain_code" placeholder="领域编码" allow-clear @press-enter="handleSearch" />
        </a-col>
        <a-col :span="9">
          <a-space>
            <a-button type="primary" @click="handleSearch">查询</a-button>
            <a-button type="primary" status="success" @click="handleCompareClick">发起比对</a-button>
          </a-space>
        </a-col>
      </a-row>
    </a-card>

    <!-- 列表 -->
    <a-card :bordered="false">
<a-table
  column-resizable
        :columns="columns"
        :data="dataList"
        :loading="isLoading"
        :pagination="{
          total,
          current: queryParams.page_num,
          pageSize: queryParams.page_size,
          showTotal: true,
        }"
        row-key="id"
        @page-change="handlePageChange"
      >
        <template #baseline_iter="{ record }">{{ iterMap[record.baseline_iteration_id]?.name || record.baseline_iteration_id?.substring(0, 8) }}</template>
        <template #current_iter="{ record }">{{ iterMap[record.current_iteration_id]?.name || record.current_iteration_id?.substring(0, 8) }}</template>
        <template #overall_status="{ record }">
          <a-tag :color="(overallStatusMap[record.overall_status]?.color) || 'gray'">
            {{ overallStatusMap[record.overall_status]?.text || record.overall_status || '-' }}
          </a-tag>
        </template>
        <template #created_at="{ record }">{{ fmtTime(record.created_at) }}</template>
        <template #action="{ record }">
          <a-button type="text" size="small" @click="handleDetail(record.id)">详情</a-button>
        </template>
      </a-table>
    </a-card>

    <!-- 发起比对弹窗 -->
    <a-modal v-model:visible="cmpVisible" title="跨迭代比对" @ok="handleCompare" :ok-loading="cmpLoading">
      <a-form :model="cmpForm" layout="vertical">
        <a-form-item label="基线迭代" required>
          <a-select v-model="cmpForm.baseline_iteration_id" :options="iterOptions" placeholder="选择基线迭代（历史版本）" allow-search />
        </a-form-item>
        <a-form-item label="当前迭代" required>
          <a-select v-model="cmpForm.current_iteration_id" :options="iterOptions" placeholder="选择当前迭代（最新版本）" allow-search />
        </a-form-item>
        <a-form-item label="领域编码" required>
          <a-input v-model="cmpForm.domain_code" placeholder="如：fin-bss、fin-treasury 等" />
        </a-form-item>
      </a-form>
      <a-alert type="info" :style="{ marginTop: '8px' }">
        比对将基于两个迭代的汇总数据，按事务编码匹配并计算指标差异。劣化阈值：Avg &gt;20% 或 P95 &gt;30%。
      </a-alert>
    </a-modal>

    <!-- 详情弹窗 -->
    <a-modal v-model:visible="detailVisible" title="比对详情 - 事务级对比" width="1200px" :footer="false">
      <a-descriptions :column="5" bordered size="small" class="mb-12px">
        <a-descriptions-item label="劣化">{{ detailData?.txn_regression_count }}</a-descriptions-item>
        <a-descriptions-item label="改善">{{ detailData?.txn_improvement_count }}</a-descriptions-item>
        <a-descriptions-item label="持平">{{ detailData?.txn_unchanged_count }}</a-descriptions-item>
        <a-descriptions-item label="新增">{{ detailData?.txn_new_count }}</a-descriptions-item>
        <a-descriptions-item label="移除">{{ detailData?.txn_removed_count }}</a-descriptions-item>
      </a-descriptions>
      <a-table column-resizable :columns="txnColumns" :data="txnRows" row-key="txn_code" :pagination="{ pageSize: 15 }" size="small">
        <template #delta_avg="{ record }">
          <span :style="{ color: record.delta_avg > 0 ? 'red' : record.delta_avg < 0 ? 'green' : 'inherit' }">{{ fmtNum(record.delta_avg) }}</span>
        </template>
        <template #delta_avg_pct="{ record }">
          <span :style="{ color: record.delta_avg_pct > 0 ? 'red' : record.delta_avg_pct < 0 ? 'green' : 'inherit' }">{{ fmtPct(record.delta_avg_pct) }}</span>
        </template>
        <template #delta_p95_pct="{ record }">
          <span :style="{ color: record.delta_p95_pct > 0 ? 'red' : record.delta_p95_pct < 0 ? 'green' : 'inherit' }">{{ fmtPct(record.delta_p95_pct) }}</span>
        </template>
        <template #status="{ record }">
          <a-tag :color="(txnStatusMap[record.status]?.color) || 'gray'">{{ txnStatusMap[record.status]?.text || record.status }}</a-tag>
        </template>
      </a-table>
    </a-modal>
  </div>
</template>
