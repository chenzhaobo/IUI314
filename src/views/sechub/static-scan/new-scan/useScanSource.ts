import type { RepoOption } from './types'
/**
 * 「新建扫描」的扫描来源（仓库下拉 / 分支 / 目标 commit / 规则目录）。
 *
 * 与 useNewScan 拆开只为控制单文件规模：这批状态全部由"当前仓库"派生，
 * 与"怎么扫"（扫描方式 / 规则范围）无关，边界清楚。
 * 20261008：旧差量基线（sec_scan_baseline）的查询/人工采纳已随旧轨移除，基线改由 unified-preview 自动给出。
 */
import type { RepositoryBranch, RepositoryCommit, RuleSet } from '@/types/static-scan'
import { Message } from '@arco-design/web-vue'
import { computed, ref } from 'vue'
import { fetchBranches, fetchCommits, fetchRepositories, fetchRuleSets } from './service'

export function useScanSource() {
  const repoOptions = ref<RepoOption[]>([])
  const repoLoading = ref(false)
  const repository = ref<RepoOption>()
  let repoRequested = false

  const branches = ref<RepositoryBranch[]>([])
  const branch = ref('')
  /** 目标 commit：空 = 分支最新（后端取该分支 HEAD） */
  const commit = ref('')
  const commits = ref<RepositoryCommit[]>([])
  const loadingBranches = ref(false)
  const refreshingBranches = ref(false)
  const loadingCommits = ref(false)
  /** 请求序号：防止慢响应覆盖最新选择 */
  let commitSeq = 0

  // 规则目录：空 = 平台默认目录（perf_config 配置，后端 get_all 用 is_default 标出）
  const ruleSetId = ref('')
  const ruleSets = ref<RuleSet[]>([])
  let ruleSetsRequested = false

  /** 平台默认目录（get_all 的 is_default；旧后端没有该字段时为 undefined） */
  const defaultRuleSet = computed(() => ruleSets.value.find(item => item.is_default))

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
    loadingBranches.value = true
    try {
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
    finally {
      loadingBranches.value = false
    }
  }

  /**
   * 显式刷新分支：点击刷新按钮才用 refresh=true 真正 git fetch。
   * 返回 true = 当前分支已不存在、已切到默认分支（调用方需重载 commit 与预览）。
   */
  async function refreshBranches(): Promise<boolean> {
    const repo = repository.value
    if (!repo)
      return false
    refreshingBranches.value = true
    try {
      const res = await fetchBranches(repo, true)
      if (!res) {
        Message.warning('刷新分支失败')
        return false
      }
      if (res.result !== 'cached')
        return false
      branches.value = res.data.branches
      // 刷新后保持当前选中分支（如果刷新后仍存在），否则选默认分支
      if (branches.value.some(b => b.name === branch.value))
        return false
      const def = branches.value.find(b => b.is_default)
      branch.value = def?.name ?? repo.default_branch ?? ''
      return true
    }
    finally {
      refreshingBranches.value = false
    }
  }

  /** 加载指定分支的 commit 列表；用请求序号防止乱序覆盖。默认留空 = 分支最新 */
  async function loadCommits(target: string) {
    const repo = repository.value
    commit.value = ''
    if (!repo || !target) {
      commits.value = []
      return
    }
    const seq = ++commitSeq
    loadingCommits.value = true
    try {
      const res = await fetchCommits(repo, target)
      // 旧响应丢弃，防止慢响应覆盖最新分支的选择
      if (seq !== commitSeq)
        return
      commits.value = res?.list ?? []
    }
    finally {
      if (seq === commitSeq)
        loadingCommits.value = false
    }
  }

  /** 规则目录选项懒加载一次；失败即空列表，留空仍走平台默认，不阻断弹窗 */
  async function ensureRuleSets() {
    if (ruleSetsRequested)
      return
    ruleSetsRequested = true
    ruleSets.value = await fetchRuleSets()
  }

  /** 复位到"未选仓库"：换仓库与重新打开弹窗都要先清来源 */
  function resetSource() {
    branch.value = ''
    commit.value = ''
    branches.value = []
    commits.value = []
    ruleSetId.value = ''
    // 作废在途的 commit 请求（其 finally 不再收 loading，这里直接收）
    commitSeq += 1
    loadingCommits.value = false
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
    loadingBranches,
    refreshingBranches,
    loadingCommits,
    refreshBranches,
    loadBranches,
    loadCommits,
    ruleSetId,
    ruleSets,
    defaultRuleSet,
    ensureRuleSets,
    resetSource,
  }
}
