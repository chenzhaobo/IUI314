import type { RepoOption } from './types'
/**
 * 「新建扫描」的扫描来源（仓库下拉 / 分支 / commit / 规则目录 / 差量基线）。
 *
 * 与 useNewScan 拆开只为控制单文件规模（SC-003 ≤300 行）：这批状态全部由
 * "当前仓库"派生，与"扫什么范围、怎么扫"（差量向导）无关，边界清楚。
 */
import type { RepositoryBranch, RepositoryCommit, RuleSet, ScanBaselineView } from '@/types/static-scan'
import { Message } from '@arco-design/web-vue'
import { computed, ref } from 'vue'
import { ruleSetLabel } from './labels'
import { adoptBaseline, fetchBaseline, fetchBranches, fetchCommits, fetchRepositories, fetchRuleSets } from './service'

export function useScanSource() {
  const repoOptions = ref<RepoOption[]>([])
  const repoLoading = ref(false)
  const repository = ref<RepoOption>()
  let repoRequested = false

  const branches = ref<RepositoryBranch[]>([])
  const branch = ref('')
  const commit = ref('')
  const commits = ref<RepositoryCommit[]>([])
  const baseCommits = ref<RepositoryCommit[]>([])
  const loadingBranches = ref(false)
  const refreshingBranches = ref(false)
  const loadingCommits = ref(false)
  /** 请求序号：防止慢响应覆盖最新选择 */
  let commitSeq = 0

  // 规则目录：空 = 平台默认目录（perf_config 配置，当前为「安全 + 性能合并目录」，
  // 一次完整基线同时覆盖两个域）；要单独扫某个域时才显式指定对应目录。
  const ruleSetId = ref('')
  const ruleSets = ref<RuleSet[]>([])
  let ruleSetsRequested = false

  /** 当前比较域（仓库 + 分支）内的 active 基线 */
  const baseline = ref<ScanBaselineView | null>(null)
  const baselineLoading = ref(false)
  const baselineAdopting = ref(false)

  const ruleSetLabelText = computed(() => {
    const hit = ruleSets.value.find(item => item.id === ruleSetId.value)
    return hit ? ruleSetLabel(hit) : '平台默认（安全目录）'
  })

  /** 仓库下拉（含未绑定模块的本地仓，否则反编译源码库选不到） */
  async function ensureRepoOptions() {
    if (repoRequested)
      return
    repoRequested = true
    repoLoading.value = true
    try {
      repoOptions.value = await fetchRepositories() ?? []
    }
    finally {
      repoLoading.value = false
    }
  }

  /** 分支列表。默认走缓存（快路径）；refresh=true 会真的 git fetch（慢） */
  async function loadBranches(refresh: boolean) {
    const repo = repository.value
    if (!repo)
      return
    const res = await fetchBranches(repo, refresh)
    if (res?.result === 'cached') {
      branches.value = res.data.branches
      // 优先选中 is_default 为 true 的分支，否则退回仓库记录的 default_branch
      const def = branches.value.find(b => b.is_default)
      branch.value = def?.name ?? repo.default_branch ?? ''
    }
    else {
      // 队列模式（缓存未命中）或失败：回退到仓库默认分支
      branch.value = repo.default_branch ?? ''
    }
  }

  /** 显式刷新分支：点击刷新按钮才用 refresh=true 真正 git fetch */
  async function refreshBranches() {
    const repo = repository.value
    if (!repo)
      return
    refreshingBranches.value = true
    try {
      const res = await fetchBranches(repo, true)
      if (!res) {
        Message.warning('刷新分支失败')
        return
      }
      if (res.result === 'cached') {
        branches.value = res.data.branches
        // 刷新后保持当前选中分支（如果刷新后仍存在），否则选默认分支
        const stillExists = branches.value.some(b => b.name === branch.value)
        if (!stillExists) {
          const def = branches.value.find(b => b.is_default)
          branch.value = def?.name ?? repo.default_branch ?? ''
          if (branch.value)
            await loadCommits(branch.value)
        }
      }
    }
    finally {
      refreshingBranches.value = false
    }
  }

  /** 加载指定分支的 commit 列表；用请求序号防止乱序覆盖 */
  async function loadCommits(target: string) {
    const repo = repository.value
    if (!repo || !target) {
      commits.value = []
      baseCommits.value = []
      return
    }
    const seq = ++commitSeq
    loadingCommits.value = true
    try {
      const res = await fetchCommits(repo, target)
      // 旧响应丢弃，防止慢响应覆盖最新分支的选择
      if (seq !== commitSeq)
        return
      const list = res?.list ?? []
      commits.value = list
      baseCommits.value = list
      // 默认选中该分支最新一条 commit
      commit.value = list.length > 0 ? list[0].sha : ''
    }
    finally {
      if (seq === commitSeq)
        loadingCommits.value = false
    }
  }

  async function onBranchChange(value: unknown) {
    if (typeof value !== 'string' && typeof value !== 'number')
      return
    // 切换分支必须重新加载 commit 列表，不允许残留上一分支的 commit
    await loadCommits(String(value))
    // 差量基线按「仓库 + 分支」比较域隔离，换分支要重新查
    await loadBaseline()
  }

  /** 规则目录选项懒加载一次；失败即空列表，留空仍走平台默认，不阻断弹窗 */
  async function ensureRuleSets() {
    if (ruleSetsRequested)
      return
    ruleSetsRequested = true
    ruleSets.value = await fetchRuleSets()
  }

  async function loadBaseline() {
    const repo = repository.value
    if (!repo || !branch.value) {
      baseline.value = null
      return
    }
    baselineLoading.value = true
    try {
      baseline.value = await fetchBaseline(repo.repository_id, branch.value)
    }
    finally {
      baselineLoading.value = false
    }
  }

  /** 采纳最近一个合格的扫描为基线（完整扫描收尾后平台也会自动采纳，这里是人工兜底） */
  async function adoptCurrentBaseline() {
    const repo = repository.value
    if (!repo || !branch.value)
      return
    baselineAdopting.value = true
    try {
      const res = await adoptBaseline(repo.repository_id, branch.value)
      if (!res)
        return
      Message.success(res.message)
      await loadBaseline()
    }
    finally {
      baselineAdopting.value = false
    }
  }

  /** 复位到"未选仓库"：换仓库与重新打开弹窗都要先清来源 */
  function resetSource() {
    branch.value = ''
    commit.value = ''
    branches.value = []
    commits.value = []
    baseCommits.value = []
    ruleSetId.value = ''
    baseline.value = null
  }

  return {
    repoOptions,
    repoLoading,
    repository,
    ensureRepoOptions,
    branches,
    branch,
    commit,
    commits,
    baseCommits,
    loadingBranches,
    refreshingBranches,
    loadingCommits,
    refreshBranches,
    loadBranches,
    loadCommits,
    onBranchChange,
    ruleSetId,
    ruleSets,
    ruleSetLabelText,
    ensureRuleSets,
    baseline,
    baselineLoading,
    baselineAdopting,
    loadBaseline,
    adoptCurrentBaseline,
    resetSource,
  }
}
