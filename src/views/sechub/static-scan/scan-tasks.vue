<script setup lang="ts">
import type { AiAgent, AiListResult } from '@/api/aiApis'
import type { ModuleWithRepository } from '@/types/static-scan'
import type { PrescanTaskRecordRow, PrescanTaskRow, PrescanTaskSavePayload, PrescanTaskTriggerResponse } from '@/types/static-scan-task'
import { Message, Modal } from '@arco-design/web-vue'
import { computed, reactive, ref, watch } from 'vue'
import { ApiAiAgent } from '@/api/aiApis'
import { ApiSecModuleRepository, ApiSecPrescan } from '@/api/sechubApis'
import { formatTime, postAction, useGet, useTableAutoHeight, withTableDefaults } from '@/hooks'
import { validateCron } from '@/utils/cron'
import ScanModeTip from './components/ScanModeTip.vue'

// 组件名必须与路由 name（= sys_menu.path）一致，keep-alive :include 按它对上缓存
// （见 components/layout/app-main.vue 的注释）。lint 的 PascalCase 提示只是警告，
// 改名却会让页签缓存失效，所以此处保持 kebab-case。
// eslint-disable-next-line vue/component-definition-name-casing
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
//  扫描范围：按项目组 / 业务领域 / 产品领域（与看板左树同口径）
// ═══════════════════════════════════════════════════════════
type ScopeType = 'repository' | 'project_group' | 'business_area' | 'product_domain'

const SCOPE_TYPE_OPTIONS: { value: ScopeType, label: string }[] = [
  { value: 'repository', label: '按代码仓库' },
  { value: 'project_group', label: '按项目组' },
  { value: 'business_area', label: '按业务领域' },
  { value: 'product_domain', label: '按产品领域' },
]

/** 启用绑定的仓库行（后端触发时也只解析 scan_enabled='1' 的绑定） */
const scopedRepoRows = computed(() => (repoListRaw.value ?? []).filter(row => row.scan_enabled))

/** 范围目标下拉：项目组用 id，业务/产品领域用名称；label 带仓库数防呆 */
function buildScopeTargets(pick: (row: ModuleWithRepository) => string | undefined | null) {
  const groups = new Map<string, { label: string, repoIds: Set<string> }>()
  for (const row of scopedRepoRows.value) {
    const value = (pick(row) ?? '').trim()
    if (!value)
      continue
    const entry = groups.get(value) ?? { label: value, repoIds: new Set<string>() }
    entry.repoIds.add(row.repository_id)
    groups.set(value, entry)
  }
  return [...groups.entries()]
    .map(([value, entry]) => ({ value, label: `${entry.label}（${entry.repoIds.size} 个仓库）`, count: entry.repoIds.size }))
    .sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'))
}

const projectGroupTargets = computed(() => {
  const map = new Map<string, { label: string, repoIds: Set<string> }>()
  for (const row of scopedRepoRows.value) {
    const id = (row.project_group_id ?? '').trim()
    if (!id)
      continue
    const entry = map.get(id) ?? { label: row.project_group_name || id, repoIds: new Set<string>() }
    entry.repoIds.add(row.repository_id)
    map.set(id, entry)
  }
  return [...map.entries()]
    .map(([value, entry]) => ({ value, label: `${entry.label}（${entry.repoIds.size} 个仓库）`, count: entry.repoIds.size }))
    .sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'))
})
const businessAreaTargets = computed(() => buildScopeTargets(row => row.business_area || '未分类'))
const productDomainTargets = computed(() => buildScopeTargets(row => row.product_domain || '未分类'))

function scopeTypeLabelOf(scopeType: string): string {
  return SCOPE_TYPE_OPTIONS.find(option => option.value === scopeType)?.label ?? scopeType
}

/** 列表展示：范围标签 */
function scopeLabel(record: PrescanTaskRow): string {
  if (record.scope_type === 'repository')
    return ''
  const label = scopeTypeLabelOf(record.scope_type).replace('按', '')
  const target = record.scope_type === 'project_group'
    ? projectGroupName(record.scope_target)
    : (record.scope_target || '未分类')
  return `${label}：${target}`
}

function projectGroupName(id?: string | null): string {
  if (!id)
    return ''
  return projectGroupTargets.value.find(option => option.value === id)?.label.replace(/（\d+ 个仓库）$/, '') || id
}

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
const ASSET_TYPE_LABELS: Record<string, string> = {
  form: '表单',
  microservice: '微服务',
  openapi: 'OpenAPI',
}

/** 资产类型逗号串 → 展示标签 */
function assetTypeLabels(value: string | null | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map(type => type.trim())
    .filter(Boolean)
    .map(type => ASSET_TYPE_LABELS[type] ?? type)
}

/** 扫描策略标签 */
function scanModeLabel(mode: string): string {
  const labels: Record<string, string> = {
    auto_delta: '自动增量',
    code_delta: '代码差量',
    rule_delta: '规则差量',
    hybrid_delta: '混合差量',
    full_baseline: '完整基线',
    reconfirm: '重新 AI 确认',
    hunk_quick: '新增行快检',
    diff: '增量（旧）',
    full: '全量（旧）',
  }
  return labels[mode] ?? mode
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

const form = reactive<{
  id: string
  name: string
  scope_type: ScopeType
  scope_value: string
  repository_ids: string[]
  domains: string[]
  scan_mode: string
  cron_expression: string
  schedule_enabled: boolean
  concurrency: number
  auto_confirm: boolean
  asset_scan_types: string[]
  ai_mode: string
  ai_model: string
  ai_agent_code: string
  status: boolean
}>({
  id: '',
  name: '',
  scope_type: 'repository',
  scope_value: '',
  repository_ids: [],
  domains: [],
  scan_mode: 'full_baseline',
  cron_expression: '',
  schedule_enabled: true,
  concurrency: 2,
  auto_confirm: true,
  asset_scan_types: ['form', 'microservice'],
  ai_mode: 'batch',
  ai_model: '',
  ai_agent_code: '',
  status: true,
})

const currentScopeTargets = computed(() => {
  switch (form.scope_type) {
    case 'project_group': return projectGroupTargets.value
    case 'business_area': return businessAreaTargets.value
    case 'product_domain': return productDomainTargets.value
    default: return []
  }
})

/** 当前范围在触发时将扫描的仓库数（仅前端预估，后端触发时同样动态解析） */
const currentScopeRepoCount = computed(() => {
  if (form.scope_type === 'repository')
    return form.repository_ids.length
  return currentScopeTargets.value.find(option => option.value === form.scope_value)?.count ?? 0
})

const scopeTargetLabel = computed(() => SCOPE_TYPE_OPTIONS.find(option => option.value === form.scope_type)?.label.replace('按', '') ?? '范围目标')

/**
 * 定时任务只区分三种扫描策略：全量 / 自动增量 / 新增行快检。
 * 旧任务里保存的代码差量/规则差量/混合差量/重新确认等值，触发时都按自动增量执行
 * （见后端 prescan_mode），这里保留当前值以防编辑时下拉显示裸值。
 */
const CANONICAL_SCAN_MODES = new Set(['auto_delta', 'full_baseline', 'hunk_quick'])
/** 资产扫描（统一扫描）可用的策略：完整基线与自动增量（含旧差量值） */
const ASSET_SCAN_MODES = new Set(['full_baseline', 'auto_delta', 'full', 'diff', 'code_delta', 'rule_delta', 'hybrid_delta'])
const scanModeOptions = computed(() => {
  const options = [
    { value: 'full_baseline', label: '完整基线（默认，全量）' },
    { value: 'auto_delta', label: '自动增量（需已有全量基线）' },
    { value: 'hunk_quick', label: '高级：新增行快速检查（不关闭问题）' },
  ]
  const current = form.scan_mode
  if (!CANONICAL_SCAN_MODES.has(current)) {
    options.push({
      value: current,
      label: current === 'full' ? '全量（旧，等同完整基线）' : `${scanModeLabel(current)}（旧，按自动增量执行）`,
    })
  }
  return options
})

function onScopeTypeChange() {
  form.scope_value = ''
}

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
  form.scope_type = 'repository'
  form.scope_value = ''
  form.repository_ids = []
  form.domains = []
  form.scan_mode = 'full_baseline'
  form.cron_expression = ''
  form.schedule_enabled = true
  form.concurrency = 2
  form.auto_confirm = true
  form.asset_scan_types = ['form', 'microservice']
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
  form.scope_type = (record.scope_type as ScopeType) || 'repository'
  form.scope_value = record.scope_target ?? ''
  form.repository_ids = record.repository_ids ? [...record.repository_ids] : []
  // 将逗号分隔的 domains 还原为数组
  form.domains = record.domains ? record.domains.split(',').map(d => d.trim()).filter(Boolean) : []
  form.scan_mode = record.scan_mode || 'full_baseline'
  form.cron_expression = record.cron_expression ?? ''
  form.schedule_enabled = record.schedule_enabled === '1'
  form.concurrency = record.concurrency ?? 2
  form.auto_confirm = record.auto_confirm === '1'
  form.asset_scan_types = record.asset_scan_types
    ? record.asset_scan_types.split(',').map(type => type.trim()).filter(Boolean)
    : ['form', 'microservice']
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
    scope_type: form.scope_type,
    scope_value: form.scope_type === 'repository' ? null : (form.scope_value.trim() || null),
    repository_ids: form.scope_type === 'repository' ? form.repository_ids : [],
    domains: form.domains.length > 0 ? form.domains.join(',') : null,
    scan_mode: form.scan_mode,
    cron_expression: form.cron_expression.trim() || null,
    schedule_enabled: form.schedule_enabled ? '1' : '0',
    concurrency: form.concurrency,
    auto_confirm: form.auto_confirm ? '1' : '0',
    asset_scan_types: form.asset_scan_types.join(','),
    ai_mode: form.ai_mode,
    ai_model: form.ai_model.trim() || null,
    ai_agent_code: form.ai_agent_code.trim() || null,
    status: form.status ? '1' : '0',
  }
}

const savePayload = ref<PrescanTaskSavePayload>({
  name: '',
  scope_type: 'repository',
  repository_ids: [],
  scan_mode: 'full_baseline',
  schedule_enabled: '1',
  concurrency: 2,
  auto_confirm: '1',
  asset_scan_types: 'form,microservice',
  ai_mode: 'batch',
  status: '1',
})

async function handleSave() {
  // 前端校验
  if (!form.name.trim()) {
    Message.warning('请填写任务名称')
    return
  }
  if (form.scope_type === 'repository' && form.repository_ids.length === 0) {
    Message.warning('请选择至少一个代码仓库')
    return
  }
  if (form.scope_type !== 'repository' && !form.scope_value.trim()) {
    Message.warning(`请选择${SCOPE_TYPE_OPTIONS.find(o => o.value === form.scope_type)?.label.replace('按', '') ?? '扫描范围'}`)
    return
  }
  if (form.scope_type !== 'repository' && currentScopeRepoCount.value === 0) {
    Message.warning('该范围下没有可扫描的仓库')
    return
  }
  if (!validateCron(form.cron_expression)) {
    Message.warning('cron 表达式格式不正确，须为 6 段（含秒），例如：0 0 2 * * *')
    return
  }
  if (form.asset_scan_types.length > 0 && !ASSET_SCAN_MODES.has(form.scan_mode)) {
    Message.warning('资产扫描只支持完整基线 / 自动增量，请修改扫描策略或关闭资产扫描')
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
const selectedKeys = ref<string[]>([])
const rowSelection = { type: 'checkbox' as const, showCheckedAll: true }
const batchDeleting = ref(false)

/** 列表当前是全量加载（无分页），selectedKeys 直接就是勾选的任务 id。 */
function handleBatchDelete() {
  const ids = selectedKeys.value.map(String)
  if (!ids.length) {
    Message.warning('请先勾选要删除的任务')
    return
  }
  Modal.warning({
    title: `确认删除 ${ids.length} 个定时扫描任务`,
    content: `将删除选中的 ${ids.length} 个任务及其执行记录。\n\n`
      + '不会影响扫描运行那边的数据（预扫描运行、候选列表与报告均保留）。此操作不可恢复。',
    hideCancel: false,
    okText: '批量删除',
    okButtonProps: { status: 'danger' },
    onOk: async () => {
      batchDeleting.value = true
      try {
        const res = await postAction<string>(ApiSecPrescan.taskBatchDelete, { ids })
        if (!res)
          return
        Message.success(String(res))
        selectedKeys.value = []
        await loadList()
      }
      finally {
        batchDeleting.value = false
      }
    },
  })
}

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
        selectedKeys.value = selectedKeys.value.filter(id => id !== record.id)
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
    // 带上范围，避免只切调度开关时被后端按「按仓库」语义改写范围
    scope_type: record.scope_type || 'repository',
    scope_value: record.scope_type && record.scope_type !== 'repository' ? (record.scope_target ?? null) : null,
    repository_ids: !record.scope_type || record.scope_type === 'repository' ? record.repository_ids : [],
    scan_mode: record.scan_mode,
    schedule_enabled: newVal ? '1' : '0',
    concurrency: record.concurrency,
    auto_confirm: record.auto_confirm,
    asset_scan_types: record.asset_scan_types,
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
  { title: '扫描范围', dataIndex: 'scope_type', slotName: 'scope', width: 240 },
  { title: '领域', dataIndex: 'domains', slotName: 'domains', width: 100 },
  { title: '扫描策略', dataIndex: 'scan_mode', slotName: 'scan_mode', width: 110 },
  { title: '资产扫描', dataIndex: 'asset_scan_types', slotName: 'asset_scan', width: 120 },
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
        <a-button
          status="danger"
          :disabled="selectedKeys.length === 0"
          :loading="batchDeleting"
          @click="handleBatchDelete"
        >
          <template #icon>
            <icon-delete />
          </template>
          批量删除{{ selectedKeys.length ? ` (${selectedKeys.length})` : '' }}
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
          v-model:selected-keys="selectedKeys"
          :row-selection="rowSelection"
          :scroll="{ minWidth: 1800, y: tableHeight }"
          size="small"
        >
          <!-- 扫描范围：按仓库显示 tag；按项目组/领域显示范围 + 解析仓库数 -->
          <template #scope="{ record }">
            <a-tooltip
              v-if="record.scope_type !== 'repository'"
              :content="record.repository_names?.join('\n') || '当前范围下没有仓库'"
            >
              <a-space wrap size="mini">
                <a-tag size="small" color="purple">
                  {{ scopeLabel(record) }}
                </a-tag>
                <a-tag size="small" color="gray">
                  {{ record.repository_names?.length ?? 0 }} 个仓库
                </a-tag>
              </a-space>
            </a-tooltip>
            <template v-else-if="record.repository_names && record.repository_names.length > 0">
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
              :color="record.scan_mode === 'diff' || record.scan_mode === 'auto_delta' ? 'orange' : 'blue'"
              size="small"
            >
              {{ scanModeLabel(record.scan_mode) }}
            </a-tag>
          </template>

          <!-- 资产扫描 -->
          <template #asset_scan="{ record }">
            <a-space v-if="assetTypeLabels(record.asset_scan_types).length" wrap size="mini">
              <a-tag
                v-for="label in assetTypeLabels(record.asset_scan_types)"
                :key="label"
                color="cyan"
                size="small"
              >
                {{ label }}
              </a-tag>
            </a-space>
            <a-tooltip v-else content="仅按仓库通用规则扫描，不自动同步/选资产">
              <a-tag color="gray" size="small">
                关闭
              </a-tag>
            </a-tooltip>
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

        <!-- 扫描范围：按仓库逐个选 / 按项目组、业务领域、产品领域动态解析 -->
        <a-form-item label="扫描范围" required>
          <a-radio-group v-model="form.scope_type" @change="onScopeTypeChange">
            <a-radio v-for="opt in SCOPE_TYPE_OPTIONS" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </a-radio>
          </a-radio-group>
          <template #extra>
            按项目组 / 领域创建后，每次触发会动态解析该范围内所有启用绑定的仓库；后续新增的绑定自动纳入，无需改任务。
          </template>
        </a-form-item>

        <!-- 按仓库：多选 -->
        <a-form-item v-if="form.scope_type === 'repository'" label="代码仓库" required>
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

        <!-- 按项目组 / 领域：单选目标，附解析仓库数 -->
        <a-form-item v-else :label="scopeTargetLabel" required>
          <a-select
            v-model="form.scope_value"
            allow-search
            placeholder="选择扫描范围目标"
            style="width: 100%"
          >
            <a-option v-for="opt in currentScopeTargets" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </a-option>
          </a-select>
          <template #extra>
            当前范围将扫描 <strong>{{ currentScopeRepoCount }}</strong> 个仓库（仅统计启用绑定的仓库，触发时实时解析）
          </template>
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

        <!-- 资产扫描 -->
        <a-form-item label="资产扫描">
          <a-checkbox-group v-model="form.asset_scan_types">
            <a-checkbox value="form">
              表单资产
            </a-checkbox>
            <a-checkbox value="microservice">
              微服务资产
            </a-checkbox>
            <a-checkbox value="openapi" disabled>
              OpenAPI（规划中）
            </a-checkbox>
          </a-checkbox-group>
          <template #extra>
            默认勾选表单 + 微服务。触发前会自动索引该仓库源码并刷新表单匹配 / 微服务发现，任一步失败则该仓库预扫描失败。
            全部不勾选 = 关闭资产扫描，只按仓库通用规则扫描（候选数通常更少），此时「领域」筛选才生效。
          </template>
        </a-form-item>

        <a-row :gutter="16">
          <!-- 扫描策略 -->
          <a-col :span="12">
            <a-form-item label="扫描策略">
              <template #label>
                扫描策略
                <ScanModeTip />
              </template>
              <a-select v-model="form.scan_mode" style="width: 100%">
                <a-option v-for="opt in scanModeOptions" :key="opt.value" :value="opt.value" :label="opt.label">
                  {{ opt.label }}
                </a-option>
              </a-select>
              <template #extra>
                定时任务只区分全量 / 自动增量 / 新增行快检；旧任务的差量细分类按自动增量执行。
              </template>
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
          <a-radio-group v-model="form.ai_mode" :disabled="!form.auto_confirm">
            <a-radio value="batch">
              平台编排（batch）
            </a-radio>
            <a-radio value="agent">
              自主审计（agent）
            </a-radio>
          </a-radio-group>
          <template #extra>
            仅在「自动 AI 确认」开启时生效；关闭时扫描完成后不会触发任何 AI 确认，模式 / Agent / 模型都不会被使用。
          </template>
        </a-form-item>

        <!-- Agent -->
        <a-form-item label="Agent">
          <a-select
            v-model="form.ai_agent_code"
            placeholder="留空表示按 AI 模式使用默认 Agent"
            allow-clear
            allow-search
            :disabled="!form.auto_confirm"
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
            :disabled="!form.auto_confirm"
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
        :scroll="{ minWidth: 1200 }"
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
