/**
 * 发版质量「配置检查 / 白名单」取数（View → Composable → Service → Api 的 service 层）。
 *
 * 查询失败统一返回 null（拦截器已提示），由 composable 决定是否保留旧数据。
 */
import type {
  ConfigBatchDefectReq,
  ConfigBatchDefectResult,
  ConfigDefectReq,
  ConfigDefectResult,
  ConfigEventsResponse,
  ConfigFieldsResponse,
  ConfigItemListResponse,
  ConfigItemQuery,
  ConfigRunFamily,
  ConfigRunResult,
  ConfigSummaryQuery,
  ConfigSummaryResponse,
  WaiverAddReq,
  WaiverAddResult,
  WaiverListResponse,
  WaiverQuery,
  WaiverRevokeReq,
  WaiverRevokeResult,
} from '@/types/sechub-release'
import { ApiSecRelease, resolveStaticScanApi } from '@/api/sechubApis'
import { getAction, postAction } from '@/hooks'

/** 配置检查汇总（范围信息 + 规则表 + 按规则 / 项目组统计 + 汇总） */
export function fetchConfigSummary(query: ConfigSummaryQuery): Promise<ConfigSummaryResponse | null> {
  return getAction<ConfigSummaryResponse>(ApiSecRelease.configSummary, query)
}

/** 检查项明细（服务端分页） */
export function fetchConfigItems(query: ConfigItemQuery): Promise<ConfigItemListResponse | null> {
  return getAction<ConfigItemListResponse>(ApiSecRelease.configItems, query)
}

/** 单个检查项的时间倒序变更记录（最多 200 条） */
export function fetchConfigEvents(itemId: string): Promise<ConfigEventsResponse | null> {
  return getAction<ConfigEventsResponse>(resolveStaticScanApi(ApiSecRelease.configItemEvents, { id: itemId }))
}

/** 明细表列头说明（后端常量表，前端不另写文案） */
export function fetchConfigFields(): Promise<ConfigFieldsResponse | null> {
  return getAction<ConfigFieldsResponse>(ApiSecRelease.configFields)
}

/** 后台执行配置检查：立即返回受理结果，需要稍后刷新 */
export function runConfigCheck(family: ConfigRunFamily): Promise<ConfigRunResult | null> {
  return postAction<ConfigRunResult>(ApiSecRelease.configRun, { family })
}

/** 按「规则 × 项目组」生成（或更新）缺陷草稿 */
export function createConfigDefect(payload: ConfigDefectReq): Promise<ConfigDefectResult | null> {
  return postAction<ConfigDefectResult>(ApiSecRelease.configDefect, payload)
}

/** 按「规则 × 多个项目组」批量生成 / 更新缺陷草稿 */
export function createConfigDefectsBatch(payload: ConfigBatchDefectReq): Promise<ConfigBatchDefectResult | null> {
  return postAction<ConfigBatchDefectResult>(ApiSecRelease.configBatchDefect, payload)
}

/** 白名单列表（active_only 不传时后端默认只看有效） */
export function fetchWaivers(query: WaiverQuery): Promise<WaiverListResponse | null> {
  return getAction<WaiverListResponse>(ApiSecRelease.waivers, query)
}

/** 新增白名单：命中且 open 的检查项立即转 waived */
export function addWaiver(payload: WaiverAddReq): Promise<WaiverAddResult | null> {
  return postAction<WaiverAddResult>(ApiSecRelease.waivers, payload)
}

/** 撤销白名单：不再被其他有效白名单覆盖的检查项退回 open */
export function revokeWaiver(id: string, payload: WaiverRevokeReq): Promise<WaiverRevokeResult | null> {
  return postAction<WaiverRevokeResult>(resolveStaticScanApi(ApiSecRelease.waiverRevoke, { id }), payload)
}
