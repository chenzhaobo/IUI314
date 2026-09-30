<script lang="ts" setup>
/**
 * 新建摸底计划弹窗：基本信息 → 脚本规范校验 → 压力参数 → 硬件档位。
 *
 * 选脚本后立即校验并把不符合项列出来，有不符合项时禁用「确定」
 * （后端创建时会再校验一次，这里只是不让用户白填一遍）。
 */
import type { CreateProbePayload } from './types'
import type { SelectOption } from '@/types/static-scan'
import { watch } from 'vue'
import HwProfileEditor from './HwProfileEditor.vue'
import { useProbeCreate } from './useProbeCreate'

defineProps<{
  submitting: boolean
  envOptions: SelectOption[]
  scriptOptions: SelectOption[]
  loadNodeOptions: SelectOption[]
}>()

const emit = defineEmits<{
  (e: 'submit', payload: CreateProbePayload): void
}>()

const visible = defineModel<boolean>('visible', { required: true })

const {
  form,
  conformance,
  conformanceLoading,
  conformanceIssues,
  conformanceBlocked,
  bindingOptions,
  bindingsLoading,
  reset,
  checkScript,
  loadBindings,
  buildPayload,
} = useProbeCreate()

watch(visible, (v) => {
  if (v)
    reset()
})

function handleSubmit() {
  const payload = buildPayload()
  if (!payload)
    return
  emit('submit', payload)
}
</script>

<template>
  <a-modal
    v-model:visible="visible"
    title="新建摸底压测计划"
    :width="860"
    :ok-loading="submitting"
    :ok-button-props="{ disabled: conformanceBlocked }"
    ok-text="创建并开跑"
    @ok="handleSubmit"
  >
    <a-form :model="form" layout="vertical">
      <a-row :gutter="16">
        <a-col :span="8">
          <a-form-item label="计划名称" required>
            <a-input v-model="form.name" placeholder="如：订单服务-4C8G 摸底" />
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item label="环境" required>
            <a-select
              v-model="form.env_id"
              :options="envOptions"
              placeholder="选择性能环境"
              allow-clear
              @change="() => loadBindings()"
            />
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item label="脚本" required>
            <a-select
              v-model="form.script_id"
              :options="scriptOptions"
              placeholder="选择摸底脚本"
              allow-search
              allow-clear
              @change="() => checkScript()"
            />
          </a-form-item>
        </a-col>
      </a-row>

      <a-spin :loading="conformanceLoading" class="pcm-conf">
        <a-alert
          v-if="conformanceBlocked"
          type="error"
          title="脚本不满足摸底规范（script-spec §1），不能提交"
        >
          <div v-for="(issue, i) in conformanceIssues" :key="i" class="pcm-issue">
            线程组「{{ issue.thread_group }}」{{ issue.field }}：当前 {{ issue.actual }}，应为 {{ issue.expected }}
          </div>
        </a-alert>
        <a-alert
          v-else-if="conformance"
          type="success"
          title="脚本符合摸底规范"
        />
      </a-spin>

      <a-row :gutter="16">
        <a-col :span="6">
          <a-form-item label="执行机">
            <a-select
              v-model="form.load_node_id"
              :options="loadNodeOptions"
              placeholder="选择执行机"
              allow-clear
            />
          </a-form-item>
        </a-col>
        <a-col :span="6">
          <a-form-item label="目标 TPS">
            <a-input-number
              v-model="form.target_tps"
              :min="0"
              placeholder="留空 = 倍增模式"
              class="pcm-num"
            />
          </a-form-item>
        </a-col>
        <a-col :span="6">
          <a-form-item label="档位合格阈值 k">
            <a-input-number v-model="form.k_factor" :min="0.1" :step="0.1" class="pcm-num" />
          </a-form-item>
        </a-col>
        <a-col :span="6">
          <a-form-item label="探针并发">
            <a-input-number v-model="form.probe_threads" :min="1" class="pcm-num" />
          </a-form-item>
        </a-col>
      </a-row>

      <a-row :gutter="16">
        <a-col :span="6">
          <a-form-item label="爬坡时长(秒)">
            <a-input-number v-model="form.rampup_sec" :min="0" class="pcm-num" />
          </a-form-item>
        </a-col>
        <a-col :span="6">
          <a-form-item label="稳态时长(秒)">
            <a-input-number v-model="form.steady_sec" :min="1" class="pcm-num" />
          </a-form-item>
        </a-col>
        <a-col :span="6">
          <a-form-item label="稳定性时长(秒)">
            <a-input-number v-model="form.stability_sec" :min="1" class="pcm-num" />
          </a-form-item>
        </a-col>
        <a-col :span="6">
          <a-form-item label="最大并发">
            <a-input-number v-model="form.max_threads" :min="2" class="pcm-num" />
          </a-form-item>
        </a-col>
      </a-row>

      <a-form-item label="硬件档位">
        <template #extra>
          档位按顺序执行，每档跑完一条并发阶梯；计划结束（完成 / 失败 / 取消）会自动恢复本页改过的硬件。
        </template>
        <HwProfileEditor
          v-model="form.hw_profiles"
          :options="bindingOptions"
          :loading="bindingsLoading"
        />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<style scoped>
.pcm-conf {
  display: block;
  margin-bottom: 12px;
}

.pcm-issue {
  line-height: 1.8;
}

.pcm-num {
  width: 100%;
}
</style>
