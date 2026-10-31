/**
 * 发版范围的路由预填 / 初始值合并。
 *
 * 抽成独立模块是为了让 `useReleaseScope` 只保留状态与联动逻辑，
 * 不因按钮 / 路由参数增加而膨胀。
 */
import type { ReleaseScopeSelection } from './releaseScopeRules'

function routeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function routeBoolean(value: unknown): boolean {
  if (typeof value === 'boolean')
    return value
  const text = routeString(value).toLowerCase()
  return text === 'true' || text === '1'
}

export function emptyScopeSelection(): ReleaseScopeSelection {
  return {
    productLine: '',
    iterationId: '',
    productDomain: '',
    businessArea: '',
    projectGroup: '',
    appNumber: '',
    handler: '',
    mine: false,
  }
}

/** 从路由 query 读取范围；缺失字段按空值处理 */
export function selectionFromRoute(query: Record<string, unknown>): ReleaseScopeSelection {
  return {
    productLine: routeString(query.product_line),
    iterationId: routeString(query.iteration_id),
    productDomain: routeString(query.product_domain),
    businessArea: routeString(query.business_area),
    projectGroup: routeString(query.project_group),
    appNumber: routeString(query.app_number),
    handler: routeString(query.handler),
    mine: routeBoolean(query.mine),
  }
}

/** 用初始值覆盖基础选择（undefined 不覆盖） */
export function mergeSelection(
  base: ReleaseScopeSelection,
  patch: Partial<ReleaseScopeSelection>,
): ReleaseScopeSelection {
  return {
    productLine: patch.productLine ?? base.productLine,
    iterationId: patch.iterationId ?? base.iterationId,
    productDomain: patch.productDomain ?? base.productDomain,
    businessArea: patch.businessArea ?? base.businessArea,
    projectGroup: patch.projectGroup ?? base.projectGroup,
    appNumber: patch.appNumber ?? base.appNumber,
    handler: patch.handler ?? base.handler,
    mine: patch.mine ?? base.mine,
  }
}
