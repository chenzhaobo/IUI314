/**
 * 「配置检查」页组合根：范围（ReleaseScopeBar + 左树）→ 汇总 → 右栏明细 → 动作。
 *
 * 取数按关注点拆在 `useConfigCheckSummary`（汇总 / 规则 / 项目组分布）、
 * `useConfigCheckItems`（明细筛选 / 分页）、`useConfigCheckActions`（检查 / 缺陷 / 加白 / 历史）；
 * 本模块负责串联、左树接线与「范围变化 → 回第 1 页重新取数」。
 */
import type { TreeModeOption } from './useReleaseScopeTree'
import type { ReleaseTreeScope } from '@/types/sechub-release'
import { computed, ref, watch } from 'vue'

import { formatTime } from '@/hooks'
import { fetchConfigScopeTree } from '../services/configCheckService'
import { configItemsQueryOf } from './configCheckRules'
import { useConfigCheckActions } from './useConfigCheckActions'
import { useConfigCheckItems } from './useConfigCheckItems'
import { useConfigCheckSummary } from './useConfigCheckSummary'
import { useReleaseScope } from './useReleaseScope'

/** 左树维度：项目组默认；规则节点把 rule_code 写回明细筛选 */
const TREE_MODES: TreeModeOption[] = [
  { value: 'project_group', label: '项目组' },
  { value: 'business_area', label: '业务领域' },
  { value: 'product_domain', label: '产品领域' },
  { value: 'handler', label: '处理人' },
  { value: 'rule', label: '规则' },
]

export function useConfigCheck() {
  const scope = useReleaseScope()
  const summary = useConfigCheckSummary(scope)
  const items = useConfigCheckItems(scope)
  /** 左树实例（页面通过 ref 绑到 ReleaseScopeTree） */
  const scopeTreeRef = ref<{ reload: () => void }>()

  const lastScanText = computed(() => (summary.lastScanAt.value ? formatTime(summary.lastScanAt.value) : '尚未检查'))

  async function reloadAll() {
    await Promise.all([summary.load(), items.load()])
  }

  /** 生成缺陷 / 加白成功：明细、汇总与左树计数一起刷新 */
  async function reloadAfterAction() {
    await reloadAll()
    scopeTreeRef.value?.reload()
  }

  const actions = useConfigCheckActions(scope, summary, reloadAfterAction)

  /** 左树与明细共用一份 query；结构键 / 分页键由树组件剔除。产品领域不参与左树，口径固定为全部领域，避免选领域时树白刷一次 */
  const treeQuery = computed(() => ({
    ...configItemsQueryOf(items.filters, scope.toQuery(), items.pageNum.value, items.pageSize.value),
    scope: 'all' as const,
  }))
  /** 高亮 = 当前结构范围 + 规则（规则由明细筛选管理） */
  const treeSelectedScope = computed<ReleaseTreeScope>(() => {
    const base = scope.structuralScope.value
    return items.filters.ruleCode ? { ...base, rule_code: items.filters.ruleCode } : base
  })

  /** 左树点选：规则写回筛选、其余写回范围；统一由 version 变化刷新一次 */
  function handleTreeSelect(node: ReleaseTreeScope) {
    items.setRuleCode(node.rule_code ?? '')
    scope.applyTreeScope(node)
  }

  async function init() {
    await scope.init()
    await Promise.all([summary.load(), items.load(), items.loadFields()])
  }

  watch(scope.version, () => {
    items.resetPage()
    actions.resetBatch()
    void reloadAll()
  })

  return {
    // 范围
    scopeLoading: scope.loading,
    scopeOptions: scope.options,
    productLine: scope.productLine,
    iterationId: scope.iterationId,
    productDomain: scope.productDomain,
    businessArea: scope.businessArea,
    projectGroup: scope.projectGroup,
    appNumber: scope.appNumber,
    projectGroupLabel: scope.projectGroupLabel,
    appLabel: scope.appLabel,
    handler: scope.handler,
    mine: scope.mine,
    effectiveDomains: scope.effectiveDomains,
    summaryText: scope.summaryText,
    handleScopeChange: scope.handleChange,
    toggleMine: scope.toggleMine,
    // 左树
    scopeTreeRef,
    treeFetcher: fetchConfigScopeTree,
    treeModes: TREE_MODES,
    treeQuery,
    treeSelectedScope,
    handleTreeSelect,
    // 汇总 / 规则 / 项目组分布
    totals: summary.totals,
    ruleRows: summary.ruleRows,
    ruleRowByCode: summary.ruleRowByCode,
    groupDistribution: summary.groupDistribution,
    lastScanText,
    // 明细
    itemsLoading: items.loading,
    fieldDefs: items.fieldDefs,
    filters: items.filters,
    list: items.list,
    total: items.total,
    pagination: items.pagination,
    activeSummaryCell: items.activeSummaryCell,
    handleSummarySelect: items.handleSummarySelect,
    handleSearch: items.handleSearch,
    handleReset: items.handleReset,
    handlePageChange: items.handlePageChange,
    handlePageSizeChange: items.handlePageSizeChange,
    // 动作
    family: actions.family,
    running: actions.running,
    rowDefectLoadingId: actions.rowDefectLoadingId,
    batchVisible: actions.batchVisible,
    batchRule: actions.batchRule,
    batchLoading: actions.batchLoading,
    batchResult: actions.batchResult,
    waiverVisible: actions.waiverVisible,
    waiverItem: actions.waiverItem,
    waiverLoading: actions.waiverLoading,
    eventsVisible: actions.eventsVisible,
    eventsItem: actions.eventsItem,
    events: actions.events,
    eventsLoading: actions.eventsLoading,
    runCheck: actions.runCheck,
    createRowDefect: actions.createRowDefect,
    openDefect: actions.openDefect,
    openBatchDefect: actions.openBatchDefect,
    submitBatchDefect: actions.submitBatchDefect,
    openWaiver: actions.openWaiver,
    submitWaiver: actions.submitWaiver,
    openEvents: actions.openEvents,
    init,
  }
}
