<script setup lang="ts">
/**
 * 问题详情抽屉：基本信息、处理信息编辑（version 乐观锁）、状态流转、
 * 出现情况 / 原始记录 / Monitor 日志 / 变更历史。
 *
 * 状态与动作在 useIssueDetail；变更成功后通知父页面刷新列表与左树。
 */
import { toRef } from 'vue'
import { useIssueDetail } from '../useIssueDetail'
import IssueDetailInfo from './IssueDetailInfo.vue'
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
  refetching,
  refetchLog,
  logVisible,
  logLoading,
  logLines,
  logTitle,
  openLog,
} = useIssueDetail(visible, toRef(props, 'issueId'), () => emit('changed'))

const { reasonVisible, reasonTitle, reason, submitting: transiting, run: runTransition, confirmReason } = transition
</script>

<template>
  <a-drawer v-model:visible="visible" :width="960" :footer="false" title="问题详情" unmount-on-close>
    <a-spin :loading="loading" class="drawer-spin">
      <template v-if="detail">
        <IssueDetailInfo :detail="detail" />

        <div class="section">
          <div class="section-head">
            <span class="section-title">处理信息</span>
            <a-space v-if="detail.can_handle" wrap>
              <a-button
                v-for="act in actions"
                :key="act.value"
                size="mini"
                :loading="transiting"
                @click="runTransition(act.value)"
              >
                {{ act.label }}
              </a-button>
              <a-button size="mini" type="primary" :loading="saving" @click="save">
                保存处理信息
              </a-button>
            </a-space>
            <span v-else class="muted">不在所属项目组，只读</span>
          </div>
          <IssueHandleFields v-model:form="form" :disabled="!detail.can_handle" />
        </div>

        <a-tabs default-active-key="occ" class="section">
          <a-tab-pane key="occ" :title="`出现情况（${detail.occurrences.length}）`">
            <IssueOccurrences :occurrences="detail.occurrences" :raw-samples="detail.raw_samples" />
          </a-tab-pane>
          <a-tab-pane key="logs" :title="`Monitor 日志（${detail.trace_logs.length}）`">
            <IssueTraceLogs
              v-model:log-visible="logVisible"
              :logs="detail.trace_logs"
              :can-refetch="detail.can_handle"
              :refetching="refetching"
              :log-loading="logLoading"
              :log-lines="logLines"
              :log-title="logTitle"
              @open="openLog"
              @refetch="refetchLog"
            />
          </a-tab-pane>
          <a-tab-pane key="events" :title="`变更历史（${detail.events.length}）`">
            <IssueEvents :events="detail.events" />
          </a-tab-pane>
        </a-tabs>
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
  </a-drawer>
</template>

<style scoped>
.drawer-spin { display: block; width: 100%; }
.section { margin-top: 16px; }
.section-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
.section-title { font-weight: 600; }
.muted { color: var(--color-text-3); font-size: 12px; }
</style>
