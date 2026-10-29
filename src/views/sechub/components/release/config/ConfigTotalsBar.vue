<script setup lang="ts">
/**
 * 配置检查汇总卡：待处理 / 高危待处理 / 本迭代新增 / 本迭代修复 / 已加白。
 *
 * 数字取自后端 `totals`（范围口径，不叠加列表筛选）。
 */
import type { ConfigTotals } from '@/types/sechub-release'
import { computed } from 'vue'

const props = defineProps<{ totals: ConfigTotals | null }>()

const cells = computed(() => [
  { key: 'open', label: '待处理', value: props.totals?.open, tone: 'default' },
  { key: 'high_open', label: '高危待处理', value: props.totals?.high_open, tone: 'danger' },
  { key: 'new_open', label: '本迭代新增', value: props.totals?.new_open, tone: 'warn' },
  { key: 'fixed_in_iteration', label: '本迭代修复', value: props.totals?.fixed_in_iteration, tone: 'ok' },
  { key: 'waived', label: '已加白', value: props.totals?.waived, tone: 'default' },
])
</script>

<template>
  <a-card :bordered="false">
    <div class="totals">
      <div v-for="cell in cells" :key="cell.key" class="cell">
        <div class="label">
          {{ cell.label }}
        </div>
        <div class="value" :class="cell.tone">
          {{ cell.value ?? '-' }}
        </div>
      </div>
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
  border-radius: 4px;
  background: var(--color-fill-1);
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
.value.danger {
  color: rgb(var(--danger-6));
}
.value.warn {
  color: rgb(var(--warning-6));
}
.value.ok {
  color: rgb(var(--success-6));
}
</style>
