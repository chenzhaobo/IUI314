import type { AutoCloseAlert, DeltaPlanPreview, DeltaPreviewRow, EstimateRange } from './types'
/**
 * 「新建扫描」模块的纯展示常量与函数（中文标签、下拉文案、预览面板行）。
 *
 * 只有输入到输出的映射，不碰接口也不持有状态，便于模板直接调用与单测。
 */
import type { AgentRunProgress, CrossRunAggRow, RepositoryCommit, RuleSet, ScanBaselineView } from '@/types/static-scan'
import { formatTime } from '@/hooks'
import { domainLabels } from '../labels'

/** 差量类型（delta_kind）→ 中文 */
export const DELTA_KIND_LABELS: Record<string, string> = {
  auto_delta: '自动增量（服务端判定）',
  code_delta: '仅代码差量',
  rule_delta: '仅规则差量',
  hybrid_delta: '代码 + 规则混合差量',
  full_baseline: '完整基线',
  reconfirm: '仅重新 AI 确认',
  hunk_quick: '新增行快速检查',
}

/**
 * 「不具备自动关闭资格」的原因码 → 人话。未收录的码原样透出，便于排查。
 * 自动关闭 = 扫描后把本次未再命中的历史问题自动关掉；差量扫描只覆盖变更范围，
 * 天然不具备该资格，属预期而非故障。
 */
export const AUTO_CLOSE_BLOCK_LABELS: Record<string, string> = {
  may_auto_close_false: '本次未取得自动关闭资格',
  delta_kind_hunk_quick: '新增行快速检查不关闭历史问题',
  delta_kind_reconfirm: '仅重新 AI 确认不关闭历史问题',
  impact_truncated: '调用链扩散被截断，覆盖不完整',
  impact_evidence_missing: '缺少调用关系证据',
  ambiguous_delta: '变更归属存在歧义',
  git_unavailable: 'Git 不可用，无法核验覆盖范围',
  delta_base_missing: '找不到可信的差量基线',
  branch_missing: '目标分支不存在',
  commit_missing: '目标 Commit 不存在',
  invalid_domain: '比较域非法',
  manifest_missing: '缺少范围清单（Manifest）',
  manifest_untrusted: '范围清单不可信',
  manifest_truncated: '范围清单被截断',
  manifest_incomplete: '范围清单存在缺失项',
  manifest_ambiguous: '范围清单存在歧义项',
  ai_pending_candidates: '还有候选未完成 AI 确认',
  cache_miss_unprocessed: '有缓存未命中的候选尚未处理',
  issue_writeback_incomplete: '确认候选尚未写回问题',
  may_auto_close_inconsistent: '自动关闭契约与实际事实不一致',
}

/** 这些原因属于「差量扫描天然不关闭」的预期状态，提示用 info 而非 warning */
const EXPECTED_NO_CLOSE_REASONS = new Set(['may_auto_close_false', 'delta_kind_hunk_quick', 'delta_kind_reconfirm'])

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

/** 目标/基准 Commit 的格式校验：7~40 位十六进制 */
export function isCommitSha(value: string): boolean {
  return /^[0-9a-f]{7,40}$/i.test(value)
}

/** 当前差量基线的一行说明：建立时间 · 来源运行 · 信任级别 */
export function baselineMetaText(baseline: ScanBaselineView): string {
  const run = (baseline.baseline_run_id || '').slice(0, 8)
  return `${formatTime(baseline.created_at)} · 运行 ${run} 建立（${baseline.trust_level === 'provisional' ? '暂定' : '已采纳'}）`
}

function ruleSetDomainsText(item: RuleSet): string {
  return item.domains.map(domain => domainLabels[domain] ?? domain).join('+')
}

/** 规则目录下拉标签：名称 · 领域 */
export function ruleSetLabel(item: RuleSet): string {
  return `${item.name} · ${ruleSetDomainsText(item)}`
}

/**
 * 差量计划预览：摊平成「指标 / 取值 / 说明」三列面板。
 * 原 a-descriptions 两列在长值（缓存区间、Token 区间）下会换行错位，改成网格对齐 + 每项给口径说明。
 */
export function buildDeltaPreviewRows(p: DeltaPlanPreview, ruleSetText: string): DeltaPreviewRow[] {
  const range = (r: EstimateRange) => `${r.lower}..${r.upper}`
  return [
    { key: 'kind', label: '计划类型', value: DELTA_KIND_LABELS[p.delta_kind] ?? p.delta_kind, hint: p.delta_kind },
    { key: 'plan', label: '冻结计划', value: p.plan_id.slice(0, 12), hint: '执行前先核对本预览' },
    { key: 'ruleset', label: '规则目录', value: ruleSetText, hint: '决定本次执行哪些规则' },
    {
      key: 'files',
      label: '文件变更',
      value: `增 ${p.added_files} · 改 ${p.modified_files} · 删 ${p.deleted_files} · 改名 ${p.renamed_files} · 复制 ${p.copied_files}`,
      hint: 'A / M / D / R / C',
    },
    { key: 'scope', label: '扫描范围', value: `直接 ${p.direct_file_count} 个 · 影响 ${p.impacted_file_count} 个`, hint: '影响含调用链扩散' },
    {
      key: 'domain',
      label: '涉及领域资产',
      // 后端显式告知"清单里没有资产维度"时才显示不适用（旧后端无此字段则保持原计数口径）
      value: p.has_asset_manifest === false ? '不适用' : `表单 ${p.affected_form_count} · 微服务 ${p.affected_microservice_count}`,
      hint: p.has_asset_manifest === false ? '仓库级计划按文件扫描，不含资产清单' : undefined,
    },
    { key: 'rules', label: '规则变更', value: `新增 ${p.added_rule_count} · 修改 ${p.modified_rule_count} · 移除 ${p.removed_rule_count}` },
    {
      key: 'cache',
      label: 'AI 缓存',
      value: `命中 ${range(p.cache_hit_count)} · 需调用 ${range(p.cache_miss_count)} · 不适用 ${range(p.cache_not_eligible_count)}`,
      hint: '区间 = 乐观..保守估算',
    },
    { key: 'calls', label: 'AI 调用', value: `${range(p.ai_call_count)} 次` },
    { key: 'tokens', label: 'Token 预估', value: `${range(p.token_count)}`, hint: '非账单，仅供参考' },
  ]
}

/** 自动关闭资格提示；有资格（或还没预览）时返回 null */
export function buildAutoCloseAlert(p: DeltaPlanPreview | null): AutoCloseAlert | null {
  if (!p || p.may_auto_close)
    return null
  const reasons = p.auto_close_block_reasons ?? []
  const expected = reasons.length === 0 || reasons.every(r => EXPECTED_NO_CLOSE_REASONS.has(r))
  const labels = reasons.map(r => AUTO_CLOSE_BLOCK_LABELS[r] ?? r)
  if (expected) {
    return {
      type: 'info',
      title: '本次扫描不会自动关闭历史问题（差量扫描的预期行为）',
      detail: '自动关闭指扫描后把本次未再命中的历史问题自动关掉；差量只覆盖变更范围，未覆盖范围的问题原样保留，需人工处置。',
    }
  }
  return {
    type: 'warning',
    title: `覆盖不完整，不具备自动关闭资格：${labels.join('；')}`,
    detail: '本次扫描只新增/更新问题，不会关闭任何历史问题。',
  }
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
