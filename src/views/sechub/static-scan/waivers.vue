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
  WAIVER_PATH_GLOB_PLACEHOLDER,
  WAIVER_SCOPE_KIND_OPTIONS,
  WAIVER_STATUS_COLORS,
  WAIVER_STATUS_OPTIONS,
  WAIVER_TYPE_OPTIONS,
  waiverScopeText,
  waiverStatusLabel,
} from './waivers/types'
import { useWaivers } from './waivers/useWaivers'

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
          :scroll="{ minWidth: 1320, y: tableHeight }"
          @page-change="onPageChange"
          @page-size-change="onPageSizeChange"
        >
          <template #columns>
            <a-table-column title="规则代码" data-index="rule_code" :width="140" ellipsis tooltip />
            <!-- 004 契约：白名单分层（范围排除/规则×范围豁免/单问题/规则豁免）；历史行只有 path_pattern -->
            <a-table-column title="类型/范围" data-index="waiver_type" :width="200" ellipsis tooltip>
              <template #cell="{ record }">
                {{ waiverScopeText(record) }}
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
    <a-modal v-model:visible="formVisible" title="新建白名单申请" :ok-loading="formLoading" @ok="submitForm">
      <a-form :model="formData" layout="vertical">
        <a-form-item label="白名单类型">
          <a-select v-model="formData.waiver_type" :options="WAIVER_TYPE_OPTIONS" placeholder="不选则由规则版本/路径推断" allow-clear />
        </a-form-item>
        <a-form-item label="规则版本ID" required>
          <a-input v-model="formData.rule_version_id" placeholder="规则版本 ID（范围排除可留空）" data-testid="form-rule-version" />
        </a-form-item>
        <a-form-item label="规则代码">
          <a-input v-model="formData.rule_code" placeholder="如: SEC-001" />
        </a-form-item>
        <a-form-item label="豁免范围维度">
          <a-select
            v-model="formData.scope_kind"
            :options="WAIVER_SCOPE_KIND_OPTIONS"
            placeholder="可选；选了才发送 scope_kind"
            allow-clear
            @change="onScopeKindChange"
          />
        </a-form-item>
        <a-form-item label="范围值">
          <!-- 枚举维度走下拉，path_glob 走自由输入的 glob；顺序由 scopeValueOptions 决定，模板不猜 -->
          <a-select
            v-if="scopeValueOptions.length"
            v-model="formData.scope_value"
            :options="scopeValueOptions"
            placeholder="选择范围值"
            allow-clear
          />
          <a-input
            v-else
            v-model="formData.scope_value"
            :disabled="!formData.scope_kind"
            :placeholder="formData.scope_kind ? WAIVER_PATH_GLOB_PLACEHOLDER : '先选豁免范围维度'"
          />
        </a-form-item>
        <a-form-item label="项目组">
          <a-select v-model="formData.project_group_id" :options="pgOptions" placeholder="可选，空=全局" allow-clear />
        </a-form-item>
        <a-form-item label="模块仓库ID">
          <a-input v-model="formData.module_repository_id" placeholder="可选" />
        </a-form-item>
        <a-form-item label="路径模式">
          <a-input v-model="formData.path_pattern" :placeholder="WAIVER_PATH_GLOB_PLACEHOLDER" />
        </a-form-item>
        <a-form-item label="原因说明" required>
          <a-textarea v-model="formData.reason" placeholder="申请白名单的原因" data-testid="form-reason" />
        </a-form-item>
        <a-form-item label="影响说明">
          <a-textarea v-model="formData.impact" placeholder="可选" />
        </a-form-item>
        <a-form-item label="过期时间">
          <a-date-picker v-model="formData.effective_to" show-time value-format="YYYY-MM-DD HH:mm:ss" style="width: 100%" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 审批弹窗 -->
    <a-modal v-model:visible="approveVisible" title="白名单审批" :ok-loading="approveLoading" @ok="submitApprove">
      <a-form :model="approveForm" layout="vertical">
        <a-form-item label="审批对象">
          <span class="approve-target">{{ currentRow?.rule_code || currentRow?.rule_version_id || currentRow?.id }}</span>
          <span class="card-sub">{{ currentRow ? waiverScopeText(currentRow) : '' }}</span>
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
