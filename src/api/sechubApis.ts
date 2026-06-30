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
  getList = '/sechub/scan-run/list',
  getById = '/sechub/scan-run/get_by_id',
  trigger = '/sechub/scan-run/trigger',
  webhook = '/sechub/scan-run/webhook',
}

// ── 安全发现 ──────────────────────────────────────
export enum ApiSecFinding {
  getList = '/sechub/finding/list',
  getById = '/sechub/finding/get_by_id',
  manual = '/sechub/finding/manual',
  fromFeedback = '/sechub/finding/from-feedback',
  fromLegacy = '/sechub/finding/from-legacy',
  triage = '/sechub/finding/triage',
  reopen = '/sechub/finding/reopen',
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
  getById = '/sechub/project-group/get_by_id',
  add = '/sechub/project-group/add',
  edit = '/sechub/project-group/edit',
  delete = '/sechub/project-group/delete',
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
