<script setup lang="ts">
/**
 * 发版范围筛选条：产品线 / 迭代 / 产品领域 / 业务领域 / 项目组 + 当前范围说明。
 *
 * 纯展示组件，选项与选择状态都由 `useReleaseScope` 提供；本组件只 emit 字段变更，
 * 联动清空与重新取数由 composable 负责。产品线没有测试环境时展示后端 `env_error`。
 */
import type { ReleaseScopeField } from '../../composables/releaseScopeRules'
import type { ReleaseScopeOptions } from '@/types/sechub-release'
import { computed } from 'vue'

import {
  businessAreaOptionsOf,
  domainOptionsOf,
  iterationOptionsOf,
  productLineOptionsOf,
  projectGroupOptionsOf,
} from '../../composables/releaseScopeRules'

const props = defineProps<{
  productLine: string
  iterationId: string
  productDomain: string
  businessArea: string
  projectGroup: string
  options: ReleaseScopeOptions | null
  /** 后端实际生效的产品领域（未显式选择时回显） */
  effectiveDomains: string[]
  /** 当前生效范围文字说明 */
  summaryText: string
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'change', field: ReleaseScopeField, value: string): void
}>()

type SelectChangeValue = string | number | boolean | Record<string, unknown> | (string | number | boolean | Record<string, unknown>)[] | undefined

const productLineOptions = computed(() => productLineOptionsOf(props.options))
const iterationOptions = computed(() => iterationOptionsOf(props.options))
const domainOptions = computed(() => domainOptionsOf(props.options))
const businessAreaOptions = computed(() => businessAreaOptionsOf(props.options, props.productDomain))
const projectGroupOptions = computed(() => projectGroupOptionsOf(props.options, props.productDomain, props.businessArea))

/** 未显式选择产品领域时，下拉占位显示后端生效的默认领域 */
const domainPlaceholder = computed(() => {
  if (!props.effectiveDomains.length)
    return '产品领域（默认）'
  return `默认：${props.effectiveDomains.join('、')}`
})

const envError = computed(() => props.options?.env_error ?? '')

function toText(value: SelectChangeValue): string {
  return typeof value === 'string' ? value : ''
}

function onChange(field: ReleaseScopeField, value: SelectChangeValue) {
  emit('change', field, toText(value))
}
</script>

<template>
  <a-card :bordered="false" class="scope-bar">
    <a-space wrap :size="12">
      <a-select
        :loading="loading"
        :model-value="productLine"
        :options="productLineOptions"
        placeholder="产品线"
        style="width: 150px"
        @change="onChange('productLine', $event)"
      />
      <a-select
        :loading="loading"
        :model-value="iterationId"
        :options="iterationOptions"
        placeholder="迭代"
        style="width: 240px"
        @change="onChange('iterationId', $event)"
      />
      <a-select
        :loading="loading"
        :model-value="productDomain"
        :options="domainOptions"
        :placeholder="domainPlaceholder"
        allow-clear
        style="width: 190px"
        @change="onChange('productDomain', $event)"
      />
      <a-select
        :disabled="!productDomain"
        :model-value="businessArea"
        :options="businessAreaOptions"
        allow-clear
        placeholder="业务领域"
        style="width: 180px"
        @change="onChange('businessArea', $event)"
      />
      <a-select
        :disabled="!businessArea"
        :model-value="projectGroup"
        :options="projectGroupOptions"
        allow-clear
        placeholder="项目组"
        style="width: 210px"
        @change="onChange('projectGroup', $event)"
      />
    </a-space>
    <div class="scope-summary">
      <span class="scope-label">当前范围</span>
      <span>{{ summaryText }}</span>
    </div>
    <a-alert
      v-if="envError"
      class="scope-alert"
      :show-icon="true"
      type="warning"
    >
      {{ envError }}
    </a-alert>
  </a-card>
</template>

<style scoped>
.scope-bar {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.scope-summary {
  display: flex;
  align-items: baseline;
  gap: 8px;
  color: var(--color-text-2);
  font-size: 12px;
}
.scope-label {
  color: var(--color-text-3);
}
.scope-alert {
  margin-top: 2px;
}
</style>
