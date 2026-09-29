import type { DomainAsset, DomainAssetPage } from '../domain-assets/types'
import type { AiConfirmBody, DeltaPlanPreview, DeltaPreviewRequest, DomainTriggerRequest, FullTriggerRequest, RepoOption, ScanTargetType } from './types'
/**
 * 「新建扫描」用到的全部接口调用（View → Composable → Service → Api 的 service 层）。
 *
 * 约定：统一用 `@/hooks` 的 `getAction/postAction`（失败返回 null，拦截器已弹错误提示），
 * 页面与组合式函数不直接碰 `@/api` 常量。返回类型显式标注，禁用 any。
 */
import type { AiAgent, AiSkill } from '@/api/aiApis'
import type { AgentRunProgress, AiConfirmResponse, BranchesControlResponse, ModuleWithRepository, PageResult, PrescanTriggerResponse, RepositoryCommitListResponse, RuleSet, ScanBaselineAdoptResult, ScanBaselineView } from '@/types/static-scan'
import { ApiAiAgent, ApiAiSkill } from '@/api/aiApis'
import { ApiSecDomainAsset, ApiSecModuleRepository, ApiSecPrescan, ApiSecRuleSet, resolveStaticScanApi } from '@/api/sechubApis'
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

/** 领域资产取数结果：truncated = 因上限截断（调用方提示用户缩小范围） */
export interface DomainAssetFetchResult {
  list: DomainAsset[]
  total: number
  truncated: boolean
}

/** 后端契约 page_size ∈ 1..=200（domain_asset 校验），超过直接 400，曾误写 500 报「参数错误」 */
const DOMAIN_ASSET_PAGE_SIZE = 200
/** 翻页取全量的上限：只取第一页会让超出部分的资产根本选不到（表单资产一个仓库就可能上百） */
const DOMAIN_ASSET_MAX = 5000

/** 翻页拉取某仓库下 active、in_scope 的领域资产全量 */
export async function fetchDomainAssets(scopeType: Exclude<ScanTargetType, 'repository'>, repositoryId: string): Promise<DomainAssetFetchResult | null> {
  const all: DomainAsset[] = []
  let total = 0
  let pageNum = 1
  let truncated = false
  for (;;) {
    const page = await getAction<DomainAssetPage>(ApiSecDomainAsset.getList, {
      page_num: pageNum,
      page_size: DOMAIN_ASSET_PAGE_SIZE,
      asset_type: scopeType,
      repository_id: repositoryId,
      in_scope: true,
      active: true,
    })
    // 第一页就失败：整次取数失败（拦截器已弹提示）
    if (!page)
      return pageNum === 1 ? null : { list: all, total: total || all.length, truncated }
    const list = page.list ?? []
    total = page.total ?? list.length
    all.push(...list)
    if (list.length === 0 || all.length >= total)
      break
    if (all.length >= DOMAIN_ASSET_MAX) {
      truncated = true
      break
    }
    pageNum += 1
  }
  return { list: all, total, truncated }
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

/**
 * 当前差量基线（比较域内 active 的那条）。
 *
 * 「无基线」时后端返回 data:null，而 useGet 的解包把空值归一成 {}（成功一定拿到真值的不变量），
 * 所以必须按 id 判定有没有，不能只判真值 —— 否则 {} 会当成基线，读到 undefined 字段直接崩渲染。
 */
export async function fetchBaseline(repositoryId: string, branch: string): Promise<ScanBaselineView | null> {
  const data = await getAction<ScanBaselineView>(ApiSecPrescan.baseline, { repository_id: repositoryId, branch })
  return data?.id ? data : null
}

/** 采纳最近一个合格的扫描为基线（完整扫描收尾后平台也会自动采纳，这里是人工兜底） */
export function adoptBaseline(repositoryId: string, branch: string): Promise<ScanBaselineAdoptResult | null> {
  return postAction<ScanBaselineAdoptResult>(ApiSecPrescan.baselineAdopt, {
    repository_id: repositoryId,
    branch,
    force: true,
  })
}

/** 整仓（含反编译源码库）全量扫描 */
export function triggerFull(body: FullTriggerRequest): Promise<PrescanTriggerResponse | null> {
  return postAction<PrescanTriggerResponse>(ApiSecPrescan.trigger, body)
}

/** 表单/微服务资产扫描：后端按资产逐条冻结范围 */
export function triggerDomain(body: DomainTriggerRequest): Promise<PrescanTriggerResponse | null> {
  return postAction<PrescanTriggerResponse>(ApiSecPrescan.domainTrigger, body)
}

/** 生成（或复用）冻结计划预览 */
export function previewDelta(body: DeltaPreviewRequest): Promise<DeltaPlanPreview | null> {
  return postAction<DeltaPlanPreview>(ApiSecPrescan.deltaPreview, body)
}

/** 按冻结计划启动扫描 */
export function executeDelta(planId: string): Promise<PrescanTriggerResponse | null> {
  const url = resolveStaticScanApi(ApiSecPrescan.deltaExecute, { plan_id: planId })
  return postAction<PrescanTriggerResponse>(url, {})
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
