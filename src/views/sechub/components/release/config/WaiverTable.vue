<script setup lang="ts">
/**
 * 白名单列表：规则 / 匹配方式 / 对象 / 环境 / 原因 / 到期 / 创建信息 / 状态。
 *
 * 行操作只有「撤销」；已撤销的行不再提供撤销。
 */
import type { PaginationProps, TableData } from '@arco-design/web-vue'
import type { ReleaseWaiver } from '@/types/sechub-release'

import { formatTime } from '@/hooks'
import { matchTypeLabel, waiverStatusMeta } from '../../../composables/configCheckRules'

defineProps<{
  list: ReleaseWaiver[]
  loading: boolean
  pagination: PaginationProps
}>()

const emit = defineEmits<{
  (e: 'revoke', waiver: ReleaseWaiver): void
  (e: 'pageChange', page: number): void
  (e: 'pageSizeChange', size: number): void
}>()

function asWaiver(record: TableData): ReleaseWaiver {
  return record as unknown as ReleaseWaiver
}
</script>

<template>
  <a-table
    :data="list"
    :loading="loading"
    :pagination="pagination"
    :scroll="{ minWidth: 1220 }"
    row-key="id"
    size="small"
    @page-change="(page: number) => emit('pageChange', page)"
    @page-size-change="(size: number) => emit('pageSizeChange', size)"
  >
    <template #columns>
      <a-table-column title="规则" :width="150">
        <template #cell="{ record }">
          <div class="rule-code">
            {{ record.rule_code }}
          </div>
          <div class="secondary">
            {{ matchTypeLabel(record.match_type) }}
          </div>
        </template>
      </a-table-column>
      <a-table-column title="对象" :width="240" ellipsis tooltip>
        <template #cell="{ record }">
          <span class="mono">{{ record.object_key }}</span>
        </template>
      </a-table-column>
      <a-table-column title="环境" :width="150" ellipsis tooltip>
        <template #cell="{ record }">
          {{ record.env_id || '全部环境' }}
        </template>
      </a-table-column>
      <a-table-column title="原因" ellipsis tooltip>
        <template #cell="{ record }">
          {{ record.reason }}
        </template>
      </a-table-column>
      <a-table-column title="到期" :width="160">
        <template #cell="{ record }">
          {{ record.expires_at ? formatTime(record.expires_at) : '不过期' }}
        </template>
      </a-table-column>
      <a-table-column title="创建人" :width="120" ellipsis tooltip>
        <template #cell="{ record }">
          {{ record.created_by }}
        </template>
      </a-table-column>
      <a-table-column title="创建时间" :width="160">
        <template #cell="{ record }">
          {{ formatTime(record.created_at) }}
        </template>
      </a-table-column>
      <a-table-column title="状态" :width="90">
        <template #cell="{ record }">
          <a-tag :color="waiverStatusMeta(asWaiver(record)).color" size="small">
            {{ waiverStatusMeta(asWaiver(record)).label }}
          </a-tag>
        </template>
      </a-table-column>
      <a-table-column title="操作" :width="100" fixed="right">
        <template #cell="{ record }">
          <a-button
            size="mini"
            :disabled="Boolean(record.revoked_at)"
            @click="emit('revoke', asWaiver(record))"
          >
            撤销
          </a-button>
        </template>
      </a-table-column>
    </template>
    <template #empty>
      <a-empty description="当前筛选下没有白名单" />
    </template>
  </a-table>
</template>

<style scoped>
.rule-code {
  color: var(--color-text-1);
  font-weight: 500;
  font-family: var(--font-mono);
}
.secondary {
  color: var(--color-text-3);
  font-size: 12px;
}
.mono {
  font-family: var(--font-mono);
}
</style>
