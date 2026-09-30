/**
 * 「新建扫描」状态机（迁自 scan-dashboard.vue 的预扫描弹窗，SD 467-1108）。
 *
 * 与原实现的两处关键差异，都是把"看板耦合"改成参数：
 * 1. 仓库不再来自看板左树，而是弹窗内的仓库下拉（含未绑定模块的本地仓，否则反编译源码库选不到）；
 *    打开时用 `open({ repositoryId })` 指定默认仓库。
 * 2. run 建立后不再刷新看板自身（`currentRunId/startPolling/refreshStatus`），改为回调 `onCreated(runId)`。
 *
 * 请求载荷与原实现逐字段一致（含空值走 undefined、JSON 序列化时整键消失的行为），见 confirmScope/triggerDirect。
 * "扫描来源"（仓库/分支/commit/规则目录/基线）在 ./useScanSource，"范围与资产"在 ./useScanTarget，这里组合并实现差量向导与触发。
 */
import type { InjectionKey, UnwrapNestedRefs } from 'vue'
import type { DeltaPlanPreview, DeltaPreviewRequest, DeltaScanMode, DiffGranularity, NewScanOpenOptions, ScanScope } from './types'
import { Message } from '@arco-design/web-vue'
import { computed, inject, ref } from 'vue'
import { buildAutoCloseAlert, buildDeltaPreviewRows, isCommitSha } from './labels'
import { executeDelta, previewDelta, triggerDomain, triggerFull } from './service'
import { useScanSource } from './useScanSource'
import { useScanTarget } from './useScanTarget'

export interface UseNewScanOptions {
  /** 「该应用已有 N 条扫描记录」幂等提示的计数来源（运行页按其列表按 repository_id 统计） */
  runCountOf?: (repositoryId: string) => number
  /** run 建立后的回调：运行页用它刷新运行列表 */
  onCreated?: (runId: string) => void | Promise<void>
}

export function useNewScan(options: UseNewScanOptions = {}) {
  const source = useScanSource()
  const target = useScanTarget()
  const { repository, branch, commit, ruleSetId, loadBranches, loadCommits, loadBaseline, resetSource } = source
  const { scanTargetType, selectedAssetIds, includeAmbiguous, isDomainTarget } = target

  const visible = ref(false)
  /** 被锁定仓库的 id（左侧应用范围树选定后打开时非空）：下拉禁用、不允许改选 */
  const lockedRepositoryId = ref('')
  const repositoryLocked = computed(() => lockedRepositoryId.value !== '')

  // ── 差量向导 ──
  const scanScope = ref<ScanScope>('diff_last')
  const baseCommitInput = ref('')
  /** 见 types.DiffGranularity：当前"设了不发"，保持原样 */
  const diffGranularity = ref<DiffGranularity>('file')
  const deltaScanMode = ref<DeltaScanMode>('auto_delta')
  const deltaPreview = ref<DeltaPlanPreview | null>(null)
  const previewingDelta = ref(false)
  const executingDelta = ref(false)
  /** 向导步骤：0=选择范围与策略，1=核对计划并执行 */
  const step = ref(0)
  /** 上一次预览对应的请求指纹（输入未变时本地复用，少一次往返） */
  let previewRequestKey = ''

  // ── 派生状态 ──
  /** 反编译源码库不是 Git 仓库：只能全量扫描，不读分支/commit/基线 */
  const isLocalRepository = computed(() => repository.value?.git_url.startsWith('local-test:') ?? false)
  const isDeltaWizard = computed(() => !isDomainTarget.value && !isLocalRepository.value)
  const runCount = computed(() => (repository.value ? options.runCountOf?.(repository.value.repository_id) ?? 0 : 0))
  const previewRows = computed(() => (deltaPreview.value ? buildDeltaPreviewRows(deltaPreview.value, source.ruleSetLabelText.value) : []))
  const autoCloseAlert = computed(() => buildAutoCloseAlert(deltaPreview.value))

  async function onScanTargetChange() {
    await target.onScanTargetChange(repository.value?.repository_id)
    deltaPreview.value = null
  }

  // ── 打开 / 复位 ──
  function resetState() {
    resetSource()
    target.resetTarget()
    lockedRepositoryId.value = ''
    scanScope.value = 'diff_last'
    deltaPreview.value = null
    step.value = 0
    previewRequestKey = ''
    baseCommitInput.value = ''
    diffGranularity.value = 'file'
  }

  /** 仓库确定后加载分支/commit/基线/资产。这些都要看仓库类型（本地仓没有 Git 维度），不能与复位同批 */
  async function loadForRepository(assetIds?: string[]) {
    deltaScanMode.value = isLocalRepository.value ? 'full_baseline' : 'auto_delta'
    if (isDomainTarget.value) {
      await target.loadDomainAssets(repository.value?.repository_id)
      if (assetIds?.length)
        target.applyPrefilledAssets(assetIds)
    }
    if (!repository.value || isLocalRepository.value)
      return
    await loadBranches(false)
    if (branch.value)
      await loadCommits(branch.value)
    if (isDeltaWizard.value)
      await loadBaseline()
  }

  /** 打开弹窗：opts.repositoryId 为默认仓库（运行页当前筛选 / 资产详情的仓库） */
  async function open(opts: NewScanOpenOptions = {}) {
    resetState()
    visible.value = true
    await source.ensureRepoOptions()
    // 默认仓库：显式传入 → 上次选过且仍在列表 → 列表第一项
    const hit = source.repoOptions.value.find(item => item.repository_id === opts.repositoryId)
    const kept = source.repoOptions.value.find(item => item.repository_id === repository.value?.repository_id)
    repository.value = hit ?? kept ?? source.repoOptions.value[0]
    // 树选中仓库后打开（lockRepository）时锁死选择；仓库不在列表里则不锁，退回可自由选择
    if (opts.lockRepository && hit)
      lockedRepositoryId.value = hit.repository_id
    if (opts.scanTargetType)
      scanTargetType.value = opts.scanTargetType
    // 规则目录选项懒加载；失败不阻断弹窗，留空仍走平台默认
    await source.ensureRuleSets()
    await loadForRepository(opts.assetIds)
  }

  /**
   * 换仓库：分支/commit/基线/资产都与仓库绑定，整体复位后重载。
   * 入参是下拉的选中值（repository_id 字符串）：避免用对象做 select value，
   * 对象比较依赖引用相等，reactive 包装后容易选不中。
   */
  async function onRepositoryChange(repositoryId: unknown) {
    // 锁定状态（下拉已禁用）下不改选，防御性兜底
    if (repositoryLocked.value)
      return
    if (typeof repositoryId !== 'string' || !repositoryId || repositoryId === repository.value?.repository_id)
      return
    const hit = source.repoOptions.value.find(item => item.repository_id === repositoryId)
    if (!hit)
      return
    repository.value = hit
    resetState()
    await loadForRepository()
  }

  // ── 触发 ──
  /** run 已建立：关弹窗 + 提示 + 通知调用方（原来是刷新看板自身并开始轮询） */
  async function acceptCreated(runId: string, message: string) {
    visible.value = false
    Message.success(message)
    await options.onCreated?.(runId)
  }

  /** 领域资产 / 反编译源码库：没有可预览的冻结计划，直接触发 */
  async function triggerDirect() {
    const repo = repository.value
    if (!repo)
      return
    if (scanTargetType.value !== 'repository') {
      if (selectedAssetIds.value.length === 0) {
        Message.warning(`请至少选择一个${scanTargetType.value === 'form' ? '表单' : '微服务'}资产`)
        return
      }
      const result = await triggerDomain({
        scope_type: scanTargetType.value,
        asset_ids: selectedAssetIds.value,
        include_ambiguous: includeAmbiguous.value,
      })
      if (result)
        await acceptCreated(result.run_id, '已冻结领域资产范围并启动扫描')
      return
    }
    const result = await triggerFull({
      repository_id: repo.repository_id,
      scan_mode: 'full',
      rule_set_id: ruleSetId.value || undefined,
      force: false,
    })
    if (result)
      await acceptCreated(result.run_id, '已启动反编译源码全量扫描')
  }

  /** 向导「下一步」：领域/本地仓直接执行；git 仓生成差量计划预览（forceRegenerate=true 等价「重新生成计划」） */
  async function confirmScope(forceRegenerate = false) {
    const repo = repository.value
    if (!repo)
      return
    if (isDomainTarget.value || isLocalRepository.value) {
      executingDelta.value = true
      try {
        await triggerDirect()
      }
      finally {
        executingDelta.value = false
      }
      return
    }
    if (scanScope.value === 'diff_commit') {
      const value = baseCommitInput.value.trim()
      if (!value || !isCommitSha(value)) {
        Message.warning('基准 Commit SHA 须为 7~40 位十六进制字符')
        return
      }
    }
    if (commit.value && !isCommitSha(commit.value.trim())) {
      Message.warning('目标 Commit SHA 须为 7~40 位十六进制字符')
      return
    }
    // force=true：跳过复用，按当前输入重新生成计划（命令行里改了代码后想换计划时用）
    const body: DeltaPreviewRequest = {
      repository_id: repo.repository_id,
      requested_delta_kind: deltaScanMode.value,
      // 空即平台默认目录（安全 + 性能合并目录）；单独扫某个域时才传显式目录
      rule_set_id: ruleSetId.value || undefined,
      branch: branch.value || undefined,
      commit_sha: commit.value || undefined,
      scan_mode: deltaScanMode.value === 'full_baseline' ? 'full' : 'diff',
      base_commit: scanScope.value === 'diff_commit' ? baseCommitInput.value.trim() : undefined,
      diff_granularity: deltaScanMode.value === 'hunk_quick' ? 'hunk' : 'file',
      force: forceRegenerate,
    }
    // 输入未变时重复点「下一步」直接复用上一次预览结果（后端也会按输入规格复用未冻结计划，
    // 这里只是少一次往返）
    const requestKey = JSON.stringify({ ...body, force: false })
    if (!forceRegenerate && deltaPreview.value && previewRequestKey === requestKey) {
      step.value = 1
      return
    }
    previewingDelta.value = true
    deltaPreview.value = null
    try {
      const preview = await previewDelta(body)
      if (preview) {
        deltaPreview.value = preview
        // 强制重新生成过就不缓存：下次点「下一步」应重新取（否则会一直用旧结果）
        previewRequestKey = forceRegenerate ? '' : requestKey
        step.value = 1
        if (preview.reused)
          Message.info('输入与已有计划一致，已复用那条未执行计划（要按当前代码重新生成点「重新生成计划」）')
        else
          Message.success('差量计划已生成，请核对估算与关闭资格后确认执行')
      }
    }
    finally {
      previewingDelta.value = false
    }
  }

  /** 用户要求不复用、按当前输入重新生成计划 */
  async function regeneratePreview() {
    await confirmScope(true)
  }

  /** 按冻结计划启动扫描 */
  async function executePreview() {
    const preview = deltaPreview.value
    if (!preview)
      return
    executingDelta.value = true
    try {
      const result = await executeDelta(preview.plan_id)
      if (!result)
        return
      await acceptCreated(result.run_id, '已按冻结计划启动扫描；AI 仅确认 cache miss')
    }
    finally {
      executingDelta.value = false
    }
  }

  return {
    // 扫描来源（仓库/分支/commit/规则目录/基线）
    ...source,
    // 扫描范围与资产
    ...target,
    // 弹窗与差量向导
    visible,
    open,
    onRepositoryChange,
    repositoryLocked,
    onScanTargetChange,
    isLocalRepository,
    isDeltaWizard,
    runCount,
    scanScope,
    baseCommitInput,
    diffGranularity,
    deltaScanMode,
    deltaPreview,
    previewingDelta,
    executingDelta,
    step,
    previewRows,
    autoCloseAlert,
    regeneratePreview,
    executePreview,
    confirmScope,
  }
}

/** 组件树里共享的上下文类型：reactive() 包一层，模板里直接当普通值用 */
export type NewScanContext = UnwrapNestedRefs<ReturnType<typeof useNewScan>>

export const NEW_SCAN_KEY: InjectionKey<NewScanContext> = Symbol('sechub:new-scan')

/** 步骤组件取新建扫描上下文；必须在 NewScanModal 的 provide 树内调用 */
export function useNewScanContext(): NewScanContext {
  const ctx = inject(NEW_SCAN_KEY)
  if (!ctx)
    throw new Error('useNewScanContext 必须在 NewScanModal 内使用')
  return ctx
}
