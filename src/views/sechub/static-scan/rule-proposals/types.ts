/**
 * 规则优化提案页的 DTO 与展示口径（后端 007c `sec_rule_optimization_proposal` 的前端镜像）。
 *
 * 契约：GET /sechub/prescan/rule-proposals（服务端分页）、
 *       POST /sechub/prescan/rule-proposals/{id}/decide、POST /sechub/prescan/rule-proposals/generate。
 * metrics / evidence 的形状随 kind 变化；后端给的是 JSON 对象，字段可能缺失，
 * 所以这里一律按 Partial 读取、缺字段显示「—」而不是 0。
 * 分层：本文件只放类型、常量与纯展示换算；取数在 ./service，页面状态在 ./useRuleProposals。
 */
import type { TableColumnData } from '@arco-design/web-vue'
import { formatTime } from '@/hooks'
import { formatRate } from '../rule-effects/types'

export type ProposalKind = 'retire' | 'revise' | 'new_rule' | 'scan_point' | 'counter_example'
export type ProposalStatus = 'pending' | 'accepted' | 'rejected'
export type ProposalDecision = Exclude<ProposalStatus, 'pending'>

/** 退役 / 知识修订：规则效果聚合指标（比率 0~1 小数，分母 0 → null） */
export interface EffectMetrics {
  repositories: number
  repository_ids: string[]
  candidates: number
  ai_confirmed: number
  ai_rejected: number
  ai_review_needed: number
  ai_adoption_rate: number | null
  dev_false_positive: number
  dev_dispositioned: number
  dev_fp_rate: number | null
  thresholds: Record<string, unknown>
}
export interface EffectEvidence {
  rule_key: string
  rule_name: string
}

/** 新增规则 / 新增扫描点：UNCLASSIFIED 同类 AI 发现聚簇 */
export interface ClusterMetrics {
  findings: number
  repositories: number
  threshold: number
}
export interface ClusterSample {
  candidate_id: string
  run_id: string
  repository_id: string
  file_path: string
  method_name: string
  problem_key: string
}
export interface ClusterEvidence {
  cluster: string
  rule_key: string
  samples: ClusterSample[]
}

/** 反例：开发标误报回流 */
export interface CounterExampleMetrics {
  marked_at: string
}
export interface CounterExampleEvidence {
  issue_id: string
  problem_key: string
  repository_id: string
  file_path: string
  start_line: number
  method_name: string
  matched_text: string
  title: string
  reason: string
  marked_by: string
}

interface ProposalBase {
  id: string
  status: ProposalStatus
  rule_version_id?: string | null
  rule_key?: string | null
  rule_name?: string | null
  scan_point_id?: string | null
  scan_point_name?: string | null
  dedup_key: string
  decided_by?: string | null
  decided_at?: string | null
  decision_note?: string | null
  created_at: string
}

/** 一条提案：按 kind 区分 metrics / evidence 形状（判别联合，模板里按 kind 收窄） */
export type RuleProposalRow = ProposalBase & (
  | { kind: 'retire' | 'revise', metrics: Partial<EffectMetrics>, evidence: Partial<EffectEvidence> }
  | { kind: 'new_rule' | 'scan_point', metrics: Partial<ClusterMetrics>, evidence: Partial<ClusterEvidence> }
  | { kind: 'counter_example', metrics: Partial<CounterExampleMetrics>, evidence: Partial<CounterExampleEvidence> }
)

/** 筛选条件；空串 = 不过滤（发送前由 service 剔除，后端 Option<T> 收到空串会 400） */
export interface RuleProposalFilter {
  kind: ProposalKind | ''
  status: ProposalStatus | ''
}

export interface RuleProposalQuery extends RuleProposalFilter {
  page_num: number
  page_size: number
}

/** 响应 `ListData<RuleProposalRow>`（total_pages/page_num 本页不用） */
export interface RuleProposalPage {
  list: RuleProposalRow[]
  total: number
}

export interface DecideRequest {
  decision: ProposalDecision
  note?: string
}

/** 手动生成的汇总 */
export interface GenerateSummary {
  created: number
  refreshed: number
  unchanged: number
  created_by_kind: Record<string, number>
  thresholds: Record<string, unknown>
}

export const RULE_PROPOSAL_DEFAULT_FILTER: RuleProposalFilter = { kind: '', status: '' }
export const RULE_PROPOSAL_PAGE_SIZE = 20
export const RULE_PROPOSAL_PAGE_SIZES = [20, 50, 100]

export const PROPOSAL_KIND_LABELS: Record<ProposalKind, { label: string, color: string }> = {
  retire: { label: '退役', color: 'red' },
  revise: { label: '知识修订', color: 'orange' },
  new_rule: { label: '新增规则', color: 'arcoblue' },
  scan_point: { label: '新增扫描点', color: 'cyan' },
  counter_example: { label: '反例', color: 'purple' },
}

export const PROPOSAL_STATUS_LABELS: Record<ProposalStatus, { label: string, color: string }> = {
  pending: { label: '待处理', color: 'orangered' },
  accepted: { label: '已采纳', color: 'green' },
  rejected: { label: '已驳回', color: 'gray' },
}

export const PROPOSAL_KIND_OPTIONS = (Object.keys(PROPOSAL_KIND_LABELS) as ProposalKind[])
  .map(value => ({ value, label: PROPOSAL_KIND_LABELS[value].label }))
export const PROPOSAL_STATUS_OPTIONS = (Object.keys(PROPOSAL_STATUS_LABELS) as ProposalStatus[])
  .map(value => ({ value, label: PROPOSAL_STATUS_LABELS[value].label }))

/** 表外 kind（后端新增类型但前端未跟上）原样显示 */
export function kindLabel(kind: string): { label: string, color: string } {
  return PROPOSAL_KIND_LABELS[kind as ProposalKind] ?? { label: kind, color: 'gray' }
}

export function statusLabel(status: string): { label: string, color: string } {
  return PROPOSAL_STATUS_LABELS[status as ProposalStatus] ?? { label: status, color: 'gray' }
}

/** 计数：非数字（缺字段）显示「—」，别读成 0 */
export function countText(value: unknown): string {
  return typeof value === 'number' ? String(value) : '—'
}

/** 文本：空串/非字符串显示「—」 */
export function text(value: unknown): string {
  if (typeof value === 'number')
    return String(value)
  return typeof value === 'string' && value.trim() ? value : '—'
}

export interface LabeledValue {
  label: string
  value: string
}

/** 每种提案的关键指标（列表「关键指标」列） */
export function proposalMetricItems(row: RuleProposalRow): LabeledValue[] {
  switch (row.kind) {
    case 'retire':
    case 'revise': {
      const m = row.metrics
      return [
        { label: '仓库', value: countText(m.repositories) },
        { label: '检出', value: countText(m.candidates) },
        { label: 'AI 采信率', value: formatRate(m.ai_adoption_rate) },
        { label: '开发误报', value: `${countText(m.dev_false_positive)}/${countText(m.dev_dispositioned)}` },
        { label: '开发误报率', value: formatRate(m.dev_fp_rate) },
      ]
    }
    case 'new_rule':
    case 'scan_point':
      return [
        { label: '发现', value: countText(row.metrics.findings) },
        { label: '仓库', value: countText(row.metrics.repositories) },
        { label: '阈值', value: countText(row.metrics.threshold) },
      ]
    case 'counter_example':
      return [{ label: '标记时间', value: formatTime(row.metrics.marked_at) }]
    default:
      return []
  }
}

/** 规则 / 扫描点目标：优先顶层字段，缺失时退回 evidence 里的规则编号 */
export function proposalTarget(row: RuleProposalRow): { primary: string, secondary: string } {
  const evidenceKey = 'rule_key' in row.evidence ? row.evidence.rule_key : undefined
  const primary = text(row.rule_key ?? evidenceKey)
  const secondary = [row.rule_name, row.scan_point_name ?? row.scan_point_id]
    .filter((v): v is string => typeof v === 'string' && v.trim() !== '')
    .join(' · ')
  return { primary, secondary: secondary || '—' }
}

/** 同一页内待处理置前（稳定排序：保留后端给出的其余顺序） */
export function pendingFirst(rows: RuleProposalRow[]): RuleProposalRow[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => Number(b.row.status === 'pending') - Number(a.row.status === 'pending') || a.index - b.index)
    .map(item => item.row)
}

/** 对象型字段（thresholds / created_by_kind）展开成 k=v 文本 */
export function recordText(value: Record<string, unknown> | undefined): string {
  if (!value || !Object.keys(value).length)
    return '—'
  return Object.entries(value).map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : String(v)}`).join('，')
}

export const RULE_PROPOSAL_COLUMNS: TableColumnData[] = [
  { title: '类型', dataIndex: 'kind', slotName: 'kind', width: 110 },
  { title: '状态', dataIndex: 'status', slotName: 'status', width: 90 },
  { title: '规则 / 扫描点', dataIndex: 'rule_key', slotName: 'target', width: 260, ellipsis: true, tooltip: true },
  { title: '关键指标', dataIndex: 'metrics', slotName: 'metrics', width: 420 },
  { title: '创建时间', dataIndex: 'created_at', width: 170, render: ({ record }) => formatTime(record.created_at) },
  { title: '决策', dataIndex: 'decided_at', slotName: 'decision', width: 200, ellipsis: true, tooltip: true },
  { title: '操作', slotName: 'ops', width: 130, fixed: 'right' },
]

export const RULE_PROPOSAL_TABLE_MIN_WIDTH = RULE_PROPOSAL_COLUMNS.reduce((sum, c) => sum + (c.width ?? 120), 0)
