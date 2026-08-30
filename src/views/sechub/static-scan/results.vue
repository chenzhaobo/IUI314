<script setup lang="ts">
import type {
  CandidateDetailPage,
  CandidateDetailRow,
  CrossRunAggRow,
  ModuleWithRepository,
  RuleStatRow,
} from '@/types/static-scan'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { MdPreview } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'
import { Message } from '@arco-design/web-vue'
import { ApiSecModuleRepository, ApiSecPrescan, ApiSecProjectGroup } from '@/api/sechubApis'
import { ErrorFlag } from '@/api/apis'
import { formatTime, useGet, usePost } from '@/hooks'

defineOptions({ name: 'StaticScanResults' })

const route = useRoute()

// ===== 应用列表 =====
const { data: repoList } = useGet<ModuleWithRepository[]>(ApiSecModuleRepository.listWithModule, {}, { immediate: true })
const repositories = computed(() => repoList.value ?? [])
const selectedRepoId = ref('')

// ===== 项目组（级联收窄应用下拉）=====
const { data: pgData } = useGet<any>(ApiSecProjectGroup.getAll, {}, { immediate: true })
const pgOptions = computed(() => (Array.isArray(pgData.value) ? pgData.value : []).map((g: any) => ({ label: g.name, value: g.id })))
const selectedPgId = ref('')

/** 按项目组收窄后的应用列表 */
const filteredRepositories = computed(() => {
  if (!selectedPgId.value)
    return repositories.value
  return repositories.value.filter(r => (r.project_group_id ?? '').trim() === selectedPgId.value)
})

function onPgChange() {
  // 项目组变更后，若当前应用不在组内则清空
  if (selectedRepoId.value && !filteredRepositories.value.some(r => r.repository_id === selectedRepoId.value)) {
    selectedRepoId.value = ''
    onAppChange()
  }
}

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

// ===== 轮次列表（模型 × 模式 横评）=====
const crossRows = ref<CrossRunAggRow[]>([])
const crossLoading = ref(false)
/** 防竞态：记录最新 loadCrossRows 调用序号，旧请求回来时丢弃 */
const crossLoadSeq = ref(0)
// 当前选中轮次（run_id + ai_model + ai_mode 唯一确定一个「模型×模式」轮次）
const currentRun = ref<{ run_id: string, ai_model: string, ai_mode: string } | null>(null)
const selectedRoundKey = ref('')

/**
 * 加载轮次列表。
 * - autoSelectLatest: 若没有已选轮次时自动选中最新轮次（首次进入时用）。
 * - 不清空既有的筛选条件（domainFilter/statusFilter 等），查询按钮只是重新拉数据。
 */
async function loadCrossRows(autoSelectLatest = true) {
  // 用版本号防止竞态：应用快速切换时旧请求回来的数据不覆盖最新选择
  const seq = ++crossLoadSeq.value
  crossLoading.value = true
  try {
    const params = new URLSearchParams()
    if (selectedRepoId.value)
      params.set('repository_id', selectedRepoId.value)
    const rows = await fetchJson<CrossRunAggRow[]>(`${ApiSecPrescan.crossRunCompare}?${params.toString()}`) ?? []
    // 过期响应丢弃
    if (seq !== crossLoadSeq.value)
      return
    crossRows.value = rows
    // 仅在没有已选轮次、且调用方要求时才自动选最新轮次
    if (autoSelectLatest && !selectedRoundKey.value && crossRows.value.length)
      onRoundChange(roundKey(crossRows.value[0]))
  }
  finally {
    if (seq === crossLoadSeq.value)
      crossLoading.value = false
  }
}

function roundKey(r: { run_id: string, ai_model?: string | null, ai_mode?: string | null }): string {
  return `${r.run_id}||${r.ai_model ?? ''}||${r.ai_mode ?? ''}`
}

/**
 * 切换应用时的处理：重置轮次与候选相关状态，重新加载该应用的轮次列表。
 * 不影响 statusFilter/domainFilter 等独立的候选筛选条件。
 */
function onAppChange() {
  currentRun.value = null
  selectedRoundKey.value = ''
  selectedRuleId.value = 'all'
  scanPointFilter.value = ''
  ruleStats.value = []
  candidatePage.value = null
  pageNum.value = 1
  // 重新加载当前应用对应的轮次列表，并自动选中最新轮次
  void loadCrossRows(true)
}

/**
 * 点击"查询"按钮：只重新加载数据，不清空用户已选的筛选条件。
 * 分页归位到第 1 页是合理的（查询语义决定结果集可能完全不同）。
 */
function onSearch() {
  pageNum.value = 1
  // 若已有轮次选择，直接按当前条件刷新候选；否则重新加载轮次列表
  if (currentRun.value) {
    void loadRuleStats()
    void loadCandidates()
  }
  else {
    // 没有选轮次时重新加载轮次列表（按当前应用过滤），并自动选最新轮次
    void loadCrossRows(true)
  }
}

// ===== 一键补偿引入时间 =====
const compensating = ref(false)
async function compensateBlame() {
  if (!currentRun.value) {
    Message.warning('请先选择扫描轮次')
    return
  }
  compensating.value = true
  try {
    const resp = await postAction<{ scanned: number, filled: number, message?: string }>(
      ApiSecPrescan.blameCompensate,
      { run_id: currentRun.value.run_id },
    )
    if (resp) {
      Message.success(resp.message || `引入时间补偿完成：缺失 ${resp.scanned} 条，成功填充 ${resp.filled} 条`)
      void loadCandidates()
    }
  }
  finally {
    compensating.value = false
  }
}

function onRoundChange(value: string | number | boolean | Record<string, unknown> | (string | number | boolean | Record<string, unknown>)[]) {
  if (typeof value !== 'string' && typeof value !== 'number')
    return
  const key = String(value)
  selectedRoundKey.value = key
  if (!key) {
    currentRun.value = null
    ruleStats.value = []
    candidatePage.value = null
    return
  }
  const [run_id, ai_model, ai_mode] = key.split('||')
  currentRun.value = { run_id, ai_model: ai_model ?? '', ai_mode: ai_mode ?? '' }
  selectedRuleId.value = 'all'
  scanPointFilter.value = ''
  pageNum.value = 1
  void loadRuleStats()
  void loadCandidates()
}

// ===== 左树：规则维度统计 =====
const ruleStats = ref<RuleStatRow[]>([])
const ruleStatsLoading = ref(false)
const selectedRuleId = ref('all')
const expandedKeys = ref<string[]>([])

// ===== 左树宽度拖拽 =====
const leftPanelWidth = ref(230)
const isDragging = ref(false)
const PANEL_MIN = 160
const PANEL_MAX = 480

function onDragStart(e: MouseEvent) {
  isDragging.value = true
  const startX = e.clientX
  const startW = leftPanelWidth.value
  const onMove = (ev: MouseEvent) => {
    leftPanelWidth.value = Math.min(PANEL_MAX, Math.max(PANEL_MIN, startW + ev.clientX - startX))
  }
  const onUp = () => {
    isDragging.value = false
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}
/** 从扫描看板跳转时携带的 scan_point_id，用于自动选中对应树节点 */
const pendingScanPointId = ref('')

async function loadRuleStats() {
  if (!currentRun.value) {
    ruleStats.value = []
    return
  }
  ruleStatsLoading.value = true
  try {
    const params = new URLSearchParams({ run_id: currentRun.value.run_id })
    params.set('ai_model', currentRun.value.ai_model)
    params.set('ai_mode', currentRun.value.ai_mode)
    ruleStats.value = await fetchJson<RuleStatRow[]>(`${ApiSecPrescan.ruleStats}?${params.toString()}`) ?? []
    // 默认展开：全部 + 领域 + 扫描点层
    expandedKeys.value = ['all', ...ruleTree.value.flatMap(n => [n.key, ...(n.children ?? []).map(c => c.key)])]
    // 自动选中跳转携带的 scan_point_id 对应的扫描点节点
    if (pendingScanPointId.value) {
      const match = ruleStats.value.find(r => r.scan_point_id === pendingScanPointId.value)
      if (match) {
        selectedRuleId.value = `sp:${match.scan_point_id}`
        scanPointFilter.value = match.scan_point_id
        pageNum.value = 1
        void loadCandidates()
      }
      pendingScanPointId.value = ''
    }
  }
  finally {
    ruleStatsLoading.value = false
  }
}

// 左树数据：全部（根）→ domain 分组 → 扫描点 → 规则版本节点
const ruleTree = computed(() => {
  const groups = new Map<string, RuleStatRow[]>()
  for (const r of ruleStats.value) {
    const d = r.domain || '未分类'
    if (!groups.has(d))
      groups.set(d, [])
    groups.get(d)!.push(r)
  }
  const domainNodes = Array.from(groups.entries()).map(([domain, rules]) => {
    // 域内按扫描点分组，扫描点下挂规则版本
    const spGroups = new Map<string, RuleStatRow[]>()
    for (const r of rules) {
      const spId = r.scan_point_id || 'unknown'
      if (!spGroups.has(spId))
        spGroups.set(spId, [])
      spGroups.get(spId)!.push(r)
    }
    return {
      key: `domain:${domain}`,
      title: domainLabel(domain),
      children: Array.from(spGroups.entries()).map(([spId, spRules]) => ({
        key: `sp:${spId}`,
        title: spRules[0].scan_point_name || spId,
        spStats: {
          confirmed: spRules.reduce((s, r) => s + r.confirmed, 0),
          pending: spRules.reduce((s, r) => s + r.pending + r.error + r.review_needed, 0),
          rejected: spRules.reduce((s, r) => s + r.rejected, 0),
          total: spRules.reduce((s, r) => s + r.total, 0),
        },
        children: spRules.map(r => ({
          key: r.rule_version_id,
          title: r.rule_name,
          rule: r,
        })),
      })),
    }
  })
  return [{
    key: 'all',
    title: '全部',
    children: domainNodes,
  }]
})

function domainLabel(d: string): string {
  const map: Record<string, string> = { security: '安全', performance: '性能' }
  return map[d] ?? d
}

function onTreeSelect(keys: (string | number)[]) {
  const key = keys.length ? String(keys[0]) : 'all'
  selectedRuleId.value = key
  pageNum.value = 1
  if (key === 'all') {
    // 全部：清除规则与领域过滤
    domainFilter.value = ''
    scanPointFilter.value = ''
  }
  else if (key.startsWith('domain:')) {
    // 领域节点：按领域过滤
    domainFilter.value = key.slice(7)
    scanPointFilter.value = ''
  }
  else if (key.startsWith('sp:')) {
    // 扫描点节点：按扫描点过滤
    domainFilter.value = ''
    scanPointFilter.value = key.slice(3)
  }
  else {
    // 规则节点：清除领域过滤，按规则过滤
    domainFilter.value = ''
    scanPointFilter.value = ''
  }
  void loadCandidates()
}

// ===== 候选明细 =====
const candidatePage = ref<CandidateDetailPage | null>(null)
const candidateLoading = ref(false)
const pageNum = ref(1)
const pageSize = 20
const statusFilter = ref('')
// 风险等级筛选（多选）。诉求是"优先处理高等级"，通常要 high 与 medium 一起看，
// 单选每次只能看一档、反复切换很别扭。
const riskLevelFilter = ref<string[]>([])
const domainFilter = ref('')
const scanPointFilter = ref('')
// 引入时间过滤：[from, to]，格式 'YYYY-MM-DD'，由 range-picker 绑定
const introducedRange = ref<string[]>([])

async function loadCandidates(silent = false) {
  if (!currentRun.value) {
    candidatePage.value = null
    return
  }
  if (!silent)
    candidateLoading.value = true
  try {
    const params = new URLSearchParams({
      run_id: currentRun.value.run_id,
      page_num: String(pageNum.value),
      page_size: String(pageSize),
    })
    params.set('ai_model', currentRun.value.ai_model)
    params.set('ai_mode', currentRun.value.ai_mode)
    if (selectedRuleId.value && selectedRuleId.value !== 'all' && !selectedRuleId.value.startsWith('domain:') && !selectedRuleId.value.startsWith('sp:'))
      params.set('rule_version_id', selectedRuleId.value)
    if (scanPointFilter.value)
      params.set('scan_point_id', scanPointFilter.value)
    if (statusFilter.value)
      params.set('ai_status', statusFilter.value)
    if (domainFilter.value)
      params.set('domain', domainFilter.value)
    if (introducedRange.value?.[0])
      params.set('introduced_from', introducedRange.value[0])
    if (introducedRange.value?.[1])
      params.set('introduced_to', introducedRange.value[1])
    // 风险等级多选拼成逗号分隔（如 high,medium）。候选表用的是 ai_risk_level，
    // 取值除 high/medium/low 外还有大量 info，滤掉 info 是这个筛选最主要的用途。
    if (riskLevelFilter.value.length > 0)
      params.set('ai_risk_level', riskLevelFilter.value.join(','))
    candidatePage.value = await fetchJson<CandidateDetailPage>(`${ApiSecPrescan.candidates}?${params.toString()}`)
  }
  finally {
    if (!silent)
      candidateLoading.value = false
  }
  schedulePollIfNeeded()
}

// ===== AI 确认轮询：当前页存在待确认候选时，每 5 秒静默刷新，直到确认完成（避免表格加载闪烁）=====
const pollTimer = ref<ReturnType<typeof setTimeout> | null>(null)
function pageHasPending(): boolean {
  return candidatePage.value?.list?.some(r => r.ai_status === 'pending') ?? false
}
function schedulePollIfNeeded() {
  if (pollTimer.value) {
    clearTimeout(pollTimer.value)
    pollTimer.value = null
  }
  if (pageHasPending())
    pollTimer.value = setTimeout(() => void loadCandidates(true), 5000)
}
onUnmounted(() => {
  if (pollTimer.value)
    clearTimeout(pollTimer.value)
})

function onFilterChange() {
  pageNum.value = 1
  void loadCandidates()
}

// ===== 查看报告（MdPreview 抽屉）=====
const reportVisible = ref(false)
const reportRow = ref<CandidateDetailRow | null>(null)
function viewReport(row: CandidateDetailRow) {
  reportRow.value = row
  reportVisible.value = true
}

// ===== 单条重扫（重置为 pending 并重新 AI 确认）=====
const retryingCandidateId = ref('')
/** 允许重扫的状态：错误 / 已排除 / 需人工 */
function canRetry(status: string): boolean {
  return ['error', 'rejected', 'review_needed'].includes(status)
}
async function retryCandidate(row: CandidateDetailRow) {
  retryingCandidateId.value = row.id
  try {
    const payload: Record<string, any> = { candidate_id: row.id }
    if (currentRun.value?.ai_model?.trim())
      payload.model = currentRun.value.ai_model.trim()
    // 保持该轮次原本的模式（多模式聚合时不传，由后端推断）
    const modes = (currentRun.value?.ai_mode ?? '').split(',').map(m => m.trim()).filter(Boolean)
    if (modes.length === 1)
      payload.mode = modes[0]
    const resp = await postAction<{ message?: string }>(ApiSecPrescan.retryCandidate, payload)
    if (resp) {
      Message.success(resp.message || '已提交重扫并加入队列，消费者每 5 秒领取一次')
      setTimeout(() => void loadCandidates(), 1500)
    }
  }
  finally {
    retryingCandidateId.value = ''
  }
}

// 轮次/模型标签：模型与模式均为空时，是预扫描候选尚未经过 AI 确认的"待AI确认"分组
function roundModelLabel(row: { ai_model?: string | null, ai_mode?: string | null } | null): string {
  if (row?.ai_model?.trim())
    return row.ai_model.trim()
  if (!row?.ai_mode?.trim())
    return '待AI确认'
  return '默认模型'
}

// ===== 标签映射（需在轮次展示辅助函数之前声明，避免 use-before-define）=====
const aiStatusLabels: Record<string, { label: string, color: string }> = {
  pending: { label: '待确认', color: 'gray' },
  confirmed: { label: '确认问题', color: 'red' },
  rejected: { label: '已排除', color: 'green' },
  error: { label: '错误', color: 'orange' },
  review_needed: { label: '需人工', color: 'orangered' },
}
const riskLabels: Record<string, { label: string, color: string }> = {
  high: { label: '高', color: 'red' },
  medium: { label: '中', color: 'orange' },
  low: { label: '低', color: 'blue' },
  info: { label: '提示', color: 'gray' },
}
const modeLabels: Record<string, { label: string, color: string }> = {
  batch: { label: '平台编排', color: 'blue' },
  agent: { label: 'Agent', color: 'purple' },
}

// ===== 轮次展示辅助函数 =====

/**
 * 安全格式化时间字符串，解析失败时回退原值，避免因字段缺失或格式异常抛异常。
 * 支持 ISO8601 及常见 "YYYY-MM-DD HH:mm:ss" 格式。
 */
/**
 * 取 commit sha 的短 8 位，字段缺失时返回占位符。
 */
function shortSha(sha: string | null | undefined): string {
  if (!sha || !sha.trim())
    return '-'
  return sha.trim().slice(0, 8)
}

/**
 * 轮次下拉选项的主要显示文本：模型/模式 · 分支 · 短sha · 时间
 * 字段可能为 null，均需容错处理，不渲染 null/undefined。
 */
function roundOptionLabel(row: CrossRunAggRow): string {
  const model = roundModelLabel(row)
  const mode = modeLabels[row.ai_mode ?? '']?.label ?? (row.ai_mode?.trim() ? row.ai_mode : '待确认')
  const branch = row.branch?.trim() ? row.branch.trim() : '-'
  const sha = shortSha(row.commit_sha)
  const time = formatTime(row.commit_time || row.created_at)
  return `${model} · ${mode} · ${branch} · ${sha} · ${time}`
}

/**
 * 轮次 tooltip 展示的完整信息，供悬浮时查看更多细节。
 */
function roundTooltipContent(row: CrossRunAggRow): string {
  const lines: string[] = []
  lines.push(`Commit：${row.commit_sha?.trim() || '-'}`)
  lines.push(`分支：${row.branch?.trim() || '-'}`)
  lines.push(`扫描时间：${formatTime(row.commit_time || row.created_at)}`)
  lines.push(`模型：${roundModelLabel(row)}`)
  lines.push(`模式：${modeLabels[row.ai_mode ?? '']?.label ?? (row.ai_mode?.trim() ? row.ai_mode : '待确认')}`)
  lines.push(`候选总数：${row.total}（确认 ${row.confirmed} / 已排除 ${row.rejected} / 待确认 ${row.pending}）`)
  return lines.join('\n')
}

// ===== 表格列 =====
const candidateColumns = [
  { title: '文件', dataIndex: 'file_path', width: 260, ellipsis: true, tooltip: true },
  { title: '行号', dataIndex: 'start_line', width: 60 },
  { title: '匹配文本', dataIndex: 'matched_text', width: 180, ellipsis: true, tooltip: true },
  { title: 'AI状态', dataIndex: 'ai_status', slotName: 'aiStatus', width: 90 },
  { title: '风险', dataIndex: 'ai_risk_level', slotName: 'riskLevel', width: 70 },
  { title: '置信度', dataIndex: 'ai_confidence', slotName: 'confidence', width: 80 },
  { title: '引入时间', dataIndex: 'introduced_at', slotName: 'introducedAt', width: 150 },
  { title: 'AI理由', dataIndex: 'ai_rationale', width: 220, ellipsis: true, tooltip: true },
  { title: '操作', slotName: 'ops', width: 110, fixed: 'right' as const },
]

// ===== 初始化：从路由读取 repository_id / run_id / ai_model / ai_mode / scan_point_id =====
/**
 * 根据路由参数初始化页面。
 * 注意：从扫描看板跳转时仅携带 run_id（不带 ai_model/ai_mode），
 * 因此需先加载轮次列表，再按 run_id 解析出真实的 ai_model/ai_mode，
 * 否则轮次选择器匹配不上、且后端按空模型过滤会查不到数据。
 */
async function initFromRoute(q: Record<string, unknown>) {
  const repoId = (q.repository_id as string) || ''
  const runId = (q.run_id as string) || ''
  const aiModel = (q.ai_model as string) ?? ''
  const aiMode = (q.ai_mode as string) ?? ''
  const scanPointId = (q.scan_point_id as string) ?? ''
  if (scanPointId)
    pendingScanPointId.value = scanPointId
  if (repoId)
    selectedRepoId.value = repoId
  if (runId) {
    // 先加载轮次列表（不自动选最新），再按 run_id（+可选模型/模式）精确匹配轮次
    await loadCrossRows(false)
    const match = crossRows.value.find(r => r.run_id === runId
      && (!aiModel || (r.ai_model ?? '') === aiModel)
      && (!aiMode || (r.ai_mode ?? '') === aiMode))
    if (match) {
      // 命中轮次：onRoundChange 会设置正确的 currentRun 并加载左树+候选
      onRoundChange(roundKey(match))
    }
    else {
      // 未命中（数据可能尚未聚合）：回退用路由原始参数
      currentRun.value = { run_id: runId, ai_model: aiModel, ai_mode: aiMode }
      selectedRoundKey.value = `${runId}||${aiModel}||${aiMode}`
      void loadRuleStats()
      void loadCandidates()
    }
  }
  else {
    // 无查询条件：加载全部数据，自动选中最新轮次
    void loadCrossRows(true)
  }
}

/**
 * 路由 query 内容是否真正发生了变化（排除对象引用变化导致的误触发）。
 * 只比对对本页有意义的字段：run_id / repository_id / ai_model / ai_mode / scan_point_id。
 */
function routeQueryChanged(
  oldQ: Record<string, unknown>,
  newQ: Record<string, unknown>,
): boolean {
  const keys = ['run_id', 'repository_id', 'ai_model', 'ai_mode', 'scan_point_id'] as const
  return keys.some(k => (oldQ[k] ?? '') !== (newQ[k] ?? ''))
}

onMounted(() => {
  void initFromRoute(route.query as Record<string, unknown>)
})

// 路由变化时重新初始化（同页面跳转），但只在参数内容真正变化时触发，
// 避免其他 query 参数变动（如 tab 切换）或组件内部更新 URL 触发多余的重置。
watch(() => route.query, (newQ, oldQ) => {
  const n = newQ as Record<string, unknown>
  const o = oldQ as Record<string, unknown>
  if (!n.run_id && !n.repository_id)
    return
  if (!routeQueryChanged(o, n))
    return
  void initFromRoute(n)
})
</script>

<template>
  <div class="static-scan-results">
    <!-- 顶部：应用 + 轮次选择 -->
    <a-card :bordered="false" class="m-b-12px">
      <a-space wrap>
        <span class="selector-label">项目组</span>
        <a-select
          v-model="selectedPgId"
          allow-search
          allow-clear
          placeholder="全部项目组"
          style="width: 200px"
          @change="onPgChange"
        >
          <a-option v-for="pg in pgOptions" :key="pg.value" :value="pg.value">
            {{ pg.label }}
          </a-option>
        </a-select>
        <span class="selector-label">应用</span>
        <a-select
          v-model="selectedRepoId"
          allow-search
          allow-clear
          placeholder="选择已扫描的应用"
          style="width: 320px"
          @change="onAppChange"
        >
          <a-option v-for="repo in filteredRepositories" :key="repo.repository_id" :value="repo.repository_id">
            {{ repo.module_name }}（{{ repo.repository_name }}）
          </a-option>
        </a-select>
        <span class="selector-label">轮次</span>
        <!-- 轮次下拉：选项携带 commit sha / 分支 / 时间，悬浮展示完整 tooltip -->
        <a-select
          v-model="selectedRoundKey"
          placeholder="选择「模型 × 模式」轮次"
          style="width: 420px"
          :loading="crossLoading"
          @change="onRoundChange"
        >
          <a-option
            v-for="row in crossRows"
            :key="roundKey(row)"
            :value="roundKey(row)"
          >
            <a-tooltip
              :content="roundTooltipContent(row)"
              position="right"
              mini
            >
              <span class="round-option-text">{{ roundOptionLabel(row) }}</span>
            </a-tooltip>
          </a-option>
        </a-select>
        <span class="selector-label">领域</span>
        <a-select v-model="domainFilter" allow-clear placeholder="全部领域" style="width: 130px" @change="onFilterChange">
          <a-option value="security">安全</a-option>
          <a-option value="performance">性能</a-option>
        </a-select>
        <span class="selector-label">引入时间</span>
        <a-range-picker
          v-model="introducedRange"
          style="width: 260px"
          value-format="YYYY-MM-DD"
          @change="onFilterChange"
        />
        <a-button type="primary" @click="onSearch">
          查询
        </a-button>
        <a-button :loading="compensating" :disabled="!currentRun" @click="compensateBlame">
          一键补偿引入时间
        </a-button>
      </a-space>
    </a-card>

    <a-alert v-if="!currentRun && !crossLoading" type="info" show-icon class="m-b-12px">
      暂无数据，请选择应用与轮次（可从「扫描运行」页点击「查看明细」直达），或点击「查询」加载全部数据。
    </a-alert>

    <!-- 左树右表（可拖拽分栏） -->
    <div v-if="currentRun" class="split-layout" :class="{ dragging: isDragging }">
      <!-- 左树：规则统计 -->
      <div class="split-left" :style="{ width: `${leftPanelWidth}px` }">
        <a-card :bordered="false" size="small" class="split-card">
          <template #title>
            规则分布
            <small class="card-sub">确认/待确认/已排除/总数</small>
          </template>
          <a-spin :loading="ruleStatsLoading" style="width: 100%">
            <a-tree
              v-if="ruleTree.length"
              :data="ruleTree"
              v-model:expanded-keys="expandedKeys"
              :selected-keys="[selectedRuleId]"
              @select="onTreeSelect"
            >
              <template #title="node">
                <div class="rule-node">
                  <span class="rule-name" :title="node.title">{{ node.title }}</span>
                  <span v-if="node.rule" class="rule-stats">
                    <span class="s-confirmed">{{ node.rule.confirmed }}</span>/<span class="s-pending">{{ node.rule.pending + node.rule.error + node.rule.review_needed }}</span>/<span class="s-rejected">{{ node.rule.rejected }}</span>/<span class="s-total">{{ node.rule.total }}</span>
                  </span>
                  <span v-else-if="node.spStats" class="rule-stats">
                    <span class="s-confirmed">{{ node.spStats.confirmed }}</span>/<span class="s-pending">{{ node.spStats.pending }}</span>/<span class="s-rejected">{{ node.spStats.rejected }}</span>/<span class="s-total">{{ node.spStats.total }}</span>
                  </span>
                </div>
              </template>
            </a-tree>
            <a-empty v-else description="该轮次暂无候选" />
          </a-spin>
        </a-card>
      </div>

      <!-- 拖拽手柄 -->
      <div class="split-handle" @mousedown="onDragStart" />

      <!-- 右表：候选明细 -->
      <div class="split-right">
        <a-card :bordered="false" class="split-card">
          <template #title>
            候选明细
            <small class="card-sub">
              {{ roundModelLabel(currentRun) }} · {{ modeLabels[currentRun.ai_mode]?.label ?? (currentRun.ai_mode?.trim() ? currentRun.ai_mode : '待确认') }}
            </small>
          </template>
          <template #extra>
            <a-select v-model="statusFilter" placeholder="AI状态" allow-clear style="width: 140px" @change="onFilterChange">
              <a-option value="confirmed">确认问题</a-option>
              <a-option value="rejected">已排除</a-option>
              <a-option value="review_needed">需人工</a-option>
              <a-option value="error">错误</a-option>
              <a-option value="pending">待确认</a-option>
            </a-select>
              <!-- 风险等级多选：诉求是"优先处理高等级"，通常要 high 与 medium 一起看。
                   info 档在候选里占绝大多数，滤掉它是本筛选最主要的用途 -->
              <a-select
                v-model="riskLevelFilter"
                multiple
                allow-clear
                :max-tag-count="2"
                placeholder="风险等级"
                style="width: 190px"
                @change="onFilterChange"
              >
                <a-option value="high">高</a-option>
                <a-option value="medium">中</a-option>
                <a-option value="low">低</a-option>
                <a-option value="info">提示</a-option>
              </a-select>
          </template>
          <a-table
            :loading="candidateLoading"
            :data="candidatePage?.list ?? []"
            :columns="candidateColumns"
            :pagination="{
              current: pageNum,
              pageSize: pageSize,
              total: candidatePage?.total ?? 0,
              showTotal: true,
            }"
            row-key="id"
            size="small"
            :scroll="{ x: 1150 }"
            @page-change="(p: number) => { pageNum = p; loadCandidates() }"
          >
            <template #aiStatus="{ record }">
              <a-tag :color="aiStatusLabels[record.ai_status]?.color ?? 'gray'" size="small">
                {{ aiStatusLabels[record.ai_status]?.label ?? record.ai_status }}
              </a-tag>
            </template>
            <template #riskLevel="{ record }">
              <a-tag v-if="record.ai_risk_level" :color="riskLabels[record.ai_risk_level]?.color ?? 'gray'" size="small">
                {{ riskLabels[record.ai_risk_level]?.label ?? record.ai_risk_level }}
              </a-tag>
              <span v-else class="text-muted">-</span>
            </template>
            <template #confidence="{ record }">
              {{ record.ai_confidence != null ? Number(record.ai_confidence).toFixed(2) : '-' }}
            </template>
            <template #introducedAt="{ record }">
              <!-- 引入时间列：为空时显示 -，悬浮展示完整 commit / 作者 / 时间 -->
              <a-tooltip
                :content="record.introduced_commit || record.introduced_author || record.introduced_at
                  ? `Commit：${record.introduced_commit || '-'}\n引入者：${record.introduced_author || '-'}\n时间：${formatTime(record.introduced_at)}`
                  : '非 git 仓库或该行未被版本控制，无法定位引入时间'"
                position="top"
                mini
              >
                <span>{{ formatTime(record.introduced_at) }}</span>
              </a-tooltip>
            </template>
            <template #ops="{ record }">
              <a-space :size="4">
                <a-button
                  type="text"
                  size="small"
                  @click="viewReport(record)"
                >
                  报告
                </a-button>
                <a-button
                  type="text"
                  size="small"
                  status="warning"
                  :disabled="!canRetry(record.ai_status)"
                  :loading="retryingCandidateId === record.id"
                  @click="retryCandidate(record)"
                >
                  重扫
                </a-button>
              </a-space>
            </template>
          </a-table>
        </a-card>
      </div>
    </div>

    <!-- 查看报告弹窗（富文本渲染 Markdown，宽幅+可滚动，避免抽屉显示不全）-->
    <a-modal
      :visible="reportVisible"
      width="85%"
      :title="`AI 详细报告 · ${reportRow?.file_path ?? ''}${reportRow?.start_line ? `:${reportRow.start_line}` : ''}`"
      :footer="false"
      :body-style="{ maxHeight: '78vh', overflowY: 'auto' }"
      unmount-on-close
      @cancel="reportVisible = false"
    >
      <a-descriptions :column="3" bordered size="small" class="m-b-12px">
        <a-descriptions-item label="模型">{{ roundModelLabel(reportRow) }}</a-descriptions-item>
        <a-descriptions-item label="模式">{{ modeLabels[reportRow?.ai_mode ?? '']?.label ?? (reportRow?.ai_mode?.trim() ? reportRow.ai_mode : '待确认') }}</a-descriptions-item>
        <a-descriptions-item label="风险">{{ reportRow?.ai_risk_level ?? '-' }}</a-descriptions-item>
        <a-descriptions-item label="引入时间">
          {{ formatTime(reportRow?.introduced_at) }}
        </a-descriptions-item>
        <a-descriptions-item label="引入者">
          {{ reportRow?.introduced_author || '-' }}
        </a-descriptions-item>
        <a-descriptions-item label="引入 Commit">
          <a-tooltip v-if="reportRow?.introduced_commit" :content="reportRow.introduced_commit" mini>
            <span style="font-family: monospace">{{ shortSha(reportRow.introduced_commit) }}</span>
          </a-tooltip>
          <span v-else>-</span>
        </a-descriptions-item>
      </a-descriptions>
      <MdPreview v-if="reportRow?.ai_detail_report" :model-value="reportRow.ai_detail_report" />
      <div v-else class="report-fallback">
        <a-empty description="暂无详细报告文件" />
        <a-alert v-if="reportRow?.ai_rationale" type="info" class="m-t-12px">
          <template #title>
            AI 判定理由
          </template>
          {{ reportRow.ai_rationale }}
        </a-alert>
        <p class="report-tip">
          说明：AI 未返回详细报告文件（或报告文件不可读）时，「查看报告」仍可点击，此处展示 AI 判定理由。如需完整报告可对该条执行「重扫」。
        </p>
      </div>
    </a-modal>
  </div>
</template>

<style scoped>
.static-scan-results { padding: 0; }
.selector-label { color: var(--color-text-2); }
.card-sub { margin-left: 12px; color: var(--color-text-3); font-weight: normal; font-size: 12px; }
.text-muted { color: var(--color-text-4); }
.split-layout { display: flex; gap: 0; align-items: stretch; }
.split-layout.dragging { user-select: none; cursor: col-resize; }
.split-left { flex-shrink: 0; overflow: hidden; }
.split-card { height: 100%; overflow-y: auto; }
.split-handle {
  width: 6px; flex-shrink: 0; cursor: col-resize; border-radius: 3px; margin: 0 3px;
  background: transparent; transition: background 0.2s;
}
.split-handle:hover, .split-layout.dragging .split-handle { background: rgb(var(--primary-6)); }
.split-right { flex: 1; min-width: 0; }
.rule-node { display: flex; align-items: center; justify-content: space-between; gap: 4px; width: 100%; }
.rule-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rule-stats { flex-shrink: 0; font-size: 12px; color: var(--color-text-3); }
.s-confirmed { color: rgb(var(--red-6)); font-weight: 500; }
.s-pending { color: rgb(var(--orange-6)); }
.s-rejected { color: rgb(var(--green-6)); }
.s-total { color: var(--color-text-2); }
.report-fallback { padding: 12px 0; }
.report-tip { margin-top: 12px; color: var(--color-text-3); font-size: 12px; line-height: 1.6; }
/* 轮次选项文本：撑满宽度以让 tooltip 覆盖整行 */
.round-option-text { display: inline-block; width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
