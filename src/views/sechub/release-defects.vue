<script setup lang="ts">
/**
 * 发版质量 → 缺陷草稿（菜单 sys_menu.component = 'sechub/release-defects'）。
 *
 * 页面只做组装：范围筛选（ReleaseScopeBar）+ 状态 / 来源 / 关键字 + 表格 +
 * 详情抽屉 + 状态流转弹窗。取数、分页、状态变更、导出在 `useDefectDrafts`。
 */
import type { DefectAction } from './composables/defectDraftRules'
import type { ReleaseDefect } from '@/types/sechub-release'
import { onMounted, ref } from 'vue'

import DefectDetailDrawer from './components/release/defect/DefectDetailDrawer.vue'
import DefectStatusModal from './components/release/defect/DefectStatusModal.vue'
import DefectTable from './components/release/defect/DefectTable.vue'
import ReleaseScopeBar from './components/release/ReleaseScopeBar.vue'
import { copyDefectText } from './composables/defectClipboard'
import {
  DEFECT_SOURCE_OPTIONS,
  DEFECT_STATUS_OPTIONS,
  defectContentText,
  defectTitleText,
} from './composables/defectDraftRules'
import { useDefectDrafts } from './composables/useDefectDrafts'

// 组件名必须与路由 name（= sys_menu.path）一致，keep-alive :include 按它对上缓存
// eslint-disable-next-line vue/component-definition-name-casing
defineOptions({ name: 'release-defects' })

const {
  loading,
  exporting,
  scopeLoading,
  scopeOptions,
  productLine,
  iterationId,
  productDomain,
  businessArea,
  projectGroup,
  effectiveDomains,
  summaryText,
  envUnavailable,
  filters,
  list,
  pagination,
  init,
  handleScopeChange,
  handleSearch,
  handleReset,
  handlePageChange,
  handlePageSizeChange,
  applyAction,
  exportMarkdown,
} = useDefectDrafts()

const detailVisible = ref(false)
const detailDefect = ref<ReleaseDefect | null>(null)
const statusVisible = ref(false)
const statusDefect = ref<ReleaseDefect | null>(null)
const statusAction = ref<DefectAction | null>(null)
const statusLoading = ref(false)

function openDetail(defect: ReleaseDefect) {
  detailDefect.value = defect
  detailVisible.value = true
}

function copyTitle(defect: ReleaseDefect) {
  void copyDefectText(defectTitleText(defect), '标题')
}

function copyContent(defect: ReleaseDefect) {
  void copyDefectText(defectContentText(defect), '内容')
}

function openAction(defect: ReleaseDefect, action: DefectAction) {
  statusDefect.value = defect
  statusAction.value = action
  statusVisible.value = true
}

async function confirmAction(externalNo: string) {
  if (!statusDefect.value || !statusAction.value)
    return
  statusLoading.value = true
  try {
    const ok = await applyAction(statusDefect.value, statusAction.value, externalNo)
    if (ok)
      statusVisible.value = false
  }
  finally {
    statusLoading.value = false
  }
}

onMounted(() => {
  void init()
})
</script>

<template>
  <div class="release-defects">
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
      <a-empty description="该产品线暂无测试环境，暂无发版数据" />
    </a-card>

    <a-card v-else :bordered="false">
      <div class="toolbar">
        <div>
          <div class="section-title">
            缺陷草稿
          </div>
          <span class="hint">共 {{ pagination.total }} 条；复制标题 / 内容可直接粘贴到外部缺陷系统</span>
        </div>
        <a-space wrap :size="8">
          <a-select
            v-model="filters.status"
            :options="DEFECT_STATUS_OPTIONS"
            allow-clear
            placeholder="状态"
            style="width: 140px"
            @change="handleSearch"
          />
          <a-select
            v-model="filters.source"
            :options="DEFECT_SOURCE_OPTIONS"
            allow-clear
            placeholder="来源"
            style="width: 140px"
            @change="handleSearch"
          />
          <a-input-search
            v-model="filters.keyword"
            allow-clear
            placeholder="编号 / 标题"
            style="width: 220px"
            @search="handleSearch"
          />
          <a-button @click="handleReset">
            重置
          </a-button>
          <a-button :loading="exporting" @click="exportMarkdown">
            导出 Markdown
          </a-button>
        </a-space>
      </div>
      <DefectTable
        :loading="loading"
        :list="list"
        :pagination="pagination"
        @action="openAction"
        @copy-content="copyContent"
        @copy-title="copyTitle"
        @page-change="handlePageChange"
        @page-size-change="handlePageSizeChange"
        @view="openDetail"
      />
    </a-card>

    <DefectDetailDrawer v-model:visible="detailVisible" :defect="detailDefect" />
    <DefectStatusModal
      v-model:visible="statusVisible"
      :action="statusAction"
      :defect="statusDefect"
      :loading="statusLoading"
      @confirm="confirmAction"
    />
  </div>
</template>

<style scoped>
.release-defects {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}
.section-title {
  color: var(--color-text-1);
  font-size: 14px;
  font-weight: 600;
}
.hint {
  color: var(--color-text-3);
  font-size: 12px;
}
</style>
