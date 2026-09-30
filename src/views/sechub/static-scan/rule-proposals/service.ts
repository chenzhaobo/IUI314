/**
 * 规则优化提案页的取数（View → Composable → Service → Api 的 service 层）。
 *
 * 统一走 `@/hooks` 的 getAction / postAction（失败返回 null，拦截器已弹提示），
 * 页面与组合式函数不直接碰 `@/api` 常量。
 */
import type { DecideRequest, GenerateSummary, RuleProposalPage, RuleProposalQuery, RuleProposalRow } from './types'
import { ApiSecPrescan, resolveStaticScanApi } from '@/api/sechubApis'
import { getAction, postAction } from '@/hooks'

/** 剔除空串筛选值：后端 Option<T> 收到空串会 400，「不过滤」必须表达成「键不出现」 */
function compactQuery(query: RuleProposalQuery): Record<string, string | number> {
  const out: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(query)) {
    if (value !== '' && value !== null && value !== undefined)
      out[key] = value
  }
  return out
}

/** 提案列表（服务端分页）；失败返回 null */
export function fetchRuleProposals(query: RuleProposalQuery): Promise<RuleProposalPage | null> {
  return getAction<RuleProposalPage>(ApiSecPrescan.ruleProposals, compactQuery(query))
}

/** 采纳 / 驳回（仅 pending 可决策，后端拒绝时返回 null）；成功返回更新后的行 */
export function decideRuleProposal(id: string, body: DecideRequest): Promise<RuleProposalRow | null> {
  return postAction<RuleProposalRow>(resolveStaticScanApi(ApiSecPrescan.ruleProposalDecide, { id }), body)
}

/** 立即生成（无请求体）；返回新建/刷新/未变计数与本次阈值 */
export function generateRuleProposals(): Promise<GenerateSummary | null> {
  return postAction<GenerateSummary>(ApiSecPrescan.ruleProposalGenerate)
}
