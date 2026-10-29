<script setup lang="ts">
/**
 * 发版质量 → 接口覆盖（菜单 sys_menu.component = 'sechub/release-coverage'）。
 *
 * 页面只做组装：筛选栏 + 指标条 + 项目组统计 + 接口明细 + 一键测试弹窗。
 * 取数、分页、勾选在 `useReleaseCoverage`，派发在 `useAgentBatchRun`。
 */
import { computed, onMounted, ref } from 'vue'

import AgentBatchRunModal from './components/release/AgentBatchRunModal.vue'
import CoverageApiTable from './components/release/CoverageApiTable.vue'
import CoverageGroupTable from './components/release/CoverageGroupTable.vue'
import CoverageSummaryBar from './components/release/CoverageSummaryBar.vue'
import { COVERAGE_STATUS_OPTIONS, COVERAGE_TAG_OPTIONS } from './composables/releaseCoverageRules'
import { useReleaseCoverage } from './composables/useReleaseCoverage'

// 组件名必须与路由 name（= sys_menu.path）一致，keep-alive :include 按它对上缓存
// eslint-disable-next-line vue/component-definition-name-casing
defineOptions({ name: 'release-coverage' })

const {
  loading,
  iterations,
  iterationId,
  filters,
  data,
  list,
  groups,
  pagination,
  selectedCount,
  selectedKeys,
  selectedByGroup,
  selectedGroupCount,
  selectedGroupNames,
  pageAllSelected,
  hasPageSelectable,
  init,
  handleSearch,
  handleReset,
  handleIterationChange,
  selectGroup,
  handlePageChange,
  handlePageSizeChange,
  toggleApi,
  togglePageSelection,
} = useReleaseCoverage()

const batchModal = ref<InstanceType<typeof AgentBatchRunModal>>()

const iterationOptions = computed(() => iterations.value.map(item => ({
  value: item.id,
  label: `${item.name}（${item.code}）`,
})))

const groupOptions = computed(() => groups.value.map(item => ({
  value: item.project_group_code,
  label: item.project_group_name || item.project_group_code,
})))

const summary = computed(() => data.value?.summary ?? null)
const iterationScope = computed(() => data.value?.iteration ?? null)
const removedTotal = computed(() => data.value?.removed_total ?? 0)

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
    <a-card :bordered="false">
      <a-space wrap>
        <a-select
          v-model="iterationId"
          :options="iterationOptions"
          placeholder="选择迭代"
          style="width: 260px"
          @change="handleIterationChange"
        />
        <a-select
          v-model="filters.projectGroup"
          :options="groupOptions"
          allow-clear
          placeholder="项目组"
          style="width: 200px"
          @change="handleSearch"
        />
        <a-select
          v-model="filters.status"
          :options="COVERAGE_STATUS_OPTIONS"
          allow-clear
          placeholder="覆盖状态"
          style="width: 220px"
          @change="handleSearch"
        />
        <a-select
          v-model="filters.tag"
          :options="COVERAGE_TAG_OPTIONS"
          allow-clear
          placeholder="标签"
          style="width: 160px"
          @change="handleSearch"
        />
        <a-input-search
          v-model="filters.keyword"
          allow-clear
          placeholder="接口路径 / 名称 / 应用编号"
          style="width: 280px"
          @search="handleSearch"
        />
        <a-button @click="handleReset">
          重置
        </a-button>
      </a-space>
    </a-card>
    <CoverageSummaryBar
      :iteration="iterationScope"
      :removed-total="removedTotal"
      :summary="summary"
    />

    <a-card :bordered="false">
      <div class="section-title">
        项目组覆盖（点击行按项目组过滤）
      </div>
      <CoverageGroupTable
        :active-group="filters.projectGroup || ''"
        :groups="groups"
        @select="selectGroup"
      />
    </a-card>

    <a-card :bordered="false">
      <div class="toolbar">
        <div class="section-title">
          接口明细
        </div>
        <a-space>
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
  margin-bottom: 8px;
  color: var(--color-text-1);
  font-size: 14px;
  font-weight: 600;
}
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.toolbar .section-title {
  margin-bottom: 0;
}
.selected-hint {
  color: var(--color-text-3);
  font-size: 12px;
}
</style>
