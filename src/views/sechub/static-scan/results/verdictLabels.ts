/**
 * 结果页判定结论相关的中文标签（结果列表、轮次下拉、结论历史、人工裁定共用）。
 */
import type { CandidateVerdictKind } from '@/types/static-scan'

/** AI 判定模式 ai_mode → 中文标签 + 色值 */
export const aiModeLabels: Record<string, { label: string, color: string }> = {
  batch: { label: '平台编排', color: 'blue' },
  agent: { label: 'Agent', color: 'purple' },
  manual: { label: '人工裁定', color: 'orange' },
}

/** 结论轮次类型角标：只有「非常规」的轮次才打角标，聚合 / 单条判定不打 */
export interface VerdictKindBadge {
  label: string
  color: string
  tip: string
}

export const verdictKindBadges: Partial<Record<CandidateVerdictKind, VerdictKindBadge>> = {
  propagated: {
    label: '传播',
    color: 'cyan',
    tip: '同问题键的其他候选判定后传播过来的结论，本候选没有单独判定',
  },
  group_partial: {
    label: '不完整',
    color: 'orangered',
    tip: '本轮只落了权限分组结论、缺少候选聚合结论（判定中断或部分落库），不参与上次结论 / 模型分歧对比',
  },
}

/** 不完整轮次的 verdict 是 'group_partial'，不在 AI 状态表里，单独给标签 */
export const groupPartialVerdictLabel = { label: '分组不完整', color: 'gray' }
