/**
 * 白名单页的取数（View → Composable → Service → Api 的 service 层）。
 *
 * 约定同其他模块：统一走 `@/hooks` 的 `getAction` / `postAction`（失败返回 null，
 * 拦截器已弹提示），页面与组合式函数不直接碰 `@/api` 常量。
 */
import type { WaiverListFilter, WaiverListPage, WaiverListQuery } from './types'
import type { secProjectGroup } from '@/types/sechub'
import type { SelectOption, WaiverRuleStatRow } from '@/types/static-scan'
import { ApiSecProjectGroup, ApiSecWaiver } from '@/api/sechubApis'
import { getAction, postAction } from '@/hooks'

/**
 * 剔除空串筛选值。后端 `Option<T>` 参数收到空串虽能容忍（各过滤点都判了 is_empty），
 * 但「不过滤」表达成「这个键不出现」更明确，也避免 URL 里一串 `&status=&domain=`。
 */
function compactQuery(filter: WaiverListFilter): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(filter)) {
    if (value === '' || value === null || value === undefined)
      continue
    out[key] = value
  }
  return out
}

/** 白名单列表（服务端分页）；失败返回 null */
export function fetchWaivers(query: WaiverListQuery): Promise<WaiverListPage | null> {
  return getAction<WaiverListPage>(ApiSecWaiver.getList, compactQuery(query))
}

/** 左树：白名单按规则版本维度聚合（生效 / 待审批 / 总数）；失败返回 null */
export function fetchWaiverRuleStats(projectGroupId: string): Promise<WaiverRuleStatRow[] | null> {
  return getAction<WaiverRuleStatRow[]>(ApiSecWaiver.ruleStats, projectGroupId ? { project_group_id: projectGroupId } : {})
}

/**
 * 项目组下拉：失败返回 null（保持旧列表不变，页面不必为空态兜底）。
 * `get_all` 返回顶层数组；条目缺 id 的跳过（选了也发不出有效筛选）。
 */
export async function fetchProjectGroupOptions(): Promise<SelectOption[] | null> {
  const list = await getAction<secProjectGroup[]>(ApiSecProjectGroup.getAll, {})
  if (!list)
    return null
  return (Array.isArray(list) ? list : [])
    .filter(group => Boolean(group.id))
    .map(group => ({ label: group.name || group.code || String(group.id), value: String(group.id) }))
}

/**
 * 创建白名单申请；成功返回新记录 id，失败返回 null。
 * body 由 types.ts 的 [`buildWaiverPayload`] 组装（新字段为空时不出现）。
 */
export function createWaiver(payload: Record<string, unknown>): Promise<string | null> {
  return postAction<string>(ApiSecWaiver.create, payload)
}

/** 审批（approved=false 即拒绝）；返回 null 表示失败 */
export function approveWaiver(body: { id: string, approved: boolean, comment: string }): Promise<string | null> {
  return postAction<string>(ApiSecWaiver.approve, body)
}

/** 撤销生效中的白名单；返回 null 表示失败 */
export function revokeWaiver(id: string): Promise<string | null> {
  return postAction<string>(ApiSecWaiver.revoke, { id })
}
