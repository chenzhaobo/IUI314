/**
 * @description: 基础设施管理 API
 */

// ── 物理机 ──────────────────────────────────────
export enum ApiInfraHost {
  getList = '/infra/host/list',
  getById = '/infra/host/get_by_id',
  add = '/infra/host/add',
  edit = '/infra/host/edit',
  delete = '/infra/host/delete',
  summary = '/infra/host/summary',
}

// ── 虚拟机 ──────────────────────────────────────
export enum ApiInfraVm {
  getList = '/infra/vm/list',
  getById = '/infra/vm/get_by_id',
  add = '/infra/vm/add',
  edit = '/infra/vm/edit',
  delete = '/infra/vm/delete',
}

// ── 服务实例 ──────────────────────────────────────
export enum ApiInfraService {
  getList = '/infra/service/list',
  getById = '/infra/service/get_by_id',
  add = '/infra/service/add',
  edit = '/infra/service/edit',
  delete = '/infra/service/delete',
}

// ── 环境映射 ──────────────────────────────────────
export enum ApiInfraEnvMapping {
  byEnv = '/infra/env-mapping/by_env',
  byVm = '/infra/env-mapping/by_vm',
  bind = '/infra/env-mapping/bind',
  unbind = '/infra/env-mapping/unbind',
}
