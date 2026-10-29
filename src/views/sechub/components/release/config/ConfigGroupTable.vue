<script setup lang="ts">
/**
 * 项目组统计表（by_group，范围口径）。
 * 点击行 emit 项目组编码，页面据此过滤明细；再次点击同一行取消过滤。
 */
import type { TableData } from '@arco-design/web-vue'
import type { ConfigGroupStat } from '@/types/sechub-release'

const props = defineProps<{
  rows: ConfigGroupStat[]
  /** 当前过滤的项目组编码 */
  activeGroup: string
  loading: boolean
}>()

const emit = defineEmits<{
  (e: 'select', projectGroupCode: string): void
}>()

// Arco 的行回调收 TableData，这里只读项目组编码
function groupCode(record: TableData): string {
  return (record as unknown as ConfigGroupStat).project_group_code
}

function rowClass(record: TableData): string {
  return groupCode(record) === props.activeGroup ? 'active-row' : ''
}

function onRowClick(record: TableData) {
  emit('select', groupCode(record))
}
</script>

<template>
  <a-table
    :data="rows"
    :loading="loading"
    :pagination="false"
    :row-class="rowClass"
    :scroll="{ minWidth: 720 }"
    row-key="project_group_code"
    size="small"
    @row-click="onRowClick"
  >
    <template #columns>
      <a-table-column title="项目组" :width="220" ellipsis tooltip>
        <template #cell="{ record }">
          <div class="group-name">
            {{ record.project_group_name || '未分类' }}
          </div>
          <div class="group-code">
            {{ record.project_group_code || '-' }}
          </div>
        </template>
      </a-table-column>
      <a-table-column title="待处理" data-index="open" :width="100" />
      <a-table-column title="高危待处理" data-index="high_open" :width="110" />
      <a-table-column title="本迭代新增" data-index="new_open" :width="110" />
      <a-table-column title="已加白" data-index="waived" :width="100" />
    </template>
    <template #empty>
      <a-empty description="当前范围暂无项目组检查结果" />
    </template>
  </a-table>
</template>

<style scoped>
.group-name {
  color: var(--color-text-1);
  font-weight: 500;
}
.group-code {
  color: var(--color-text-3);
  font-size: 12px;
}
:deep(.active-row td) {
  background: var(--color-primary-light-1);
}
:deep(.arco-table-tr) {
  cursor: pointer;
}
</style>
