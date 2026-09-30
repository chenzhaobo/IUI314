/**
 * 环境资源绑定页的 DTO、枚举与展示口径（后端 `infra_env_mapping` / `BindingReq` /
 * `BindingEditReq` / `DiscoverReq` 的前端镜像）。
 *
 * 分层同 k8s-cluster / prometheus-source：本文件只放类型、常量与纯函数，
 * 取数在 ./service，页面状态在 ./useEnvBinding。
 */
import type { SelectOption } from '@/types/static-scan'

/** 后端 InfraEnvMappingModel 的前端镜像（原样行；展示口径见本文件的纯函数） */
export interface BindingRow {
  id: string
  env_id?: string | null
  vm_id?: string | null
  service_id?: string | null
  infra_role?: string | null
  remark?: string | null
  create_by: string
  created_at?: string | null
  env_kind: string
  /** workload | middleware | prometheus | monitor；改造前的历史行为 null */
  bind_kind?: string | null
  cluster_id?: string | null
  namespace?: string | null
  workload_kind?: string | null
  workload_name?: string | null
  /** Monitor 节点清单的应用名（如 fi-ebg-sit） */
  monitor_app_name?: string | null
  allow_ops: boolean
  prometheus_id?: string | null
  prom_instance?: string | null
  monitor_source_id?: string | null
  /** manual | k8s */
  discovered_by?: string | null
  confirmed_at?: string | null
  confirmed_by?: string | null
  ignored_at?: string | null
  /** 最近一次 K8s 发现时该工作负载是否仍存在（NULL = 未探测） */
  still_exists?: boolean | null
}

/** 发现结果计数（后端 DiscoverSummary） */
export interface DiscoverSummary {
  created: number
  updated: number
  missing: number
}

/** 性能环境行（/perf/env/list 的前端最小视图；左栏用） */
export interface PerfEnvRow {
  id: string
  env_name: string
  env_code: string
  status: string
}

/** 集群下拉项：带默认命名空间，选中后预填命名空间输入框 */
export interface ClusterSelectOption extends SelectOption {
  defaultNamespace: string
}

/** Prometheus 下拉：value/label 供选择用（label 带用途），names 供表格资源描述用（纯名称） */
export interface PromSourceOptions {
  options: SelectOption[]
  names: Record<string, string>
}

/** 资源名映射：绑定行里存 id，表格展示要翻成名字 */
export interface BindingNameMaps {
  cluster: Record<string, string>
  prometheus: Record<string, string>
  monitor: Record<string, string>
  vm: Record<string, string>
  service: Record<string, string>
}

/** SelectOption[] → { value: label } 映射（表格把 id 翻成名字用） */
export function optionValueMap(options: SelectOption[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const option of options)
    map[option.value] = option.label
  return map
}

/** 绑定类型（后端 bind_kind 四类） */
export type BindKind = 'workload' | 'middleware' | 'prometheus' | 'monitor'

export const BIND_KIND_OPTIONS: { label: string, value: BindKind }[] = [
  { label: 'K8s 工作负载', value: 'workload' },
  { label: '中间件', value: 'middleware' },
  { label: 'Prometheus 数据源', value: 'prometheus' },
  { label: 'Monitor 数据源', value: 'monitor' },
]

const BIND_KIND_LABELS: Record<string, string> = {
  workload: '工作负载',
  middleware: '中间件',
  prometheus: 'Prometheus',
  monitor: 'Monitor',
}

/** 类型标签：历史行（改造前只有 vm/service 的绑定）没有 bind_kind，不猜具体类型 */
export function bindKindLabel(kind?: string | null): string {
  if (!kind)
    return '历史（VM/服务）'
  return BIND_KIND_LABELS[kind] ?? kind
}

/** 来源标签：manual | k8s（后端 discovery 写入），其他值原样显示 */
export function bindSourceLabel(source?: string | null): string {
  if (source === 'k8s')
    return '集群发现'
  if (source === 'manual')
    return '人工'
  return source || '—'
}

/**
 * 生效绑定判定：与后端 `binding::list` 的默认过滤（confirmed_at 非空 **或**
 * vm_id/service_id 非空）逐字一致 —— 人工绑定立即生效，K8s 发现的候选要人工确认。
 */
export function isEffectiveBinding(row: BindingRow): boolean {
  return row.confirmed_at != null || row.vm_id != null || row.service_id != null
}

/** 行红色高亮：K8s 最近一次发现没再返回该工作负载（后端把 still_exists 置 false 保留行） */
export function bindingRowClass(row: BindingRow): string {
  return row.still_exists === false ? 'row-missing' : ''
}

/** 工作负载消失的标记文案（生效表与候选区共用一套说法） */
export const BINDING_MISSING_TEXT = '已在集群中消失'

/** id → 名字；查不到退回 id（宁可见原始值，也不要空着让人猜） */
function mapLabel(map: Record<string, string>, id?: string | null): string {
  if (!id)
    return ''
  return map[id] ?? id
}

/**
 * 资源描述：按 bind_kind 拼出人能读的目标。
 * 历史行没有 bind_kind，退回 vm/service 的名字。
 */
export function bindingResourceText(row: BindingRow, maps: BindingNameMaps): string {
  const kind = row.bind_kind ?? ''
  if (kind === 'workload') {
    const parts = [
      mapLabel(maps.cluster, row.cluster_id),
      row.namespace ?? '',
      row.workload_name ?? '',
    ].filter(part => part !== '')
    return parts.join(' / ') || '—'
  }
  if (kind === 'middleware') {
    const target = mapLabel(maps.service, row.service_id) || mapLabel(maps.vm, row.vm_id)
    const parts = [target, row.prom_instance ? `实例 ${row.prom_instance}` : ''].filter(part => part !== '')
    return parts.join(' · ') || '—'
  }
  if (kind === 'prometheus')
    return mapLabel(maps.prometheus, row.prometheus_id) || '—'
  if (kind === 'monitor')
    return mapLabel(maps.monitor, row.monitor_source_id) || '—'
  return mapLabel(maps.service, row.service_id) || mapLabel(maps.vm, row.vm_id) || '—'
}

/** 新增绑定表单（只声明四类共用的字段；与类型无关的字段不发送，见 buildBindingPayload） */
export interface BindingForm {
  bind_kind: BindKind
  /** workload */
  cluster_id: string
  namespace: string
  workload_name: string
  monitor_app_name: string
  allow_ops: boolean
  /** middleware / prometheus */
  prometheus_id: string
  prom_instance: string
  /** monitor */
  monitor_source_id: string
  /** middleware：服务与虚拟机二选一（至少一个） */
  service_id: string
  vm_id: string
  /** 四类通用 */
  infra_role: string
  remark: string
}

export function emptyBindingForm(): BindingForm {
  return {
    bind_kind: 'workload',
    cluster_id: '',
    namespace: '',
    workload_name: '',
    monitor_app_name: '',
    allow_ops: false,
    prometheus_id: '',
    prom_instance: '',
    monitor_source_id: '',
    service_id: '',
    vm_id: '',
    infra_role: '',
    remark: '',
  }
}

/**
 * 表单 → 绑定请求体：**只发送与 bind_kind 匹配的字段**。
 * 混杂字段会被后端原样写进行里（如 workload 行带上别的类型的 prometheus_id），
 * 留下无法解释的数据。
 */
export function buildBindingPayload(form: BindingForm, envId: string): Record<string, unknown> {
  const payload: Record<string, unknown> = { env_id: envId, bind_kind: form.bind_kind }
  if (form.infra_role.trim())
    payload.infra_role = form.infra_role.trim()
  if (form.remark.trim())
    payload.remark = form.remark.trim()
  if (form.bind_kind === 'workload') {
    payload.cluster_id = form.cluster_id
    payload.namespace = form.namespace.trim()
    payload.workload_name = form.workload_name.trim()
    payload.allow_ops = form.allow_ops
    if (form.monitor_app_name.trim())
      payload.monitor_app_name = form.monitor_app_name.trim()
  }
  else if (form.bind_kind === 'middleware') {
    if (form.service_id)
      payload.service_id = form.service_id
    if (form.vm_id)
      payload.vm_id = form.vm_id
    payload.prom_instance = form.prom_instance.trim()
    payload.prometheus_id = form.prometheus_id
  }
  else if (form.bind_kind === 'prometheus') {
    payload.prometheus_id = form.prometheus_id
  }
  else {
    payload.monitor_source_id = form.monitor_source_id
  }
  return payload
}

/**
 * 提交前预检：返回要提示的原因，null = 通过。
 *
 * 后端对四类绑定也各有一层校验（中文原因走统一提示），这里只对**条件字段**做即时反馈，
 * 不让「提交 → 弹窗不关 → 再改」这一圈成为唯一途径。
 */
export function validateBindingForm(form: BindingForm): string | null {
  if (form.bind_kind === 'workload') {
    if (!form.cluster_id)
      return '工作负载绑定需要选择 K8s 集群'
    if (!form.namespace.trim())
      return '工作负载绑定需要填写命名空间'
    if (!form.workload_name.trim())
      return '工作负载绑定需要填写工作负载名'
    return null
  }
  if (form.bind_kind === 'middleware') {
    if (!form.service_id && !form.vm_id)
      return '中间件绑定需要至少关联一个服务或虚拟机'
    if (!form.prom_instance.trim())
      return '中间件绑定需要填写 Prometheus 实例标签（PMM node_name）'
    if (!form.prometheus_id)
      return '中间件绑定需要选择 Prometheus 数据源'
    return null
  }
  if (form.bind_kind === 'prometheus') {
    if (!form.prometheus_id)
      return 'Prometheus 绑定需要选择数据源'
    return null
  }
  if (!form.monitor_source_id)
    return 'Monitor 绑定需要选择数据源'
  return null
}

/** 从集群发现表单（只生成 workload 候选） */
export interface DiscoverForm {
  cluster_id: string
  namespace: string
  label_selector: string
}

export function emptyDiscoverForm(): DiscoverForm {
  return { cluster_id: '', namespace: '', label_selector: '' }
}

/** 发现请求体：label_selector 留空时不出现（后端按「不带标签」处理，空串语义不同） */
export function buildDiscoverPayload(form: DiscoverForm, envId: string): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    env_id: envId,
    cluster_id: form.cluster_id,
    namespace: form.namespace.trim(),
  }
  if (form.label_selector.trim())
    payload.label_selector = form.label_selector.trim()
  return payload
}

export function validateDiscoverForm(form: DiscoverForm): string | null {
  if (!form.cluster_id)
    return '请选择要发现的 K8s 集群'
  if (!form.namespace.trim())
    return '请填写命名空间'
  return null
}

/** 绑定行内编辑请求体（后端 BindingEditReq：字段缺省 = 不改动） */
export interface BindingEditPayload {
  id: string
  allow_ops?: boolean
  monitor_app_name?: string
  prom_instance?: string
  infra_role?: string
  remark?: string
}
