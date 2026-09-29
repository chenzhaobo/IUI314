/**
 * 规则效果页的取数（View → Composable → Service → Api 的 service 层）。
 *
 * 约定同其他模块：统一走 `@/hooks` 的 `getAction`（失败返回 null，拦截器已弹提示），
 * 页面与组合式函数不直接碰 `@/api` 常量。接口为只读 GET + 服务端分页排序。
 */
import type { RuleEffectPage, RuleEffectQuery } from './types'
import type { ModuleWithRepository } from '@/types/static-scan'
import { ApiSecModuleRepository, ApiSecPrescan } from '@/api/sechubApis'
import { getAction } from '@/hooks'

/**
 * 剔除空串筛选值。后端 Option<T> 参数收到空串会反序列化失败（400），
 * 所以「不过滤」必须表达成「这个键不出现」。
 */
function compactQuery(query: RuleEffectQuery): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(query)) {
    if (value === '' || value === null || value === undefined)
      continue
    out[key] = value
  }
  return out
}

/** 规则效果列表（服务端分页 + 排序）；失败返回 null */
export function fetchRuleEffects(query: RuleEffectQuery): Promise<RuleEffectPage | null> {
  return getAction<RuleEffectPage>(ApiSecPrescan.ruleEffects, compactQuery(query))
}

/**
 * 仓库下拉（含模块名），同时用于「仓库」筛选与列表的仓库显示名解析。
 * 失败返回 null：筛选少一个下拉不该让整页不可用，列表里仓库列退回显示 id。
 */
export function fetchRepositoryOptions(): Promise<ModuleWithRepository[] | null> {
  return getAction<ModuleWithRepository[]>(ApiSecModuleRepository.listWithModule, {})
}
