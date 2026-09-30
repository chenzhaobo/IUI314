/**
 * 摸底压测页的取数（View → Composable → Service → Api 的 service 层）。
 *
 * 下拉选项各自取全量（page_size 200），与项目其他选项加载一致；
 * 绑定下拉只取 `allow_ops=true` 的工作负载行（spec R5.2：未授权部署不得改）。
 */
import type { ConformanceReport, CreateProbePayload, HwChange, OverridePayload, ProbePlanView } from './types'
import type { SelectOption } from '@/types/static-scan'
import { ApiInfraEnvBinding } from '@/api/infraObserveApis'
import { ApiPerfEnv, ApiPerfLoadNode, ApiPerfScript } from '@/api/perfApis'
import { ApiPerfObserveProbe } from '@/api/perfObserveApis'
import { getAction, postAction } from '@/hooks'

/** 计划列表（按环境 / 状态过滤，后端最多返回 200 行） */
export function fetchProbePlans(params: { env_id?: string, status?: string }): Promise<ProbePlanView[] | null> {
  return getAction<ProbePlanView[]>(ApiPerfObserveProbe.list, params)
}

/** 计划详情（含 result 与各 stage 摘要） */
export function fetchProbePlan(id: string): Promise<ProbePlanView | null> {
  return getAction<ProbePlanView>(ApiPerfObserveProbe.get, { id })
}

/** 创建计划（后端会在创建前再跑一次脚本规范校验，不通过直接拒绝） */
export function createProbePlan(payload: CreateProbePayload): Promise<string | null> {
  return postAction<string>(ApiPerfObserveProbe.create, payload)
}

/** 取消计划（幂等；已改硬件则转 restore_hw） */
export function cancelProbePlan(planId: string): Promise<string | null> {
  return postAction<string>(ApiPerfObserveProbe.cancel, { plan_id: planId })
}

/** 改写下一档并发（只生效一次；稳定性档不接受） */
export function overrideNextThreads(payload: OverridePayload): Promise<string | null> {
  return postAction<string>(ApiPerfObserveProbe.override, payload)
}

/** 摸底脚本规范校验（选脚本时即时调用） */
export function fetchConformance(scriptId: string): Promise<ConformanceReport | null> {
  return getAction<ConformanceReport>(ApiPerfObserveProbe.conformance, { script_id: scriptId })
}

// ── 下拉选项 ────────────────────────────────────────

/** 性能环境下拉 */
export async function fetchEnvOptions(): Promise<SelectOption[] | null> {
  const page = await getAction<{ list?: { id: string, env_name?: string | null, env_code?: string | null }[] }>(
    ApiPerfEnv.getList,
    { page_num: 1, page_size: 200 },
  )
  if (!page)
    return null
  return (page.list ?? []).map(row => ({ label: row.env_name || row.env_code || row.id, value: row.id }))
}

/** 脚本下拉 */
export async function fetchScriptOptions(): Promise<SelectOption[] | null> {
  const page = await getAction<{ list?: { id: string, name?: string | null }[] }>(
    ApiPerfScript.getList,
    { page_num: 1, page_size: 200 },
  )
  if (!page)
    return null
  return (page.list ?? []).map(row => ({ label: row.name || row.id, value: row.id }))
}

/** 执行机下拉（在线列表，含当前负载） */
export async function fetchLoadNodeOptions(): Promise<SelectOption[] | null> {
  const rows = await getAction<{ id: string, node_name?: string | null, host_ip?: string | null, current_load?: number | null, max_concurrency?: number | null }[]>(
    ApiPerfLoadNode.onlineList,
    {},
  )
  if (!rows)
    return null
  return [
    { label: '本地执行（默认，不经过 Agent）', value: '' },
    ...rows.map(row => ({
      label: `${row.node_name || row.id} (${row.host_ip ?? '-'}) [${row.current_load ?? 0}/${row.max_concurrency ?? 1}]`,
      value: row.id,
    })),
  ]
}

/** 环境绑定行里可选的工作负载：必须 `allow_ops=true` 才能作为档位变更对象（spec R5.2） */
export async function fetchWorkloadBindings(envId: string): Promise<SelectOption[] | null> {
  const rows = await getAction<Array<{
    id: string
    bind_kind?: string | null
    allow_ops?: boolean
    namespace?: string | null
    workload_name?: string | null
  }>>(ApiInfraEnvBinding.list, { env_id: envId })

  if (!rows)
    return null
  return rows
    .filter(row => row.bind_kind === 'workload' && row.allow_ops)
    .map(row => ({
      value: row.id,
      label: `${row.namespace ?? '-'} / ${row.workload_name ?? row.id}`,
    }))
}

/** 供档位编辑器校验：该变更是否至少给出 replicas 或 container */
export function isChangeComplete(change: HwChange): boolean {
  const hasReplicas = change.replicas !== null && change.replicas !== undefined
  const hasContainer = Boolean(change.container && change.container.trim())
  return Boolean(change.binding_id.trim()) && (hasReplicas || hasContainer)
}
