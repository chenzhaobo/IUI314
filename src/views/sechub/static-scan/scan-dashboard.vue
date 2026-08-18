<script setup lang="ts">
import type {
  AgentRunProgress,
  AiConfirmResponse,
  BranchesControlResponse,
  CandidateDetailPage,
  CodeTreeNode,
  DashboardOverview,
  GlobalOverview,
  ModuleWithRepository,
  PrescanStatusResponse,
  PrescanTriggerResponse,
  RepositoryBranch,
  RunCompare,
  ScanPointSummaryRow,
  UnifiedScanRunRow,
  CrossRunAggRow,
} from '@/types/static-scan'
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Message, Modal } from '@arco-design/web-vue'
import { BarChart, PieChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import { ApiSecModuleRepository, ApiSecPrescan } from '@/api/sechubApis'
import { ApiAiAgent, ApiAiSkill, type AiAgent, type AiSkill } from '@/api/aiApis'
import { ErrorFlag } from '@/api/apis'
import { useGet, usePost } from '@/hooks'
import { domainLabels, securityCategoryLabels } from './labels'

use([BarChart, PieChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])

// 组件名必须与路由名（= 菜单 path 'scan-dashboard'）一致，keep-alive :include 才能缓存本页，
// 否则从扫描结果详情返回时看板会重新挂载、丢失已展开/选中状态（见 app-main.vue 注释）。
defineOptions({ name: 'scan-dashboard' })

const router = useRouter()

// ===== 应用列表（模块+仓库+维度字段） =====
const { data: repoList } = useGet<ModuleWithRepository[]>(ApiSecModuleRepository.listWithModule, {}, { immediate: true })
const repositories = computed(() => repoList.value ?? [])

// ===== 左树维度切换（参考达标率看板） =====
const dimension = ref<'project_group' | 'business_area' | 'product_domain'>('project_group')
const treeSearch = ref('')
const selectedKeys = ref<string[]>([])
const expandedKeys = ref<string[]>([])
const showCode = ref(false)

// 维度 → 实际接口字段映射
const dimFieldMap: Record<string, keyof ModuleWithRepository> = {
  project_group: 'project_group_name',
  business_area: 'business_area',
  product_domain: 'product_domain',
}

interface AppTreeNode {
  key: string
  title: string
  level: 'group' | 'sub' | 'app' | 'point'
  repository_id?: string
  children?: AppTreeNode[]
}

// 构建树：项目组→工程；业务领域/产品领域→项目组→工程
const treeData = computed<AppTreeNode[]>(() => {
  const dimField = dimFieldMap[dimension.value]
  const groups = new Map<string, ModuleWithRepository[]>()
  for (const repo of repositories.value) {
    const dimValue = String(repo[dimField] ?? '') || '未分类'
    if (!groups.has(dimValue)) groups.set(dimValue, [])
    groups.get(dimValue)!.push(repo)
  }

  const buildAppNode = (app: ModuleWithRepository): AppTreeNode => {
    const node: AppTreeNode = {
      key: `app:${app.repository_id}`,
      title: showCode.value ? `${app.module_name}（${app.module_code}）` : app.module_name,
      level: 'app',
      repository_id: app.repository_id,
    }
    // 选中工程下挂载扫描点子节点（来自当前 run 的扫描点汇总）
    if (app.repository_id === selectedRepoId.value && summaryRows.value.length) {
      node.children = summaryRows.value.map(sp => ({
        key: `sp:${sp.scan_point_id}`,
        title: `${sp.scan_point_name || sp.scan_point_id} (${sp.candidate_count})`,
        level: 'point' as const,
      }))
    }
    return node
  }

  const sortedGroups = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], 'zh-CN'))

  // 项目组维度：两层（项目组 → 工程）
  if (dimension.value === 'project_group') {
    return sortedGroups.map(([groupName, apps]) => ({
      key: `grp:${groupName}`,
      title: `${groupName} (${apps.length})`,
      level: 'group' as const,
      children: apps.sort((a, b) => a.module_name.localeCompare(b.module_name, 'zh-CN')).map(buildAppNode),
    }))
  }

  // 业务领域/产品领域维度：三层（维度 → 项目组 → 工程）
  return sortedGroups.map(([groupName, apps]) => {
    const subGroups = new Map<string, ModuleWithRepository[]>()
    for (const app of apps) {
      const pg = app.project_group_name || '未分类'
      if (!subGroups.has(pg)) subGroups.set(pg, [])
      subGroups.get(pg)!.push(app)
    }
    return {
      key: `grp:${groupName}`,
      title: `${groupName} (${apps.length})`,
      level: 'group' as const,
      children: [...subGroups.entries()]
        .sort((a, b) => a[0].localeCompare(b[0], 'zh-CN'))
        .map(([pgName, pgApps]) => ({
          key: `sub:${groupName}:${pgName}`,
          title: `${pgName} (${pgApps.length})`,
          level: 'sub' as const,
          children: pgApps.sort((a, b) => a.module_name.localeCompare(b.module_name, 'zh-CN')).map(buildAppNode),
        })),
    }
  })
})

// 树搜索过滤（递归）
function filterTree(nodes: AppTreeNode[], kw: string): AppTreeNode[] {
  return nodes
    .map((node) => {
      if (node.title.toLowerCase().includes(kw)) return node
      const children = node.children ? filterTree(node.children, kw) : []
      if (children.length) return { ...node, children }
      return null
    })
    .filter((n): n is AppTreeNode => n !== null)
}
const displayTree = computed(() => {
  const kw = treeSearch.value.toLowerCase()
  if (!kw) return treeData.value
  return filterTree(treeData.value, kw)
})

function onDimensionChange() {
  selectedKeys.value = []
  expandedKeys.value = []
  treeSearch.value = ''
}

// ===== 全局概览（未选应用时展示） =====
const globalData = ref<GlobalOverview | null>(null)
const globalLoading = ref(false)

async function loadGlobalOverview() {
  globalLoading.value = true
  try {
    const { data, execute } = useGet<GlobalOverview>(ApiSecPrescan.globalOverview, {}, { immediate: false })
    await execute()
    // API 出错时 data.value 为 ErrorFlag 字符串，需过滤，避免模板读取 .top_apps.length 报错
    const d = data.value as unknown
    globalData.value = (d && d !== ErrorFlag && typeof d === 'object') ? (d as GlobalOverview) : null
  }
  finally {
    globalLoading.value = false
  }
}
loadGlobalOverview()

// 左树应用状态圆点：红（高风险>0）/ 橙（中/低风险>0）/ 绿（无确认问题）/ 灰（未扫描）
function appDotColor(repositoryId?: string): string {
  if (!repositoryId || !globalData.value) return '#c9cdd4'
  const app = (globalData.value.all_apps ?? []).find(a => a.repository_id === repositoryId)
  if (!app) return '#c9cdd4'
  if (app.risk_high > 0) return '#f53f3f'
  if (app.risk_medium > 0 || app.risk_low > 0) return '#ff7d00'
  if (app.confirmed === 0) return '#00b42a'
  return '#f53f3f'
}

// TOP10 风险应用横向柱状图
const topAppsOption = computed(() => {
  const apps = [...(globalData.value?.top_apps ?? [])].reverse()
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 10, right: 40, top: 10, bottom: 10, containLabel: true },
    xAxis: { type: 'value', minInterval: 1 },
    yAxis: {
      type: 'category',
      data: apps.map(a => a.module_name || a.repository_name || a.repository_id),
      axisLabel: { width: 140, overflow: 'truncate' },
    },
    series: [
      {
        name: '确认问题',
        type: 'bar',
        data: apps.map(a => a.confirmed),
        itemStyle: { color: '#f53f3f' },
        label: { show: true, position: 'right' },
        barMaxWidth: 18,
      },
    ],
  }
})

// 安全/性能域分布饼图
const domainPieOption = computed(() => {
  const dist = globalData.value?.domain_distribution ?? []
  const domainNames: Record<string, string> = { security: '安全域', performance: '性能域' }
  return {
    tooltip: { trigger: 'item' },
    legend: { bottom: 0 },
    series: [
      {
        type: 'pie',
        radius: ['40%', '65%'],
        center: ['50%', '42%'],
        data: dist.map(d => ({ name: domainNames[d.domain] ?? d.domain, value: d.confirmed })),
        label: { formatter: '{b}: {c}' },
        itemStyle: { borderRadius: 4 },
      },
    ],
  }
})

function onTopAppChartClick(params: { dataIndex?: number }) {
  const apps = [...(globalData.value?.top_apps ?? [])].reverse()
  const app = params.dataIndex != null ? apps[params.dataIndex] : null
  if (app) {
    selectedRepoId.value = app.repository_id
    selectedKeys.value = [`app:${app.repository_id}`]
  }
}

// ===== 当前选中应用 =====
const selectedRepoId = ref('')
const selectedRepo = computed(() => repositories.value.find(r => r.repository_id === selectedRepoId.value) ?? null)

function onTreeSelect(keys: (string | number)[]) {
  selectedKeys.value = keys.map(String)
  const key = String(keys[0] ?? '')
  if (key.startsWith('app:')) {
    selectedRepoId.value = key.slice(4)
  }
  else if (key.startsWith('sp:')) {
    // 扫描点节点：跳转扫描结果详情（自动选中对应扫描点）
    openDetail(key.slice(3))
  }
}

// ===== 预扫描状态 =====
const currentRunId = ref('')
const prescanStatus = ref<PrescanStatusResponse | null>(null)
const triggering = ref(false)
const polling = ref(false)

// ===== Run 列表（分支/commit 对比选择） =====
const runList = ref<UnifiedScanRunRow[]>([])
const runListLoading = ref(false)

async function loadRunList(repoName: string) {
  runListLoading.value = true
  try {
    const { data, execute } = useGet<UnifiedScanRunRow[]>(
      `${ApiSecPrescan.scanRunsUnified}?source=prescan`,
      {},
      { immediate: false },
    )
    await execute()
    const all = data.value ?? []
    runList.value = all.filter(r => r.repository_name === repoName)
  }
  catch {
    runList.value = []
  }
  finally {
    runListLoading.value = false
  }
}

function onRunChange(runId: string) {
  currentRunId.value = runId
  const run = runList.value.find(r => r.id === runId)
  if (run) {
    prescanStatus.value = {
      run_id: run.id,
      repository_id: selectedRepoId.value,
      status: run.status,
      total_files: 0,
      total_loc: 0,
      total_candidates: run.candidate_count ?? 0,
      input_digest: '',
      error_message: null,
      started_at: run.started_at ?? undefined,
      finished_at: undefined,
      created_at: run.started_at ?? '',
    }
  }
  if (run?.status === 'succeeded') {
    loadDashboardData()
  }
}

// 选中应用 → 加载最新 run + run 列表
watch(selectedRepoId, async (repoId) => {
  prescanStatus.value = null
  currentRunId.value = ''
  overview.value = null
  summaryRows.value = []
  codeTree.value = []
  runList.value = []
  if (!repoId) return
  // 加载 run 列表
  const repo = repositories.value.find(r => r.repository_id === repoId)
  if (repo) {
    await loadRunList(repo.repository_name)
    // 默认选中最新一条
    if (runList.value.length > 0) {
      const latest = runList.value[0]
      currentRunId.value = latest.id
      prescanStatus.value = {
        run_id: latest.id,
        repository_id: repoId,
        status: latest.status,
        total_files: 0,
        total_loc: 0,
        total_candidates: latest.candidate_count ?? 0,
        input_digest: '',
        error_message: null,
        started_at: latest.started_at ?? undefined,
        finished_at: undefined,
        created_at: latest.started_at ?? '',
      }
      if (latest.status === 'succeeded') {
        loadDashboardData()
      }
      return
    }
  }
  // 回退：用 latest-run 接口
  const { data, execute } = useGet<PrescanStatusResponse | null>(
    `${ApiSecPrescan.latestRun}?repository_id=${repoId}`,
    {},
    { immediate: false },
  )
  await execute()
  if (data.value) {
    prescanStatus.value = data.value
    currentRunId.value = data.value.run_id
    if (data.value.status === 'succeeded') {
      loadDashboardData()
    }
  }
})

// ===== 预扫描确认弹窗（选择分支/commit） =====
const prescanModalVisible = ref(false)
const prescanBranches = ref<RepositoryBranch[]>([])
const prescanBranch = ref('')
const prescanCommit = ref('')
const loadingBranches = ref(false)
// 扫描范围
const scanScope = ref<'full' | 'diff_last' | 'diff_commit'>('full')
const baseCommitInput = ref('')
const diffGranularity = ref<'file' | 'hunk'>('file')
const hunkEnabled = ref(false)

async function openPrescanModal() {
  if (!selectedRepoId.value) {
    Message.warning('请先在左侧树选择应用')
    return
  }
  prescanBranch.value = ''
  prescanCommit.value = ''
  prescanBranches.value = []
  scanScope.value = 'full'
  baseCommitInput.value = ''
  diffGranularity.value = 'file'
  hunkEnabled.value = false
  prescanModalVisible.value = true
  // 加载分支列表
  const repo = selectedRepo.value
  if (!repo) return
  loadingBranches.value = true
  try {
    const { data, execute } = useGet<BranchesControlResponse>(
      ApiSecModuleRepository.branches,
      { module_id: repo.module_id, relation_id: repo.relation_id, refresh: false },
      { immediate: false },
    )
    await execute()
    if (data.value?.result === 'cached') {
      prescanBranches.value = data.value.data.branches
      const def = prescanBranches.value.find(b => b.is_default)
      prescanBranch.value = def?.name ?? repo.default_branch ?? ''
      if (def) prescanCommit.value = def.commit_sha ?? ''
    }
    else {
      prescanBranch.value = repo.default_branch ?? ''
    }
  }
  catch {
    prescanBranch.value = repo.default_branch ?? ''
  }
  finally {
    loadingBranches.value = false
  }
}

function onPrescanBranchChange(branchName: string) {
  const br = prescanBranches.value.find(b => b.name === branchName)
  prescanCommit.value = br?.commit_sha ?? ''
}

function doPrescanConfirm() {
  // 校验：指定基准 commit 时必须为 7~40 位 hex
  if (scanScope.value === 'diff_commit') {
    const v = baseCommitInput.value.trim()
    if (!v || !/^[0-9a-f]{7,40}$/i.test(v)) {
      Message.warning('基准 Commit SHA 须为 7~40 位十六进制字符')
      return
    }
  }
  // 全量模式下重置 hunk 勾选
  if (scanScope.value === 'full') {
    hunkEnabled.value = false
  }
  prescanModalVisible.value = false
  triggerPrescan(false, prescanBranch.value || undefined, prescanCommit.value || undefined)
}

// 触发预扫描
async function triggerPrescan(force = false, branch?: string, commitSha?: string) {
  if (!selectedRepoId.value) {
    Message.warning('请先在左侧树选择应用')
    return
  }
  triggering.value = true
  try {
    const body: Record<string, unknown> = { repository_id: selectedRepoId.value, force }
    if (branch) body.branch = branch
    if (commitSha) body.commit_sha = commitSha
    // 扫描范围组装
    if (scanScope.value === 'full') {
      body.scan_mode = 'full'
    }
    else {
      body.scan_mode = 'diff'
      if (scanScope.value === 'diff_commit' && baseCommitInput.value.trim()) {
        body.base_commit = baseCommitInput.value.trim()
      }
      body.diff_granularity = hunkEnabled.value ? 'hunk' : 'file'
    }
    const { data, execute, error } = usePost<PrescanTriggerResponse>(
      ApiSecPrescan.trigger,
      body,
      { immediate: false },
    )
    await execute()
    if (error.value) {
      Message.error('预扫描触发失败')
      return
    }
    if (data.value) {
      if (data.value.idempotent && !force) {
        // 已存在相同输入的扫描结果，询问用户是否强制重扫
        Modal.confirm({
          title: '已存在扫描结果',
          content: '该应用已有相同代码和规则的扫描结果，是否要强制重新扫描？',
          okText: '重新扫描',
          cancelText: '查看已有结果',
          onOk: () => triggerPrescan(true),
          onCancel: () => {
            currentRunId.value = data.value!.run_id
            refreshStatus()
          },
        })
        return
      }
      currentRunId.value = data.value.run_id
      if (force) {
        Message.success('强制重扫已启动')
      }
      else {
        Message.success('预扫描已启动')
      }
      startPolling()
      await refreshStatus()
    }
  }
  finally {
    triggering.value = false
  }
}

// 轮询状态
let pollTimer: ReturnType<typeof setInterval> | null = null
function startPolling() {
  stopPolling()
  polling.value = true
  pollTimer = setInterval(async () => {
    await refreshStatus()
    if (prescanStatus.value && ['succeeded', 'failed', 'cancelled'].includes(prescanStatus.value.status)) {
      stopPolling()
      // 刷新 run 列表
      if (selectedRepo.value) {
        await loadRunList(selectedRepo.value.repository_name)
      }
      if (prescanStatus.value.status === 'succeeded') {
        Message.success('预扫描完成')
        loadDashboardData()
      }
      else {
        Message.error(`预扫描失败: ${prescanStatus.value.error_message ?? '未知错误'}`)
      }
    }
  }, 2000)
}
function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  polling.value = false
}

async function refreshStatus() {
  if (!currentRunId.value) return
  const { data, execute } = useGet<PrescanStatusResponse>(
    `${ApiSecPrescan.status}?run_id=${currentRunId.value}`,
    {},
    { immediate: false },
  )
  await execute()
  if (data.value) prescanStatus.value = data.value
}

// ===== 看板数据 =====
const overview = ref<DashboardOverview | null>(null)
const summaryRows = ref<ScanPointSummaryRow[]>([])
const codeTree = ref<CodeTreeNode[]>([])
const loadingDashboard = ref(false)

async function fetchJson<T>(url: string): Promise<T | null> {
  const { data, execute } = useGet<T>(url, {}, { immediate: false })
  await execute()
  return data.value ?? null
}

async function loadDashboardData() {
  if (!currentRunId.value) return
  loadingDashboard.value = true
  try {
    const [ovRes, sumRes, treeRes] = await Promise.all([
      fetchJson<DashboardOverview>(`${ApiSecPrescan.dashboard}?run_id=${currentRunId.value}`),
      fetchJson<ScanPointSummaryRow[]>(`${ApiSecPrescan.summary}?run_id=${currentRunId.value}`),
      fetchJson<CodeTreeNode[]>(`${ApiSecPrescan.codeTree}?run_id=${currentRunId.value}`),
    ])
    overview.value = ovRes
    summaryRows.value = sumRes ?? []
    codeTree.value = treeRes ?? []
  }
  finally {
    loadingDashboard.value = false
  }
}

// ===== 右表视图切换：按扫描点 / 按文件 =====
const tableView = ref<'scanpoint' | 'file'>('scanpoint')

// 按文件视图：服务端分页
const codePageNum = ref(1)
const codeDetail = ref<CandidateDetailPage | null>(null)
const codeLoading = ref(false)

async function loadCodeCandidates() {
  if (!currentRunId.value) {
    codeDetail.value = null
    return
  }
  codeLoading.value = true
  try {
    const params = new URLSearchParams({
      run_id: currentRunId.value,
      page_num: String(codePageNum.value),
      page_size: '50',
    })
    codeDetail.value = await fetchJson<CandidateDetailPage>(`${ApiSecPrescan.candidates}?${params.toString()}`)
  }
  finally {
    codeLoading.value = false
  }
}

watch(tableView, (v) => {
  if (v === 'file' && currentRunId.value) {
    codePageNum.value = 1
    loadCodeCandidates()
  }
})

// ===== 候选明细抽屉 =====
const detailVisible = ref(false)
const detailLoading = ref(false)
const detailRows = ref<CandidateDetailPage | null>(null)
const detailScanPointId = ref('')
const detailPageNum = ref(1)

async function openDetail(scanPointId: string) {
  // 跳转扫描结果详情页，左树自动选中对应节点
  router.push({
    path: '/static-scan/scan/results',
    query: {
      run_id: currentRunId.value,
      repository_id: selectedRepoId.value,
      scan_point_id: scanPointId,
    },
  })
}

async function loadCandidates() {
  if (!currentRunId.value) return
  detailLoading.value = true
  try {
    const params = new URLSearchParams({
      run_id: currentRunId.value,
      page_num: String(detailPageNum.value),
      page_size: '50',
    })
    if (detailScanPointId.value) params.set('scan_point_id', detailScanPointId.value)
    detailRows.value = await fetchJson<CandidateDetailPage>(`${ApiSecPrescan.candidates}?${params.toString()}`)
  }
  finally {
    detailLoading.value = false
  }
}

// ===== AI 确认（平台编排 batch / Agent 自主 agent）=====
const aiConfirming = ref(false)
const aiMode = ref<'batch' | 'agent'>('batch')
const aiModel = ref<string>('')
const aiAgentCode = ref<string>('')
const aiConfirmModalVisible = ref(false)
const aiConfirmRunId = ref('')
const aiSkillCode = ref<string>('')

// Agent 列表（从 AI 中心加载启用状态的 agent）
const agentList = ref<AiAgent[]>([])
const agentLoading = ref(false)

// 技能列表（从 AI 中心加载，用于指定扫描技能）
const skillList = ref<AiSkill[]>([])
const skillLoading = ref(false)

async function loadSkillList() {
  skillLoading.value = true
  try {
    const { data, execute, error } = useGet<{ list: AiSkill[] }>(ApiAiSkill.getList, { status: 'active', page_size: 100 })
    await execute()
    if (!error.value && data.value) {
      skillList.value = data.value.list || []
    }
  }
  finally {
    skillLoading.value = false
  }
}

async function loadAgentList() {
  agentLoading.value = true
  try {
    const { data, execute, error } = useGet<{ list: AiAgent[] }>(ApiAiAgent.getList, { status: 'active', page_size: 50 })
    await execute()
    if (!error.value && data.value) {
      agentList.value = data.value.list || []
    }
  }
  finally {
    agentLoading.value = false
  }
}

// 根据选中 agent 的 supported_models_json 动态生成模型选项
const modelOptions = computed(() => {
  const agent = agentList.value.find((a) => a.agent_code === aiAgentCode.value)
  if (agent?.supported_models_json) {
    try {
      const models: string[] = JSON.parse(agent.supported_models_json)
      return models.map((m) => ({ label: m === 'auto' ? 'Agent 默认模型（auto）' : m, value: m === 'auto' ? '' : m }))
    }
    catch { /* ignore */ }
  }
  // 无配置时回退默认选项
  return [
    { label: 'Agent 默认模型（auto）', value: '' },
    { label: 'Qwen3.8-Max-Preview', value: 'Qwen3.8-Max-Preview' },
    { label: 'GLM-5.2', value: 'GLM-5.2' },
    { label: 'Kimi-K3', value: 'Kimi-K3' },
    { label: 'DeepSeek-V4-Pro', value: 'DeepSeek-V4-Pro' },
    { label: 'MiniMax-M3', value: 'MiniMax-M3' },
  ]
})

// Agent 自主审计进度轮询
const agentProgress = ref<AgentRunProgress | null>(null)
let agentPollTimer: ReturnType<typeof setInterval> | null = null

async function loadAgentStatus() {
  if (!currentRunId.value) return
  const progress = await fetchJson<AgentRunProgress>(`${ApiSecPrescan.agentStatus}?run_id=${currentRunId.value}`)
  if (progress) {
    agentProgress.value = progress
    // 全部处理完毕（无 pending）则停止轮询并刷新看板
    if (progress.pending === 0 && progress.total > 0) {
      stopAgentPolling()
      Message.success('Agent 自主审计完成')
      await loadDashboardData()
    }
  }
}

function startAgentPolling() {
  stopAgentPolling()
  agentProgress.value = null
  loadAgentStatus()
  agentPollTimer = setInterval(loadAgentStatus, 3000)
}

function stopAgentPolling() {
  if (agentPollTimer) {
    clearInterval(agentPollTimer)
    agentPollTimer = null
  }
}

onUnmounted(stopAgentPolling)

async function triggerAiConfirm() {
  if (!currentRunId.value && runList.value.length === 0) {
    Message.warning('无可用的扫描结果')
    return
  }
  // 默认选中当前 run，用户可在弹窗中切换批次
  aiConfirmRunId.value = currentRunId.value || runList.value[0]?.id || ''
  // 打开弹窗时加载 agent 列表
  if (agentList.value.length === 0) {
    loadAgentList()
  }
  // 打开弹窗时加载技能列表
  if (skillList.value.length === 0) {
    loadSkillList()
  }
  aiConfirmModalVisible.value = true
}

async function doAiConfirm() {
  aiConfirmModalVisible.value = false
  aiConfirming.value = true
  try {
    const body: Record<string, unknown> = { run_id: aiConfirmRunId.value || currentRunId.value, scope: 'all', mode: aiMode.value }
    if (aiModel.value) {
      body.model = aiModel.value
    }
    if (aiAgentCode.value) {
      body.agent_code = aiAgentCode.value
    }
    if (aiSkillCode.value) {
      body.skill_code = aiSkillCode.value
    }
    const { data, execute, error } = usePost<AiConfirmResponse>(
      ApiSecPrescan.aiConfirm,
      body,
      { immediate: false },
    )
    await execute()
    if (error.value) {
      Message.error('AI 确认失败')
      return
    }
    if (data.value) {
      Message.success(data.value.message)
      if (aiMode.value === 'agent') {
        startAgentPolling()
      }
      else {
        await loadDashboardData()
      }
    }
  }
  finally {
    aiConfirming.value = false
  }
}

// ===== AI 确认效果对比（batch vs agent）=====
const compareVisible = ref(false)
const compareLoading = ref(false)
const compareData = ref<RunCompare | null>(null)
const modeLabels: Record<string, string> = { batch: '平台编排', agent: 'Agent 自主', unknown: '未确认' }
const compareColumns = [
  { title: '模式', dataIndex: 'ai_mode', slotName: 'cmpMode', width: 120 },
  { title: '总数', dataIndex: 'total', width: 80 },
  { title: '确认', dataIndex: 'confirmed', width: 80 },
  { title: '排除', dataIndex: 'rejected', width: 80 },
  { title: '待复核', dataIndex: 'review_needed', width: 90 },
  { title: '错误', dataIndex: 'error', width: 80 },
  { title: '平均置信度', dataIndex: 'avg_confidence', slotName: 'cmpConf', width: 110 },
]

async function openCompare() {
  if (!currentRunId.value) {
    Message.warning('无可用的扫描结果')
    return
  }
  compareVisible.value = true
  compareLoading.value = true
  try {
    compareData.value = await fetchJson<RunCompare>(`${ApiSecPrescan.confirmCompare}?run_id=${currentRunId.value}`)
  }
  finally {
    compareLoading.value = false
  }
}

// ===== 跨 Run 横评对比（多模型 A/B 评测）=====
const crossCompareVisible = ref(false)
const crossCompareLoading = ref(false)
const crossCompareData = ref<CrossRunAggRow[]>([])
const crossCompareColumns = [
  { title: '模型', dataIndex: 'ai_model', slotName: 'crModel', width: 140 },
  { title: '模式', dataIndex: 'ai_mode', slotName: 'crMode', width: 100 },
  { title: '总数', dataIndex: 'total', width: 70 },
  { title: '确认问题', dataIndex: 'confirmed', width: 80 },
  { title: '已排除', dataIndex: 'rejected', width: 80 },
  { title: '错误', dataIndex: 'error', width: 70 },
  { title: '待确认', dataIndex: 'pending', width: 80 },
  { title: '高风险', dataIndex: 'risk_high', width: 80 },
  { title: '中风险', dataIndex: 'risk_medium', width: 80 },
  { title: '低风险', dataIndex: 'risk_low', width: 80 },
  { title: '确认率', dataIndex: 'confirm_rate', slotName: 'crRate', width: 90 },
  { title: '平均置信度', dataIndex: 'avg_confidence', slotName: 'crConf', width: 100 },
  { title: '时间', dataIndex: 'created_at', width: 130 },
]

async function openCrossCompare() {
  if (!selectedRepoId.value) {
    Message.warning('请先选择应用')
    return
  }
  crossCompareVisible.value = true
  crossCompareLoading.value = true
  try {
    crossCompareData.value = await fetchJson<CrossRunAggRow[]>(`${ApiSecPrescan.crossRunCompare}?repository_id=${selectedRepoId.value}`)
  }
  catch {
    crossCompareData.value = []
  }
  finally {
    crossCompareLoading.value = false
  }
}

// ===== 表格列 =====
const summaryColumns = [
  { title: '域', dataIndex: 'domain', slotName: 'domain', width: 80 },
  { title: '类型', dataIndex: 'category', slotName: 'category', width: 120 },
  { title: '扫描点', dataIndex: 'scan_point_name', width: 200, ellipsis: true, tooltip: true },
  { title: '疑似问题', dataIndex: 'candidate_count', width: 80 },
  { title: '文件数', dataIndex: 'file_count', width: 80 },
  { title: '确认问题', dataIndex: 'ai_confirmed', width: 80 },
  { title: '已排除', dataIndex: 'ai_rejected', width: 80 },
  { title: '高风险', dataIndex: 'risk_high', width: 80 },
  { title: '中风险', dataIndex: 'risk_medium', width: 80 },
  { title: '低风险', dataIndex: 'risk_low', width: 80 },
  { title: '操作', slotName: 'operations', width: 80, fixed: 'right' as const },
]

const fileCandidateColumns = [
  { title: '文件', dataIndex: 'file_path', width: 300, ellipsis: true, tooltip: true },
  { title: '行号', dataIndex: 'start_line', width: 70 },
  { title: '匹配文本', dataIndex: 'matched_text', width: 220, ellipsis: true, tooltip: true },
  { title: '域', dataIndex: 'domain', slotName: 'domain', width: 70 },
  { title: '类型', dataIndex: 'category', slotName: 'category', width: 100 },
  { title: 'AI状态', dataIndex: 'ai_status', slotName: 'aiStatus', width: 90 },
  { title: '模式', dataIndex: 'ai_mode', slotName: 'aiMode', width: 90 },
  { title: 'AI模型', dataIndex: 'ai_model', width: 120, ellipsis: true, tooltip: true },
  { title: '风险等级', dataIndex: 'ai_risk_level', slotName: 'riskLevel', width: 90 },
  { title: 'AI理由', dataIndex: 'ai_rationale', width: 200, ellipsis: true, tooltip: true },
]

const candidateColumns = [
  { title: '文件', dataIndex: 'file_path', width: 280, ellipsis: true, tooltip: true },
  { title: '行号', dataIndex: 'start_line', width: 70 },
  { title: '匹配文本', dataIndex: 'matched_text', width: 250, ellipsis: true, tooltip: true },
  { title: 'AI状态', dataIndex: 'ai_status', slotName: 'aiStatus', width: 90 },
  { title: '模式', dataIndex: 'ai_mode', slotName: 'aiMode', width: 90 },
  { title: 'AI模型', dataIndex: 'ai_model', width: 120, ellipsis: true, tooltip: true },
  { title: '风险等级', dataIndex: 'ai_risk_level', slotName: 'riskLevel', width: 90 },
  { title: 'AI理由', dataIndex: 'ai_rationale', width: 250, ellipsis: true, tooltip: true },
]

const aiStatusLabels: Record<string, { label: string, color: string }> = {
  pending: { label: '待确认', color: 'gray' },
  confirmed: { label: '确认问题', color: 'red' },
  rejected: { label: '已排除', color: 'green' },
  error: { label: '错误', color: 'orange' },
}
const runStatusLabels: Record<string, { label: string, color: string }> = {
  succeeded: { label: '扫描完成', color: 'green' },
  running: { label: '扫描中', color: 'blue' },
  pending: { label: '等待中', color: 'gray' },
  failed: { label: '扫描失败', color: 'red' },
  cancelled: { label: '已取消', color: 'orange' },
}
const riskColors: Record<string, string> = { high: 'red', medium: 'orange', low: 'blue', info: 'gray' }
const aiModeLabels: Record<string, { label: string, color: string }> = {
  batch: { label: '平台编排', color: 'blue' },
  agent: { label: 'Agent', color: 'purple' },
}
</script>

<template>
  <div class="scan-dashboard">
    <!-- 顶部操作栏 -->
    <a-card :bordered="false" class="m-b-8px">
      <a-space wrap>
        <a-typography-text v-if="selectedRepo" style="font-weight: 500">
          {{ selectedRepo.module_name }} / {{ selectedRepo.repository_name }}
        </a-typography-text>
        <a-typography-text v-else type="secondary">
          请在左侧树选择应用
        </a-typography-text>
        <!-- Run 选择器（分支/commit 对比） -->
        <a-select
          v-if="runList.length > 0"
          :model-value="currentRunId"
          size="small"
          style="min-width: 280px"
          :loading="runListLoading"
          placeholder="选择扫描运行"
          @change="onRunChange"
        >
          <a-option v-for="run in runList" :key="run.id" :value="run.id">
            {{ run.branch || '未知分支' }} | {{ run.commit_sha ? run.commit_sha.slice(0, 8) : '-' }} | {{ run.started_at || '' }} | {{ runStatusLabels[run.status]?.label ?? run.status }} | 疑似{{ run.candidate_count ?? 0 }}
          </a-option>
        </a-select>
        <a-button type="primary" :loading="triggering" :disabled="polling || !selectedRepoId" @click="openPrescanModal()">
          <template #icon><icon-play-arrow /></template>
          预扫描
        </a-button>
        <a-button :loading="aiConfirming" :disabled="!currentRunId" @click="triggerAiConfirm">
          <template #icon><icon-robot /></template>
          AI 全量确认
        </a-button>
        <a-button :disabled="!currentRunId" @click="openCompare">
          效果对比
        </a-button>
        <a-button :disabled="!selectedRepoId" @click="openCrossCompare">
          横评对比
        </a-button>
        <a-tag v-if="prescanStatus" :color="runStatusLabels[prescanStatus.status]?.color ?? 'gray'">
          {{ runStatusLabels[prescanStatus.status]?.label ?? prescanStatus.status }}
        </a-tag>
        <a-typography-text v-if="polling" type="secondary">
          扫描中...
        </a-typography-text>
        <a-tag v-if="agentProgress" color="purple">
          Agent 审计 {{ agentProgress.analyzed }}/{{ agentProgress.total }}（确认 {{ agentProgress.confirmed }} / 排除 {{ agentProgress.rejected }} / 待复核 {{ agentProgress.review_needed }}）
        </a-tag>
      </a-space>
    </a-card>

    <!-- 统计卡片 -->
    <a-row v-if="overview" :gutter="12" class="m-b-8px">
      <a-col :span="3">
        <a-statistic title="总文件数" :value="overview.total_files" />
      </a-col>
      <a-col :span="3">
        <a-statistic title="总代码行" :value="overview.total_loc" />
      </a-col>
      <a-col :span="4">
        <a-statistic title="疑似问题总数" :value="overview.total_candidates" />
      </a-col>
      <a-col :span="3">
        <a-statistic title="确认问题" :value="overview.ai_confirmed" :value-style="{ color: '#f53f3f' }" />
      </a-col>
      <a-col :span="3">
        <a-statistic title="AI出错" :value="overview.ai_error" :value-style="{ color: '#ff7d00' }" />
      </a-col>
      <a-col :span="2">
        <a-statistic title="高风险" :value="overview.risk_high" :value-style="{ color: '#f53f3f' }" />
      </a-col>
      <a-col :span="3">
        <a-statistic title="中风险" :value="overview.risk_medium" :value-style="{ color: '#ff7d00' }" />
      </a-col>
      <a-col :span="3">
        <a-statistic title="低风险" :value="overview.risk_low" :value-style="{ color: '#165dff' }" />
      </a-col>
    </a-row>

    <!-- 主体：左树右表 -->
    <a-card :bordered="false" :body-style="{ padding: '16px' }">
      <div style="display: flex; gap: 16px; height: calc(100vh - 300px); min-height: 420px">
        <!-- 左树：组织维度 -->
        <div style="width: 300px; flex-shrink: 0; border-right: 1px solid #e5e6eb; padding-right: 12px; display: flex; flex-direction: column; min-height: 0">
          <a-radio-group v-model="dimension" type="button" size="small" style="margin-bottom: 8px" @change="onDimensionChange">
            <a-radio value="project_group">项目组</a-radio>
            <a-radio value="business_area">业务领域</a-radio>
            <a-radio value="product_domain">产品领域</a-radio>
          </a-radio-group>
          <div style="display: flex; gap: 8px; margin-bottom: 8px">
            <a-input-search v-model="treeSearch" placeholder="搜索应用" allow-clear />
            <a-button size="small" :type="showCode ? 'primary' : 'outline'" @click="showCode = !showCode">
              编码
            </a-button>
          </div>
          <div style="flex: 1; overflow-y: auto; min-height: 0">
            <a-tree
              v-if="displayTree.length"
              :data="displayTree"
              :field-names="{ key: 'key', title: 'title', children: 'children' }"
              show-line
              block-node
              :default-expand-all="true"
              v-model:expanded-keys="expandedKeys"
              :selected-keys="selectedKeys"
              @select="onTreeSelect"
            >
              <template #title="node">
                <span style="display: inline-flex; align-items: center; gap: 6px">
                  <span
                    v-if="node.level === 'app'"
                    style="width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0"
                    :style="{ background: appDotColor(node.repository_id) }"
                  />
                  <span>{{ node.title }}</span>
                </span>
              </template>
            </a-tree>
            <a-empty v-else description="暂无已绑定仓库的应用" />
          </div>
        </div>

        <!-- 右侧 -->
        <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; min-height: 0">
          <template v-if="!selectedRepoId">
            <!-- 全局视图：统计卡片 + TOP10 排名 + 域分布 -->
            <a-spin :loading="globalLoading" style="width: 100%; overflow-y: auto">
              <a-row v-if="globalData" :gutter="12" style="margin-bottom: 12px">
                <a-col :span="4">
                  <a-statistic title="已扫应用" :value="globalData.scanned_apps">
                    <template #suffix>
                      <span style="font-size: 14px; color: #86909c">/ {{ globalData.total_apps }}</span>
                    </template>
                  </a-statistic>
                </a-col>
                <a-col :span="4">
                  <a-statistic title="确认问题" :value="globalData.total_confirmed" :value-style="{ color: '#f53f3f' }" />
                </a-col>
                <a-col :span="4">
                  <a-statistic title="高风险" :value="globalData.total_risk_high" :value-style="{ color: '#f53f3f' }" />
                </a-col>
                <a-col :span="4">
                  <a-statistic title="中风险" :value="globalData.total_risk_medium" :value-style="{ color: '#ff7d00' }" />
                </a-col>
                <a-col :span="4">
                  <a-statistic title="低风险" :value="globalData.total_risk_low" :value-style="{ color: '#165dff' }" />
                </a-col>
                <a-col :span="2">
                  <a-statistic title="AI出错" :value="globalData.total_error" :value-style="{ color: '#ff7d00' }" />
                </a-col>
                <a-col :span="2">
                  <a-statistic title="待确认" :value="globalData.total_pending" :value-style="{ color: '#86909c' }" />
                </a-col>
              </a-row>
              <a-row :gutter="12">
                <a-col :span="14">
                  <a-card title="TOP10 风险应用（确认问题数）" :bordered="false" size="small" style="background: #fafafa">
                    <VChart
                      v-if="globalData && globalData.top_apps?.length"
                      :option="topAppsOption"
                      style="height: 340px"
                      autoresize
                      @click="onTopAppChartClick"
                    />
                    <a-empty v-else description="暂无扫描数据" />
                  </a-card>
                </a-col>
                <a-col :span="10">
                  <a-card title="确认问题域分布" :bordered="false" size="small" style="background: #fafafa">
                    <VChart
                      v-if="globalData && globalData.domain_distribution?.length"
                      :option="domainPieOption"
                      style="height: 340px"
                      autoresize
                    />
                    <a-empty v-else description="暂无确认问题" />
                  </a-card>
                </a-col>
              </a-row>
            </a-spin>
          </template>
          <template v-else-if="!currentRunId && !loadingDashboard">
            <a-empty style="margin-top: 80px" description="该应用暂无扫描记录，请点击「预扫描」执行首次扫描" />
          </template>
          <template v-else>
            <!-- 视图切换 -->
            <div style="margin-bottom: 8px">
              <a-radio-group v-model="tableView" type="button" size="small">
                <a-radio value="scanpoint">按扫描点</a-radio>
                <a-radio value="file">按文件</a-radio>
              </a-radio-group>
            </div>

            <!-- 按扫描点 -->
            <a-table
              v-if="tableView === 'scanpoint'"
              :data="summaryRows"
              :columns="summaryColumns"
              :loading="loadingDashboard"
              :pagination="false"
              row-key="scan_point_id"
              size="small"
              :scroll="{ x: 1100, y: 'calc(100vh - 430px)' }"
            >
              <template #domain="{ record }">
                <a-tag size="small" :color="record.domain === 'security' ? 'red' : 'blue'">
                  {{ domainLabels[record.domain] ?? record.domain }}
                </a-tag>
              </template>
              <template #category="{ record }">
                {{ securityCategoryLabels[record.category] ?? record.category }}
              </template>
              <template #operations="{ record }">
                <a-button type="text" size="small" @click="openDetail(record.scan_point_id)">
                  详情
                </a-button>
              </template>
            </a-table>

            <!-- 按文件 -->
            <a-table
              v-else
              :data="codeDetail?.list ?? []"
              :columns="fileCandidateColumns"
              :loading="codeLoading"
              :pagination="{ total: codeDetail?.total ?? 0, current: codePageNum, pageSize: 50 }"
              row-key="id"
              size="small"
              :scroll="{ x: 1200, y: 'calc(100vh - 430px)' }"
              @page-change="(page: number) => { codePageNum = page; loadCodeCandidates() }"
            >
              <template #domain="{ record }">
                <a-tag size="small" :color="record.domain === 'security' ? 'red' : 'blue'">
                  {{ domainLabels[record.domain] ?? record.domain }}
                </a-tag>
              </template>
              <template #category="{ record }">
                {{ securityCategoryLabels[record.category] ?? record.category }}
              </template>
              <template #aiStatus="{ record }">
                <a-tag :color="aiStatusLabels[record.ai_status]?.color ?? 'gray'" size="small">
                  {{ aiStatusLabels[record.ai_status]?.label ?? record.ai_status }}
                </a-tag>
              </template>
              <template #aiMode="{ record }">
                <a-tag v-if="record.ai_mode" :color="aiModeLabels[record.ai_mode]?.color ?? 'gray'" size="small">
                  {{ aiModeLabels[record.ai_mode]?.label ?? record.ai_mode }}
                </a-tag>
                <span v-else>-</span>
              </template>
              <template #riskLevel="{ record }">
                <a-tag v-if="record.ai_risk_level" :color="riskColors[record.ai_risk_level] ?? 'gray'" size="small">
                  {{ record.ai_risk_level }}
                </a-tag>
                <span v-else>-</span>
              </template>
            </a-table>
          </template>
        </div>
      </div>
    </a-card>

    <!-- 候选明细抽屉 -->
    <a-drawer
      v-model:visible="detailVisible"
      title="疑似问题明细"
      :width="900"
      :footer="false"
    >
      <a-table
        :data="detailRows?.list ?? []"
        :columns="candidateColumns"
        :loading="detailLoading"
        :pagination="{ total: detailRows?.total ?? 0, current: detailPageNum, pageSize: 50 }"
        size="small"
        @page-change="(page: number) => { detailPageNum = page; loadCandidates() }"
      >
        <template #aiStatus="{ record }">
          <a-tag :color="aiStatusLabels[record.ai_status]?.color ?? 'gray'" size="small">
            {{ aiStatusLabels[record.ai_status]?.label ?? record.ai_status }}
          </a-tag>
        </template>
        <template #aiMode="{ record }">
          <a-tag v-if="record.ai_mode" :color="aiModeLabels[record.ai_mode]?.color ?? 'gray'" size="small">
            {{ aiModeLabels[record.ai_mode]?.label ?? record.ai_mode }}
          </a-tag>
          <span v-else>-</span>
        </template>
        <template #riskLevel="{ record }">
          <a-tag v-if="record.ai_risk_level" :color="riskColors[record.ai_risk_level] ?? 'gray'" size="small">
            {{ record.ai_risk_level }}
          </a-tag>
          <span v-else>-</span>
        </template>
      </a-table>
    </a-drawer>

    <!-- AI 确认效果对比弹窗 -->
    <a-modal
      v-model:visible="compareVisible"
      title="AI 确认效果对比（平台编排 vs Agent 自主）"
      :width="720"
      :footer="false"
    >
      <a-spin :loading="compareLoading" style="width: 100%">
        <template v-if="compareData">
          <a-descriptions :column="3" size="small" bordered style="margin-bottom: 12px">
            <a-descriptions-item label="运行状态">
              {{ compareData.run_status }}
            </a-descriptions-item>
            <a-descriptions-item label="AI 耗时">
              {{ compareData.duration_ms != null ? `${(compareData.duration_ms / 1000).toFixed(1)} s` : '-' }}
            </a-descriptions-item>
            <a-descriptions-item label="模式数">
              {{ compareData.by_mode.length }}
            </a-descriptions-item>
          </a-descriptions>
          <a-table
            :data="compareData.by_mode"
            :columns="compareColumns"
            :pagination="false"
            row-key="ai_mode"
            size="small"
          >
            <template #cmpMode="{ record }">
              <a-tag :color="aiModeLabels[record.ai_mode]?.color ?? 'gray'" size="small">
                {{ modeLabels[record.ai_mode] ?? record.ai_mode }}
              </a-tag>
            </template>
            <template #cmpConf="{ record }">
              {{ record.avg_confidence != null ? Number(record.avg_confidence).toFixed(2) : '-' }}
            </template>
          </a-table>
        </template>
        <a-empty v-else-if="!compareLoading" description="暂无对比数据" />
      </a-spin>
    </a-modal>

    <!-- 预扫描确认弹窗（选择分支/commit） -->
    <a-modal
      v-model:visible="prescanModalVisible"
      title="预扫描配置"
      :ok-text="'开始扫描'"
      :cancel-text="'取消'"
      @ok="doPrescanConfirm"
    >
      <a-form layout="vertical">
        <a-form-item label="目标分支">
          <a-select
            v-model="prescanBranch"
            :loading="loadingBranches"
            placeholder="选择要扫描的分支"
            allow-search
            @change="onPrescanBranchChange"
          >
            <a-option v-for="br in prescanBranches" :key="br.name" :value="br.name">
              {{ br.name }}{{ br.is_default ? '（默认）' : '' }}
            </a-option>
          </a-select>
        </a-form-item>
        <a-form-item label="Commit SHA（可选，留空则使用分支最新提交）">
          <a-input v-model="prescanCommit" placeholder="如 a1b2c3d4..." allow-clear />
        </a-form-item>
        <a-form-item label="扫描范围">
          <a-radio-group v-model="scanScope" type="button">
            <a-radio value="full">全量</a-radio>
            <a-radio value="diff_last">自上次扫描（增量）</a-radio>
            <a-radio value="diff_commit">指定基准 commit</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item v-if="scanScope === 'diff_commit'" label="基准 Commit SHA">
          <a-input
            v-model="baseCommitInput"
            placeholder="输入 7~40 位 hex commit SHA"
            allow-clear
            :max-length="40"
          />
        </a-form-item>
        <a-form-item>
          <a-checkbox
            v-model="hunkEnabled"
            :disabled="scanScope === 'full'"
          >
            按 hunk 粒度过滤（行级差量）
          </a-checkbox>
          <a-tooltip v-if="scanScope === 'full'" content="仅增量扫描可用">
            <icon-info-circle style="margin-left: 4px; color: var(--color-text-3)" />
          </a-tooltip>
        </a-form-item>
        <a-alert v-if="runList.length > 0" type="info" style="margin-top: 4px">
          该应用已有 {{ runList.length }} 条扫描记录，相同代码和规则不会重复扫描（幂等保护）。
        </a-alert>
      </a-form>
    </a-modal>

    <!-- AI 确认配置弹窗 -->
    <a-modal
      v-model:visible="aiConfirmModalVisible"
      title="AI 确认配置"
      :ok-text="'开始确认'"
      :cancel-text="'取消'"
      @ok="doAiConfirm"
    >
      <a-form layout="vertical">
        <a-form-item label="目标批次（扫描运行）">
          <a-select v-model="aiConfirmRunId" placeholder="选择要确认的扫描批次">
            <a-option v-for="run in runList" :key="run.id" :value="run.id">
              {{ run.branch || '未知分支' }} | {{ run.commit_sha ? run.commit_sha.slice(0, 8) : '-' }} | {{ run.started_at || '' }} | 疑似{{ run.candidate_count ?? 0 }}
            </a-option>
          </a-select>
        </a-form-item>
        <a-form-item label="确认模式">
          <a-radio-group v-model="aiMode" type="button">
            <a-radio value="batch">平台编排（批量）</a-radio>
            <a-radio value="agent">Agent 自主</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item label="执行 Agent">
          <a-select v-model="aiAgentCode" placeholder="默认（按模式自动选择）" allow-clear :loading="agentLoading">
            <a-option v-for="ag in agentList" :key="ag.agent_code" :value="ag.agent_code">
              {{ ag.agent_name }}（{{ ag.agent_code }}）
            </a-option>
          </a-select>
        </a-form-item>
        <a-form-item label="扫描技能">
          <a-select v-model="aiSkillCode" placeholder="默认（按领域自动选择）" allow-clear :loading="skillLoading">
            <a-option v-for="sk in skillList" :key="sk.skill_code" :value="sk.skill_code">
              {{ sk.skill_name }}（{{ sk.skill_code }}）
            </a-option>
          </a-select>
        </a-form-item>
        <a-form-item label="AI 模型">
          <a-select v-model="aiModel" placeholder="选择模型（留空用 Agent 默认）" allow-clear>
            <a-option v-for="opt in modelOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </a-option>
          </a-select>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 跨 Run 横评对比弹窗（多模型 A/B 评测） -->
    <a-modal
      v-model:visible="crossCompareVisible"
      title="横评对比（多模型 A/B 评测）"
      :width="1100"
      :footer="false"
    >
      <a-spin :loading="crossCompareLoading" style="width: 100%">
        <a-table
          v-if="crossCompareData.length"
          :data="crossCompareData"
          :columns="crossCompareColumns"
          :pagination="false"
          :row-key="(r: CrossRunAggRow) => `${r.run_id}_${r.ai_model}_${r.ai_mode}`"
          size="small"
          :scroll="{ x: 1100 }"
        >
          <template #crModel="{ record }">
            <span>{{ record.ai_model || '默认模型' }}</span>
          </template>
          <template #crMode="{ record }">
            <a-tag :color="aiModeLabels[record.ai_mode]?.color ?? 'gray'" size="small">
              {{ modeLabels[record.ai_mode] ?? record.ai_mode ?? '未确认' }}
            </a-tag>
          </template>
          <template #crRate="{ record }">
            {{ record.confirm_rate != null ? `${(record.confirm_rate * 100).toFixed(1)}%` : '-' }}
          </template>
          <template #crConf="{ record }">
            {{ record.avg_confidence != null ? Number(record.avg_confidence).toFixed(2) : '-' }}
          </template>
        </a-table>
        <a-empty v-else-if="!crossCompareLoading" description="暂无横评数据，请先对同一应用执行多次 AI 确认（不同模型/模式）" />
      </a-spin>
    </a-modal>
  </div>
</template>

<style scoped>
.scan-dashboard {
  padding: 16px;
}
</style>
