<script lang="ts" setup>
import type { AiAgentFeedbackPrompt, AiAgentOption, AiExecution, AiExecutionStats, AiListResult } from '@/api/aiApis'
import { Message, Modal } from '@arco-design/web-vue'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ApiAiAgent, ApiAiExecution, ApiAiFeedback } from '@/api/aiApis'
import { formatTime, getAction, postAction, toApiParam, useGet, useTableAutoHeight, withTableDefaults } from '@/hooks'

defineOptions({ name: 'AiExecutionLog' })

const router = useRouter()
const route = useRoute()

// ── 统计数据 ──────────────────────────────────
const { data: statsRaw } = useGet<AiExecutionStats>(ApiAiExecution.stats, {}, { immediate: true })
const stats = computed(() => ({
  total: 0,
  succeeded: 0,
  failed: 0,
  running: 0,
  success_rate: 0,
  avg_duration_ms: 0,
  total_tokens: 0,
  total_credits: 0,
  ...(statsRaw.value ?? {}),
}))

// ── 按 Agent 筛选（执行记录里存的是执行时的 agent_code 快照）──────────
const { data: agentData } = useGet<AiAgentOption[]>(ApiAiAgent.options, undefined, { immediate: true })
const agentOptions = computed<AiAgentOption[]>(() => (Array.isArray(agentData.value) ? agentData.value : []))

// ── 列表数据 ──────────────────────────────────
const queryParams = ref({ agent_id: '', agent_code: '', skill_id: '', caller_module: '', status: '', start_time: '', end_time: '', page_num: 1, page_size: 10 })
const dateRange = ref<string[] | undefined>(undefined)
const { isFetching: loading, data: listRaw, execute: fetchList } = useGet<AiListResult<AiExecution>>(
  ApiAiExecution.getList,
  queryParams,
  { immediate: true },
)
const list = computed(() => listRaw.value?.list || [])
const total = computed(() => listRaw.value?.total || 0)

function handleSearch() {
  queryParams.value.page_num = 1
  // 日期控件的绑定值是无偏移的墙上时间，按用户时区转成 RFC3339 再提交
  queryParams.value.start_time = toApiParam(dateRange.value?.[0]) ?? ''
  queryParams.value.end_time = toApiParam(dateRange.value?.[1]) ?? ''
  fetchList()
}
function handlePageChange(page: number) {
  queryParams.value.page_num = page
  fetchList()
}

// ── 停止执行（只终止本进程内正在跑的 CLI 及其子进程）──
async function stopExecution(record: AiExecution) {
  Modal.warning({
    title: '停止该 AI 执行？',
    content: '会终止该执行对应的 CLI 与子进程；半截结果不保留。排队中/已结束的执行不受影响。',
    okText: '停止',
    cancelText: '取消',
    okButtonProps: { status: 'danger' },
    onOk: async () => {
      const res = await postAction<string>(ApiAiExecution.cancel, { id: record.id })
      if (res) {
        Message.success(res)
        fetchList()
      }
    },
  })
}

// ── 批量删除（清理等待中的僵尸队列）──────────────────
const selectedKeys = ref<string[]>([])
const deleting = ref(false)

/** 删除勾选的记录（后端排除 running，避免删掉正在执行的） */
async function deleteSelected() {
  if (selectedKeys.value.length === 0) {
    Message.warning('请先勾选要删除的记录')
    return
  }
  Modal.warning({
    title: '确认删除选中的执行记录？',
    content: `将删除 ${selectedKeys.value.length} 条记录（正在运行的记录会被自动跳过）。此操作不可恢复。`,
    okText: '确认删除',
    cancelText: '取消',
    okButtonProps: { status: 'danger' },
    onOk: async () => {
      await doDelete({ ids: selectedKeys.value })
    },
  })
}

/** 按当前查询条件删除所有「等待中」记录（后端强制仅删 pending，需至少一个查询条件） */
async function deleteAllMatching() {
  const f = {
    caller_module: queryParams.value.caller_module,
    status: queryParams.value.status,
    start_time: queryParams.value.start_time,
    end_time: queryParams.value.end_time,
    agent_id: queryParams.value.agent_id,
    agent_code: queryParams.value.agent_code,
    skill_id: queryParams.value.skill_id,
  }
  const hasFilter = Object.values(f).some(v => v && v !== '')
  if (!hasFilter) {
    Message.warning('按条件删除需至少设置一个查询条件（如状态=等待中），避免误删全部')
    return
  }
  Modal.warning({
    title: '确认按当前查询条件删除？',
    content: '将删除符合当前查询条件的所有「等待中(pending)」记录（其它状态不受影响）。此操作不可恢复。',
    okText: '确认删除',
    cancelText: '取消',
    okButtonProps: { status: 'danger' },
    onOk: async () => {
      await doDelete({ filter: f })
    },
  })
}

async function doDelete(payload: Record<string, unknown>) {
  deleting.value = true
  try {
    const res = await postAction<{ deleted: number, message?: string }>(
      ApiAiExecution.batchDelete,
      payload,
    )
    if (!res)
      return
    Message.success(res.message || `已删除 ${res.deleted} 条`)
    selectedKeys.value = []
    fetchList()
  }
  finally {
    deleting.value = false
  }
}

// ── 详情抽屉 ──────────────────────────────────
const drawerVisible = ref(false)
const detail = ref<AiExecution | null>(null)

function showDetail(record: AiExecution) {
  detail.value = record
  drawerVisible.value = true
}

function formatJson(jsonStr: string | null): string {
  if (!jsonStr)
    return '-'
  try {
    return JSON.stringify(JSON.parse(jsonStr), null, 2)
  }
  catch {
    return jsonStr
  }
}

function statusColor(status: string) {
  const map: Record<string, string> = { succeeded: 'green', failed: 'red', timeout: 'orangered', running: 'blue', pending: 'gray', cancelled: 'orange' }
  return map[status] || 'gray'
}

function agentLabel(record: AiExecution) {
  return record.agent_name || record.agent_code || record.agent_id || '-'
}

function createdByLabel(record: AiExecution) {
  return record.created_by_name || record.created_by || '-'
}

function fmtNumber(value?: number | null) {
  return value == null ? '-' : value.toLocaleString('zh-CN')
}

function fmtCredits(value?: number | null) {
  if (value == null)
    return '-'
  // 积分通常 0.6~2 之间，保留 4 位小数足够；去掉无意义的尾零
  return value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
}

/** 列表里的「花费」摘要：优先 token，qoder 等按积分计费的显示积分 */
function usageSummary(record: AiExecution) {
  if (record.total_tokens != null && record.total_tokens > 0)
    return `${fmtNumber(record.total_tokens)} tokens`
  if (record.credits != null)
    return `${fmtCredits(record.credits)} 积分`
  return '-'
}

function usageTooltip(record: AiExecution) {
  const parts: string[] = []
  if (record.total_tokens != null) {
    parts.push(`输入 ${fmtNumber(record.input_tokens)}`)
    parts.push(`输出 ${fmtNumber(record.output_tokens)}`)
    parts.push(`合计 ${fmtNumber(record.total_tokens)}`)
  }
  if (record.credits != null)
    parts.push(`积分 ${fmtCredits(record.credits)}`)
  if (record.cost_usd != null && record.cost_usd > 0)
    parts.push(`费用 $${record.cost_usd.toFixed(4)}`)
  if (record.num_turns != null)
    parts.push(`${record.num_turns} 轮`)
  return parts.length > 0 ? parts.join(' / ') : '该 Agent 未上报用量'
}

const FEEDBACK_STATUS_META: Record<string, { label: string, color: string }> = {
  none: { label: '未复盘', color: 'gray' },
  running: { label: '复盘中', color: 'blue' },
  completed: { label: '已复盘', color: 'green' },
  failed: { label: '复盘失败', color: 'red' },
  skipped: { label: '不可复盘', color: 'orange' },
}
function feedbackMeta(status?: string) {
  return FEEDBACK_STATUS_META[status || 'none'] || { label: status || '--', color: 'gray' }
}
function feedbackActionLabel(record: AiExecution) {
  if (record.feedback_status === 'completed')
    return '查看反馈'
  if (record.feedback_status === 'running')
    return '进行中'
  if (record.feedback_status === 'failed' || record.feedback_status === 'skipped')
    return '重试复盘'
  return '复盘'
}

const feedbackModalVisible = ref(false)
const feedbackTarget = ref<AiExecution | null>(null)
const feedbackPreview = ref<AiAgentFeedbackPrompt | null>(null)
const feedbackPrompt = ref('')
const feedbackStarting = ref(false)

async function collectFeedback(record: AiExecution) {
  if (record.caller_module === 'agent_feedback') {
    Message.warning('复盘执行本身不能再复盘')
    return
  }
  if (record.feedback_status === 'running') {
    Message.info('复盘正在进行')
    return
  }
  if (record.feedback_status === 'completed') {
    void router.push({ path: '/ai/agent-feedback', query: { execution_id: record.id } })
    return
  }
  const preview = await getAction<AiAgentFeedbackPrompt>(ApiAiFeedback.prompt, { execution_id: record.id })
  if (!preview)
    return
  feedbackTarget.value = record
  feedbackPreview.value = preview
  feedbackPrompt.value = preview.prompt
  feedbackModalVisible.value = true
}

async function startFeedback() {
  const record = feedbackTarget.value
  if (!record || !feedbackPrompt.value.trim())
    return
  if (feedbackPreview.value && !feedbackPreview.value.can_resume)
    return
  feedbackStarting.value = true
  try {
    const res = await postAction<{ status?: string, message?: string }>(ApiAiFeedback.collect, {
      execution_id: record.id,
      prompt: feedbackPrompt.value,
    })
    if (res === null)
      return
    feedbackModalVisible.value = false
    if (res.status === 'skipped')
      Message.warning(res.message || '该执行不支持恢复会话，已跳过复盘')
    else
      Message.success(res.message || '复盘会话已启动')
    await new Promise(resolve => setTimeout(resolve, 500))
    fetchList()
  }
  finally {
    feedbackStarting.value = false
  }
}

onMounted(async () => {
  const id = typeof route.query.execution_id === 'string' ? route.query.execution_id : ''
  if (!id)
    return
  const record = await getAction<AiExecution>(ApiAiExecution.getById, { id })
  if (record)
    showDetail(record)
})

// ── 表格列 ──────────────────────────────────
const columns = withTableDefaults([
  { title: 'ID', dataIndex: 'id', width: 200 },
  { title: 'Agent', dataIndex: 'agent_code', width: 150, slotName: 'agent' },
  { title: '调用人', dataIndex: 'created_by', width: 110, slotName: 'created_by' },
  { title: '调用模块', dataIndex: 'caller_module', width: 110 },
  { title: '状态', dataIndex: 'status', width: 90, slotName: 'status' },
  { title: 'Token / 积分', dataIndex: 'total_tokens', width: 140, slotName: 'usage' },
  { title: '复盘', dataIndex: 'feedback_status', width: 100, slotName: 'feedback' },
  { title: '耗时(ms)', dataIndex: 'duration_ms', width: 90 },
  { title: 'Exit Code', dataIndex: 'exit_code', width: 80 },
  { title: '创建时间', dataIndex: 'created_at', width: 170, slotName: 'created_at' },
  { title: '操作', dataIndex: 'operations', slotName: 'operations', width: 190, fixed: 'right' as const },
])

// ── 表格高度自适应（表头固定，滚动条落在表格内）──────────────
const tableWrap = ref<HTMLElement>()
const { tableHeight } = useTableAutoHeight(tableWrap)
</script>

<template>
  <div class="ai-execution-log">
    <!-- 统计卡片 -->
    <a-card :bordered="false" class="m-b-8px">
      <a-row :gutter="16">
        <a-col :span="3">
          <a-statistic title="总执行次数" :value="stats.total" />
        </a-col>
        <a-col :span="3">
          <a-statistic title="成功" :value="stats.succeeded" />
        </a-col>
        <a-col :span="3">
          <a-statistic title="失败" :value="stats.failed" />
        </a-col>
        <a-col :span="3">
          <a-statistic title="运行中" :value="stats.running" />
        </a-col>
        <a-col :span="3">
          <a-statistic title="成功率" :value="stats.success_rate" :precision="1" suffix="%" />
        </a-col>
        <a-col :span="3">
          <a-statistic title="平均耗时" :value="Math.round(stats.avg_duration_ms)" suffix="ms" />
        </a-col>
        <a-col :span="3">
          <a-statistic title="Token 合计" :value="stats.total_tokens" />
        </a-col>
        <a-col :span="3">
          <a-statistic title="积分合计" :value="stats.total_credits" :precision="2" />
        </a-col>
      </a-row>
      <div class="usage-note">
        用量仅统计 Agent 主动上报的数据：qoder-cli 按「积分」计费（token 字段为 0）；kiro / 灵基 / dsh 暂不上报。
      </div>
    </a-card>

    <!-- 查询区 -->
    <a-card :bordered="false" class="m-b-8px">
      <a-row :gutter="16" align="center">
        <a-col :span="3">
          <a-input v-model="queryParams.caller_module" placeholder="调用模块" allow-clear @press-enter="handleSearch" />
        </a-col>
        <a-col :span="4">
          <a-select v-model="queryParams.agent_code" placeholder="Agent" allow-clear @change="handleSearch">
            <a-option v-for="item in agentOptions" :key="item.agent_code" :value="item.agent_code">
              {{ item.agent_name || item.agent_code }}
            </a-option>
          </a-select>
        </a-col>
        <a-col :span="3">
          <a-select v-model="queryParams.status" placeholder="状态" allow-clear @change="handleSearch">
            <a-option value="pending">
              等待中
            </a-option>
            <a-option value="running">
              运行中
            </a-option>
            <a-option value="succeeded">
              成功
            </a-option>
            <a-option value="failed">
              失败
            </a-option>
            <a-option value="timeout">
              超时
            </a-option>
            <a-option value="cancelled">
              已取消
            </a-option>
          </a-select>
        </a-col>
        <a-col :span="6">
          <a-range-picker v-model="dateRange" show-time format="YYYY-MM-DD HH:mm:ss" value-format="YYYY-MM-DD HH:mm:ss" @change="handleSearch" />
        </a-col>
        <a-col :span="3">
          <a-button type="primary" @click="handleSearch">
            搜索
          </a-button>
        </a-col>
        <a-col :span="5">
          <a-space>
            <a-button status="danger" :loading="deleting" :disabled="selectedKeys.length === 0" @click="deleteSelected">
              删除选中{{ selectedKeys.length ? `(${selectedKeys.length})` : '' }}
            </a-button>
            <a-button status="danger" :loading="deleting" @click="deleteAllMatching">
              按条件删除等待中
            </a-button>
          </a-space>
        </a-col>
      </a-row>
    </a-card>

    <!-- 表格 -->
    <div ref="tableWrap">
      <a-card :bordered="false">
        <a-table
          v-model:selected-keys="selectedKeys"
          :loading="loading"
          :data="list"
          :columns="columns"
          row-key="id"
          :row-selection="{ type: 'checkbox', showCheckedAll: true }"
          :pagination="{ total, current: queryParams.page_num, pageSize: queryParams.page_size, showTotal: true }"
          column-resizable
          :scroll="{ minWidth: 1200, y: tableHeight }"
          @page-change="handlePageChange"
        >
          <template #status="{ record }">
            <a-tag :color="statusColor(record.status)">
              {{ record.status }}
            </a-tag>
          </template>
          <template #created_by="{ record }">
            <a-tooltip :content="record.created_by || ''" :disabled="!record.created_by || record.created_by === record.created_by_name">
              <span>{{ createdByLabel(record) }}</span>
            </a-tooltip>
          </template>
          <template #agent="{ record }">
            <div class="agent-cell">
              <span class="agent-name">{{ agentLabel(record) }}</span>
              <span v-if="record.agent_code" class="agent-code">{{ record.agent_code }}</span>
            </div>
          </template>
          <template #usage="{ record }">
            <a-tooltip :content="usageTooltip(record)">
              <span :class="{ 'usage-empty': usageSummary(record) === '-' }">{{ usageSummary(record) }}</span>
            </a-tooltip>
          </template>
          <template #feedback="{ record }">
            <a-tooltip :content="record.feedback_error || ''" :disabled="!record.feedback_error">
              <a-tag :color="feedbackMeta(record.feedback_status).color">
                {{ feedbackMeta(record.feedback_status).label }}
              </a-tag>
            </a-tooltip>
          </template>
          <template #created_at="{ record }">
            {{ formatTime(record.created_at) }}
          </template>
          <template #operations="{ record }">
            <a-space>
              <a-button type="text" size="small" @click="showDetail(record)">
                详情
              </a-button>
              <a-button
                v-if="record.status === 'running'"
                type="text"
                size="small"
                status="danger"
                @click="stopExecution(record)"
              >
                停止
              </a-button>
              <a-button
                v-if="record.caller_module !== 'agent_feedback'"
                type="text"
                size="small"
                :disabled="record.feedback_status === 'running'"
                @click="collectFeedback(record)"
              >
                {{ feedbackActionLabel(record) }}
              </a-button>
            </a-space>
          </template>
        </a-table>
      </a-card>
    </div>

    <!-- 复盘提示词弹框 -->
    <a-modal
      v-model:visible="feedbackModalVisible"
      title="发起 Agent 复盘"
      :width="900"
      :mask-closable="false"
      :ok-loading="feedbackStarting"
      :ok-button-props="{ disabled: !feedbackPreview?.can_resume || !feedbackPrompt.trim() }"
      ok-text="开始复盘"
      cancel-text="取消"
      @ok="startFeedback"
    >
      <a-alert
        v-if="feedbackPreview && !feedbackPreview.can_resume"
        type="warning"
        class="m-b-12px"
      >
        {{ feedbackPreview.skip_reason || '该执行不支持恢复会话，无法复盘' }}
      </a-alert>
      <a-alert v-else type="info" class="m-b-12px">
        将恢复原会话执行只读复盘。请保留「输出文件」与 JSON 结构要求，否则平台无法解析反馈。
      </a-alert>
      <a-descriptions :column="2" size="small" class="m-b-8px">
        <a-descriptions-item label="执行 ID">
          {{ feedbackPreview?.execution_id }}
        </a-descriptions-item>
        <a-descriptions-item label="Agent">
          {{ feedbackPreview?.agent_code }}
        </a-descriptions-item>
      </a-descriptions>
      <a-textarea
        v-model="feedbackPrompt"
        :auto-size="{ minRows: 12, maxRows: 24 }"
        :max-length="20000"
        show-word-limit
        :disabled="!feedbackPreview?.can_resume"
        placeholder="复盘提示词"
      />
    </a-modal>

    <!-- 详情抽屉 -->
    <a-drawer v-model:visible="drawerVisible" title="执行详情" :width="680" :footer="false">
      <template v-if="detail">
        <a-descriptions :column="2" bordered size="small" class="m-b-16px">
          <a-descriptions-item label="执行 ID">
            {{ detail.id }}
          </a-descriptions-item>
          <a-descriptions-item label="状态">
            <a-tag :color="statusColor(detail.status)">
              {{ detail.status }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="Agent" :span="2">
            {{ agentLabel(detail) }}
            <span v-if="detail.agent_code" class="detail-muted">（{{ detail.agent_code }}）</span>
          </a-descriptions-item>
          <a-descriptions-item label="调用人">
            {{ createdByLabel(detail) }}
          </a-descriptions-item>
          <a-descriptions-item label="调用模块">
            {{ detail.caller_module }}
          </a-descriptions-item>
          <a-descriptions-item label="调用方 ID">
            {{ detail.caller_id || '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="模型">
            {{ detail.model || '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="轮次">
            {{ detail.num_turns ?? '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="耗时">
            {{ detail.duration_ms ? `${detail.duration_ms}ms` : '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="Exit Code">
            {{ detail.exit_code ?? '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="输入 Token">
            {{ detail.input_tokens == null ? '未上报' : fmtNumber(detail.input_tokens) }}
          </a-descriptions-item>
          <a-descriptions-item label="输出 Token">
            {{ detail.output_tokens == null ? '未上报' : fmtNumber(detail.output_tokens) }}
          </a-descriptions-item>
          <a-descriptions-item label="Token 合计">
            {{ detail.total_tokens == null ? '未上报' : fmtNumber(detail.total_tokens) }}
          </a-descriptions-item>
          <a-descriptions-item label="缓存读取 Token">
            {{ detail.cache_read_input_tokens == null ? '未上报' : fmtNumber(detail.cache_read_input_tokens) }}
          </a-descriptions-item>
          <a-descriptions-item label="积分">
            {{ detail.credits == null ? '未上报' : fmtCredits(detail.credits) }}
          </a-descriptions-item>
          <a-descriptions-item label="费用(USD)">
            {{ detail.cost_usd == null ? '未上报' : `$${detail.cost_usd.toFixed(4)}` }}
          </a-descriptions-item>
          <a-descriptions-item label="工作目录" :span="2">
            {{ detail.work_dir || '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="Session ID" :span="2">
            {{ detail.session_id || '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="复盘状态">
            <a-tag :color="feedbackMeta(detail.feedback_status).color">
              {{ feedbackMeta(detail.feedback_status).label }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="创建时间">
            {{ formatTime(detail.created_at) }}
          </a-descriptions-item>
          <a-descriptions-item label="完成时间">
            {{ formatTime(detail.finished_at) }}
          </a-descriptions-item>
          <a-descriptions-item v-if="detail.feedback_error" label="复盘说明" :span="2">
            <span class="error-text">{{ detail.feedback_error }}</span>
          </a-descriptions-item>
        </a-descriptions>

        <a-space class="m-b-12px">
          <a-button
            v-if="detail.caller_module !== 'agent_feedback'"
            type="primary"
            size="small"
            :disabled="detail.feedback_status === 'running'"
            @click="collectFeedback(detail)"
          >
            {{ feedbackActionLabel(detail) }}
          </a-button>
        </a-space>

        <a-collapse :default-active-key="['prompt', 'output']">
          <a-collapse-item key="prompt" header="渲染后的 Prompt">
            <pre class="detail-pre">{{ detail.rendered_prompt || '-' }}</pre>
          </a-collapse-item>
          <a-collapse-item key="command" header="执行命令">
            <pre class="detail-pre">{{ detail.raw_command || '-' }}</pre>
          </a-collapse-item>
          <a-collapse-item key="output" header="输出结果 (JSON)">
            <pre class="detail-pre">{{ formatJson(detail.output_json) }}</pre>
          </a-collapse-item>
          <a-collapse-item key="files" header="产出文件">
            <pre class="detail-pre">{{ formatJson(detail.output_files_json) }}</pre>
          </a-collapse-item>
          <a-collapse-item v-if="detail.error_message" key="error" header="错误信息">
            <pre class="detail-pre error-text">{{ detail.error_message }}</pre>
          </a-collapse-item>
        </a-collapse>
      </template>
    </a-drawer>
  </div>
</template>

<style scoped>
.ai-execution-log { padding: 0; }
.agent-cell { display: flex; flex-direction: column; line-height: 1.3; }
.agent-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.agent-code { color: var(--color-text-3); font-size: 12px; }
.usage-empty { color: var(--color-text-3); }
.usage-note { margin-top: 8px; color: var(--color-text-3); font-size: 12px; }
.detail-muted { color: var(--color-text-3); }
.detail-pre { max-height: 300px; overflow: auto; font-size: 12px; white-space: pre-wrap; word-break: break-all; background: var(--color-fill-1); padding: 12px; border-radius: 4px; }
.error-text { color: rgb(var(--red-6)); }
</style>
