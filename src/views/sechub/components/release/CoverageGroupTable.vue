<script setup lang="ts">
/**
 * 项目组覆盖统计表：全范围（不受接口列表筛选影响）的按组汇总。
 * 点击行 emit 项目组编码，页面据此过滤接口列表；再次点击同一行取消过滤。
 */
import type { CoverageGroupRow } from '@/types/sechub-release'

import { coverageRateText } from '../../composables/releaseCoverageRules'

const props = defineProps<{
  groups: CoverageGroupRow[]
  /** 当前过滤的项目组编码 */
  activeGroup: string
}>()

const emit = defineEmits<{
  (e: 'select', projectGroupCode: string): void
}>()

function rowClass(record: { project_group_code: string }): string {
  return record.project_group_code === props.activeGroup ? 'active-row' : ''
}

function onRowClick(record: { project_group_code: string }) {
  emit('select', record.project_group_code)
}
</script>

<template>
  <a-table
    :data="groups"
    :pagination="false"
    :row-class="(record) => rowClass(record)"
    :scroll="{ minWidth: 1080 }"
    row-key="project_group_code"
    size="small"
    @row-click="onRowClick"
  >
    <template #columns>
      <a-table-column title="项目组" :width="200" ellipsis tooltip>
        <template #cell="{ record }">
          <div class="group-name">
            {{ record.project_group_name || '未分类' }}
          </div>
          <div class="group-code">
            {{ record.project_group_code || '-' }}
          </div>
        </template>
      </a-table-column>
      <a-table-column title="总数" data-index="total" :width="80" />
      <a-table-column title="已覆盖" data-index="covered" :width="90" />
      <a-table-column title="覆盖率" :width="90">
        <template #cell="{ record }">
          {{ coverageRateText(record.covered, record.total) }}
        </template>
      </a-table-column>
      <a-table-column title="新增 / 已覆盖" :width="130">
        <template #cell="{ record }">
          {{ record.new_total }} / {{ record.new_covered }}
        </template>
      </a-table-column>
      <a-table-column title="未覆盖" data-index="uncovered" :width="90" />
      <a-table-column title="待评审" data-index="pending_review" :width="90" />
      <a-table-column title="未通过" data-index="failed" :width="90" />
      <a-table-column title="阻塞" data-index="blocked" :width="80" />
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
