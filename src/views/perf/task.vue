<script lang="ts" setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { Message } from '@arco-design/web-vue'
import { useGet, usePost, usePut, useDelete } from '@/hooks'
import { ApiPerfTask, ApiPerfScript, ApiPerfIteration } from '@/api/apis'

defineOptions({ name: 'PerfTask' })
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
}
function handlePageChange(page: number) {
  queryParams.value.page_num = page
  getList()
}

// ── 时间格式化 ──────────────────────────────────
function formatTime(time?: string | null) {
  if (!time) return '-'
  return time.replace('T', ' ').substring(0, 19)
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
  return Array.from(domains).map(d => ({ label: d, value: d }))
})

// ── 迭代列表 ──────────────────────────────────
const { data: iterData } = useGet<any>(ApiPerfIteration.getList, { page_num: 1, page_size: 100, status: '1' }, { immediate: true })
const iterOptions = computed(() => (iterData.value?.list || []).map((i: any) => ({ label: `${i.name} (${i.code})`, value: i.id })))
const { data: currentIterData } = useGet<any>(ApiPerfIteration.current, {}, { immediate: true })

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
})

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
  }
  triggerVisible.value = true
}

// 按领域批量选择脚本
function handleDomainChange(domain: string) {
  if (!domain) {
    triggerForm.value.script_ids = []
    return
  }
  const scriptsInDomain = (scriptData.value?.list || [])
    .filter((s: any) => s.domain === domain)
    .map((s: any) => s.id)
  triggerForm.value.script_ids = scriptsInDomain
  if (!triggerForm.value.name) {
    triggerForm.value.name = `${domain}-批量执行`
  }
}

async function handleTriggerSubmit() {
  if (!triggerForm.value.name) { Message.warning('请输入任务名称'); return }
  if (triggerForm.value.script_ids.length === 0) { Message.warning('请选择至少一个脚本'); return }
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
  })
  await execute()
  triggerSubmitting.value = false
  if (error.value) { Message.error('触发失败'); return }
  Message.success(`任务已触发，共 ${triggerForm.value.script_ids.length} 个脚本`)
  triggerVisible.value = false
  setTimeout(() => getList(), 1000)
}

// ── 重试失败项 ──────────────────────────────────
async function handleRetryFailed(record: any) {
  const { execute, error } = usePost(ApiPerfTask.retryFailed, { task_id: record.id })
  await execute()
  if (error.value) { Message.error('重试失败'); return }
  Message.success('已触发重试')
  getList()
}

// ── 取消任务 ──────────────────────────────────
async function handleCancel(record: any) {
  const { execute, error } = usePut(ApiPerfTask.cancel, { task_id: record.id })
  await execute()
  if (error.value) { Message.error('取消失败'); return }
  Message.success('已取消')
  getList()
}

// ── 删除任务 ──────────────────────────────────
async function handleDelete(record: any) {
  const { execute, error } = useDelete(ApiPerfTask.delete, { ids: [record.id] })
  await execute()
  if (error.value) { Message.error('删除失败'); return }
  Message.success('删除成功')
  getList()
}

// ── 查看任务详情（跳转到run列表，按task_id筛选） ──────────────────────────────────
function handleViewRuns(record: any) {
  router.push({ path: '/perf/run', query: { task_id: record.id } })
}

// ── 自动刷新轮询 ──────────────────────────────────
let pollTimer: ReturnType<typeof setInterval> | null = null
watch(dataList, (list) => {
  const hasActive = list.some((r: any) => r.task_status === 'running' || r.task_status === 'pending')
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

// ── 进度计算 ──────────────────────────────────
function getProgress(record: any): number {
  const total = record.total_count || 0
  if (total === 0) return 0
  const done = (record.success_count || 0) + (record.failed_count || 0)
  return Math.min(Math.round((done / total) * 100), 100)
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
          <a-progress :percent="getProgress(record)" :status="record.task_status === 'running' ? 'normal' : (record.task_status === 'completed' ? 'success' : (record.task_status === 'failed' ? 'danger' : 'normal'))" />
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
        <a-form-item label="选择脚本（可多选）" required>
          <a-select
            v-model="triggerForm.script_ids"
            :options="scriptOptions"
            placeholder="请选择脚本，或先选择领域自动筛选"
            multiple
            allow-search
            :virtual-list-props="{ height: 200 }"
          />
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
      </a-form>
    </a-modal>
  </div>
</template>

<style scoped>
.perf-task { padding: 0; }
</style>
