/**
 * 「新建扫描」的规则范围（契约 C）：全部规则 / 自选（部分扫描）。
 *
 * 自选时按所选规则目录懒加载 rule-set-tree；换目录后树与已选全部作废（不同目录的成员不通用，
 * 选了目录外的 id 后端会报错）。纯逻辑在 ./ruleScopeTree，这里只持有状态。
 */
import type { RuleScopeMode, RuleScopePayload, RuleSetTree } from './types'
import { computed, ref, watch } from 'vue'
import { buildRuleScopeIndex, buildRuleScopeNodes, ruleScopeExpandedKeys, ruleScopePayload, ruleScopeTreeKeys, toggleRuleScopeKey } from './ruleScopeTree'
import { fetchRuleSetTree } from './service'

/** 规则树里「领域证据（表单 / 微服务）」分组的 code（与后端 DOMAIN_EVIDENCE_CATEGORY_CODE 一致） */
const DOMAIN_EVIDENCE_CATEGORY_CODE = 'domain_evidence'

/** 去掉领域证据分组；去掉后变空的域一并去掉 */
function withoutDomainEvidence(tree: RuleSetTree): RuleSetTree {
  const domains = tree.domains
    .map(domain => ({ ...domain, categories: domain.categories.filter(category => category.code !== DOMAIN_EVIDENCE_CATEGORY_CODE) }))
    .filter(domain => domain.categories.length > 0)
  return { ...tree, domains }
}

export interface UseRuleScopeOptions {
  /**
   * 是否隐藏领域证据分组。反编译源码库没有表单 / 微服务资产，整仓扫描也不执行这两个检出器，
   * 勾了会被后端拒绝，所以树里干脆不给选。按当前仓库实时判断（换仓库会重置并重新拉树）。
   */
  hideDomainEvidence?: () => boolean
}

export function useRuleScope(options: UseRuleScopeOptions = {}) {
  const ruleScopeMode = ref<RuleScopeMode>('all')
  const ruleTree = ref<RuleSetTree | null>(null)
  const loadingRuleTree = ref(false)
  const checkedRuleIds = ref<string[]>([])
  const ruleKeyword = ref('')
  const ruleExpandedKeys = ref<string[]>([])
  /** 当前树对应的目录 id（null = 还没加载过） */
  let treeRuleSetId: string | null = null
  let treeSeq = 0

  const ruleIndex = computed(() => buildRuleScopeIndex(ruleTree.value))
  const ruleTreeNodes = computed(() => buildRuleScopeNodes(ruleTree.value, ruleKeyword.value))
  const ruleTreeKeys = computed(() => ruleScopeTreeKeys(checkedRuleIds.value, ruleIndex.value))
  const selectedRuleCount = computed(() => checkedRuleIds.value.length)
  const isPartialScope = computed(() => ruleScopeMode.value === 'custom')

  // 搜索词变化时重算展开：有搜索就展开到扫描点，命中的规则直接可见
  watch(ruleKeyword, (value) => {
    ruleExpandedKeys.value = ruleScopeExpandedKeys(ruleTreeNodes.value, Boolean(value.trim()))
  })

  /** 按目录加载规则树；ruleSetId 空 = 默认目录。重载即清空已选 */
  async function loadRuleTree(ruleSetId: string) {
    const seq = ++treeSeq
    treeRuleSetId = ruleSetId
    checkedRuleIds.value = []
    ruleKeyword.value = ''
    loadingRuleTree.value = true
    try {
      const tree = await fetchRuleSetTree(ruleSetId)
      if (seq !== treeSeq)
        return
      ruleTree.value = tree && options.hideDomainEvidence?.() ? withoutDomainEvidence(tree) : tree
      ruleExpandedKeys.value = ruleScopeExpandedKeys(ruleTreeNodes.value, false)
    }
    finally {
      if (seq === treeSeq)
        loadingRuleTree.value = false
    }
  }

  /** 已是同一目录的树就不重拉（切回「自选」时用） */
  async function ensureRuleTree(ruleSetId: string) {
    if (treeRuleSetId === ruleSetId && ruleTree.value)
      return
    await loadRuleTree(ruleSetId)
  }

  /** 换规则目录：自选模式下立即重载；全部规则模式下只作废，下次切到自选再拉 */
  async function onRuleSetChanged(ruleSetId: string) {
    if (ruleScopeMode.value === 'custom') {
      await loadRuleTree(ruleSetId)
      return
    }
    treeRuleSetId = null
    ruleTree.value = null
    checkedRuleIds.value = []
  }

  /** a-tree @check：只认扫描点 / 规则两级的 key（域 / 分类节点不可勾选） */
  function onRuleCheck(key: string | number, checked: boolean) {
    checkedRuleIds.value = toggleRuleScopeKey(checkedRuleIds.value, ruleIndex.value, String(key), checked)
  }

  function clearRuleSelection() {
    checkedRuleIds.value = []
  }

  /** 自选时的提交载荷；全部规则时返回 null（请求里不带这两个键 = 全目录） */
  function buildRuleScopePayload(): RuleScopePayload | null {
    if (ruleScopeMode.value !== 'custom')
      return null
    return ruleScopePayload(checkedRuleIds.value, ruleIndex.value)
  }

  function resetRuleScope() {
    treeSeq += 1
    treeRuleSetId = null
    ruleScopeMode.value = 'all'
    ruleTree.value = null
    loadingRuleTree.value = false
    checkedRuleIds.value = []
    ruleKeyword.value = ''
    ruleExpandedKeys.value = []
  }

  return {
    ruleScopeMode,
    ruleTree,
    loadingRuleTree,
    ruleKeyword,
    ruleExpandedKeys,
    ruleIndex,
    ruleTreeNodes,
    ruleTreeKeys,
    selectedRuleCount,
    isPartialScope,
    ensureRuleTree,
    onRuleSetChanged,
    onRuleCheck,
    clearRuleSelection,
    buildRuleScopePayload,
    resetRuleScope,
  }
}
