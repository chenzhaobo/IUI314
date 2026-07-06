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
  reparse = '/perf/script/reparse_txn',
  reparseAll = '/perf/script/reparse_all',
  autoBind = '/perf/script/auto_bind',
  autoBindAll = '/perf/script/auto_bind_all',
  updateParams = '/perf/script/update_params',
  versionHistory = '/perf/script/version_history',
  saveVersion = '/perf/script/save_version',
  batchSetOwner = '/perf/script/batch_set_owner',
  domainList = '/perf/script/domain_list',
}

// ── 测试执行 ──────────────────────────────────
export enum ApiPerfRun {
  getList = '/perf/run/list',
  getById = '/perf/run/get_by_id',
  trigger = '/perf/run/trigger',
  cancel = '/perf/run/cancel',
  log = '/perf/run/log',
  sseLog = '/perf/run/sse_log',
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
}

// ── 模块管理 ──────────────────────────────────
export enum ApiPerfModule {
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
  trend = '/perf/benchmark/trend',
  targetList = '/perf/benchmark/target_list',
  updateTarget = '/perf/benchmark/update_target',
  manualPass = '/perf/benchmark/manual_pass',
  rebuildHistory = '/perf/benchmark/rebuild_history',
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
}

// ── 业务领域选项 ──────────────────────────────────────
export enum ApiPerfDomain {
  domainOptions = '/perf/module/domain_options',
}
