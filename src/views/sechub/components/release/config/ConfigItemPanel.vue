<script setup lang="ts">
/**
 * 右栏明细：批量生成缺陷入口 + 明细筛选 + 规则说明 + 明细表 + 分页。
 *
 * 项目组维度由左侧树承担；批量生成缺陷要求先选中规则（筛选条或左树规则节点）。
 */
import type { PaginationProps } from '@arco-design/web-vue'
import type { ConfigRuleRow } from '../../../composables/configCheckRules'
import type {
  ConfigFieldDef,
  ConfigHandlingFilter,
  ConfigItem,
  ConfigSeverity,
} from '@/types/sechub-release'
import { computed } from 'vue'

import ConfigItemFilters from './ConfigItemFilters.vue'
import ConfigItemTable from './ConfigItemTable.vue'

const props = defineProps<{
  ruleRows: ConfigRuleRow[]
  list: ConfigItem[]
  loading: boolean
  pagination: PaginationProps
  fieldDefs: Record<string, ConfigFieldDef>
  productLine: string
  defectLoadingId: string
}>()

const emit = defineEmits<{
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

const ruleCode = defineModel<string>('ruleCode', { required: true })
const handling = defineModel<ConfigHandlingFilter>('handling', { required: true })
const severity = defineModel<'' | ConfigSeverity>('severity', { required: true })
const keyword = defineModel<string>('keyword', { required: true })
const newOnly = defineModel<boolean>('newOnly', { required: true })

/** 选中规则时在明细上方展示说明与修复建议 */
const activeRuleRow = computed<ConfigRuleRow | null>(
  () => props.ruleRows.find(row => row.code === ruleCode.value) ?? null,
)
</script>

<template>
  <a-card :bordered="false" class="item-panel">
    <div class="panel-head">
      <div class="batch">
        <span v-if="ruleCode" class="hint">规则 {{ ruleCode }}</span>
        <a-button
          :disabled="!ruleCode"
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
      v-model:rule-code="ruleCode"
      v-model:severity="severity"
      :rule-rows="ruleRows"
      class="filters"
      @reset="emit('reset')"
      @search="emit('search')"
    />

    <div v-if="activeRuleRow" class="rule-detail">
      <div class="rule-detail-title">
        {{ activeRuleRow.code }} · {{ activeRuleRow.title }}
      </div>
      <p class="rule-description">
        {{ activeRuleRow.description }}
      </p>
      <p class="rule-fix">
        修复建议：{{ activeRuleRow.fix_hint }}
      </p>
    </div>

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
.rule-detail {
  margin-bottom: 10px;
  padding: 8px 10px;
  border-radius: 4px;
  background: var(--color-fill-1);
}
.rule-detail-title {
  margin-bottom: 4px;
  font-size: 13px;
  font-weight: 600;
}
.rule-detail p {
  margin: 0 0 4px;
  color: var(--color-text-2);
  font-size: 12px;
  line-height: 1.6;
}
.rule-detail .rule-fix {
  margin-bottom: 0;
  color: var(--color-text-3);
}
</style>
