<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { Message } from '@arco-design/web-vue'
import { useGet } from '@/hooks'
import { ApiPerfReport, ApiPerfScript, ApiPerfIteration } from '@/api/apis'

defineOptions({ name: 'PerfReport' })
const route = useRoute()

// ── 页签控制 ──────────────────────────────────
const activeTab = ref('list')

// ── 报告列表 ──────────────────────────────────
const queryParams = ref({ page_num: 1, page_size: 10, script_id: '', iteration_id: '' })
const { isFetching: isLoading, data: rawListData, execute: getList } = useGet<any>(ApiPerfReport.list, queryParams, { immediate: true })
const dataList = computed(() => rawListData.value?.list || [])
const total = computed(() => rawListData.value?.total || 0)

function handleSearch() { queryParams.value.page_num = 1; getList() }
function handlePageChange(page: number) { queryParams.value.page_num = page; getList() }

// 脚本筛选下拉
const { data: scriptData } = useGet<any>(ApiPerfScript.getList, { page_num: 1, page_size: 100 }, { immediate: true })
const scriptOptions = computed(() => (scriptData.value?.list || []).map((s: any) => ({ label: s.name, value: s.id })))

// 迭代筛选下拉
const { data: iterData } = useGet<any>(ApiPerfIteration.getList, { page_num: 1, page_size: 100, status: '1' }, { immediate: true })
const iterOptions = computed(() => (iterData.value?.list || []).map((i: any) => ({ label: i.name, value: i.id })))

const columns = [
  { title: '脚本名称', dataIndex: 'script_name', width: 200, ellipsis: true, tooltip: true, fixed: 'left' as const },
  { title: '触发方式', dataIndex: 'trigger_type', width: 80 },
  { title: '样本数', dataIndex: 'summary_json.sample_count', width: 80, slotName: 'sample_count' },
  { title: '平均(ms)', dataIndex: 'summary_json.average_ms', width: 90, slotName: 'avg_ms' },
  { title: 'P90(ms)', dataIndex: 'summary_json.pct90_ms', width: 90, slotName: 'p90_ms' },
  { title: 'P95(ms)', dataIndex: 'summary_json.pct95_ms', width: 90, slotName: 'p95_ms' },
  { title: 'P99(ms)', dataIndex: 'summary_json.pct99_ms', width: 90, slotName: 'p99_ms' },
  { title: '错误率', dataIndex: 'summary_json.error_pct', width: 80, slotName: 'error_pct' },
  { title: '吞吐量(req/s)', dataIndex: 'summary_json.throughput', width: 110, slotName: 'throughput' },
  { title: '开始时间', dataIndex: 'started_at', width: 160, slotName: 'started_at' },
  { title: '耗时(秒)', dataIndex: 'duration_ms', width: 90, slotName: 'duration' },
  { title: '操作', dataIndex: 'operations', slotName: 'operations', width: 120, fixed: 'right' as const },
]

// ── 聚合报告明细（页签展示） ──────────────────────────────────
const detailLoading = ref(false)
const detailList = ref<any[]>([])
const detailScriptName = ref('')

const detailColumns = [
  { title: 'Label', dataIndex: 'label', width: 250, ellipsis: true, tooltip: true, fixed: 'left' as const },
  { title: '# Samples', dataIndex: 'sample_count', width: 90 },
  { title: 'Average(ms)', dataIndex: 'average_ms', width: 100, slotName: 'd_avg' },
  { title: 'Median(ms)', dataIndex: 'median_ms', width: 100, slotName: 'd_median' },
  { title: '90% Line', dataIndex: 'pct90_ms', width: 90, slotName: 'd_p90' },
  { title: '95% Line', dataIndex: 'pct95_ms', width: 90, slotName: 'd_p95' },
  { title: '99% Line', dataIndex: 'pct99_ms', width: 90, slotName: 'd_p99' },
  { title: 'Min(ms)', dataIndex: 'min_ms', width: 80 },
  { title: 'Max(ms)', dataIndex: 'max_ms', width: 80 },
  { title: 'Error%', dataIndex: 'error_pct', width: 80, slotName: 'd_err' },
  { title: 'Throughput', dataIndex: 'throughput', width: 100, slotName: 'd_thr' },
  { title: 'Received KB/s', dataIndex: 'received_kbps', width: 110, slotName: 'd_rcv' },
  { title: 'Sent KB/s', dataIndex: 'sent_kbps', width: 100, slotName: 'd_snt' },
]

async function handleViewDetail(record: any) {
  detailScriptName.value = record.script_name || ''
  activeTab.value = 'detail'
  detailLoading.value = true
  detailList.value = []

  const { data, error, execute } = useGet<any>(ApiPerfReport.detail, { run_id: record.id }, { immediate: false })
  await execute()
  if (error.value) {
    Message.error('获取明细失败')
  } else {
    detailList.value = data.value || []
  }
  detailLoading.value = false
}

// ── 从 URL 参数自动打开明细（从执行页跳转） ──────────────────────────────────
onMounted(async () => {
  const rid = route.query.run_id as string
  if (rid) {
    setTimeout(() => {
      const record = dataList.value.find((r: any) => r.id.trim() === rid.trim())
      if (record) {
        handleViewDetail(record)
      } else {
        handleViewDetail({ id: rid, script_name: '从执行页跳转' })
      }
    }, 500)
  }
})

function formatTime(time?: string | null) {
  if (!time) return '-'
  return time.replace('T', ' ').substring(0, 19)
}

function fmt(n: number | undefined | null, digits = 2): string {
  if (n === undefined || n === null) return '-'
  return Number(n).toFixed(digits)
}
</script>

<template>
  <div class="perf-report">
    <a-tabs v-model:active-key="activeTab">
      <!-- 报告列表 -->
      <a-tab-pane key="list" title="报告列表">
        <!-- 查询栏 -->
        <a-card :bordered="false" class="m-b-8px">
          <a-row :gutter="16">
            <a-col :span="6">
              <a-select v-model="queryParams.script_id" :options="scriptOptions" placeholder="按脚本筛选" allow-clear @change="handleSearch" />
            </a-col>
            <a-col :span="6">
              <a-select v-model="queryParams.iteration_id" :options="iterOptions" placeholder="按迭代筛选" allow-clear @change="handleSearch" />
            </a-col>
            <a-col :span="4">
              <a-button type="primary" @click="handleSearch">搜索</a-button>
            </a-col>
          </a-row>
        </a-card>

        <!-- 报告列表 -->
        <a-card :bordered="false" title="压测报告列表">
          <a-table
            :loading="isLoading"
            :data="dataList"
            :columns="columns"
            row-key="id"
            :scroll="{ x: 1500 }"
            :pagination="{ total, current: queryParams.page_num, pageSize: queryParams.page_size, showTotal: true, showPageSize: true }"
            @page-change="handlePageChange"
          >
            <template #started_at="{ record }">{{ formatTime(record.started_at) }}</template>
            <template #sample_count="{ record }">{{ record.summary_json?.sample_count ?? '-' }}</template>
            <template #avg_ms="{ record }">{{ record.summary_json ? fmt(record.summary_json.average_ms, 0) : '-' }}</template>
            <template #p90_ms="{ record }">{{ record.summary_json ? fmt(record.summary_json.pct90_ms, 0) : '-' }}</template>
            <template #p95_ms="{ record }">{{ record.summary_json ? fmt(record.summary_json.pct95_ms, 0) : '-' }}</template>
            <template #p99_ms="{ record }">{{ record.summary_json ? fmt(record.summary_json.pct99_ms, 0) : '-' }}</template>
            <template #error_pct="{ record }">
              <span :style="{ color: record.summary_json && record.summary_json.error_pct > 5 ? 'red' : 'inherit' }">
                {{ record.summary_json ? fmt(record.summary_json.error_pct) + '%' : '-' }}
              </span>
            </template>
            <template #throughput="{ record }">{{ record.summary_json ? fmt(record.summary_json.throughput) : '-' }}</template>
            <template #duration="{ record }">{{ record.duration_ms ? fmt(record.duration_ms / 1000, 1) + 's' : '-' }}</template>

            <template #operations="{ record }">
              <a-button type="text" size="small" @click="handleViewDetail(record)">查看明细</a-button>
            </template>
          </a-table>
        </a-card>
      </a-tab-pane>

      <!-- 聚合报告明细 -->
      <a-tab-pane key="detail" :title="`聚合报告明细${detailScriptName ? ' — ' + detailScriptName : ''}`">
        <a-card :bordered="false">
          <a-table
            :loading="detailLoading"
            :data="detailList"
            :columns="detailColumns"
            row-key="id"
            :scroll="{ x: 1700 }"
            :pagination="false"
            :row-class="(record: any) => record.is_total === '1' ? 'total-row' : ''"
          >
            <template #d_avg="{ record }">{{ fmt(record.average_ms, 0) }}</template>
            <template #d_median="{ record }">{{ fmt(record.median_ms, 0) }}</template>
            <template #d_p90="{ record }">{{ fmt(record.pct90_ms, 0) }}</template>
            <template #d_p95="{ record }">{{ fmt(record.pct95_ms, 0) }}</template>
            <template #d_p99="{ record }">{{ fmt(record.pct99_ms, 0) }}</template>
            <template #d_err="{ record }">
              <span :style="{ color: record.error_pct > 5 ? 'red' : 'inherit' }">{{ fmt(record.error_pct) }}%</span>
            </template>
            <template #d_thr="{ record }">{{ fmt(record.throughput) }}</template>
            <template #d_rcv="{ record }">{{ fmt(record.received_kbps) }}</template>
            <template #d_snt="{ record }">{{ fmt(record.sent_kbps) }}</template>
          </a-table>
        </a-card>
      </a-tab-pane>
    </a-tabs>
  </div>
</template>

<style scoped>
.perf-report { padding: 0; }
:deep(.total-row) {
  background-color: var(--color-fill-2);
  font-weight: 600;
}
</style>
