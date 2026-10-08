import type { AiConfirmBody, FullTriggerRequest, RepoOption, RuleSetTree, UnifiedPreview, UnifiedTriggerRequest, UnifiedTriggerResponse } from './types'
/**
 * 「新建扫描」与 AI 确认用到的全部接口调用（View → Composable → Service → Api 的 service 层）。
 *
 * 约定：统一用 `@/hooks` 的 `getAction/postAction`（失败返回 null，拦截器已弹错误提示），
 * 页面与组合式函数不直接碰 `@/api` 常量。返回类型显式标注，禁用 any。
 */
import type { AiAgent, AiSkill } from '@/api/aiApis'
import type { AgentRunProgress, AiConfirmResponse, BranchesControlResponse, ModuleWithRepository, PageResult, PrescanTriggerResponse, RepositoryCommitListResponse, RuleSet, ScanPointSummaryRow } from '@/types/static-scan'
import { ApiAiAgent, ApiAiSkill } from '@/api/aiApis'
import { ApiSecModuleRepository, ApiSecPrescan, ApiSecRuleSet } from '@/api/sechubApis'
import { getAction, postAction } from '@/hooks'

/** 仓库下拉（含未绑定模块的本地仓，否则反编译源码库选不到） */
export function fetchRepositories(): Promise<ModuleWithRepository[] | null> {
  return getAction<ModuleWithRepository[]>(ApiSecModuleRepository.listWithModule, { include_unbound_local: true })
}

/** 分支列表；refresh=true 会真的 git fetch（慢），打开弹窗默认走缓存 */
export function fetchBranches(repo: RepoOption, refresh: boolean): Promise<BranchesControlResponse | null> {
  return getAction<BranchesControlResponse>(ApiSecModuleRepository.branches, {
    module_id: repo.module_id,
    relation_id: repo.relation_id,
    refresh,
  })
}

/** 指定分支的 commit 列表（最近 30 条） */
export function fetchCommits(repo: RepoOption, branch: string): Promise<RepositoryCommitListResponse | null> {
  return getAction<RepositoryCommitListResponse>(ApiSecPrescan.commits, {
    module_id: repo.module_id,
    relation_id: repo.relation_id,
    branch,
    limit: 30,
  })
}

/**
 * 正式规则集（仅 published，且同一 rule_set_key 只留版本号最大的）。
 * 旧版本的成员规则可能已停用，选中会被运行时校验拒绝（RuleVersion 已禁用）。
 * 失败返回空数组：留空仍走平台默认目录，不阻断弹窗。
 */
export async function fetchRuleSets(): Promise<RuleSet[]> {
  const data = await getAction<RuleSet[] | PageResult<RuleSet>>(ApiSecRuleSet.getAll)
  const list = Array.isArray(data) ? data : data?.list ?? []
  const latestByKey = new Map<string, RuleSet>()
  for (const item of list.filter(item => item.publish_status === 'published')) {
    const current = latestByKey.get(item.rule_set_key)
    if (!current || item.version > current.version)
      latestByKey.set(item.rule_set_key, item)
  }
  return [...latestByKey.values()]
}

/** 规则目录树（域 → 分类 → 扫描点 → 规则）；ruleSetId 空 = 默认目录。失败或空响应返回 null */
export async function fetchRuleSetTree(ruleSetId: string): Promise<RuleSetTree | null> {
  const data = await getAction<RuleSetTree>(ApiSecPrescan.ruleSetTree, ruleSetId ? { rule_set_id: ruleSetId } : {})
  // useGet 把 data:null 归一成 {}：按 domains 判定是否真有树
  return data && Array.isArray(data.domains) ? data : null
}

/** 整仓（含反编译源码库）全量扫描 */
export function triggerFull(body: FullTriggerRequest): Promise<PrescanTriggerResponse | null> {
  return postAction<PrescanTriggerResponse>(ApiSecPrescan.trigger, body)
}

/** 统一扫描预览：自动资产数、阻断原因、增量基线与目标 commit（只读，不冻结） */
export function fetchUnifiedPreview(repositoryId: string, branch: string): Promise<UnifiedPreview | null> {
  return getAction<UnifiedPreview>(ApiSecPrescan.unifiedPreview, branch ? { repository_id: repositoryId, branch } : { repository_id: repositoryId })
}

/** 统一扫描触发：一个仓库一次触发（后端自动选资产、冻结规则/技能/多范围 manifest） */
export function triggerUnified(body: UnifiedTriggerRequest): Promise<UnifiedTriggerResponse | null> {
  return postAction<UnifiedTriggerResponse>(ApiSecPrescan.unifiedTrigger, body)
}

/**
 * 某个 run 内出现过的扫描点（复用已有的 /prescan/summary 按扫描点聚合，AI 确认「范围」下拉用）。
 * 失败返回空数组：下拉只剩「全部」，不阻断确认。
 */
export async function fetchRunScanPoints(runId: string): Promise<ScanPointSummaryRow[]> {
  const data = await getAction<ScanPointSummaryRow[]>(ApiSecPrescan.summary, { run_id: runId })
  return Array.isArray(data) ? data : []
}

/** 触发 AI 确认（batch 平台编排 / agent 自主） */
export function triggerAiConfirm(body: AiConfirmBody): Promise<AiConfirmResponse | null> {
  return postAction<AiConfirmResponse>(ApiSecPrescan.aiConfirm, body)
}

/** 启用状态的 Agent 列表；失败返回 null（调用方保留旧列表） */
export async function fetchAgents(): Promise<AiAgent[] | null> {
  const res = await getAction<{ list: AiAgent[] }>(ApiAiAgent.getList, { status: 'active', page_size: 50 })
  return res?.list ?? null
}

/** 启用状态的技能列表；失败返回 null */
export async function fetchSkills(): Promise<AiSkill[] | null> {
  const res = await getAction<{ list: AiSkill[] }>(ApiAiSkill.getList, { status: 'active', page_size: 100 })
  return res?.list ?? null
}

/** Agent 自主审计进度（3 秒轮询用） */
export function fetchAgentStatus(runId: string): Promise<AgentRunProgress | null> {
  return getAction<AgentRunProgress>(ApiSecPrescan.agentStatus, { run_id: runId })
}
