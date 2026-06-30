<script lang="ts" setup>
import { ref, computed, watch, onUnmounted, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Message } from '@arco-design/web-vue'
import { useGet, usePost, usePut } from '@/hooks'
import { ApiPerfRun, ApiPerfScript, ApiPerfIteration, ApiPerfTask } from '@/api/apis'

defineOptions({ name: 'PerfRun' })
const router = useRouter()
const route = useRoute()

// ── 从 URL 获取 task_id 筛选 ──────────────────────────────────
const filterTaskId = ref((route.query.task_id as string) || '')

// ── 执行列表 ──────────────────────────────────
const queryParams = ref({ page_num: 1, page_size: 10, script_id: '', run_status: '', iteration_id: '', task_id: filterTaskId.value })
const { isFetching: isLoading, data: rawListData, execute: getList } = useGet<any>(ApiPerfRun.getList, queryParams, { immediate: true })
const dataList = computed(() => rawListData.value?.list || [])
const total = computed(() => rawListData.value?.total || 0)

function handleSearch() { queryParams.value.page_num = 1; getList() }
function handlePageChange(page: number) { queryParams.value.page_num = page; getList() }

// ── 时间格式化 ──────────────────────────────────
function formatTime(time?: string | null) {
  if (!time) return '-'
  return time.replace('T', ' ').substring(0, 19)
}

const statusColorMap: Record<string, string> = {
  pending: 'gray', running: 'blue', success: 'green', failed: 'red', timeout: 'orange', cancelled: 'gray',
}

const columns = [
  { title: '任务名称', dataIndex: 'task_id', width: 140, slotName: 'task_name', ellipsis: true, tooltip: true },
  { title: '脚本名称', dataIndex: 'script_id', width: 160, slotName: 'script_name', ellipsis: true, tooltip: true },
  { title: '迭代', dataIndex: 'iteration_id', width: 140, slotName: 'iteration', ellipsis: true, tooltip: true },
  { title: '触发方式', dataIndex: 'trigger_type', width: 80, slotName: 'trigger_type' },
  { title: '状态', dataIndex: 'run_status', width: 90, slotName: 'status' },
  { title: '样本数', dataIndex: 'summary_json.sample_count', width: 80, slotName: 'sample_count' },
  { title: '平均(ms)', dataIndex: 'summary_json.average_ms', width: 90, slotName: 'avg_ms' },
  { title: 'P95(ms)', dataIndex: 'summary_json.pct95_ms', width: 90, slotName: 'p95_ms' },
  { title: '错误率', dataIndex: 'summary_json.error_pct', width: 80, slotName: 'error_pct' },
  { title: '吞吐量', dataIndex: 'summary_json.throughput', width: 90, slotName: 'throughput' },
  { title: '开始时间', dataIndex: 'started_at', width: 160, slotName: 'started_at' },
  { title: '耗时(秒)', dataIndex: 'duration_ms', width: 90, slotName: 'duration' },
  { title: '操作', dataIndex: 'operations', slotName: 'operations', width: 180, fixed: 'right' as const },
]

// ── 触发执行弹窗 ──────────────────────────────────
const triggerVisible = ref(false)
const triggerForm = ref({ script_id: '', threads: undefined as number | undefined, rampup: undefined as number | undefined, loops: undefined as number | undefined, duration: undefined as number | undefined, extra_props: '', baseline_run_id: '', iteration_id: '' })

// 获取脚本列表供选择
const { data: scriptData } = useGet<any>(ApiPerfScript.getList, { page_num: 1, page_size: 100 }, { immediate: true })
const scriptOptions = computed(() => (scriptData.value?.list || []).map((s: any) => ({ label: `${s.name} (${s.code})`, value: s.id })))
const scriptMap = computed(() => {
  const m: Record<string, any> = {}
  for (const s of (scriptData.value?.list || [])) m[s.id] = s
  return m
})

// 获取任务列表（用于显示任务名称）
const { data: taskData } = useGet<any>(ApiPerfTask.getList, { page_num: 1, page_size: 100 }, { immediate: true })
const taskMap = computed(() => {
  const m: Record<string, any> = {}
  for (const t of (taskData.value?.list || [])) m[t.id] = t
  return m
})

// 获取迭代列表供选择（默认选中当前迭代）
const { data: iterData } = useGet<any>(ApiPerfIteration.getList, { page_num: 1, page_size: 100, status: '1' }, { immediate: true })
const iterOptions = computed(() => (iterData.value?.list || []).map((i: any) => ({ label: `${i.name} (${i.code})`, value: i.id })))
const iterMap = computed(() => {
  const m: Record<string, any> = {}
  for (const i of (iterData.value?.list || [])) m[i.id] = i
  return m
})
const { data: currentIterData } = useGet<any>(ApiPerfIteration.current, {}, { immediate: true })

function handleTriggerClick() {
  triggerForm.value = { script_id: '', threads: undefined, rampup: undefined, loops: undefined, duration: undefined, extra_props: '', baseline_run_id: '', iteration_id: currentIterData.value?.id || '' }
  triggerVisible.value = true
}

async function handleTriggerSubmit() {
  if (!triggerForm.value.script_id) { Message.warning('请选择脚本'); return }
  const { execute, error } = usePost(ApiPerfRun.trigger, triggerForm.value)
  await execute()
  if (error.value) { Message.error('触发失败'); return }
  Message.success('已触发执行')
  triggerVisible.value = false
  setTimeout(() => getList(), 1000)
}

// ── 跳转报告页 ──────────────────────────────────
function handleViewReport(record: any) {
  router.push({ path: '/perf/report', query: { run_id: record.id } })
}

// ── 查看日志 ──────────────────────────────────
const logVisible = ref(false)
const logContent = ref('')

async function handleViewLog(record: any) {
  const { data, error, execute } = useGet<any>(ApiPerfRun.log, { id: record.id }, { immediate: false })
  await execute()
  if (error.value) { Message.error('获取日志失败'); return }
  logContent.value = data.value || '无日志'
  logVisible.value = true
}

// ── 取消执行 ──────────────────────────────────
async function handleCancel(record: any) {
  const { execute, error } = usePut(ApiPerfRun.cancel, { run_id: record.id })
  await execute()
  if (error.value) { Message.error('取消失败'); return }
  Message.success('已取消')
  getList()
}

// ── 刷新 ──────────────────────────────────
function handleRefresh() { getList() }

// ── 自动刷新轮询 ──────────────────────────────────
let pollTimer: ReturnType<typeof setInterval> | null = null
watch(dataList, (list) => {
  const hasActive = list.some((r: any) => r.run_status === 'pending' || r.run_status === 'running')
  if (hasActive && !pollTimer) {
    pollTimer = setInterval(() => getList(), 5000)
  } else if (!hasActive && pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
})
onUnmounted(() => {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
})

// ── 批量执行 ──────────────────────────────────
const batchVisible = ref(false)
const batchSubmitting = ref(false)
const batchForm = ref({ script_ids: [] as string[], threads: undefined as number | undefined, rampup: undefined as number | undefined, loops: undefined as number | undefined, duration: undefined as number | undefined, extra_props: '', iteration_id: '' })

function handleBatchClick() {
  batchForm.value = { script_ids: [], threads: undefined, rampup: undefined, loops: undefined, duration: undefined, extra_props: '', iteration_id: currentIterData.value?.id || '' }
  batchVisible.value = true
}

async function handleBatchSubmit() {
  if (batchForm.value.script_ids.length === 0) { Message.warning('请选择至少一个脚本'); return }
  batchSubmitting.value = true
  const { execute, error } = usePost(ApiPerfTask.trigger, {
    name: `批量执行-${new Date().toLocaleString()}`,
    iteration_id: batchForm.value.iteration_id || undefined,
    task_type: 'sequential',
    max_concurrency: 1,
    script_ids: batchForm.value.script_ids,
    threads: batchForm.value.threads,
    rampup: batchForm.value.rampup,
    loops: batchForm.value.loops,
    duration: batchForm.value.duration,
    extra_props: batchForm.value.extra_props || undefined,
  })
  await execute()
  batchSubmitting.value = false
  if (error.value) { Message.error('触发失败'); return }
  Message.success(`已触发 ${batchForm.value.script_ids.length} 个脚本的批量执行任务`)
  batchVisible.value = false
  setTimeout(() => getList(), 1000)
}
</script>

<template>
  <div class="perf-run">
    <a-card :bordered="false" class="m-b-8px">
      <a-row :gutter="16">
        <a-col v-if="filterTaskId" :span="6">
          <a-button @click="router.push('/perf/task')">
            <template #icon><icon-left /></template>
            返回任务列表
          </a-button>
        </a-col>
        <a-col :span="6">
          <a-select v-model="queryParams.script_id" :options="scriptOptions" placeholder="选择脚本" allow-clear @change="handleSearch" />
        </a-col>
        <a-col :span="4">
          <a-select v-model="queryParams.iteration_id" :options="iterOptions" placeholder="选择迭代" allow-clear @change="handleSearch" />
        </a-col>
        <a-col :span="4">
          <a-select v-model="queryParams.run_status" placeholder="状态" allow-clear @change="handleSearch">
            <a-option value="pending">等待中</a-option>
            <a-option value="running">执行中</a-option>
            <a-option value="success">成功</a-option>
            <a-option value="failed">失败</a-option>
            <a-option value="timeout">超时</a-option>
            <a-option value="cancelled">已取消</a-option>
          </a-select>
        </a-col>
        <a-col :span="6">
          <a-space>
            <a-button type="primary" @click="handleSearch">搜索</a-button>
            <a-button @click="handleRefresh">刷新</a-button>
            <a-button type="primary" status="success" @click="handleTriggerClick">
              <template #icon><icon-play-arrow /></template>
              触发执行
            </a-button>
            <a-button type="primary" status="warning" @click="handleBatchClick">
              <template #icon><icon-launch /></template>
              批量执行
            </a-button>
          </a-space>
        </a-col>
      </a-row>
    </a-card>

    <a-card :bordered="false">
      <a-table :loading="isLoading" :data="dataList" :columns="columns"
        :pagination="{ total, current: queryParams.page_num, pageSize: queryParams.page_size, showTotal: true, showPageSize: true }"
        row-key="id" @page-change="handlePageChange">
        <template #task_name="{ record }">{{ record.task_id ? (taskMap[record.task_id]?.name || record.task_id) : '-' }}</template>
        <template #started_at="{ record }">{{ formatTime(record.started_at) }}</template>
        <template #script_name="{ record }">
          {{ scriptMap[record.script_id]?.name || record.script_id?.substring(0, 8) || '-' }}
        </template>
        <template #iteration="{ record }">
          {{ record.iteration_id ? (iterMap[record.iteration_id]?.name || record.iteration_id) : '-' }}
        </template>
        <template #trigger_type="{ record }">
          <a-tag :color="record.trigger_type === 'task' ? 'blue' : (record.trigger_type === 'retry' ? 'orange' : 'gray')">{{ record.trigger_type }}</a-tag>
        </template>
        <template #status="{ record }">
          <a-badge :status="(statusColorMap[record.run_status] as any) || 'gray'" :text="record.run_status" />
        </template>
        <template #sample_count="{ record }">{{ record.summary_json?.sample_count ?? '-' }}</template>
        <template #avg_ms="{ record }">{{ record.summary_json ? record.summary_json.average_ms.toFixed(0) : '-' }}</template>
        <template #p95_ms="{ record }">{{ record.summary_json ? record.summary_json.pct95_ms.toFixed(0) : '-' }}</template>
        <template #error_pct="{ record }">
          <span :style="{ color: record.summary_json && record.summary_json.error_pct > 5 ? 'red' : 'inherit' }">{{ record.summary_json ? record.summary_json.error_pct.toFixed(2) + '%' : '-' }}</span>
        </template>
        <template #throughput="{ record }">{{ record.summary_json ? record.summary_json.throughput.toFixed(2) : '-' }}</template>
        <template #duration="{ record }">{{ record.duration_ms ? (record.duration_ms / 1000).toFixed(1) + 's' : '-' }}</template>
        <template #operations="{ record }">
          <a-space>
            <a-button type="text" size="small" @click="handleViewReport(record)" :disabled="record.run_status !== 'success'">报告</a-button>
            <a-button type="text" size="small" @click="handleViewLog(record)">日志</a-button>
            <a-button v-if="record.run_status === 'pending' || record.run_status === 'running'" type="text" size="small" status="warning" @click="handleCancel(record)">取消</a-button>
          </a-space>
        </template>
      </a-table>
    </a-card>

    <!-- 触发执行弹窗 -->
    <a-modal v-model:visible="triggerVisible" title="触发执行" :width="520" @ok="handleTriggerSubmit">
      <a-form :model="triggerForm" layout="vertical">
        <a-form-item label="选择脚本" required>
          <a-select v-model="triggerForm.script_id" :options="scriptOptions" placeholder="请选择脚本" />
        </a-form-item>
        <a-form-item label="关联迭代">
          <a-select v-model="triggerForm.iteration_id" :options="iterOptions" placeholder="选择迭代（默认当前迭代）" allow-clear />
        </a-form-item>
        <a-row :gutter="16">
          <a-col :span="12"><a-form-item label="线程数"><a-input-number v-model="triggerForm.threads" :min="1" placeholder="覆盖默认值" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="Ramp-up(秒)"><a-input-number v-model="triggerForm.rampup" :min="0" placeholder="覆盖默认值" /></a-form-item></a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12"><a-form-item label="循环次数"><a-input-number v-model="triggerForm.loops" :min="1" placeholder="覆盖默认值" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="持续时间(秒)"><a-input-number v-model="triggerForm.duration" :min="0" placeholder="0=不限" /></a-form-item></a-col>
        </a-row>
        <a-form-item label="额外JMeter属性">
          <a-input v-model="triggerForm.extra_props" placeholder="key1=value1,key2=value2" />
        </a-form-item>
        <a-form-item label="对比基线RunID">
          <a-input v-model="triggerForm.baseline_run_id" placeholder="可选，填写基线run_id" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 日志弹窗 -->
    <a-modal v-model:visible="logVisible" title="执行日志" :width="800" :footer="false">
      <a-typography-text style="white-space: pre-wrap; font-family: monospace; font-size: 12px; max-height: 500px; overflow-y: auto; display: block;">
        {{ logContent }}
      </a-typography-text>
    </a-modal>

    <!-- 批量执行弹窗 -->
    <a-modal v-model:visible="batchVisible" title="批量执行" :width="560" :ok-loading="batchSubmitting" @ok="handleBatchSubmit">
      <a-form :model="batchForm" layout="vertical">
        <a-form-item label="选择脚本（可多选）" required>
          <a-select v-model="batchForm.script_ids" :options="scriptOptions" placeholder="请选择脚本" multiple allow-search />
        </a-form-item>
        <a-form-item label="关联迭代">
          <a-select v-model="batchForm.iteration_id" :options="iterOptions" placeholder="选择迭代（默认当前迭代）" allow-clear />
        </a-form-item>
        <a-row :gutter="16">
          <a-col :span="12"><a-form-item label="线程数"><a-input-number v-model="batchForm.threads" :min="1" placeholder="覆盖默认值" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="Ramp-up(秒)"><a-input-number v-model="batchForm.rampup" :min="0" placeholder="覆盖默认值" /></a-form-item></a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12"><a-form-item label="循环次数"><a-input-number v-model="batchForm.loops" :min="1" placeholder="覆盖默认值" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="持续时间(秒)"><a-input-number v-model="batchForm.duration" :min="0" placeholder="0=不限" /></a-form-item></a-col>
        </a-row>
        <a-form-item label="额外JMeter属性">
          <a-input v-model="batchForm.extra_props" placeholder="key1=value1,key2=value2" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<style scoped>
.perf-run { padding: 0; }
</style>
