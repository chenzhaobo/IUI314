<script setup lang="ts">
/**
 * 执行记录 → 用例结果明细表（展示型组件）。
 *
 * 行内「表单 / API」按用例类型穿透：API 用例跳 API 测试结果详情，
 * 表单域用例跳表单测试结果详情（规则见 composables/secNavigation）。
 */
import type { RunResultPagination, RunResultRow } from '../composables/useRunResults'
import { useRouter } from 'vue-router'

import { caseResultLink } from '../composables/secNavigation'
import { resultTypeText, verdictColor } from '../composables/useRunResults'

defineProps<{
  results: RunResultRow[]
  loading: boolean
  pagination: RunResultPagination
}>()

const emit = defineEmits<{
  pageChange: [page: number]
  pageSizeChange: [size: number]
}>()

const router = useRouter()

function entityText(row: RunResultRow): string {
  return row.case?.entity_number || row.case?.api_path || '--'
}

function openCase(row: RunResultRow) {
  const target = caseResultLink(row.case)
  if (target)
    void router.push(target)
}
</script>

<template>
  <div class="run-result-table">
    <a-spin :loading="loading" style="display: block; min-height: 60px">
      <a-table
        :data="results"
        :pagination="pagination"
        :scroll="{ minWidth: 760 }"
        row-key="id"
        size="small"
        @page-change="page => emit('pageChange', page)"
        @page-size-change="size => emit('pageSizeChange', size)"
      >
        <template #columns>
          <a-table-column title="表单 / API" :width="200" ellipsis tooltip>
            <template #cell="{ record }">
              <a-link v-if="caseResultLink(record.case)" @click="openCase(record)">
                {{ entityText(record) }}
              </a-link>
              <span v-else>{{ entityText(record) }}</span>
            </template>
          </a-table-column>
          <a-table-column title="用例ID" data-index="case_id" :width="200" ellipsis tooltip />
          <a-table-column title="类型" :width="110">
            <template #cell="{ record }">
              {{ resultTypeText(record.case) }}
            </template>
          </a-table-column>
          <a-table-column title="结果" :width="90">
            <template #cell="{ record }">
              <a-tooltip v-if="record.detail || record.error_message" :content="record.error_message || record.detail" mini>
                <a-tag :color="verdictColor(record.verdict)">
                  {{ record.verdict }}
                </a-tag>
              </a-tooltip>
              <a-tag v-else :color="verdictColor(record.verdict)">
                {{ record.verdict }}
              </a-tag>
            </template>
          </a-table-column>
          <a-table-column title="耗时" :width="90">
            <template #cell="{ record }">
              {{ record.response_time_ms != null ? `${record.response_time_ms} ms` : '--' }}
            </template>
          </a-table-column>
        </template>
      </a-table>
      <a-empty v-if="!loading && !results.length" description="暂无执行结果" />
    </a-spin>
  </div>
</template>
