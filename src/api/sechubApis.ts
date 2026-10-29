/**
 * @description: KD-SecHub 安全测试平台 API
 */

// ── 扫描工具 ──────────────────────────────────────
export enum ApiSecScanTool {
  getList = '/sechub/scan-tool/list',
  getAll = '/sechub/scan-tool/get_all',
  getById = '/sechub/scan-tool/get_by_id',
  add = '/sechub/scan-tool/add',
  edit = '/sechub/scan-tool/edit',
  delete = '/sechub/scan-tool/delete',
}

// ── 扫描运行 ──────────────────────────────────────
export enum ApiSecScanRun {
  getList = '/sechub/static-scan/run/list',
  getById = '/sechub/scan-run/get_by_id',
  preflight = '/sechub/scan-run/preflight',
  trigger = '/sechub/scan-run/trigger',
  webhook = '/sechub/scan-run/webhook',
  progress = '/sechub/scan-run/{id}/progress',
  scopes = '/sechub/scan-run/{id}/scopes',
  batches = '/sechub/scan-run/{id}/batches',
  cancel = '/sechub/scan-run/{id}/cancel',
  resume = '/sechub/scan-run/{id}/resume',
  scanPointEvaluationSummary = '/sechub/scan-run/{id}/scan-point-evaluation-summary',
  scanPointEvaluations = '/sechub/scan-run/{id}/scan-point-evaluations',
  ruleEvaluations = '/sechub/scan-run/{id}/rule-evaluations',
  publish = '/sechub/scan-run/{id}/publish',
}

// ── 安全发现 ──────────────────────────────────────
export enum ApiSecFinding {
  getList = '/sechub/static-scan/finding/list',
  getById = '/sechub/finding/get_by_id',
  manual = '/sechub/finding/manual',
  fromFeedback = '/sechub/finding/from-feedback',
  fromLegacy = '/sechub/finding/from-legacy',
  triage = '/sechub/finding/triage',
  assign = '/sechub/finding/assign',
  status = '/sechub/finding/status',
  reopen = '/sechub/finding/reopen',
  occurrences = '/sechub/finding/{id}/occurrences',
  events = '/sechub/finding/{id}/events',
  sourceSnapshots = '/sechub/finding/{id}/source-snapshots',
  verify = '/sechub/finding/{id}/verify',
  verifications = '/sechub/finding/{id}/verifications',
}

// ── 组织管理 ──────────────────────────────────────
export enum ApiSecOrg {
  getList = '/sechub/org/list',
  getById = '/sechub/org/get_by_id',
  add = '/sechub/org/add',
  edit = '/sechub/org/edit',
  delete = '/sechub/org/delete',
}

// ── 缺陷跟踪 ──────────────────────────────────────
export enum ApiSecDefect {
  getList = '/sechub/defect/list',
  getById = '/sechub/defect/get_by_id',
  add = '/sechub/defect/add',
  fromFinding = '/sechub/defect/from-finding',
  edit = '/sechub/defect/edit',
  delete = '/sechub/defect/delete',
}

// ── 项目组 ────────────────────────────────────────
export enum ApiSecProjectGroup {
  getList = '/sechub/project-group/list',
  getAll = '/sechub/project-group/get_all',
  getById = '/sechub/project-group/get_by_id',
  add = '/sechub/project-group/add',
  edit = '/sechub/project-group/edit',
  delete = '/sechub/project-group/delete',
  batchImport = '/sechub/project-group/import',
  memberCandidates = '/sechub/project-group/member-candidates',
  members = '/sechub/project-group/members',
}

// ── 发布窗口 ──────────────────────────────────────
export enum ApiSecReleaseWindow {
  getList = '/sechub/release-window/list',
  getById = '/sechub/release-window/get_by_id',
  add = '/sechub/release-window/add',
  edit = '/sechub/release-window/edit',
  delete = '/sechub/release-window/delete',
}

// ── 扫描任务 ──────────────────────────────────────
export enum ApiSecScanTask {
  getList = '/sechub/scan-task/list',
  getById = '/sechub/scan-task/get_by_id',
  add = '/sechub/scan-task/add',
  edit = '/sechub/scan-task/edit',
  delete = '/sechub/scan-task/delete',
}

// ── 测试环境 ──────────────────────────────────────
export enum ApiSecTestEnv {
  getList = '/sechub/test-env/list',
  getById = '/sechub/test-env/get_by_id',
  add = '/sechub/test-env/add',
  edit = '/sechub/test-env/edit',
  delete = '/sechub/test-env/delete',
}

// ── 用户故事 ──────────────────────────────────────
export enum ApiSecUserStory {
  getList = '/sechub/user-story/list',
  getById = '/sechub/user-story/get_by_id',
  add = '/sechub/user-story/add',
  edit = '/sechub/user-story/edit',
  delete = '/sechub/user-story/delete',
}

// ── 模块代码仓库 ──────────────────────────────────
export enum ApiSecModuleRepository {
  list = '/sechub/module/repositories',
  listWithModule = '/sechub/module/repositories-with-module',
  bind = '/sechub/module/repository/bind',
  edit = '/sechub/module/repository/edit',
  delete = '/sechub/module/repository/delete',
  validate = '/sechub/module/repository/validate',
  sourceSnapshot = '/sechub/module/repository/source-snapshot',
  sourceSnapshots = '/sechub/module/repository/source-snapshots',
  sourceJob = '/sechub/module/repository/source-job',
  indexSource = '/sechub/module/repository/index-source',
  indexSourceBatch = '/sechub/module/repository/index-source-batch',
  discoverMicroservice = '/sechub/module/repository/discover-microservice',
  branches = '/sechub/module/repository/branches',
  sync = '/sechub/module/repository/sync',
  commits = '/sechub/module/repository/commits',
}

// ── 静态扫描范围 ──────────────────────────────────
export enum ApiSecScanScope {
  preview = '/sechub/scan-scope/preview',
}

// ── 静态扫描规则治理（一期仅开放查询与门禁） ─────
export enum ApiSecScanPoint {
  getList = '/sechub/scan-point/list',
  getById = '/sechub/scan-point/get_by_id',
  tree = '/sechub/scan-point/tree',
}

export enum ApiSecRuleVersion {
  getList = '/sechub/rule-version/list',
  getById = '/sechub/rule-version/get_by_id',
  update = '/sechub/rule-version/update',
  setEnabled = '/sechub/rule-version/set_enabled',
  importRules = '/sechub/rule-version/import',
  exportRules = '/sechub/rule-version/export',
  template = '/sechub/rule-version/template',
}

export enum ApiSecRuleSet {
  getList = '/sechub/rule-set/list',
  getAll = '/sechub/rule-set/get_all',
  getById = '/sechub/rule-set/get_by_id',
  readiness = '/sechub/rule-set/readiness',
  preflight = '/sechub/rule-set/preflight',
}

// ── Agent 复核 ───────────────────────────────────
export enum ApiSecAgentReview {
  getList = '/sechub/agent-review/list',
  getById = '/sechub/agent-review/{id}',
  retry = '/sechub/agent-review/{id}/retry',
  cancel = '/sechub/agent-review/{id}/cancel',
}

// ── Finding 验证 ──────────────────────────────────
export enum ApiSecDefectVerification {
  getById = '/sechub/defect-verification/{id}',
  retry = '/sechub/defect-verification/{id}/retry',
  cancel = '/sechub/defect-verification/{id}/cancel',
}

// ── 迭代扫描计划 (Campaign) ────────────────────────
export enum ApiSecCampaign {
  getList = '/sechub/campaign/list',
  getById = '/sechub/campaign/get_by_id',
  add = '/sechub/campaign/add',
  edit = '/sechub/campaign/edit',
  delete = '/sechub/campaign/delete',
  activate = '/sechub/campaign/activate',
  execute = '/sechub/campaign/execute',
  assess = '/sechub/campaign/assess',
  report = '/sechub/campaign/report',
  items = '/sechub/campaign/items',
  itemAdd = '/sechub/campaign/item/add',
  itemDelete = '/sechub/campaign/item/delete',
  assessment = '/sechub/campaign/assessment',
  assessmentHistory = '/sechub/campaign/assessment/history',
}

// ── 问题处置 (Disposition) ──────────────────────────
export enum ApiSecDisposition {
  getList = '/sechub/disposition/list',
  getById = '/sechub/disposition/get_by_id',
  add = '/sechub/disposition/add',
  assign = '/sechub/disposition/assign',
  startFix = '/sechub/disposition/start-fix',
  close = '/sechub/disposition/close',
  reopen = '/sechub/disposition/reopen',
}

// ── 修复提交 (Fix) ──────────────────────────────────
export enum ApiSecFix {
  submit = '/sechub/fix/submit',
  submissions = '/sechub/fix/submissions',
  verify = '/sechub/fix/verify',
}

// ── 非修复审批 (Approval) ────────────────────────────
export enum ApiSecApproval {
  getList = '/sechub/approval/list',
  getById = '/sechub/approval/get_by_id',
  create = '/sechub/approval/create',
  domainDecide = '/sechub/approval/domain-decide',
  directorDecide = '/sechub/approval/director-decide',
  // 缺陷级不处理审批
  issueList = '/sechub/approval/issues/list',
  issueHistory = '/sechub/approval/issues/history',
  issueRequest = '/sechub/approval/issues/request',
  issueDecide = '/sechub/approval/issues/decide',
  issueDecideBatch = '/sechub/approval/issues/decide-batch',
  issueWithdraw = '/sechub/approval/issues/withdraw',
  issueApproverConfig = '/sechub/approval/issues/approver-config',
}

// ── 白名单 (Waiver) ──────────────────────────────────
export enum ApiSecWaiver {
  getList = '/sechub/waiver/list',
  ruleStats = '/sechub/waiver/rule-stats',
  getById = '/sechub/waiver/get_by_id',
  create = '/sechub/waiver/create',
  approve = '/sechub/waiver/approve',
  revoke = '/sechub/waiver/revoke',
}

// ── 治理仪表盘 (Governance) ──────────────────────────
export enum ApiSecGovernance {
  stats = '/sechub/governance/stats',
  me = '/sechub/governance/me',
}

/** 将 API 枚举中的命名参数替换为经过编码的路径片段。 */
export function resolveStaticScanApi(
  path: string,
  params: Readonly<Record<string, string | number>>,
): string {
  return Object.entries(params).reduce(
    (resolved, [key, value]) => resolved.replace(`{${key}}`, encodeURIComponent(String(value))),
    path,
  )
}

// ── 预扫描 ────────────────────────────────────────
export enum ApiSecPrescan {
  trigger = '/sechub/prescan/trigger',
  domainTrigger = '/sechub/prescan/domain-trigger',
  /** 006 统一扫描：一个仓库一次触发（自动选取该仓全部在用表单/微服务资产） */
  unifiedTrigger = '/sechub/prescan/unified-trigger',
  /** 006 统一扫描：新建弹窗的自动资产摘要（blocked_reason 非空时不可提交）；20261008 D 增加基线/目标 commit */
  unifiedPreview = '/sechub/prescan/unified-preview',
  /** 20261008 C：规则目录的 域 → 分类 → 扫描点 → 规则 树（rule_set_id 空 = 默认目录），统一扫描选规则用 */
  ruleSetTree = '/sechub/prescan/rule-set-tree',
  /** 20261008 A：某缺陷的全部检出记录（按检出时间倒序） */
  issueDetections = '/sechub/prescan/issue-detections',
  deltaPreview = '/sechub/static-prescan/delta/preview',
  deltaPlan = '/sechub/static-prescan/delta/{plan_id}',
  deltaExecute = '/sechub/static-prescan/delta/{plan_id}/execute',
  status = '/sechub/prescan/status',
  latestRun = '/sechub/prescan/latest-run',
  dashboard = '/sechub/prescan/dashboard',
  globalOverview = '/sechub/prescan/global-overview',
  summary = '/sechub/prescan/summary',
  candidates = '/sechub/prescan/candidates',
  codeTree = '/sechub/prescan/code-tree',
  aiConfirm = '/sechub/prescan/ai-confirm',
  retryErrors = '/sechub/prescan/retry-errors',
  retryCandidate = '/sechub/prescan/retry-candidate',
  // 人工裁定：新增一条 ai_mode=manual 的结论并置为采信（AI 各模型结论原样保留）
  manualVerdict = '/sechub/prescan/manual-verdict',
  // 批量人工确认：一次把大量待确认候选确认为缺陷（结论同步落库，缺陷后台生成）
  manualConfirmBatch = '/sechub/prescan/manual-confirm-batch',
  // 重扫范围计数（供确认弹窗先告知再执行）
  retryScope = '/sechub/prescan/retry-scope',
  // 给已确认候选补齐缺陷记录（AI 确认流程中断时用）
  compensateIssues = '/sechub/prescan/compensate-issues',
  // 把命中白名单的待处理缺陷标记为不处理
  compensateWhitelist = '/sechub/prescan/compensate-whitelist',
  // 按缺陷反查它最近一次被检出的扫描轮次（缺陷列表跳转用）
  issueRun = '/sechub/prescan/issue-run',
  issueDmpCode = '/sechub/prescan/issue-dmp-code',
  blameCompensate = '/sechub/prescan/blame-compensate',
  agentStatus = '/sechub/prescan/agent-status',
  confirmCompare = '/sechub/prescan/confirm-compare',
  crossRunCompare = '/sechub/prescan/cross-run-compare',
  ruleStats = '/sechub/prescan/rule-stats',
  issueRuleStats = '/sechub/prescan/issue-rule-stats',
  /** 缺陷页左树：按维度（规则/项目组/业务领域/产品领域）返回节点与分桶计数 */
  issueScopeTree = '/sechub/prescan/issue-scope-tree',
  issues = '/sechub/prescan/issues',
  issueEvents = '/sechub/prescan/issue-events',
  issueWontFix = '/sechub/prescan/issue-wont-fix',
  issueVerify = '/sechub/prescan/issue-verify',
  issueClaim = '/sechub/prescan/issue-claim',
  issueFixed = '/sechub/prescan/issue-fixed',
  issueTransfer = '/sechub/prescan/issue-transfer',
  issueTransition = '/sechub/prescan/issue-transition',
  /** 批量设置/清除缺陷的计划处理完成时间（项目组标注） */
  issuePlanFinish = '/sechub/prescan/issue-plan-finish',
  /** 差量基线：当前 active 基线查询 / 人工采纳 */
  baseline = '/sechub/prescan/baseline',
  baselineAdopt = '/sechub/prescan/baseline-adopt',
  issuesExport = '/sechub/prescan/issues/export',
  issuesImport = '/sechub/prescan/issues/import',
  issuesTemplate = '/sechub/prescan/issues/template',
  /** 候选 → 缺陷联查（扫描结果详情用） */
  candidateIssue = '/sechub/prescan/candidate-issue',
  defectGovernance = '/sechub/prescan/defect-governance',
  scanRunsUnified = '/sechub/scan-runs/unified',
  commits = '/sechub/prescan/commits',
  tasks = '/sechub/prescan/tasks',
  task = '/sechub/prescan/task',
  taskAdd = '/sechub/prescan/task-add',
  taskEdit = '/sechub/prescan/task-edit',
  taskDelete = '/sechub/prescan/task-delete',
  /** 批量删除定时扫描任务（软删任务 + 硬删执行记录，不动扫描运行数据） */
  taskBatchDelete = '/sechub/prescan/task-batch-delete',
  taskTrigger = '/sechub/prescan/task-trigger',
  taskRecords = '/sechub/prescan/task-records',
  runDelete = '/sechub/prescan/run-delete',
  /** 批量删除扫描运行（逐条清理候选/报告/产物，上限 200） */
  runBatchDelete = '/sechub/prescan/run-batch-delete',
  /** W-C 覆盖自证报告（run 维度只读；该 run 尚无报告时后端给 404） */
  coverageReport = '/sechub/prescan/{run_id}/coverage-report',
  /** 规则效果（规则版本 × 扫描点 × 仓库 × 模型，只读，服务端分页排序） */
  ruleEffects = '/sechub/prescan/rule-effects',
  /** 007c 规则优化提案：列表（服务端分页）/ 采纳或驳回（仅 pending 可决策）/ 手动生成 */
  ruleProposals = '/sechub/prescan/rule-proposals',
  ruleProposalDecide = '/sechub/prescan/rule-proposals/{id}/decide',
  ruleProposalGenerate = '/sechub/prescan/rule-proposals/generate',
  /** 007a 人工确认复现：pending_repro → open */
  issueConfirmRepro = '/sechub/prescan/issues/confirm-repro',
}

// ── 反编译源码库（外网标品包源码，供性能分析与 local-test 扫描） ──
export enum ApiSecDecompile {
  sourceList = '/sechub/decompile/source/list',
  sourceSave = '/sechub/decompile/source/save',
  sourceDelete = '/sechub/decompile/source/delete',
  sync = '/sechub/decompile/sync',
  runList = '/sechub/decompile/run/list',
  runGet = '/sechub/decompile/run/get',
  runCancel = '/sechub/decompile/run/cancel',
  packageList = '/sechub/decompile/package/list',
  lookup = '/sechub/decompile/lookup',
  registerRepositories = '/sechub/decompile/register-repositories',
  reassociate = '/sechub/decompile/reassociate',
  importExisting = '/sechub/decompile/import-existing',
  rebuildIndex = '/sechub/decompile/rebuild-index',
}

// ── 安全自动化回归（安全扫描） ──────────────────────
// 同一路径上的 GET/POST（或 GET/PUT）共用一个成员：枚举值不能重复
// （ts/no-duplicate-enum-values），方法由调用点决定。
export enum ApiSecScan {
  // 扫描任务（GET 列表 / POST 新建）
  taskList = '/sechub/scan/tasks',
  // 任务（GET 详情 / PUT 更新）
  taskById = '/sechub/scan/tasks/{id}',
  taskDelete = '/sechub/scan/tasks/{id}/delete',
  taskRun = '/sechub/scan/tasks/{id}/run',
  taskSchedule = '/sechub/scan/tasks/{id}/schedule',
  // 运行记录
  runList = '/sechub/scan/runs',
  runGetById = '/sechub/scan/runs/{id}',
  runResults = '/sechub/scan/runs/{id}/results',
  // 执行摘要（按规则/类型聚合，OPT-2）
  runSummary = '/sechub/scan/runs/{id}/summary',
  // 报告导出（CSV 文件下载，需带 Authorization 头）
  runExport = '/sechub/scan/runs/{id}/export',
  runCancel = '/sechub/scan/runs/{id}/cancel',
  // 用例（GET 列表 / POST 新建）
  caseList = '/sechub/scan/cases',
  // 批量导入/更新用例（按 task_id+case_code 幂等）
  caseImport = '/sechub/scan/cases/import',
  caseUpdate = '/sechub/scan/cases/{id}',
  caseDelete = '/sechub/scan/cases/{id}/delete',
  // 用例试跑（单条/批量：POST { case_ids: [...] } → { run_id, run_name, case_count }）
  caseTrial = '/sechub/scan/cases/trial',
  // Python 脚本（multipart 上传，字段名 file，仅 .py；GET 列出 {name,size_bytes,modified_at}）
  scripts = '/sechub/scan/scripts',
  // 脚本内容（GET，返回 {name,size_bytes,content}）
  scriptContent = '/sechub/scan/scripts/{name}',
  // 回归上下文包（任务 + 用例 + 需求上下文 + 运行历史 + 脚本清单）
  regressionContext = '/sechub/scan/regression/context',
  // 测试域视图（表单安全遍历 / OpenAPI测试）
  domainCases = '/sechub/scan/domain/cases',
  // 范围树
  scopeTree = '/sechub/scan/scope-tree',
  // Payload 库（GET 列表 / POST 新增）
  payloadList = '/sechub/scan/payloads',
  payloadSeed = '/sechub/scan/payloads/seed',
  payloadToggle = '/sechub/scan/payloads/{id}/toggle',
  payloadDelete = '/sechub/scan/payloads/{id}/delete',
  // 环境角色账号（脱敏列表 / 新增或更新 / 删除）
  envAccounts = '/sechub/scan/env-accounts',
  envAccountDelete = '/sechub/scan/env-accounts/{id}/delete',
  // 迭代阶段看板（按 iteration_phase 聚合运行记录，见 sec_dashboard.rs）
  iterationDashboard = '/sechub/scan/dashboard/iterations',
  // API 级测试聚合状态（分页列表；按 (env_id, api_path, http_method) 汇总用例结果）
  apiStatus = '/sechub/scan/api-status',
  // 「一键 Agent 测试」第 1 步：按维度拿范围内待测 API（dimension/code/only_untested/limit）
  apiUntested = '/sechub/scan/api-untested',
  // 「一键 Agent 测试」触发：POST { sec_env_id, dimension, code, model?, max_apis? }
  apiAgentRun = '/sechub/scan/api-agent/run',
  // 正式回归：POST { sec_env_id, dimension, code } 复跑 approved+enabled 用例
  apiAgentRegression = '/sechub/scan/api-agent/regression',
  // Agent 任务列表 / 详情 / 重试 / 每日配置
  apiAgentRuns = '/sechub/scan/api-agent/runs',
  apiAgentRunDetail = '/sechub/scan/api-agent/runs/{run_id}',
  apiAgentRetry = '/sechub/scan/api-agent/runs/{run_id}/retry',
  apiAgentFeedback = '/sechub/scan/api-agent/feedback',
  apiAgentFeedbackStatus = '/sechub/scan/api-agent/feedback/{id}/status',
  apiAgentReview = '/sechub/scan/api-agent/runs/{run_id}/review',
  apiAgentRepair = '/sechub/scan/api-agent/runs/{run_id}/repair',
  apiAgentResultReview = '/sechub/scan/api-agent/runs/{run_id}/result-review',
  apiAgentResume = '/sechub/scan/api-agent/runs/{run_id}/resume',
  apiAgentAudit = '/sechub/scan/api-agent/runs/{run_id}/audit',
  apiAgentAuditOverride = '/sechub/scan/api-agent/runs/{run_id}/audit/override',
  apiAgentConfig = '/sechub/scan/api-agent/config',
  // 用例人工评审（POST { review_status, review_comment }）
  caseReview = '/sechub/scan/cases/{id}/review',
  // 环境应用凭据（GET ?env_id= / POST 保存 / POST test 连接自检）
  envCredential = '/sechub/scan/env-credentials',
  envCredentialTest = '/sechub/scan/env-credentials/test',
}

// ── 产品线回归套件（多环境 suite） ─────────────────
// 一个套件持有 test_types/scope/cron，绑定 N 个环境；触发时为每个启用环境
// 复用/创建单环境任务并建 run。接口见 api/src/sechub/regression_suite.rs。
export enum ApiSecRegressionSuite {
  // GET 分页列表（keyword/product_line/status）/ POST 新建
  list = '/sechub/scan/suites',
  // GET 详情 / PUT 编辑
  byId = '/sechub/scan/suites/{id}',
  delete = '/sechub/scan/suites/{id}/delete',
  // GET 绑定环境列表 / POST 批量绑定 { env_ids: [...] }
  envs = '/sechub/scan/suites/{id}/envs',
  unbindEnv = '/sechub/scan/suites/{id}/envs/{env_id}/delete',
  // POST 手动触发全部启用环境
  run = '/sechub/scan/suites/{id}/run',
  // GET 套件运行记录（可按 env_id 过滤）
  runs = '/sechub/scan/suites/{id}/runs',
}

/** 产品线：后端只接受这两个值（service/regression_suite::normalize_product_line） */
export type SecProductLine = '星瀚' | '星空'

export interface SecRegressionSuite {
  id: string
  suite_code: string
  name: string
  product_line: SecProductLine
  /** JSON 字符串数组，如 ["api","script"]；不允许为空 */
  test_types: string
  scope: string | null
  schedule_cron: string | null
  schedule_enabled: string
  status: string
  last_scheduled_at: string | null
  next_run_at: string | null
  created_at: string | null
  updated_at: string | null
  create_by: string | null
}

/** 新建/编辑入参；编辑时 suite_code/product_line/status 省略保持原值 */
export interface SecRegressionSuiteInput {
  suite_code: string
  name: string
  product_line: string
  test_types: string
  scope: string | null
  schedule_cron: string | null
  schedule_enabled: string
  status?: string
}

export interface SecRegressionSuiteEnv {
  id: string
  suite_id: string
  sec_env_id: string
  enabled: string
  created_at: string | null
  env_name: string | null
  env_url: string | null
  product_line: string | null
  task_id: string | null
}

export interface SecRegressionSuiteBindResult {
  added: number
  duplicated: number
  rejected: Array<{ env_id: string, reason: string }>
}

export interface SecRegressionSuiteRun {
  id: string
  task_id: string
  env_id: string | null
  run_name: string
  status: string
  trigger_mode: string
  total_cases: number
  pass_cnt: number
  fail_cnt: number
  started_at: string | null
  finished_at: string | null
  created_at: string | null
  task_name: string | null
}

export interface SecRegressionSuiteTriggerResult {
  suite_id: string
  triggered: number
  skipped: number
  runs: Array<{ env_id: string, task_id: string, task_created: boolean, run_id: string }>
  skipped_envs: Array<{ env_id: string, reason: string }>
}

// ── 表单测试分组（表单概览 / 表单测试结果 / 测试类型维护）──
// 概览：每个表单 × 测试类型的用例数/执行情况 + 元数据扫描三态（不通过/不涉及/总数）；
// 结果：一条条原始结果（sec_sec_result join 用例）；类型：测试类型字典（内置不可删/不可改 code）。
export enum ApiSecFormTest {
  overview = '/sechub/form-test/overview',
  // 单个表单的元数据扫描明细（概览下钻：权限 + 6 敏感操作逐个三态）
  formDetail = '/sechub/form-test/form-detail',
  results = '/sechub/form-test/results',
  typeList = '/sechub/form-test/types',
  typeAll = '/sechub/form-test/types/all',
  typeDelete = '/sechub/form-test/types/delete',
}

// ── 领域资产（表单 / 微服务统一资产，AS-03 真实契约） ──
// 列表 / 详情 / 文件 / 候选 / 问题（三者各自独立服务端分页）/ 同步历史（sync-runs）。
// 动态段（{id}）统一由 resolveStaticScanApi 拼装。
// 插件绑定（详情 form.surfaces[].bindings[]）、菜单（form.menus）、Helper 依赖
// （microservice.helper_files）随详情内嵌返回，没有独立分页接口。
// 人工字段 PATCH 仅支持 owner / tags_json / in_scope / remark 四个字段。
export enum ApiSecDomainAsset {
  getList = '/sechub/domain-assets',
  getById = '/sechub/domain-assets/{id}',
  files = '/sechub/domain-assets/{id}/files',
  candidates = '/sechub/domain-assets/{id}/candidates',
  issues = '/sechub/domain-assets/{id}/issues',
  syncRuns = '/sechub/domain-assets/sync-runs',
  manualFields = '/sechub/domain-assets/{id}/manual-fields',
  rematch = '/sechub/domain-assets/rematch',
  matchAll = '/sechub/domain-assets/match-all',
}

// ── 表单资产同步（env 维度：预览 → 执行 → task_id 轮询） ──
export enum ApiSecFormAssetSync {
  preview = '/sechub/form-assets/sync/preview',
  sync = '/sechub/form-assets/sync',
  status = '/sechub/form-assets/sync/{task_id}',
}
