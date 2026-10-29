<script setup lang="ts">
/**
 * 配置检查明细筛选栏：状态 / 级别 / 关键词 / 只看本迭代新增。
 *
 * 任一条件变化都 emit search，由 composable 回到第 1 页重新取数。
 */
import type { ConfigItemState, ConfigSeverity } from '@/types/sechub-release'

import {
  CONFIG_SEVERITY_OPTIONS,
  CONFIG_STATE_OPTIONS,
} from '../../../composables/configCheckRules'

const emit = defineEmits<{
  (e: 'search'): void
  (e: 'reset'): void
}>()

const state = defineModel<ConfigItemState | 'all'>('state', { required: true })
const severity = defineModel<'' | ConfigSeverity>('severity', { required: true })
const keyword = defineModel<string>('keyword', { required: true })
const newOnly = defineModel<boolean>('newOnly', { required: true })

const severityOptions = [{ value: '', label: '全部级别' }, ...CONFIG_SEVERITY_OPTIONS]
</script>

<template>
  <a-space wrap class="filters">
    <a-select
      v-model="state"
      :options="CONFIG_STATE_OPTIONS"
      style="width: 140px"
      @change="emit('search')"
    />
    <a-select
      v-model="severity"
      :options="severityOptions"
      style="width: 140px"
      @change="emit('search')"
    />
    <a-input-search
      v-model="keyword"
      allow-clear
      placeholder="对象 key / 名称 / 应用编号"
      style="width: 280px"
      @search="emit('search')"
      @clear="emit('search')"
    />
    <span class="switch-label">
      <a-switch v-model="newOnly" size="small" @change="emit('search')" />
      <span>只看本迭代新增</span>
    </span>
    <a-button @click="emit('reset')">
      重置
    </a-button>
  </a-space>
</template>

<style scoped>
.filters {
  margin-bottom: 8px;
}
.switch-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--color-text-2);
  font-size: 13px;
}
</style>
