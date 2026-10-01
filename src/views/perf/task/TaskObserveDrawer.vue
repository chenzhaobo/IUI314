<script lang="ts" setup>
/**
 * 批次观测抽屉：资源视角（曲线 + 排行 + 取证）/ 复跑结论（裁决表）/ 诊断（101i 共享卡片）。
 *
 * 顶部常驻 `observe_state` 标签；`env_suspect` 时红色横幅给出原因与「继续复跑」。
 */
import { computed, ref } from 'vue'
import DiagnosisPanel from '../components/DiagnosisPanel.vue'
import TaskRerunDecision from './TaskRerunDecision.vue'
import TaskResourceView from './TaskResourceView.vue'
import { observeStateText } from './types'
import { useTaskObserve } from './useTaskObserve'

defineOptions({ name: 'TaskObserveDrawer' })

const visible = defineModel<boolean>('visible', { required: true })
const taskId = defineModel<string>('taskId', { required: true })

const {
  loading,
  reload,
  rerun,
  stateColor,
  observeState,
  envSuspectReason,
  isEnvSuspect,
  resuming,
  resume,
  keyword,
  confidenceFilter,
  selectedRunIds,
  rankRows,
  seriesGroups,
  markAreas,
  activeMarkArea,
  onRowClick,
  evidenceEvent,
  evidenceSubmitting,
  submitEvidence,
} = useTaskObserve(taskId, visible)

const stateText = computed(() => observeStateText(observeState.value))
const activeTab = ref('resource')
</script>

<template>
  <a-drawer
    :visible="visible"
    :width="1120"
    :footer="false"
    title="批次观测"
    unmount-on-close
    @update:visible="(v: boolean) => (visible = v)"
  >
    <a-spin :loading="loading" class="tod-wrap">
      <a-space class="m-b-8px">
        <a-tag :color="stateColor">
          {{ stateText }}
        </a-tag>
        <span class="tod-hint">批次 {{ taskId }}</span>
        <a-button size="mini" @click="reload">
          刷新
        </a-button>
      </a-space>

      <a-alert v-if="isEnvSuspect" type="error" class="m-b-8px">
        <template #title>
          疑似环境异常，自动复跑已暂停
        </template>
        <div>{{ envSuspectReason || '未记录原因' }}</div>
        <a-button class="m-t-8px" type="primary" size="small" :loading="resuming" @click="resume">
          继续复跑
        </a-button>
      </a-alert>

      <a-tabs v-model:active-key="activeTab">
        <a-tab-pane key="resource" title="资源视角">
          <TaskResourceView
            v-model:keyword="keyword"
            v-model:confidence-filter="confidenceFilter"
            v-model:selected-run-ids="selectedRunIds"
            v-model:evidence-event="evidenceEvent"
            :series-groups="seriesGroups"
            :mark-areas="markAreas"
            :active-mark-area="activeMarkArea"
            :rank-rows="rankRows"
            :evidence-submitting="evidenceSubmitting"
            @select-row="onRowClick"
            @submit-evidence="submitEvidence"
          />
        </a-tab-pane>
        <a-tab-pane key="rerun" title="复跑结论">
          <TaskRerunDecision :view="rerun" />
        </a-tab-pane>
        <a-tab-pane key="diagnosis" title="诊断">
          <DiagnosisPanel v-if="activeTab === 'diagnosis'" scope="task" :scope-id="taskId" />
        </a-tab-pane>
      </a-tabs>
    </a-spin>
  </a-drawer>
</template>

<style scoped>
.tod-wrap {
  display: block;
  width: 100%;
}

.tod-hint {
  color: var(--color-text-3);
  font-size: 12px;
}
</style>
