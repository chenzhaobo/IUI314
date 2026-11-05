<script setup lang="ts">
/** 问题清单表格：勾选 + 分页；点行打开详情 */
import type { PaginationProps } from '@arco-design/web-vue'
import type { IssueRow } from '../types'
import { formatTime } from '@/hooks'
import { ISSUE_LEVEL, ISSUE_STATUS, REPRO_STATE, tagMeta } from '../../shared/types'

defineProps<{
  data: IssueRow[]
  loading: boolean
  pagination: PaginationProps
  tableHeight?: number
}>()

const emit = defineEmits<{
  (e: 'pageChange', page: number): void
  (e: 'pageSizeChange', size: number): void
  (e: 'open', row: IssueRow): void
}>()

const selectedKeys = defineModel<string[]>('selectedKeys', { required: true })

const rowSelection = { type: 'checkbox', showCheckedAll: true, onlyCurrent: true } as const

function valueText(row: IssueRow): string {
  const act = row.max_act_value ?? '-'
  const threshold = row.threshold ?? '-'
  return `${act} / ${threshold}`
}

function onRowClick(record: Record<string, unknown>) {
  emit('open', record as unknown as IssueRow)
}
</script>

<template>
  <a-table
    v-model:selected-keys="selectedKeys"
    :data="data"
    :loading="loading"
    :pagination="pagination"
    :row-selection="rowSelection"
    row-key="id"
    :scroll="{ minWidth: 1900, y: tableHeight }"
    class="issue-table"
    @page-change="emit('pageChange', $event)"
    @page-size-change="emit('pageSizeChange', $event)"
    @row-click="onRowClick"
  >
    <template #columns>
      <a-table-column title="标题" data-index="title" :width="300" fixed="left">
        <template #cell="{ record }">
          <div class="title-cell">
            <a-link class="title-text" :title="record.title">
              {{ record.title }}
            </a-link>
            <span v-if="record.op_anchor" class="sub-text" :title="record.op_anchor">{{ record.op_anchor }}</span>
          </div>
        </template>
      </a-table-column>
      <a-table-column title="审计类型" data-index="audit_type_label" :width="140" ellipsis tooltip />
      <a-table-column title="领域" data-index="domain" :width="110" ellipsis tooltip />
      <a-table-column title="项目组" data-index="project_group_name" :width="150" ellipsis tooltip>
        <template #cell="{ record }">
          <span v-if="record.project_group_name">{{ record.project_group_name }}</span>
          <a-tag v-else color="orange" size="small">
            未归类
          </a-tag>
        </template>
      </a-table-column>
      <a-table-column title="实际值/阈值" :width="130">
        <template #cell="{ record }">
          {{ valueText(record) }}
        </template>
      </a-table-column>
      <a-table-column title="优先级" data-index="level" :width="80">
        <template #cell="{ record }">
          <a-tag :color="tagMeta(ISSUE_LEVEL, record.level).color" size="small">
            {{ tagMeta(ISSUE_LEVEL, record.level).label }}
          </a-tag>
        </template>
      </a-table-column>
      <a-table-column title="复现状态" data-index="repro_state" :width="90">
        <template #cell="{ record }">
          <a-tag :color="tagMeta(REPRO_STATE, record.repro_state).color" size="small">
            {{ tagMeta(REPRO_STATE, record.repro_state).label }}
          </a-tag>
        </template>
      </a-table-column>
      <a-table-column title="状态" data-index="status" :width="90">
        <template #cell="{ record }">
          <a-tag :color="tagMeta(ISSUE_STATUS, record.status).color" size="small">
            {{ tagMeta(ISSUE_STATUS, record.status).label }}
          </a-tag>
        </template>
      </a-table-column>
      <a-table-column title="处理人" data-index="handler_name" :width="100" ellipsis tooltip />
      <a-table-column title="预计完成" data-index="plan_finish_date" :width="110">
        <template #cell="{ record }">
          <span :class="{ 'overdue-text': record.overdue }">{{ record.plan_finish_date || '-' }}</span>
        </template>
      </a-table-column>
      <a-table-column title="用户故事" data-index="story_no" :width="120" ellipsis tooltip />
      <a-table-column title="缺陷编码" data-index="defect_code" :width="120" ellipsis tooltip />
      <a-table-column title="最近出现" data-index="last_seen_at" :width="170">
        <template #cell="{ record }">
          {{ formatTime(record.last_seen_at) }}
        </template>
      </a-table-column>
      <a-table-column title="出现轮次" data-index="hit_rounds" :width="90" />
    </template>
  </a-table>
</template>

<style scoped>
.issue-table :deep(.arco-table-tr) { cursor: pointer; }
.title-cell { display: flex; flex-direction: column; min-width: 0; }
.title-text { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sub-text {
  overflow: hidden;
  color: var(--color-text-3);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.overdue-text { color: rgb(var(--danger-6)); font-weight: 600; }
</style>
