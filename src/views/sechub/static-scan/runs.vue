<script setup lang="ts">
import type { TableData } from '@arco-design/web-vue'
import type { TableComponents } from '@arco-design/web-vue/es/table/interface'
import type { RepoScope } from './components/useRepoScopeTree'
import type { NewScanOpenOptions } from './new-scan/types'
import type { ColumnFilterState } from '@/hooks'
import type { CrossRunAggRow } from '@/types/static-scan'
import { Checkbox, Message, Modal, Tooltip } from '@arco-design/web-vue'

import { computed, h, onActivated, onDeactivated, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ApiAiExecution } from '@/api/aiApis'
import { ApiSecPrescan } from '@/api/sechubApis'
import ColumnFilterPanel from '@/components/common/ColumnFilterPanel.vue'
import { applyColumnFilters, emptyFilter, formatTime, isFilterActive, postAction, useFilterPersistence, useGet, useTableAutoHeight } from '@/hooks'
import RepoScopeTree from './components/RepoScopeTree.vue'
import RunLifecycleTags from './components/RunLifecycleTags.vue'
import ScanScopeTag from './components/ScanScopeTag.vue'
import { pendingSubLabel, pendingTooltip, runStatusLabels } from './labels'
import AiConfirmModal from './new-scan/AiConfirmModal.vue'
import BatchAiConfirmModal from './new-scan/BatchAiConfirmModal.vue'
import { aiConfirmBlockedReason, batchAiConfirmBlockedReason, confirmTriggered, rowCheckboxBlockedReason, rowCheckboxTooltip } from './new-scan/labels'
import NewScanModal from './new-scan/NewScanModal.vue'

// 组件名必须与路由 name（= sys_menu.path）一致，keep-alive :include 按它对上缓存
// （见 components/layout/app-main.vue 的注释）。lint 的 PascalCase 提示只是警告，
// 改名却会让页签缓存失效，所以此处保持 kebab-case。
// eslint-disable-next-line vue/component-definition-name-casing
defineOptions({ name: 'runs' })

const route = useRoute()
const router = useRouter()

// ===== 应用范围（左树）=====
// 左树组件内部维护仓库数据与选中状态（useRepoScopeTree，含跨实例持久化），
// 这里只消费它解析出的范围：repositoryId 用于后端过滤 + 「新建扫描」启用判断，
// repositoryIds 用于分组节点在本地筛运行行（后端只认单个 repository_id）。
const scopeTreeRef = ref<InstanceType<typeof RepoScopeTree>>()
const repoScope = ref<RepoScope>({ repositoryId: '', repositoryIds: null, label: '全部' })

/** 路由预填：把左树切到指定仓库（高亮 + 运行列表范围一致） */
function selectScopeRepo(repositoryId: string) {
  scopeTreeRef.value?.selectRepo(repositoryId)
}

// ===== 状态查询字段（客户端过滤：后端只按仓库过滤）=====
const selectedStatus = ref('')

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
  static_scan_verify: '自动复核',
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
  { title: '创建时间', dataIndex: 'created_at', width: 160, render: ({ record }: any) => formatTime(record.created_at) },
]

// ===== 模型结果总览（跨 Run 横评：后端已改为每个 run_id 只返回一行汇总）=====
const crossRows = ref<CrossRunAggRow[]>([])
// 行 key 直接用 run_id（后端保证每个 run_id 只有一行，不再需要拼 ai_model/ai_mode）；
// disabled 让 Arco 跳过整行勾选（含全选框），具体原因见勾选列的 tooltip
const crossTableRows = computed(() => crossRows.value.map(row => ({
  ...row,
  key: row.run_id,
  disabled: rowCheckboxBlockedReason(row) !== '',
})))
// ===== 列过滤（前端过滤，见 @/hooks/util/useColumnFilter）=====
// 每列一份条件，key 用 dataIndex。文本列给"包含/不包含/等于/不等于"，
// 数字列给"大于/小于"，时间列给"从…到…"。
const columnFilters = ref<Record<string, ColumnFilterState>>({
  repository_name: emptyFilter('text'),
  branch: emptyFilter('text'),
  ai_model: emptyFilter('text'),
  total: emptyFilter('number'),
  confirmed: emptyFilter('number'),
  rejected: emptyFilter('number'),
  error: emptyFilter('number'),
  risk_high: emptyFilter('number'),
  created_at: emptyFilter('date'),
})

// ===== 分页（客户端分页：cross-run-compare 一次返回全量，这里切页展示）=====
// 声明在过滤逻辑之前：onColumnFilterChange 需要重置页码
const pageNum = ref(1)
const pageSize = ref(20)

/** 过滤条件变化后回到第一页，否则可能停在一个已经没有数据的页码上 */
function onColumnFilterChange() {
  pageNum.value = 1
}

/** 该列是否已生效（用于给表头图标高亮，Arco 靠 filteredValue 判断） */
function filteredValueOf(key: string): string[] {
  return isFilterActive(columnFilters.value[key]) ? ['1'] : []
}

/**
 * 生成一列的 filterable 配置。
 * filter 返回 true 是因为真正的过滤在 filteredCrossRows 里统一做 ——
 * Arco 的 filter 回调只能拿到单元格值，拿不到"多列条件同时生效"的全局视图。
 */
function filterableOf(key: string) {
  return {
    slotName: `filter-${key}`,
    filteredValue: filteredValueOf(key),
    filter: () => true,
    // 面板由我们自己渲染，不需要 Arco 的确认按钮
    hideButton: true,
  }
}

// 应用「左树范围」「状态」查询字段做客户端过滤（仓库级过滤已由后端 repository_id 完成，
// 分组/子分组节点用左树解析出的仓库 id 集合在本地收窄）
const filteredCrossRows = computed(() => {
  const base = crossTableRows.value.filter((row) => {
    if (repoScope.value.repositoryIds && !repoScope.value.repositoryIds.includes(row.repository_id))
      return false
    if (selectedStatus.value && row.status !== selectedStatus.value)
      return false
    return true
  })
  // 再叠加表头的列过滤（多列条件是"且"关系，统一在这里应用）
  return applyColumnFilters(base, columnFilters.value)
})
const crossLoading = ref(false)

/** 请求序号：切范围 / 轮询 / 手动查询可能并发，丢弃慢响应防止旧范围的数据覆盖新范围的 */
let crossSeq = 0

async function loadCrossRows(silent = false) {
  const seq = ++crossSeq
  if (!silent)
    crossLoading.value = true
  try {
    const params = new URLSearchParams()
    if (repoScope.value.repositoryId)
      params.set('repository_id', repoScope.value.repositoryId)
    const data = await fetchJson<CrossRunAggRow[]>(`${ApiSecPrescan.crossRunCompare}?${params.toString()}`)
    if (seq !== crossSeq)
      return
    crossRows.value = data ?? []
  }
  finally {
    // 收敛 spinner 的权力只给最新一次请求：静默轮询也可能是"最新"，
    // 而它后面的旧响应都是被丢弃的，不能拿它们来清 loading
    if (seq === crossSeq)
      crossLoading.value = false
  }
  schedulePollIfNeeded()
}

// ===== AI 确认轮询：任一任务存在待确认候选时每 15 秒静默刷新 =====
const pollTimer = ref<ReturnType<typeof setTimeout> | null>(null)

// 除了「还有待确认候选」，只要有批次在排队或执行中也要继续轮询，
// 否则「排队中 → 执行中 → 完成」的阶段变化不会自动回显。
function hasActiveWork(): boolean {
  return crossRows.value.some(r =>
    (r.pending ?? 0) > 0
    || (r.queue_pending ?? r.ai_exec_pending ?? 0) > 0
    || (r.queue_running ?? r.ai_exec_running ?? 0) > 0,
  )
}

function schedulePollIfNeeded() {
  if (pollTimer.value) {
    clearTimeout(pollTimer.value)
    pollTimer.value = null
  }
  if (hasActiveWork())
    pollTimer.value = setTimeout(() => void loadCrossRows(true), 15000)
}

// 缓存安全（keep-alive）：切页签只触发 onDeactivated，轮询必须先停，否则缓存的页在
// 后台继续刷接口；回页签时仍有排队/执行/待确认的批次就静默补刷一次（内部重排轮询），
// 不重置筛选；onUnmounted 保留兜底。
function pausePoll() {
  if (pollTimer.value) {
    clearTimeout(pollTimer.value)
    pollTimer.value = null
  }
}
onDeactivated(pausePoll)
onActivated(() => {
  if (hasActiveWork())
    void loadCrossRows(true)
  void applyNewScanQuery()
})
onMounted(() => void applyNewScanQuery())
onUnmounted(pausePoll)

// ===== 新建扫描 / AI 确认（入口从扫描看板迁来）=====
const newScanRef = ref<InstanceType<typeof NewScanModal>>()
const aiConfirmRef = ref<InstanceType<typeof AiConfirmModal>>()

/** 新建弹窗「已有 N 条扫描记录」幂等提示的计数来源：当前列表里该应用的运行数 */
function countRunsOfRepository(repositoryId: string): number {
  return crossRows.value.filter(row => row.repository_id === repositoryId).length
}

/** 新建扫描：门控要求左树选中了具体仓库，弹窗据此锁定该仓库 */
function openNewScan() {
  if (!repoScope.value.repositoryId) {
    Message.warning('请先在左侧应用范围树中选择具体仓库')
    return
  }
  void newScanRef.value?.open({ repositoryId: repoScope.value.repositoryId, lockRepository: true })
}

function onNewScanCreated() {
  void loadCrossRows()
}

/** 行级 AI 确认：仅「预扫描完成」的批次有候选可确认 */
function openAiConfirm(row: CrossRunAggRow) {
  if (aiConfirmBlockedReason(row.run_id, row.status))
    return
  aiConfirmRef.value?.open(row.run_id)
}

function onAiConfirmSubmitted() {
  void loadCrossRows()
}

/**
 * 路由预填：资产详情「发起专项扫描」/ 看板跳来带 `new_scan=1&repository_id=..`，据此直接打开新建弹窗。
 * 20261008 起表单/微服务旧轨已从弹窗移除，`scan_target` / `asset_ids` 不再生效：
 * 统一扫描自动覆盖该仓全部在用资产。
 *
 * 本页被 keep-alive 缓存：首次进入只触发 onMounted、之后从别的页签回来触发 onActivated，
 * 两处都要处理；`handledQueryKey` 兜住首次进入时两个钩子先后触发的重复打开。
 * 处理过就把 query replace 掉，避免刷新/回退时再次弹窗。
 */
let handledQueryKey = ''
async function applyNewScanQuery() {
  if (!('new_scan' in route.query)) {
    handledQueryKey = ''
    return
  }
  const key = route.fullPath
  if (handledQueryKey === key)
    return
  handledQueryKey = key
  const opts: NewScanOpenOptions = {
    repositoryId: typeof route.query.repository_id === 'string' ? route.query.repository_id : undefined,
  }
  // 左树跟着切到该仓库（高亮 + 列表范围一致），再打开弹窗预填
  if (opts.repositoryId)
    selectScopeRepo(opts.repositoryId)
  await router.replace({ path: route.path, query: {} })
  void newScanRef.value?.open(opts)
}

// 默认加载全部数据
loadCrossRows()

function onSearch() {
  void loadCrossRows()
}

/**
 * 表格滚动配置：横向固定宽度，纵向用自适应高度（滚动条落在表格内、表头固定）。
 */
const tableWrap = ref<HTMLElement>()
const { tableHeight } = useTableAutoHeight(tableWrap)
const crossScroll = computed(() => ({ x: 1700, y: tableHeight.value }))

// 筛选条件持久化：切到别的页签再回来、或点进详情再返回时，保持上次的筛选。
// 这个页面没有"带参数跳转进入"的场景（它是入口页），所以不需要 skipRestore。
// 左树的范围（维度 + 选中节点）由 RepoScopeTree 自己暂存，不在这里。
useFilterPersistence('static-scan-runs', {
  selectedStatus,
  pageSize,
  columnFilters,
})
const pagedCrossRows = computed(() => {
  const start = (pageNum.value - 1) * pageSize.value
  return filteredCrossRows.value.slice(start, start + pageSize.value)
})
// 状态是客户端过滤，变化后回到第一页，避免停在越界页码上看到空表
watch(selectedStatus, () => {
  pageNum.value = 1
})

/** 左树范围变化：重置页码并按新范围重载（后端按 repository_id 过滤，分组节点再本地收窄） */
function onScopeChange(scope: RepoScope) {
  repoScope.value = scope
  pageNum.value = 1
  void loadCrossRows()
}

// ===== 批量重扫未完成（多选工程/运行后，只重扫其剩余未完成任务）=====
const selectedRunKeys = ref<string[]>([])
const bulkRetrying = ref(false)

/** 选中行里真正有可重扫内容的（可重跑数量 > 0） */
const bulkRetryTargets = computed(() =>
  filteredCrossRows.value.filter(r => selectedRunKeys.value.includes(r.run_id) && retryableCount(r) > 0),
)

// ===== 批量 AI 确认（勾选多个尚未开始确认的运行，逐个触发）=====
const batchConfirmRef = ref<InstanceType<typeof BatchAiConfirmModal>>()

/** 勾选行里可参与批量确认的（未成功/已确认过/确认中已在勾选列置灰，这里再按同一口径兜一层） */
const batchConfirmTargets = computed(() =>
  filteredCrossRows.value.filter(r => selectedRunKeys.value.includes(r.run_id) && !batchAiConfirmBlockedReason(r)),
)

/** 「AI 确认」按钮禁用时的说明（按钮可用时为空串） */
const batchConfirmDisabledReason = computed(() => {
  if (selectedRunKeys.value.length === 0)
    return '请先勾选要确认的运行（预扫描完成、尚未开始 AI 确认的运行）'
  if (batchConfirmTargets.value.length === 0)
    return '勾选的运行都不满足批量确认条件：需预扫描完成、尚未触发过 AI 确认、无在途确认任务'
  return ''
})

function openBatchConfirm() {
  if (batchConfirmTargets.value.length === 0) {
    Message.warning(batchConfirmDisabledReason.value)
    return
  }
  batchConfirmRef.value?.open(batchConfirmTargets.value)
}

function onBatchConfirmSubmitted() {
  selectedRunKeys.value = []
  void loadCrossRows()
  void loadQueue()
}

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
    lines.push('尚未触发 AI 确认。可在本页该行「更多」里点「AI 确认」。')
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
      h('div', { style: 'color:#86909c;margin-top:4px' }, '默认只重扫未完成部分，已确认/待人工复核/已排除的结论不受影响。'),
      opts.settled > 0
        ? h('div', { style: 'margin-top:10px' }, [
            h(Checkbox, {
              'modelValue': include.value,
              'onUpdate:modelValue': (v: any) => { include.value = Boolean(v) },
            }, () => `连已出结论的一起重扫（额外 ${opts.settled} 条：已确认 + 待人工复核）`),
            h('div', { style: 'color:#f77234;margin-top:4px;font-size:12px' }, '勾选后这些候选的 AI 结论与详细报告会被清空并重新判定，请确认已无人跟进。'),
          ])
        : h('div', { style: 'color:#86909c;margin-top:8px;font-size:12px' }, '该范围内没有已出结论的候选。'),
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

/** 进行中的运行：可能是真在跑，也可能是崩溃后卡住的僵尸 —— 确认框里说清并用强制删除 */
function isRunningStatus(row: CrossRunAggRow): boolean {
  return row.status === 'preparing' || row.status === 'running'
}

/** 弹二次确认框，用户确认后执行删除 */
function confirmDeleteRun(row: CrossRunAggRow): void {
  const appName = row.repository_name ?? row.repository_id
  const commit = shortSha(row.commit_sha) || '(无 commit)'
  const stuck = isRunningStatus(row)
  Modal.warning({
    title: stuck ? '该运行仍在「扫描中」，确认强制删除？' : '确认删除该扫描运行？',
    content: stuck
      ? `应用「${appName}」的运行（commit：${commit}）当前状态为「${stuck ? row.status : ''}」。\n\n`
      + '若服务刚重启过、它是崩溃留下的僵尸运行，强制删除即可；\n'
      + '若任务真的还在跑，删除会让它后续写入失败（该任务会自行报错结束）。'
      : `即将删除应用「${appName}」的运行（commit：${commit}）。\n\n此操作将同时删除该运行的扫描结果详情与磁盘产物，且不可恢复。\n已提的问题（sec_scan_issue）不会被删除，会继续保留。`,
    okText: stuck ? '强制删除' : '确认删除',
    cancelText: '取消',
    okButtonProps: { status: 'danger' },
    onOk: () => {
      void doDeleteRun(row, stuck)
    },
  })
}

async function doDeleteRun(row: CrossRunAggRow, force = false): Promise<void> {
  deletingRunId.value = row.run_id
  try {
    const resp = await postAction<DeleteRunResult>(ApiSecPrescan.runDelete, { run_id: row.run_id, force })
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

// 扫描策略（sec_prescan_run.delta_kind）：空 = 全量扫描；差量类型 + 比对基线一起看才知道"扫的是什么范围"
const deltaKindLabels: Record<string, string> = {
  skip: '跳过',
  code_delta: '代码差量',
  rule_delta: '规则差量',
  hybrid_delta: '混合差量',
  full_baseline: '全量基线',
  hunk_quick: '按行差量',
  reconfirm: '重新确认',
}

function strategyLabel(record: CrossRunAggRow): string {
  if (!record.delta_kind)
    return '全量'
  const label = deltaKindLabels[record.delta_kind] ?? record.delta_kind
  return record.base_commit ? `${label} @${record.base_commit.slice(0, 8)}` : label
}

function strategyTooltip(record: CrossRunAggRow): string {
  const parts = [`策略：${record.delta_kind ? (deltaKindLabels[record.delta_kind] ?? record.delta_kind) : '全量扫描'}`]
  if (record.base_commit)
    parts.push(`差量基线：${record.base_commit}`)
  parts.push(`领域范围：${record.domains?.trim() || '全部领域'}`)
  return parts.join('\n')
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
// resizable: true —— 列宽可拖动（Arco 2.58 原生支持）
const crossColumns = computed(() => [
  { title: '应用', dataIndex: 'repository_name', width: 160, ellipsis: true, tooltip: true, resizable: true, filterable: filterableOf('repository_name') },
  { title: '分支', dataIndex: 'branch', slotName: 'crBranch', width: 120, ellipsis: true, tooltip: true, resizable: true, filterable: filterableOf('branch') },
  { title: 'Commit', dataIndex: 'commit_sha', slotName: 'crCommit', width: 110, resizable: true },
  { title: '模型', dataIndex: 'ai_model', slotName: 'crModel', width: 150, ellipsis: true, tooltip: true, resizable: true, filterable: filterableOf('ai_model') },
  { title: '模式', dataIndex: 'ai_mode', slotName: 'crMode', width: 95, resizable: true },
  // 策略列：这一批"扫的是什么范围"——统一扫描/判定状态标签 + 全量 / 差量类型 + 比对基线 + 领域范围
  { title: '策略', dataIndex: 'delta_kind', slotName: 'crStrategy', width: 220, ellipsis: true, tooltip: true, resizable: true, filterable: filterableOf('delta_kind') },
  { title: '总数', dataIndex: 'total', width: 70, resizable: true, filterable: filterableOf('total') },
  { title: '确认进度', dataIndex: 'progress', slotName: 'crProgress', width: 90, resizable: true },
  { title: '确认问题', dataIndex: 'confirmed', width: 85, resizable: true, filterable: filterableOf('confirmed') },
  { title: '已排除', dataIndex: 'rejected', width: 80, resizable: true, filterable: filterableOf('rejected') },
  { title: '错误', dataIndex: 'error', width: 70, resizable: true, filterable: filterableOf('error') },
  { title: '状态', dataIndex: 'pending', slotName: 'crPending', width: 190, resizable: true },
  { title: '高风险', dataIndex: 'risk_high', width: 75, resizable: true, filterable: filterableOf('risk_high') },
  { title: '中风险', dataIndex: 'risk_medium', width: 75, resizable: true },
  { title: '低风险', dataIndex: 'risk_low', width: 75, resizable: true },
  { title: '确认率', dataIndex: 'confirm_rate', slotName: 'crRate', width: 80, resizable: true },
  { title: '平均置信度', dataIndex: 'avg_confidence', slotName: 'crConf', width: 95, resizable: true },
  // 时间列原先 120px，而 'YYYY-MM-DD HH:MM:SS' 是 19 个字符，必然折行 ——
  // 实测折成三行，把整行撑高、表格也跟着变宽。给足宽度并 ellipsis 兜底。
  { title: '时间', dataIndex: 'created_at', width: 170, ellipsis: true, tooltip: true, resizable: true, filterable: filterableOf('created_at'), render: ({ record }: any) => formatTime(record.created_at) },
  { title: '操作', slotName: 'crOps', width: 160, fixed: 'right' as const },
])

// ===== 勾选列（自定义渲染：置灰 + hover 说明原因）=====
// Arco 默认的勾选列不会解释"为什么不能勾"，而本页勾选同时服务「批量重扫未完成」
// 与「批量 AI 确认」两个动作，禁用口径（见 new-scan/labels.ts 的
// rowCheckboxBlockedReason/rowCheckboxTooltip）必须能 hover 出来。
// Arco 允许用 components.operations 覆盖操作列：交出 selection 并用
// render 兜住——表格体会调用 operationColumn.render(record.raw)
// （@arco-design/web-vue/es/table/table-operation-td.js）。
// 表头的全选框不走 render，按行上的 disabled 跳过置灰行，与逐行口径天然一致。
const tableComponents: TableComponents = {
  operations: ({ selection }) => {
    if (!selection)
      return []
    return [{
      ...selection,
      render: (record: TableData) => selectionCell(record as unknown as CrossRunAggRow),
    }]
  },
}

function selectionCell(row: CrossRunAggRow) {
  const reason = rowCheckboxTooltip(row)
  const checkbox = h(Checkbox, {
    'modelValue': selectedRunKeys.value.includes(row.run_id),
    'disabled': rowCheckboxBlockedReason(row) !== '',
    // 自定义渲染脱离了 a-table 的 selection 上下文，勾选状态要自己写回，
    // uninjectGroupContext 避免误读外层分组状态
    'uninjectGroupContext': true,
    'onUpdate:modelValue': (value: unknown) => toggleRunChecked(row.run_id, Boolean(value)),
  })
  // disabled 的 checkbox 自身不触发 Tooltip（禁用时无指针事件），套一层 span 承接 hover
  return h(
    Tooltip,
    { content: reason, disabled: !reason, mini: true, position: 'right' },
    { default: () => h('span', { class: 'cell-checkbox' }, checkbox) },
  )
}

/** 手动维护勾选集：自定义 render 不再走 Arco 内部的 tableCtx.onSelect 通路 */
function toggleRunChecked(runId: string, checked: boolean) {
  const next = new Set(selectedRunKeys.value)
  if (checked)
    next.add(runId)
  else
    next.delete(runId)
  selectedRunKeys.value = [...next]
}
</script>

<template>
  <div class="static-scan-runs">
    <div class="runs-split">
      <!-- 左树：应用范围（维度 → 分组 → 仓库），与扫描看板同一套口径；
           运行列表跟随所选范围，未选中具体仓库时不能新建扫描 -->
      <RepoScopeTree ref="scopeTreeRef" class="runs-scope" @change="onScopeChange" />
      <div class="runs-main">
        <!-- 查询条件：应用范围的仓库过滤已由左树承担（走后端 repository_id），这里只留状态 -->
        <a-card :bordered="false" class="m-b-12px">
          <a-space>
            <span class="selector-label">范围</span>
            <a-tag :color="repoScope.repositoryId ? 'arcoblue' : 'gray'">
              {{ repoScope.label }}
            </a-tag>
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
              <!-- 门控：未选具体仓库时不可新建（弹窗内的仓库下拉也锁定为左树选中项） -->
              <a-tooltip
                :content="repoScope.repositoryId ? '' : '请先在左侧应用范围树中选择具体仓库'"
                :disabled="!!repoScope.repositoryId"
              >
                <span>
                  <a-button type="primary" :disabled="!repoScope.repositoryId" @click="openNewScan">
                    <template #icon>
                      <icon-plus />
                    </template>
                    新建扫描
                  </a-button>
                </span>
              </a-tooltip>
              <!-- 批量 AI 确认：勾选「预扫描完成、尚未开始确认」的运行后逐个触发；置灰时 hover 出原因 -->
              <a-tooltip :content="batchConfirmDisabledReason" :disabled="!batchConfirmDisabledReason">
                <span>
                  <a-button
                    type="primary"
                    :disabled="batchConfirmTargets.length === 0"
                    @click="openBatchConfirm"
                  >
                    AI 确认{{ batchConfirmTargets.length ? `(${batchConfirmTargets.length})` : '' }}
                  </a-button>
                </span>
              </a-tooltip>
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
          <div ref="tableWrap">
            <a-table
              v-model:selected-keys="selectedRunKeys"
              :loading="crossLoading"
              :data="pagedCrossRows"
              :columns="crossColumns"
              :components="tableComponents"
              column-resizable
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
              :bordered="{ cell: true }"
              :scroll="crossScroll"
              @page-change="(p: number) => (pageNum = p)"
              @page-size-change="(s: number) => { pageSize = s; pageNum = 1 }"
            >
              <template #filter-repository_name>
                <ColumnFilterPanel v-model="columnFilters.repository_name" @change="onColumnFilterChange" />
              </template>
              <template #filter-branch>
                <ColumnFilterPanel v-model="columnFilters.branch" @change="onColumnFilterChange" />
              </template>
              <template #filter-ai_model>
                <ColumnFilterPanel v-model="columnFilters.ai_model" @change="onColumnFilterChange" />
              </template>
              <template #filter-total>
                <ColumnFilterPanel v-model="columnFilters.total" @change="onColumnFilterChange" />
              </template>
              <template #filter-confirmed>
                <ColumnFilterPanel v-model="columnFilters.confirmed" @change="onColumnFilterChange" />
              </template>
              <template #filter-rejected>
                <ColumnFilterPanel v-model="columnFilters.rejected" @change="onColumnFilterChange" />
              </template>
              <template #filter-error>
                <ColumnFilterPanel v-model="columnFilters.error" @change="onColumnFilterChange" />
              </template>
              <template #filter-risk_high>
                <ColumnFilterPanel v-model="columnFilters.risk_high" @change="onColumnFilterChange" />
              </template>
              <template #filter-created_at>
                <ColumnFilterPanel v-model="columnFilters.created_at" @change="onColumnFilterChange" />
              </template>
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

              <!-- 策略列：统一扫描带扫描方式标签（全量 / 增量 / 部分）；历史 run 没有 scan_scope，退回旧的策略文案 -->
              <template #crStrategy="{ record }">
                <RunLifecycleTags :target-type="record.target_type" :confirm-state="record.confirm_state" />
                <ScanScopeTag :scan-scope="record.scan_scope" :rule-count="record.rule_count" :base-commit="record.base_commit" />
                <a-tooltip v-if="!record.scan_scope" :content="strategyTooltip(record)" mini>
                  <span>{{ strategyLabel(record) }}</span>
                </a-tooltip>
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
                      <!-- AI 确认：仅预扫描 succeeded 的运行可发起；禁用时 title 说明原因 -->
                      <a-doption
                        :disabled="!!aiConfirmBlockedReason(record.run_id, record.status)"
                        :title="aiConfirmBlockedReason(record.run_id, record.status) || '对该运行的候选发起 AI 确认'"
                        @click="() => openAiConfirm(record)"
                      >
                        AI 确认
                      </a-doption>
                      <!-- 删除运行：preparing/running 也允许（崩溃会留下卡住的僵尸运行），
                     确认框里明确告知风险并按强制删除提交 -->
                      <a-doption
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
          </div>
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
              <a-option value="pending">
                待领取
              </a-option>
              <a-option value="running">
                执行中
              </a-option>
              <a-option value="succeeded">
                成功
              </a-option>
              <a-option value="dead">
                已失败
              </a-option>
            </a-select>
            <a-button type="primary" @click="loadQueue">
              刷新
            </a-button>
            <a-button status="warning" :disabled="queueSelected.length === 0" @click="forceFailQueueSelected">
              标记失败{{ queueSelected.length ? `(${queueSelected.length})` : '' }}
            </a-button>
            <a-button status="danger" :disabled="queueSelected.length === 0" @click="deleteQueueSelected">
              删除选中{{ queueSelected.length ? `(${queueSelected.length})` : '' }}
            </a-button>
          </a-space>
          <a-table
            v-model:selected-keys="queueSelected"
            :loading="queueLoading"
            :data="queueRows"
            :columns="queueColumns"
            column-resizable
            row-key="id"
            :row-selection="{ type: 'checkbox', showCheckedAll: true }"
            :pagination="{ pageSize: 10, showTotal: true }"
            size="small"
            :scroll="{ minWidth: 1200 }"
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

        <!-- 新建扫描弹窗：入口在本页头部按钮与 route query 预填（看板/资产详情跳转） -->
        <NewScanModal ref="newScanRef" :run-count-of="countRunsOfRepository" @created="onNewScanCreated" />
        <!-- AI 确认弹窗：行级入口，对指定 run 的候选批量发起确认 -->
        <AiConfirmModal ref="aiConfirmRef" :runs="crossRows" @submitted="onAiConfirmSubmitted" />
        <!-- 批量 AI 确认弹窗：对勾选的多个 run 逐个提交，展示每个的成功/失败 -->
        <BatchAiConfirmModal ref="batchConfirmRef" @submitted="onBatchConfirmSubmitted" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.static-scan-runs { padding: 0; }
/* 左右分栏：左树固定宽度、右侧运行区域自适应；树体由 useAutoHeight 内部滚动 */
.runs-split { display: flex; align-items: flex-start; gap: 12px; }
.runs-scope { flex: 0 0 300px; width: 300px; }
.runs-main { flex: 1; min-width: 0; }
/* 勾选列自定义 checkbox 的外层：承接 hover 目标，禁用行也能弹出原因 tooltip */
.cell-checkbox { display: inline-flex; }
.selector-label { color: var(--color-text-2); }
.card-sub { margin-left: 12px; color: var(--color-text-3); font-weight: normal; font-size: 12px; }
.model-name { font-weight: 500; }
.model-pending { color: var(--color-text-3); font-style: italic; }
.progress-done { color: rgb(var(--green-6)); font-weight: 500; }
.branch-name { font-family: var(--font-mono, monospace); font-size: 12px; color: var(--color-text-2); }
.commit-sha { font-family: var(--font-mono, monospace); font-size: 12px; cursor: default; }
.text-placeholder { color: var(--color-text-4); }
</style>
