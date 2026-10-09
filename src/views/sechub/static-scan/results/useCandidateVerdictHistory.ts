/**
 * 结果页展开行「多模型结论对比」的展示派生（纯函数 + 组合式封装，不取数）。
 *
 * 后端 `verdicts` 顶层每项是一轮判定（aggregate / single / propagated / group_partial），
 * AI-01 权限分组行嵌在该轮的 `groups` 里，顶层不会出现 kind='group'。
 * 旧后端不返回 kind / groups 时按 single、无分组处理。
 */
import type { MaybeRefOrGetter } from 'vue'
import type { VerdictKindBadge } from './verdictLabels'
import type { CandidateVerdictKind, CandidateVerdictRow } from '@/types/static-scan'
import { computed, toValue } from 'vue'
import { aiStatusLabels } from '../labels'
import { aiModeLabels, groupPartialVerdictLabel, verdictKindBadges } from './verdictLabels'

/** 分组 key 超过该长度时折叠中段（完整值放 tooltip） */
const GROUP_KEY_MAX = 24
const GROUP_KEY_KEEP = 10

export function verdictKind(v: CandidateVerdictRow): CandidateVerdictKind {
  return v.kind ?? 'single'
}

/** 传播 / 不完整轮次的角标；常规轮次返回 null */
export function verdictKindBadge(v: CandidateVerdictRow): VerdictKindBadge | null {
  return verdictKindBadges[verdictKind(v)] ?? null
}

/** 是否为真正给出了候选级结论的轮次（不完整轮次只有分组行，不算） */
export function isJudgedRound(v: CandidateVerdictRow): boolean {
  return verdictKind(v) !== 'group_partial'
}

export function judgedRounds(verdicts: CandidateVerdictRow[] | null | undefined): CandidateVerdictRow[] {
  return (verdicts ?? []).filter(isJudgedRound)
}

/** 最近一轮有效判定（verdicts 已按新到旧排序），口径与后端 previous_verdict 一致 */
export function latestJudgedRound(verdicts: CandidateVerdictRow[] | null | undefined): CandidateVerdictRow | null {
  return judgedRounds(verdicts)[0] ?? null
}

function modelKey(v: CandidateVerdictRow): string {
  return (v.ai_model ?? '').trim()
}

/**
 * 不同模型之间的轮次级结论是否不一致。
 * 只比顶层轮次（分组结论不参与），同一模型自己前后改判不算「模型分歧」。
 */
export function roundsDisagree(verdicts: CandidateVerdictRow[] | null | undefined): boolean {
  const rounds = judgedRounds(verdicts)
  return rounds.some((a, i) => rounds.slice(i + 1).some(b => modelKey(a) !== modelKey(b) && a.verdict !== b.verdict))
}

export function verdictTag(verdict: string): { label: string, color: string } {
  if (verdict === 'group_partial')
    return groupPartialVerdictLabel
  const known = aiStatusLabels[verdict]
  return { label: known?.label ?? verdict, color: known?.color ?? 'gray' }
}

export function aiModeText(mode: string | null | undefined): string {
  return aiModeLabels[mode ?? '']?.label ?? (mode || '-')
}

export function confidenceText(confidence: number | null | undefined): string {
  return confidence != null ? Number(confidence).toFixed(2) : '-'
}

/** 分组 key 短显示：过长时保留首尾、中段省略 */
export function shortGroupKey(key: string | null | undefined): string {
  const k = (key ?? '').trim()
  if (!k)
    return '-'
  if (k.length <= GROUP_KEY_MAX)
    return k
  return `${k.slice(0, GROUP_KEY_KEEP)}…${k.slice(-GROUP_KEY_KEEP)}`
}

export function useCandidateVerdictHistory(verdicts: MaybeRefOrGetter<CandidateVerdictRow[] | null | undefined>) {
  const rounds = computed(() => toValue(verdicts) ?? [])
  const roundCount = computed(() => rounds.value.length)
  const disagrees = computed(() => roundsDisagree(rounds.value))
  const roundsById = computed(() => new Map(rounds.value.map(r => [r.id, r])))

  /** 表格插槽只给出无类型的 record，按 id 取回强类型的轮次 */
  function roundOf(id: unknown): CandidateVerdictRow | null {
    return roundsById.value.get(String(id)) ?? null
  }

  function groupsOf(id: unknown): CandidateVerdictRow[] {
    return roundOf(id)?.groups ?? []
  }

  return { rounds, roundCount, disagrees, roundOf, groupsOf }
}
