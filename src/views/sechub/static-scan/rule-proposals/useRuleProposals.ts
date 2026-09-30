/**
 * 规则优化提案页的状态与动作（View → Composable → Service → Api）。
 *
 * 采纳只改提案状态（规则改版仍走人工 + 重放，本期不自动改规则），
 * 所以决策成功后重拉列表即可，不联动其他页面。
 */
import type { GenerateSummary, ProposalDecision, RuleProposalFilter, RuleProposalRow } from './types'
import { Message } from '@arco-design/web-vue'
import { ref } from 'vue'
import { usePagedQuery } from '@/hooks'
import { decideRuleProposal, fetchRuleProposals, generateRuleProposals } from './service'
import { pendingFirst, RULE_PROPOSAL_DEFAULT_FILTER, RULE_PROPOSAL_PAGE_SIZE, RULE_PROPOSAL_PAGE_SIZES } from './types'

/** 决策备注上限（与弹窗 max-length 一致） */
export const DECISION_NOTE_MAX = 500

export function useRuleProposals() {
  const rows = ref<RuleProposalRow[]>([])
  const loading = ref(false)
  /** 最近一次列表查询失败（空态据此渲染「重试」而不是「暂无数据」） */
  const failed = ref(false)
  /** 防竞态：迟到的旧响应不得覆盖新条件的结果 */
  let seq = 0

  const { query, total, pagination, onPageChange, onPageSizeChange, search, reset }
    = usePagedQuery<RuleProposalFilter>(
      { ...RULE_PROPOSAL_DEFAULT_FILTER },
      () => load(),
      { pageSize: RULE_PROPOSAL_PAGE_SIZE, pageSizeOptions: RULE_PROPOSAL_PAGE_SIZES },
    )

  async function load() {
    const current = ++seq
    loading.value = true
    try {
      const page = await fetchRuleProposals(query.value)
      if (current !== seq)
        return
      failed.value = page === null
      // 待处理置前：后端顺序之上再做一次页内稳定排序（后端已按此排序时无副作用）
      rows.value = pendingFirst(page?.list ?? [])
      total.value = page?.total ?? 0
    }
    finally {
      if (current === seq)
        loading.value = false
    }
  }

  // ── 采纳 / 驳回（确认弹窗 + 可选备注）─────────────────────────
  const decideVisible = ref(false)
  const decideTarget = ref<RuleProposalRow | null>(null)
  const decideDecision = ref<ProposalDecision>('accepted')
  const decideNote = ref('')
  const deciding = ref(false)

  function openDecide(row: RuleProposalRow, decision: ProposalDecision) {
    if (row.status !== 'pending') {
      Message.warning('只有待处理的提案可以采纳或驳回')
      return
    }
    decideTarget.value = row
    decideDecision.value = decision
    decideNote.value = ''
    decideVisible.value = true
  }

  /** 返回 false 让弹窗保持打开（Arco on-before-ok 语义） */
  async function submitDecide(): Promise<boolean> {
    const target = decideTarget.value
    if (!target)
      return false
    deciding.value = true
    try {
      const note = decideNote.value.trim()
      const updated = await decideRuleProposal(target.id, { decision: decideDecision.value, ...(note ? { note } : {}) })
      if (!updated)
        return false
      Message.success(decideDecision.value === 'accepted' ? '已采纳' : '已驳回')
      decideVisible.value = false
      void load()
      return true
    }
    finally {
      deciding.value = false
    }
  }

  // ── 立即生成 ────────────────────────────────────────────
  const generating = ref(false)
  const generateSummary = ref<GenerateSummary | null>(null)
  const summaryVisible = ref(false)

  async function generate() {
    generating.value = true
    try {
      const summary = await generateRuleProposals()
      if (!summary)
        return
      generateSummary.value = summary
      summaryVisible.value = true
      void load()
    }
    finally {
      generating.value = false
    }
  }

  return {
    rows,
    loading,
    failed,
    query,
    pagination,
    onPageChange,
    onPageSizeChange,
    search,
    reset,
    load,
    decideVisible,
    decideTarget,
    decideDecision,
    decideNote,
    deciding,
    openDecide,
    submitDecide,
    generating,
    generateSummary,
    summaryVisible,
    generate,
  }
}
