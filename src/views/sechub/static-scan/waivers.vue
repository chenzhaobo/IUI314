<script lang="ts" setup>
/**
 * 白名单管理 — Waiver 申请/审批/撤销。
 *
 * 页面只留模板：列表/左树/分页/两处弹窗的状态与动作都在 ./waivers/useWaivers，
 * 常量与展示口径在 ./waivers/types，取数在 ./waivers/service（组件不碰 `@/api`）。
 */
import { onMounted } from 'vue'
import ListPage from '@/components/common/ListPage.vue'
import {
  WAIVER_STATUS_COLORS,
  WAIVER_STATUS_OPTIONS,
  waiverScopeText,
  waiverStatusLabel,
} from './waivers/types'
import { useWaivers } from './waivers/useWaivers'
import WaiverCreateModal from './waivers/WaiverCreateModal.vue'

// 组件名必须与路由 name（= sys_menu.path 'waivers'）逐字一致，keep-alive :include 才能缓存本页
// （见 components/layout/app-main.vue 注释）。lint 的 PascalCase 提示只是警告，改名却会让页签缓存失效。
// eslint-disable-next-line vue/component-definition-name-casing
defineOptions({ name: 'waivers' })

const {
  dataList,
  loading,
  query,
  pagination,
  onPageChange,
  onPageSizeChange,
  onSearch,
  loadList,
  ruleStatsLoading,
  ruleTree,
  selectedRuleId,
  expandedKeys,
  loadRuleStats,
  onTreeSelect,
  pgOptions,
  loadProjectGroupOptions,
  formVisible,
  formLoading,
  formData,
  scopeValueOptions,
  openCreate,
  onScopeKindChange,
  submitForm,
  approveVisible,
  approveLoading,
  currentRow,
  approveForm,
  openApprove,
  submitApprove,
  revoke,
} = useWaivers()

onMounted(() => {
  void loadProjectGroupOptions()
  void loadRuleStats()
  void loadList()
})
</script>

<template>
  <div class="p-4" style="display: flex; flex-direction: column; min-height: 0">
    <a-card title="白名单管理" class="mb-4">
      <template #extra>
        <a-button type="primary" size="small" data-testid="btn-create-waiver" @click="openCreate">
          新建申请
        </a-button>
      </template>

      <!-- 筛选栏 -->
      <div class="flex flex-wrap gap-3">
        <a-select v-model="query.project_group_id" placeholder="项目组" allow-clear style="width: 180px" :options="pgOptions" @change="onSearch" />
        <a-select v-model="query.status" placeholder="状态" allow-clear style="width: 140px" :options="WAIVER_STATUS_OPTIONS" @change="onSearch" />
        <a-button type="primary" size="small" @click="onSearch">
          查询
        </a-button>
      </div>
    </a-card>

    <!--
      左树右表骨架交给 ListPage：确定高度、min-height:0 链、overflow-x、
      工具行固定、表格体高度这些细节都在组件里，页面只填内容。
      column-resizable 已是全站默认（plugins/arco-defaults.ts），不必逐表再写。
    -->
    <ListPage :aside-width="230" aside-resizable>
      <template #aside-title>
        规则分布
        <small class="card-sub">生效/待审批/总数</small>
      </template>

      <template #aside>
        <a-spin :loading="ruleStatsLoading" style="width: 100%">
          <a-tree
            v-if="ruleTree.length"
            v-model:expanded-keys="expandedKeys"
            :data="ruleTree"
            :selected-keys="[selectedRuleId]"
            @select="onTreeSelect"
          >
            <template #title="node">
              <div class="rule-node">
                <span class="rule-name" :title="node.title">{{ node.title }}</span>
                <span v-if="node.rule" class="rule-stats">
                  <span class="s-active">{{ node.rule.active }}</span>/<span class="s-pending">{{ node.rule.pending }}</span>/<span class="s-total">{{ node.rule.total }}</span>
                </span>
                <span v-else-if="node.spStats" class="rule-stats">
                  <span class="s-active">{{ node.spStats.active }}</span>/<span class="s-pending">{{ node.spStats.pending }}</span>/<span class="s-total">{{ node.spStats.total }}</span>
                </span>
              </div>
            </template>
          </a-tree>
          <a-empty v-else description="暂无白名单" />
        </a-spin>
      </template>

      <template #default="{ tableHeight }">
        <a-table
          :data="dataList"
          :loading="loading"
          :pagination="pagination"
          row-key="id"
          :scroll="{ minWidth: 1480, y: tableHeight }"
          @page-change="onPageChange"
          @page-size-change="onPageSizeChange"
        >
          <template #columns>
            <a-table-column title="规则代码" data-index="rule_code" :width="140" ellipsis tooltip />
            <!-- 004 契约：白名单分层（范围排除/规则×范围豁免/单问题/规则豁免）；历史行只有 path_pattern -->
            <a-table-column title="类型/范围" data-index="waiver_type" :width="240" ellipsis tooltip>
              <template #cell="{ record }">
                {{ waiverScopeText(record) }}
              </template>
            </a-table-column>
            <!-- 20261008 B：单条豁免绑定的缺陷（回写时按缺陷归属生效）；未绑定显示 — -->
            <a-table-column title="绑定缺陷" data-index="issue_id" :width="120">
              <template #cell="{ record }">
                <a-tooltip v-if="record.issue_id" :content="record.issue_id" mini>
                  <span class="font-mono">{{ String(record.issue_id).slice(0, 8) }}</span>
                </a-tooltip>
                <span v-else class="card-sub" style="margin-left: 0">—</span>
              </template>
            </a-table-column>
            <a-table-column title="原因" data-index="reason" :width="200" ellipsis tooltip />
            <a-table-column title="状态" data-index="status" :width="100">
              <template #cell="{ record }">
                <a-tag :color="WAIVER_STATUS_COLORS[record.status] || 'gray'">
                  {{ waiverStatusLabel(record.status) }}
                </a-tag>
              </template>
            </a-table-column>
            <a-table-column title="申请人" data-index="requester_id" :width="120" ellipsis tooltip />
            <a-table-column title="审批人" data-index="approver_id" :width="120" ellipsis tooltip />
            <a-table-column title="生效时间" data-index="effective_from" :width="160" ellipsis tooltip />
            <a-table-column title="过期时间" data-index="effective_to" :width="160" ellipsis tooltip />
            <a-table-column title="操作" :width="160" fixed="right">
              <template #cell="{ record }">
                <a-space>
                  <a-button v-if="record.status === 'pending'" size="mini" type="primary" data-testid="btn-approve-waiver" @click="openApprove(record)">
                    审批
                  </a-button>
                  <a-button v-if="record.status === 'active'" size="mini" status="danger" data-testid="btn-revoke-waiver" @click="revoke(record)">
                    撤销
                  </a-button>
                </a-space>
              </template>
            </a-table-column>
          </template>
        </a-table>
      </template>
    </ListPage>

    <!-- 创建申请弹窗 -->
    <WaiverCreateModal
      v-model:visible="formVisible"
      v-model:form="formData"
      :loading="formLoading"
      :pg-options="pgOptions"
      :scope-value-options="scopeValueOptions"
      @submit="submitForm"
      @scope-kind-change="onScopeKindChange"
    />

    <!-- 审批弹窗 -->
    <a-modal v-model:visible="approveVisible" title="白名单审批" :ok-loading="approveLoading" @ok="submitApprove">
      <a-form :model="approveForm" layout="vertical">
        <a-form-item label="审批对象">
          <span class="approve-target">{{ currentRow?.rule_code || currentRow?.rule_version_id || currentRow?.id }}</span>
          <span class="card-sub">{{ currentRow ? waiverScopeText(currentRow) : '' }}</span>
        </a-form-item>
        <a-form-item v-if="currentRow?.issue_id" label="绑定缺陷">
          <span class="approve-target font-mono">{{ currentRow.issue_id }}</span>
        </a-form-item>
        <a-form-item label="审批决定" required>
          <a-radio-group v-model="approveForm.approved" data-testid="approve-radio">
            <a-radio :value="true">
              批准
            </a-radio>
            <a-radio :value="false">
              拒绝
            </a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item label="审批意见">
          <a-textarea v-model="approveForm.comment" placeholder="可选" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<style scoped>
.card-sub { margin-left: 12px; color: var(--color-text-3); font-weight: normal; font-size: 12px; }
.approve-target { word-break: break-all; }

.rule-node { display: flex; align-items: center; justify-content: space-between; gap: 4px; width: 100%; }
.rule-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rule-stats { flex-shrink: 0; font-size: 12px; color: var(--color-text-3); }
.s-active { color: rgb(var(--green-6)); font-weight: 500; }
.s-pending { color: rgb(var(--orange-6)); }
.s-total { color: var(--color-text-2); }
</style>
