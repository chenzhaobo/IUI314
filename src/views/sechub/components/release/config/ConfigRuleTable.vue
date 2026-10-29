<script setup lang="ts">
/**
 * 规则统计表（按当前页签过滤后的 by_rule）。
 * 规则编号悬停展示规则说明与修复建议；点击行 emit 规则编号，再次点击取消过滤。
 */
import type { TableData } from '@arco-design/web-vue'
import type { ConfigRuleDef, ConfigRuleStat } from '@/types/sechub-release'

import { configSeverityMeta, ruleTooltipText } from '../../../composables/configCheckRules'

const props = defineProps<{
  rows: ConfigRuleStat[]
  /** 规则编号 → 规则定义（提示文案） */
  defs: Record<string, ConfigRuleDef>
  /** 当前过滤的规则编号 */
  activeRule: string
  loading: boolean
}>()

const emit = defineEmits<{
  (e: 'select', ruleCode: string): void
}>()

// Arco 的行回调收 TableData，这里只读规则编号
function ruleCode(record: TableData): string {
  return (record as unknown as ConfigRuleStat).rule_code
}

function hasDef(code: string): boolean {
  return Boolean(props.defs[code])
}

function tipOf(code: string): string {
  const def = props.defs[code]
  return def ? ruleTooltipText(def) : ''
}

function rowClass(record: TableData): string {
  return ruleCode(record) === props.activeRule ? 'active-row' : ''
}

function onRowClick(record: TableData) {
  emit('select', ruleCode(record))
}
</script>

<template>
  <a-table
    :data="rows"
    :loading="loading"
    :pagination="false"
    :row-class="rowClass"
    :scroll="{ minWidth: 760 }"
    row-key="rule_code"
    size="small"
    @row-click="onRowClick"
  >
    <template #columns>
      <a-table-column title="规则编号" :width="120">
        <template #cell="{ record }">
          <a-tooltip
            v-if="hasDef(record.rule_code)"
            :content="tipOf(record.rule_code)"
            content-class="config-rule-tip"
            position="top"
          >
            <span class="rule-code">{{ record.rule_code }}</span>
          </a-tooltip>
          <span v-else class="rule-code">{{ record.rule_code }}</span>
        </template>
      </a-table-column>
      <a-table-column title="规则名称" data-index="title" ellipsis tooltip />
      <a-table-column title="级别" :width="90">
        <template #cell="{ record }">
          <a-tag :color="configSeverityMeta(record.severity).color" size="small">
            {{ configSeverityMeta(record.severity).label }}
          </a-tag>
        </template>
      </a-table-column>
      <a-table-column title="待处理" data-index="open" :width="90" />
      <a-table-column title="本迭代新增" data-index="new_open" :width="110" />
      <a-table-column title="本迭代修复" data-index="fixed_in_iteration" :width="110" />
      <a-table-column title="已加白" data-index="waived" :width="90" />
    </template>
    <template #empty>
      <a-empty description="当前页签暂无检查结果" />
    </template>
  </a-table>
</template>

<style scoped>
.rule-code {
  color: rgb(var(--primary-6));
  font-family: var(--font-mono);
  cursor: help;
}
:deep(.active-row td) {
  background: var(--color-primary-light-1);
}
:deep(.arco-table-tr) {
  cursor: pointer;
}
</style>

<style>
/* 提示文案含换行（说明 + 修复建议），按 pre-line 渲染 */
.config-rule-tip {
  white-space: pre-line;
}
</style>
