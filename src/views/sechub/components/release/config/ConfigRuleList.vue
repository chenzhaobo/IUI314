<script setup lang="ts">
/**
 * 左栏规则列表：按元数据规则（M）/ 清单规则（C）分组，单选过滤右栏明细。
 *
 * 第一行「全部规则」；再点已选规则也回到全部。选中规则时底部展示说明与修复建议，
 * 无需再去表格里找文案。
 */
import type { ConfigRuleGroupRow, ConfigRuleRow } from '../../../composables/configCheckRules'
import { computed } from 'vue'

import { configSeverityMeta } from '../../../composables/configCheckRules'

const props = defineProps<{
  groups: ConfigRuleGroupRow[]
  activeRule: string
  loading: boolean
}>()

const emit = defineEmits<{
  (e: 'select', code: string): void
}>()

const activeRow = computed<ConfigRuleRow | null>(() => {
  if (!props.activeRule)
    return null
  for (const group of props.groups) {
    const row = group.rows.find(item => item.code === props.activeRule)
    if (row)
      return row
  }
  return null
})
</script>

<template>
  <a-card :bordered="false" :loading="loading" class="rule-list">
    <button
      class="all-row"
      :class="{ active: !activeRule }"
      type="button"
      @click="emit('select', '')"
    >
      全部规则
    </button>

    <div v-for="group in groups" :key="group.family" class="group">
      <div class="group-title">
        {{ group.label }}
      </div>
      <button
        v-for="row in group.rows"
        :key="row.code"
        class="rule-row"
        :class="{ active: row.code === activeRule, empty: row.pending === 0 }"
        type="button"
        @click="emit('select', row.code)"
      >
        <span class="line">
          <span class="code">{{ row.code }}</span>
          <a-tag :color="configSeverityMeta(row.severity).color" size="small">
            {{ configSeverityMeta(row.severity).label }}
          </a-tag>
          <span class="count" title="待处理">{{ row.pending }}</span>
          <a-tag v-if="row.new_open" color="arcoblue" size="small" title="本迭代新增">
            +{{ row.new_open }}
          </a-tag>
        </span>
        <span class="title">{{ row.title }}</span>
      </button>
    </div>

    <a-empty v-if="!groups.length" description="当前范围暂无检查结果" />

    <div v-if="activeRow" class="detail">
      <div class="detail-title">
        {{ activeRow.code }} · {{ activeRow.title }}
      </div>
      <p class="description">
        {{ activeRow.description }}
      </p>
      <p class="fix">
        修复建议：{{ activeRow.fix_hint }}
      </p>
    </div>
  </a-card>
</template>

<style scoped>
.rule-list {
  width: 320px;
  flex: 0 0 320px;
}
button {
  width: 100%;
  padding: 6px 8px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--color-text-1);
  text-align: left;
  cursor: pointer;
}
button:hover {
  background: var(--color-fill-2);
}
button.active {
  background: var(--color-primary-light-1);
}
.all-row {
  font-weight: 600;
}
.group-title {
  margin: 10px 0 4px;
  color: var(--color-text-3);
  font-size: 12px;
}
.rule-row .line {
  display: flex;
  align-items: center;
  gap: 6px;
}
.rule-row .code {
  font-family: var(--font-mono);
  font-weight: 500;
}
.rule-row .count {
  margin-left: auto;
  font-weight: 600;
}
.rule-row .title {
  display: block;
  overflow: hidden;
  color: var(--color-text-2);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rule-row.empty .count {
  color: var(--color-text-3);
}
.detail {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--color-border-2);
}
.detail-title {
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 600;
}
.detail p {
  margin: 0 0 6px;
  color: var(--color-text-2);
  font-size: 12px;
  line-height: 1.6;
}
.detail .fix {
  color: var(--color-text-3);
}
</style>
