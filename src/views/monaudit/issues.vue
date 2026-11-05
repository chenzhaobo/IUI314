<script lang="ts" setup>
/**
 * 监控审计 · 问题清单：左树（项目组 / 业务领域 / 产品领域 / 处理人 / 审计类型）+ 右表 + 详情抽屉。
 *
 * 列表 / 范围 / 勾选在 ./issues/useIssueList，批量动作在 useIssueBatch，状态流转在 useIssueTransition；
 * 取数一律经 ./issues/service。
 */
import type { IssueRow } from './issues/types'
import { onMounted, ref } from 'vue'
import ListPage from '@/components/common/ListPage.vue'
import IssueBatchModals from './issues/components/IssueBatchModals.vue'
import IssueDetailDrawer from './issues/components/IssueDetailDrawer.vue'
import IssueFilterBar from './issues/components/IssueFilterBar.vue'
import IssueReasonModal from './issues/components/IssueReasonModal.vue'
import IssueScopeTree from './issues/components/IssueScopeTree.vue'
import IssueTable from './issues/components/IssueTable.vue'
import { TRANSITIONS } from './issues/types'
import { useIssueBatch } from './issues/useIssueBatch'
import { useIssueList } from './issues/useIssueList'
import { useIssueTransition } from './issues/useIssueTransition'

// 组件名必须与路由 name（= sys_menu.path）逐字一致，keep-alive :include 才能缓存本页
// eslint-disable-next-line vue/component-definition-name-casing
defineOptions({ name: 'monaudit-issues' })

const {
  filter,
  options,
  dataList,
  loading,
  pagination,
  onPageChange,
  onPageSizeChange,
  selectedKeys,
  selectedRows,
  treeFilters,
  loadList,
  search,
  resetFilter,
  onScopeChange,
  init,
} = useIssueList()

const scopeTree = ref<InstanceType<typeof IssueScopeTree>>()

/** 处理动作后：列表与左树计数都要刷新（这些动作不改筛选，左树 watcher 不会触发） */
function refreshAll() {
  void loadList()
  scopeTree.value?.reload()
}

const batch = useIssueBatch(selectedRows, refreshAll)
const {
  submitting: batchSubmitting,
  editVisible,
  editForm,
  assignVisible,
  assignHandler,
  handlerOptions,
  handlerLoading,
  classifyVisible,
  classifyForm,
} = batch

const {
  reasonVisible,
  reasonTitle,
  reason,
  submitting: transiting,
  run: runTransition,
  confirmReason,
} = useIssueTransition(() => selectedRows.value.map(r => r.id), refreshAll)

function onTransitionSelect(value: string | number | Record<string, unknown> | undefined) {
  const hit = TRANSITIONS.find(t => t.value === value)
  if (hit)
    runTransition(hit.value)
}

// ── 详情抽屉 ──────────────────────────────────────
const drawerVisible = ref(false)
const drawerIssueId = ref('')

function openDetail(row: IssueRow) {
  drawerIssueId.value = row.id
  drawerVisible.value = true
}

onMounted(() => {
  void init()
})
</script>

<template>
  <div class="p-4">
    <ListPage :aside-width="300" aside-resizable>
      <template #filter>
        <IssueFilterBar v-model:filter="filter" :options="options" @search="search" @reset="resetFilter" />
      </template>

      <template #aside>
        <IssueScopeTree ref="scopeTree" :filters="treeFilters" @change="onScopeChange" />
      </template>

      <template #toolbar>
        <span class="selected-hint">已选 {{ selectedRows.length }} 条</span>
        <a-button size="small" :disabled="!selectedRows.length" @click="batch.openEdit">
          批量填写
        </a-button>
        <a-button size="small" :disabled="!selectedRows.length" @click="batch.openAssign">
          分派
        </a-button>
        <a-dropdown trigger="click" @select="onTransitionSelect">
          <a-button size="small" :disabled="!selectedRows.length" :loading="transiting">
            状态流转
          </a-button>
          <template #content>
            <a-doption v-for="t in TRANSITIONS" :key="t.value" :value="t.value">
              {{ t.label }}{{ t.needReason ? '…' : '' }}
            </a-doption>
          </template>
        </a-dropdown>
        <a-button v-if="options.scope_all" size="small" :disabled="!selectedRows.length" @click="batch.openClassify">
          归类到项目组
        </a-button>
      </template>

      <template #default="{ tableHeight }">
        <IssueTable
          v-model:selected-keys="selectedKeys"
          :data="dataList"
          :loading="loading"
          :pagination="pagination"
          :table-height="tableHeight"
          @page-change="onPageChange"
          @page-size-change="onPageSizeChange"
          @open="openDetail"
        />
      </template>
    </ListPage>

    <IssueBatchModals
      v-model:edit-visible="editVisible"
      v-model:edit-form="editForm"
      v-model:assign-visible="assignVisible"
      v-model:assign-handler="assignHandler"
      v-model:classify-visible="classifyVisible"
      v-model:classify-form="classifyForm"
      :selected-count="selectedRows.length"
      :submitting="batchSubmitting"
      :handler-options="handlerOptions"
      :handler-loading="handlerLoading"
      :project-groups="options.project_groups"
      :submit-edit="batch.submitEdit"
      :submit-assign="batch.submitAssign"
      :submit-classify="batch.submitClassify"
    />

    <IssueReasonModal
      v-model:visible="reasonVisible"
      v-model:reason="reason"
      :title="reasonTitle"
      :loading="transiting"
      :on-confirm="confirmReason"
    />

    <IssueDetailDrawer v-model:visible="drawerVisible" :issue-id="drawerIssueId" @changed="refreshAll" />
  </div>
</template>

<style scoped>
.selected-hint { color: var(--color-text-3); font-size: 12px; }
</style>
