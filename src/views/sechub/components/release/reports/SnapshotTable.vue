<script setup lang="ts">
/** 发版报告：快照列表（结论 / 定稿 / 生成信息）与行操作。 */
import type { ReleaseSnapshotRow } from '@/types/sechub-release'
import { formatTime } from '@/hooks'

import { conclusionMeta } from '../../../composables/releaseDashboardRules'

defineProps<{
  list: ReleaseSnapshotRow[]
  loading: boolean
  actingId: string
  pagination: {
    current: number
    pageSize: number
    total: number
    showTotal: boolean
    showPageSize: boolean
  }
}>()

const emit = defineEmits<{
  (e: 'view', row: ReleaseSnapshotRow): void
  (e: 'download', row: ReleaseSnapshotRow): void
  (e: 'finalize', row: ReleaseSnapshotRow): void
  (e: 'unfinalize', row: ReleaseSnapshotRow): void
  (e: 'pageChange', page: number): void
  (e: 'pageSizeChange', size: number): void
}>()

function isFinal(row: ReleaseSnapshotRow): boolean {
  return row.is_final === '1'
}

function finalizeTip(row: ReleaseSnapshotRow): string {
  if (!isFinal(row))
    return ''
  const who = row.finalized_by || '-'
  return `由 ${who} 于 ${formatTime(row.finalized_at)} 定稿`
}
</script>

<template>
  <a-table
    :data="list"
    :loading="loading"
    :pagination="pagination"
    row-key="id"
    :scroll="{ minWidth: 1160 }"
    size="small"
    @page-change="emit('pageChange', $event)"
    @page-size-change="emit('pageSizeChange', $event)"
  >
    <template #columns>
      <a-table-column title="迭代" :width="240" ellipsis tooltip>
        <template #cell="{ record }">
          <div>{{ record.iteration_name || record.iteration_id }}</div>
          <div class="sub-text">
            {{ record.iteration_code || '-' }} · {{ record.product_line }}
          </div>
        </template>
      </a-table-column>
      <a-table-column title="结论" :width="100">
        <template #cell="{ record }">
          <a-tag :color="conclusionMeta(record.conclusion).color" size="small">
            {{ conclusionMeta(record.conclusion).label }}
          </a-tag>
        </template>
      </a-table-column>
      <a-table-column title="定稿" :width="120">
        <template #cell="{ record }">
          <a-tooltip
            v-if="finalizeTip(record)"
            :content="finalizeTip(record)"
          >
            <a-tag color="green" size="small">
              已定稿
            </a-tag>
          </a-tooltip>
          <a-tag v-else color="gray" size="small">
            未定稿
          </a-tag>
        </template>
      </a-table-column>
      <a-table-column title="生成人" :width="120" ellipsis tooltip>
        <template #cell="{ record }">
          {{ record.generated_by || '-' }}
        </template>
      </a-table-column>
      <a-table-column title="生成时间" :width="180">
        <template #cell="{ record }">
          {{ formatTime(record.created_at) }}
        </template>
      </a-table-column>
      <a-table-column title="操作" :width="300">
        <template #cell="{ record }">
          <a-space>
            <a-button size="small" type="text" @click="emit('view', record)">
              查看
            </a-button>
            <a-button size="small" type="text" @click="emit('download', record)">
              下载 .md
            </a-button>
            <a-button
              v-if="!isFinal(record)"
              :loading="actingId === record.id"
              size="small"
              type="outline"
              @click="emit('finalize', record)"
            >
              定稿
            </a-button>
            <a-button
              v-else
              :loading="actingId === record.id"
              size="small"
              type="text"
              status="warning"
              @click="emit('unfinalize', record)"
            >
              撤销定稿
            </a-button>
          </a-space>
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
