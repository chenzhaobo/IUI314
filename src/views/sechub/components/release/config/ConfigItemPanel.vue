<script setup lang="ts">
/**
 * 检查明细面板：筛选栏 + 明细表 + 分页。
 *
 * 筛选条件用 defineModel 双向绑定到页面的 filters；
 * 条件变化 emit search，由 composable 回到第 1 页重新取数。
 */
import type { PaginationProps } from '@arco-design/web-vue'
import type { ConfigItem, ConfigItemState, ConfigSeverity } from '@/types/sechub-release'

import ConfigItemFilters from './ConfigItemFilters.vue'
import ConfigItemTable from './ConfigItemTable.vue'

defineProps<{
  list: ConfigItem[]
  loading: boolean
  pagination: PaginationProps
  total: number
}>()

const emit = defineEmits<{
  (e: 'search'): void
  (e: 'reset'): void
  (e: 'pageChange', page: number): void
  (e: 'pageSizeChange', size: number): void
  (e: 'viewEvents', item: ConfigItem): void
  (e: 'addWaiver', item: ConfigItem): void
}>()

const state = defineModel<ConfigItemState | 'all'>('state', { required: true })
const severity = defineModel<'' | ConfigSeverity>('severity', { required: true })
const keyword = defineModel<string>('keyword', { required: true })
const newOnly = defineModel<boolean>('newOnly', { required: true })
</script>

<template>
  <a-card :bordered="false">
    <div class="toolbar">
      <div class="title">
        检查明细
      </div>
      <span class="hint">共 {{ total }} 项</span>
    </div>
    <ConfigItemFilters
      v-model:state="state"
      v-model:severity="severity"
      v-model:keyword="keyword"
      v-model:new-only="newOnly"
      @reset="emit('reset')"
      @search="emit('search')"
    />
    <ConfigItemTable
      :list="list"
      :loading="loading"
      :pagination="pagination"
      @add-waiver="item => emit('addWaiver', item)"
      @page-change="page => emit('pageChange', page)"
      @page-size-change="size => emit('pageSizeChange', size)"
      @view-events="item => emit('viewEvents', item)"
    />
  </a-card>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.title {
  color: var(--color-text-1);
  font-size: 14px;
  font-weight: 600;
}
.hint {
  color: var(--color-text-3);
  font-size: 12px;
}
</style>
