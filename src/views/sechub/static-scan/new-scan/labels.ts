/**
 * 「新建扫描」模块的纯展示常量与函数（中文标签、下拉文案）。
 *
 * 只有输入到输出的映射，不碰接口也不持有状态，便于模板直接调用与单测。
 */
import type { AgentRunProgress, CrossRunAggRow, RepositoryCommit, RuleSet } from '@/types/static-scan'
import { formatTime } from '@/hooks'
import { domainLabels } from '../labels'

/**
 * commit 下拉标签用的紧凑时间戳 yymmddhhmmss。
 * 走统一入口按**用户时区**渲染后再压缩 —— 旧实现用 `new Date().getHours()` 等取的是
 * 浏览器时区分量，同一个 commit 在不同电脑上标签不一样。
 */
export function formatCommitTime(iso: string): string {
  const t = formatTime(iso, { placeholder: '' })
  if (!t)
    return ''
  // '2026-08-28 14:00:29' -> '260828140029'
  return t.slice(2).replace(/[-: ]/g, '')
}

/** 将 RepositoryCommit 格式化为下拉选项标签：短 sha + 日期 + 标题 */
export function formatCommitLabel(c: RepositoryCommit): string {
  return `${c.short_sha} ${formatCommitTime(c.commit_time)} ${c.subject}`
}

/** 目标 Commit SHA 的格式校验：7~40 位十六进制 */
export function isCommitSha(value: string): boolean {
  return /^[0-9a-f]{7,40}$/i.test(value)
}

/** commit 短 sha（前 8 位）；空值返回空串 */
export function shortSha(sha: string | null | undefined): string {
  return sha?.slice(0, 8) ?? ''
}

function ruleSetDomainsText(item: RuleSet): string {
  return item.domains.map(domain => domainLabels[domain] ?? domain).join('+')
}

/** 规则目录下拉标签（契约 E）：名称 · 安全+性能 · N 条规则（N 取实时 item_count，不再写死在名称里） */
export function ruleSetLabel(item: RuleSet): string {
  return `${item.name} · ${ruleSetDomainsText(item)} · ${item.item_count ?? 0} 条规则`
}

/** 目录不可用于完整扫描的原因（悬浮提示用）；后端没给 blockers 时给通用说明 */
export function ruleSetBlockersText(item: RuleSet): string {
  const messages = (item.blockers ?? []).map(blocker => blocker.message || blocker.code).filter(Boolean)
  return messages.length ? `不可用：${messages.join('；')}` : '不可用：该目录不满足完整扫描条件'
}

/** 规则目录是否可选（complete_scan_ready 显式 false 才禁用；旧后端缺字段时放行） */
export function ruleSetSelectable(item: RuleSet): boolean {
  return item.complete_scan_ready !== false
}

/**
 * 行级「AI 确认」不可用的原因（空字符串 = 可用）。
 * 文案与看板迁移前一致：preparing/running 未完成、failed 无有效候选、skipped 代码或规则未变更。
 */
export function aiConfirmBlockedReason(runId: string | null | undefined, status: string | null | undefined): string {
  if (!runId)
    return '请先选择扫描运行'
  if (status === 'preparing' || status === 'running')
    return '预扫描尚未完成，完成后才能触发 AI 确认'
  if (status === 'failed')
    return '该批次扫描失败，无有效候选，无法触发 AI 确认'
  if (status === 'skipped')
    return '该批次已跳过（代码或规则未变更），无有效候选，无法触发 AI 确认'
  if (status !== 'succeeded')
    return '预扫描尚未完成，完成后才能触发 AI 确认'
  return ''
}

/** Agent 自主审计进度文案（迁移自看板的工具栏 tag） */
export function agentProgressText(p: AgentRunProgress): string {
  const settled = (p.confirmed ?? 0) + (p.rejected ?? 0)
  return `Agent 审计 ${settled}/${p.total}（确认 ${p.confirmed} / 排除 ${p.rejected} / 待复核 ${p.review_needed} / 待处理 ${p.pending}）`
}

/**
 * 该 run 是否已经触发过 AI 确认（原在 runs.vue，批量门槛与确认状态列共用）。
 *
 * 两个依据取其一即可：
 * - 有关联的 AI 执行记录（batch/agent 的 caller_id 都是 run_id）
 * - 或候选里已经出现过任何 AI 结论（历史 run 的执行记录挂在 rule_version_id 上，查不到）
 */
export function confirmTriggered(row: CrossRunAggRow): boolean {
  if ((row.ai_exec_total ?? 0) > 0)
    return true
  return (row.confirmed ?? 0) > 0 || (row.rejected ?? 0) > 0
    || (row.error ?? 0) > 0 || (row.review_needed ?? 0) > 0
}

/**
 * 确认任务在途数（排队 + 执行中）：以任务队列为真相源，旧数据缺字段时退回 ai_exec_*。
 */
export function inFlightCount(row: CrossRunAggRow): number {
  return (row.queue_pending ?? row.ai_exec_pending ?? 0) + (row.queue_running ?? row.ai_exec_running ?? 0)
}

/**
 * 批量「AI 确认」是否可用（'' = 可用）。
 * 口径：尚未开始确认的运行才可以批量触发 —— 预扫描完成、无在途任务、没触发过确认、
 * 且确实还有待确认候选。已触发过但仍有错误/未确认候选的行交给「批量重扫未完成」。
 */
export function batchAiConfirmBlockedReason(row: CrossRunAggRow): string {
  const stage = aiConfirmBlockedReason(row.run_id, row.status)
  if (stage)
    return stage
  const inFlight = inFlightCount(row)
  if (inFlight > 0)
    return `已有 ${inFlight} 个确认任务在途，请等待完成后再触发`
  if (confirmTriggered(row))
    return '已触发过 AI 确认（要重跑用「重扫未完成」）'
  if ((row.pending ?? 0) === 0)
    return '没有待确认候选'
  return ''
}

/**
 * 行勾选框是否可用（'' = 可勾选）。
 *
 * 勾选列同时服务「批量 AI 确认」与「批量重扫未完成」两个动作，只要对其中一个
 * 有效就允许勾选；两个都用不上的行（未成功 / 确认中 / 已确认过且没有待确认、
 * 错误候选）置灰。未成功但仍有错误候选这类极端残留交给行内「更多」里的动作处理。
 */
export function rowCheckboxBlockedReason(row: CrossRunAggRow): string {
  const stage = aiConfirmBlockedReason(row.run_id, row.status)
  if (stage)
    return stage
  const inFlight = inFlightCount(row)
  if (inFlight > 0)
    return `有 ${inFlight} 个确认任务在途，请等待完成后再操作`
  if ((row.pending ?? 0) > 0 || (row.error ?? 0) > 0)
    return ''
  return confirmTriggered(row) ? '已确认过，且没有待确认/错误候选，无可用操作' : '没有待确认候选，无可用操作'
}

/** 勾选框 tooltip：不可勾选 → 原因；可勾选但不参与批量 AI 确认 → 说明差异；其余为空 */
export function rowCheckboxTooltip(row: CrossRunAggRow): string {
  const blocked = rowCheckboxBlockedReason(row)
  if (blocked)
    return blocked
  const confirmBlocked = batchAiConfirmBlockedReason(row)
  return confirmBlocked ? `可勾选用于「批量重扫未完成」；不参与批量 AI 确认：${confirmBlocked}` : ''
}

/** 统一扫描阻断原因码（unified-preview.blocked_reason）→ 人话；未收录的码原样透出便于排查 */
const UNIFIED_BLOCK_LABELS: Record<string, string> = {
  no_in_use_assets: '该仓库没有在用（active + in_scope）的表单/微服务资产，统一扫描不以零资产兜底为整仓扫描',
  sync_run_missing: '在用资产缺少可追溯的同步批次，请先重新同步资产',
  multiple_sync_runs: '在用资产分属多个同步批次，请先重新同步使其属于同一批次',
  sync_run_not_succeeded: '在用资产所属同步批次未成功，请先重新同步资产',
  sync_run_domain_mismatch: '同步批次与资产类型不一致，请联系管理员核对资产同步',
}
const UNIFIED_BLOCK_DOMAIN: Record<string, string> = { form: '表单资产', microservice: '微服务资产' }

export function unifiedBlockedText(reason: string): string {
  const direct = UNIFIED_BLOCK_LABELS[reason]
  if (direct)
    return direct
  // 按域的码形如 form_sync_run_missing / microservice_multiple_sync_runs
  const domain = Object.keys(UNIFIED_BLOCK_DOMAIN).find(key => reason.startsWith(`${key}_`))
  const suffixLabel = domain ? UNIFIED_BLOCK_LABELS[reason.slice(domain.length + 1)] : undefined
  if (domain && suffixLabel)
    return `${UNIFIED_BLOCK_DOMAIN[domain]}：${suffixLabel}`
  return reason
}
