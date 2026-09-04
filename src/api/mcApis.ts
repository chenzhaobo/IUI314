/**
 * @description: MC 管理中心 API（制品分发与环境升级）
 *
 * 上传接口不在这里走 useRequest —— multipart 需要裸 fetch + FormData，
 * 见 views/mc/artifact.vue 的 handleUpload。
 */

// ── 制品仓库 ──────────────────────────────────
export enum ApiMcArtifact {
  getList = '/mc/artifact/list',
  upload = '/mc/artifact/upload',
  delete = '/mc/artifact/delete',
}

// ── 部署目标环境 ──────────────────────────────
export enum ApiMcEnvironment {
  getList = '/mc/environment/list',
  add = '/mc/environment/add',
  edit = '/mc/environment/edit',
  setDesired = '/mc/environment/set_desired',
  probe = '/mc/environment/probe',
}

// ── 审计 ──────────────────────────────────────
export enum ApiMcAudit {
  getList = '/mc/audit/list',
}

// ── 迁移执行记录（只读；触发迁移不在 Web 上提供）──
export enum ApiMcMigration {
  runs = '/mc/migration/runs',
  statements = '/mc/migration/statements',
  applied = '/mc/migration/applied',
}
