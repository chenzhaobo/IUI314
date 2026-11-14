<script setup lang="ts">
/**
 * 问题详情弹窗（宽屏，内容区独立滚动）：基本信息、处理信息编辑（version 乐观锁）、状态流转、
 * 出现情况 / 原始记录 / Monitor 日志 / 变更历史。
 *
 * 状态与动作在 useIssueDetail；变更成功后通知父页面刷新列表与左树。
 */
import { toRef } from 'vue'
import { useIssueDetail } from '../useIssueDetail'
import IssueDetailInfo from './IssueDetailInfo.vue'
import IssueDiagnosisPanel from './IssueDiagnosisPanel.vue'
import IssueEvents from './IssueEvents.vue'
import IssueHandleFields from './IssueHandleFields.vue'
import IssueOccurrences from './IssueOccurrences.vue'
import IssueReasonModal from './IssueReasonModal.vue'
import IssueTraceLogs from './IssueTraceLogs.vue'

const props = defineProps<{
  issueId: string
}>()

const emit = defineEmits<{
  (e: 'changed'): void
}>()

const visible = defineModel<boolean>('visible', { required: true })

const {
  detail,
  loading,
  form,
  saving,
  save,
  actions,
  transition,
  handlerId,
  handlerOptions,
  handlerLoading,
  assigning,
  saveHandler,
  refetching,
  refetchLog,
  logVisible,
  logLoading,
  logLines,
  logTitle,
  downloadingLogId,
  openLog,
  downloadLog,
} = useIssueDetail(visible, toRef(props, 'issueId'), () => emit('changed'))

const { reasonVisible, reasonTitle, reason, submitting: transiting, run: runTransition, confirmReason } = transition
</script>

<template>
  <a-modal
    v-model:visible="visible"
    width="92vw"
    :footer="false"
    title="问题详情"
    unmount-on-close
    :body-style="{ height: '82vh', overflow: 'auto' }"
  >
    <a-spin :loading="loading" class="detail-spin">
      <template v-if="detail">
        <IssueDetailInfo :detail="detail" />

        <IssueDiagnosisPanel :samples="detail.raw_samples" :audit-type-label="detail.issue.audit_type_label" />

        <a-tabs default-active-key="logs" class="section">
          <a-tab-pane key="logs" :title="`Monitor 日志（${detail.trace_logs.length}）`">
            <IssueTraceLogs
              v-model:log-visible="logVisible"
              :logs="detail.trace_logs"
              :can-refetch="detail.can_handle"
              :refetching="refetching"
              :log-loading="logLoading"
              :log-lines="logLines"
              :log-title="logTitle"
              :downloading-log-id="downloadingLogId"
              @open="openLog"
              @download="downloadLog"
              @refetch="refetchLog"
            />
          </a-tab-pane>
          <a-tab-pane key="occ" :title="`历史出现（${detail.occurrences.length}）`">
            <IssueOccurrences :occurrences="detail.occurrences" />
          </a-tab-pane>
          <a-tab-pane key="events" :title="`变更历史（${detail.events.length}）`">
            <IssueEvents :events="detail.events" />
          </a-tab-pane>
        </a-tabs>

        <div class="section handle-section">
          <div class="section-head">
            <span class="section-title">处理信息</span>
            <a-space v-if="detail.can_handle" wrap>
              <a-button
                v-for="act in actions"
                :key="act.value"
                size="mini"
                type="primary"
                :loading="transiting"
                @click="runTransition(act.value)"
              >
                {{ act.label }}
              </a-button>
              <a-button size="mini" type="primary" :loading="saving" @click="save">
                保存
              </a-button>
            </a-space>
            <span v-else class="muted">不在所属项目组，只读</span>
          </div>
          <a-form layout="vertical" :model="{}">
            <a-form-item label="处理人（跟进开发）">
              <div class="handler-row">
                <a-select
                  v-model="handlerId"
                  :options="handlerOptions"
                  :loading="handlerLoading"
                  :disabled="!detail.can_handle || !detail.issue.project_group_id"
                  placeholder="选择项目组成员"
                  allow-clear
                  allow-search
                />
                <a-button
                  type="primary"
                  :loading="assigning"
                  :disabled="!detail.can_handle || !detail.issue.project_group_id"
                  @click="saveHandler"
                >
                  保存处理人
                </a-button>
              </div>
              <template #extra>
                <span v-if="!detail.issue.project_group_id">请先将问题归类到项目组，才能选择项目组成员</span>
                <span v-else>候选为项目组成员；清空后保存 = 取消分派</span>
              </template>
            </a-form-item>
          </a-form>
          <IssueHandleFields v-model:form="form" :disabled="!detail.can_handle" />
        </div>
      </template>
      <a-empty v-else-if="!loading" description="问题不存在或无权查看" />
    </a-spin>

    <IssueReasonModal
      v-model:visible="reasonVisible"
      v-model:reason="reason"
      :title="reasonTitle"
      :loading="transiting"
      :on-confirm="confirmReason"
    />
  </a-modal>
</template>

<style scoped>
.detail-spin { display: block; width: 100%; }
.section { margin-top: 16px; }
.section-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
.section-title { font-weight: 600; }
.muted { color: var(--color-text-3); font-size: 12px; }
.handler-row { display: flex; gap: 8px; width: min(620px, 100%); }
.handler-row .arco-select { flex: 1; }
</style>
