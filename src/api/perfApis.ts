/**
 * @description: 性能测试平台 API
 */

// ── 环境管理 ──────────────────────────────────────
export enum ApiPerfEnv {
  getList = '/perf/env/list',
  getById = '/perf/env/get_by_id',
  add = '/perf/env/add',
  edit = '/perf/env/edit',
  delete = '/perf/env/delete',
  healthCheck = '/perf/env/health_check',
}

// ── 迭代管理 ──────────────────────────────────────
export enum ApiPerfIteration {
  getList = '/perf/iteration/list',
  getById = '/perf/iteration/get_by_id',
  add = '/perf/iteration/add',
  edit = '/perf/iteration/edit',
  delete = '/perf/iteration/delete',
  setCurrent = '/perf/iteration/set_current',
  current = '/perf/iteration/current',
}

// ── 云目录 ──────────────────────────────────────
export enum ApiPerfCloud {
  getList = '/perf/cloud/list',
}

// ── 应用目录 ──────────────────────────────────────
export enum ApiPerfApp {
  getList = '/perf/app/list',
  bindDomain = '/perf/app/bind_domain',
}

// ── 菜单目录 ──────────────────────────────────────
export enum ApiPerfMenu {
  getList = '/perf/menu/list',
  tree = '/perf/menu/tree',
  stats = '/perf/menu/stats',
  scope = '/perf/menu/scope',
  sync = '/perf/menu/sync',
  syncPreview = '/perf/menu/sync/preview',
  buttons = '/perf/menu/buttons',
  markButtons = '/perf/menu/buttons/mark',
  tableInfo = '/perf/menu/table-info',
  autoMatchPg = '/perf/menu/auto_match_pg',
  createModules = '/perf/menu/create_modules',
}

// ── 脚本-菜单绑定 ──────────────────────────────────────
export enum ApiPerfScriptMenu {
  getList = '/perf/script-menu/list',
  bind = '/perf/script-menu/bind',
  unbind = '/perf/script-menu/unbind',
  menuIds = '/perf/script-menu/menu_ids',
  scriptIds = '/perf/script-menu/script_ids',
  txnButtons = '/perf/script-menu/txn_buttons',
}

// ── 性能脚本管理 ──────────────────────────────────
export enum ApiPerfScript {
  getList = '/perf/script/list',
  getById = '/perf/script/get_by_id',
  add = '/perf/script/add',
  edit = '/perf/script/edit',
  delete = '/perf/script/delete',
  upload = '/perf/script/upload',
  batchUpload = '/perf/script/batch_upload',
  reparse = '/perf/script/reparse',
  autoBind = '/perf/script/auto_bind',
  updateParams = '/perf/script/update_params',
  updateTxnDetail = '/perf/script/update_txn_detail',
  txnButtons = '/perf/script/txn_buttons',
  versionHistory = '/perf/script/version_history',
  saveVersion = '/perf/script/save_version',
  batchSetOwner = '/perf/script/batch_set_owner',
  domainList = '/perf/script/domain_list',
  downloadJmx = '/perf/script/download_jmx',
  checkCode = '/perf/script/check_code',
}

// ── 测试执行 ──────────────────────────────────
export enum ApiPerfRun {
  getList = '/perf/run/list',
  getById = '/perf/run/get_by_id',
  trigger = '/perf/run/trigger',
  cancel = '/perf/run/cancel',
  log = '/perf/run/log',
  sseLog = '/perf/run/sse_log',
  retry = '/perf/run/retry',
  downloadJmx = '/perf/run/download_jmx',
}

// ── 聚合报告 ──────────────────────────────────
export enum ApiPerfReport {
  list = '/perf/report/list',
  detail = '/perf/report/detail',
  summary = '/perf/report/summary',
  preview = '/perf/report/preview',
  export = '/perf/report/export',
  trend = '/perf/report/trend',
}

// ── 性能基线 ──────────────────────────────────
export enum ApiPerfBaseline {
  getList = '/perf/baseline/list',
  getById = '/perf/baseline/get_by_id',
  add = '/perf/baseline/add',
  edit = '/perf/baseline/edit',
  delete = '/perf/baseline/delete',
  compare = '/perf/baseline/compare',
  significanceTest = '/perf/baseline/significance_test',
  recommend = '/perf/baseline/recommend',
}

// ── 执行任务 ──────────────────────────────────
export enum ApiPerfTask {
  getList = '/perf/task/list',
  getById = '/perf/task/get_by_id',
  trigger = '/perf/task/trigger',
  retryFailed = '/perf/task/retry_failed',
  cancel = '/perf/task/cancel',
  delete = '/perf/task/delete',
  updatePriority = '/perf/task/update_priority',
  queueList = '/perf/task/queue_list',
  estimateTime = '/perf/task/estimate_time',
  progress = '/perf/task/progress',
}

// ── 模块管理 ──────────────────────────────────
export enum ApiPerfModule {
  // 字段语义: product_group=产品领域(domain_name), parent_cloud=所属云名称(cloud_name)
  getList = '/perf/module/list',
  getById = '/perf/module/get_by_id',
  add = '/perf/module/add',
  edit = '/perf/module/edit',
  delete = '/perf/module/delete',
  import = '/perf/module/import',
  syncCloud = '/perf/module/sync_cloud',
  cloudOptions = '/perf/module/cloud_options',
}

// ── 参数模板 ──────────────────────────────────
export enum ApiPerfParamTemplate {
  getList = '/perf/param-template/list',
  getById = '/perf/param-template/get_by_id',
  add = '/perf/param-template/add',
  edit = '/perf/param-template/edit',
  delete = '/perf/param-template/delete',
}

// ── 表统计 ──────────────────────────────────
export enum ApiPerfTableStats {
  sync = '/perf/table-stats/sync',
  syncPreview = '/perf/table-stats/sync/preview',
  cancel = '/perf/table-stats/cancel',
  status = '/perf/table-stats/status',
  list = '/perf/table-stats/list',
  entityList = '/perf/table-stats/entity/list',
  dbSizes = '/perf/table-stats/db-sizes',
}

// ── 迭代汇总 ──────────────────────────────────
export enum ApiPerfSummary {
  getList = '/perf/summary/list',
  getById = '/perf/summary/get_by_id',
  generate = '/perf/summary/generate',
}

// ── 跨迭代比对 ──────────────────────────────────
export enum ApiPerfComparison {
  getList = '/perf/comparison/list',
  getById = '/perf/comparison/get_by_id',
  compare = '/perf/comparison/compare',
  details = '/perf/comparison/details',
  updateAnalysis = '/perf/comparison/update_analysis',
  delete = '/perf/comparison/delete',
}

// ── 基准测试比对 ──────────────────────────────────
export enum ApiPerfBenchmark {
  report = '/perf/benchmark/report',
  reportStats = '/perf/benchmark/report_stats',
  trend = '/perf/benchmark/trend',
  targetList = '/perf/benchmark/target_list',
  txnStats = '/perf/benchmark/txn_stats',
  updateTarget = '/perf/benchmark/update_target',
  updateTxnInfo = '/perf/benchmark/update_txn_info',
  manualPass = '/perf/benchmark/manual_pass',
  rebuildHistory = '/perf/benchmark/rebuild_history',
  txnScripts = '/perf/benchmark/txn_scripts',
  scriptTxnDiff = '/perf/benchmark/script_txn_diff',
  importTxn = '/perf/benchmark/import_txn',
  importHistory = '/perf/benchmark/import_history',
}

// ── 平台配置 ──────────────────────────────────────
export enum ApiPerfConfig {
  list = '/perf/config/list',
  save = '/perf/config/save',
}

// ── 测试计划 ──────────────────────────────────────
export enum ApiPerfTestPlan {
  getList = '/perf/test-plan/list',
  getById = '/perf/test-plan/get_by_id',
  add = '/perf/test-plan/add',
  edit = '/perf/test-plan/edit',
  delete = '/perf/test-plan/delete',
  preview = '/perf/test-plan/preview',
  trigger = '/perf/test-plan/trigger',
  estimateTime = '/perf/test-plan/estimate_time',
}

// ── 业务领域选项 ──────────────────────────────────────
export enum ApiPerfDomain {
  domainOptions = '/perf/module/domain_options',
}

// ── 压测机管理 ──────────────────────────────────────
export enum ApiPerfLoadNode {
  getList = '/perf/loadnode/list',
  getById = '/perf/loadnode/get_by_id',
  add = '/perf/loadnode/add',
  edit = '/perf/loadnode/edit',
  delete = '/perf/loadnode/delete',
  testConnection = '/perf/loadnode/test',
  onlineList = '/perf/loadnode/online',
}

// ── 脚本附件管理 ──────────────────────────────────────
export enum ApiPerfAttachment {
  upload = '/perf/script/attachment_upload',
  list = '/perf/script/attachment_list',
  delete = '/perf/script/attachment_delete',
  download = '/perf/script/attachment_download',
}

// ── 客户管理 ──────────────────────────────────────
export enum ApiPerfCustomer {
  getList = '/perf/customer/list',
  getById = '/perf/customer/get_by_id',
  add = '/perf/customer/add',
  edit = '/perf/customer/edit',
  delete = '/perf/customer/delete',
}

// ── 达标率管理 ──────────────────────────────────────
export enum ApiPerfCompliance {
  overview = '/perf/compliance/overview',
  drill = '/perf/compliance/drill',
  trend = '/perf/compliance/trend',
  batches = '/perf/compliance/batches',
  batchesInfo = '/perf/compliance/batches-info',
  tree = '/perf/compliance/tree',
  dimensionOptions = '/perf/compliance/dimension-options',
  periodOptions = '/perf/compliance/period-options',
  sync = '/perf/compliance/sync',
  syncStatus = '/perf/compliance/sync/status',
  // M6 增强
  traces = '/perf/compliance/traces',
  export = '/perf/compliance/export',
  trendExport = '/perf/compliance/trend/export',
  // 二开表单白名单
  syncStandardForms = '/perf/compliance/sync-standard-forms',
  standardForms = '/perf/compliance/standard-forms',
}

// ── 同步任务管理 ──────────────────────────────────────
export enum ApiPerfSyncTask {
  list = '/perf/sync-task/list',
  getById = '/perf/sync-task/get_by_id',
  add = '/perf/sync-task/add',
  edit = '/perf/sync-task/edit',
  delete = '/perf/sync-task/delete',
  trigger = '/perf/sync-task/trigger',
  retry = '/perf/sync-task/retry',
  records = '/perf/sync-task/records',
}

// ── 数据源元数据留存 ──────────────────────────────────────
export enum ApiPerfDatasource {
  list = '/perf/datasource/list',
  getById = '/perf/datasource/get_by_id',
}

// ── 周期报告任务配置（T2.1） ──────────────────────────────────────
export enum ApiPerfReportTask {
  list = '/perf/periodic-report/task/list',
  save = '/perf/periodic-report/task/save',
  delete = '/perf/periodic-report/task/delete',
  trigger = '/perf/periodic-report/task/trigger',
  cancel = '/perf/periodic-report/task/cancel',
  runs = '/perf/periodic-report/task/runs',
}

// ── 性能诊断分析 ──────────────────────────────────────
export enum ApiPerfDiagnosis {
  domain = '/perf/diagnosis/domain',
  app = '/perf/diagnosis/app',
  report = '/perf/diagnosis/report',
  guide = '/perf/diagnosis/guide',
}

// ── 性能问题追踪 ──────────────────────────────────────
export enum ApiPerfIssue {
  getList = '/perf/issue/list',
  getById = '/perf/issue/get_by_id',
  add = '/perf/issue/add',
  edit = '/perf/issue/edit',
  changeStatus = '/perf/issue/change_status',
  delete = '/perf/issue/delete',
  stats = '/perf/issue/stats',
  export = '/perf/issue/export',
  batchImport = '/perf/issue/batch_import',
  // 问题智能同步
  syncFromDiagnosis = '/perf/issue/sync-from-diagnosis',
  related = '/perf/issue/related',
  backfillFingerprint = '/perf/issue/backfill-fingerprint',
}

// ── 分析报告 ──────────────────────────────────────
export enum ApiPerfReportV2 {
  getList = '/perf/report-v2/list',
  getById = '/perf/report-v2/get_by_id',
  add = '/perf/report-v2/add',
  edit = '/perf/report-v2/edit',
  publish = '/perf/report-v2/publish',
  delete = '/perf/report-v2/delete',
  dailyExport = '/perf/periodic-report/daily/export',
  artifacts = '/perf/report-v2/artifacts',
  artifact = '/perf/report-v2/artifact',
  artifactDownload = '/perf/report-v2/artifact/download',
}

// ── 分析任务定义 ────────────────────────────────────
export enum ApiPerfAnalysisJob {
  getList = '/perf/analysis-job/list',
  getById = '/perf/analysis-job/get_by_id',
  save = '/perf/analysis-job/save',
  delete = '/perf/analysis-job/delete',
  run = '/perf/analysis-job/run',
}

// ── 分析任务运行 ──────────────────────────────────────
export enum ApiPerfAnalysisTask {
  getList = '/perf/analysis-task/list',
  getById = '/perf/analysis-task/get_by_id',
  trigger = '/perf/analysis-task/trigger',
  cancel = '/perf/analysis-task/cancel',
}

// ── Ops分析 ──────────────────────────────────────
export enum ApiPerfOps {
  analyze = '/perf/ops/analyze',
  download = '/perf/ops/download',
  result = '/perf/ops/result',
  list = '/perf/ops/list',
  collectTraces = '/perf/ops/collect-traces',
  collectedTraces = '/perf/ops/collected-traces',
  triggerAnalysis = '/perf/ops/trigger-analysis',
}

// ── 性能覆盖率 ──────────────────────────────────────
export enum ApiPerfCoverage {
  overview = '/perf/coverage/overview',
  detail = '/perf/coverage/detail',
  export = '/perf/coverage/export',
  sync = '/perf/coverage/sync',
  tree = '/perf/coverage/tree',
}

// ── 测试场景 ──────────────────────────────────────
export enum ApiPerfScenario {
  getList = '/perf/scenario/list',
  getById = '/perf/scenario/get_by_id',
  add = '/perf/scenario/add',
  edit = '/perf/scenario/edit',
  confirm = '/perf/scenario/confirm',
  delete = '/perf/scenario/delete',
  recommend = '/perf/scenario/recommend',
}

// ── 问题模式台账（§11.2） ──────────────────────────────────────
export enum ApiPerfPatternLedger {
  list = '/perf/periodic-report/pattern/list',
  export = '/perf/periodic-report/pattern/export',
  logs = '/perf/periodic-report/pattern/logs',
  save = '/perf/periodic-report/pattern/save',
  createIssue = '/perf/periodic-report/pattern/create-issue',
}

// ── Agent 自主诊断 ──────────────────────────────────────
export enum ApiPerfDiagnosisAgent {
  tasks = '/perf/diagnosis-agent/task',
  remaining = '/perf/diagnosis-agent/remaining',
  markBatch = '/perf/diagnosis-agent/mark-batch',
  issueFile = '/perf/diagnosis-agent/issue-file',
  reportSave = '/perf/diagnosis-agent/report-save',
  progress = '/perf/diagnosis-agent/progress',
  complete = '/perf/diagnosis-agent/complete',
}
