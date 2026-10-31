<script setup lang="ts">
/**
 * 接口覆盖列表：勾选 + 覆盖状态 + 用例事实。
 *
 * 只有「未覆盖 / 待评审」允许勾选（其余行 checkbox disabled）；
 * 勾选状态由页面持有（跨页保留），本组件只负责渲染与 emit。
 */
import type { ReleaseApi } from '@/types/sechub-release'
import { computed } from 'vue'
import { formatTime } from '@/hooks'

import {
  apiSelectionKey,
  coverageStatusColor,
  coverageStatusLabel,
  formatTestTypes,
  isSelectable,
} from '../../composables/releaseCoverageRules'

interface TablePagination {
  current: number
  pageSize: number
  total: number
  showTotal: boolean
  showPageSize: boolean
}

const props = defineProps<{
  list: ReleaseApi[]
  loading: boolean
  pagination: TablePagination
  /** 已勾选键（api_path|METHOD） */
  selectedKeys: string[]
  /** 本页可勾选行是否已全选 */
  pageAllSelected: boolean
  /** 本页是否有可勾选行（决定表头全选是否可用） */
  hasPageSelectable: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle', api: ReleaseApi): void
  (e: 'toggleAll'): void
  (e: 'pageChange', page: number): void
  (e: 'pageSizeChange', size: number): void
}>()

function rowKey(record: { api_path: string, http_method: string | null }): string {
  return apiSelectionKey(record.api_path, record.http_method)
}

/** Arco 的 row-key 只能是字段名：给每行补一个由路径 + 方法拼出的唯一键 */
const rows = computed(() => props.list.map(api => ({ ...api, row_key: rowKey(api) })))

function isChecked(record: { api_path: string, http_method: string | null }): boolean {
  return props.selectedKeys.includes(rowKey(record))
}
</script>

<template>
  <a-table
    :data="rows"
    :loading="loading"
    :pagination="pagination"
    row-key="row_key"
    :scroll="{ minWidth: 1660 }"
    size="small"
    @page-change="emit('pageChange', $event)"
    @page-size-change="emit('pageSizeChange', $event)"
  >
    <template #columns>
      <a-table-column :width="52">
        <template #title>
          <a-checkbox
            :disabled="!hasPageSelectable"
            :model-value="pageAllSelected"
            @change="emit('toggleAll')"
          />
        </template>
        <template #cell="{ record }">
          <a-checkbox
            :disabled="!isSelectable(record.coverage)"
            :model-value="isChecked(record)"
            @change="emit('toggle', record)"
          />
        </template>
      </a-table-column>
      <a-table-column title="标签" :width="100">
        <template #cell="{ record }">
          <a-space :size="4">
            <a-tag v-if="record.tags?.is_new" color="green" size="small">
              新增
            </a-tag>
            <a-tag v-if="record.tags?.is_changed" color="orange" size="small">
              变更
            </a-tag>
            <a-tag v-if="record.tags?.is_removed" color="gray" size="small">
              下线
            </a-tag>
            <span v-if="!record.tags?.is_new && !record.tags?.is_changed && !record.tags?.is_removed">-</span>
          </a-space>
        </template>
      </a-table-column>
      <a-table-column title="接口路径" :width="300" ellipsis tooltip>
        <template #cell="{ record }">
          {{ record.api_path }}
        </template>
      </a-table-column>
      <a-table-column title="方法" :width="80">
        <template #cell="{ record }">
          {{ record.http_method || '-' }}
        </template>
      </a-table-column>
      <a-table-column title="名称" :width="180" ellipsis tooltip>
        <template #cell="{ record }">
          {{ record.name || '-' }}
        </template>
      </a-table-column>
      <a-table-column title="应用" :width="160" ellipsis tooltip>
        <template #cell="{ record }">
          <div>{{ record.app_name || record.app_number || '-' }}</div>
          <div class="sub-text">
            {{ record.app_number || '-' }}
          </div>
        </template>
      </a-table-column>
      <a-table-column title="处理人" :width="100" ellipsis tooltip>
        <template #cell="{ record }">
          {{ record.handler || '--' }}
        </template>
      </a-table-column>
      <a-table-column title="项目组" :width="150" ellipsis tooltip>
        <template #cell="{ record }">
          <div>{{ record.project_group_name || '未分类' }}</div>
          <div class="sub-text">
            {{ record.project_group_code || '-' }}
          </div>
        </template>
      </a-table-column>
      <a-table-column title="覆盖状态" :width="100">
        <template #cell="{ record }">
          <a-tag :color="coverageStatusColor(record.coverage)" size="small">
            {{ coverageStatusLabel(record.coverage) }}
          </a-tag>
        </template>
      </a-table-column>
      <a-table-column title="有效用例数" data-index="valid_case_cnt" :width="100" />
      <a-table-column title="测试类型" :width="140">
        <template #cell="{ record }">
          {{ formatTestTypes(record.test_types || []) }}
        </template>
      </a-table-column>
      <a-table-column title="最近执行时间" :width="170">
        <template #cell="{ record }">
          {{ formatTime(record.last_tested_at) }}
        </template>
      </a-table-column>
    </template>
  </a-table>
</template>

<style scoped>
.sub-text {
  color: var(--color-text-3);
  font-size: 12px;
}
</style>
