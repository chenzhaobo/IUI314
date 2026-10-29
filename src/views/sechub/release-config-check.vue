<script setup lang="ts">
/**
 * 发版质量 → 配置检查（菜单 sys_menu.component = 'sechub/release-config-check'）。
 *
 * 页面只做组装：页头 + 汇总卡 + 概览（规则 / 项目组）+ 明细面板 + 变更记录 / 加白弹窗。
 * 取数、筛选、手动检查、缺陷草稿与加白在 `useConfigCheck`。
 */
import type { WaiverFormInput } from './composables/configCheckRules'
import type { ConfigItem } from '@/types/sechub-release'
import { computed, onMounted, ref } from 'vue'

import { formatTime } from '@/hooks'
import ConfigEventsDrawer from './components/release/config/ConfigEventsDrawer.vue'
import ConfigItemPanel from './components/release/config/ConfigItemPanel.vue'
import ConfigOverview from './components/release/config/ConfigOverview.vue'
import ConfigToolbar from './components/release/config/ConfigToolbar.vue'
import ConfigTotalsBar from './components/release/config/ConfigTotalsBar.vue'
import ConfigWaiverModal from './components/release/config/ConfigWaiverModal.vue'
import { useConfigCheck } from './composables/useConfigCheck'

// 组件名必须与路由 name（= sys_menu.path）一致，keep-alive :include 按它对上缓存
// eslint-disable-next-line vue/component-definition-name-casing
defineOptions({ name: 'release-config-check' })

const {
  iterations,
  iterationId,
  scope,
  family,
  summaryLoading,
  itemsLoading,
  running,
  defectLoading,
  defectCreated,
  events,
  eventsLoading,
  filters,
  ruleDefs,
  ruleStats,
  groupStats,
  totals,
  lastScanAt,
  productDomains,
  list,
  pagination,
  canCreateDefect,
  init,
  handleIterationChange,
  handleScopeChange,
  handleFamilyChange,
  selectRule,
  selectGroup,
  handleSearch,
  handleReset,
  handlePageChange,
  handlePageSizeChange,
  runCheck,
  createDefect,
  submitWaiver,
  loadEvents,
} = useConfigCheck()

const eventsVisible = ref(false)
const waiverVisible = ref(false)
const waiverLoading = ref(false)
const currentItem = ref<ConfigItem | null>(null)

const lastScanText = computed(() => (lastScanAt.value ? formatTime(lastScanAt.value) : '尚未检查'))
const selectedHint = computed(() => {
  const parts: string[] = []
  if (filters.ruleCode)
    parts.push(`规则 ${filters.ruleCode}`)
  if (filters.projectGroup)
    parts.push(`项目组 ${filters.projectGroup}`)
  return parts.join(' · ')
})

function openEvents(item: ConfigItem) {
  currentItem.value = item
  eventsVisible.value = true
  void loadEvents(item.id)
}

function openWaiver(item: ConfigItem) {
  currentItem.value = item
  waiverVisible.value = true
}

async function confirmWaiver(form: WaiverFormInput) {
  if (!currentItem.value)
    return
  waiverLoading.value = true
  try {
    const ok = await submitWaiver(currentItem.value, form)
    if (ok)
      waiverVisible.value = false
  }
  finally {
    waiverLoading.value = false
  }
}

onMounted(() => {
  void init()
})
</script>

<template>
  <div class="release-config-check">
    <ConfigToolbar
      v-model:iteration-id="iterationId"
      v-model:scope="scope"
      v-model:family="family"
      :iterations="iterations"
      :last-scan-text="lastScanText"
      :product-domains="productDomains"
      :running="running"
      @family-change="handleFamilyChange"
      @iteration-change="handleIterationChange"
      @run="runCheck"
      @scope-change="handleScopeChange"
    />
    <ConfigTotalsBar :totals="totals" />
    <ConfigOverview
      :active-group="filters.projectGroup"
      :active-rule="filters.ruleCode"
      :can-create-defect="canCreateDefect"
      :defect-created="defectCreated"
      :defect-loading="defectLoading"
      :defs="ruleDefs"
      :group-stats="groupStats"
      :loading="summaryLoading"
      :rule-stats="ruleStats"
      :selected-hint="selectedHint"
      @create-defect="createDefect"
      @select-group="selectGroup"
      @select-rule="selectRule"
    />
    <ConfigItemPanel
      v-model:keyword="filters.keyword"
      v-model:new-only="filters.newOnly"
      v-model:severity="filters.severity"
      v-model:state="filters.state"
      :list="list"
      :loading="itemsLoading"
      :pagination="pagination"
      :total="pagination.total"
      @add-waiver="openWaiver"
      @page-change="handlePageChange"
      @page-size-change="handlePageSizeChange"
      @reset="handleReset"
      @search="handleSearch"
      @view-events="openEvents"
    />

    <ConfigEventsDrawer
      v-model:visible="eventsVisible"
      :events="events"
      :item="currentItem"
      :loading="eventsLoading"
    />
    <ConfigWaiverModal
      v-model:visible="waiverVisible"
      :item="currentItem"
      :loading="waiverLoading"
      @submit="confirmWaiver"
    />
  </div>
</template>

<style scoped>
.release-config-check {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
