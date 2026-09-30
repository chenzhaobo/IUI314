<script setup lang="ts">
/**
 * 新建扫描弹窗（壳）：仓库选择 + 扫描方式（默认统一扫描；过渡期旧轨两步向导）的切换与底部动作。
 *
 * 状态机在 useNewScan（组合式函数），范围/资产与冻结计划预览拆给两个步骤组件，
 * 三者通过 provide/inject 共享同一份 reactive 状态（避免几十个 prop 来回透传）。
 */
import { provide, reactive } from 'vue'
import NewScanDeltaStep from './NewScanDeltaStep.vue'
import NewScanTargetStep from './NewScanTargetStep.vue'
import { NEW_SCAN_KEY, useNewScan } from './useNewScan'

const props = defineProps<{
  /** 「该应用已有 N 条扫描记录」幂等提示的计数来源（运行页按 repository_id 统计） */
  runCountOf?: (repositoryId: string) => number
}>()
const emit = defineEmits<{ created: [string] }>()

const ctx = reactive(useNewScan({
  runCountOf: props.runCountOf,
  onCreated: runId => emit('created', runId),
}))
provide(NEW_SCAN_KEY, ctx)

defineExpose({ open: ctx.open })
</script>

<template>
  <a-modal
    v-model:visible="ctx.visible"
    title="新建扫描"
    :width="900"
    :footer="false"
  >
    <a-form :model="{}" layout="vertical">
      <!-- 仓库差量两步向导：第 1 步选范围与策略，第 2 步核对冻结计划再执行。
           a-steps 的 current 从 1 开始计数，ctx.step 是 0 基索引，显示时 +1 -->
      <a-steps v-if="ctx.isDeltaWizard" :current="ctx.step + 1" size="small" style="margin-bottom: 12px">
        <a-step>选择范围与策略</a-step>
        <a-step>核对计划并执行</a-step>
      </a-steps>
      <!-- 待扫描的应用（仓库）：原来是看板左树选中的仓库，现在在弹窗里选。
           select 的 value 用 repository_id 而不是对象——对象比较依赖引用相等，reactive 后容易选不中。
           从运行页左树带仓库打开时锁定选择，弹窗展示的就是左树选定的范围 -->
      <a-form-item>
        <template #label>
          应用（仓库）
          <span v-if="ctx.repositoryLocked" class="repo-lock-hint">已按左侧应用范围锁定</span>
        </template>
        <a-select
          :model-value="ctx.repository?.repository_id"
          :loading="ctx.repoLoading"
          :disabled="ctx.repositoryLocked"
          placeholder="选择要扫描的应用"
          allow-search
          style="width: 100%"
          @change="ctx.onRepositoryChange"
        >
          <a-option v-for="repo in ctx.repoOptions" :key="repo.repository_id" :value="repo.repository_id">
            {{ repo.module_name }} / {{ repo.repository_name }}
          </a-option>
        </a-select>
      </a-form-item>
      <NewScanTargetStep v-if="!ctx.isDeltaWizard || ctx.step === 0" />
      <NewScanDeltaStep v-if="ctx.isDeltaWizard && ctx.step === 1 && ctx.deltaPreview" />
      <a-space style="display: flex; justify-content: flex-end; margin-top: 12px">
        <a-button @click="ctx.visible = false">
          取消
        </a-button>
        <a-button
          v-if="ctx.isUnified"
          type="primary"
          :loading="ctx.triggeringUnified"
          :disabled="!ctx.unifiedCanSubmit"
          @click="ctx.submitUnified"
        >
          开始统一扫描
        </a-button>
        <a-button
          v-else-if="ctx.isDomainTarget || ctx.isLocalRepository"
          type="primary"
          :loading="ctx.executingDelta"
          :disabled="ctx.isDomainTarget && ctx.selectedAssetIds.length === 0"
          @click="ctx.confirmScope(false)"
        >
          {{ ctx.isDomainTarget ? '冻结资产范围并扫描' : '开始全量扫描' }}
        </a-button>
        <template v-else>
          <a-button v-if="ctx.step === 1" @click="ctx.step = 0">
            上一步
          </a-button>
          <a-button
            v-if="ctx.step === 0"
            type="primary"
            :loading="ctx.previewingDelta"
            @click="ctx.confirmScope(false)"
          >
            下一步：生成差量计划
          </a-button>
          <a-button v-else type="primary" :loading="ctx.executingDelta" @click="ctx.executePreview">
            确认执行冻结计划
          </a-button>
        </template>
      </a-space>
      <a-alert v-if="ctx.runCount > 0" type="info" style="margin-top: 4px">
        该应用已有 {{ ctx.runCount }} 条扫描记录，相同代码和规则不会重复扫描（幂等保护）。
      </a-alert>
    </a-form>
  </a-modal>
</template>

<style scoped>
.repo-lock-hint { margin-left: 8px; color: var(--color-text-3); font-size: 12px; font-weight: 400; }
</style>
