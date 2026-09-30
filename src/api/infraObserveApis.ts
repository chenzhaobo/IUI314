/**
 * @description: 基础设施可观测 API（101c：K8s / Prometheus / Monitor 数据源与环境资源绑定）
 *
 * 与 infraApis.ts（物理机/虚拟机/服务/环境映射）分开：这一组是 101c 新接口，
 * 凭据只进不出（出参里只有 has_credential 布尔标记，内容永不回显）。
 */

// ── K8s 集群 ──────────────────────────────────────
export enum ApiInfraK8sCluster {
  getList = '/infra/k8s-cluster/list',
  getById = '/infra/k8s-cluster/get_by_id',
  add = '/infra/k8s-cluster/add',
  edit = '/infra/k8s-cluster/edit',
  delete = '/infra/k8s-cluster/delete',
  test = '/infra/k8s-cluster/test',
}

// ── Prometheus 数据源 ──────────────────────────────
export enum ApiInfraPromSource {
  getList = '/infra/prometheus/list',
  getById = '/infra/prometheus/get_by_id',
  add = '/infra/prometheus/add',
  edit = '/infra/prometheus/edit',
  delete = '/infra/prometheus/delete',
  test = '/infra/prometheus/test',
}

// ── Monitor 数据源 ─────────────────────────────────
export enum ApiInfraMonitorSource {
  getList = '/infra/monitor-source/list',
  getById = '/infra/monitor-source/get_by_id',
  add = '/infra/monitor-source/add',
  edit = '/infra/monitor-source/edit',
  delete = '/infra/monitor-source/delete',
  test = '/infra/monitor-source/test',
}

// ── 环境资源绑定 ───────────────────────────────────
export enum ApiInfraEnvBinding {
  list = '/infra/env-binding/list',
  bind = '/infra/env-binding/bind',
  edit = '/infra/env-binding/edit',
  unbind = '/infra/env-binding/unbind',
  discover = '/infra/env-binding/discover',
  confirm = '/infra/env-binding/confirm',
  ignore = '/infra/env-binding/ignore',
}
