/**
 * 环境资源绑定页的取数（View → Composable → Service → Api 的 service 层）。
 *
 * 绑定行不走分页：后端 `list` 直接返回 `Vec<InfraEnvMappingModel>`（含候选由
 * include_candidates 控制），一个环境的绑定量级很小，一次取全再前端拆分。
 * 下拉选项各自取全量（page_size 200），与项目其他选项加载一致。
 */
import type { BindingEditPayload, BindingRow, ClusterSelectOption, DiscoverSummary, PerfEnvRow, PromSourceOptions } from './types'
import type { SelectOption } from '@/types/static-scan'
import { ApiInfraService, ApiInfraVm } from '@/api/infraApis'
import { ApiInfraEnvBinding, ApiInfraK8sCluster, ApiInfraMonitorSource, ApiInfraPromSource } from '@/api/infraObserveApis'
import { ApiPerfEnv } from '@/api/perfApis'
import { deleteAction, getAction, postAction, putAction } from '@/hooks'
import { promPurposeLabel } from '../prometheus-source/types'

/** 列表响应里只取 list（后端 ListData<T>），list 缺失时按空处理 */
function rowsOf<T>(page: { list?: T[] } | null): T[] {
  return page?.list ?? []
}

/** 性能环境列表（左栏；只用到 id/名称/编码/状态） */
export async function fetchPerfEnvs(): Promise<PerfEnvRow[] | null> {
  const page = await getAction<{ list?: PerfEnvRow[] }>(ApiPerfEnv.getList, { page_num: 1, page_size: 200 })
  if (!page)
    return null
  return rowsOf(page)
}

/** 环境下的绑定行（含未确认候选与已忽略行，前端按 confirmed_at/ignored_at 拆分） */
export function fetchBindings(envId: string): Promise<BindingRow[] | null> {
  return getAction<BindingRow[]>(ApiInfraEnvBinding.list, { env_id: envId, include_candidates: true })
}

/** K8s 集群下拉（带默认命名空间，供「从集群发现」预填） */
export async function fetchClusterOptions(): Promise<ClusterSelectOption[] | null> {
  const page = await getAction<{ list?: { id: string, name?: string | null, code?: string | null, default_namespace?: string | null }[] }>(
    ApiInfraK8sCluster.getList,
    { page_num: 1, page_size: 200 },
  )
  if (!page)
    return null
  return rowsOf(page).map(row => ({
    label: row.name || row.code || row.id,
    value: row.id,
    defaultNamespace: row.default_namespace ?? '',
  }))
}

/** 虚拟机下拉（中间件绑定用；label 带 IP 便于区分） */
export async function fetchVmOptions(): Promise<SelectOption[] | null> {
  const page = await getAction<{ list?: { id: string, vm_name?: string | null, vm_ip?: string | null }[] }>(
    ApiInfraVm.getList,
    { page_num: 1, page_size: 200 },
  )
  if (!page)
    return null
  return rowsOf(page).map(row => ({
    label: row.vm_ip ? `${row.vm_name || row.id}（${row.vm_ip}）` : (row.vm_name || row.id),
    value: row.id,
  }))
}

/** 服务实例下拉（中间件绑定用；label 带类型） */
export async function fetchServiceOptions(): Promise<SelectOption[] | null> {
  const page = await getAction<{ list?: { id: string, service_name?: string | null, service_type?: string | null }[] }>(
    ApiInfraService.getList,
    { page_num: 1, page_size: 200 },
  )
  if (!page)
    return null
  return rowsOf(page).map(row => ({
    label: row.service_type ? `${row.service_name || row.id}（${row.service_type}）` : (row.service_name || row.id),
    value: row.id,
  }))
}

/**
 * Prometheus 下拉：options 的 label 带用途（同名不同用途要能分辨），
 * names 是纯名称，供表格「资源描述」列用（那里不需要用途后缀）。
 */
export async function fetchPrometheusOptions(): Promise<PromSourceOptions | null> {
  const page = await getAction<{ list?: { id: string, name?: string | null, code?: string | null, purpose?: string | null }[] }>(
    ApiInfraPromSource.getList,
    { page_num: 1, page_size: 200 },
  )
  if (!page)
    return null
  const options: SelectOption[] = []
  const names: Record<string, string> = {}
  for (const row of rowsOf(page)) {
    const name = row.name || row.code || row.id
    names[row.id] = name
    options.push({ label: `${name}（${promPurposeLabel(row.purpose ?? 'container')}）`, value: row.id })
  }
  return { options, names }
}

/** Monitor 数据源下拉 */
export async function fetchMonitorSourceOptions(): Promise<SelectOption[] | null> {
  const page = await getAction<{ list?: { id: string, name?: string | null, code?: string | null }[] }>(
    ApiInfraMonitorSource.getList,
    { page_num: 1, page_size: 200 },
  )
  if (!page)
    return null
  return rowsOf(page).map(row => ({ label: row.name || row.code || row.id, value: row.id }))
}

/** 新增绑定；返回新记录 id（失败 null） */
export function createBinding(payload: Record<string, unknown>): Promise<string | null> {
  return postAction<string>(ApiInfraEnvBinding.bind, payload)
}

/** 行内编辑（allow_ops / monitor_app_name / prom_instance / infra_role / remark；缺省字段不改） */
export function editBinding(payload: BindingEditPayload): Promise<string | null> {
  return putAction<string>(ApiInfraEnvBinding.edit, payload)
}

/** 解绑（后端物理删除） */
export function unbindBindings(ids: string[]): Promise<string | null> {
  return deleteAction<string>(ApiInfraEnvBinding.unbind, { ids })
}

/** 从集群发现：按 集群+命名空间+标签 生成/刷新 workload 候选 */
export function discoverBindings(payload: Record<string, unknown>): Promise<DiscoverSummary | null> {
  return postAction<DiscoverSummary>(ApiInfraEnvBinding.discover, payload)
}

/** 确认候选（写 confirmed_at/confirmed_by，并清 ignored_at） */
export function confirmBindings(ids: string[]): Promise<string | null> {
  return postAction<string>(ApiInfraEnvBinding.confirm, { ids })
}

/** 忽略候选（写 ignored_at，列表默认不再返回） */
export function ignoreBindings(ids: string[]): Promise<string | null> {
  return postAction<string>(ApiInfraEnvBinding.ignore, { ids })
}
