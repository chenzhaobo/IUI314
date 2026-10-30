<script setup lang="ts">
/**
 * 「按项目组分布」小条：文字 + 待处理数，点击等价于在范围筛选里选中该项目组。
 *
 * 它不是第二个过滤维度：点击后由页面调用 `selectProjectGroup` 写入 ReleaseScopeBar 的范围，
 * 与产品领域 / 业务领域是同一套范围条件。未归属项目组的检查项不可点。
 */
import type { ConfigGroupDistRow } from '../../../composables/configCheckRules'

defineProps<{
  rows: ConfigGroupDistRow[]
  activeGroup: string
}>()

const emit = defineEmits<{
  (e: 'select', code: string): void
}>()

function select(row: ConfigGroupDistRow) {
  if (row.selectable)
    emit('select', row.code)
}

function tipOf(row: ConfigGroupDistRow): string {
  if (!row.selectable)
    return '检查项未归属项目组，无法按项目组筛选'
  const parts = [`待处理 ${row.open}`]
  if (row.high_open)
    parts.push(`高危 ${row.high_open}`)
  if (row.new_open)
    parts.push(`本迭代新增 ${row.new_open}`)
  return `${parts.join(' · ')}（点击按该组筛选范围）`
}
</script>

<template>
  <div class="distribution">
    <span class="label">按项目组分布</span>
    <button
      v-for="row in rows"
      :key="row.code || '__none__'"
      :class="{ active: row.code && row.code === activeGroup, disabled: !row.selectable }"
      :disabled="!row.selectable"
      :title="tipOf(row)"
      type="button"
      @click="select(row)"
    >
      <span class="name">{{ row.name }}</span>
      <span class="count">{{ row.open }}</span>
      <span v-if="row.high_open" class="high">{{ row.high_open }} 高危</span>
    </button>
    <span v-if="!rows.length" class="empty">当前范围暂无待处理检查项</span>
  </div>
</template>

<style scoped>
.distribution {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.label {
  color: var(--color-text-3);
  font-size: 12px;
}
button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border: 1px solid var(--color-border-2);
  border-radius: 12px;
  background: var(--color-fill-1);
  color: var(--color-text-2);
  font-size: 12px;
  cursor: pointer;
}
button:hover {
  border-color: rgb(var(--primary-5));
  color: rgb(var(--primary-6));
}
button.active {
  border-color: rgb(var(--primary-6));
  background: var(--color-primary-light-1);
  color: rgb(var(--primary-6));
}
button.disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
.count {
  font-weight: 600;
}
.high {
  color: rgb(var(--danger-6));
}
.empty {
  color: var(--color-text-3);
  font-size: 12px;
}
</style>
