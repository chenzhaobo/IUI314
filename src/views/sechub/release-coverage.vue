<script setup lang="ts">
/**
 * 发版质量 → 接口覆盖（菜单 sys_menu.component = 'sechub/release-coverage'）。
 *
 * 布局：范围筛选 → 汇总指标 → 项目组覆盖 → 接口明细（明细筛选在卡片头部）。
 * 取数、分页、勾选在 `useReleaseCoverage`，派发在 `useAgentBatchRun`。
 */
import { onMounted, ref } from 'vue'

import AgentBatchRunModal from './components/release/AgentBatchRunModal.vue'
import CoverageApiTable from './components/release/CoverageApiTable.vue'
import CoverageGroupTable from './components/release/CoverageGroupTable.vue'
import CoverageSummaryBar from './components/release/CoverageSummaryBar.vue'
import ReleaseScopeBar from './components/release/ReleaseScopeBar.vue'
import { COVERAGE_STATUS_OPTIONS, COVERAGE_TAG_OPTIONS } from './composables/releaseCoverageRules'
import { useReleaseCoverage } from './composables/useReleaseCoverage'

// 组件名必须与路由 name（= sys_menu.path）一致，keep-alive :include 按它对上缓存
// eslint-disable-next-line vue/component-definition-name-casing
defineOptions({ name: 'release-coverage' })

const {
  loading,
  scopeLoading,
  scopeOptions,
  productLine,
  iterationId,
  productDomain,
  businessArea,
  projectGroup,
  effectiveDomains,
  envUnavailable,
  summaryText,
  filters,
  list,
  groups,
  summary,
  iterationScope,
  removedTotal,
  pagination,
  pageAllSelected,
  hasPageSelectable,
  selectedCount,
  selectedKeys,
  selectedByGroup,
  selectedGroupCount,
  selectedGroupNames,
  init,
  handleSearch,
  handleReset,
  handleScopeChange,
  selectGroup,
  handlePageChange,
  handlePageSizeChange,
  toggleApi,
  togglePageSelection,
} = useReleaseCoverage()

const batchModal = ref<InstanceType<typeof AgentBatchRunModal>>()
const emptyText = '该产品线暂无测试环境，暂无发版数据'

function openBatchRun() {
  if (!selectedCount.value)
    return
  batchModal.value?.open(selectedByGroup.value, selectedGroupNames.value)
}

onMounted(() => {
  void init()
})
</script>

<template>
  <div class="release-coverage">
    <ReleaseScopeBar
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

    <a-card v-if="envUnavailable" :bordered="false">
      <a-empty :description="emptyText" />
    </a-card>

    <template v-else>
      <CoverageSummaryBar
        :iteration="iterationScope"
        :removed-total="removedTotal"
        :summary="summary"
      />

      <a-card :bordered="false">
        <div class="section-title">
          项目组覆盖（点击行按项目组筛选）
        </div>
        <CoverageGroupTable
          :active-group="projectGroup || ''"
          :groups="groups"
          @select="selectGroup"
        />
      </a-card>

      <a-card :bordered="false">
        <div class="detail-toolbar">
          <div class="section-title">
            接口明细
          </div>
          <a-space wrap :size="8">
            <a-select
              v-model="filters.status"
              :options="COVERAGE_STATUS_OPTIONS"
              allow-clear
              placeholder="覆盖状态"
              style="width: 200px"
              @change="handleSearch"
            />
            <a-select
              v-model="filters.tag"
              :options="COVERAGE_TAG_OPTIONS"
              allow-clear
              placeholder="标签"
              style="width: 150px"
              @change="handleSearch"
            />
            <a-input-search
              v-model="filters.keyword"
              allow-clear
              placeholder="接口路径 / 名称 / 应用编号"
              style="width: 260px"
              @search="handleSearch"
            />
            <a-button @click="handleReset">
              重置
            </a-button>
          </a-space>
          <a-space :size="8">
            <span class="selected-hint">
              已选 {{ selectedCount }} 个接口<template v-if="selectedGroupCount">（{{ selectedGroupCount }} 个项目组）</template>
            </span>
            <a-button
              :disabled="!selectedCount"
              type="primary"
              @click="openBatchRun"
            >
              一键测试（{{ selectedCount }}）
            </a-button>
          </a-space>
        </div>
        <CoverageApiTable
          :has-page-selectable="hasPageSelectable"
          :list="list"
          :loading="loading"
          :page-all-selected="pageAllSelected"
          :pagination="pagination"
          :selected-keys="selectedKeys"
          @page-change="handlePageChange"
          @page-size-change="handlePageSizeChange"
          @toggle="toggleApi"
          @toggle-all="togglePageSelection"
        />
      </a-card>
    </template>

    <AgentBatchRunModal ref="batchModal" />
  </div>
</template>

<style scoped>
.release-coverage {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.section-title {
  color: var(--color-text-1);
  font-size: 14px;
  font-weight: 600;
}
.detail-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}
.detail-toolbar .section-title {
  margin-right: auto;
}
.selected-hint {
  color: var(--color-text-3);
  font-size: 12px;
}
</style>
