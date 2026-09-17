<script setup lang="ts">
import type { AiAgent } from '@/api/aiApis'
import type { BranchesControlResponse, IssueImportSummary, IssueRuleStatRow, IssueTransitionSummary, ModuleWithRepository, RepositoryBranch, RepositoryCommit, RepositoryCommitListResponse, ScanIssueEventRow, ScanIssuePage, ScanIssueRow } from '@/types/static-scan'
import { Message } from '@arco-design/web-vue'
import { MdPreview } from 'md-editor-v3'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ApiAiAgent } from '@/api/aiApis'
import { ErrorFlag } from '@/api/apis'
import { ApiSecModuleRepository, ApiSecPrescan, ApiSecProjectGroup } from '@/api/sechubApis'
import { ApiSysUser } from '@/api/sysApis'
import { downloadText, formatTime, getAction, useAutoHeight, useDicts, useDownload, useGet, usePost, useTableAutoHeight, useToken, withTableDefaults } from '@/hooks'
import 'md-editor-v3/lib/style.css'

// 组件名必须与路由 name（= sys_menu.path）一致，keep-alive :include 按它对上缓存
// （见 components/layout/app-main.vue 的注释）。lint 的 PascalCase 提示只是警告，
// 改名却会让页签缓存失效，所以此处保持 kebab-case。
// eslint-disable-next-line vue/component-definition-name-casing
defineOptions({ name: 'defects' })

// ===== 字典：不处理原因（static_scan_wont_fix_reason）=====
// 复用项目既有 useDicts hook（stores/modules/dicts.ts 按 dict_type 拉 sys_dict_data，带缓存）
const router = useRouter()
const wontFixReasonDicts = useDicts('static_scan_wont_fix_reason')
const wontFixReasonOptions = computed(() => {
  const items = wontFixReasonDicts.value.static_scan_wont_fix_reason ?? []
  return items.map(d => ({ label: d.label, value: d.value }))
})

// code -> label 快查映射，供表格列展示
const wontFixReasonLabelMap = computed(() => {
  const map: Record<string, string> = {}
  for (const opt of wontFixReasonOptions.value) {
    map[opt.value] = opt.label
  }
  return map
})

// ===== 项目组选项 =====
const { data: pgData } = useGet<any>(ApiSecProjectGroup.getAll, {}, { immediate: true })
const pgOptions = computed(() => (Array.isArray(pgData.value) ? pgData.value : []).map((g: any) => ({ label: g.name, value: g.id })))

// ===== 应用列表（筛选用）=====
const { data: repoList } = useGet<ModuleWithRepository[]>(ApiSecModuleRepository.listWithModule, {}, { immediate: true })
const repositories = computed(() => repoList.value ?? [])

// ===== 问题列表 =====
// 查询参数新增 wont_fix_reason_code 用于后端过滤（后端 list_issues 已支持该参数）
const queryParams = ref({
  page_num: 1,
  page_size: 20,
  project_group_id: '',
  repository_id: '',
  domain: '',
  status: '',
  rule_version_id: '',
  scan_point_id: '',
  // 不处理原因代码过滤（Arco 表格 filterable 触发后写入此字段，传给后端）
  wont_fix_reason_code: '',
  // 风险等级过滤，逗号分隔多选（如 high,medium），由 riskLevels 同步而来
  risk_level: '',
  // DMP 缺陷编码过滤，模糊匹配；填 __none__ 可筛出还没提单的
  dmp_defect_code: '',
  // 缺陷编号过滤，模糊匹配（DEF-YYYYMMDD-NNNN）
  defect_code: '',
  // 来源过滤：scan=扫描检出 / import=Excel 导入
  source: '',
})

// Arco 的 multiple 要求数组，后端接受逗号分隔字符串，这里做转换
const riskLevels = ref<string[]>([])
const { isFetching: isLoading, data: rawListData, execute: getList } = useGet<ScanIssuePage>(ApiSecPrescan.issues, queryParams, { immediate: true })
const dataList = computed(() => rawListData.value?.list ?? [])
const total = computed(() => rawListData.value?.total ?? 0)

/** 「未关联」快捷筛选：再点一次取消，回到全部 */
function toggleDmpUnlinked() {
  queryParams.value.dmp_defect_code = queryParams.value.dmp_defect_code === '__none__' ? '' : '__none__'
  refresh()
}

function onRiskLevelChange() {
  queryParams.value.risk_level = riskLevels.value.join(',')
  queryParams.value.page_num = 1
  getList()
}

// ===== 导出 / 导入 / 模板 =====
const { downloadWithTip } = useDownload()

/** 当前筛选条件 → query string（导出与列表同一套条件，分页字段不参与） */
function filterQueryString(): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(queryParams.value)) {
    if (key === 'page_num' || key === 'page_size')
      continue
    if (value !== '' && value != null)
      params.set(key, String(value))
  }
  return params.toString()
}

function downloadImportTemplate() {
  void downloadWithTip(ApiSecPrescan.issuesTemplate, 'defect_import_template.xlsx', '模板下载失败')
}

const importVisible = ref(false)
const importLoading = ref(false)
/** 已存在则覆盖：按缺陷编号更新已有缺陷（默认关闭：重复编号报错跳过） */
const importOverwrite = ref(false)
const importResult = ref<IssueImportSummary | null>(null)

function openImport() {
  importResult.value = null
  importVisible.value = true
}

async function handleImportUpload(fileList: any[]) {
  const file = fileList?.[0]?.file
  if (!file)
    return
  importLoading.value = true
  importResult.value = null
  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('overwrite', String(importOverwrite.value))
    const { token } = useToken()
    const resp = await fetch(`/api${ApiSecPrescan.issuesImport}`, {
      method: 'POST',
      headers: { Authorization: token },
      body: formData,
    })
    const res = await resp.json()
    if (res.code === 200 || res.code === 0) {
      importResult.value = res.data
      Message.success(`导入完成：新增 ${res.data.inserted} 条${res.data.updated ? `，更新 ${res.data.updated} 条` : ''}`)
      refresh()
    }
    else {
      Message.error(res.msg || '导入失败')
    }
  }
  catch (e: any) {
    Message.error(`导入异常: ${e.message}`)
  }
  finally {
    importLoading.value = false
  }
}

// ===== 左树：缺陷规则维度统计 =====
const issueRuleStats = ref<IssueRuleStatRow[]>([])
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

async function fetchJson<T>(url: string): Promise<T | null> {
  const { data, execute } = useGet<T>(url, {}, { immediate: false })
  await execute()
  return data.value ?? null
}

// 左树数据：全部（根）→ domain 分组 → 扫描点 → 规则版本节点
const ruleTree = computed(() => {
  const groups = new Map<string, IssueRuleStatRow[]>()
  for (const r of issueRuleStats.value) {
    const d = r.domain || '未分类'
    if (!groups.has(d))
      groups.set(d, [])
    groups.get(d)!.push(r)
  }
  const domainNodes = Array.from(groups.entries()).map(([domain, rules]) => {
    const spGroups = new Map<string, IssueRuleStatRow[]>()
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
          open: spRules.reduce((s, r) => s + r.open, 0),
          fixing: spRules.reduce((s, r) => s + r.fixing, 0),
          fixed: spRules.reduce((s, r) => s + r.fixed, 0),
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

async function loadRuleStats() {
  ruleStatsLoading.value = true
  try {
    const params = new URLSearchParams()
    if (queryParams.value.project_group_id)
      params.set('project_group_id', queryParams.value.project_group_id)
    if (queryParams.value.repository_id)
      params.set('repository_id', queryParams.value.repository_id)
    issueRuleStats.value = await fetchJson<IssueRuleStatRow[]>(`${ApiSecPrescan.issueRuleStats}?${params.toString()}`) ?? []
    // 默认展开：全部 + 领域 + 扫描点层
    expandedKeys.value = ['all', ...ruleTree.value.flatMap(n => [n.key, ...(n.children ?? []).map(c => c.key)])]
  }
  finally {
    ruleStatsLoading.value = false
  }
}

function onTreeSelect(keys: (string | number)[]) {
  const key = keys.length ? String(keys[0]) : 'all'
  selectedRuleId.value = key
  queryParams.value.page_num = 1
  if (key === 'all') {
    queryParams.value.domain = ''
    queryParams.value.rule_version_id = ''
    queryParams.value.scan_point_id = ''
  }
  else if (key.startsWith('domain:')) {
    queryParams.value.domain = key.slice(7)
    queryParams.value.rule_version_id = ''
    queryParams.value.scan_point_id = ''
  }
  else if (key.startsWith('sp:')) {
    queryParams.value.domain = ''
    queryParams.value.rule_version_id = ''
    queryParams.value.scan_point_id = key.slice(3)
  }
  else {
    queryParams.value.domain = ''
    queryParams.value.rule_version_id = key
    queryParams.value.scan_point_id = ''
  }
  void getList()
}

function refresh() {
  queryParams.value.page_num = 1
  // 项目组/应用变更后重新加载左树；树选择重置为全部
  selectedRuleId.value = 'all'
  queryParams.value.rule_version_id = ''
  queryParams.value.scan_point_id = ''
  void getList()
  void loadRuleStats()
}

// 领域下拉变更：仅重载列表（不重载左树），同步树选中到对应领域节点
function onDomainSelectChange() {
  queryParams.value.page_num = 1
  queryParams.value.rule_version_id = ''
  queryParams.value.scan_point_id = ''
  selectedRuleId.value = queryParams.value.domain ? `domain:${queryParams.value.domain}` : 'all'
  void getList()
}

// 状态下拉变更：仅重载列表
function onStatusChange() {
  queryParams.value.page_num = 1
  void getList()
}

function onPageChange(page: number) {
  queryParams.value.page_num = page
  void getList()
}

function onPageSizeChange(size: number) {
  queryParams.value.page_size = size
  queryParams.value.page_num = 1
  void getList()
}

// ===== 不处理原因列过滤（后端过滤）=====
// Arco 表格 @filter-change 事件签名：(dataIndex: string, filteredValues: string[]) => any
// 只关心 wont_fix_reason_code 列的过滤值，取第一个选中值传给后端（后端支持单值过滤）
function onWontFixReasonFilter(dataIndex: string, filteredValues: string[]) {
  if (dataIndex !== 'wont_fix_reason_code')
    return
  // 取第一个选中值；未选时清空过滤
  queryParams.value.wont_fix_reason_code = filteredValues.length > 0 ? (filteredValues[0] ?? '') : ''
  queryParams.value.page_num = 1
  void getList()
}

// ===== POST 通用封装（业务错误时 hook 已弹 Message，这里返回 null 表示失败）=====
async function postAction<T = unknown>(url: string, payload: Record<string, any>): Promise<T | null> {
  const request = usePost<T>(url, payload, { immediate: false })
  await request.execute()
  if (request.error.value || request.data.value === ErrorFlag)
    return null
  return request.data.value
}

// ===== 行选择（批量操作基础）=====
// 受控选择（v-model:selected-keys）：勾选态由 selectedIds 反推。非受控模式下
// 表格自管勾选态，clearSelection() 只清内部数据、勾选框不同步取消，会出现
// 「看着勾着、点操作却提示请先勾选」的错位。
const selectedIds = ref<string[]>([])
const selectedRows = computed(() => dataList.value.filter(r => selectedIds.value.includes(r.id)))
function clearSelection() {
  selectedIds.value = []
}

/** 导出：勾选了就只导出勾选的（跨页累计）；没勾选按当前筛选导出全部 */
function exportIssues() {
  const qs = selectedIds.value.length
    ? new URLSearchParams({ ids: selectedIds.value.join(',') }).toString()
    : filterQueryString()
  void downloadWithTip(`${ApiSecPrescan.issuesExport}${qs ? `?${qs}` : ''}`, 'defects_export.xlsx', '导出失败')
}

// ===== 状态能力判断 =====
// 可标记不处理：待处理，以及"验证不通过"（复核确认仍在，但决定不修）
function canWontFix(status: string): boolean {
  return status === 'open' || status === 'reopened' || status === 'verification_failed'
}
// 可发起复核的：待验证 / 验证不通过 / 已验证（终态复核）。
// 不处理是人工决策要复核先重开；AI 复核中不重复提交；未修完的没有可验证对象。
function canVerify(row: ScanIssueRow): boolean {
  return row.coverage_state !== 'inactive'
    && (row.status === 'fixed' || row.status === 'verification_failed' || row.status === 'verified')
}

// ===== 缺陷处理：转交（选处理人；人从系统用户表来，与性能问题列表同口径）=====
const transferVisible = ref(false)
const transferLoading = ref(false)
const transferAssignee = ref('')
const transferRemark = ref('')

// 处理人下拉：取用户管理（/system/user/list），不从项目组成员取 ——
// 项目组成员表常常是空的（缺陷行上也没有项目组字段），下拉会没有数据；
// 直接选系统用户同时避免手输「张三/张三 /zhangsan」三种写法指向同一个人
const transferUserQuery = ref({ page_num: 1, page_size: 200 })
const { isFetching: transferUsersLoading, data: transferUsersRes, execute: loadTransferUsers } = useGet<any>(ApiSysUser.getList, transferUserQuery, { immediate: false })
const transferUserOptions = computed(() => {
  const list = transferUsersRes.value?.list
  return (Array.isArray(list) ? list : []).map((u: any) => ({
    value: u.user_nickname || u.user_name,
    label: u.user_nickname ? `${u.user_nickname}（${u.user_name}）` : u.user_name,
  }))
})

function openTransferModal() {
  if (!selectedIds.value.length) {
    Message.warning('请先勾选缺陷')
    return
  }
  transferAssignee.value = ''
  transferRemark.value = ''
  transferVisible.value = true
  void loadTransferUsers()
}

async function submitTransfer() {
  const assignee = transferAssignee.value.trim()
  if (!assignee) {
    Message.warning('请选择处理人')
    return
  }
  transferLoading.value = true
  try {
    const res = await postAction<IssueTransitionSummary>(ApiSecPrescan.issueTransfer, {
      ids: selectedIds.value,
      assignee,
      remark: transferRemark.value.trim() || undefined,
    })
    if (!res)
      return
    // 后端按行汇总（不处理/已修复等状态会被跳过并说明原因）
    Message.success(res.message)
    transferVisible.value = false
    clearSelection()
    void getList()
  }
  finally {
    transferLoading.value = false
  }
}

// ===== 缺陷处理：处理下拉（修复中/已修复/已验证/重开/不处理）=====
// 与公有云性能-问题列表同形态：状态流转一个入口；「不处理」因为要填原因，走既有弹窗。
const PROCESS_ACTIONS = [
  { value: 'fixing', label: '修复中' },
  { value: 'fixed', label: '已修复' },
  { value: 'verified', label: '已验证' },
  { value: 'reopen', label: '重开' },
  { value: 'wont_fix', label: '不处理' },
]
const processLoading = ref(false)

function onProcessSelect(value: unknown) {
  const target = String(value ?? '')
  if (!target)
    return
  if (target === 'wont_fix') {
    openWontFixModal()
    return
  }
  void submitTransition(target)
}

async function submitTransition(target: string) {
  processLoading.value = true
  try {
    const res = await postAction<IssueTransitionSummary>(ApiSecPrescan.issueTransition, { ids: selectedIds.value, target })
    if (!res)
      return
    // 状态不符的行由后端跳过并在 message 里说明（如「重开」只对终态：已验证/不处理）
    Message.success(res.message)
    clearSelection()
    void getList()
  }
  finally {
    processLoading.value = false
  }
}

// ===== DMP 缺陷编码：批量回填 =====
// 一批缺陷常对应同一个 DMP 单，所以做成「勾选后填一个编码」而不是逐行编辑。
const dmpVisible = ref(false)
const dmpTargets = ref<ScanIssueRow[]>([])
const dmpCode = ref('')
const dmpLoading = ref(false)

function openDmpModal() {
  if (!selectedIds.value.length) {
    Message.warning('请先勾选缺陷')
    return
  }
  dmpTargets.value = [...selectedRows.value]
  // 已有编码且全都一样时预填，方便在原值上改；不一致就留空，避免误覆盖
  const codes = new Set(dmpTargets.value.map(r => r.dmp_defect_code || ''))
  dmpCode.value = codes.size === 1 ? [...codes][0] : ''
  dmpVisible.value = true
}

async function submitDmpCode() {
  dmpLoading.value = true
  try {
    const res = await postAction(ApiSecPrescan.issueDmpCode, {
      ids: dmpTargets.value.map(r => r.id),
      dmp_defect_code: dmpCode.value.trim(),
    })
    if (res !== null) {
      Message.success(dmpCode.value.trim() ? `已设置 DMP 编码（${dmpTargets.value.length} 条）` : `已清除 DMP 编码（${dmpTargets.value.length} 条）`)
      dmpVisible.value = false
      clearSelection()
      void getList()
    }
  }
  finally {
    dmpLoading.value = false
  }
}

// ===== 补偿匹配白名单 =====
const whitelistBusy = ref(false)

/**
 * 把命中白名单的待处理缺陷批量标记为不处理。
 *
 * 白名单的来源就是本页「标记不处理」时勾选的「同步白名单」——
 * 那会往 sec_static_waiver 写一条带指纹的豁免记录。这个按钮拿那些指纹
 * 回头匹配 open/reopened 的缺陷，把漏标的补上。
 *
 * 当前是精确指纹匹配。指纹（规则+文件+方法名，不含行号）本身就是平台判定
 * "同一问题"的口径，同指纹即同问题；"不同指纹但语义同一问题"才需要 AI，
 * 那部分留作后续增强。
 */
async function compensateWhitelist() {
  whitelistBusy.value = true
  try {
    const resp = await postAction<{ message?: string }>(
      ApiSecPrescan.compensateWhitelist,
      // 限定当前筛选的仓库，避免一次扫全库
      { repository_id: queryParams.value.repository_id || undefined },
    )
    if (resp) {
      Message.success(resp.message || '匹配完成')
      refresh()
    }
  }
  finally {
    whitelistBusy.value = false
  }
}

/**
 * 跳到该缺陷对应的扫描结果详情，并定位到具体批次。
 *
 * 带上 run_id 精确到批次；同时带 repository_id 让结果页能正确加载轮次列表。
 * 缺陷是跨轮次归并的实体，用 last_run_id（最近一次命中的轮次）——
 * first_run_id 是首次检出，代码早就变了，跳过去看到的行号可能对不上。
 */
async function viewInResults(row: ScanIssueRow) {
  // sec_scan_issue 没有 run_id 字段（它是跨轮次归并的实体），所以要让后端
  // 按「规则 + 文件 + 方法名」反查候选、再定位到 run。
  const loc = await fetchJson<{ run_id: string, repository_id: string, ai_model?: string, ai_mode?: string, candidate_id?: string }>(
    `${ApiSecPrescan.issueRun}?issue_id=${encodeURIComponent(row.id)}`,
  )
  if (!loc?.run_id) {
    Message.warning('没找到这条缺陷对应的扫描轮次（候选数据可能已被清理）')
    return
  }
  router.push({
    path: '/static-scan/scan/results',
    query: {
      run_id: loc.run_id,
      repository_id: loc.repository_id,
      // 带上命中的候选 id：结果页直接过滤到那一条，不用人工再从整批里筛
      ...(loc.candidate_id ? { candidate_id: loc.candidate_id } : {}),
      // 带上模型与模式，结果页的轮次选择器才能精确匹配到那一批
      ...(loc.ai_model ? { ai_model: loc.ai_model } : {}),
      ...(loc.ai_mode ? { ai_mode: loc.ai_mode } : {}),
    },
  })
}

// ===== 缺陷处理：批量标记不处理（open/reopened → wont_fix，可同步白名单）=====
const wontFixVisible = ref(false)
const wontFixTargets = ref<ScanIssueRow[]>([])
// reason_code 新增必填字段，reason 文本保持原有必填规则
const wontFixForm = ref<{
  reason: string
  impact_note: string
  sync_whitelist: boolean
  expires_at: string
  reason_code: string
}>({ reason: '', impact_note: '', sync_whitelist: false, expires_at: '', reason_code: '' })
const wontFixLoading = ref(false)

function openWontFixModal() {
  if (!selectedIds.value.length) {
    Message.warning('请先勾选缺陷')
    return
  }
  const eligible = selectedRows.value.filter(r => canWontFix(r.status))
  if (!eligible.length) {
    Message.warning('所选缺陷中没有可标记不处理的（仅「打开/重新打开/验证不通过」状态可操作）')
    return
  }
  wontFixTargets.value = eligible
  wontFixForm.value = { reason: '', impact_note: '', sync_whitelist: false, expires_at: '', reason_code: '' }
  wontFixVisible.value = true
}

async function submitWontFix() {
  // reason_code 为必选（统计与过滤的依据）
  if (!wontFixForm.value.reason_code) {
    Message.warning('请选择不处理原因分类')
    return
  }
  if (!wontFixForm.value.reason.trim()) {
    Message.warning('请填写不处理原因')
    return
  }
  wontFixLoading.value = true
  try {
    let ok = 0
    for (const row of wontFixTargets.value) {
      if (await postAction(ApiSecPrescan.issueWontFix, {
        issue_id: row.id,
        reason: wontFixForm.value.reason,
        impact_note: wontFixForm.value.impact_note,
        sync_whitelist: wontFixForm.value.sync_whitelist,
        expires_at: wontFixForm.value.expires_at || null,
        reason_code: wontFixForm.value.reason_code,
      }) !== null) {
        ok++
      }
    }
    Message.success(`已标记不处理 ${ok}/${wontFixTargets.value.length} 条`)
    wontFixVisible.value = false
    clearSelection()
    void getList()
  }
  finally {
    wontFixLoading.value = false
  }
}

// ===== 缺陷处理：重新验证（重新拉取最新代码后由所选 AI 复核判定）=====
//
// 为什么要能指定分支/commit：开发协作场景下，1 号在 sit 扫出的缺陷，3 号开发把
// 修复提在了 patch 分支上，他过来自验证时必须能指定那个分支；分支默认选该缺陷
// 对应的分支（留空时后端按「来源 run 分支 → 仓库默认分支」解析）。
//
// 流程：提交 → 后台异步执行（立即返回，不阻塞页面）：拉最新代码 → 规则定向
// 扫描（证据）→ 所选 Agent/模型复核判定 → 回写状态与流转事件。
// **不会创建扫描运行**；执行失败会写 verify_error 流转，刷新列表/流转即可看到原因。
const batchVerifyLoading = ref(false)
const verifyVisible = ref(false)
const verifyTargets = ref<ScanIssueRow[]>([])
const verifyForm = ref({ branch: '', commit_sha: '', agent_code: '', model: '' })

// 分支/commit 下拉（复用扫描看板同一组接口）
const verifyBranches = ref<RepositoryBranch[]>([])
const verifyBranchLoading = ref(false)
const verifyCommits = ref<RepositoryCommit[]>([])
const verifyCommitLoading = ref(false)
let verifyCommitSeq = 0

// Agent/模型下拉（模型候选随所选 Agent 的 supported_models_json 带出，与重扫弹窗同款）
const verifyAgents = ref<AiAgent[]>([])
const verifyAgentsLoading = ref(false)
let verifyAgentsRequested = false
const verifySelectedAgent = computed<AiAgent | null>(() => verifyAgents.value.find(a => a.agent_code === verifyForm.value.agent_code) ?? null)
const verifyModelOptions = computed(() => {
  const raw = verifySelectedAgent.value?.supported_models_json
  if (!raw)
    return []
  try {
    return (JSON.parse(raw) as string[])
      .map(item => String(item ?? '').trim())
      .filter(model => model && model !== 'auto')
  }
  catch {
    return []
  }
})
const verifyModelPlaceholder = computed(() => {
  const preset = verifySelectedAgent.value?.default_model?.trim()
  return preset && preset !== 'auto' ? `默认（${preset}）` : '默认（Agent 自选 / auto）'
})

/** 目标缺陷对应的仓库（多仓库时提示分批；分支/commit 选项取第一个目标仓库） */
const verifyRepo = computed(() =>
  repositories.value.find(r => r.repository_id === verifyTargets.value[0]?.repository_id) ?? null,
)

async function ensureVerifyAgents() {
  if (verifyAgentsRequested || verifyAgents.value.length)
    return
  verifyAgentsRequested = true
  verifyAgentsLoading.value = true
  try {
    const res = await getAction<{ list: AiAgent[] }>(ApiAiAgent.getList, { status: 'active', page_size: 50 })
    verifyAgents.value = res?.list ?? []
  }
  catch {
    verifyAgents.value = []
  }
  finally {
    verifyAgentsLoading.value = false
  }
}

/** commit 下拉标签：短 sha + 本地时区时间 + 标题（与扫描看板的基准 commit 下拉同款） */
function formatVerifyCommitLabel(commit: RepositoryCommit): string {
  const time = formatTime(commit.commit_time, { placeholder: '' })
  return time ? `${commit.short_sha} ${time} ${commit.subject}` : `${commit.short_sha} ${commit.subject}`
}

function defaultVerifyAgentCode(): string {
  const scanAgent = verifyAgents.value.find(a => a.agent_code === 'qoder-cli-scan')
  return scanAgent?.agent_code ?? verifyAgents.value[0]?.agent_code ?? ''
}

async function loadVerifyBranches() {
  const repo = verifyRepo.value
  if (!repo)
    return
  verifyBranchLoading.value = true
  try {
    const { data, execute } = useGet<BranchesControlResponse>(
      ApiSecModuleRepository.branches,
      { module_id: repo.module_id, relation_id: repo.relation_id, refresh: false },
      { immediate: false },
    )
    await execute()
    verifyBranches.value = data.value?.result === 'cached' ? data.value.data.branches : []
  }
  catch {
    verifyBranches.value = []
  }
  finally {
    verifyBranchLoading.value = false
  }
}

async function loadVerifyCommits(branch: string) {
  const repo = verifyRepo.value
  const seq = ++verifyCommitSeq
  if (!repo || !branch) {
    verifyCommits.value = []
    return
  }
  verifyCommitLoading.value = true
  try {
    // refresh=true：先 fetch mirror 再读——刚推上去的提交不刷新就选不到，
    // 而「验证刚提交的修复」正是这个弹窗的主要用法
    const { data, execute } = useGet<RepositoryCommitListResponse>(
      ApiSecPrescan.commits,
      { module_id: repo.module_id, relation_id: repo.relation_id, branch, limit: 30, refresh: true },
      { immediate: false },
    )
    await execute()
    if (seq !== verifyCommitSeq)
      return
    verifyCommits.value = data.value?.list ?? []
  }
  catch {
    if (seq === verifyCommitSeq)
      verifyCommits.value = []
  }
  finally {
    if (seq === verifyCommitSeq)
      verifyCommitLoading.value = false
  }
}

/** select 允许自由输入：提交前统一 trim */
function normalizeVerifyInput(value: string | undefined): string {
  return (value ?? '').trim()
}

function onVerifyBranchChange(value: unknown) {
  // 换分支后原 commit 不再有意义，清掉并按新分支加载候选
  verifyForm.value.commit_sha = ''
  verifyForm.value.branch = normalizeVerifyInput(value as string)
  void loadVerifyCommits(verifyForm.value.branch)
}

function onVerifyAgentChange() {
  // 换 Agent 后模型候选变了，清掉旧模型回到默认
  verifyForm.value.model = ''
}

function openVerifyDialog() {
  if (!selectedIds.value.length) {
    Message.warning('请先勾选缺陷')
    return
  }
  const eligible = selectedRows.value.filter(canVerify)
  if (!eligible.length) {
    Message.warning('所选缺陷中没有可重新验证的（仅「已修复/验证不通过/已验证」可发起；不处理请先重开，复核中的请等结果）')
    return
  }
  verifyTargets.value = eligible
  // 分支默认选「该缺陷对应的分支」：所选缺陷分支一致就用它；不一致/为空留空由后端解析
  const branches = [...new Set(eligible.map(r => (r.branch ?? '').trim()).filter(Boolean))]
  verifyForm.value = {
    branch: branches.length === 1 ? branches[0] : '',
    commit_sha: '',
    agent_code: '',
    model: '',
  }
  verifyCommits.value = []
  verifyVisible.value = true
  void ensureVerifyAgents().then(() => {
    if (!verifyForm.value.agent_code)
      verifyForm.value.agent_code = defaultVerifyAgentCode()
  })
  void loadVerifyBranches()
  if (verifyForm.value.branch)
    void loadVerifyCommits(verifyForm.value.branch)
}

/** 目标缺陷涉及的仓库（多仓库时提示用户分批，避免一个分支名套到不同仓库上） */
const verifyRepoNames = computed(() => {
  const ids = new Set(verifyTargets.value.map(r => r.repository_id))
  return (repoList.value ?? [])
    .filter(r => ids.has(r.repository_id))
    .map(r => r.repository_name)
})

async function batchVerify() {
  const eligible = verifyTargets.value
  batchVerifyLoading.value = true
  try {
    const branch = normalizeVerifyInput(verifyForm.value.branch)
    const commit = normalizeVerifyInput(verifyForm.value.commit_sha)
    let submitted = 0
    let failed = 0
    for (const row of eligible) {
      const payload: Record<string, any> = { issue_id: row.id }
      if (branch)
        payload.branch = branch
      if (commit)
        payload.commit_sha = commit
      if (verifyForm.value.agent_code)
        payload.agent_code = verifyForm.value.agent_code
      if (verifyForm.value.model)
        payload.model = verifyForm.value.model
      const result = await postAction<{ accepted?: boolean }>(ApiSecPrescan.issueVerify, payload)
      if (result !== null)
        submitted++
      else
        failed++
    }
    const failNote = failed > 0 ? `，${failed} 条未提交（状态不符或复核中，原因见上方提示）` : ''
    Message.success(`已提交 ${submitted} 条复核（后台执行，完成后刷新列表查看结果；流转记录有详情）${failNote}`)
    verifyVisible.value = false
    clearSelection()
    // 立即刷新一次：列表上会显示「AI 复核中」，复核完成后状态与结果回写
    void getList()
  }
  finally {
    batchVerifyLoading.value = false
  }
}

// ===== 流转记录（状态变更历史）=====
const eventsVisible = ref(false)
const eventsRow = ref<ScanIssueRow | null>(null)
const eventsList = ref<ScanIssueEventRow[]>([])
const eventsLoading = ref(false)

async function viewEvents(row: ScanIssueRow) {
  eventsRow.value = row
  eventsVisible.value = true
  eventsLoading.value = true
  eventsList.value = []
  try {
    const { data, execute } = useGet<ScanIssueEventRow[]>(ApiSecPrescan.issueEvents, { issue_id: row.id }, { immediate: false })
    await execute()
    eventsList.value = data.value ?? []
  }
  finally {
    eventsLoading.value = false
  }
}

// 复核报告：随流转事件留档，点开看那一轮 AI 复核的完整报告（多轮可对比；
// 与缺陷行「报告」的检出报告是两份东西，互不顶替）
const eventReportVisible = ref(false)
const eventReportRow = ref<ScanIssueEventRow | null>(null)
function viewEventReport(event: ScanIssueEventRow) {
  eventReportRow.value = event
  eventReportVisible.value = true
}

// 事件类型标签：key 与后端写入的 event_type 逐字一致
// （后端首检写 'created' 而非 'create'；重新检出写 'reopened' / 'status_change'）
const eventTypeLabels: Record<string, { label: string, color: string }> = {
  created: { label: '创建', color: 'blue' },
  claim: { label: '认领', color: 'blue' },
  fixed: { label: '标记修复', color: 'green' },
  verified: { label: '重新验证', color: 'purple' },
  reopened: { label: '重新打开', color: 'orangered' },
  status_change: { label: '状态更新', color: 'blue' },
  wont_fix: { label: '不处理', color: 'gray' },
  imported: { label: '导入更新', color: 'arcoblue' },
  verdict_rejected: { label: '判定撤销关系', color: 'gray' },
  finding_absent: { label: '扫描未再发现', color: 'gray' },
  file_deleted: { label: '文件删除失活', color: 'gray' },
  verify_error: { label: '复核执行失败', color: 'orange' },
}

// ===== 流转事件的结构化上下文（meta_json，复核事件携带）=====
/** 与后端 verify_meta_json 的字段一一对应（缺省字段为 null） */
interface VerifyEventMeta {
  kind?: string | null
  branch?: string | null
  commit_sha?: string | null
  commit_short_sha?: string | null
  commit_subject?: string | null
  commit_author?: string | null
  commit_time?: string | null
  agent_code?: string | null
  model?: string | null
  verdict?: string | null
  rationale?: string | null
  execution_id?: string | null
}

/** 解析 meta_json；老事件没有该字段、内容损坏时返回 null（模板退回 reason 文案） */
function parseEventMeta(event: ScanIssueEventRow): VerifyEventMeta | null {
  if (!event.meta_json)
    return null
  try {
    const parsed = JSON.parse(event.meta_json) as VerifyEventMeta
    return parsed && typeof parsed === 'object' ? parsed : null
  }
  catch {
    return null
  }
}

/** 流转列表 + 解析好的 meta：一次 JSON.parse，模板直接读 */
const eventsView = computed(() => eventsList.value.map(ev => ({ ...ev, meta: parseEventMeta(ev) })))

/** 事件标签：带 meta 的复核事件显示复核方式，其余沿用事件类型表 */
function eventLabel(event: ScanIssueEventRow & { meta: VerifyEventMeta | null }): { label: string, color: string } {
  if (event.meta?.kind === 'ai_verify')
    return { label: 'AI 复核', color: 'purple' }
  if (event.meta?.kind === 'rule_verify')
    return { label: '规则复核', color: 'purple' }
  return eventTypeLabels[event.event_type] ?? { label: event.event_type, color: 'gray' }
}

/** 结构化字段前缀：AI 复核事件带「AI」，规则复核不带 */
function metaPrefix(meta: VerifyEventMeta | null): string {
  return meta?.kind === 'ai_verify' ? 'AI 复核' : '复核'
}

/** AI 复核结论标签：三态判定 → 中文（与后端 normalize_verdict 口径一致） */
const verifyVerdictLabels: Record<string, { label: string, color: string }> = {
  confirmed: { label: '问题仍存在', color: 'orange' },
  rejected: { label: '验证通过（问题已修复）', color: 'green' },
  review_needed: { label: '无法明确判定', color: 'gray' },
}

// ===== 查看报告（MdPreview 抽屉）=====
const reportVisible = ref(false)
const reportRow = ref<ScanIssueRow | null>(null)
function viewReport(row: ScanIssueRow) {
  reportRow.value = row
  reportVisible.value = true
}

/** 操作列「更多」下拉的分发（默认只露「报告 + 更多」） */
function onOpsSelect(value: unknown, row: ScanIssueRow) {
  if (value === 'batch')
    void viewInResults(row)
  else if (value === 'events')
    void viewEvents(row)
}

// 下载 AI 生成的原始 md 报告。
// 内容已随问题列表返回（ai_detail_report），直接本地存盘，不再向后端多要一次。
// 文件名取问题标题，便于在一堆下载里对上是哪条缺陷。
function downloadReport() {
  const row = reportRow.value
  if (!row?.ai_detail_report) {
    Message.warning('该缺陷暂无详细报告')
    return
  }
  downloadText(row.ai_detail_report, `${row.title ?? 'AI报告'}.md`)
}

// ===== 标签映射 =====
const domainLabels: Record<string, { label: string, color: string }> = {
  security: { label: '安全', color: 'red' },
  performance: { label: '性能', color: 'blue' },
}
const riskLabels: Record<string, { label: string, color: string }> = {
  high: { label: '高', color: 'red' },
  medium: { label: '中', color: 'orange' },
  low: { label: '低', color: 'blue' },
  info: { label: '提示', color: 'gray' },
}
const statusLabels: Record<string, { label: string, color: string }> = {
  open: { label: '打开', color: 'red' },
  reopened: { label: '重新打开', color: 'orangered' },
  fixing: { label: '修复中', color: 'blue' },
  fixed: { label: '已修复', color: 'green' },
  verified: { label: '已验证', color: 'green' },
  wont_fix: { label: '不处理', color: 'gray' },
  verification_failed: { label: '验证不通过', color: 'orange' },
  /** 提交后的后台 AI 复核窗口期（完成后按判定回写） */
  verifying: { label: 'AI 复核中', color: 'arcoblue' },
}

const coverageReasonLabels: Record<string, { label: string, color: string }> = {
  verdict_rejected: { label: '判定撤销', color: 'gray' },
  finding_absent: { label: '扫描未再发现', color: 'gray' },
  file_deleted: { label: '文件已删除', color: 'gray' },
}

function issueStatusLabel(row: ScanIssueRow): { label: string, color: string } {
  if (row.coverage_state === 'inactive' && row.coverage_reason)
    return coverageReasonLabels[row.coverage_reason] ?? { label: '扫描范围失活', color: 'gray' }
  return statusLabels[row.status] ?? { label: row.status, color: 'gray' }
}
// 不处理原因列的 Arco filterable 配置，选项来自字典（wontFixReasonOptions 异步加载）
// 使用 computed 以便字典加载完成后自动更新过滤选项
const wontFixReasonFilters = computed(() =>
  wontFixReasonOptions.value.map(opt => ({ text: opt.label, value: opt.value })),
)

const columns = computed(() => withTableDefaults([
  { title: '缺陷编号', dataIndex: 'defect_code', slotName: 'defectCode', width: 210, ellipsis: true, tooltip: true },
  { title: '缺陷标题', dataIndex: 'title', width: 240 },
  { title: '来源', dataIndex: 'source', slotName: 'source', width: 64 },
  { title: '领域', dataIndex: 'domain', slotName: 'domain', width: 70, ellipsis: true, tooltip: true },
  { title: '分类', dataIndex: 'category', width: 100 },
  { title: '风险', dataIndex: 'risk_level', slotName: 'risk', width: 65, ellipsis: true, tooltip: true },
  { title: '状态', dataIndex: 'status', slotName: 'status', width: 90, ellipsis: true, tooltip: true },
  { title: '负责人', dataIndex: 'assignee', width: 75 },
  { title: '文件', dataIndex: 'file_path', width: 180 },
  { title: '命中', dataIndex: 'hit_count', slotName: 'hitCount', width: 50 },
  { title: '引入时间', dataIndex: 'introduced_at', slotName: 'introducedAt', width: 140, ellipsis: true, tooltip: true },
  { title: 'DMP 编码', dataIndex: 'dmp_defect_code', slotName: 'dmpCode', width: 130, ellipsis: true, tooltip: true },
  { title: '更新时间', dataIndex: 'updated_at', slotName: 'updatedAt', width: 190 },
  // 不处理原因列：宽度 130，支持后端过滤，选项来自字典
  // filter 走后端（@filter-change → queryParams.wont_fix_reason_code），本地 filter 函数
  // 固定返回 true，不做客户端行筛选，仅作为 Arco 的必填字段占位。
  {
    title: '不处理原因',
    dataIndex: 'wont_fix_reason_code',
    slotName: 'wontFixReason',
    width: 130,
    ellipsis: true,
    tooltip: true,
    filterable: {
      filters: wontFixReasonFilters.value,
      multiple: false,
      // Arco TableFilterable.filter 为必填字段；本页走后端过滤，此处返回 true 不做本地筛选
      filter: () => true,
    },
  },
  { title: '操作', slotName: 'ops', width: 120, fixed: 'right' as const },
]))

onMounted(() => {
  void loadRuleStats()
})

// ===== 表格高度自适应（滚动条出现在表格内，表头固定）=====
// 布局行实测定高：左右两栏由它派生高度
const layoutRow = ref<HTMLElement>()
const { height: layoutRowH } = useAutoHeight(layoutRow)

const tableWrap = ref<HTMLElement>()
// 从视口反推（不用 fillParent）：fillParent 会在首帧量到"还没被约束住的容器高度"，
// 表格高度被写成近 10 万像素、整页撑高、分页条被顶出视口（实测踩到）。
// 视口模式自带分页条与表头的实测扣减，高度天然有上界，翻页条始终在视口内。
const { tableHeight } = useTableAutoHeight(tableWrap)

// 这些 a-form 只用来做纵向布局，不做校验，但 arco 的 model 是必填 prop。
// 用一个模块级常量而不是在模板里写 :model="{}"，避免每次渲染都新建对象。
const layoutOnlyModel = {}

/**
 * 安全格式化时间字符串，解析失败时回退原值，不抛异常。
 * 支持 ISO8601 及 "YYYY-MM-DD HH:mm:ss" 格式。
 */
/**
 * 取 commit sha 的短 8 位，字段缺失时返回占位符。
 */
function shortSha(sha: string | null | undefined): string {
  if (!sha || !sha.trim())
    return '-'
  return sha.trim().slice(0, 8)
}
</script>

<template>
  <div style="display: flex; flex-direction: column; min-height: 0">
    <div class="static-scan-defects">
      <!-- 筛选 -->
      <a-card :bordered="false" class="m-b-12px">
        <a-space wrap>
          <a-select v-model="queryParams.project_group_id" allow-search allow-clear placeholder="项目组" style="width: 200px" @change="refresh">
            <a-option v-for="pg in pgOptions" :key="pg.value" :value="pg.value">
              {{ pg.label }}
            </a-option>
          </a-select>
          <a-select v-model="queryParams.repository_id" allow-search allow-clear placeholder="应用" style="width: 280px" @change="refresh">
            <a-option v-for="repo in repositories" :key="repo.repository_id" :value="repo.repository_id">
              {{ repo.module_name }}（{{ repo.repository_name }}）
            </a-option>
          </a-select>
          <a-select v-model="queryParams.domain" allow-clear placeholder="领域" style="width: 120px" @change="onDomainSelectChange">
            <a-option value="security">
              安全
            </a-option>
            <a-option value="performance">
              性能
            </a-option>
          </a-select>
          <a-select v-model="queryParams.status" allow-clear placeholder="状态" style="width: 130px" @change="onStatusChange">
            <a-option value="open">
              打开
            </a-option>
            <a-option value="reopened">
              重新打开
            </a-option>
            <a-option value="fixing">
              修复中
            </a-option>
            <a-option value="fixed">
              已修复
            </a-option>
            <a-option value="verified">
              已验证
            </a-option>
            <a-option value="wont_fix">
              不处理
            </a-option>
            <a-option value="verification_failed">
              验证不通过
            </a-option>
          </a-select>
          <!-- 风险等级多选：诉求是"优先处理高等级"，通常要 high 与 medium 一起看；
                 单选每次只能看一档、反复切换很别扭，所以做成 multiple -->
          <a-select
            v-model="riskLevels"
            multiple
            allow-clear
            :max-tag-count="2"
            placeholder="风险等级"
            style="width: 190px"
            @change="onRiskLevelChange"
          >
            <a-option value="high">
              高
            </a-option>
            <a-option value="medium">
              中
            </a-option>
            <a-option value="low">
              低
            </a-option>
          </a-select>
          <!-- DMP 编码过滤：模糊匹配（只记得单号一段也能找到）；
                 「未关联」是催办场景的主要用法 —— 找出确认了但还没提单的 -->
          <a-input-group>
            <a-input
              v-model="queryParams.dmp_defect_code"
              placeholder="DMP 编码"
              allow-clear
              style="width: 150px"
              @press-enter="refresh"
              @clear="refresh"
            />
            <a-tooltip content="只看还没关联 DMP 单的缺陷" mini>
              <a-button
                :type="queryParams.dmp_defect_code === '__none__' ? 'primary' : 'outline'"
                @click="toggleDmpUnlinked"
              >
                未关联
              </a-button>
            </a-tooltip>
          </a-input-group>
          <a-input
            v-model="queryParams.defect_code"
            placeholder="缺陷编号"
            allow-clear
            style="width: 150px"
            @press-enter="refresh"
            @clear="refresh"
          />
          <a-select v-model="queryParams.source" allow-clear placeholder="来源" style="width: 110px" @change="refresh">
            <a-option value="scan">
              扫描
            </a-option>
            <a-option value="import">
              导入
            </a-option>
          </a-select>
          <a-button @click="refresh">
            刷新
          </a-button>
        </a-space>
      </a-card>

      <!-- 左树右表（可拖拽分栏） -->
      <!--
        布局行必须有**确定高度**。原来只写 `flex: 1`，但它的父级
        `.static-scan-defects` 不是 flex 容器 —— `flex: 1` 无效，整行高度由内容决定，
        于是左树越展开页面越长（还会因祖先的 overflow 长出横向滚动条），
        右表又各自从视口反推高度，两边加起来超出视口。
        给这一行实测的确定高度后，左右两栏才有共同基准，各自内部滚动。
      -->
      <div ref="layoutRow" class="split-layout" :class="{ dragging: isDragging }" :style="{ height: `${layoutRowH}px` }">
        <!-- 左树：规则分布 -->
        <div class="split-left" :style="{ width: `${leftPanelWidth}px` }">
          <a-card :bordered="false" size="small" class="split-card scroll-body">
            <template #title>
              规则分布
              <small class="card-sub">打开/修复中/已修复/总数</small>
            </template>
            <a-spin :loading="ruleStatsLoading" style="width: 100%">
              <a-tree
                v-if="ruleTree.length"
                v-model:expanded-keys="expandedKeys"
                :data="ruleTree"
                :selected-keys="[selectedRuleId]"
                @select="onTreeSelect"
              >
                <template #title="node">
                  <div class="rule-node">
                    <span class="rule-name" :title="node.title">{{ node.title }}</span>
                    <span v-if="node.rule" class="rule-stats">
                      <span class="s-open">{{ node.rule.open }}</span>/<span class="s-fixing">{{ node.rule.fixing }}</span>/<span class="s-fixed">{{ node.rule.fixed }}</span>/<span class="s-total">{{ node.rule.total }}</span>
                    </span>
                    <span v-else-if="node.spStats" class="rule-stats">
                      <span class="s-open">{{ node.spStats.open }}</span>/<span class="s-fixing">{{ node.spStats.fixing }}</span>/<span class="s-fixed">{{ node.spStats.fixed }}</span>/<span class="s-total">{{ node.spStats.total }}</span>
                    </span>
                  </div>
                </template>
              </a-tree>
              <a-empty v-else description="暂无缺陷" />
            </a-spin>
          </a-card>
        </div>

        <!-- 拖拽手柄 -->
        <div class="split-handle" @mousedown="onDragStart" />

        <!-- 右表：缺陷列表 -->
        <div class="split-right">
          <a-card :bordered="false" class="split-card fill-body">
            <!-- 工具栏即卡片标题行：不再单独占一行，也不再显示「缺陷列表」标题文字 -->
            <template #title>
              <a-space>
                <!-- 补偿匹配白名单：拿白名单里的指纹回头匹配待处理缺陷，把漏标的补上。
                 白名单来源是「标记不处理」时勾选的「同步白名单」 -->
                <a-tooltip content="用白名单里的指纹匹配待处理缺陷，命中的自动标记不处理" mini>
                  <a-button :loading="whitelistBusy" @click="compensateWhitelist">
                    补偿匹配白名单
                  </a-button>
                </a-tooltip>
                <!-- 转交：选项目组 → 从该组成员里选处理人（与性能问题列表同形态） -->
                <a-button type="primary" :disabled="!selectedIds.length" @click="openTransferModal">
                  转交
                </a-button>
                <!-- 处理：状态流转统一入口（不处理需填原因，走弹窗） -->
                <a-dropdown :disabled="!selectedIds.length" @select="onProcessSelect">
                  <a-button :disabled="!selectedIds.length" :loading="processLoading">
                    处理
                    <template #icon>
                      <icon-down />
                    </template>
                  </a-button>
                  <template #content>
                    <a-doption v-for="action in PROCESS_ACTIONS" :key="action.value" :value="action.value">
                      {{ action.label }}
                    </a-doption>
                  </template>
                </a-dropdown>
                <a-button :disabled="!selectedIds.length" :loading="batchVerifyLoading" @click="openVerifyDialog">
                  重新验证
                </a-button>
                <a-tooltip content="把所选缺陷关联到 DMP 单号，可批量填同一个" mini>
                  <a-button @click="openDmpModal">
                    DMP 编码
                  </a-button>
                </a-tooltip>
                <a-tooltip :content="selectedIds.length ? `只导出勾选的 ${selectedIds.length} 条` : '导出当前筛选下全部缺陷'" mini>
                  <a-button @click="exportIssues">
                    导出
                  </a-button>
                </a-tooltip>
                <a-button @click="openImport">
                  导入
                </a-button>
                <a-button @click="downloadImportTemplate">
                  下载模板
                </a-button>
                <span v-if="selectedIds.length" class="selected-hint">已选 {{ selectedIds.length }} 条</span>
              </a-space>
            </template>
            <!-- 吃掉右栏剩余高度；配合实测高度让表格体正好等于这块空间 -->
            <div ref="tableWrap" class="table-fill">
              <a-table
                v-model:selected-keys="selectedIds"
                :loading="isLoading"
                :data="dataList"
                :columns="columns"
                :pagination="{
                  total,
                  current: queryParams.page_num,
                  pageSize: queryParams.page_size,
                  showTotal: true,
                  showPageSize: true,
                }"
                row-key="id"
                size="small"
                column-resizable
                :row-selection="{ type: 'checkbox', showCheckedAll: true }"
                :scroll="{ minWidth: 1480, y: tableHeight }"
                @page-change="onPageChange"
                @page-size-change="onPageSizeChange"
                @filter-change="onWontFixReasonFilter"
              >
                <template #defectCode="{ record }">
                  <!-- 编号+复制按钮必须同一行：不设 nowrap 时按钮会把编号挤到第二行 -->
                  <a-typography-text v-if="record.defect_code" copyable :copy-text="record.defect_code" class="cell-nowrap" style="font-size: 12px">
                    {{ record.defect_code }}
                  </a-typography-text>
                  <span v-else class="text-muted">-</span>
                </template>
                <template #source="{ record }">
                  <a-tag :color="record.source === 'import' ? 'orange' : 'arcoblue'" size="small">
                    {{ record.source === 'import' ? '导入' : '扫描' }}
                  </a-tag>
                </template>
                <template #domain="{ record }">
                  <a-tag :color="domainLabels[record.domain]?.color ?? 'gray'" size="small">
                    {{ domainLabels[record.domain]?.label ?? record.domain }}
                  </a-tag>
                </template>
                <template #dmpCode="{ record }">
                  <a-typography-text v-if="record.dmp_defect_code" copyable :copy-text="record.dmp_defect_code">
                    {{ record.dmp_defect_code }}
                  </a-typography-text>
                  <span v-else class="dmp-empty">未关联</span>
                </template>
                <template #risk="{ record }">
                  <a-tag v-if="record.risk_level" :color="riskLabels[record.risk_level]?.color ?? 'gray'" size="small">
                    {{ riskLabels[record.risk_level]?.label ?? record.risk_level }}
                  </a-tag>
                  <span v-else class="text-muted">-</span>
                </template>
                <template #status="{ record }">
                  <!-- 有复核记录时悬浮展示最近一次复核结果（时间 + 结论与依据） -->
                  <a-tooltip
                    v-if="record.last_verify_at"
                    :content="`最近复核（${formatTime(record.last_verify_at)}）\n${record.last_verify_reason || ''}`"
                    position="top"
                    mini
                  >
                    <a-tag :color="issueStatusLabel(record).color" size="small">
                      {{ issueStatusLabel(record).label }}
                    </a-tag>
                  </a-tooltip>
                  <a-tag v-else :color="issueStatusLabel(record).color" size="small">
                    {{ issueStatusLabel(record).label }}
                  </a-tag>
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
                <template #hitCount="{ record }">
                  <!-- 命中 = 该缺陷累计被检出的次数（首次为 1，重扫再次命中同一指纹 +1），
                       用来判断问题是否反复出现；最近一次命中时间看「更新时间」 -->
                  <a-tooltip content="累计被检出的次数：首次检出为 1，之后每次扫描再次命中同一问题 +1；最近一次命中时间见「更新时间」" position="top" mini>
                    <span class="cell-nowrap">{{ record.hit_count }}</span>
                  </a-tooltip>
                </template>
                <template #updatedAt="{ record }">
                  <!-- 更新时间：后端给 RFC3339，formatTime 按用户设置的时区渲染；
                       时间中间的空白是折行点，必须 nowrap 才不会断成两行 -->
                  <span class="cell-nowrap">{{ formatTime(record.updated_at) }}</span>
                </template>
                <!-- 不处理原因列：展示字典 label，为空显示占位符，null 不渲染 -->
                <template #wontFixReason="{ record }">
                  <span v-if="record.wont_fix_reason_code">
                    {{ wontFixReasonLabelMap[record.wont_fix_reason_code] ?? record.wont_fix_reason_code }}
                  </span>
                  <span v-else class="text-muted">-</span>
                </template>
                <template #ops="{ record }">
                  <a-space :size="4">
                    <a-button type="text" size="small" :disabled="!record.ai_detail_report" @click="viewReport(record)">
                      报告
                    </a-button>
                    <!-- 其余动作收进「更多」，避免操作列过宽、也少一眼三个按钮的噪音 -->
                    <a-dropdown trigger="click" @select="(value: unknown) => onOpsSelect(value, record)">
                      <a-button type="text" size="small">
                        更多
                        <template #icon>
                          <icon-down />
                        </template>
                      </a-button>
                      <template #content>
                        <a-doption value="batch">
                          查看批次
                        </a-doption>
                        <a-doption value="events">
                          流转
                        </a-doption>
                      </template>
                    </a-dropdown>
                  </a-space>
                </template>
              </a-table>
            </div>
          </a-card>
        </div>
      </div>

      <!-- 标记已修复弹窗（批量） -->
      <!-- DMP 缺陷编码：留空提交即清除关联 -->
      <a-modal
        v-model:visible="dmpVisible"
        :title="`设置 DMP 缺陷编码（${dmpTargets.length} 条）`"
        :ok-loading="dmpLoading"
        @ok="submitDmpCode"
      >
        <a-form :model="{ dmpCode }" layout="vertical">
          <a-form-item label="DMP 缺陷编码">
            <a-input v-model="dmpCode" placeholder="如 DMP-2026-0001，留空则清除关联" allow-clear />
          </a-form-item>
          <a-alert v-if="!dmpCode.trim()" type="warning">
            留空提交会清除所选 {{ dmpTargets.length }} 条缺陷的 DMP 编码
          </a-alert>
        </a-form>
      </a-modal>

      <!-- 转交弹窗：处理人从系统用户里选（缺陷本身没有项目组字段，不在此改归属） -->
      <a-modal v-model:visible="transferVisible" title="转交缺陷" :width="520" :footer="false" unmount-on-close>
        <a-form layout="vertical" :model="layoutOnlyModel">
          <a-alert type="info" class="m-b-12px">
            将把 {{ selectedIds.length }} 条缺陷转交给指定处理人（「打开/重新打开」会同时进入修复中）
          </a-alert>
          <a-form-item label="处理人" required>
            <a-select v-model="transferAssignee" allow-search allow-create :loading="transferUsersLoading" placeholder="从系统用户中选择（也可直接输入）">
              <a-option v-for="u in transferUserOptions" :key="u.value" :value="u.value">
                {{ u.label }}
              </a-option>
            </a-select>
          </a-form-item>
          <a-form-item label="说明（可选）">
            <a-input v-model="transferRemark" placeholder="写入流转记录" allow-clear />
          </a-form-item>
        </a-form>
        <div style="display: flex; justify-content: flex-end; gap: 8px">
          <a-button @click="transferVisible = false">
            取消
          </a-button>
          <a-button type="primary" :loading="transferLoading" @click="submitTransfer">
            确认转交
          </a-button>
        </div>
      </a-modal>

      <!-- 标记不处理弹窗（批量） -->
      <a-modal v-model:visible="wontFixVisible" :title="`标记不处理（${wontFixTargets.length} 条）`" width="560px" :ok-loading="wontFixLoading" @ok="submitWontFix" @cancel="wontFixVisible = false">
        <a-form layout="vertical" :model="layoutOnlyModel">
          <a-alert type="warning" class="m-b-12px">
            将对 {{ wontFixTargets.length }} 条「打开/重新打开」的缺陷统一标记为不处理
          </a-alert>
          <!-- 不处理原因分类（必选，后续统计与过滤的依据） -->
          <a-form-item label="原因分类" required>
            <a-select
              v-model="wontFixForm.reason_code"
              placeholder="请选择原因分类（必选）"
              allow-clear
            >
              <a-option
                v-for="opt in wontFixReasonOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </a-option>
            </a-select>
          </a-form-item>
          <a-form-item label="不处理原因" required>
            <a-textarea v-model="wontFixForm.reason" placeholder="如：测试环境专用配置，生产不启用" :max-length="200" show-word-limit />
          </a-form-item>
          <a-form-item label="影响说明">
            <a-textarea v-model="wontFixForm.impact_note" placeholder="说明该问题不处理的影响范围" :max-length="200" show-word-limit />
          </a-form-item>
          <a-form-item label="同步白名单">
            <a-checkbox v-model="wontFixForm.sync_whitelist">
              同时创建白名单条目（后续扫描该 fingerprint 不再计入）
            </a-checkbox>
          </a-form-item>
          <a-form-item v-if="wontFixForm.sync_whitelist" label="白名单过期时间（空=永久）">
            <a-date-picker v-model="wontFixForm.expires_at" value-format="YYYY-MM-DD" style="width: 100%" />
          </a-form-item>
        </a-form>
      </a-modal>

      <!-- 流转记录抽屉 -->
      <a-drawer
        :visible="eventsVisible"
        :width="520"
        :title="`流转记录 · ${eventsRow?.title ?? ''}`"
        :footer="false"
        @cancel="eventsVisible = false"
      >
        <a-spin :loading="eventsLoading" style="width: 100%">
          <a-timeline v-if="eventsList.length">
            <a-timeline-item v-for="ev in eventsView" :key="ev.id" :label="formatTime(ev.created_at)">
              <div class="event-item">
                <a-tag :color="eventLabel(ev).color" size="small">
                  {{ eventLabel(ev).label }}
                </a-tag>
                <span v-if="ev.from_status || ev.to_status" class="event-transition">
                  {{ statusLabels[ev.from_status ?? '']?.label ?? ev.from_status ?? '—' }}
                  →
                  {{ statusLabels[ev.to_status ?? '']?.label ?? ev.to_status ?? '—' }}
                </span>
              </div>
              <!-- 结构化上下文（复核事件）：分支 / commit / 时间 / 提交人 + 标题 + 结论 / 详情，
                   比一整行长文案好读；没有 meta 的老事件退回 reason 文案 -->
              <template v-if="ev.meta">
                <div class="event-meta">
                  <div v-if="ev.meta.branch || ev.meta.commit_sha" class="event-meta-row">
                    <span class="event-meta-label">提交</span>
                    <span class="event-meta-value">
                      <span v-if="ev.meta.branch" class="event-branch">{{ ev.meta.branch }}</span>
                      <a-tooltip v-if="ev.meta.commit_sha" :content="ev.meta.commit_sha" mini>
                        <span class="event-sha">{{ ev.meta.commit_short_sha || shortSha(ev.meta.commit_sha) }}</span>
                      </a-tooltip>
                      <span v-if="ev.meta.commit_time" class="event-meta-sub">{{ formatTime(ev.meta.commit_time) }}</span>
                      <span v-if="ev.meta.commit_author" class="event-meta-sub">{{ ev.meta.commit_author }}</span>
                    </span>
                  </div>
                  <div v-if="ev.meta.commit_subject" class="event-commit-subject" :title="ev.meta.commit_subject">
                    {{ ev.meta.commit_subject }}
                  </div>
                  <div v-if="ev.meta.verdict" class="event-meta-row">
                    <span class="event-meta-label">{{ metaPrefix(ev.meta) }}结论</span>
                    <span class="event-meta-value">
                      <a-tag :color="verifyVerdictLabels[ev.meta.verdict]?.color ?? 'gray'" size="small">
                        {{ verifyVerdictLabels[ev.meta.verdict]?.label ?? ev.meta.verdict }}
                      </a-tag>
                      <span v-if="ev.meta.model" class="event-meta-sub">{{ ev.meta.model }}</span>
                    </span>
                  </div>
                  <div v-if="ev.meta.rationale" class="event-meta-row">
                    <span class="event-meta-label">{{ metaPrefix(ev.meta) }}详情</span>
                    <span class="event-meta-value event-meta-text">{{ ev.meta.rationale }}</span>
                  </div>
                </div>
              </template>
              <div v-else-if="ev.reason" class="event-reason">
                {{ ev.reason }}
              </div>
              <div v-if="ev.detail_report" class="event-report-link">
                <a-button type="text" size="mini" @click="viewEventReport(ev)">
                  查看{{ metaPrefix(ev.meta) }}报告
                </a-button>
              </div>
              <div v-if="ev.commit_sha && !ev.meta" class="event-commit">
                commit: {{ shortSha(ev.commit_sha) }}
              </div>
            </a-timeline-item>
          </a-timeline>
          <a-empty v-else description="暂无流转记录" />
        </a-spin>
      </a-drawer>

      <!-- 复核报告弹窗：即该轮 AI 复核写的完整报告（随流转事件留档） -->
      <a-modal
        :visible="eventReportVisible"
        width="75%"
        :title="`复核报告 · ${eventReportRow ? formatTime(eventReportRow.created_at) : ''}`"
        :footer="false"
        :body-style="{ maxHeight: '76vh', overflowY: 'auto' }"
        unmount-on-close
        @cancel="eventReportVisible = false"
      >
        <MdPreview v-if="eventReportRow?.detail_report" :model-value="eventReportRow.detail_report" />
        <a-empty v-else description="该事件没有附带报告" />
      </a-modal>

      <!-- 查看报告弹窗（富文本渲染 Markdown，宽幅+可滚动，避免抽屉显示不全） -->
      <a-modal
        :visible="reportVisible"
        width="85%"
        :title="reportRow?.title ?? 'AI 详细报告'"
        :footer="false"
        :body-style="{ maxHeight: '78vh', overflowY: 'auto' }"
        unmount-on-close
        @cancel="reportVisible = false"
      >
        <a-descriptions :column="3" bordered size="small" class="m-b-12px">
          <a-descriptions-item label="领域">
            {{ domainLabels[reportRow?.domain ?? '']?.label ?? reportRow?.domain }}
          </a-descriptions-item>
          <a-descriptions-item label="风险">
            {{ reportRow?.risk_level ?? '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="状态">
            {{ statusLabels[reportRow?.status ?? '']?.label ?? reportRow?.status }}
          </a-descriptions-item>
          <a-descriptions-item label="文件" :span="3">
            {{ reportRow?.file_path }}{{ reportRow?.start_line ? `:${reportRow.start_line}` : '' }}
          </a-descriptions-item>
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
        <!-- 下载原始 md：内容已在前端手里，本地存盘即可，不必再走后端 -->
        <div v-if="reportRow?.ai_detail_report" class="report-toolbar">
          <a-button size="small" @click="downloadReport">
            <template #icon>
              <icon-download />
            </template>
            下载 md
          </a-button>
        </div>
        <MdPreview v-if="reportRow?.ai_detail_report" :model-value="reportRow.ai_detail_report" />
        <a-empty v-else description="暂无详细报告" />
      </a-modal>
    </div>
    <!-- 重新验证弹窗：选分支/commit/Agent/模型，提交后由后台 AI 复核 -->
    <a-modal
      v-model:visible="verifyVisible"
      title="重新验证缺陷"
      :ok-loading="batchVerifyLoading"
      @ok="batchVerify"
      @cancel="verifyVisible = false"
    >
      <a-alert type="info" class="m-b-12px">
        将对 <b>{{ verifyTargets.length }}</b> 条缺陷提交<b>后台复核</b>：重新拉取所选分支的最新代码，
        由所选 Agent/模型阅读代码判定问题是否仍存在（仍存在→状态置「验证不通过」；确认已修复→状态置「已验证」）。
        <b>不创建扫描运行记录</b>；提交后立即返回，完成后刷新列表查看结果（流转记录有详情）。
        <template v-if="verifyRepoNames.length > 1">
          <br>⚠️ 所选缺陷跨 {{ verifyRepoNames.length }} 个仓库（{{ verifyRepoNames.join('、') }}），
          同一个分支名会套用到全部仓库，建议按仓库分批验证。
        </template>
      </a-alert>
      <a-form :model="verifyForm" layout="vertical">
        <a-form-item label="分支">
          <a-select
            v-model="verifyForm.branch"
            :loading="verifyBranchLoading"
            placeholder="默认 = 该缺陷来源分支（没有则用仓库默认分支）"
            allow-search
            allow-create
            allow-clear
            @change="onVerifyBranchChange"
          >
            <a-option v-for="b in verifyBranches" :key="b.name" :value="b.name">
              {{ b.name }}{{ b.is_default ? '（默认）' : '' }}
            </a-option>
          </a-select>
          <template #extra>
            开发把修复提在别的分支（如 patch 分支）时，在这里选那个分支；也可直接输入列表外的分支名。
          </template>
        </a-form-item>
        <a-form-item label="Commit">
          <a-select
            v-model="verifyForm.commit_sha"
            :loading="verifyCommitLoading"
            :disabled="!verifyForm.branch"
            placeholder="留空 = 该分支最新 HEAD（常用）"
            allow-search
            allow-create
            allow-clear
          >
            <a-option v-for="c in verifyCommits" :key="c.sha" :value="c.sha">
              {{ formatVerifyCommitLabel(c) }}
            </a-option>
          </a-select>
          <template #extra>
            留空即取最新提交；也可直接粘贴 commit SHA。实际验证的 commit 会记进流转记录。
          </template>
        </a-form-item>
        <a-form-item label="执行 Agent">
          <a-select v-model="verifyForm.agent_code" :loading="verifyAgentsLoading" placeholder="选择执行复核的 Agent" @change="onVerifyAgentChange">
            <a-option v-for="agent in verifyAgents" :key="agent.agent_code" :value="agent.agent_code">
              {{ agent.agent_name || agent.agent_code }}
            </a-option>
          </a-select>
        </a-form-item>
        <a-form-item label="模型">
          <a-select v-model="verifyForm.model" :placeholder="verifyModelPlaceholder" allow-clear>
            <a-option v-for="m in verifyModelOptions" :key="m" :value="m">
              {{ m }}
            </a-option>
          </a-select>
        </a-form-item>
        <a-alert type="warning">
          拉取远端失败或 AI 执行失败时，会在流转记录里留一条「复核执行失败」说明，
          不会用本地陈旧代码或旧结论充数。
        </a-alert>
      </a-form>
    </a-modal>

    <!-- 导入弹窗：按模板上传 .xlsx，逐行校验；重复编号默认报错跳过，可开覆盖 -->
    <a-modal v-model:visible="importVisible" title="导入缺陷" :width="640" :footer="false" unmount-on-close>
      <a-alert type="info" class="m-b-12px">
        按「下载模板」的格式填写：<b>应用编码 / 领域 / 缺陷标题</b> 为必填（应用按<b>编码</b>匹配，不按名称）；
        缺陷编号留空自动生成，填写则原样入库（仅限 32 字符内）、重复报错；状态可填中文名（打开/修复中/已修复 等）；
        <b>规则编码</b>选填（填规则键，如 FULL-SQL-INJECTION-001，绑定该规则当前版本用于复核）。
      </a-alert>
      <a-checkbox v-model="importOverwrite" class="m-b-12px">
        已存在则覆盖（按缺陷编号更新已有缺陷；不开则重复编号报错跳过）
      </a-checkbox>
      <a-upload
        draggable
        accept=".xlsx,.xls"
        :auto-upload="false"
        :limit="1"
        @change="handleImportUpload"
      />
      <div v-if="importLoading" class="m-t-12px">
        <a-spin tip="导入中..." />
      </div>
      <div v-if="importResult" class="m-t-12px">
        <a-alert :type="importResult.errors?.length ? 'warning' : 'success'">
          <template #title>
            导入结果
          </template>
          <div>
            有效 {{ importResult.total }} 行，新增 {{ importResult.inserted }}，更新 {{ importResult.updated }}，跳过 {{ importResult.skipped }}
          </div>
          <div v-if="importResult.errors?.length" class="m-t-8px">
            <div v-for="(err, idx) in importResult.errors" :key="idx" class="import-error">
              {{ err }}
            </div>
          </div>
        </a-alert>
      </div>
      <div class="m-t-12px">
        <a-button type="text" size="small" @click="downloadImportTemplate">
          下载导入模板
        </a-button>
      </div>
    </a-modal>
  </div>
</template>

<style scoped>
.static-scan-defects { padding: 0; display: flex; flex-direction: column; min-height: 0; flex: 1; }
.card-sub { margin-left: 12px; color: var(--color-text-3); font-weight: normal; font-size: 12px; }
.selected-hint { color: var(--color-text-2); font-size: 13px; }
.text-muted { color: var(--color-text-4); }
/* flex-basis 必须是 auto：`flex: 1` 是 `1 1 0%`，basis 0% 会让上面实测的 `height`
   被 flex 布局无视 —— 行高退回内容驱动，左树一展开（性能+安全）就把整条高度链顶高，
   内容区出现滚动条。basis auto 时行的基准尺寸就是那个实测 height，grow 只在
   父级还有余量时才有意义，而父级高度是内容驱动的（余量恒为 0），行高因此稳定。 */
.split-layout { display: flex; gap: 0; align-items: stretch; flex: 1 1 auto; min-height: 0; }
.split-layout.dragging { user-select: none; cursor: col-resize; }
.split-left { flex-shrink: 0; overflow: hidden; }
/* 卡片撑满栏高但**自己不滚**；滚不滚由下面两个修饰类决定 */
.split-card { display: flex; flex-direction: column; height: 100%; min-height: 0; }

/* 左树卡片：标题固定，内容区滚动（原来整卡滚动，标题会跟着滚走） */
.scroll-body :deep(.arco-card-body) {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  /* 只写 overflow-y 时横向会被计算成 auto，探出的子元素会长出横向滚动条 */
  overflow-x: hidden;
}

/* 右侧卡片：内容区做纵向 flex，让表格容器吃掉剩余高度，滚动落在表格体内部 */
.fill-body :deep(.arco-card-body) {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
.table-fill { flex: 1; min-height: 0; }
.split-handle {
  width: 6px; flex-shrink: 0; cursor: col-resize; border-radius: 3px; margin: 0 3px;
  background: transparent; transition: background 0.2s;
}
.split-handle:hover, .split-layout.dragging .split-handle { background: rgb(var(--primary-6)); }
.split-right { flex: 1; min-width: 0; min-height: 0; }
.rule-node { display: flex; align-items: center; justify-content: space-between; gap: 4px; width: 100%; }
.rule-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rule-stats { flex-shrink: 0; font-size: 12px; color: var(--color-text-3); }
.s-open { color: rgb(var(--red-6)); font-weight: 500; }
.s-fixing { color: rgb(var(--blue-6)); }
.s-fixed { color: rgb(var(--green-6)); }
.s-total { color: var(--color-text-2); }
.event-item { display: flex; align-items: center; gap: 8px; }
.event-transition { font-size: 13px; color: var(--color-text-2); }
.event-reason { margin-top: 4px; font-size: 12px; color: var(--color-text-3); }
.event-report-link { margin-top: 2px; }
.event-commit { margin-top: 2px; font-size: 12px; color: var(--color-text-4); font-family: monospace; }
/* 复核事件的结构化上下文：左侧定宽标签列，右侧值自动换行 */
.event-meta { margin-top: 4px; display: flex; flex-direction: column; gap: 3px; }
.event-meta-row { display: flex; align-items: flex-start; gap: 6px; font-size: 12px; color: var(--color-text-2); }
.event-meta-label { flex-shrink: 0; width: 68px; color: var(--color-text-3); }
.event-meta-value { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; min-width: 0; }
.event-meta-sub { color: var(--color-text-3); }
.event-meta-text { color: var(--color-text-2); }
.event-branch { font-family: monospace; color: var(--color-text-2); }
.event-sha { font-family: monospace; }
/* 提交标题与标签列对齐（68px 标签 + 6px gap），过长省略号截断，完整值看 title */
.event-commit-subject {
  margin-left: 74px;
  font-size: 12px;
  color: var(--color-text-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.report-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 8px;
}

.dmp-empty {
  color: var(--color-text-4);
  font-size: 12px;
}

.import-error {
  font-size: 12px;
  color: rgb(var(--orange-6));
}

/* 槽位列不受 withTableDefaults 的 ellipsis 兜底约束，长内容会折行；这几列要求单行显示 */
.cell-nowrap {
  white-space: nowrap;
}
</style>
