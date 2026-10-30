<script setup lang="ts">
/**
 * 配置检查汇总条：待处理 / 已提缺陷 / 已加白 / 本迭代新增 / 本迭代修复。
 *
 * 数字来自后端 `totals`（范围口径）；点击某一项 = 把右栏明细的处理状态切成对应筛选，
 * 再点同一项回到默认「未关闭」。
 */
import type { ConfigSummaryCellKey } from '../../../composables/configCheckRules'
import type { ConfigTotals } from '@/types/sechub-release'
import { computed } from 'vue'

const props = defineProps<{
  totals: ConfigTotals | null
  /** 与当前明细筛选匹配的汇总项 */
  active: ConfigSummaryCellKey | ''
}>()

const emit = defineEmits<{
  (e: 'select', key: ConfigSummaryCellKey): void
}>()

const cells = computed<Array<{ key: ConfigSummaryCellKey, label: string, value?: number, tone: string }>>(() => [
  { key: 'pending', label: '待处理', value: props.totals?.pending, tone: 'warn' },
  { key: 'defect_filed', label: '已提缺陷', value: props.totals?.defect_filed, tone: 'info' },
  { key: 'waived', label: '已加白', value: props.totals?.waived, tone: 'muted' },
  { key: 'new_open', label: '本迭代新增', value: props.totals?.new_open, tone: 'warn' },
  { key: 'fixed_in_iteration', label: '本迭代修复', value: props.totals?.fixed_in_iteration, tone: 'ok' },
])
</script>

<template>
  <a-card :bordered="false">
    <div class="totals">
      <button
        v-for="cell in cells"
        :key="cell.key"
        type="button"
        class="cell"
        :class="{ active: cell.key === active }"
        title="点击按该状态筛选明细；再点一次恢复默认「未关闭」"
        @click="emit('select', cell.key)"
      >
        <div class="label">
          {{ cell.label }}
        </div>
        <div class="value" :class="cell.tone">
          {{ cell.value ?? '-' }}
        </div>
      </button>
    </div>
  </a-card>
</template>

<style scoped>
.totals {
  display: grid;
  grid-template-columns: repeat(5, minmax(120px, 1fr));
  gap: 12px;
}
.cell {
  padding: 8px 12px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: var(--color-fill-1);
  text-align: left;
  cursor: pointer;
}
.cell:hover {
  border-color: var(--color-border-2);
}
.cell.active {
  border-color: rgb(var(--primary-6));
  background: var(--color-primary-light-1);
}
.label {
  color: var(--color-text-3);
  font-size: 12px;
}
.value {
  margin-top: 4px;
  color: var(--color-text-1);
  font-size: 22px;
  font-weight: 600;
}
.value.warn {
  color: rgb(var(--warning-6));
}
.value.info {
  color: rgb(var(--primary-6));
}
.value.muted {
  color: var(--color-text-3);
}
.value.ok {
  color: rgb(var(--success-6));
}
</style>
