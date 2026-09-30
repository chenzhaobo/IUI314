/**
 * Monitor（eye）数据源页的取数（View → Composable → Service → Api 的 service 层）。
 *
 * 统一走 `@/hooks` 的 getAction / postAction / putAction / deleteAction
 * （失败返回 null，拦截器已弹提示），页面与组合式函数不直接碰 `@/api` 常量。
 */
import type { MonitorSourceListPage, MonitorSourceListQuery, SourceTestResult } from './types'
import { ApiInfraMonitorSource } from '@/api/infraObserveApis'
import { deleteAction, getAction, postAction, putAction } from '@/hooks'

/** 剔除空串筛选值：「不过滤」表达成「这个键不出现」 */
function compactQuery(query: MonitorSourceListQuery): Record<string, string | number> {
  const out: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(query)) {
    if (value === '' || value === null || value === undefined)
      continue
    out[key] = value
  }
  return out
}

/** 数据源列表（服务端分页）；失败返回 null */
export function fetchMonitorSources(query: MonitorSourceListQuery): Promise<MonitorSourceListPage | null> {
  return getAction<MonitorSourceListPage>(ApiInfraMonitorSource.getList, compactQuery(query))
}

/** 新增数据源；返回新记录 id（失败 null） */
export function createMonitorSource(payload: Record<string, unknown>): Promise<string | null> {
  return postAction<string>(ApiInfraMonitorSource.add, payload)
}

/** 编辑数据源；payload 含 id。登录密码留空即不出现（后端保留旧值） */
export function updateMonitorSource(payload: Record<string, unknown>): Promise<string | null> {
  return putAction<string>(ApiInfraMonitorSource.edit, payload)
}

/** 删除数据源（逻辑删除，后端顺带通知 gateway 移除） */
export function deleteMonitorSources(ids: string[]): Promise<string | null> {
  return deleteAction<string>(ApiInfraMonitorSource.delete, { ids })
}

/** 测试连接：结果对象带 ok/detail/error，同时回写 verified_at / verify_error / 采样与保留上限 */
export function testMonitorSource(id: string): Promise<SourceTestResult | null> {
  return postAction<SourceTestResult>(ApiInfraMonitorSource.test, { id })
}
