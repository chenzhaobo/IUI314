/**
 * K8s 集群页的取数（View → Composable → Service → Api 的 service 层）。
 *
 * 统一走 `@/hooks` 的 getAction / postAction / putAction / deleteAction
 * （失败返回 null，拦截器已弹提示），页面与组合式函数不直接碰 `@/api` 常量。
 */
import type { K8sClusterListPage, K8sClusterListQuery, SourceTestResult } from './types'
import { ApiInfraK8sCluster } from '@/api/infraObserveApis'
import { deleteAction, getAction, postAction, putAction } from '@/hooks'

/**
 * 剔除空串筛选值。后端各过滤点都判了 is_empty 能容忍空串，
 * 但「不过滤」表达成「这个键不出现」更明确。
 */
function compactQuery(query: K8sClusterListQuery): Record<string, string | number> {
  const out: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(query)) {
    if (value === '' || value === null || value === undefined)
      continue
    out[key] = value
  }
  return out
}

/** 集群列表（服务端分页）；失败返回 null */
export function fetchK8sClusters(query: K8sClusterListQuery): Promise<K8sClusterListPage | null> {
  return getAction<K8sClusterListPage>(ApiInfraK8sCluster.getList, compactQuery(query))
}

/** 新增集群；返回新记录 id（失败 null） */
export function createK8sCluster(payload: Record<string, unknown>): Promise<string | null> {
  return postAction<string>(ApiInfraK8sCluster.add, payload)
}

/** 编辑集群；payload 含 id。凭据字段留空即不出现（后端保留旧值） */
export function updateK8sCluster(payload: Record<string, unknown>): Promise<string | null> {
  return putAction<string>(ApiInfraK8sCluster.edit, payload)
}

/** 删除集群（逻辑删除，后端顺带通知 gateway 移除数据源） */
export function deleteK8sClusters(ids: string[]): Promise<string | null> {
  return deleteAction<string>(ApiInfraK8sCluster.delete, { ids })
}

/** 测试连接：结果对象带 ok/detail/error，同时回写 verified_at / verify_error */
export function testK8sCluster(id: string): Promise<SourceTestResult | null> {
  return postAction<SourceTestResult>(ApiInfraK8sCluster.test, { id })
}
