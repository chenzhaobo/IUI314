<script lang="ts" setup>
/**
 * 基准报告页「并发基准」页签：按任务或单 run 查 `result/list`，逐事务展示判定结论。
 *
 * 口径（service/src/perf/exec/task.rs、judge.rs）：
 * - 并发 run 不比对 `perf_txn` 基线，只对固化 profile 的并发基线判结论；
 * - `error_pct` 是 0~100 的百分数，展示前折成 ratio 再走 formatMetric（见 types.ts）；
 * - 「以此 run 更新基线」= accept：后端在判定含 failed/not_comparable 时整单拒绝，
 *   所以行操作要二次确认，失败原因由请求层统一弹后端中文文案。
 */
import type { TableColumnData } from '@arco-design/web-vue'
import type { ConcOption, ConcResultRow } from './types'
import { Message } from '@arco-design/web-vue'
import { nextTick, onMounted, ref } from 'vue'
import { useTableAutoHeight, withTableDefaults } from '@/hooks'
import { acceptRunBaseline, fetchConcResults, fetchConcurrentTaskOptions } from './service'
import {
  concReasons,
  fmtCpuPerTps,
  fmtErrorPct,
  fmtMs,
  fmtTps,
  idShort,
  verdictColor,
  verdictText,
} from './types'

defineOptions({ name: 'ConcResultTab' })

// ── 查询条件 ──────────────────────────────────
const queryType = ref<'task' | 'run'>('task')
const taskId = ref('')
const runIdInput = ref('')
const taskOptions = ref<ConcOption[]>([])

onMounted(async () => {
  const options = await fetchConcurrentTaskOptions()
  if (options)
    taskOptions.value = options
})

// ── 结果表 ──────────────────────────────────
const rows = ref<ConcResultRow[]>([])
const loading = ref(false)
/** 是否已执行过一次查询（区分"未查"与"查了但为空"） */
const queried = ref(false)

const tableWrap = ref<HTMLElement>()
const { tableHeight, measure } = useTableAutoHeight(tableWrap)

async function handleQuery() {
  const byTask = queryType.value === 'task'
  const keyword = byTask ? taskId.value : runIdInput.value.trim()
  if (!keyword) {
    Message.warning(byTask ? '请选择并发基准任务' : '请输入 run ID')
    return
  }
  loading.value = true
  const list = await fetchConcResults(byTask ? { task_id: keyword } : { run_id: keyword })
  loading.value = false
  if (!list)
    return
  rows.value = list
  queried.value = true
  // 表格容器在首次出数据后才挂载，等 DOM 更新完再复测（否则容器 ref 还是空的）
  await nextTick()
  measure()
}

// ── 人工确认基线（accept，二次确认）──────────────────
const accepting = ref('')

async function handleAccept(record: ConcResultRow) {
  accepting.value = record.run_id
  const outcome = await acceptRunBaseline(record.run_id)
  accepting.value = ''
  if (!outcome)
    return
  Message.success(`已更新并发基线：profile ${outcome.profile_id}，基线事务 ${outcome.txn_count} 条`)
}

const columns: TableColumnData[] = withTableDefaults([
  { title: '事务', dataIndex: 'txn_code', width: 240, fixed: 'left' as const },
  { title: 'run', dataIndex: 'run_id', width: 100, slotName: 'run' },
  { title: 'P95(ms)', dataIndex: 'p95_ms', width: 110, slotName: 'p95' },
  { title: '均值(ms)', dataIndex: 'avg_ms', width: 110, slotName: 'avg' },
  { title: 'TPS', dataIndex: 'tps', width: 100, slotName: 'tps' },
  { title: '错误率', dataIndex: 'error_pct', width: 100, slotName: 'error_pct' },
  { title: 'cpu/事务TPS', dataIndex: 'cpu_per_tps', width: 130, slotName: 'cpu' },
  { title: '结论', dataIndex: 'verdict', width: 90, slotName: 'verdict' },
  { title: '原因', dataIndex: 'reasons', width: 380, slotName: 'reasons' },
  { title: '操作', dataIndex: 'actions', width: 160, slotName: 'actions', fixed: 'right' as const },
])
</script>

<template>
  <div class="conc-res">
    <div class="conc-res-bar">
      <a-radio-group v-model="queryType" type="button" size="small">
        <a-radio value="task">
          按任务
        </a-radio>
        <a-radio value="run">
          按 run
        </a-radio>
      </a-radio-group>
      <a-select
        v-if="queryType === 'task'"
        v-model="taskId"
        :options="taskOptions"
        placeholder="选择并发基准任务"
        allow-search
        allow-clear
        style="width: 320px"
      />
      <a-input
        v-else
        v-model="runIdInput"
        placeholder="输入 run ID"
        allow-clear
        style="width: 320px"
        @press-enter="handleQuery"
      />
      <a-button type="primary" :loading="loading" @click="handleQuery">
        查询
      </a-button>
    </div>

    <div v-if="!queried" class="conc-res-tip">
      按并发基准任务或单 run 查询逐事务判定结果；行内可把该 run 的结果人工确认为新基线。
    </div>
    <div v-else-if="rows.length === 0 && !loading" class="conc-res-tip">
      未查询到并发判定结果（确认对象是并发基准任务/并发 run，或任务尚未收口判定）。
    </div>

    <div v-else ref="tableWrap">
      <a-table
        :columns="columns"
        :data="rows"
        :loading="loading"
        :pagination="false"
        row-key="id"
        :scroll="{ x: 1500, y: tableHeight }"
      >
        <template #run="{ record }">
          <a-tooltip :content="record.run_id">
            <span>{{ idShort(record.run_id) }}</span>
          </a-tooltip>
        </template>
        <template #p95="{ record }">
          {{ fmtMs(record.p95_ms) }}
        </template>
        <template #avg="{ record }">
          {{ fmtMs(record.avg_ms) }}
        </template>
        <template #tps="{ record }">
          {{ fmtTps(record.tps) }}
        </template>
        <template #error_pct="{ record }">
          {{ fmtErrorPct(record.error_pct) }}
        </template>
        <template #cpu="{ record }">
          {{ fmtCpuPerTps(record.cpu_per_tps) }}
        </template>
        <template #verdict="{ record }">
          <a-tag :color="verdictColor(record.verdict)" size="small">
            {{ verdictText(record.verdict) }}
          </a-tag>
        </template>
        <template #reasons="{ record }">
          <div v-if="concReasons(record.reasons).length" class="conc-res-reasons">
            <div v-for="(reason, i) in concReasons(record.reasons)" :key="i">
              {{ reason }}
            </div>
          </div>
          <span v-else>—</span>
        </template>
        <template #actions="{ record }">
          <a-popconfirm
            :content="`以该 run（${idShort(record.run_id)}）的判定结果更新并发基线？`"
            @ok="handleAccept(record)"
          >
            <a-button
              type="text"
              size="small"
              :loading="accepting === record.run_id"
              :disabled="Boolean(accepting)"
            >
              以此 run 更新基线
            </a-button>
          </a-popconfirm>
        </template>
      </a-table>
    </div>
  </div>
</template>

<style scoped>
.conc-res-bar {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
}

.conc-res-tip {
  padding: 24px 0;
  color: var(--color-text-3);
  font-size: 13px;
  text-align: center;
}

.conc-res-reasons {
  color: var(--color-text-2);
  font-size: 12px;
  line-height: 1.7;
}
</style>
