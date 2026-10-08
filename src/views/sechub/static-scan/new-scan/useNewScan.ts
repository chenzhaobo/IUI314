/**
 * 「新建扫描」状态机。
 *
 * 20261008（契约 C/D/E）：过渡期旧轨（整仓差量向导 / 表单资产 / 微服务资产）已移除，只剩
 * - 统一扫描：分支 + 目标 commit + 扫描方式（全量 / 增量，基线自动取）+ 规则目录 + 规则范围（全部 / 自选 = 部分扫描）；
 * - 反编译源码库（local-test:）：没有 Git 维度与资产，仍走整仓全量（/prescan/trigger）。
 *
 * "扫描来源"在 ./useScanSource，"扫描方式与预览"在 ./useUnifiedScan，"规则范围"在 ./useRuleScope，
 * 这里只做组合、打开/换仓库编排与触发。run 建立后回调 `onCreated(runId)`（运行页刷新列表）。
 */
import type { InjectionKey, UnwrapNestedRefs } from 'vue'
import type { NewScanOpenOptions, RuleScopeMode, UnifiedTriggerRequest, UnifiedTriggerResponse } from './types'
import { Message } from '@arco-design/web-vue'
import { computed, inject, ref } from 'vue'
import { isCommitSha } from './labels'
import { triggerFull } from './service'
import { useRuleScope } from './useRuleScope'
import { useScanSource } from './useScanSource'
import { useUnifiedScan } from './useUnifiedScan'

export interface UseNewScanOptions {
  /** 「该应用已有 N 条扫描记录」幂等提示的计数来源（运行页按其列表按 repository_id 统计） */
  runCountOf?: (repositoryId: string) => number
  /** run 建立后的回调：运行页用它刷新运行列表 */
  onCreated?: (runId: string) => void | Promise<void>
}

/** 统一扫描成功提示：扫描方式 + 规则数 + 资产数 */
function unifiedCreatedMessage(result: UnifiedTriggerResponse): string {
  const scope = result.scan_scope === 'incremental' ? '增量' : result.scan_scope === 'partial' ? '部分' : '全量'
  const rules = result.rule_count != null ? ` · ${result.rule_count} 条规则` : ''
  return `已启动统一扫描（${scope}${rules}；表单资产 ${result.assets.form} / 微服务资产 ${result.assets.microservice}）`
}

export function useNewScan(options: UseNewScanOptions = {}) {
  const source = useScanSource()
  const unified = useUnifiedScan()
  const scope = useRuleScope()
  const { repository, branch, commit, ruleSetId } = source

  const visible = ref(false)
  const executingFull = ref(false)
  /** 被锁定仓库的 id（左侧应用范围树选定后打开时非空）：下拉禁用、不允许改选 */
  const lockedRepositoryId = ref('')
  const repositoryLocked = computed(() => lockedRepositoryId.value !== '')

  /** 反编译源码库不是 Git 仓库：只能整仓全量扫描，不读分支/commit/基线 */
  const isLocalRepository = computed(() => repository.value?.git_url.startsWith('local-test:') ?? false)
  const runCount = computed(() => (repository.value ? options.runCountOf?.(repository.value.repository_id) ?? 0 : 0))
  /** 留空时的默认目录名：get_all 的 is_default 优先，其次默认目录树自带的名称（不再前端写死） */
  const defaultRuleSetName = computed(() => {
    if (source.defaultRuleSet.value)
      return source.defaultRuleSet.value.name
    const tree = scope.ruleTree.value
    return !ruleSetId.value && tree?.rule_set_name ? tree.rule_set_name : ''
  })
  const ruleSetPlaceholder = computed(() => (defaultRuleSetName.value ? `默认：${defaultRuleSetName.value}` : '默认目录'))

  function resetState() {
    source.resetSource()
    unified.resetUnified()
    scope.resetRuleScope()
  }

  /** 仓库确定后加载分支/commit/预览（本地仓没有 Git 维度，只要规则目录） */
  async function loadForRepository() {
    if (!repository.value || isLocalRepository.value)
      return
    await source.loadBranches(false)
    await Promise.all([
      source.loadCommits(branch.value),
      unified.loadUnifiedPreview(repository.value.repository_id, branch.value),
    ])
  }

  /** 打开弹窗：opts.repositoryId 为默认仓库（运行页当前筛选 / 资产详情的仓库） */
  async function open(opts: NewScanOpenOptions = {}) {
    const keptId = repository.value?.repository_id
    resetState()
    lockedRepositoryId.value = ''
    visible.value = true
    await source.ensureRepoOptions()
    // 默认仓库：显式传入 → 上次选过且仍在列表 → 列表第一项
    const hit = source.repoOptions.value.find(item => item.repository_id === opts.repositoryId)
    const kept = source.repoOptions.value.find(item => item.repository_id === keptId)
    repository.value = hit ?? kept ?? source.repoOptions.value[0]
    // 树选中仓库后打开（lockRepository）时锁死选择；仓库不在列表里则不锁，退回可自由选择
    if (opts.lockRepository && hit)
      lockedRepositoryId.value = hit.repository_id
    // 规则目录选项懒加载；失败不阻断弹窗，留空仍走平台默认
    await source.ensureRuleSets()
    await loadForRepository()
  }

  /** 换仓库：入参是下拉选中值（repository_id 字符串，避免对象做 select value 的引用相等问题） */
  async function onRepositoryChange(repositoryId: unknown) {
    if (repositoryLocked.value)
      return
    if (typeof repositoryId !== 'string' || !repositoryId || repositoryId === repository.value?.repository_id)
      return
    const hit = source.repoOptions.value.find(item => item.repository_id === repositoryId)
    if (!hit)
      return
    resetState()
    repository.value = hit
    await loadForRepository()
  }

  /** 换分支：commit 列表与基线（按 仓库+分支 取）都要重查 */
  async function onBranchChange(value: unknown) {
    if (typeof value !== 'string' || !repository.value)
      return
    await Promise.all([
      source.loadCommits(value),
      unified.loadUnifiedPreview(repository.value.repository_id, value),
    ])
  }

  /** 显式刷新分支（git fetch）；当前分支消失被切到默认分支时联动重载 */
  async function refreshBranches() {
    if (await source.refreshBranches())
      await onBranchChange(branch.value)
  }

  async function onRuleSetChange() {
    await scope.onRuleSetChanged(ruleSetId.value)
  }

  async function onRuleScopeModeChange(value: unknown) {
    const mode: RuleScopeMode | null = value === 'all' || value === 'custom' ? value : null
    if (!mode)
      return
    scope.ruleScopeMode.value = mode
    if (mode === 'custom')
      await scope.ensureRuleTree(ruleSetId.value)
  }

  async function acceptCreated(runId: string, message: string) {
    visible.value = false
    Message.success(message)
    await options.onCreated?.(runId)
  }

  /** 组装统一触发请求体；校验不过返回 null（已提示） */
  function buildUnifiedBody(repositoryId: string): UnifiedTriggerRequest | null {
    const targetCommit = commit.value.trim()
    if (targetCommit && !isCommitSha(targetCommit)) {
      Message.warning('目标 Commit SHA 须为 7~40 位十六进制字符')
      return null
    }
    const body: UnifiedTriggerRequest = { repository_id: repositoryId, force: false, strategy: unified.strategy.value }
    if (ruleSetId.value)
      body.rule_set_id = ruleSetId.value
    if (branch.value)
      body.branch = branch.value
    if (targetCommit)
      body.target_commit = targetCommit
    const rulePayload = scope.buildRuleScopePayload()
    if (rulePayload) {
      if (rulePayload.scan_point_ids.length === 0 && rulePayload.rule_version_ids.length === 0) {
        Message.warning('「自选」规则范围至少要勾选一个扫描点或一条规则')
        return null
      }
      if (rulePayload.scan_point_ids.length)
        body.scan_point_ids = rulePayload.scan_point_ids
      if (rulePayload.rule_version_ids.length)
        body.rule_version_ids = rulePayload.rule_version_ids
    }
    return body
  }

  /** 统一扫描提交：预览阻断时不发请求（按钮已禁用，这里兜底） */
  async function submitUnified() {
    const repo = repository.value
    if (!repo || !unified.unifiedCanSubmit.value)
      return
    const body = buildUnifiedBody(repo.repository_id)
    if (!body)
      return
    const result = await unified.submitUnifiedTrigger(body)
    if (result)
      await acceptCreated(result.run_id, unifiedCreatedMessage(result))
  }

  /** 反编译源码库：整仓全量（没有可预览的冻结计划，直接触发） */
  async function submitLocalFull() {
    const repo = repository.value
    if (!repo)
      return
    executingFull.value = true
    try {
      const result = await triggerFull({
        repository_id: repo.repository_id,
        scan_mode: 'full',
        rule_set_id: ruleSetId.value || undefined,
        force: false,
      })
      if (result)
        await acceptCreated(result.run_id, '已启动反编译源码全量扫描')
    }
    finally {
      executingFull.value = false
    }
  }

  return {
    ...source,
    ...unified,
    ...scope,
    visible,
    open,
    repositoryLocked,
    isLocalRepository,
    runCount,
    defaultRuleSetName,
    ruleSetPlaceholder,
    executingFull,
    onRepositoryChange,
    onBranchChange,
    refreshBranches,
    onRuleSetChange,
    onRuleScopeModeChange,
    submitUnified,
    submitLocalFull,
  }
}

/** 组件树里共享的上下文类型：reactive() 包一层，模板里直接当普通值用 */
export type NewScanContext = UnwrapNestedRefs<ReturnType<typeof useNewScan>>

export const NEW_SCAN_KEY: InjectionKey<NewScanContext> = Symbol('sechub:new-scan')

/** 子组件取新建扫描上下文；必须在 NewScanModal 的 provide 树内调用 */
export function useNewScanContext(): NewScanContext {
  const ctx = inject(NEW_SCAN_KEY)
  if (!ctx)
    throw new Error('useNewScanContext 必须在 NewScanModal 内使用')
  return ctx
}
