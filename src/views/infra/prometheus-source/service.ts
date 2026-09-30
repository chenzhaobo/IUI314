/**
 * Prometheus 数据源页的取数（View → Composable → Service → Api 的 service 层）。
 *
 * 统一走 `@/hooks` 的 getAction / postAction / putAction / deleteAction
 * （失败返回 null，拦截器已弹提示），页面与组合式函数不直接碰 `@/api` 常量。
 */
import type { ClusterOptionRow, PrometheusListPage, PrometheusListQuery, SourceTestResult } from './types'
import { ApiInfraK8sCluster, ApiInfraPromSource } from '@/api/infraObserveApis'
import { deleteAction, getAction, postAction, putAction } from '@/hooks'

/** 剔除空串筛选值：「不过滤」表达成「这个键不出现」 */
function compactQuery(query: PrometheusListQuery): Record<string, string | number> {
  const out: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(query)) {
    if (value === '' || value === null || value === undefined)
      continue
    out[key] = value
  }
  return out
}

/** 数据源列表（服务端分页）；失败返回 null */
export function fetchPrometheuses(query: PrometheusListQuery): Promise<PrometheusListPage | null> {
  return getAction<PrometheusListPage>(ApiInfraPromSource.getList, compactQuery(query))
}

/** 集群下拉（关联集群用，取前 999 条）；失败返回 null */
export async function fetchClusterOptions(): Promise<ClusterOptionRow[] | null> {
  const page = await getAction<{ list: ClusterOptionRow[] }>(ApiInfraK8sCluster.getList, { page_size: 999 })
  if (!page)
    return null
  return Array.isArray(page.list) ? page.list : []
}

/** 新增数据源；返回新记录 id（失败 null） */
export function createPrometheus(payload: Record<string, unknown>): Promise<string | null> {
  return postAction<string>(ApiInfraPromSource.add, payload)
}

/** 编辑数据源；payload 含 id。凭据留空即不出现（后端保留旧值） */
export function updatePrometheus(payload: Record<string, unknown>): Promise<string | null> {
  return putAction<string>(ApiInfraPromSource.edit, payload)
}

/** 删除数据源（逻辑删除，后端顺带通知 gateway 移除） */
export function deletePrometheuses(ids: string[]): Promise<string | null> {
  return deleteAction<string>(ApiInfraPromSource.delete, { ids })
}

/** 测试连接：结果对象带 ok/detail/error，同时回写 verified_at / verify_error / build_info */
export function testPrometheus(id: string): Promise<SourceTestResult | null> {
  return postAction<SourceTestResult>(ApiInfraPromSource.test, { id })
}
