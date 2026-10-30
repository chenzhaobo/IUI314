/**
 * 「配置检查」页组合根：范围（ReleaseScopeBar）→ 左栏规则 / 汇总 → 右栏明细 → 动作。
 *
 * 取数按关注点拆在 `useConfigCheckSummary`（汇总 / 规则 / 项目组分布）、
 * `useConfigCheckItems`（明细筛选 / 分页）、`useConfigCheckActions`（检查 / 缺陷 / 加白 / 历史）；
 * 本模块只负责串联与「范围变化 → 回第 1 页重新取数」。
 */
import { computed, watch } from 'vue'

import { formatTime } from '@/hooks'
import { useConfigCheckActions } from './useConfigCheckActions'
import { useConfigCheckItems } from './useConfigCheckItems'
import { useConfigCheckSummary } from './useConfigCheckSummary'
import { useReleaseScope } from './useReleaseScope'

export function useConfigCheck() {
  const scope = useReleaseScope()
  const summary = useConfigCheckSummary(scope)
  const items = useConfigCheckItems(scope)
  const actions = useConfigCheckActions(scope, summary, () => reloadAll())

  const lastScanText = computed(() => (summary.lastScanAt.value ? formatTime(summary.lastScanAt.value) : '尚未检查'))

  async function reloadAll() {
    await Promise.all([summary.load(), items.load()])
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
    effectiveDomains: scope.effectiveDomains,
    summaryText: scope.summaryText,
    handleScopeChange: scope.handleChange,
    selectGroup: scope.selectProjectGroup,
    // 汇总 / 规则 / 项目组分布
    summaryLoading: summary.loading,
    totals: summary.totals,
    ruleRows: summary.ruleRows,
    ruleRowByCode: summary.ruleRowByCode,
    ruleGroups: summary.ruleGroups,
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
    selectRule: items.selectRule,
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
