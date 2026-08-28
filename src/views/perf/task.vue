<script lang="ts" setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { Message } from '@arco-design/web-vue'
import { formatTime, useDelete, useGet, usePost, usePut } from '@/hooks'
import { ApiPerfTask, ApiPerfScript, ApiPerfIteration, ApiPerfDomain, ApiPerfLoadNode } from '@/api/apis'

defineOptions({ name: 'task' })
const router = useRouter()

// ── 任务列表 ──────────────────────────────────
const queryParams = ref({
  page_num: 1,
  page_size: 10,
  keyword: '',
  iteration_id: '',
  domain: '',
  task_status: '',
})
const { isFetching: isLoading, data: rawListData, execute: getList } = useGet<any>(ApiPerfTask.getList, queryParams, { immediate: true })
const dataList = computed(() => rawListData.value?.list || [])
const total = computed(() => rawListData.value?.total || 0)

function handleSearch() {
  queryParams.value.page_num = 1
  getList()
  resetPollTimer()
}
function handlePageChange(page: number) {
  queryParams.value.page_num = page
  getList()
  resetPollTimer()
}


const statusColorMap: Record<string, string> = {
  pending: 'gray', running: 'blue', completed: 'green',
  partial_failed: 'orange', failed: 'red', cancelled: 'gray',
}
const statusTextMap: Record<string, string> = {
  pending: '等待中', running: '执行中', completed: '已完成',
  partial_failed: '部分失败', failed: '全部失败', cancelled: '已取消',
}

const columns = [
  { title: '任务名称', dataIndex: 'name', width: 180, ellipsis: true, tooltip: true },
  { title: '领域', dataIndex: 'domain', width: 120, ellipsis: true, tooltip: true },
  { title: '迭代', dataIndex: 'iteration_name', width: 140, ellipsis: true, tooltip: true },
  { title: '执行策略', dataIndex: 'task_type', width: 90, slotName: 'task_type' },
  { title: '进度', dataIndex: 'progress', width: 200, slotName: 'progress' },
  { title: '成功/失败/待执行', dataIndex: 'counts', width: 140, slotName: 'counts' },
  { title: '状态', dataIndex: 'task_status', width: 100, slotName: 'status' },
  { title: '开始时间', dataIndex: 'started_at', width: 160, slotName: 'started_at' },
  { title: '完成时间', dataIndex: 'finished_at', width: 160, slotName: 'finished_at' },
  { title: '操作', dataIndex: 'operations', slotName: 'operations', width: 200, fixed: 'right' as const },
]

// ── 脚本列表（用于触发任务时选择） ──────────────────────────────────
const { data: scriptData } = useGet<any>(ApiPerfScript.getList, { page_num: 1, page_size: 200 }, { immediate: true })
const scriptOptions = computed(() => (scriptData.value?.list || []).map((s: any) => ({ label: `${s.name}`, value: s.id })))

// 按领域分组脚本
const domainOptions = computed(() => {
  const domains = new Set<string>()
  for (const s of (scriptData.value?.list || [])) {
    if (s.domain) domains.add(s.domain)
  }
  // 合并从字典 API 获取的业务领域
  for (const d of (domainDict.value || [])) {
    domains.add(d)
  }
  return Array.from(domains).sort().map(d => ({ label: d, value: d }))
})

// 业务领域字典（从 perf_module.product_group 去重）
const { data: domainDict } = useGet<string[]>(ApiPerfDomain.domainOptions, {}, { immediate: true })

// ── 迭代列表 ──────────────────────────────────
const { data: iterData } = useGet<any>(ApiPerfIteration.getList, { page_num: 1, page_size: 100, status: '1' }, { immediate: true })
const iterOptions = computed(() => (iterData.value?.list || []).map((i: any) => ({ label: `${i.name} (${i.code})`, value: i.id })))
const { data: currentIterData } = useGet<any>(ApiPerfIteration.current, {}, { immediate: true })

// 获取在线压测机列表
const { data: loadNodeData } = useGet<any>(ApiPerfLoadNode.onlineList, {}, { immediate: true })
const loadNodeOptions = computed(() => [
  { label: '本地执行（默认，不经过 Agent）', value: '' },
  { label: '自动选择 Agent 节点', value: 'auto' },
  ...(loadNodeData.value || []).map((n: any) => ({
    label: `${n.node_name} (${n.host_ip}:${n.agent_port}) [${n.current_load || 0}/${n.max_concurrency || 1}]`,
    value: n.id,
  })),
])

// ── 触发任务弹窗 ──────────────────────────────────
const triggerVisible = ref(false)
const triggerSubmitting = ref(false)
const triggerForm = ref({
  name: '',
  iteration_id: '',
  domain: '',
  task_type: 'sequential',
  max_concurrency: 1,
  script_ids: [] as string[],
  threads: undefined as number | undefined,
  rampup: undefined as number | undefined,
  loops: undefined as number | undefined,
  duration: undefined as number | undefined,
  extra_props: '',
  load_node_id: '',
})

// ── 预估执行时间 ──────────────────────────────────
interface EstimateTimeData {
  estimated_human: string
  serial_total_human: string
  total_scripts: number
  scripts_with_data: number
  scripts_no_data: number
  avg_per_script_human: string
  max_script_human: string
}

interface EstimateTimeResponse {
  data?: EstimateTimeData
}

const estimateResult = ref<EstimateTimeData | null>(null)
const estimateLoading = ref(false)
let estimateTimer: any = null

function fetchEstimate() {
  if (estimateTimer) clearTimeout(estimateTimer)
  const ids = triggerForm.value.script_ids
  if (!ids || ids.length === 0) {
    estimateResult.value = null
    return
  }
  estimateTimer = setTimeout(async () => {
    estimateLoading.value = true
    const { execute, data } = usePost<EstimateTimeResponse>(ApiPerfTask.estimateTime, {
      script_ids: ids,
      max_concurrency: triggerForm.value.task_type === 'parallel' ? triggerForm.value.max_concurrency : 1,
    })
    await execute()
    estimateResult.value = data.value?.data || null
    estimateLoading.value = false
  }, 400)
}

watch(() => [triggerForm.value.script_ids, triggerForm.value.task_type, triggerForm.value.max_concurrency], () => {
  if (triggerVisible.value) fetchEstimate()
}, { deep: true })

function handleTriggerClick() {
  triggerForm.value = {
    name: '',
    iteration_id: currentIterData.value?.id || '',
    domain: '',
    task_type: 'sequential',
    max_concurrency: 1,
    script_ids: [],
    threads: undefined,
    rampup: undefined,
    loops: undefined,
    duration: undefined,
    extra_props: '',
    load_node_id: '',
  }
  triggerVisible.value = true
}

// 按领域筛选脚本（仅筛选，不覆盖已选脚本）
function handleDomainChange(value: string | number | boolean | Record<string, unknown> | (string | number | boolean | Record<string, unknown>)[]) {
  if (typeof value !== 'string' || !value)
    return
  const domain = value
  // 将该领域下尚未选中的脚本追加到已选列表
  const scriptsInDomain = (scriptData.value?.list || [])
    .filter((s: any) => s.domain === domain)
    .map((s: any) => s.id)
  const existing = new Set(triggerForm.value.script_ids)
  for (const sid of scriptsInDomain) {
    if (!existing.has(sid)) {
      triggerForm.value.script_ids.push(sid)
    }
  }
  if (!triggerForm.value.name) {
    triggerForm.value.name = `${domain}-批量执行`
  }
}

async function handleTriggerSubmit() {
  if (!triggerForm.value.name) { Message.warning('请输入任务名称'); return }
  if (triggerForm.value.script_ids.length === 0 && !triggerForm.value.domain) {
    Message.warning('请选择脚本或指定领域'); return
  }
  if (triggerForm.value.script_ids.length === 0 && triggerForm.value.domain) {
    Message.info(`将动态解析领域「${triggerForm.value.domain}」下的脚本`)
  }
  triggerSubmitting.value = true
  const { execute, error } = usePost(ApiPerfTask.trigger, {
    name: triggerForm.value.name,
    iteration_id: triggerForm.value.iteration_id || undefined,
    domain: triggerForm.value.domain || undefined,
    task_type: triggerForm.value.task_type,
    max_concurrency: triggerForm.value.task_type === 'parallel' ? triggerForm.value.max_concurrency : 1,
    script_ids: triggerForm.value.script_ids,
    threads: triggerForm.value.threads,
    rampup: triggerForm.value.rampup,
    loops: triggerForm.value.loops,
    duration: triggerForm.value.duration,
    extra_props: triggerForm.value.extra_props || undefined,
    load_node_id: triggerForm.value.load_node_id || undefined,
  })
  await execute()
  triggerSubmitting.value = false
  if (error.value) { Message.error('触发失败'); return }
  Message.success(`任务已触发，共 ${triggerForm.value.script_ids.length} 个脚本`)
  triggerVisible.value = false
  setTimeout(() => { getList(); resetPollTimer() }, 1000)
}

// ── 重试失败项 ──────────────────────────────────
async function handleRetryFailed(record: any) {
  const { execute, error } = usePost(ApiPerfTask.retryFailed, { task_id: record.id })
  await execute()
  if (error.value) { Message.error('重试失败'); return }
  Message.success('已触发重试')
  getList()
  resetPollTimer()
}

// ── 取消任务 ──────────────────────────────────
async function handleCancel(record: any) {
  const { execute, error } = usePut(ApiPerfTask.cancel, { task_id: record.id })
  await execute()
  if (error.value) { Message.error('取消失败'); return }
  Message.success('已取消')
  getList()
  resetPollTimer()
}

// ── 删除任务 ──────────────────────────────────
async function handleDelete(record: any) {
  const { execute, error } = useDelete(ApiPerfTask.delete, { ids: [record.id] })
  await execute()
  if (error.value) { Message.error('删除失败'); return }
  Message.success('删除成功')
  getList()
  resetPollTimer()
}

// ── 查看任务详情（跳转到run列表，按task_id筛选） ──────────────────────────────────
function handleViewRuns(record: any) {
  router.push({ path: '/perf/run-group/run', query: { task_id: record.id } })
}

// ── 自动刷新轮询（用户操作后 60s 重置）──────────────────────────────────
const POLL_INTERVAL = 60000 // 60秒
let pollTimer: ReturnType<typeof setTimeout> | null = null

function clearPollTimer() {
  if (pollTimer) { clearTimeout(pollTimer); pollTimer = null }
}

function startPollTimer() {
  clearPollTimer()
  pollTimer = setTimeout(async () => {
    pollTimer = null
    await getList()
    // 刷新后若仍有活跃任务则继续轮询
    const hasActive = dataList.value.some((r: any) => r.task_status === 'running' || r.task_status === 'pending')
    if (hasActive) startPollTimer()
  }, POLL_INTERVAL)
}

// 用户操作后重置计时器（如搜索、翻页、筛选）
function resetPollTimer() {
  const hasActive = dataList.value.some((r: any) => r.task_status === 'running' || r.task_status === 'pending')
  if (hasActive || pollTimer) startPollTimer()
}

watch(dataList, (list) => {
  const hasActive = list.some((r: any) => r.task_status === 'running' || r.task_status === 'pending')
  if (hasActive && !pollTimer) {
    startPollTimer()
  } else if (!hasActive && pollTimer) {
    clearPollTimer()
  }
}, { deep: true })
onUnmounted(() => {
  clearPollTimer()
})

// ── 进度计算 ──────────────────────────────────
function getProgress(record: any): number {
  const total = record.total_count || 0
  if (total === 0) return 0
  const done = (record.success_count || 0) + (record.failed_count || 0)
  // a-progress 的 percent 是 0-1 小数，不是 0-100
  return Math.min(done / total, 1)
}
</script>

<template>
  <div class="perf-task">
    <a-card :bordered="false" class="m-b-8px">
      <a-row :gutter="16">
        <a-col :span="6">
          <a-input-search v-model="queryParams.keyword" placeholder="搜索任务名称" allow-clear @search="handleSearch" @press-enter="handleSearch" />
        </a-col>
        <a-col :span="4">
          <a-select v-model="queryParams.iteration_id" :options="iterOptions" placeholder="选择迭代" allow-clear @change="handleSearch" />
        </a-col>
        <a-col :span="4">
          <a-select v-model="queryParams.domain" :options="domainOptions" placeholder="选择领域" allow-clear @change="handleSearch" />
        </a-col>
        <a-col :span="4">
          <a-select v-model="queryParams.task_status" placeholder="状态" allow-clear @change="handleSearch">
            <a-option value="running">执行中</a-option>
            <a-option value="completed">已完成</a-option>
            <a-option value="partial_failed">部分失败</a-option>
            <a-option value="failed">全部失败</a-option>
            <a-option value="cancelled">已取消</a-option>
          </a-select>
        </a-col>
        <a-col :span="6">
          <a-space>
            <a-button type="primary" @click="handleSearch">搜索</a-button>
            <a-button type="primary" status="success" @click="handleTriggerClick">
              <template #icon><icon-launch /></template>
              触发任务
            </a-button>
          </a-space>
        </a-col>
      </a-row>
    </a-card>

    <a-card :bordered="false">
<a-table
  column-resizable
        :loading="isLoading"
        :data="dataList"
        :columns="columns"
        :pagination="{ total, current: queryParams.page_num, pageSize: queryParams.page_size, showTotal: true, showPageSize: true }"
        row-key="id"
        @page-change="handlePageChange"
      >
        <template #started_at="{ record }">{{ formatTime(record.started_at) }}</template>
        <template #finished_at="{ record }">{{ formatTime(record.finished_at) }}</template>
        <template #task_type="{ record }">
          <a-tag :color="record.task_type === 'parallel' ? 'blue' : 'gray'">
            {{ record.task_type === 'parallel' ? '并行' : '串行' }}
          </a-tag>
        </template>
        <template #progress="{ record }">
          <a-progress :percent="getProgress(record)" :status="record.task_status === 'running' ? 'normal' : (record.task_status === 'completed' ? 'success' : (record.task_status === 'failed' ? 'danger' : 'normal'))" :format="(p: number) => `${Math.round(p * 100)}%`" />
        </template>
        <template #counts="{ record }">
          <span style="color: #00b42a">{{ record.success_count || 0 }}</span>
          /
          <span :style="{ color: (record.failed_count || 0) > 0 ? '#f53f3f' : 'inherit' }">{{ record.failed_count || 0 }}</span>
          /
          <span style="color: #86909c">{{ record.pending_count || 0 }}</span>
        </template>
        <template #status="{ record }">
          <a-badge :status="(statusColorMap[record.task_status] as any) || 'gray'" :text="statusTextMap[record.task_status] || record.task_status" />
        </template>
        <template #operations="{ record }">
          <a-space>
            <a-button type="text" size="small" @click="handleViewRuns(record)">查看执行</a-button>
            <a-button v-if="record.task_status === 'partial_failed' || record.task_status === 'failed'" type="text" size="small" status="warning" @click="handleRetryFailed(record)">重试失败</a-button>
            <a-button v-if="record.task_status === 'running' || record.task_status === 'pending'" type="text" size="small" status="warning" @click="handleCancel(record)">取消</a-button>
            <a-popconfirm content="确认删除？" @ok="handleDelete(record)">
              <a-button type="text" size="small" status="danger">删除</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </a-table>
    </a-card>

    <!-- 触发任务弹窗 -->
    <a-modal v-model:visible="triggerVisible" title="触发执行任务" :width="640" :ok-loading="triggerSubmitting" @ok="handleTriggerSubmit">
      <a-form :model="triggerForm" layout="vertical">
        <a-form-item label="任务名称" required>
          <a-input v-model="triggerForm.name" placeholder="如：账户管理-2026Q2迭代" />
        </a-form-item>
        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item label="关联迭代">
              <a-select v-model="triggerForm.iteration_id" :options="iterOptions" placeholder="选择迭代" allow-clear />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="领域">
              <a-select v-model="triggerForm.domain" :options="domainOptions" placeholder="选择领域" allow-clear @change="handleDomainChange" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="执行策略">
              <a-select v-model="triggerForm.task_type">
                <a-option value="sequential">串行（逐个执行）</a-option>
                <a-option value="parallel">并行（并发执行）</a-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item v-if="triggerForm.task_type === 'parallel'" label="最大并发数">
          <a-input-number v-model="triggerForm.max_concurrency" :min="1" :max="10" />
        </a-form-item>
        <a-form-item label="执行机">
          <a-select v-model="triggerForm.load_node_id" :options="loadNodeOptions" placeholder="选择执行机" allow-clear />
        </a-form-item>
        <a-form-item label="选择脚本（可多选，指定领域后可不选）">
          <a-select
            v-model="triggerForm.script_ids"
            :options="scriptOptions"
            placeholder="请选择脚本，或先选择领域自动筛选"
            multiple
            allow-search
            :virtual-list-props="{ height: 200 }"
          />
        </a-form-item>
        <a-alert v-if="estimateResult" type="info" :loading="estimateLoading" style="margin-bottom: 12px">
          <template #title>
            <span>预估执行时间</span>
          </template>
          <div style="font-size: 13px; line-height: 1.8">
            <span>预估总耗时：</span>
            <b style="color: #165dff; font-size: 16px">{{ estimateResult.estimated_human }}</b>
            <span style="color: #86909c; margin-left: 8px">（串行 {{ estimateResult.serial_total_human }}）</span>
            <br />
            <span>脚本总数：{{ estimateResult.total_scripts }}（有历史数据 {{ estimateResult.scripts_with_data }}，无数据 {{ estimateResult.scripts_no_data }}）</span>
            <br />
            <span>平均单个：{{ estimateResult.avg_per_script_human }}，最长：{{ estimateResult.max_script_human }}</span>
          </div>
        </a-alert>
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
      </a-form>
    </a-modal>
  </div>
</template>

<style scoped>
.perf-task { padding: 0; }
</style>
