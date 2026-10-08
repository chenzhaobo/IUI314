<script setup lang="ts">
/**
 * 批量 AI 确认弹窗：对勾选的运行配置模式/模型/Agent/技能，逐个触发并展示结果。
 *
 * 入口是运行页表头的「AI 确认」按钮（行级入口仍是 AiConfirmModal，两者共用
 * useAiConfirmOptions 的表单/选项）。
 */
import { computed, reactive } from 'vue'
import AiConfirmScopeField from './AiConfirmScopeField.vue'
import { useBatchAiConfirm } from './useBatchAiConfirm'

const emit = defineEmits<{ submitted: [] }>()
const batch = reactive(useBatchAiConfirm({ onSubmitted: () => emit('submitted') }))

// 提交前是「开始确认」，提交完成后改为「关闭」——弹窗留在原地展示逐行结果
const okText = computed(() => (batch.finished ? '关闭' : '开始确认'))

function onOk() {
  if (batch.finished) {
    batch.visible = false
    return
  }
  void batch.submit()
}

defineExpose({ open: batch.open })
</script>

<template>
  <a-modal
    v-model:visible="batch.visible"
    title="批量 AI 确认"
    :width="620"
    :ok-text="okText"
    cancel-text="取消"
    :ok-loading="batch.submitting"
    :mask-closable="false"
    @ok="onOk"
  >
    <a-form :model="{}" layout="vertical">
      <a-form-item label="目标运行">
        <div class="batch-hint">
          将依次对 {{ batch.targets.length }} 个运行逐个发起 AI 确认，提交结果在下方逐行展示。
        </div>
        <div class="batch-targets">
          <a-tag v-for="target in batch.targets" :key="target.run_id" size="small">
            {{ target.label }}
          </a-tag>
        </div>
      </a-form-item>
      <AiConfirmScopeField v-model="batch.scope" :options="batch.scopeOptions" :loading="batch.loadingScanPoints" :disabled="batch.submitting" batch />
      <a-form-item label="确认模式">
        <a-radio-group v-model="batch.mode" type="button" :disabled="batch.submitting">
          <a-radio value="batch">
            平台编排（批量）
          </a-radio>
          <a-radio value="agent">
            Agent 自主
          </a-radio>
        </a-radio-group>
      </a-form-item>
      <a-form-item label="执行 Agent">
        <a-select v-model="batch.agentCode" placeholder="默认（按模式自动选择）" allow-clear :loading="batch.agentLoading" :disabled="batch.submitting">
          <a-option v-for="ag in batch.agentList" :key="ag.agent_code" :value="ag.agent_code">
            {{ ag.agent_name }}（{{ ag.agent_code }}）
          </a-option>
        </a-select>
      </a-form-item>
      <a-form-item label="扫描技能">
        <a-select v-model="batch.skillCode" placeholder="默认（按领域自动选择）" allow-clear :loading="batch.skillLoading" :disabled="batch.submitting">
          <a-option v-for="sk in batch.skillList" :key="sk.skill_code" :value="sk.skill_code">
            {{ sk.skill_name }}（{{ sk.skill_code }}）
          </a-option>
        </a-select>
      </a-form-item>
      <a-form-item label="AI 模型">
        <a-select v-model="batch.model" placeholder="选择模型（留空用 Agent 默认）" allow-clear :disabled="batch.submitting">
          <a-option v-for="opt in batch.modelOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </a-option>
        </a-select>
      </a-form-item>
    </a-form>

    <!-- 提交进度与逐行结果（批量入口不跟踪队列进度，完成情况看这一块） -->
    <div v-if="batch.results.length" class="batch-results">
      <div class="batch-summary">
        已提交 {{ batch.doneCount }}/{{ batch.targets.length }} · 成功 {{ batch.okCount }} · 失败 {{ batch.failCount }}{{ batch.skippedCount ? ` · 跳过 ${batch.skippedCount}` : '' }}
      </div>
      <div v-for="item in batch.results" :key="item.run_id" class="batch-result-row">
        <a-tag :color="item.skipped ? 'gray' : item.ok ? 'green' : 'red'" size="small">
          {{ item.skipped ? '跳过' : item.ok ? '成功' : '失败' }}
        </a-tag>
        <span class="batch-result-label">{{ item.label }}</span>
        <span class="batch-result-msg" :title="item.message">{{ item.message }}</span>
      </div>
      <a-typography-text v-if="batch.finished && batch.mode === 'agent'" type="secondary">
        Agent 自主审计的队列进度可在运行列表与任务队列中继续跟踪。
      </a-typography-text>
    </div>
  </a-modal>
</template>

<style scoped>
.batch-hint { color: var(--color-text-3); font-size: 12px; }
.batch-targets { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; max-height: 96px; overflow-x: hidden; overflow-y: auto; }
.batch-results { padding-top: 12px; border-top: 1px solid var(--color-border-2); }
.batch-summary { margin-bottom: 8px; font-weight: 500; }
.batch-result-row { display: flex; align-items: baseline; gap: 8px; padding: 2px 0; }
.batch-result-label { flex-shrink: 0; }
.batch-result-msg { overflow: hidden; color: var(--color-text-3); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
</style>
