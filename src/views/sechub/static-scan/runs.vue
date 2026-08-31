<script setup lang="ts">
import type { CrossRunAggRow, ModuleWithRepository } from '@/types/static-scan'
import { Checkbox, Message, Modal } from '@arco-design/web-vue'
import { computed, h, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ErrorFlag } from '@/api/apis'
import { ApiAiExecution } from '@/api/aiApis'
import { ApiSecModuleRepository, ApiSecPrescan } from '@/api/sechubApis'
import { useGet, usePost } from '@/hooks'
import { pendingSubLabel, pendingTooltip, runStatusLabels } from './labels'

defineOptions({ name: 'StaticScanRuns' })

const router = useRouter()

// ===== 应用列表 =====
const { data: repoList } = useGet<ModuleWithRepository[]>(ApiSecModuleRepository.listWithModule, {}, { immediate: true })
const repositories = computed(() => repoList.value ?? [])
const selectedRepoId = ref('')

// ===== 项目组、状态查询字段（客户端过滤，数据源已含 project_group_id）=====
const selectedProjectGroupId = ref('')
const selectedStatus = ref('')

// 项目组下拉选项：从仓库列表去重聚合
const projectGroups = computed(() => {
  const map = new Map<string, string>()
  for (const r of repositories.value) {
    if (r.project_group_id)
      map.set(r.project_group_id, r.project_group_name || r.project_group_id)
  }
  return Array.from(map, ([id, name]) => ({ id, name }))
})

// repository_id → project_group_id 映射，供运行行按项目组过滤
const repoToGroup = computed(() => {
  const map = new Map<string, string>()
  for (const r of repositories.value) {
    if (r.repository_id)
      map.set(r.repository_id, r.project_group_id ?? '')
  }
  return map
})

// 运行状态下拉选项（与 sec_prescan_run.status 取值一致）
const statusOptions = [
  { value: 'preparing', label: '准备中' },
  { value: 'running', label: '预扫描中' },
  { value: 'succeeded', label: '预扫描完成' },
  { value: 'failed', label: '失败' },
  { value: 'skipped', label: '已跳过' },
]

async function fetchJson<T>(url: string): Promise<T | null> {
  const { data, execute } = useGet<T>(url, {}, { immediate: false })
  await execute()
  return data.value ?? null
}

// ===== POST 通用封装（业务错误时 hook 已弹 Message，返回 null 表示失败）=====
async function postAction<T = unknown>(url: string, payload: Record<string, any>): Promise<T | null> {
  const request = usePost<T>(url, payload, { immediate: false })
  await request.execute()
  if (request.error.value || request.data.value === ErrorFlag)
    return null
  return request.data.value
}

// ===== 任务队列（静态扫描的 AI 确认/自主审计任务在这里排队）=====
// 放在「扫描运行」页而不是 AI 中心：队列里跑的就是静态扫描任务，
// AI 中心只负责展示通用的 AI 执行记录。
interface QueueRow {
  id: string
  task_kind: string
  biz_id: string
  shard_key?: string | null
  status: string
  attempt: number
  max_attempt: number
  run_after: string
  lease_until?: string | null
  locked_by?: string | null
  last_error?: string | null
  created_at: string
}

const queueStatus = ref('')
const queueRows = ref<QueueRow[]>([])
const queueSelected = ref<string[]>([])
const queueLoading = ref(false)
const queueStats = ref<Record<string, number>>({})

const queueKindLabels: Record<string, string> = {
  static_scan_confirm: '平台编排确认',
  static_scan_agent: '自主审计分片',
}
const queueStatusLabels: Record<string, { label: string, color: string }> = {
  pending: { label: '待领取', color: 'gray' },
  running: { label: '执行中', color: 'blue' },
  succeeded: { label: '成功', color: 'green' },
  dead: { label: '已失败', color: 'red' },
}

async function loadQueue() {
  queueLoading.value = true
  try {
    const params = new URLSearchParams()
    if (queueStatus.value)
      params.set('status', queueStatus.value)
    params.set('limit', '200')
    queueRows.value = await fetchJson<QueueRow[]>(`${ApiAiExecution.queueList}?${params.toString()}`) ?? []
    queueStats.value = await fetchJson<Record<string, number>>(ApiAiExecution.queueStats) ?? {}
  }
  finally {
    queueLoading.value = false
  }
}
loadQueue()

/** 删除队列任务（默认跳过执行中；勾了执行中的行会提示改用强制） */
async function deleteQueueSelected() {
  if (queueSelected.value.length === 0) {
    Message.warning('请先勾选要删除的队列任务')
    return
  }
  const runningPicked = queueRows.value.filter(
    r => queueSelected.value.includes(r.id) && r.status === 'running',
  ).length
  Modal.warning({
    title: '确认删除选中的队列任务？',
    content: runningPicked > 0
      ? `选中 ${queueSelected.value.length} 条，其中 ${runningPicked} 条为「执行中」。\n\n`
        + '默认会跳过执行中的行（避免误删真正在跑的任务）。若这些任务实际已死'
        + '（例如刚重启过），请改用「标记失败」，或勾选下方强制删除。'
      : `将删除 ${queueSelected.value.length} 条队列任务。此操作不可恢复。`,
    okText: runningPicked > 0 ? '跳过执行中并删除' : '确认删除',
    cancelText: '取消',
    okButtonProps: { status: 'danger' },
    onOk: async () => {
      const resp = await postAction<{ deleted: number, message?: string }>(
        ApiAiExecution.queueDelete,
        { ids: queueSelected.value, force: false },
      )
      if (resp) {
        Message.success(resp.message || '删除成功')
        queueSelected.value = []
        await loadQueue()
      }
    },
  })
}

/** 手动标记失败：给重启后残留的「执行中」行一个收敛出口 */
async function forceFailQueueSelected() {
  if (queueSelected.value.length === 0) {
    Message.warning('请先勾选要标记失败的队列任务')
    return
  }
  Modal.warning({
    title: '确认把选中任务标记为失败？',
    content: `将把 ${queueSelected.value.length} 条队列任务置为「已失败」（不限当前状态）。\n\n`
      + '适用于服务重启后残留的「执行中」任务——它实际已经死了，但租约还没到期，'
      + '既删不掉也不会自动失败。标记后可正常删除，也可重新触发重扫。',
    okText: '标记失败',
    cancelText: '取消',
    okButtonProps: { status: 'danger' },
    onOk: async () => {
      const resp = await postAction<{ failed: number, message?: string }>(
        ApiAiExecution.queueForceFail,
        { ids: queueSelected.value, reason: '用户在扫描运行页手动标记失败（服务重启后残留）' },
      )
      if (resp) {
        Message.success(resp.message || '已标记失败')
        queueSelected.value = []
        await loadQueue()
      }
    },
  })
}

const queueColumns = [
  { title: '任务类型', dataIndex: 'task_kind', slotName: 'qkind', width: 130 },
  { title: '扫描运行(run)', dataIndex: 'biz_id', width: 190, ellipsis: true, tooltip: true },
  { title: '分片', dataIndex: 'shard_key', width: 120, ellipsis: true, tooltip: true },
  { title: '状态', dataIndex: 'status', slotName: 'qstatus', width: 90 },
  { title: '尝试', dataIndex: 'attempt', slotName: 'qattempt', width: 70 },
  { title: '租约到期', dataIndex: 'lease_until', width: 160 },
  { title: '失败原因', dataIndex: 'last_error', width: 260, ellipsis: true, tooltip: true },
  { title: '创建时间', dataIndex: 'created_at', width: 160 },
]

// ===== 模型结果总览（跨 Run 横评：后端已改为每个 run_id 只返回一行汇总）=====
const crossRows = ref<CrossRunAggRow[]>([])
// 行 key 直接用 run_id（后端保证每个 run_id 只有一行，不再需要拼 ai_model/ai_mode）
const crossTableRows = computed(() => crossRows.value.map(row => ({
  ...row,
  key: row.run_id,
})))
// 应用「项目组」「状态」查询字段做客户端过滤（应用维度已由后端 repository_id 过滤）
const filteredCrossRows = computed(() => crossTableRows.value.filter((row) => {
  if (selectedProjectGroupId.value && repoToGroup.value.get(row.repository_id) !== selectedProjectGroupId.value)
    return false
  if (selectedStatus.value && row.status !== selectedStatus.value)
    return false
  return true
}))
const crossLoading = ref(false)

async function loadCrossRows(silent = false) {
  if (!silent)
    crossLoading.value = true
  try {
    const params = new URLSearchParams()
    if (selectedRepoId.value)
      params.set('repository_id', selectedRepoId.value)
    crossRows.value = await fetchJson<CrossRunAggRow[]>(`${ApiSecPrescan.crossRunCompare}?${params.toString()}`) ?? []
  }
  finally {
    if (!silent)
      crossLoading.value = false
  }
  schedulePollIfNeeded()
}

// ===== AI 确认轮询：任一任务存在待确认候选时每 15 秒静默刷新 =====
const pollTimer = ref<ReturnType<typeof setTimeout> | null>(null)
function schedulePollIfNeeded() {
  if (pollTimer.value) {
    clearTimeout(pollTimer.value)
    pollTimer.value = null
  }
  // 除了「还有待确认候选」，只要有批次在排队或执行中也要继续轮询，
  // 否则「排队中 → 执行中 → 完成」的阶段变化不会自动回显。
  const active = crossRows.value.some(r =>
    (r.pending ?? 0) > 0
    || (r.queue_pending ?? r.ai_exec_pending ?? 0) > 0
    || (r.queue_running ?? r.ai_exec_running ?? 0) > 0,
  )
  if (active)
    pollTimer.value = setTimeout(() => void loadCrossRows(true), 15000)
}
onUnmounted(() => {
  if (pollTimer.value)
    clearTimeout(pollTimer.value)
})

// 默认加载全部数据
loadCrossRows()

function onSearch() {
  void loadCrossRows()
}

// ===== 分页（客户端分页：cross-run-compare 一次返回全量，这里切页展示）=====
const pageNum = ref(1)
const pageSize = ref(20)
const pagedCrossRows = computed(() => {
  const start = (pageNum.value - 1) * pageSize.value
  return filteredCrossRows.value.slice(start, start + pageSize.value)
})
// 过滤条件变化后回到第一页，避免停在越界页码上看到空表
watch([selectedProjectGroupId, selectedStatus, selectedRepoId], () => {
  pageNum.value = 1
})

// ===== 批量重扫未完成（多选工程/运行后，只重扫其剩余未完成任务）=====
const selectedRunKeys = ref<string[]>([])
const bulkRetrying = ref(false)

/** 选中行里真正有可重扫内容的（可重跑数量 > 0） */
const bulkRetryTargets = computed(() =>
  filteredCrossRows.value.filter(r => selectedRunKeys.value.includes(r.run_id) && retryableCount(r) > 0),
)

async function bulkRetry() {
  if (selectedRunKeys.value.length === 0) {
    Message.warning('请先勾选要重扫的运行')
    return
  }
  const targets = bulkRetryTargets.value
  if (targets.length === 0) {
    Message.warning('选中的运行没有未完成任务（错误/未确认/待复核均为 0）')
    return
  }
  const totalCandidates = targets.reduce((sum, r) => sum + retryableCount(r), 0)
  const totalSettled = targets.reduce((sum, r) => sum + settledCount(r), 0)
  confirmRetryScope({
    title: '确认批量重扫？',
    scopeText: `将对 ${targets.length} 个运行重新入队确认`,
    unfinished: totalCandidates,
    settled: totalSettled,
    onOk: async (includeSettled) => {
      bulkRetrying.value = true
      let ok = 0
      let fail = 0
      try {
        // 逐个提交：后端队列有「同业务同分片只允许一条在飞」的唯一约束，重复提交是安全的
        for (const row of targets) {
          const payload: Record<string, any> = { run_id: row.run_id, include_settled: includeSettled }
          const models = (row.ai_model ?? '').split(',').map(m => m.trim()).filter(Boolean)
          if (models.length === 1)
            payload.model = models[0]
          // 传原本的模式，避免把 Agent 自主审计的运行重扫成平台编排
          // （聚合出多种模式时不传，由后端推断）
          const modes = (row.ai_mode ?? '').split(',').map(m => m.trim()).filter(Boolean)
          if (modes.length === 1)
            payload.mode = modes[0]
          const resp = await postAction<{ message?: string }>(ApiSecPrescan.retryErrors, payload)
          if (resp)
            ok += 1
          else
            fail += 1
        }
        Message.success(`批量重扫已提交：成功 ${ok} 个${fail ? `，失败 ${fail} 个` : ''}`)
        selectedRunKeys.value = []
        setTimeout(() => void loadCrossRows(), 1500)
        void loadQueue()
      }
      finally {
        bulkRetrying.value = false
      }
    },
  })
}

// ===== 查看明细 → 跳转扫描结果详情 =====
// 注意：ai_model 现在可能是逗号聚合值（如 "modelA,modelB"），无法作为单一筛选条件传给
// 结果页的 ai_model 过滤参数（后端只接受精确值）。这里故意不传 ai_model/ai_mode，
// 跳转后由用户在结果页自行筛选，避免错误过滤导致看不到任何数据。
function viewDetail(row: CrossRunAggRow) {
  router.push({
    path: '/static-scan/scan/results',
    query: {
      run_id: row.run_id,
      repository_id: row.repository_id,
    },
  })
}

// ===== 查看错误 → 跳转扫描结果详情并预置 ai_status=error 筛选 =====
function viewErrors(row: CrossRunAggRow) {
  router.push({
    path: '/static-scan/scan/results',
    query: {
      run_id: row.run_id,
      repository_id: row.repository_id,
      ai_status: 'error',
    },
  })
}

/**
 * 模型列文案：
 * - ai_model 非空直接展示（可能是逗号分隔的多模型聚合值）
 * - ai_model 为空但 ai_pending_model 有值：加「（进行中）」后缀，让用户知道模型已生效只是还没回写结果
 * - 两者都空时返回空字符串（模板层展示占位符）
 */
function modelLabel(row: CrossRunAggRow): { text: string, pending: boolean } {
  if (row.ai_model?.trim())
    return { text: row.ai_model.trim(), pending: false }
  if (row.ai_pending_model?.trim())
    return { text: `${row.ai_pending_model.trim()}（进行中）`, pending: true }
  return { text: '', pending: false }
}

/**
 * 确认进度标签：直接用行自身字段（后端已按 run 汇总，不再需要跨行聚合）。
 * 只有 pending/error/review_needed 全为 0 时才算 100%。
 */
function progressLabel(row: CrossRunAggRow): string {
  const total = row.total ?? 0
  if (total === 0)
    return '-'
  const pending = row.pending ?? 0
  const error = row.error ?? 0
  const reviewNeeded = row.review_needed ?? 0
  const done = total - pending - error - reviewNeeded
  return `${Math.round((done / total) * 100)}%`
}

/** 确认进度是否已全部完成（pending/error/review_needed 全为 0） */
function progressDone(row: CrossRunAggRow): boolean {
  return (row.pending ?? 0) === 0 && (row.error ?? 0) === 0 && (row.review_needed ?? 0) === 0
}

/** 确认状态列的 tag 颜色：error 优先红色，review_needed 橙色，pending 蓝色，全完成绿色 */
function pendingTagColor(row: CrossRunAggRow): string {
  if ((row.error ?? 0) > 0)
    return 'red'
  if ((row.review_needed ?? 0) > 0)
    return 'orangered'
  if ((row.pending ?? 0) > 0)
    return 'blue'
  // 全部完成时参考 run 本身状态
  return runStatusLabels[row.status]?.color ?? 'green'
}

/**
 * 该 run 是否已经触发过 AI 确认。
 *
 * 两个依据取其一即可：
 * - 有关联的 AI 执行记录（本次改动起 batch/agent 的 caller_id 都是 run_id）
 * - 或候选里已经出现过任何 AI 结论（历史 run 的执行记录挂在 rule_version_id 上，查不到）
 */
function confirmTriggered(row: CrossRunAggRow): boolean {
  if ((row.ai_exec_total ?? 0) > 0)
    return true
  return (row.confirmed ?? 0) > 0 || (row.rejected ?? 0) > 0
    || (row.error ?? 0) > 0 || (row.review_needed ?? 0) > 0
}

/**
 * 确认状态文案（同时涵盖预扫描阶段与 AI 确认阶段）。
 * 优先级：
 *  1. run.status = failed      → 预扫描失败
 *  2. run.status = skipped     → 已跳过
 *  3. run.status = preparing   → 准备中
 *  4. run.status = running     → 预扫描中
 *  5. succeeded 之后按 AI 执行状态与候选分布判断
 */
function confirmStateLabel(row: CrossRunAggRow): string {
  // 预扫描终态或进行态优先
  const status = row.status
  if (status === 'failed')
    return '预扫描失败'
  if (status === 'skipped')
    return '已跳过'
  if (status === 'preparing')
    return '准备中'
  if (status === 'running')
    return '预扫描中'
  // succeeded 之后进入 AI 确认阶段判定。
  // 排队/执行数以**任务队列**为真相源：旧实现用 ai_exec_pending（ai_execution 里
  // status='pending' 的条数），那是「已建记录但没抢到内存信号量」的中间态，进程重启后
  // 永不消费却仍被计数，于是出现「排队中 51 / 33」这种莫名的大数字。
  const running = row.queue_running ?? row.ai_exec_running ?? 0
  const queued = row.queue_pending ?? row.ai_exec_pending ?? 0
  if (running > 0)
    return `AI执行中 ${running}`
  if (queued > 0)
    return `AI排队中 ${queued}`
  if (!confirmTriggered(row))
    return '预扫描完成，待触发AI确认'
  return pendingSubLabel(row.status, row.pending ?? 0, row.error ?? 0, row.review_needed ?? 0)
}

/** 确认状态颜色：预扫描阶段优先，再按 AI 确认阶段配色 */
function confirmStateColor(row: CrossRunAggRow): string {
  const status = row.status
  if (status === 'failed')
    return 'red'
  if (status === 'skipped')
    return 'gray'
  if (status === 'preparing')
    return 'gold'
  if (status === 'running')
    return 'blue'
  // succeeded 之后
  if ((row.queue_running ?? row.ai_exec_running ?? 0) > 0)
    return 'blue'
  if ((row.queue_pending ?? row.ai_exec_pending ?? 0) > 0)
    return 'gold'
  if (!confirmTriggered(row))
    return 'gray'
  return pendingTagColor(row)
}

/** 确认状态 tooltip：把执行阶段与候选分布一起说清楚 */
function confirmStateTooltip(row: CrossRunAggRow): string {
  const lines: string[] = []
  const status = row.status
  // 预扫描阶段直接说明，不展示候选分布
  if (status === 'failed') {
    lines.push('预扫描执行失败，未产生候选数据。')
    if (row.error_message?.trim())
      lines.push(`失败原因：${row.error_message.trim()}`)
    return lines.join('\n')
  }
  if (status === 'skipped') {
    lines.push('代码与规则未变更，未重复扫描，复用既有结果。')
    return lines.join('\n')
  }
  if (status === 'preparing') {
    lines.push('正在准备：拉取代码、建文件清单、加载规则。')
    return lines.join('\n')
  }
  if (status === 'running') {
    lines.push('预扫描正在进行中，完成后方可触发 AI 确认。')
    return lines.join('\n')
  }
  // succeeded 之后展示 AI 确认阶段详情（排队/执行以任务队列为真相源）
  const running = row.queue_running ?? row.ai_exec_running ?? 0
  const queued = row.queue_pending ?? row.ai_exec_pending ?? 0
  if (!confirmTriggered(row)) {
    lines.push('尚未触发 AI 确认。可在扫描看板选中该运行后点「AI 确认」。')
  }
  else {
    if (queued > 0)
      lines.push(`${queued} 个任务在队列中等待（消费者每 5 秒领取，受并发上限约束）`)
    if (running > 0)
      lines.push(`${running} 个任务正在执行（单次超时见平台配置，默认 5400 秒）`)
    if (queued === 0 && running === 0)
      lines.push('队列中没有该运行的待执行/执行中任务')
  }
  lines.push(pendingTooltip(row.pending ?? 0, row.error ?? 0, row.review_needed ?? 0))
  return lines.join('\n')
}

// ===== 一键重扫错误候选（整个轮次）=====
const retryingRunId = ref('')
// 默认可重跑数量 = error + 未确认。与后端 RETRYABLE_AI_STATUSES 对齐。
//
// review_needed 已从默认范围移出：它承载的是"需人工复核"的判定结果、业务上等同
// 已确认，默认重扫会把这批待办悄悄抹掉。要复核它得在弹窗里显式勾选。
function retryableCount(row: CrossRunAggRow) {
  return (row.error || 0) + (row.pending || 0)
}

// 已出结论数量 = 已确认 + 待人工复核，勾选"连已出结论的一起重扫"时才纳入。
// 与后端 SETTLED_AI_STATUSES 对齐；rejected 刻意不含（量最大，纳入会让规模失控）。
function settledCount(row: CrossRunAggRow) {
  return (row.confirmed || 0) + (row.review_needed || 0)
}

/**
 * 重扫前的确认弹窗。勾选后才把已确认/待复核的候选一起重置。
 *
 * 每次调用都复位成不勾选 —— 这是破坏性操作（清掉已有结论和人工待办），
 * 不能因为上次勾过就默认继续勾着。
 */
function confirmRetryScope(opts: {
  title: string
  scopeText: string
  unfinished: number
  settled: number
  onOk: (includeSettled: boolean) => Promise<void>
}) {
  const include = ref(false)
  Modal.confirm({
    title: opts.title,
    content: () => h('div', { style: 'line-height:1.7' }, [
      h('div', `${opts.scopeText}，其中未完成（错误/未确认）${opts.unfinished} 条。`),
      h('div', { style: 'color:#86909c;margin-top:4px' },
        '默认只重扫未完成部分，已确认/待人工复核/已排除的结论不受影响。'),
      opts.settled > 0
        ? h('div', { style: 'margin-top:10px' }, [
            h(Checkbox, {
              'modelValue': include.value,
              'onUpdate:modelValue': (v: any) => { include.value = Boolean(v) },
            }, () => `连已出结论的一起重扫（额外 ${opts.settled} 条：已确认 + 待人工复核）`),
            h('div', { style: 'color:#f77234;margin-top:4px;font-size:12px' },
              '勾选后这些候选的 AI 结论与详细报告会被清空并重新判定，请确认已无人跟进。'),
          ])
        : h('div', { style: 'color:#86909c;margin-top:8px;font-size:12px' },
            '该范围内没有已出结论的候选。'),
    ]),
    okText: '确认重扫',
    cancelText: '取消',
    onOk: () => opts.onOk(include.value),
  })
}

async function retryErrors(row: CrossRunAggRow) {
  retryingRunId.value = row.run_id
  try {
    // 后端 retry-errors 的 model 是「重跑时用哪个模型」的覆盖项，不是筛选条件：
    // 不传就退回 Agent 默认模型。所以这里只在该轮次确实只用过一个模型时透传，
    // 保持「按原模型重跑」；聚合出多个模型时无法确定用哪个，交给后端默认值。
    const payload: Record<string, any> = { run_id: row.run_id }
    const models = (row.ai_model ?? '').split(',').map(m => m.trim()).filter(Boolean)
    if (models.length === 1)
      payload.model = models[0]
    // 保持原模式（聚合出多种时交给后端推断）
    const modes = (row.ai_mode ?? '').split(',').map(m => m.trim()).filter(Boolean)
    if (modes.length === 1)
      payload.mode = modes[0]
    const resp = await postAction<{ message?: string }>(ApiSecPrescan.retryErrors, payload)
    if (resp) {
      Message.success(resp.message || '已提交重扫，正在后台重新确认')
      // 稍后刷新表格，让错误/待确认计数回显
      setTimeout(() => void loadCrossRows(), 1500)
    }
  }
  finally {
    retryingRunId.value = ''
  }
}

// ===== 删除运行 =====

/** 后端 run-delete 响应 */
interface DeleteRunResult {
  run_id: string
  deleted_candidates: number
  deleted_report: boolean
  output_dir_removed: boolean
  retained_issues: number
  summary: string
}

/** 正在删除的 run_id（用于单行 loading，同 retryingRunId 写法） */
const deletingRunId = ref('')

/** status 为 preparing 或 running 时不允许删除 */
function deleteDisabled(row: CrossRunAggRow): boolean {
  return row.status === 'preparing' || row.status === 'running'
}

/** 弹二次确认框，用户确认后执行删除 */
function confirmDeleteRun(row: CrossRunAggRow): void {
  const appName = row.repository_name ?? row.repository_id
  const commit = shortSha(row.commit_sha) || '(无 commit)'
  Modal.warning({
    title: '确认删除该扫描运行？',
    content: `即将删除应用「${appName}」的运行（commit：${commit}）。\n\n此操作将同时删除该运行的扫描结果详情与磁盘产物，且不可恢复。\n已提的问题（sec_scan_issue）不会被删除，会继续保留。`,
    okText: '确认删除',
    cancelText: '取消',
    okButtonProps: { status: 'danger' },
    onOk: () => {
      void doDeleteRun(row)
    },
  })
}

async function doDeleteRun(row: CrossRunAggRow): Promise<void> {
  deletingRunId.value = row.run_id
  try {
    const resp = await postAction<DeleteRunResult>(ApiSecPrescan.runDelete, { run_id: row.run_id })
    if (resp) {
      Message.success(resp.summary || '删除成功')
      // 删除成功后刷新列表；被删的行不在列表里，轮询逻辑自然收敛
      await loadCrossRows()
    }
  }
  finally {
    deletingRunId.value = ''
  }
}

// ===== 标签映射 =====
const modeLabels: Record<string, { label: string, color: string }> = {
  batch: { label: '平台编排', color: 'blue' },
  agent: { label: '自主审计', color: 'purple' },
}

/**
 * 提取 commit 短 sha（前 8 位）。
 * commit_sha 可能为 null/undefined，返回空字符串时模板展示占位符。
 */
function shortSha(sha: string | null | undefined): string {
  return sha?.slice(0, 8) ?? ''
}

/**
 * commit 列 tooltip 文案：完整 sha + commit_time（如有）。
 */
function commitTooltip(row: CrossRunAggRow): string {
  const parts: string[] = []
  if (row.commit_sha)
    parts.push(`完整 SHA：${row.commit_sha}`)
  if (row.commit_time)
    parts.push(`提交时间：${row.commit_time}`)
  return parts.join('\n') || ''
}

// ===== 表格列 =====
// 新增分支、commit 列；操作列收窄（改为下拉）；总列宽控制在 ~1400 以内
const crossColumns = [
  { title: '应用', dataIndex: 'repository_name', width: 160, ellipsis: true, tooltip: true },
  { title: '分支', dataIndex: 'branch', slotName: 'crBranch', width: 120, ellipsis: true },
  { title: 'Commit', dataIndex: 'commit_sha', slotName: 'crCommit', width: 110 },
  { title: '模型', dataIndex: 'ai_model', slotName: 'crModel', width: 150, ellipsis: true },
  { title: '模式', dataIndex: 'ai_mode', slotName: 'crMode', width: 95 },
  { title: '总数', dataIndex: 'total', width: 65 },
  { title: '确认进度', dataIndex: 'progress', slotName: 'crProgress', width: 85 },
  { title: '确认问题', dataIndex: 'confirmed', width: 80 },
  { title: '已排除', dataIndex: 'rejected', width: 75 },
  { title: '错误', dataIndex: 'error', width: 60 },
  { title: '状态', dataIndex: 'pending', slotName: 'crPending', width: 190 },
  { title: '高风险', dataIndex: 'risk_high', width: 70 },
  { title: '中风险', dataIndex: 'risk_medium', width: 70 },
  { title: '低风险', dataIndex: 'risk_low', width: 70 },
  { title: '确认率', dataIndex: 'confirm_rate', slotName: 'crRate', width: 80 },
  { title: '平均置信度', dataIndex: 'avg_confidence', slotName: 'crConf', width: 90 },
  { title: '时间', dataIndex: 'created_at', width: 120 },
  { title: '操作', slotName: 'crOps', width: 160, fixed: 'right' as const },
]
</script>

<template>
  <div class="static-scan-runs">
    <!-- 应用选择 -->
    <a-card :bordered="false" class="m-b-12px">
      <a-space>
        <span class="selector-label">应用</span>
        <a-select
          v-model="selectedRepoId"
          allow-search
          allow-clear
          placeholder="全部应用"
          style="width: 420px"
        >
          <a-option v-for="repo in repositories" :key="repo.repository_id" :value="repo.repository_id">
            {{ repo.module_name }}（{{ repo.repository_name }}）
          </a-option>
        </a-select>
        <span class="selector-label">项目组</span>
        <a-select
          v-model="selectedProjectGroupId"
          allow-search
          allow-clear
          placeholder="全部项目组"
          style="width: 220px"
        >
          <a-option v-for="pg in projectGroups" :key="pg.id" :value="pg.id">
            {{ pg.name }}
          </a-option>
        </a-select>
        <span class="selector-label">状态</span>
        <a-select
          v-model="selectedStatus"
          allow-clear
          placeholder="全部状态"
          style="width: 150px"
        >
          <a-option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </a-option>
        </a-select>
        <a-button type="primary" @click="onSearch">
          查询
        </a-button>
      </a-space>
    </a-card>

    <!-- 模型结果总览：每行一个 run，是这个页面的主视图 -->
    <a-card :bordered="false" class="m-b-12px">
      <template #title>
        模型结果总览
        <small class="card-sub">每行 = 一个扫描任务（run），点击操作查看明细或重扫</small>
      </template>
      <template #extra>
        <a-space>
          <a-button
            type="primary"
            status="warning"
            :loading="bulkRetrying"
            :disabled="selectedRunKeys.length === 0"
            @click="bulkRetry"
          >
            批量重扫未完成{{ bulkRetryTargets.length ? `(${bulkRetryTargets.length})` : '' }}
          </a-button>
        </a-space>
      </template>
      <a-table
        v-model:selectedKeys="selectedRunKeys"
        :loading="crossLoading"
        :data="pagedCrossRows"
        :columns="crossColumns"
        :row-selection="{ type: 'checkbox', showCheckedAll: true }"
        :pagination="{
          total: filteredCrossRows.length,
          current: pageNum,
          pageSize,
          showTotal: true,
          showPageSize: true,
          pageSizeOptions: [10, 20, 50, 100],
        }"
        row-key="key"
        size="small"
        :scroll="{ x: 1400 }"
        @page-change="(p: number) => (pageNum = p)"
        @page-size-change="(s: number) => { pageSize = s; pageNum = 1 }"
      >
        <!-- 分支列：null 时展示占位符 -->
        <template #crBranch="{ record }">
          <span class="branch-name">{{ record.branch ?? '-' }}</span>
        </template>

        <!-- Commit 列：短 sha，tooltip 展示完整 sha + 提交时间 -->
        <template #crCommit="{ record }">
          <a-tooltip v-if="record.commit_sha" :content="commitTooltip(record)" position="top">
            <span class="commit-sha">{{ shortSha(record.commit_sha) }}</span>
          </a-tooltip>
          <span v-else class="text-placeholder">-</span>
        </template>

        <!-- 模型列：ai_model 非空直接展示；为空但 ai_pending_model 有值时展示进行中模型；两者都空展示占位符 -->
        <template #crModel="{ record }">
          <template v-if="modelLabel(record).text">
            <a-tooltip :content="record.ai_model ?? record.ai_pending_model ?? ''" position="top">
              <span :class="modelLabel(record).pending ? 'model-name model-pending' : 'model-name'">
                {{ modelLabel(record).text }}
              </span>
            </a-tooltip>
          </template>
          <span v-else class="text-placeholder">-</span>
        </template>

        <!-- 确认进度列 -->
        <template #crProgress="{ record }">
          <span :class="{ 'progress-done': progressDone(record) }">{{ progressLabel(record) }}</span>
        </template>

        <!-- 模式列：ai_mode 可能是逗号拼接的多值（如 "batch,agent"），拆分后逐个映射中文，用顿号连接 -->
        <template #crMode="{ record }">
          <template v-if="record.ai_mode?.trim()">
            <a-space :size="2" wrap>
              <a-tag
                v-for="code in record.ai_mode.split(',').map((s: string) => s.trim()).filter(Boolean)"
                :key="code"
                :color="modeLabels[code]?.color ?? 'gray'"
                size="small"
              >
                {{ modeLabels[code]?.label ?? code }}
              </a-tag>
            </a-space>
          </template>
          <span v-else class="text-placeholder">-</span>
        </template>

        <!-- 确认率列 -->
        <template #crRate="{ record }">
          {{ record.confirm_rate != null ? `${(record.confirm_rate * 100).toFixed(1)}%` : '-' }}
        </template>

        <!-- 平均置信度列 -->
        <template #crConf="{ record }">
          {{ record.avg_confidence != null ? Number(record.avg_confidence).toFixed(2) : '-' }}
        </template>

        <!-- 待确认列：先表达 AI 确认的「是否触发 / 排队中 / 执行中」，再表达候选结果分布 -->
        <template #crPending="{ record }">
          <a-tooltip :content="confirmStateTooltip(record)" position="top">
            <a-tag :color="confirmStateColor(record)" size="small">
              {{ confirmStateLabel(record) }}
            </a-tag>
          </a-tooltip>
        </template>

        <!-- 操作列：最常用"查看明细"在外，其余收入"更多"下拉 -->
        <template #crOps="{ record }">
          <a-space :size="4">
            <!-- 主操作：查看明细 -->
            <a-button type="text" size="small" @click="viewDetail(record)">
              查看明细
            </a-button>
            <!-- 更多操作下拉 -->
            <a-dropdown trigger="click">
              <a-button type="text" size="small">
                更多<icon-down />
              </a-button>
              <template #content>
                <!-- 查看错误：仅在有 error 时启用 -->
                <a-doption
                  :disabled="!record.error"
                  @click="() => record.error && viewErrors(record)"
                >
                  查看错误{{ record.error ? `(${record.error})` : '' }}
                </a-doption>
                <!-- 重扫未完成：可重跑数量为 0 时禁用 -->
                <a-doption
                  :disabled="retryableCount(record) === 0 || retryingRunId === record.run_id"
                  @click="() => retryableCount(record) > 0 && retryErrors(record)"
                >
                  <a-spin v-if="retryingRunId === record.run_id" :size="12" />
                  重扫未完成{{ retryableCount(record) ? `(${retryableCount(record)})` : '' }}
                </a-doption>
                <!-- 删除运行：preparing/running 时禁用，危险色 -->
                <a-tooltip
                  v-if="deleteDisabled(record)"
                  content="进行中的运行不能删除，请等待其结束（succeeded / failed / skipped）后再操作"
                  position="left"
                >
                  <a-doption disabled>
                    删除
                  </a-doption>
                </a-tooltip>
                <a-doption
                  v-else
                  status="danger"
                  :disabled="deletingRunId === record.run_id"
                  @click="() => confirmDeleteRun(record)"
                >
                  <a-spin v-if="deletingRunId === record.run_id" :size="12" />
                  <span :style="deletingRunId !== record.run_id ? { color: 'rgb(var(--danger-6))' } : {}">删除</span>
                </a-doption>
              </template>
            </a-dropdown>
          </a-space>
        </template>
      </a-table>
    </a-card>

    <!-- 任务队列：静态扫描的 AI 确认/自主审计任务在此排队与执行 -->
    <a-card :bordered="false">
      <template #title>
        任务队列
        <small class="card-sub">
          待领取 {{ queueStats.pending ?? 0 }} ／ 执行中 {{ queueStats.running ?? 0 }}
          ／ 成功 {{ queueStats.succeeded ?? 0 }} ／ 已失败 {{ queueStats.dead ?? 0 }}
          ·失败不自动重试，需手动重扫
        </small>
      </template>
      <a-space class="m-b-8px">
        <a-select v-model="queueStatus" placeholder="队列状态" allow-clear style="width: 150px" @change="loadQueue">
          <a-option value="pending">待领取</a-option>
          <a-option value="running">执行中</a-option>
          <a-option value="succeeded">成功</a-option>
          <a-option value="dead">已失败</a-option>
        </a-select>
        <a-button type="primary" @click="loadQueue">刷新</a-button>
        <a-button status="warning" :disabled="queueSelected.length === 0" @click="forceFailQueueSelected">
          标记失败{{ queueSelected.length ? `(${queueSelected.length})` : '' }}
        </a-button>
        <a-button status="danger" :disabled="queueSelected.length === 0" @click="deleteQueueSelected">
          删除选中{{ queueSelected.length ? `(${queueSelected.length})` : '' }}
        </a-button>
      </a-space>
      <a-table
        v-model:selectedKeys="queueSelected"
        :loading="queueLoading"
        :data="queueRows"
        :columns="queueColumns"
        row-key="id"
        :row-selection="{ type: 'checkbox', showCheckedAll: true }"
        :pagination="{ pageSize: 10, showTotal: true }"
        size="small"
        :scroll="{ x: 1200 }"
      >
        <template #qkind="{ record }">
          {{ queueKindLabels[record.task_kind] ?? record.task_kind }}
        </template>
        <template #qstatus="{ record }">
          <a-tag :color="queueStatusLabels[record.status]?.color ?? 'gray'">
            {{ queueStatusLabels[record.status]?.label ?? record.status }}
          </a-tag>
        </template>
        <template #qattempt="{ record }">
          {{ record.attempt }}/{{ record.max_attempt }}
        </template>
      </a-table>
    </a-card>
  </div>
</template>

<style scoped>
.static-scan-runs { padding: 0; }
.selector-label { color: var(--color-text-2); }
.card-sub { margin-left: 12px; color: var(--color-text-3); font-weight: normal; font-size: 12px; }
.model-name { font-weight: 500; }
.model-pending { color: var(--color-text-3); font-style: italic; }
.progress-done { color: rgb(var(--green-6)); font-weight: 500; }
.branch-name { font-family: var(--font-mono, monospace); font-size: 12px; color: var(--color-text-2); }
.commit-sha { font-family: var(--font-mono, monospace); font-size: 12px; cursor: default; }
.text-placeholder { color: var(--color-text-4); }
</style>
