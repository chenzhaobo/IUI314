<script setup lang="ts">
/**
 * 缺陷草稿列表：编号 / 标题 / 项目组 / 应用 / 级别 / 状态 / 发现时间 / 外部编号。
 *
 * 行内提供「复制标题」「复制内容」「查看」，状态流转收进「状态操作」下拉，
 * 只渲染当前状态合法的流转（规则见 `defectDraftRules.defectActions`）。
 */
import type { DefectAction } from '../../../composables/defectDraftRules'
import type { ReleaseDefect } from '@/types/sechub-release'
import { formatTime } from '@/hooks'

import {
  defectActions,
  defectPriorityColor,
  defectPriorityLabel,
  defectSourceLabel,
  defectStatusColor,
  defectStatusLabel,
} from '../../../composables/defectDraftRules'

interface TablePagination {
  current: number
  pageSize: number
  total: number
  showTotal: boolean
  showPageSize: boolean
}

defineProps<{
  list: ReleaseDefect[]
  loading: boolean
  pagination: TablePagination
}>()

const emit = defineEmits<{
  (e: 'copyTitle', defect: ReleaseDefect): void
  (e: 'copyContent', defect: ReleaseDefect): void
  (e: 'view', defect: ReleaseDefect): void
  (e: 'action', defect: ReleaseDefect, action: DefectAction): void
  (e: 'pageChange', page: number): void
  (e: 'pageSizeChange', size: number): void
}>()

function onActionSelect(defect: ReleaseDefect, value: unknown) {
  const action = defectActions(defect.status).find(item => item.key === value)
  if (action)
    emit('action', defect, action)
}
</script>

<template>
  <a-table
    :data="list"
    :loading="loading"
    :pagination="pagination"
    :scroll="{ minWidth: 1420 }"
    row-key="id"
    size="small"
    @page-change="emit('pageChange', $event)"
    @page-size-change="emit('pageSizeChange', $event)"
  >
    <template #columns>
      <a-table-column title="编号" :width="150" ellipsis tooltip>
        <template #cell="{ record }">
          {{ record.defect_code }}
        </template>
      </a-table-column>
      <a-table-column title="标题" :width="320" ellipsis tooltip>
        <template #cell="{ record }">
          {{ record.title }}
        </template>
      </a-table-column>
      <a-table-column title="项目组" :width="140" ellipsis tooltip>
        <template #cell="{ record }">
          {{ record.project_group_name || '-' }}
        </template>
      </a-table-column>
      <a-table-column title="应用" :width="130" ellipsis tooltip>
        <template #cell="{ record }">
          <div>{{ record.app_name || '-' }}</div>
          <div class="sub-text">
            {{ defectSourceLabel(record.source) }}
          </div>
        </template>
      </a-table-column>
      <a-table-column title="级别" :width="80">
        <template #cell="{ record }">
          <a-tag :color="defectPriorityColor(record.priority)" size="small">
            {{ defectPriorityLabel(record.priority) }}
          </a-tag>
        </template>
      </a-table-column>
      <a-table-column title="状态" :width="90">
        <template #cell="{ record }">
          <a-tag :color="defectStatusColor(record.status)" size="small">
            {{ defectStatusLabel(record.status) }}
          </a-tag>
        </template>
      </a-table-column>
      <a-table-column title="发现时间" :width="165">
        <template #cell="{ record }">
          {{ formatTime(record.discovered_at) }}
        </template>
      </a-table-column>
      <a-table-column title="外部编号" :width="140" ellipsis tooltip>
        <template #cell="{ record }">
          {{ record.external_no || '-' }}
        </template>
      </a-table-column>
      <a-table-column title="操作" :width="250" fixed="right">
        <template #cell="{ record }">
          <a-space :size="8">
            <a-link @click="emit('copyTitle', record)">
              复制标题
            </a-link>
            <a-link @click="emit('copyContent', record)">
              复制内容
            </a-link>
            <a-link @click="emit('view', record)">
              查看
            </a-link>
            <a-dropdown
              v-if="defectActions(record.status).length"
              trigger="click"
              @select="(value: unknown) => onActionSelect(record, value)"
            >
              <a-link>状态操作</a-link>
              <template #content>
                <a-doption
                  v-for="action in defectActions(record.status)"
                  :key="action.key"
                  :value="action.key"
                >
                  {{ action.label }}
                </a-doption>
              </template>
            </a-dropdown>
          </a-space>
        </template>
      </a-table-column>
    </template>
    <template #empty>
      <a-empty description="暂无缺陷草稿" />
    </template>
  </a-table>
</template>

<style scoped>
.sub-text {
  color: var(--color-text-3);
  font-size: 12px;
}
</style>
