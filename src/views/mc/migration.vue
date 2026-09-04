<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { ApiMcMigration } from '@/api/apis'
import { formatTime, useGet } from '@/hooks'

defineOptions({ name: 'McMigration' })

// ── 批次列表：一次 migration up = 一行 ──────────
const runLimit = ref({ limit: 20 })
const { isFetching: runsLoading, data: runsRaw, execute: fetchRuns } = useGet<any>(ApiMcMigration.runs, runLimit, { immediate: true })
const runs = computed(() => (Array.isArray(runsRaw.value) ? runsRaw.value : []))

// ── 已应用清单（迁移框架的权威记账）──────────────
const appliedLimit = ref({ limit: 50 })
const { data: appliedRaw, execute: fetchApplied } = useGet<any>(ApiMcMigration.applied, appliedLimit, { immediate: true })
const appliedTotal = computed(() => appliedRaw.value?.total ?? 0)
const appliedList = computed(() => appliedRaw.value?.list || [])

// ── 语句明细 ──────────────────────────────────
const stmtQuery = ref<{ run_id: string, failed_only: boolean, page_num: number, page_size: number }>({
  run_id: '',
  failed_only: false,
  page_num: 1,
  page_size: 50,
})
const { isFetching: stmtLoading, data: stmtRaw, execute: fetchStmts } = useGet<any>(ApiMcMigration.statements, stmtQuery, { immediate: true })
const statements = computed(() => stmtRaw.value?.list || [])
const stmtTotal = computed(() => stmtRaw.value?.total || 0)

const selectedRun = ref('')
function selectRun(run: any) {
  selectedRun.value = run.run_id
  stmtQuery.value.run_id = run.run_id
  stmtQuery.value.page_num = 1
  fetchStmts()
}
function clearRun() {
  selectedRun.value = ''
  stmtQuery.value.run_id = ''
  stmtQuery.value.page_num = 1
  fetchStmts()
}
watch(() => stmtQuery.value.failed_only, () => {
  stmtQuery.value.page_num = 1
  fetchStmts()
})

function refresh() {
  fetchRuns()
  fetchApplied()
  fetchStmts()
}

/// seaql_migrations.applied_at 是 Unix 秒
function fmtUnix(sec: number) {
  if (!sec || sec <= 1)
    return '-'
  return formatTime(new Date(sec * 1000))
}

const runColumns = [
  { title: '开始', dataIndex: 'started_at', width: 170, slotName: 'started' },
  { title: '结束', dataIndex: 'finished_at', width: 170, slotName: 'finished' },
  { title: '方向', dataIndex: 'direction', width: 70 },
  { title: '迁移数', dataIndex: 'migration_count', width: 80 },
  { title: '语句', dataIndex: 'stmt_total', width: 130, slotName: 'stmt' },
  { title: '机器', dataIndex: 'host', width: 130, ellipsis: true },
  { title: '失败的迁移', dataIndex: 'failed_migrations', ellipsis: true, tooltip: true },
  { title: '', dataIndex: 'operations', slotName: 'operations', width: 80, fixed: 'right' as const },
]

const stmtColumns = [
  { title: '时间', dataIndex: 'created_at', width: 170, slotName: 'created' },
  { title: '迁移', dataIndex: 'migration', width: 300, ellipsis: true, tooltip: true },
  { title: '文件', dataIndex: 'file_name', width: 190, ellipsis: true },
  { title: '#', dataIndex: 'stmt_index', width: 60 },
  { title: '状态', dataIndex: 'status', width: 80, slotName: 'status' },
  { title: '影响行', dataIndex: 'rows_affected', width: 80 },
  { title: '耗时', dataIndex: 'elapsed_ms', width: 80, slotName: 'elapsed' },
  { title: '语句 / 错误', dataIndex: 'stmt_digest', slotName: 'detail' },
]
</script>

<template>
  <div class="p-4">
    <a-card title="迁移记录" :bordered="false">
      <template #extra>
        <a-space>
          <a-tag>已应用 {{ appliedTotal }} 条</a-tag>
          <a-button @click="refresh">
            刷新
          </a-button>
        </a-space>
      </template>

      <a-alert type="normal" class="mb-3">
        记录由 <span class="font-mono">migration</span> 二进制在执行 SQL 时写入，走的是**独立数据库连接** ——
        所以即使某条迁移整体失败被回滚，前面成功语句和失败原因也都还在，能看出「跑到哪一步炸的」。
        本页面<b>只读</b>：Web 上不提供触发迁移的按钮。
      </a-alert>

      <a-table
        :loading="runsLoading"
        :columns="runColumns"
        :data="runs"
        row-key="run_id"
        size="small"
        :pagination="false"
        :scroll="{ x: 1100, y: 260 }"
        :row-class="(record: any) => (record.run_id === selectedRun ? 'arco-table-tr-checked' : '')"
      >
        <template #started="{ record }">
          {{ formatTime(record.started_at) }}
        </template>
        <template #finished="{ record }">
          {{ formatTime(record.finished_at) }}
        </template>
        <template #stmt="{ record }">
          <span>{{ record.stmt_total - record.stmt_failed }} 成功</span>
          <a-tag v-if="record.stmt_failed > 0" color="red" class="ml-2">
            {{ record.stmt_failed }} 失败
          </a-tag>
        </template>
        <template #operations="{ record }">
          <a-button type="text" size="mini" @click="selectRun(record)">
            看明细
          </a-button>
        </template>
      </a-table>
    </a-card>

    <a-card :bordered="false" class="mt-4">
      <template #title>
        <a-space>
          <span>语句明细</span>
          <a-tag v-if="selectedRun" closable @close="clearRun">
            批次 {{ selectedRun }}
          </a-tag>
        </a-space>
      </template>
      <template #extra>
        <a-space>
          <a-switch v-model="stmtQuery.failed_only" />
          <span class="text-sm">只看失败</span>
        </a-space>
      </template>

      <a-table
        :loading="stmtLoading"
        :columns="stmtColumns"
        :data="statements"
        row-key="id"
        size="small"
        :pagination="{ total: stmtTotal, current: stmtQuery.page_num, pageSize: stmtQuery.page_size, showTotal: true }"
        :scroll="{ x: 1400 }"
        :row-class="(record: any) => (record.status !== 'ok' ? 'mc-row-failed' : '')"
        @page-change="(p: number) => { stmtQuery.page_num = p; fetchStmts() }"
      >
        <template #created="{ record }">
          {{ formatTime(record.created_at) }}
        </template>
        <template #status="{ record }">
          <a-tag :color="record.status === 'ok' ? 'green' : 'red'">
            {{ record.status }}
          </a-tag>
        </template>
        <template #elapsed="{ record }">
          {{ record.elapsed_ms == null ? '-' : `${record.elapsed_ms} ms` }}
        </template>
        <template #detail="{ record }">
          <div>
            <div class="font-mono text-xs text-gray-600">
              {{ record.stmt_digest }}
            </div>
            <div v-if="record.error" class="text-xs text-red-600 mt-1">
              {{ record.error }}
            </div>
          </div>
        </template>
      </a-table>
    </a-card>

    <a-card title="已应用迁移（seaql_migrations）" :bordered="false" class="mt-4">
      <a-alert type="normal" class="mb-3">
        这张表是迁移框架自己的记账，回答「库到底升到哪了」。上面的执行记录回答「这次跑了什么、哪条报错」，
        两者互补：只有前者时看不到失败细节，只有后者时看不出最终状态。
      </a-alert>
      <a-table
        :columns="[
          { title: '迁移', dataIndex: 'version', ellipsis: true },
          { title: '应用时间', dataIndex: 'applied_at', width: 200, slotName: 'applied' },
        ]"
        :data="appliedList"
        row-key="version"
        size="small"
        :pagination="{ pageSize: 15, showTotal: true }"
      >
        <template #applied="{ record }">
          {{ fmtUnix(record.applied_at) }}
        </template>
      </a-table>
    </a-card>
  </div>
</template>

<style scoped>
/* 失败行整行标红，扫一眼就能定位 */
:deep(.mc-row-failed) {
  background-color: rgb(255 236 232 / 60%);
}
</style>
