<script setup lang="ts">
/**
 * 新建扫描弹窗（壳）：仓库选择 + 统一扫描表单（分支 / 目标 commit / 扫描方式与基线 / 规则目录 / 规则范围）。
 *
 * 20261008：过渡期旧轨（整仓差量向导 / 表单资产 / 微服务资产）已移除；反编译源码库仍只能整仓全量。
 * 状态机在 useNewScan，各字段拆成子组件，通过 provide/inject 共享同一份 reactive 状态。
 */
import { provide, reactive } from 'vue'
import NewScanRuleScopeField from './NewScanRuleScopeField.vue'
import NewScanRuleSetField from './NewScanRuleSetField.vue'
import NewScanSourceFields from './NewScanSourceFields.vue'
import NewScanStrategyField from './NewScanStrategyField.vue'
import NewScanUnifiedSummary from './NewScanUnifiedSummary.vue'
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
      <!-- 待扫描的应用（仓库）。select 的 value 用 repository_id 而不是对象——对象比较依赖引用相等，
           reactive 后容易选不中。从运行页左树带仓库打开时锁定选择 -->
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
      <template v-if="ctx.isLocalRepository">
        <a-alert type="info" style="margin-bottom: 12px">
          当前为反编译源码库，将直接全量扫描登记目录；不读取 Git 分支、Commit 或增量基线。
        </a-alert>
        <NewScanRuleSetField />
      </template>
      <template v-else-if="ctx.repository">
        <NewScanUnifiedSummary />
        <NewScanSourceFields />
        <NewScanStrategyField />
        <NewScanRuleSetField />
        <NewScanRuleScopeField />
      </template>
      <a-space style="display: flex; justify-content: flex-end; margin-top: 12px">
        <a-button @click="ctx.visible = false">
          取消
        </a-button>
        <a-button v-if="ctx.isLocalRepository" type="primary" :loading="ctx.executingFull" @click="ctx.submitLocalFull">
          开始全量扫描
        </a-button>
        <a-button
          v-else
          type="primary"
          :loading="ctx.triggeringUnified"
          :disabled="!ctx.unifiedCanSubmit"
          @click="ctx.submitUnified"
        >
          {{ ctx.isPartialScope ? '开始部分扫描' : ctx.strategy === 'incremental' ? '开始增量扫描' : '开始全量扫描' }}
        </a-button>
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
