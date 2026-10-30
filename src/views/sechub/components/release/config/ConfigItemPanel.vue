<script setup lang="ts">
/**
 * 右栏明细：按项目组分布 + 批量生成缺陷入口 + 明细筛选 + 明细表 + 分页。
 *
 * 项目组分布只是范围条件的快捷入口（写回 ReleaseScopeBar），不是第二个过滤维度；
 * 批量生成缺陷要求先在左栏选中规则。
 */
import type { PaginationProps } from '@arco-design/web-vue'
import type { ConfigGroupDistRow } from '../../../composables/configCheckRules'
import type {
  ConfigFieldDef,
  ConfigHandlingFilter,
  ConfigItem,
  ConfigSeverity,
} from '@/types/sechub-release'

import ConfigGroupDistribution from './ConfigGroupDistribution.vue'
import ConfigItemFilters from './ConfigItemFilters.vue'
import ConfigItemTable from './ConfigItemTable.vue'

defineProps<{
  groupRows: ConfigGroupDistRow[]
  activeGroup: string
  selectedRuleCode: string
  list: ConfigItem[]
  loading: boolean
  pagination: PaginationProps
  fieldDefs: Record<string, ConfigFieldDef>
  productLine: string
  defectLoadingId: string
}>()

const emit = defineEmits<{
  (e: 'selectGroup', code: string): void
  (e: 'generateBatch'): void
  (e: 'createDefect', item: ConfigItem): void
  (e: 'viewDefect', item: ConfigItem): void
  (e: 'addWaiver', item: ConfigItem): void
  (e: 'viewEvents', item: ConfigItem): void
  (e: 'search'): void
  (e: 'reset'): void
  (e: 'pageChange', page: number): void
  (e: 'pageSizeChange', size: number): void
}>()

const handling = defineModel<ConfigHandlingFilter>('handling', { required: true })
const severity = defineModel<'' | ConfigSeverity>('severity', { required: true })
const keyword = defineModel<string>('keyword', { required: true })
const newOnly = defineModel<boolean>('newOnly', { required: true })
</script>

<template>
  <a-card :bordered="false" class="item-panel">
    <div class="panel-head">
      <ConfigGroupDistribution
        :active-group="activeGroup"
        :rows="groupRows"
        @select="code => emit('selectGroup', code)"
      />
      <div class="batch">
        <span v-if="selectedRuleCode" class="hint">规则 {{ selectedRuleCode }}</span>
        <a-button
          :disabled="!selectedRuleCode"
          type="primary"
          @click="emit('generateBatch')"
        >
          按项目组生成缺陷
        </a-button>
      </div>
    </div>

    <ConfigItemFilters
      v-model:handling="handling"
      v-model:keyword="keyword"
      v-model:new-only="newOnly"
      v-model:severity="severity"
      class="filters"
      @reset="emit('reset')"
      @search="emit('search')"
    />

    <ConfigItemTable
      :defect-loading-id="defectLoadingId"
      :field-defs="fieldDefs"
      :list="list"
      :loading="loading"
      :pagination="pagination"
      :product-line="productLine"
      @add-waiver="item => emit('addWaiver', item)"
      @create-defect="item => emit('createDefect', item)"
      @page-change="page => emit('pageChange', page)"
      @page-size-change="size => emit('pageSizeChange', size)"
      @view-defect="item => emit('viewDefect', item)"
      @view-events="item => emit('viewEvents', item)"
    />
  </a-card>
</template>

<style scoped>
.item-panel {
  min-width: 0;
  flex: 1;
}
.panel-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}
.batch {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}
.hint {
  color: var(--color-text-3);
  font-size: 12px;
}
.filters {
  margin-bottom: 10px;
}
</style>
