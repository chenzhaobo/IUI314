/**
 * @description: 监控审计（monaudit）API：同步源 / 领域映射 / 轮次 / 问题 / 看板
 *
 * 路径不带 /api 前缀（由 VITE_API_BASE_URL 统一拼接），后端见 axum_admin/api/src/monaudit/mod.rs。
 */

// ── 同步源 ─────────────────────────────────────────
export enum ApiMonauditSource {
  getList = '/monaudit/source/list',
  getById = '/monaudit/source/get_by_id',
  add = '/monaudit/source/add',
  edit = '/monaudit/source/edit',
  delete = '/monaudit/source/delete',
  testOpenapi = '/monaudit/source/test_openapi',
  monitorCaptcha = '/monaudit/source/monitor_captcha',
  monitorLogin = '/monaudit/source/monitor_login',
}

// ── 领域映射 ───────────────────────────────────────
export enum ApiMonauditMapping {
  getList = '/monaudit/mapping/list',
  add = '/monaudit/mapping/add',
  edit = '/monaudit/mapping/edit',
  delete = '/monaudit/mapping/delete',
  unmapped = '/monaudit/mapping/unmapped',
  reapply = '/monaudit/mapping/reapply',
}

// ── 轮次 ───────────────────────────────────────────
export enum ApiMonauditRound {
  getList = '/monaudit/round/list',
  getById = '/monaudit/round/get_by_id',
  status = '/monaudit/round/status',
  create = '/monaudit/round/create',
  sync = '/monaudit/round/sync',
  trigger = '/monaudit/round/trigger',
  settle = '/monaudit/round/settle',
  retry = '/monaudit/round/retry',
  fetchLogs = '/monaudit/round/fetch_logs',
}

// ── 问题 ───────────────────────────────────────────
export enum ApiMonauditIssue {
  getList = '/monaudit/issue/list',
  tree = '/monaudit/issue/tree',
  getById = '/monaudit/issue/get_by_id',
  options = '/monaudit/issue/options',
  handlerCandidates = '/monaudit/issue/handler_candidates',
  traceLog = '/monaudit/issue/trace_log',
  edit = '/monaudit/issue/edit',
  batchEdit = '/monaudit/issue/batch_edit',
  assign = '/monaudit/issue/assign',
  classify = '/monaudit/issue/classify',
  transition = '/monaudit/issue/transition',
  refetchLog = '/monaudit/issue/refetch_log',
}

// ── 看板 ───────────────────────────────────────────
export enum ApiMonauditDashboard {
  summary = '/monaudit/dashboard/summary',
}
