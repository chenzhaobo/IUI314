import type { AutoCloseAlert, DeltaPlanPreview, DeltaPreviewRow, EstimateRange } from './types'
/**
 * 「新建扫描」模块的纯展示常量与函数（中文标签、下拉文案、预览面板行）。
 *
 * 只有输入到输出的映射，不碰接口也不持有状态，便于模板直接调用与单测。
 */
import type { AgentRunProgress, RepositoryCommit, RuleSet, ScanBaselineView } from '@/types/static-scan'
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
