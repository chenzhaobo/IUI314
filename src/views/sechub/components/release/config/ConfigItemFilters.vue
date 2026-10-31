<script setup lang="ts">
/**
 * 明细筛选行：规则 / 处理状态 / 级别 / 只看本迭代新增 / 关键字。
 *
 * 规则下拉与左侧维度树的规则节点共用 `ruleCode`；处理状态默认「未关闭」（待处理 + 已提缺陷）。
 * 任一变化 emit search，由 composable 回第 1 页。
 */
import type { ConfigRuleRow } from '../../../composables/configCheckRules'
import type { ConfigHandlingFilter, ConfigSeverity } from '@/types/sechub-release'
import { computed } from 'vue'

import {
  CONFIG_HANDLING_OPTIONS,
  CONFIG_SEVERITY_OPTIONS,
} from '../../../composables/configCheckRules'

const props = defineProps<{
  /** 规则下拉选项（来自汇总的 ruleRows） */
  ruleRows: ConfigRuleRow[]
}>()

const emit = defineEmits<{
  (e: 'search'): void
  (e: 'reset'): void
}>()

const ruleCode = defineModel<string>('ruleCode', { required: true })
const handling = defineModel<ConfigHandlingFilter>('handling', { required: true })
const severity = defineModel<'' | ConfigSeverity>('severity', { required: true })
const keyword = defineModel<string>('keyword', { required: true })
const newOnly = defineModel<boolean>('newOnly', { required: true })

const severityOptions = [{ value: '', label: '全部级别' }, ...CONFIG_SEVERITY_OPTIONS]
const ruleOptions = computed(() => [
  { value: '', label: '全部规则' },
  ...props.ruleRows.map(row => ({ value: row.code, label: `${row.code} ${row.title}` })),
])

function onRuleChange(value: unknown) {
  ruleCode.value = typeof value === 'string' ? value : ''
  emit('search')
}
</script>

<template>
  <a-space wrap class="filters" :size="8">
    <a-select
      :model-value="ruleCode"
      :options="ruleOptions"
      allow-clear
      placeholder="全部规则"
      style="width: 240px"
      @change="onRuleChange"
    />
    <a-select
      v-model="handling"
      :options="CONFIG_HANDLING_OPTIONS"
      style="width: 220px"
      @change="emit('search')"
    />
    <a-select
      v-model="severity"
      :options="severityOptions"
      style="width: 130px"
      @change="emit('search')"
    />
    <span class="switch-label">
      <a-switch v-model="newOnly" size="small" @change="emit('search')" />
      <span>只看本迭代新增</span>
    </span>
    <a-input-search
      v-model="keyword"
      allow-clear
      placeholder="对象 key / 名称 / 应用编号"
      style="width: 260px"
      @search="emit('search')"
      @clear="emit('search')"
    />
    <a-button @click="emit('reset')">
      重置
    </a-button>
  </a-space>
</template>

<style scoped>
.switch-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--color-text-2);
  font-size: 13px;
}
</style>
