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
  buttons = '/perf/menu/buttons',
  markButtons = '/perf/menu/buttons/mark',
  tableInfo = '/perf/menu/table-info',
  autoMatchPg = '/perf/menu/auto_match_pg',
}

// ── 脚本-菜单绑定 ──────────────────────────────────────
export enum ApiPerfScriptMenu {
  getList = '/perf/script-menu/list',
  bind = '/perf/script-menu/bind',
  unbind = '/perf/script-menu/unbind',
  menuIds = '/perf/script-menu/menu_ids',
  scriptIds = '/perf/script-menu/script_ids',
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
}

// ── 测试执行 ──────────────────────────────────
export enum ApiPerfRun {
  getList = '/perf/run/list',
  getById = '/perf/run/get_by_id',
  trigger = '/perf/run/trigger',
  cancel = '/perf/run/cancel',
  log = '/perf/run/log',
}

// ── 聚合报告 ──────────────────────────────────
export enum ApiPerfReport {
  list = '/perf/report/list',
  detail = '/perf/report/detail',
  summary = '/perf/report/summary',
}

// ── 性能基线 ──────────────────────────────────
export enum ApiPerfBaseline {
  getList = '/perf/baseline/list',
  getById = '/perf/baseline/get_by_id',
  add = '/perf/baseline/add',
  edit = '/perf/baseline/edit',
  delete = '/perf/baseline/delete',
  compare = '/perf/baseline/compare',
}

// ── 执行任务 ──────────────────────────────────
export enum ApiPerfTask {
  getList = '/perf/task/list',
  getById = '/perf/task/get_by_id',
  trigger = '/perf/task/trigger',
  retryFailed = '/perf/task/retry_failed',
  cancel = '/perf/task/cancel',
  delete = '/perf/task/delete',
}

// ── 模块管理 ──────────────────────────────────
export enum ApiPerfModule {
  getList = '/perf/module/list',
  getById = '/perf/module/get_by_id',
  add = '/perf/module/add',
  edit = '/perf/module/edit',
  delete = '/perf/module/delete',
  import = '/perf/module/import',
}

// ── 表统计 ──────────────────────────────────
export enum ApiPerfTableStats {
  sync = '/perf/table-stats/sync',
  cancel = '/perf/table-stats/cancel',
  status = '/perf/table-stats/status',
  list = '/perf/table-stats/list',
}
