<script setup lang="ts">
/**
 * 发版范围筛选条：产品线 / 迭代 / 产品领域 / 业务领域 / 项目组 + 当前范围说明。
 *
 * 纯展示组件，选项与选择状态都由 `useReleaseScope` 提供；本组件只 emit 字段变更，
 * 联动清空与重新取数由 composable 负责。产品线没有测试环境时展示后端 `env_error`。
 */
import type { ReleaseScopeField, ScopeOptionItem } from '../../composables/releaseScopeRules'
import type { ReleaseScopeOptions } from '@/types/sechub-release'
import { computed } from 'vue'

import {
  businessAreaOptionsOf,
  cascadeDomainOf,
  domainOptionsOf,
  iterationOptionsOf,
  productLineOptionsOf,
  projectGroupOptionsOf,
  SCOPE_NONE,
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
  /** 应用编码（逗号分隔由页面自行处理；这里只显示一个/一组编码） */
  appNumber?: string
  /** 处理人 */
  handler?: string
  /** 只看处理人是我 */
  mine?: boolean
  /** 左树带出的项目组 / 应用显示名（选项树里查不到时用） */
  projectGroupLabel?: string
  appLabel?: string
  /** 未选产品领域时按「全部产品领域」处理：占位文案改为全部，业务领域不再回退默认领域 */
  allDomainsByDefault?: boolean
}>()

const emit = defineEmits<{
  (e: 'change', field: ReleaseScopeField, value: string): void
  (e: 'toggleMine', value: boolean): void
}>()

type SelectChangeValue = string | number | boolean | Record<string, unknown> | (string | number | boolean | Record<string, unknown>)[] | undefined

/** 未归属固定选项：后端选项树里没有该节点 */
const NONE_OPTION: ScopeOptionItem = { value: SCOPE_NONE, label: '未归属' }

function withNoneOption(items: ScopeOptionItem[]): ScopeOptionItem[] {
  return items.some(item => item.value === SCOPE_NONE) ? items : [...items, NONE_OPTION]
}

const productLineOptions = computed(() => productLineOptionsOf(props.options))
const iterationOptions = computed(() => iterationOptionsOf(props.options))
const domainOptions = computed(() => withNoneOption(domainOptionsOf(props.options)))
/** 未显式选择领域时，用唯一的默认领域驱动业务领域 / 项目组级联；全部领域模式下不回退 */
const cascadeDomain = computed(() => {
  if (props.allDomainsByDefault && !props.productDomain)
    return ''
  return cascadeDomainOf(props.options, props.productDomain, props.effectiveDomains)
})
const businessAreaOptions = computed(() => businessAreaOptionsOf(props.options, cascadeDomain.value))
/** 当前项目组不在级联选项里（如从左树选中、未选领域）时补一项，避免下拉只显示编码 */
const projectGroupOptions = computed(() => {
  const items = withNoneOption(projectGroupOptionsOf(props.options, cascadeDomain.value, props.businessArea))
  const current = props.projectGroup ?? ''
  if (!current || items.some(item => item.value === current))
    return items
  return [{ value: current, label: props.projectGroupLabel || current }, ...items]
})
const projectGroupDisabled = computed(() => !cascadeDomain.value && !props.projectGroup)

const appText = computed(() => props.appNumber === SCOPE_NONE ? '未关联应用' : (props.appLabel || props.appNumber || ''))
const handlerText = computed(() => props.handler === SCOPE_NONE ? '未指定处理人' : (props.handler ?? ''))

/** 未显式选择产品领域时，下拉占位显示后端生效的默认领域；全部领域模式直接说明口径 */
const domainPlaceholder = computed(() => {
  if (props.allDomainsByDefault)
    return '全部产品领域'
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

function onToggleMine(value: string | number | boolean) {
  emit('toggleMine', Boolean(value))
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
        :disabled="!cascadeDomain"
        :model-value="businessArea"
        :options="businessAreaOptions"
        allow-clear
        placeholder="业务领域"
        style="width: 180px"
        @change="onChange('businessArea', $event)"
      />
      <a-select
        :disabled="projectGroupDisabled"
        :model-value="projectGroup"
        :options="projectGroupOptions"
        allow-clear
        placeholder="项目组"
        style="width: 210px"
        @change="onChange('projectGroup', $event)"
      />
      <span class="scope-mine">
        <a-switch :model-value="Boolean(mine)" size="small" @change="onToggleMine" />
        <span>只看我的</span>
      </span>
    </a-space>
    <div class="scope-summary">
      <span class="scope-label">当前范围</span>
      <span>{{ summaryText }}</span>
    </div>
    <a-space v-if="appNumber || handler" :size="8" class="scope-tags">
      <a-tag v-if="appNumber" closable @close="onChange('appNumber', '')">
        应用：{{ appText }}
      </a-tag>
      <a-tag v-if="handler" closable @close="onChange('handler', '')">
        处理人：{{ handlerText }}
      </a-tag>
    </a-space>
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
.scope-mine {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--color-text-2);
  font-size: 12px;
}
.scope-tags {
  margin-top: -2px;
}
.scope-alert {
  margin-top: 2px;
}
</style>
