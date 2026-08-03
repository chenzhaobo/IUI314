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
  branches = '/sechub/module/repository/branches',
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
  agentStatus = '/sechub/prescan/agent-status',
  confirmCompare = '/sechub/prescan/confirm-compare',
  crossRunCompare = '/sechub/prescan/cross-run-compare',
  ruleStats = '/sechub/prescan/rule-stats',
  issueRuleStats = '/sechub/prescan/issue-rule-stats',
  issues = '/sechub/prescan/issues',
  issueEvents = '/sechub/prescan/issue-events',
  issueWontFix = '/sechub/prescan/issue-wont-fix',
  issueVerify = '/sechub/prescan/issue-verify',
  issueClaim = '/sechub/prescan/issue-claim',
  issueFixed = '/sechub/prescan/issue-fixed',
  scanRunsUnified = '/sechub/scan-runs/unified',
}
