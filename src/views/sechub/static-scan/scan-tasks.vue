<script setup lang="ts">
import type { AiAgent, AiListResult } from '@/api/aiApis'
import type { ModuleWithRepository } from '@/types/static-scan'
import type { PrescanTaskRecordRow, PrescanTaskRow, PrescanTaskSavePayload, PrescanTaskTriggerResponse } from '@/types/static-scan-task'
import { Message, Modal } from '@arco-design/web-vue'
import { computed, reactive, ref, watch } from 'vue'
import { ApiAiAgent } from '@/api/aiApis'
import { ApiSecModuleRepository, ApiSecPrescan } from '@/api/sechubApis'
import { formatTime, postAction, useGet, useTableAutoHeight, withTableDefaults } from '@/hooks'

defineOptions({ name: 'scan-tasks' })

// ═══════════════════════════════════════════════════════════
//  任务列表
// ═══════════════════════════════════════════════════════════
const {
  data: listRaw,
  isFetching: listLoading,
  execute: loadList,
} = useGet<PrescanTaskRow[]>(ApiSecPrescan.tasks, {}, { immediate: true })
const rows = computed(() => listRaw.value ?? [])

// ═══════════════════════════════════════════════════════════
//  代码仓库选项（从 listWithModule 拉取）
// ═══════════════════════════════════════════════════════════
const { data: repoListRaw } = useGet<ModuleWithRepository[]>(
  ApiSecModuleRepository.listWithModule,
  {},
  { immediate: true },
)
const repoOptions = computed(() => {
  const list = repoListRaw.value ?? []
  return list.map(r => ({
    value: r.repository_id,
    label: `${r.repository_name}（${r.repository_code}）`,
  }))
})

// ═══════════════════════════════════════════════════════════
//  AI Agent 列表 → 模型下拉选项
// ═══════════════════════════════════════════════════════════
const { data: agentListRaw } = useGet<AiListResult<AiAgent>>(
  ApiAiAgent.getList,
  { page_size: 100, status: 'active' },
  { immediate: true },
)
const allModelOptions = computed<string[]>(() => {
  const agents = agentListRaw.value?.list ?? []
  const modelSet = new Set<string>()
  for (const agent of agents) {
    if (!agent.supported_models_json)
      continue
    try {
      const models = JSON.parse(agent.supported_models_json) as string[]
      for (const m of models) modelSet.add(m)
    }
    catch {
      // 忽略解析失败的 Agent
    }
  }
  return Array.from(modelSet)
})

/** Agent 下拉选项（只列启用中的） */
const agentOptions = computed(() => (agentListRaw.value?.list ?? []).map(a => ({
  code: a.agent_code,
  label: `${a.agent_name}（${a.agent_code}）`,
})))

// ═══════════════════════════════════════════════════════════
//  工具函数
// ═══════════════════════════════════════════════════════════

/** 格式化时间，解析失败回退原值 */
/** 扫描策略标签 */
function scanModeLabel(mode: string): string {
  return mode === 'diff' ? '增量' : '全量'
}

/** AI 模式标签 */
function aiModeLabel(mode: string): string {
  return mode === 'agent' ? '自主审计' : '平台编排'
}

/**
 * 某行未指定 Agent 时，执行时实际会用的默认 Agent。
 * 与后端兜底保持一致：batch → qoder-cli，agent → qoder-cli-scan。
 */
function rowFallbackAgent(record: { ai_mode?: string | null }): string {
  return record.ai_mode === 'agent' ? 'qoder-cli-scan' : 'qoder-cli'
}

/** 领域字符串转展示标签列表 */
function domainLabels(domains: string | null | undefined): string[] {
  if (!domains)
    return []
  return domains.split(',').map((d) => {
    const m: Record<string, string> = { security: '安全', performance: '性能' }
    return m[d.trim()] ?? d.trim()
  }).filter(Boolean)
}

// ═══════════════════════════════════════════════════════════
//  新增/编辑弹窗
// ═══════════════════════════════════════════════════════════
const modalVisible = ref(false)
const isEdit = ref(false)
const modalLoading = ref(false)

/** 搜索词过滤仓库选项 */
const repoSearchKeyword = ref('')

/** cron 基础格式校验：按空格分段必须是 6 段，且非空 */
function validateCron(expr: string): boolean {
  if (!expr.trim())
    return false
  const parts = expr.trim().split(/\s+/)
  return parts.length === 6
}

const form = reactive<{
  id: string
  name: string
  repository_ids: string[]
  domains: string[]
  scan_mode: string
  cron_expression: string
  schedule_enabled: boolean
  concurrency: number
  auto_confirm: boolean
  ai_mode: string
  ai_model: string
  ai_agent_code: string
  status: boolean
}>({
  id: '',
  name: '',
  repository_ids: [],
  domains: [],
  scan_mode: 'full',
  cron_expression: '',
  schedule_enabled: true,
  concurrency: 2,
  auto_confirm: true,
  ai_mode: 'batch',
  ai_model: '',
  ai_agent_code: '',
  status: true,
})

/**
 * 对找不到名称的仓库 id，显示可读的降级文案，避免直接暴露裸十六进制。
 * 例如：未知仓库（a6c55651…）
 */
function unknownRepoLabel(id: string): string {
  return `未知仓库（${id.slice(0, 8)}…）`
}

/**
 * 已选中的仓库选项（始终保留在候选列表里）。
 * 对 repoOptions 里找不到的 id（例如仓库已被删除），构造降级文案选项，
 * 避免 Arco 回退显示裸十六进制 value。
 */
const selectedRepoOptions = computed(() => {
  const ids = form.repository_ids
  if (ids.length === 0)
    return []
  return ids.map((id) => {
    const found = repoOptions.value.find(o => o.value === id)
    return found ?? { value: id, label: unknownRepoLabel(id) }
  })
})

/**
 * 最终呈现给 a-select 的候选列表：
 * 把已选中的项与关键字过滤结果合并去重，确保搜索时已选项的中文名不丢失。
 * 参考同目录 repositories.vue 中 moduleSelectOptions 的做法。
 */
const filteredRepoOptions = computed(() => {
  const kw = repoSearchKeyword.value.trim().toLowerCase()
  const filtered = kw
    ? repoOptions.value.filter(o => o.label.toLowerCase().includes(kw))
    : repoOptions.value
  // 将已选中但不在过滤结果里的项补充到列表头部
  const filteredSet = new Set(filtered.map(o => o.value))
  const extras = selectedRepoOptions.value.filter(o => !filteredSet.has(o.value))
  return [...extras, ...filtered]
})

/**
 * 未指定 Agent 时后端的兜底取值，随 AI 模式变化：
 *   平台编排(batch) → qoder-cli        （static_prescan.rs 的 confirm 流程默认值）
 *   自主审计(agent) → qoder-cli-scan   （scan_agent.rs 触发自主审计的默认值）
 * 这里只用于给用户展示"留空会用哪个"，不参与提交。
 */
const fallbackAgentCode = computed(() => (form.ai_mode === 'agent' ? 'qoder-cli-scan' : 'qoder-cli'))

/**
 * 模型下拉范围：选了 Agent 就只列该 Agent 支持的模型，避免配出该 Agent 跑不了的组合；
 * 没选 Agent（用兜底）时列全部 Agent 的模型并集。
 */
const modelOptions = computed<string[]>(() => {
  const code = form.ai_agent_code.trim()
  if (!code)
    return allModelOptions.value
  const agent = (agentListRaw.value?.list ?? []).find(a => a.agent_code === code)
  if (!agent?.supported_models_json)
    return allModelOptions.value
  try {
    return JSON.parse(agent.supported_models_json) as string[]
  }
  catch {
    return allModelOptions.value
  }
})

/** 切换 Agent 后，若已选模型不在新 Agent 的支持列表内则清空，避免提交无效组合 */
function onAgentChange() {
  const current = form.ai_model.trim()
  if (current && !modelOptions.value.includes(current))
    form.ai_model = ''
}

function resetForm() {
  form.id = ''
  form.name = ''
  form.repository_ids = []
  form.domains = []
  form.scan_mode = 'full'
  form.cron_expression = ''
  form.schedule_enabled = true
  form.concurrency = 2
  form.auto_confirm = true
  form.ai_mode = 'batch'
  form.ai_model = ''
  form.ai_agent_code = ''
  form.status = true
}

function openAddModal() {
  isEdit.value = false
  resetForm()
  repoSearchKeyword.value = ''
  modalVisible.value = true
}

function openEditModal(record: PrescanTaskRow) {
  isEdit.value = true
  form.id = record.id
  form.name = record.name
  form.repository_ids = record.repository_ids ? [...record.repository_ids] : []
  // 将逗号分隔的 domains 还原为数组
  form.domains = record.domains ? record.domains.split(',').map(d => d.trim()).filter(Boolean) : []
  form.scan_mode = record.scan_mode || 'full'
  form.cron_expression = record.cron_expression ?? ''
  form.schedule_enabled = record.schedule_enabled === '1'
  form.concurrency = record.concurrency ?? 2
  form.auto_confirm = record.auto_confirm === '1'
  form.ai_mode = record.ai_mode || 'batch'
  form.ai_model = record.ai_model ?? ''
  form.ai_agent_code = record.ai_agent_code ?? ''
  form.status = record.status === '1'
  repoSearchKeyword.value = ''
  modalVisible.value = true
}

/** 构造提交体 */
function buildPayload(): PrescanTaskSavePayload {
  return {
    ...(isEdit.value ? { id: form.id } : {}),
    name: form.name.trim(),
    repository_ids: form.repository_ids,
    domains: form.domains.length > 0 ? form.domains.join(',') : null,
    scan_mode: form.scan_mode,
    cron_expression: form.cron_expression.trim() || null,
    schedule_enabled: form.schedule_enabled ? '1' : '0',
    concurrency: form.concurrency,
    auto_confirm: form.auto_confirm ? '1' : '0',
    ai_mode: form.ai_mode,
    ai_model: form.ai_model.trim() || null,
    ai_agent_code: form.ai_agent_code.trim() || null,
    status: form.status ? '1' : '0',
  }
}

const savePayload = ref<PrescanTaskSavePayload>({
  name: '',
  repository_ids: [],
  scan_mode: 'full',
  schedule_enabled: '1',
  concurrency: 2,
  auto_confirm: '1',
  ai_mode: 'batch',
  status: '1',
})

async function handleSave() {
  // 前端校验
  if (!form.name.trim()) {
    Message.warning('请填写任务名称')
    return
  }
  if (form.repository_ids.length === 0) {
    Message.warning('请选择至少一个代码仓库')
    return
  }
  if (!validateCron(form.cron_expression)) {
    Message.warning('cron 表达式格式不正确，须为 6 段（含秒），例如：0 0 2 * * *')
    return
  }
  modalLoading.value = true
  try {
    savePayload.value = buildPayload()
    const res = await postAction(
      isEdit.value ? ApiSecPrescan.taskEdit : ApiSecPrescan.taskAdd,
      savePayload.value,
    )
    if (!res)
      return
    Message.success(isEdit.value ? '已保存' : '任务创建成功')
    modalVisible.value = false
    await loadList()
  }
  finally {
    modalLoading.value = false
  }
}

// ═══════════════════════════════════════════════════════════
//  删除
// ═══════════════════════════════════════════════════════════
const deletingId = ref('')

function handleDelete(record: PrescanTaskRow) {
  Modal.warning({
    title: '确认删除定时扫描任务',
    content: `确定要删除任务「${record.name}」吗？\n\n`
      + `删除后该任务及其执行记录将被移除，不会影响扫描运行那边的数据（预扫描运行、候选列表与报告均保留）。此操作不可恢复。`,
    hideCancel: false,
    okText: '删除',
    okButtonProps: { status: 'danger' },
    onOk: async () => {
      deletingId.value = record.id
      try {
        const res = await postAction<string>(ApiSecPrescan.taskDelete, { id: record.id })
        if (!res)
          return
        // 后端 delete_task 软删，返回被删除的任务 id 字符串
        const msg = String(res)
        Message.success(msg.includes(record.id) ? `任务「${record.name}」已删除` : msg)
        await loadList()
      }
      finally {
        deletingId.value = ''
      }
    },
  })
}

// ═══════════════════════════════════════════════════════════
//  立即执行（触发）
// ═══════════════════════════════════════════════════════════
const triggeringId = ref('')

async function handleTrigger(record: PrescanTaskRow) {
  triggeringId.value = record.id
  try {
    const res = await postAction<PrescanTaskTriggerResponse>(ApiSecPrescan.taskTrigger, { id: record.id })
    if (!res)
      return
    // 后端对每个成功处理的仓库都会返回一个 run_id；代码未变更的仓库会复用既有
    // succeeded run（记录里标记为「已跳过」），同样计入返回值。空数组说明全部失败。
    const runIds = Array.isArray(res) ? res : []
    if (runIds.length === 0) {
      Message.warning('未触发任何仓库，请在执行记录中查看失败原因')
      return
    }
    Message.success(`已触发 ${runIds.length} 个仓库；代码未变更的仓库会复用既有运行，详情见执行记录`)
  }
  finally {
    triggeringId.value = ''
  }
}

// ═══════════════════════════════════════════════════════════
//  启用开关（inline 直接调 taskEdit）
// ═══════════════════════════════════════════════════════════
const togglingId = ref('')

async function handleScheduleToggle(record: PrescanTaskRow, newVal: boolean) {
  // 保存原值，失败时回滚
  const originalVal = record.schedule_enabled
  // 乐观更新
  record.schedule_enabled = newVal ? '1' : '0'
  togglingId.value = record.id
  const togglePayload: PrescanTaskSavePayload = {
    id: record.id,
    name: record.name,
    repository_ids: record.repository_ids,
    scan_mode: record.scan_mode,
    schedule_enabled: newVal ? '1' : '0',
    concurrency: record.concurrency,
    auto_confirm: record.auto_confirm,
    ai_mode: record.ai_mode,
    status: record.status,
  }
  try {
    const res = await postAction(ApiSecPrescan.taskEdit, togglePayload)
    if (!res) {
      // 回滚 UI（拦截器已弹出后端具体错误，这里不再重复提示）
      record.schedule_enabled = originalVal
    }
  }
  finally {
    togglingId.value = ''
  }
}

// ═══════════════════════════════════════════════════════════
//  执行记录抽屉
// ═══════════════════════════════════════════════════════════
const recordDrawerVisible = ref(false)
const recordTaskId = ref('')
const recordTaskName = ref('')

const recordQuery = ref({ task_id: '' })
const {
  isFetching: recordLoading,
  data: recordRaw,
  execute: loadRecords,
} = useGet<PrescanTaskRecordRow[]>(ApiSecPrescan.taskRecords, recordQuery, { immediate: false })
const records = computed(() => recordRaw.value ?? [])

async function openRecordDrawer(record: PrescanTaskRow) {
  recordTaskId.value = record.id
  recordTaskName.value = record.name
  recordDrawerVisible.value = true
  // 每次打开时重置查询参数，useGet 会以最新的 recordQuery 发请求
  recordQuery.value = { task_id: record.id }
  await loadRecords()
}

// 竞态防护：快速切换任务时，watch 到 recordTaskId 变化重新发请求；
// useGet 每次 execute 都覆盖 data.value，旧响应不会污染新选择。
watch(recordTaskId, (newId) => {
  if (!newId || !recordDrawerVisible.value)
    return
  recordQuery.value = { task_id: newId }
  void loadRecords()
})

const recordColumns = [
  { title: '仓库', dataIndex: 'repository_name', width: 140, ellipsis: true, tooltip: true },
  { title: '分支', dataIndex: 'branch', width: 100, ellipsis: true, tooltip: true },
  { title: 'Commit', dataIndex: 'commit_sha', slotName: 'commit_sha', width: 100 },
  { title: '状态', dataIndex: 'status', slotName: 'record_status', width: 90 },
  { title: 'AI 状态', dataIndex: 'ai_status', slotName: 'ai_status', width: 90 },
  { title: '候选数', dataIndex: 'candidate_count', width: 80, align: 'right' as const },
  { title: '已确认', dataIndex: 'confirmed_count', width: 80, align: 'right' as const },
  { title: '跳过', dataIndex: 'idempotent', slotName: 'idempotent', width: 140 },
  { title: '错误信息', dataIndex: 'error_message', width: 180, ellipsis: true, tooltip: true },
  { title: '开始时间', dataIndex: 'started_at', slotName: 'started_at', width: 160 },
  { title: '结束时间', dataIndex: 'finished_at', slotName: 'finished_at', width: 160 },
]

// ═══════════════════════════════════════════════════════════
//  列表表格列定义
// ═══════════════════════════════════════════════════════════
// 表格高度自适应：滚动条出现在表格内、表头固定
const tableWrap = ref<HTMLElement>()
const { tableHeight } = useTableAutoHeight(tableWrap)

const columns = withTableDefaults([
  { title: '任务名称', dataIndex: 'name', width: 160, ellipsis: true, tooltip: true },
  { title: '代码仓库', dataIndex: 'repository_names', slotName: 'repos', width: 200 },
  { title: '领域', dataIndex: 'domains', slotName: 'domains', width: 100 },
  { title: '扫描策略', dataIndex: 'scan_mode', slotName: 'scan_mode', width: 80 },
  { title: 'Cron', dataIndex: 'cron_expression', width: 140, ellipsis: true, tooltip: true },
  { title: '下次执行', dataIndex: 'next_run_at', slotName: 'next_run_at', width: 160 },
  { title: '上次执行', dataIndex: 'last_scheduled_at', slotName: 'last_scheduled_at', width: 160 },
  { title: '并发数', dataIndex: 'concurrency', width: 70, align: 'right' as const },
  { title: 'AI 模式', dataIndex: 'ai_mode', slotName: 'ai_mode', width: 90 },
  { title: 'Agent', dataIndex: 'ai_agent_code', slotName: 'ai_agent_code', width: 130, ellipsis: true, tooltip: true },
  { title: '模型', dataIndex: 'ai_model', width: 120, ellipsis: true, tooltip: true },
  { title: '自动确认', dataIndex: 'auto_confirm', slotName: 'auto_confirm', width: 80 },
  { title: '启用调度', dataIndex: 'schedule_enabled', slotName: 'schedule_enabled', width: 90 },
  { title: '状态', dataIndex: 'status', slotName: 'status', width: 70 },
  { title: '操作', slotName: 'operations', width: 220, fixed: 'right' as const },
])
</script>

<template>
  <div class="static-scan-tasks">
    <!-- 工具栏 -->
    <a-card :bordered="false" class="m-b-8px">
      <a-space wrap>
        <a-button type="primary" @click="openAddModal">
          <template #icon>
            <icon-plus />
          </template>
          新增任务
        </a-button>
        <a-button :loading="listLoading" @click="() => loadList()">
          <template #icon>
            <icon-refresh />
          </template>
          刷新
        </a-button>
        <a-typography-text type="secondary">
          共 {{ rows.length }} 条
        </a-typography-text>
      </a-space>
    </a-card>

    <!-- 任务列表 -->
    <div ref="tableWrap">
      <a-card :bordered="false">
        <a-table
          column-resizable
          :data="rows"
          :columns="columns"
          :loading="listLoading"
          :pagination="false"
          row-key="id"
          :scroll="{ x: 1800, y: tableHeight }"
          size="small"
        >
          <!-- 代码仓库：多 tag + 超出折叠 tooltip -->
          <template #repos="{ record }">
            <template v-if="record.repository_names && record.repository_names.length > 0">
              <a-tooltip
                v-if="record.repository_names.length > 2"
                :content="record.repository_names.join('\n')"
              >
                <a-space wrap size="mini">
                  <a-tag
                    v-for="name in record.repository_names.slice(0, 2)"
                    :key="name"
                    size="small"
                    color="arcoblue"
                  >
                    {{ name }}
                  </a-tag>
                  <a-tag size="small" color="gray">
                    +{{ record.repository_names.length - 2 }}
                  </a-tag>
                </a-space>
              </a-tooltip>
              <a-space v-else wrap size="mini">
                <a-tag
                  v-for="name in record.repository_names"
                  :key="name"
                  size="small"
                  color="arcoblue"
                >
                  {{ name }}
                </a-tag>
              </a-space>
            </template>
            <span v-else class="placeholder">-</span>
          </template>

          <!-- 领域 -->
          <template #domains="{ record }">
            <a-space v-if="domainLabels(record.domains).length > 0" wrap size="mini">
              <a-tag
                v-for="label in domainLabels(record.domains)"
                :key="label"
                size="small"
                color="purple"
              >
                {{ label }}
              </a-tag>
            </a-space>
            <span v-else class="placeholder">全部</span>
          </template>

          <!-- 扫描策略 -->
          <template #scan_mode="{ record }">
            <a-tag
              :color="record.scan_mode === 'diff' ? 'orange' : 'blue'"
              size="small"
            >
              {{ scanModeLabel(record.scan_mode) }}
            </a-tag>
          </template>

          <!-- 下次执行 -->
          <template #next_run_at="{ record }">
            {{ formatTime(record.next_run_at) }}
          </template>

          <!-- 上次执行 -->
          <template #last_scheduled_at="{ record }">
            {{ formatTime(record.last_scheduled_at) }}
          </template>

          <!-- AI 模式 -->
          <template #ai_mode="{ record }">
            <a-tag
              :color="record.ai_mode === 'agent' ? 'green' : 'arcoblue'"
              size="small"
            >
              {{ aiModeLabel(record.ai_mode) }}
            </a-tag>
          </template>

          <!-- Agent：未指定时显示后端按模式兜底的实际 Agent，避免让人以为"没配就不跑" -->
          <template #ai_agent_code="{ record }">
            <span v-if="record.ai_agent_code">{{ record.ai_agent_code }}</span>
            <a-tooltip v-else content="任务未指定 Agent，执行时按 AI 模式使用默认 Agent">
              <span class="agent-default">{{ rowFallbackAgent(record) }}（默认）</span>
            </a-tooltip>
          </template>

          <!-- 自动确认 -->
          <template #auto_confirm="{ record }">
            <a-tag :color="record.auto_confirm === '1' ? 'green' : 'gray'" size="small">
              {{ record.auto_confirm === '1' ? '自动' : '手动' }}
            </a-tag>
          </template>

          <!-- 启用调度开关 -->
          <template #schedule_enabled="{ record }">
            <a-switch
              :model-value="record.schedule_enabled === '1'"
              :loading="togglingId === record.id"
              size="small"
              @change="(v: string | number | boolean) => handleScheduleToggle(record, Boolean(v))"
            />
          </template>

          <!-- 状态 -->
          <template #status="{ record }">
            <a-tag :color="record.status === '1' ? 'green' : 'gray'" size="small">
              {{ record.status === '1' ? '启用' : '停用' }}
            </a-tag>
          </template>

          <!-- 操作列 -->
          <template #operations="{ record }">
            <a-space>
              <a-button type="text" size="small" @click="openEditModal(record)">
                编辑
              </a-button>
              <a-button
                type="text"
                size="small"
                :loading="triggeringId === record.id"
                @click="handleTrigger(record)"
              >
                立即执行
              </a-button>
              <a-button
                type="text"
                size="small"
                @click="openRecordDrawer(record)"
              >
                执行记录
              </a-button>
              <a-button
                type="text"
                size="small"
                status="danger"
                :loading="deletingId === record.id"
                @click="handleDelete(record)"
              >
                删除
              </a-button>
            </a-space>
          </template>
        </a-table>
      </a-card>
    </div>

    <!-- ═══ 新增/编辑弹窗 ═══ -->
    <a-modal
      v-model:visible="modalVisible"
      :title="isEdit ? '编辑任务' : '新增任务'"
      :width="640"
      :ok-loading="modalLoading"
      @ok="handleSave"
      @cancel="modalVisible = false"
    >
      <a-form :model="form" layout="vertical">
        <!-- 任务名称 -->
        <a-form-item label="任务名称" required>
          <a-input v-model="form.name" placeholder="请输入任务名称" allow-clear />
        </a-form-item>

        <!-- 代码仓库 -->
        <a-form-item label="代码仓库" required>
          <a-select
            v-model="form.repository_ids"
            multiple
            placeholder="选择代码仓库（支持搜索）"
            allow-search
            :filter-option="false"
            style="width: 100%"
            @search="(kw: string) => { repoSearchKeyword = kw }"
          >
            <a-option
              v-for="opt in filteredRepoOptions"
              :key="opt.value"
              :value="opt.value"
              :label="opt.label"
            />
            <template #empty>
              <div style="padding: 8px; color: var(--color-text-3)">
                暂无匹配仓库
              </div>
            </template>
          </a-select>
        </a-form-item>

        <!-- 领域 -->
        <a-form-item label="领域">
          <a-select
            v-model="form.domains"
            multiple
            placeholder="不选表示全部领域"
            allow-clear
            style="width: 100%"
          >
            <a-option value="security">
              安全
            </a-option>
            <a-option value="performance">
              性能
            </a-option>
          </a-select>
          <template #extra>
            不选表示扫描全部领域
          </template>
        </a-form-item>

        <a-row :gutter="16">
          <!-- 扫描策略 -->
          <a-col :span="12">
            <a-form-item label="扫描策略">
              <a-radio-group v-model="form.scan_mode">
                <a-radio value="full">
                  全量
                </a-radio>
                <a-radio value="diff">
                  增量
                </a-radio>
              </a-radio-group>
            </a-form-item>
          </a-col>
          <!-- 并发数 -->
          <a-col :span="12">
            <a-form-item label="并发数">
              <a-input-number
                v-model="form.concurrency"
                :min="1"
                :max="10"
                style="width: 100%"
              />
              <template #extra>
                调大后会同时扫描多个仓库，占用更多 CPU 与 AI 并发额度
              </template>
            </a-form-item>
          </a-col>
        </a-row>

        <!-- cron 表达式 -->
        <a-form-item label="Cron 表达式" required>
          <a-input
            v-model="form.cron_expression"
            placeholder="6 段含秒，例：0 0 2 * * *"
            allow-clear
          />
          <template #extra>
            格式为 6 段（秒 分 时 日 月 周），示例：
            每天凌晨 2 点 <code>0 0 2 * * *</code>，
            每小时 <code>0 0 * * * *</code>，
            每 30 分钟 <code>0 */30 * * * *</code>。
            真正合法性由后端校验。
          </template>
        </a-form-item>

        <a-row :gutter="16">
          <!-- 自动 AI 确认 -->
          <a-col :span="8">
            <a-form-item label="自动 AI 确认">
              <a-switch v-model="form.auto_confirm" />
            </a-form-item>
          </a-col>
          <!-- 启用调度 -->
          <a-col :span="8">
            <a-form-item label="启用调度">
              <a-switch v-model="form.schedule_enabled" />
            </a-form-item>
          </a-col>
          <!-- 任务状态 -->
          <a-col :span="8">
            <a-form-item label="任务状态">
              <a-switch
                v-model="form.status"
                checked-text="启用"
                unchecked-text="停用"
              />
            </a-form-item>
          </a-col>
        </a-row>

        <!-- AI 模式 -->
        <a-form-item label="AI 模式">
          <a-radio-group v-model="form.ai_mode">
            <a-radio value="batch">
              平台编排（batch）
            </a-radio>
            <a-radio value="agent">
              自主审计（agent）
            </a-radio>
          </a-radio-group>
        </a-form-item>

        <!-- Agent -->
        <a-form-item label="Agent">
          <a-select
            v-model="form.ai_agent_code"
            placeholder="留空表示按 AI 模式使用默认 Agent"
            allow-clear
            allow-search
            style="width: 100%"
            @change="onAgentChange"
          >
            <a-option v-for="a in agentOptions" :key="a.code" :value="a.code">
              {{ a.label }}
            </a-option>
          </a-select>
          <template #extra>
            留空则使用默认 Agent：当前模式下为 <strong>{{ fallbackAgentCode }}</strong>。
            选定 Agent 后，下方模型下拉只列该 Agent 支持的模型。
          </template>
        </a-form-item>

        <!-- 模型 -->
        <a-form-item label="模型">
          <a-select
            v-model="form.ai_model"
            placeholder="留空表示使用 Agent 默认模型"
            allow-clear
            allow-search
            style="width: 100%"
          >
            <a-option v-for="m in modelOptions" :key="m" :value="m">
              {{ m }}
            </a-option>
          </a-select>
          <template #extra>
            留空表示使用 Agent 的默认模型
          </template>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- ═══ 执行记录抽屉 ═══ -->
    <a-drawer
      v-model:visible="recordDrawerVisible"
      :title="`执行记录 — ${recordTaskName}`"
      :width="1000"
      unmount-on-close
    >
      <div class="m-b-8px">
        <a-button
          size="small"
          :loading="recordLoading"
          @click="() => { recordQuery = { task_id: recordTaskId }; loadRecords() }"
        >
          <template #icon>
            <icon-refresh />
          </template>
          刷新
        </a-button>
      </div>

      <a-table
        :data="records"
        :columns="recordColumns"
        :loading="recordLoading"
        :pagination="false"
        row-key="id"
        :scroll="{ x: 1200 }"
        size="small"
      >
        <!-- commit 短 SHA -->
        <template #commit_sha="{ record }">
          <a-tooltip :content="record.commit_sha ?? '-'">
            <span class="mono-text">{{ record.commit_sha ? record.commit_sha.slice(0, 8) : '-' }}</span>
          </a-tooltip>
        </template>

        <!-- 状态 -->
        <template #record_status="{ record }">
          <a-tag
            :color="record.status === 'succeeded' ? 'green' : record.status === 'failed' ? 'red' : record.status === 'running' ? 'blue' : 'gray'"
            size="small"
          >
            {{ record.status ?? '-' }}
          </a-tag>
        </template>

        <!-- AI 状态 -->
        <template #ai_status="{ record }">
          <span v-if="record.ai_status">
            <a-tag
              :color="record.ai_status === 'succeeded' ? 'green' : record.ai_status === 'failed' ? 'red' : record.ai_status === 'running' ? 'blue' : 'gray'"
              size="small"
            >
              {{ record.ai_status }}
            </a-tag>
          </span>
          <span v-else class="placeholder">-</span>
        </template>

        <!-- 幂等跳过 -->
        <template #idempotent="{ record }">
          <span v-if="record.idempotent === '1'" class="skipped-hint">代码未变更，已跳过</span>
          <span v-else>-</span>
        </template>

        <!-- 开始时间 -->
        <template #started_at="{ record }">
          {{ formatTime(record.started_at) }}
        </template>

        <!-- 结束时间 -->
        <template #finished_at="{ record }">
          {{ formatTime(record.finished_at) }}
        </template>
      </a-table>
    </a-drawer>
  </div>
</template>

<style scoped>
.static-scan-tasks {
  padding: 16px;
}

.placeholder {
  color: var(--color-text-3);
}

.mono-text {
  font-family: monospace;
  font-size: 12px;
}

.skipped-hint {
  color: var(--color-text-3);
  font-size: 12px;
}
</style>
