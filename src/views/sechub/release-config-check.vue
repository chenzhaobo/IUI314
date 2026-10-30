<script setup lang="ts">
/**
 * 发版质量 → 配置检查（菜单 sys_menu.component = 'sechub/release-config-check'）。
 *
 * 布局：范围筛选 + 手动检查 → 汇总条 → 左栏规则列表 / 右栏明细；
 * 项目组只是范围条件（ReleaseScopeBar），右下「按项目组分布」点击写回范围，不是第二重过滤。
 * 取数按关注点拆在 useConfigCheckSummary / Items / Actions，本页只组装。
 */
import type { WaiverFormInput } from './composables/configCheckRules'
import { onMounted } from 'vue'

import ConfigBatchDefectModal from './components/release/config/ConfigBatchDefectModal.vue'
import ConfigEventsDrawer from './components/release/config/ConfigEventsDrawer.vue'
import ConfigItemPanel from './components/release/config/ConfigItemPanel.vue'
import ConfigRuleList from './components/release/config/ConfigRuleList.vue'
import ConfigToolbar from './components/release/config/ConfigToolbar.vue'
import ConfigTotalsBar from './components/release/config/ConfigTotalsBar.vue'
import ConfigWaiverModal from './components/release/config/ConfigWaiverModal.vue'
import ReleaseScopeBar from './components/release/ReleaseScopeBar.vue'
import { useConfigCheck } from './composables/useConfigCheck'

// 组件名必须与路由 name（= sys_menu.path）一致，keep-alive :include 按它对上缓存
// eslint-disable-next-line vue/component-definition-name-casing
defineOptions({ name: 'release-config-check' })

const {
  scopeLoading,
  scopeOptions,
  productLine,
  iterationId,
  productDomain,
  businessArea,
  projectGroup,
  effectiveDomains,
  summaryText,
  handleScopeChange,
  selectGroup,
  summaryLoading,
  totals,
  ruleRowByCode,
  ruleGroups,
  groupDistribution,
  lastScanText,
  itemsLoading,
  fieldDefs,
  filters,
  list,
  pagination,
  activeSummaryCell,
  selectRule,
  handleSummarySelect,
  handleSearch,
  handleReset,
  handlePageChange,
  handlePageSizeChange,
  family,
  running,
  rowDefectLoadingId,
  batchVisible,
  batchRule,
  batchLoading,
  batchResult,
  waiverVisible,
  waiverItem,
  waiverLoading,
  eventsVisible,
  eventsItem,
  events,
  eventsLoading,
  runCheck,
  createRowDefect,
  openDefect,
  openBatchDefect,
  submitBatchDefect,
  openWaiver,
  submitWaiver,
  openEvents,
  init,
} = useConfigCheck()

function handleGenerateBatch() {
  const row = ruleRowByCode.value[filters.ruleCode]
  if (row)
    openBatchDefect(row)
}

async function handleWaiverSubmit(form: WaiverFormInput) {
  if (!waiverItem.value)
    return
  await submitWaiver(waiverItem.value, form)
}

onMounted(() => {
  void init()
})
</script>

<template>
  <div class="release-config-check">
    <div class="top-row">
      <ReleaseScopeBar
        class="scope-bar"
        :business-area="businessArea"
        :effective-domains="effectiveDomains"
        :iteration-id="iterationId"
        :loading="scopeLoading"
        :options="scopeOptions"
        :product-domain="productDomain"
        :product-line="productLine"
        :project-group="projectGroup"
        :summary-text="summaryText"
        @change="handleScopeChange"
      />
      <ConfigToolbar
        v-model:family="family"
        :last-scan-text="lastScanText"
        :running="running"
        @run="runCheck"
      />
    </div>

    <ConfigTotalsBar
      :active="activeSummaryCell"
      :totals="totals"
      @select="handleSummarySelect"
    />

    <div class="main-row">
      <ConfigRuleList
        :active-rule="filters.ruleCode"
        :groups="ruleGroups"
        :loading="summaryLoading"
        @select="selectRule"
      />
      <ConfigItemPanel
        v-model:handling="filters.handling"
        v-model:keyword="filters.keyword"
        v-model:new-only="filters.newOnly"
        v-model:severity="filters.severity"
        :active-group="projectGroup"
        :defect-loading-id="rowDefectLoadingId"
        :field-defs="fieldDefs"
        :group-rows="groupDistribution"
        :list="list"
        :loading="itemsLoading"
        :pagination="pagination"
        :product-line="productLine"
        :selected-rule-code="filters.ruleCode"
        @add-waiver="openWaiver"
        @create-defect="createRowDefect"
        @generate-batch="handleGenerateBatch"
        @page-change="handlePageChange"
        @page-size-change="handlePageSizeChange"
        @reset="handleReset"
        @search="handleSearch"
        @select-group="selectGroup"
        @view-defect="openDefect"
        @view-events="openEvents"
      />
    </div>

    <ConfigBatchDefectModal
      v-model:visible="batchVisible"
      :groups="groupDistribution"
      :loading="batchLoading"
      :result="batchResult"
      :rule="batchRule"
      @submit="submitBatchDefect"
    />
    <ConfigEventsDrawer
      v-model:visible="eventsVisible"
      :events="events"
      :item="eventsItem"
      :loading="eventsLoading"
    />
    <ConfigWaiverModal
      v-model:visible="waiverVisible"
      :item="waiverItem"
      :loading="waiverLoading"
      @submit="handleWaiverSubmit"
    />
  </div>
</template>

<style scoped>
.release-config-check {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.top-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.scope-bar {
  min-width: 0;
  flex: 1;
}
.main-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
</style>
