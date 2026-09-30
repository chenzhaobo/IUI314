<script lang="ts" setup>
/**
 * 摸底计划详情抽屉：步骤时间线 → 参数 → 运行中操作（改写下一档并发 / 取消）→ 结果面板。
 *
 * 操作按钮放抽屉 footer：计划跑起来后正文会很长（表格 + 两张曲线），
 * 放正文顶部会被滚走，运行中要反复点「刷新」时够不着。
 */
import type { ProbePlanView } from './types'
import { computed } from 'vue'
import ProbeResultPane from './ProbeResultPane.vue'
import { hwPositionText, PHASE_FLOW, planStatusColor, planStatusText, progressText, stepText } from './types'

const props = defineProps<{
  detail: ProbePlanView | null
  loading: boolean
  canOperate: boolean
  overriding: boolean
  cancelling: boolean
}>()
const emit = defineEmits<{
  (e: 'refresh'): void
  (e: 'override'): void
  (e: 'cancel'): void
}>()
const visible = defineModel<boolean>('visible', { required: true })
const overrideThreads = defineModel<number | undefined>('overrideThreads')

const state = computed(() => props.detail?.state ?? null)
const failed = computed(() => props.detail?.status === 'failed' || props.detail?.current_step === 'failed')

/** a-steps 的 current 从 1 起算，PHASE_FLOW 是 0 基下标 */
const stepIndex = computed(() => {
  const idx = PHASE_FLOW.indexOf((props.detail?.current_step ?? '') as typeof PHASE_FLOW[number])
  return idx >= 0 ? idx + 1 : 1
})

const hwProgress = computed(() => (props.detail ? hwPositionText(props.detail) : '—'))

const pendingOverrides = computed(() => state.value?.pending_overrides ?? [])
const progress = computed(() => state.value?.progress ?? null)
</script>

<template>
  <a-drawer
    v-model:visible="visible"
    title="摸底计划详情"
    :width="1120"
    unmount-on-close
  >
    <a-spin :loading="loading" class="pdd-spin">
      <template v-if="detail">
        <div class="pdd-head">
          <span class="pdd-name">{{ detail.name }}</span>
          <a-tag :color="planStatusColor(detail.status)">
            {{ planStatusText(detail.status) }}
          </a-tag>
          <a-tag color="arcoblue">
            档位 {{ hwProgress }}
          </a-tag>
          <span class="pdd-step">当前步骤：{{ stepText(detail.current_step) }}</span>
        </div>

        <a-steps :current="stepIndex" :status="failed ? 'error' : 'process'" size="small" class="pdd-steps">
          <a-step v-for="phase in PHASE_FLOW" :key="phase" :title="stepText(phase)" />
        </a-steps>

        <a-descriptions :column="3" size="small" bordered class="pdd-desc">
          <a-descriptions-item label="环境">
            {{ detail.env_name || detail.env_id }}
          </a-descriptions-item>
          <a-descriptions-item label="脚本">
            {{ detail.script_name || detail.script_id }}
          </a-descriptions-item>
          <a-descriptions-item label="执行机">
            {{ detail.load_node_id || '本地执行' }}
          </a-descriptions-item>
          <a-descriptions-item label="目标 TPS">
            {{ detail.target_tps ?? '倍增模式' }}
          </a-descriptions-item>
          <a-descriptions-item label="档位合格阈值 k">
            {{ detail.k_factor }}
          </a-descriptions-item>
          <a-descriptions-item label="探针并发 / 最大并发">
            {{ detail.probe_threads }} / {{ detail.max_threads }}
          </a-descriptions-item>
          <a-descriptions-item label="爬坡 / 稳态 / 稳定性(秒)">
            {{ detail.rampup_sec }} / {{ detail.steady_sec }} / {{ detail.stability_sec }}
          </a-descriptions-item>
          <a-descriptions-item label="创建人">
            {{ detail.created_by }}
          </a-descriptions-item>
          <a-descriptions-item label="进度">
            {{ progressText(progress) }}
          </a-descriptions-item>
        </a-descriptions>

        <a-alert v-if="detail.error" type="error" :title="detail.error" class="pdd-alert" />
        <a-alert
          v-if="progress?.fail_reason"
          type="error"
          :title="`档位失败：${progress.fail_reason}`"
          class="pdd-alert"
        />
        <a-alert
          v-if="pendingOverrides.length"
          type="info"
          :title="`已排队 ${pendingOverrides.length} 条下一档并发改写（下一次换档生效）`"
          class="pdd-alert"
        />

        <ProbeResultPane :plan="detail" />
      </template>
      <a-empty v-else description="请从列表选择一个计划" />
    </a-spin>

    <template #footer>
      <div class="pdd-foot">
        <template v-if="canOperate">
          <span class="pdd-foot-label">改写下一档并发</span>
          <a-input-number
            v-model="overrideThreads"
            :min="1"
            :max="detail?.max_threads ?? 1"
            size="small"
            placeholder="并发数"
            class="pdd-foot-num"
          />
          <a-button size="small" :loading="overriding" @click="emit('override')">
            提交改写
          </a-button>
          <a-button size="small" status="danger" :loading="cancelling" @click="emit('cancel')">
            取消计划
          </a-button>
        </template>
        <span v-else class="pdd-foot-hint">计划已结束，无可执行操作</span>
        <a-button size="small" type="primary" @click="emit('refresh')">
          刷新
        </a-button>
      </div>
    </template>
  </a-drawer>
</template>

<style scoped>
.pdd-spin {
  display: block;
}

.pdd-head {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
}

.pdd-name {
  font-weight: 600;
  font-size: 15px;
}

.pdd-step {
  color: var(--color-text-3);
}

.pdd-steps {
  margin-bottom: 12px;
}

.pdd-desc {
  margin-bottom: 12px;
}

.pdd-alert {
  margin-bottom: 8px;
}

.pdd-foot {
  display: flex;
  gap: 8px;
  align-items: center;
}

.pdd-foot-label {
  color: var(--color-text-2);
}

.pdd-foot-num {
  width: 120px;
}

.pdd-foot-hint {
  flex: 1;
  color: var(--color-text-3);
}

/* 让「刷新」始终贴右：可操作时按钮组占满左侧，不可操作时提示占满左侧 */
.pdd-foot > .arco-btn:last-child {
  margin-left: auto;
}
</style>
