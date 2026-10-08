<script setup lang="ts">
/**
 * AI 确认配置弹窗（迁自 SD 2262-2309）。
 *
 * 入口是运行页行的「AI 确认」动作：`open(runId)` 指定要确认的批次；
 * 可切换的批次列表取运行页已有的跨 run 汇总行（`runs`），不再单独拉接口。
 */
import type { CrossRunAggRow } from '@/types/static-scan'
import { computed, reactive } from 'vue'
import AiConfirmScopeField from './AiConfirmScopeField.vue'
import { agentProgressText } from './labels'
import { useAiConfirm } from './useAiConfirm'

defineProps<{
  /** 可选批次：运行页的跨 run 汇总行（每行一个 run） */
  runs: CrossRunAggRow[]
}>()
const emit = defineEmits<{ submitted: [string] }>()

const ai = reactive(useAiConfirm({ onSubmitted: runId => emit('submitted', runId) }))
const progressText = computed(() => (ai.agentProgress ? agentProgressText(ai.agentProgress) : ''))

defineExpose({ open: ai.open })
</script>

<template>
  <a-modal
    v-model:visible="ai.visible"
    title="AI 确认配置"
    ok-text="开始确认"
    cancel-text="取消"
    :ok-loading="ai.confirming"
    @ok="ai.submit"
  >
    <a-form :model="{}" layout="vertical">
      <a-form-item label="目标批次（扫描运行）">
        <a-select v-model="ai.targetRunId" placeholder="选择要确认的扫描批次" @change="ai.onTargetRunChange">
          <a-option v-for="run in runs" :key="run.run_id" :value="run.run_id">
            {{ run.branch || '未知分支' }} | {{ run.commit_sha ? run.commit_sha.slice(0, 8) : '-' }} | {{ run.created_at || '' }} | 疑似{{ run.total }}
          </a-option>
        </a-select>
      </a-form-item>
      <AiConfirmScopeField v-model="ai.scope" :options="ai.scopeOptions" :loading="ai.loadingScanPoints" />
      <a-form-item label="确认模式">
        <a-radio-group v-model="ai.mode" type="button">
          <a-radio value="batch">
            平台编排（批量）
          </a-radio>
          <a-radio value="agent">
            Agent 自主
          </a-radio>
        </a-radio-group>
      </a-form-item>
      <a-form-item label="执行 Agent">
        <a-select v-model="ai.agentCode" placeholder="默认（按模式自动选择）" allow-clear :loading="ai.agentLoading">
          <a-option v-for="ag in ai.agentList" :key="ag.agent_code" :value="ag.agent_code">
            {{ ag.agent_name }}（{{ ag.agent_code }}）
          </a-option>
        </a-select>
      </a-form-item>
      <a-form-item label="扫描技能">
        <a-select v-model="ai.skillCode" placeholder="默认（按领域自动选择）" allow-clear :loading="ai.skillLoading">
          <a-option v-for="sk in ai.skillList" :key="sk.skill_code" :value="sk.skill_code">
            {{ sk.skill_name }}（{{ sk.skill_code }}）
          </a-option>
        </a-select>
      </a-form-item>
      <a-form-item label="AI 模型">
        <a-select v-model="ai.model" placeholder="选择模型（留空用 Agent 默认）" allow-clear>
          <a-option v-for="opt in ai.modelOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </a-option>
        </a-select>
      </a-form-item>
    </a-form>
    <!-- Agent 自主模式提交后弹窗不关，用这一行显示审计进度；跑完由轮询自动关闭并刷新列表 -->
    <a-typography-text v-if="ai.agentProgress" type="secondary">
      {{ progressText }}
    </a-typography-text>
  </a-modal>
</template>
