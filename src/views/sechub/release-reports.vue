<script setup lang="ts">
/**
 * 发版质量 → 发版报告（菜单 sys_menu.component = 'sechub/release-reports'）。
 *
 * 快照列表 + Markdown 预览抽屉 + 下载 / 定稿 / 撤销定稿。
 * 取数与状态在 `useReleaseReports`，预览与弹窗拆到 components/release/reports。
 */
import type { ReleaseSnapshotRow } from '@/types/sechub-release'
import { Modal } from '@arco-design/web-vue'

import SnapshotReportDrawer from './components/release/reports/SnapshotReportDrawer.vue'
import SnapshotTable from './components/release/reports/SnapshotTable.vue'
import UnfinalizeModal from './components/release/reports/UnfinalizeModal.vue'
import { useReleaseReports } from './composables/useReleaseReports'

// 组件名必须与路由 name（= sys_menu.path）一致，keep-alive :include 按它对上缓存
// eslint-disable-next-line vue/component-definition-name-casing
defineOptions({ name: 'release-reports' })

const {
  loading,
  list,
  pagination,
  drawerVisible,
  detailLoading,
  detail,
  actingId,
  unfinalizeVisible,
  unfinalizing,
  unfinalizeTarget,
  loadSnapshots,
  handlePageChange,
  handlePageSizeChange,
  openReport,
  downloadReport,
  finalize,
  openUnfinalize,
  submitUnfinalize,
} = useReleaseReports()

function handleFinalize(row: ReleaseSnapshotRow) {
  Modal.confirm({
    title: '定稿发版报告',
    content: `定稿后该快照将作为「${row.iteration_name || row.iteration_id}」的最终结论，确定继续？`,
    okText: '定稿',
    onOk: () => finalize(row),
  })
}
</script>

<template>
  <div class="release-reports">
    <a-card :bordered="false">
      <div class="toolbar">
        <div>
          <div class="section-title">
            发版报告
          </div>
          <span class="hint">快照是发版时点的冻结视图；定稿后作为该迭代的最终结论。</span>
        </div>
        <a-button :loading="loading" @click="loadSnapshots">
          刷新
        </a-button>
      </div>
      <SnapshotTable
        :acting-id="actingId"
        :list="list"
        :loading="loading"
        :pagination="pagination"
        @download="downloadReport"
        @finalize="handleFinalize"
        @page-change="handlePageChange"
        @page-size-change="handlePageSizeChange"
        @unfinalize="openUnfinalize"
        @view="openReport"
      />
    </a-card>

    <SnapshotReportDrawer
      v-model:visible="drawerVisible"
      :detail="detail"
      :loading="detailLoading"
    />
    <UnfinalizeModal
      v-model:visible="unfinalizeVisible"
      :snapshot="unfinalizeTarget"
      :submit-reason="submitUnfinalize"
      :submitting="unfinalizing"
    />
  </div>
</template>

<style scoped>
.release-reports {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.section-title {
  margin-bottom: 4px;
  color: var(--color-text-1);
  font-size: 14px;
  font-weight: 600;
}
.hint {
  color: var(--color-text-3);
  font-size: 12px;
}
</style>
