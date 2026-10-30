<script setup lang="ts">
/**
 * 明细筛选行：处理状态 / 级别 / 只看本迭代新增 / 关键字。
 *
 * 处理状态默认「未关闭」（待处理 + 已提缺陷）；任一变化 emit search，由 composable 回第 1 页。
 */
import type { ConfigHandlingFilter, ConfigSeverity } from '@/types/sechub-release'

import {
  CONFIG_HANDLING_OPTIONS,
  CONFIG_SEVERITY_OPTIONS,
} from '../../../composables/configCheckRules'

const emit = defineEmits<{
  (e: 'search'): void
  (e: 'reset'): void
}>()

const handling = defineModel<ConfigHandlingFilter>('handling', { required: true })
const severity = defineModel<'' | ConfigSeverity>('severity', { required: true })
const keyword = defineModel<string>('keyword', { required: true })
const newOnly = defineModel<boolean>('newOnly', { required: true })

const severityOptions = [{ value: '', label: '全部级别' }, ...CONFIG_SEVERITY_OPTIONS]
</script>

<template>
  <a-space wrap class="filters" :size="8">
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
