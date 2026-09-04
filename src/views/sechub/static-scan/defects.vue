<script setup lang="ts">
import type { IssueRuleStatRow, IssueVerifyResult, ModuleWithRepository, ScanIssueEventRow, ScanIssuePage, ScanIssueRow } from '@/types/static-scan'
import { Message } from '@arco-design/web-vue'
import { MdPreview } from 'md-editor-v3'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ErrorFlag } from '@/api/apis'
import { ApiSecModuleRepository, ApiSecPrescan, ApiSecProjectGroup } from '@/api/sechubApis'
import { downloadText, formatTime, useDicts, useGet, usePost, useTableAutoHeight, withTableDefaults } from '@/hooks'
import 'md-editor-v3/lib/style.css'

defineOptions({ name: 'StaticScanDefects' })

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
})

// Arco 的 multiple 要求数组，后端接受逗号分隔字符串，这里做转换
const riskLevels = ref<string[]>([])
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
const { isFetching: isLoading, data: rawListData, execute: getList } = useGet<ScanIssuePage>(ApiSecPrescan.issues, queryParams, { immediate: true })
const dataList = computed(() => rawListData.value?.list ?? [])
const total = computed(() => rawListData.value?.total ?? 0)

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
const selectedIds = ref<string[]>([])
const selectedRows = computed(() => dataList.value.filter(r => selectedIds.value.includes(r.id)))
function handleSelectionChange(keys: (string | number)[]) {
  selectedIds.value = keys as string[]
}
function clearSelection() {
  selectedIds.value = []
}

// ===== 状态能力判断 =====
function canClaim(status: string): boolean {
  return status === 'open' || status === 'reopened'
}
function canWontFix(status: string): boolean {
  return status === 'open' || status === 'reopened'
}
function canVerify(status: string): boolean {
  return status === 'fixed' || status === 'verified' || status === 'verification_failed' || status === 'wont_fix'
}

// ===== 缺陷处理：批量认领（open/reopened → fixing）=====
const batchClaimLoading = ref(false)
async function batchClaim() {
  const eligible = selectedRows.value.filter(r => canClaim(r.status))
  if (!eligible.length) {
    Message.warning('所选缺陷中没有可认领的（仅「打开/重新打开」状态可认领）')
    return
  }
  batchClaimLoading.value = true
  try {
    let ok = 0
    for (const row of eligible) {
      if (await postAction(ApiSecPrescan.issueClaim, { issue_id: row.id }) !== null)
        ok++
    }
    Message.success(`认领成功 ${ok}/${eligible.length} 条`)
    clearSelection()
    void getList()
  }
  finally {
    batchClaimLoading.value = false
  }
}

// ===== 缺陷处理：批量标记已修复（fixing → fixed）=====
const fixedVisible = ref(false)
const fixedTargets = ref<ScanIssueRow[]>([])
const fixedNote = ref('')
const fixedLoading = ref(false)

function openFixedModal() {
  const eligible = selectedRows.value.filter(r => r.status === 'fixing')
  if (!eligible.length) {
    Message.warning('所选缺陷中没有「修复中」的，无法标记已修复')
    return
  }
  fixedTargets.value = eligible
  fixedNote.value = ''
  fixedVisible.value = true
}

async function submitFixed() {
  fixedLoading.value = true
  try {
    let ok = 0
    for (const row of fixedTargets.value) {
      if (await postAction(ApiSecPrescan.issueFixed, { issue_id: row.id, note: fixedNote.value }) !== null)
        ok++
    }
    Message.success(`已标记修复 ${ok}/${fixedTargets.value.length} 条`)
    fixedVisible.value = false
    clearSelection()
    void getList()
  }
  finally {
    fixedLoading.value = false
  }
}

// ===== DMP 缺陷编码：批量回填 =====
// 一批缺陷常对应同一个 DMP 单，所以做成「勾选后填一个编码」而不是逐行编辑。
const dmpVisible = ref(false)
const dmpTargets = ref<ScanIssueRow[]>([])
const dmpCode = ref('')
const dmpLoading = ref(false)

function openDmpModal() {
  if (!selectedIds.value.length)
    return
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
  const loc = await fetchJson<{ run_id: string, repository_id: string, ai_model?: string, ai_mode?: string }>(
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
  const eligible = selectedRows.value.filter(r => canWontFix(r.status))
  if (!eligible.length) {
    Message.warning('所选缺陷中没有可标记不处理的（仅「打开/重新打开」状态可操作）')
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

// ===== 缺陷处理：重新验证（重新拉取指定分支的最新代码后定向重扫）=====
//
// 为什么要能指定分支/commit：开发协作场景下，1 号在 sit 扫出的缺陷，3 号开发把
// 修复提在了 patch 分支上，他过来自验证时必须能指定那个分支。留空时后端按
// 「该缺陷来源 run 的分支 → 仓库默认分支」解析（原实现固定用仓库默认分支，
// 在非默认分支上扫出的问题会被拿到默认分支验证，结论必然不可信）。
//
// 验证**不会创建扫描运行**：它只对「问题文件 + 问题规则」做定向扫描，
// 多人反复点验证不产生 run 记录，只各自留下一条验证事件。
const batchVerifyLoading = ref(false)
const verifyVisible = ref(false)
const verifyTargets = ref<ScanIssueRow[]>([])
const verifyForm = ref({ branch: '', commit_sha: '' })

function openVerifyDialog() {
  const eligible = selectedRows.value.filter(r => canVerify(r.status))
  if (!eligible.length) {
    Message.warning('所选缺陷中没有可重新验证的（仅「已修复/已验证/验证失败/不处理」状态可验证）')
    return
  }
  verifyTargets.value = eligible
  verifyForm.value = { branch: '', commit_sha: '' }
  verifyVisible.value = true
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
    const branch = verifyForm.value.branch.trim()
    const commit = verifyForm.value.commit_sha.trim()
    let fixed = 0
    let stillHit = 0
    let failed = 0
    for (const row of eligible) {
      const payload: Record<string, any> = { issue_id: row.id }
      if (branch)
        payload.branch = branch
      if (commit)
        payload.commit_sha = commit
      const result = await postAction<IssueVerifyResult>(ApiSecPrescan.issueVerify, payload)
      if (result !== null) {
        if (result.still_hit)
          stillHit++
        else
          fixed++
      }
      else {
        failed++
      }
    }
    // 失败要单独报数：拉取远端失败时后端现在是**硬报错**而不是拿陈旧副本给结论，
    // 把它混进"仍存在"会让人以为修复没生效。
    const failNote = failed > 0 ? `，${failed} 条验证失败（多为拉取远端代码失败，检查网络/凭据后重试）` : ''
    Message.success(`重新验证完成：已修复 ${fixed} 条，仍存在 ${stillHit} 条${failNote}`)
    verifyVisible.value = false
    clearSelection()
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

const eventTypeLabels: Record<string, { label: string, color: string }> = {
  create: { label: '创建', color: 'blue' },
  claim: { label: '认领', color: 'blue' },
  fixed: { label: '标记修复', color: 'green' },
  verified: { label: '重新验证', color: 'purple' },
  wont_fix: { label: '不处理', color: 'gray' },
}

// ===== 查看报告（MdPreview 抽屉）=====
const reportVisible = ref(false)
const reportRow = ref<ScanIssueRow | null>(null)
function viewReport(row: ScanIssueRow) {
  reportRow.value = row
  reportVisible.value = true
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
  verification_failed: { label: '验证失败', color: 'orange' },
}

// 不处理原因列的 Arco filterable 配置，选项来自字典（wontFixReasonOptions 异步加载）
// 使用 computed 以便字典加载完成后自动更新过滤选项
const wontFixReasonFilters = computed(() =>
  wontFixReasonOptions.value.map(opt => ({ text: opt.label, value: opt.value })),
)

const columns = computed(() => withTableDefaults([
  { title: '缺陷标题', dataIndex: 'title', width: 240 },
  { title: '领域', dataIndex: 'domain', slotName: 'domain', width: 70 },
  { title: '分类', dataIndex: 'category', width: 100 },
  { title: '风险', dataIndex: 'risk_level', slotName: 'risk', width: 65 },
  { title: '状态', dataIndex: 'status', slotName: 'status', width: 90 },
  { title: '负责人', dataIndex: 'assignee', width: 75 },
  { title: '文件', dataIndex: 'file_path', width: 180 },
  { title: '命中', dataIndex: 'hit_count', width: 50 },
  { title: '引入时间', dataIndex: 'introduced_at', slotName: 'introducedAt', width: 140 },
  { title: 'DMP 编码', dataIndex: 'dmp_defect_code', slotName: 'dmpCode', width: 130, ellipsis: true, tooltip: true },
  { title: '更新时间', dataIndex: 'updated_at', width: 115 },
  // 不处理原因列：宽度 130，支持后端过滤，选项来自字典
  // filter 走后端（@filter-change → queryParams.wont_fix_reason_code），本地 filter 函数
  // 固定返回 true，不做客户端行筛选，仅作为 Arco 的必填字段占位。
  {
    title: '不处理原因',
    dataIndex: 'wont_fix_reason_code',
    slotName: 'wontFixReason',
    width: 130,
    filterable: {
      filters: wontFixReasonFilters.value,
      multiple: false,
      // Arco TableFilterable.filter 为必填字段；本页走后端过滤，此处返回 true 不做本地筛选
      filter: () => true,
    },
  },
  { title: '操作', slotName: 'ops', width: 105, fixed: 'right' as const },
]))

onMounted(() => {
  void loadRuleStats()
})

// ===== 表格高度自适应（滚动条出现在表格内，表头固定）=====
const tableWrap = ref<HTMLElement>()
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
              验证失败
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
          <a-button @click="refresh">
            刷新
          </a-button>
        </a-space>
      </a-card>

      <!-- 左树右表（可拖拽分栏） -->
      <div class="split-layout" :class="{ dragging: isDragging }">
        <!-- 左树：规则分布 -->
        <div class="split-left" :style="{ width: `${leftPanelWidth}px` }">
          <a-card :bordered="false" size="small" class="split-card panel-scroll-y">
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
          <a-card :bordered="false" class="split-card">
            <template #title>
              缺陷列表
              <small class="card-sub">勾选缺陷后通过上方工具栏批量处理：认领 → 标记修复 → 重新验证，或标记不处理（可同步白名单）</small>
            </template>
            <!-- 批量操作工具栏 -->
            <a-row class="m-b-8px">
              <a-space>
                <!-- 补偿匹配白名单：拿白名单里的指纹回头匹配待处理缺陷，把漏标的补上。
                 白名单来源是「标记不处理」时勾选的「同步白名单」 -->
                <a-tooltip content="用白名单里的指纹匹配待处理缺陷，命中的自动标记不处理" mini>
                  <a-button :loading="whitelistBusy" @click="compensateWhitelist">
                    补偿匹配白名单
                  </a-button>
                </a-tooltip>
                <a-button type="primary" :disabled="!selectedIds.length" :loading="batchClaimLoading" @click="batchClaim">
                  认领
                </a-button>
                <a-button status="success" :disabled="!selectedIds.length" @click="openFixedModal">
                  标记已修复
                </a-button>
                <a-button status="warning" :disabled="!selectedIds.length" @click="openWontFixModal">
                  标记不处理
                </a-button>
                <a-button :disabled="!selectedIds.length" :loading="batchVerifyLoading" @click="openVerifyDialog">
                  重新验证
                </a-button>
                <a-tooltip content="把所选缺陷关联到 DMP 单号，可批量填同一个" mini>
                  <a-button :disabled="!selectedIds.length" @click="openDmpModal">
                    DMP 编码
                  </a-button>
                </a-tooltip>
                <span v-if="selectedIds.length" class="selected-hint">已选 {{ selectedIds.length }} 条</span>
              </a-space>
            </a-row>
            <div ref="tableWrap">
              <a-table
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
                :scroll="{ x: 1480, y: tableHeight }"
                @page-change="onPageChange"
                @page-size-change="onPageSizeChange"
                @selection-change="handleSelectionChange"
                @filter-change="onWontFixReasonFilter"
              >
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
                <a-tag :color="statusLabels[record.status]?.color ?? 'gray'" size="small">
                  {{ statusLabels[record.status]?.label ?? record.status }}
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
              <!-- 不处理原因列：展示字典 label，为空显示占位符，null 不渲染 -->
              <template #wontFixReason="{ record }">
                <span v-if="record.wont_fix_reason_code">
                  {{ wontFixReasonLabelMap[record.wont_fix_reason_code] ?? record.wont_fix_reason_code }}
                </span>
                <span v-else class="text-muted">-</span>
              </template>
              <template #ops="{ record }">
                <a-space>
                  <a-button type="text" size="small" @click="viewInResults(record)">
                    查看批次
                  </a-button>
                  <a-button type="text" size="small" :disabled="!record.ai_detail_report" @click="viewReport(record)">
                    报告
                  </a-button>
                  <a-button type="text" size="small" @click="viewEvents(record)">
                    流转
                  </a-button>
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

      <a-modal v-model:visible="fixedVisible" :title="`标记已修复（${fixedTargets.length} 条）`" :ok-loading="fixedLoading" @ok="submitFixed" @cancel="fixedVisible = false">
        <a-form layout="vertical" :model="layoutOnlyModel">
          <a-alert type="info" class="m-b-12px">
            将对 {{ fixedTargets.length }} 条「修复中」的缺陷统一标记为已修复
          </a-alert>
          <a-form-item label="修复说明（可选）">
            <a-textarea v-model="fixedNote" placeholder="如：已在 commit abc123 中移除硬编码密钥" :max-length="200" show-word-limit />
          </a-form-item>
        </a-form>
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
            <a-timeline-item v-for="ev in eventsList" :key="ev.id" :label="formatTime(ev.created_at)">
              <div class="event-item">
                <a-tag :color="eventTypeLabels[ev.event_type]?.color ?? 'gray'" size="small">
                  {{ eventTypeLabels[ev.event_type]?.label ?? ev.event_type }}
                </a-tag>
                <span v-if="ev.from_status || ev.to_status" class="event-transition">
                  {{ statusLabels[ev.from_status ?? '']?.label ?? ev.from_status ?? '—' }}
                  →
                  {{ statusLabels[ev.to_status ?? '']?.label ?? ev.to_status ?? '—' }}
                </span>
              </div>
              <div v-if="ev.reason" class="event-reason">
                {{ ev.reason }}
              </div>
              <div v-if="ev.commit_sha" class="event-commit">
                commit: {{ ev.commit_sha }}
              </div>
            </a-timeline-item>
          </a-timeline>
          <a-empty v-else description="暂无流转记录" />
        </a-spin>
      </a-drawer>

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
    <!-- 重新验证弹窗：指定分支与 commit -->
    <a-modal
      v-model:visible="verifyVisible"
      title="重新验证缺陷"
      :ok-loading="batchVerifyLoading"
      @ok="batchVerify"
      @cancel="verifyVisible = false"
    >
      <a-alert type="info" class="m-b-12px">
        将对 <b>{{ verifyTargets.length }}</b> 条缺陷重新拉取代码并定向重扫（只扫问题文件 + 问题规则），
        <b>不会创建扫描运行记录</b>，可以反复验证。
        <template v-if="verifyRepoNames.length > 1">
          <br>⚠️ 所选缺陷跨 {{ verifyRepoNames.length }} 个仓库（{{ verifyRepoNames.join('、') }}），
          同一个分支名会套用到全部仓库，建议按仓库分批验证。
        </template>
      </a-alert>
      <a-form :model="verifyForm" layout="vertical">
        <a-form-item label="分支">
          <a-input v-model="verifyForm.branch" placeholder="留空 = 该缺陷来源扫描轮次的分支（没有则用仓库默认分支）" allow-clear />
          <template #extra>
            开发把修复提在别的分支（如 patch 分支）时，在这里填那个分支名。
          </template>
        </a-form-item>
        <a-form-item label="Commit">
          <a-input v-model="verifyForm.commit_sha" placeholder="留空 = 该分支最新 HEAD（常用）" allow-clear />
          <template #extra>
            留空即取最新提交。无论是否指定，实际验证的 commit 都会记进流转记录。
          </template>
        </a-form-item>
        <a-alert type="warning">
          拉取远端失败时验证会<b>直接报错</b>，不会用本地陈旧代码给结论 ——
          否则会把「3 号提交的修复」按「1 号的代码」判成仍存在。
        </a-alert>
      </a-form>
    </a-modal>
  </div>
</template>

<style scoped>
.static-scan-defects { padding: 0; display: flex; flex-direction: column; min-height: 0; flex: 1; }
.card-sub { margin-left: 12px; color: var(--color-text-3); font-weight: normal; font-size: 12px; }
.selected-hint { color: var(--color-text-2); font-size: 13px; }
.text-muted { color: var(--color-text-4); }
.split-layout { display: flex; gap: 0; align-items: stretch; flex: 1; min-height: 0; }
.split-layout.dragging { user-select: none; cursor: col-resize; }
.split-left { flex-shrink: 0; overflow: hidden; }
.split-card { height: 100%; min-height: 0; overflow-y: auto; }
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
.event-commit { margin-top: 2px; font-size: 12px; color: var(--color-text-4); font-family: monospace; }

.report-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 8px;
}

.dmp-empty {
  color: var(--color-text-4);
  font-size: 12px;
}
</style>
