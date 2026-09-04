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
  RepositoryCommit,
  RepositoryCommitListResponse,
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
import { formatTime, useAutoHeight, useGet, getAction, postAction } from '@/hooks'
import { domainLabels, securityCategoryLabels } from './labels'

type SelectChangeValue = string | number | boolean | Record<string, unknown> | (string | number | boolean | Record<string, unknown>)[]

use([BarChart, PieChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])

// 组件名必须与路由名（= 菜单 path 'scan-dashboard'）一致，keep-alive :include 才能缓存本页，
// 否则从扫描结果详情返回时看板会重新挂载、丢失已展开/选中状态（见 app-main.vue 注释）。
defineOptions({ name: 'scan-dashboard' })

const router = useRouter()

// 左树右表所在的 flex 行：实测顶边反推确定高度，替代原先写死的视口偏移。
// 这里取 height（不是 maxHeight）：内部左树/右表靠 flex:1 派生高度，
// 父级必须有确定高度，maxHeight 不算确定高度。
const dashboardRow = ref<HTMLElement>()
const { height: dashboardRowH } = useAutoHeight(dashboardRow, { min: 420 })

// 两张明细表各自实测（顶边相同但分处两个分支，分别测量更稳），
// 替代原先写死的表体高度偏移。给表格用 height 数字（:scroll.y）。
const scanpointTableWrap = ref<HTMLElement>()
const { height: scanpointTableH } = useAutoHeight(scanpointTableWrap)
const fileTableWrap = ref<HTMLElement>()
const { height: fileTableH } = useAutoHeight(fileTableWrap)

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
  // 换维度后原来的选中值在新维度里没有意义，回到全量
  void loadGlobalOverview()
  expandedKeys.value = []
  treeSearch.value = ''
}

// ===== 全局概览（未选应用时展示） =====
const globalData = ref<GlobalOverview | null>(null)
const globalLoading = ref(false)

/**
 * 左树选中节点 → 概览接口的筛选参数。
 *
 * 分组节点的 key 用的是**显示名**（如 `grp:集团财务`），而后端项目组维度要的是
 * project_group_id，所以要反查一次；业务领域与产品领域本身就是名值合一，直接传。
 * 「未分类」传哨兵值 __unclassified__，后端翻译成「该列为空」——
 * 与左树把空归类归到「未分类」分组的口径对齐。
 */
const overviewFilter = computed<Record<string, string>>(() => {
  const out: Record<string, string> = {}
  const key = selectedKeys.value[0] ?? ''
  if (!key)
    return out
  if (key.startsWith('app:')) {
    out.repository_id = key.slice(4)
    return out
  }
  if (!key.startsWith('grp:'))
    return out

  const name = key.slice(4)
  const unclassified = name === '未分类'
  const sentinel = unclassified ? '__unclassified__' : name
  if (dimension.value === 'project_group') {
    // 名 → id。同名分组取第一个匹配到的 id 即可（项目组名在库里是唯一的）
    const id = repositories.value.find(r => (r.project_group_name || '未分类') === name)?.project_group_id
    out.project_group_id = unclassified ? '__unclassified__' : (id || '')
  }
  else if (dimension.value === 'business_area') {
    out.business_area = sentinel
  }
  else {
    out.product_domain = sentinel
  }
  return out
})

async function loadGlobalOverview() {
  globalLoading.value = true
  try {
    const { data, execute } = useGet<GlobalOverview>(ApiSecPrescan.globalOverview, overviewFilter.value, { immediate: false })
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
    // ECharts 6 弃用 grid.containLabel（会打 LegacyGridContainLabel 告警），
    // 改用 outerBounds —— 语义正是"含轴标签的外边界"，原值平移即可。
    grid: { outerBounds: { left: 10, right: 40, top: 10, bottom: 10 } },
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
  // 点击即刷新右侧：概览按新的筛选范围重算
  void loadGlobalOverview()
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

function onRunChange(value: SelectChangeValue) {
  if (typeof value !== 'string' && typeof value !== 'number')
    return
  const runId = String(value)
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
// 显式刷新分支按钮的 loading（refresh=true 会真的 git fetch，比较慢）
const refreshingBranches = ref(false)
// 目标 commit 下拉列表
const prescanCommits = ref<RepositoryCommit[]>([])
const loadingCommits = ref(false)
// 差量基准 commit 下拉列表（与目标分支相同）
const baseCommits = ref<RepositoryCommit[]>([])
// 请求序号：防止慢响应覆盖最新选择
let commitSeq = 0
// 扫描范围
const scanScope = ref<'full' | 'diff_last' | 'diff_commit'>('full')
const baseCommitInput = ref('')
const diffGranularity = ref<'file' | 'hunk'>('file')
const hunkEnabled = ref(false)

// commit 下拉标签用的紧凑时间戳 yymmddhhmmss。
// 走统一入口按**用户时区**渲染后再压缩——旧实现用 new Date().getHours() 等取的是
// 浏览器时区分量，同一个 commit 在不同电脑上标签不一样。
function formatCommitTime(iso: string): string {
  const t = formatTime(iso, { placeholder: '' })
  if (!t) {
    return ''
  }
  // '2026-08-28 14:00:29' -> '260828140029'
  return t.slice(2).replace(/[-: ]/g, '')
}

// 将 RepositoryCommit 格式化为下拉选项标签：短sha + 日期 + 标题
function formatCommitLabel(c: RepositoryCommit): string {
  const time = formatCommitTime(c.commit_time)
  return `${c.short_sha} ${time} ${c.subject}`
}

// 加载指定分支的 commit 列表；用请求序号防止乱序覆盖
async function loadPrescanCommits(branch: string) {
  const repo = selectedRepo.value
  if (!repo || !branch) {
    prescanCommits.value = []
    baseCommits.value = []
    return
  }
  const seq = ++commitSeq
  loadingCommits.value = true
  try {
    const { data, execute } = useGet<RepositoryCommitListResponse>(
      ApiSecPrescan.commits,
      { module_id: repo.module_id, relation_id: repo.relation_id, branch, limit: 30 },
      { immediate: false },
    )
    await execute()
    // 旧响应丢弃，防止慢响应覆盖最新分支的选择
    if (seq !== commitSeq) {
      return
    }
    const list = data.value?.list ?? []
    prescanCommits.value = list
    baseCommits.value = list
    // 默认选中该分支最新一条 commit
    if (list.length > 0) {
      prescanCommit.value = list[0].sha
    }
    else {
      prescanCommit.value = ''
    }
  }
  catch {
    if (seq !== commitSeq) {
      return
    }
    prescanCommits.value = []
    baseCommits.value = []
    prescanCommit.value = ''
  }
  finally {
    if (seq === commitSeq) {
      loadingCommits.value = false
    }
  }
}

async function openPrescanModal() {
  if (!selectedRepoId.value) {
    Message.warning('请先在左侧树选择应用')
    return
  }
  prescanBranch.value = ''
  prescanCommit.value = ''
  prescanBranches.value = []
  prescanCommits.value = []
  baseCommits.value = []
  scanScope.value = 'full'
  baseCommitInput.value = ''
  diffGranularity.value = 'file'
  hunkEnabled.value = false
  prescanModalVisible.value = true
  // 用 refresh=false 加载分支（读缓存，快路径），避免打开弹窗时触发 git fetch
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
      // 优先选中 is_default 为 true 的分支，否则退回仓库记录的 default_branch
      const def = prescanBranches.value.find(b => b.is_default)
      prescanBranch.value = def?.name ?? repo.default_branch ?? ''
    }
    else {
      // 队列模式（缓存未命中）：回退到仓库默认分支
      prescanBranch.value = repo.default_branch ?? ''
    }
  }
  catch {
    prescanBranch.value = repo.default_branch ?? ''
  }
  finally {
    loadingBranches.value = false
  }
  // 选中分支后加载对应 commit 列表
  if (prescanBranch.value) {
    await loadPrescanCommits(prescanBranch.value)
  }
}

// 显式刷新分支：点击刷新按钮才用 refresh=true 真正 git fetch
async function refreshBranches() {
  const repo = selectedRepo.value
  if (!repo) return
  refreshingBranches.value = true
  try {
    const { data, execute } = useGet<BranchesControlResponse>(
      ApiSecModuleRepository.branches,
      { module_id: repo.module_id, relation_id: repo.relation_id, refresh: true },
      { immediate: false },
    )
    await execute()
    if (data.value?.result === 'cached') {
      prescanBranches.value = data.value.data.branches
      // 刷新后保持当前选中分支（如果刷新后仍存在），否则选默认分支
      const stillExists = prescanBranches.value.some(b => b.name === prescanBranch.value)
      if (!stillExists) {
        const def = prescanBranches.value.find(b => b.is_default)
        prescanBranch.value = def?.name ?? repo.default_branch ?? ''
        if (prescanBranch.value) {
          await loadPrescanCommits(prescanBranch.value)
        }
      }
    }
  }
  catch {
    Message.warning('刷新分支失败')
  }
  finally {
    refreshingBranches.value = false
  }
}

async function onPrescanBranchChange(value: SelectChangeValue) {
  if (typeof value !== 'string' && typeof value !== 'number')
    return
  const branchName = String(value)
  // 切换分支必须重新加载 commit 列表，不允许残留上一分支的 commit
  await loadPrescanCommits(branchName)
}

function doPrescanConfirm() {
  // 校验：指定基准 commit 时，baseCommitInput 必须为 7~40 位 hex（下拉选的值也会写入 baseCommitInput）
  if (scanScope.value === 'diff_commit') {
    const v = baseCommitInput.value.trim()
    if (!v || !/^[0-9a-f]{7,40}$/i.test(v)) {
      Message.warning('基准 Commit SHA 须为 7~40 位十六进制字符')
      return
    }
  }
  // prescanCommit 校验：若手工输入（不在下拉列表中），同样校验格式
  if (prescanCommit.value && !prescanCommits.value.some(c => c.sha === prescanCommit.value)) {
    if (!/^[0-9a-f]{7,40}$/i.test(prescanCommit.value.trim())) {
      Message.warning('目标 Commit SHA 须为 7~40 位十六进制字符')
      return
    }
  }
  // 全量模式下重置 hunk 勾选
  if (scanScope.value === 'full') {
    hunkEnabled.value = false
  }
  prescanModalVisible.value = false
  // 传给后端的必须是纯 commit sha（prescanCommit 存的就是 sha，不包含展示用的日期/标题）
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
    const res = await postAction<PrescanTriggerResponse>(
      ApiSecPrescan.trigger,
      body,
    )
    if (!res) return
    if (res.idempotent && !force) {
      // 已存在相同输入的扫描结果，询问用户是否强制重扫
      Modal.confirm({
        title: '已存在扫描结果',
        content: '该应用已有相同代码和规则的扫描结果，是否要强制重新扫描？',
        okText: '重新扫描',
        cancelText: '查看已有结果',
        onOk: () => triggerPrescan(true),
        onCancel: () => {
          currentRunId.value = res.run_id
          refreshStatus()
        },
      })
      return
    }
    currentRunId.value = res.run_id
    if (force) {
      Message.success('强制重扫已启动')
    }
    else {
      Message.success('预扫描已启动')
    }
    startPolling()
    await refreshStatus()
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
    // skipped 也是终态：代码与规则未变更（或并发撞同一输入），未真正重扫。
    // preparing 不是终态——记录已建但还在拉代码/建清单，要继续轮询到 running。
    if (prescanStatus.value && ['succeeded', 'failed', 'cancelled', 'skipped'].includes(prescanStatus.value.status)) {
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

// ===== AI 确认按钮禁用逻辑 =====
// 只有当前运行存在且状态为 succeeded 时才允许触发 AI 确认；
// preparing/running 表示预扫描尚未完成，没有可确认的候选；
// failed/skipped 表示本次扫描无有效结果，同样不允许触发。
const aiConfirmDisabled = computed(() => {
  if (!currentRunId.value)
    return true
  const status = prescanStatus.value?.status
  return status !== 'succeeded'
})

const aiConfirmTooltip = computed(() => {
  if (!currentRunId.value)
    return '请先选择扫描运行'
  const status = prescanStatus.value?.status
  if (status === 'preparing' || status === 'running') {
    return '预扫描尚未完成，完成后才能触发 AI 确认'
  }
  if (status === 'failed') {
    return '该批次扫描失败，无有效候选，无法触发 AI 确认'
  }
  if (status === 'skipped') {
    return '该批次已跳过（代码或规则未变更），无有效候选，无法触发 AI 确认'
  }
  if (status !== 'succeeded') {
    return '预扫描尚未完成，完成后才能触发 AI 确认'
  }
  return ''
})

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
    const res = await getAction<{ list: AiSkill[] }>(ApiAiSkill.getList, { status: 'active', page_size: 100 })
    if (res) {
      skillList.value = res.list || []
    }
  }
  finally {
    skillLoading.value = false
  }
}

async function loadAgentList() {
  agentLoading.value = true
  try {
    const res = await getAction<{ list: AiAgent[] }>(ApiAiAgent.getList, { status: 'active', page_size: 50 })
    if (res) {
      agentList.value = res.list || []
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
    // 全部处理完毕（无 pending）则停止轮询并刷新看板。
    // 注意区分「真正审计完成」与「Agent 快速失败被兜底对账全转 review_needed」：
    // 后者 pending 也会归零，但 confirmed+rejected 为 0、review_needed≈total，
    // 说明 Agent 实际没跑完（CLI 失败/工具权限/回调不通），不能报「完成」。
    if (progress.pending === 0 && progress.total > 0) {
      stopAgentPolling()
      const adjudicated = (progress.confirmed ?? 0) + (progress.rejected ?? 0)
      if (adjudicated === 0 && (progress.review_needed ?? 0) >= progress.total) {
        Message.error('Agent 未产出有效结论：候选全部被兜底标记为待复核，通常是 Agent 执行失败（CLI/工具权限/回调不通）。请在扫描运行页查看失败原因或重扫')
      }
      else {
        Message.success('Agent 自主审计完成')
      }
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
    const res = await postAction<AiConfirmResponse>(
      ApiSecPrescan.aiConfirm,
      body,
    )
    if (!res) return
    Message.success(res.message)
    if (aiMode.value === 'agent') {
      startAgentPolling()
    }
    else {
      await loadDashboardData()
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
const crossCompareRows = computed(() => crossCompareData.value.map(row => ({
  ...row,
  comparison_key: `${row.run_id}_${row.ai_model}_${row.ai_mode}`,
})))

async function openCrossCompare() {
  if (!selectedRepoId.value) {
    Message.warning('请先选择应用')
    return
  }
  crossCompareVisible.value = true
  crossCompareLoading.value = true
  try {
    crossCompareData.value = (await fetchJson<CrossRunAggRow[]>(`${ApiSecPrescan.crossRunCompare}?repository_id=${selectedRepoId.value}`)) ?? []
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
        <!-- 预扫描按钮：放开并发限制，只在未选应用时禁用。
             原逻辑 :disabled="polling || !selectedRepoId" 导致有扫描轮询时无法触发新扫描，
             但预扫描接口本身是幂等/并发安全的，多个 run 互不干扰，无需在前端串行化。 -->
        <a-button type="primary" :loading="triggering" :disabled="!selectedRepoId" @click="openPrescanModal()">
          <template #icon><icon-play-arrow /></template>
          预扫描
        </a-button>
        <!-- AI 确认：仅 succeeded 状态才可触发；未完成/失败/跳过时 tooltip 说明原因 -->
        <a-tooltip :content="aiConfirmTooltip" :disabled="!aiConfirmDisabled">
          <a-button
            type="primary"
            status="success"
            :loading="aiConfirming"
            :disabled="aiConfirmDisabled"
            @click="triggerAiConfirm"
          >
            <template #icon><icon-robot /></template>
            AI 全量确认
          </a-button>
        </a-tooltip>
        <a-button type="outline" :disabled="!currentRunId" @click="openCompare">
          效果对比
        </a-button>
        <a-button type="outline" :disabled="!selectedRepoId" @click="openCrossCompare">
          横评对比
        </a-button>
        <a-tag v-if="prescanStatus" :color="runStatusLabels[prescanStatus.status]?.color ?? 'gray'">
          {{ runStatusLabels[prescanStatus.status]?.label ?? prescanStatus.status }}
        </a-tag>
        <a-typography-text v-if="polling" type="secondary">
          扫描中...
        </a-typography-text>
        <a-tag v-if="agentProgress" color="purple">
          Agent 审计 {{ (agentProgress.confirmed ?? 0) + (agentProgress.rejected ?? 0) }}/{{ agentProgress.total }}（确认 {{ agentProgress.confirmed }} / 排除 {{ agentProgress.rejected }} / 待复核 {{ agentProgress.review_needed }} / 待处理 {{ agentProgress.pending }}）
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
      <div ref="dashboardRow" style="display: flex; gap: 16px; min-height: 420px" :style="{ height: dashboardRowH + 'px' }">
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
          <div style="flex: 1; overflow-y: auto; overflow-x: hidden; min-height: 0">
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
            <a-spin :loading="globalLoading" style="width: 100%; overflow-y: auto; overflow-x: hidden">
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
            <div v-if="tableView === 'scanpoint'" ref="scanpointTableWrap" style="flex: 1; min-height: 0">
            <a-table
              :data="summaryRows"
              :columns="summaryColumns"
              :loading="loadingDashboard"
              :pagination="false"
              row-key="scan_point_id"
              size="small"
              :scroll="{ minWidth: 1100, y: scanpointTableH }"
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
            </div>

            <!-- 按文件 -->
            <div v-else ref="fileTableWrap" style="flex: 1; min-height: 0">
            <a-table
              :data="codeDetail?.list ?? []"
              :columns="fileCandidateColumns"
              :loading="codeLoading"
              :pagination="{ total: codeDetail?.total ?? 0, current: codePageNum, pageSize: 50 }"
              row-key="id"
              size="small"
              :scroll="{ minWidth: 1200, y: fileTableH }"
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
            </div>
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
      <a-form :model="{}" layout="vertical">
        <a-form-item label="目标分支">
          <!-- 分支选择行：下拉 + 显式刷新按钮（点击才 refresh=true 真正 git fetch） -->
          <a-space style="width: 100%">
            <a-select
              v-model="prescanBranch"
              :loading="loadingBranches"
              placeholder="选择要扫描的分支"
              allow-search
              style="flex: 1; min-width: 0"
              @change="onPrescanBranchChange"
            >
              <a-option v-for="br in prescanBranches" :key="br.name" :value="br.name">
                {{ br.name }}{{ br.is_default ? '（默认）' : '' }}
              </a-option>
            </a-select>
            <!-- 显式刷新分支：仅点此按钮才触发 git fetch（慢），打开弹窗默认用缓存 -->
            <a-button
              size="small"
              :loading="refreshingBranches"
              title="刷新分支（会执行 git fetch，较慢）"
              @click="refreshBranches"
            >
              <template #icon><icon-refresh /></template>
            </a-button>
          </a-space>
        </a-form-item>
        <a-form-item label="目标 Commit（可选，留空则使用分支最新提交）">
          <!-- commit 下拉：支持搜索 + 手工输入不在列表中的 sha，保留 7~40 位 hex 校验。
               allow-clear 允许清空回「使用分支最新提交」语义；清空后 prescanCommit 为空串，
               doPrescanConfirm 中 prescanCommit.value || undefined 会转成 undefined，后端取分支最新 commit。 -->
          <a-select
            v-model="prescanCommit"
            :loading="loadingCommits"
            placeholder="留空则使用分支最新提交"
            allow-search
            allow-create
            allow-clear
            style="width: 100%"
          >
            <a-option v-for="c in prescanCommits" :key="c.sha" :value="c.sha">
              {{ formatCommitLabel(c) }}
            </a-option>
          </a-select>
        </a-form-item>
        <a-form-item label="扫描范围">
          <a-radio-group v-model="scanScope" type="button">
            <a-radio value="full">全量</a-radio>
            <a-radio value="diff_last">自上次扫描（增量）</a-radio>
            <a-radio value="diff_commit">指定基准 commit</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item v-if="scanScope === 'diff_commit'" label="基准 Commit SHA">
          <!-- 差量基准 commit：支持下拉选同分支 commit，保留手工输入与 7~40 位 hex 校验。
               allow-clear 允许清空；disabled 联动：仅 scanScope === 'diff_commit' 时可操作，
               其他 scope 时此 form-item 整体隐藏（v-if），不破坏 disabled 联动逻辑。
               清空后 baseCommitInput 为空串，doPrescanConfirm 中 diff_commit 分支要求非空会提示用户。 -->
          <a-select
            v-model="baseCommitInput"
            :disabled="scanScope !== 'diff_commit'"
            :loading="loadingCommits"
            placeholder="选择或输入基准 7~40 位 hex commit SHA"
            allow-search
            allow-create
            allow-clear
            style="width: 100%"
          >
            <a-option v-for="c in baseCommits" :key="c.sha" :value="c.sha">
              {{ formatCommitLabel(c) }}
            </a-option>
          </a-select>
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
      <a-form :model="{}" layout="vertical">
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
          :data="crossCompareRows"
          :columns="crossCompareColumns"
          :pagination="false"
          row-key="comparison_key"
          size="small"
          :scroll="{ minWidth: 1100 }"
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
