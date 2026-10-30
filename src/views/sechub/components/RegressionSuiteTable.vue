<script setup lang="ts">
/**
 * 回归套件列表表格（展示型组件）
 *
 * 列表模型不含运行字段，这里按当前页并发取每个套件的最近一条运行（只读）。
 * 行操作只抛事件，删除/触发的确认与请求由页面负责。
 */
import type { SecRegressionSuite, SecRegressionSuiteRun } from '@/api/sechubApis'
import { ref, watch } from 'vue'

import { ApiSecRegressionSuite, resolveStaticScanApi } from '@/api/sechubApis'
import { formatTime, getAction } from '@/hooks'

export interface SuiteTablePagination {
  current: number
  pageSize: number
  total: number
  showTotal: boolean
  showPageSize: boolean
}

const props = defineProps<{
  rows: SecRegressionSuite[]
  loading: boolean
  pagination: SuiteTablePagination
  tableHeight?: number
}>()

const emit = defineEmits<{
  pageChange: [page: number]
  pageSizeChange: [size: number]
  openEnvs: [record: SecRegressionSuite]
  edit: [record: SecRegressionSuite]
  trigger: [record: SecRegressionSuite]
  delete: [record: SecRegressionSuite]
}>()

const RUN_STATUS: Record<string, { label: string, color: string }> = {
  pending: { label: '待执行', color: 'gray' },
  running: { label: '运行中', color: 'blue' },
  success: { label: 'PASS', color: 'green' },
  failed: { label: 'FAIL', color: 'red' },
  partial: { label: '部分通过', color: 'orange' },
  cancelled: { label: '已取消', color: 'gray' },
}

const TYPE_LABEL: Record<string, string> = {
  api: 'API',
  form_perm: '表单权限',
  form_url: '表单URL直达',
  xss: 'XSS',
  sqli: 'SQL注入',
  java_reflect: '反射注入',
  openapi: 'OpenAPI',
  script: '脚本',
}

function runStatusMeta(status?: string | null) {
  return RUN_STATUS[status || ''] ?? { label: status || '--', color: 'gray' }
}

function testTypesText(raw?: string | null) {
  if (!raw)
    return '--'
  let values: string[]
  try {
    const parsed = JSON.parse(raw)
    values = Array.isArray(parsed) ? parsed.map(String) : raw.split(',')
  }
  catch {
    values = raw.split(',')
  }
  const labels = values.map(value => value.trim()).filter(Boolean).map(value => TYPE_LABEL[value] || value)
  return labels.length ? labels.join(' + ') : '--'
}

const latestRuns = ref<Record<string, SecRegressionSuiteRun>>({})
let latestSeq = 0

async function loadLatestRuns(rows: SecRegressionSuite[]) {
  const seq = ++latestSeq
  const pairs = await Promise.all(rows.map(async (row): Promise<[string, SecRegressionSuiteRun | null]> => {
    const res = await getAction<{ list?: SecRegressionSuiteRun[] }>(
      resolveStaticScanApi(ApiSecRegressionSuite.runs, { id: row.id }),
      { page_num: 1, page_size: 1 },
    )
    return [row.id, res?.list?.[0] ?? null]
  }))
  if (seq !== latestSeq)
    return
  const map: Record<string, SecRegressionSuiteRun> = {}
  for (const [id, run] of pairs) {
    if (run)
      map[id] = run
  }
  latestRuns.value = map
}

watch(() => props.rows, (rows) => {
  if (rows.length)
    loadLatestRuns(rows)
}, { immediate: true })

function firstRun(record: SecRegressionSuite) {
  return latestRuns.value[record.id]
}
</script>

<template>
  <a-table
    :data="rows"
    :loading="loading"
    :pagination="pagination"
    :scroll="{ minWidth: 1400, y: tableHeight }"
    row-key="id"
    @page-change="page => emit('pageChange', page)"
    @page-size-change="size => emit('pageSizeChange', size)"
  >
    <template #columns>
      <a-table-column title="套件名称" data-index="name" :width="200" ellipsis tooltip />
      <a-table-column title="编码" data-index="suite_code" :width="150" ellipsis tooltip />
      <a-table-column title="产品线" data-index="product_line" :width="80" />
      <a-table-column title="测试类型" data-index="test_types" :width="200" ellipsis tooltip>
        <template #cell="{ record }">
          {{ testTypesText(record.test_types) }}
        </template>
      </a-table-column>
      <a-table-column title="定时" :width="150">
        <template #cell="{ record }">
          <a-tag v-if="record.schedule_enabled === '1'" color="green">
            {{ record.schedule_cron || '已启用' }}
          </a-tag>
          <span v-else class="muted-text">未启用</span>
        </template>
      </a-table-column>
      <a-table-column title="最近运行" :width="180">
        <template #cell="{ record }">
          <template v-if="firstRun(record)">
            <a-tag :color="runStatusMeta(firstRun(record)?.status).color">
              {{ runStatusMeta(firstRun(record)?.status).label }}
            </a-tag>
            <span class="run-time">{{ formatTime(firstRun(record)?.started_at || firstRun(record)?.created_at) }}</span>
          </template>
          <span v-else class="muted-text">未运行</span>
        </template>
      </a-table-column>
      <a-table-column title="下次调度" data-index="next_run_at" :width="160">
        <template #cell="{ record }">
          {{ record.schedule_enabled === '1' ? formatTime(record.next_run_at) : '--' }}
        </template>
      </a-table-column>
      <a-table-column title="状态" data-index="status" :width="80">
        <template #cell="{ record }">
          <a-tag :color="record.status === 'active' ? 'green' : 'gray'">
            {{ record.status === 'active' ? '启用' : '归档' }}
          </a-tag>
        </template>
      </a-table-column>
      <a-table-column title="操作" :width="250" fixed="right">
        <template #cell="{ record }">
          <a-space>
            <a-link @click="emit('openEnvs', record)">
              环境/运行
            </a-link>
            <a-link @click="emit('edit', record)">
              编辑
            </a-link>
            <a-link status="success" @click="emit('trigger', record)">
              触发
            </a-link>
            <a-popconfirm content="确认删除该套件？" @ok="emit('delete', record)">
              <a-link status="danger">
                删除
              </a-link>
            </a-popconfirm>
          </a-space>
        </template>
      </a-table-column>
    </template>
  </a-table>
</template>

<style scoped>
.run-time {
  margin-left: 6px;
  color: var(--color-text-3);
  font-size: 12px;
}

.muted-text {
  color: var(--color-text-4);
  font-size: 12px;
}
</style>
