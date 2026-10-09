<script lang="ts" setup>
import type { TableData } from '@arco-design/web-vue'
/**
 * 摸底结果面板：档位明细表 + 曲线 1/2 + 拐点限制条件 + 硬件恢复结果。
 *
 * 只读展示；数据全部来自 `probe/get` 的 `result`（`plan.result` 为空说明计划还没跑出结果）。
 */
import type { ProbePlanView, RestoreItemView } from './types'
import { computed } from 'vue'
import { formatMetric, formatNumber } from '@/utils/perfFormat'
import ConcPromoteButton from '../conc/ConcPromoteButton.vue'
import { PERF_REPORT_PATH } from '../routes'
import ProbeHwChart from './ProbeHwChart.vue'
import ProbeStageChart from './ProbeStageChart.vue'
import { limitHits, restoreActionText, stageKindText, stageRows } from './types'

const props = defineProps<{ plan: ProbePlanView }>()

const result = computed(() => props.plan.result ?? null)
const hw = computed(() => result.value?.hw ?? [])
const curve2 = computed(() => result.value?.curve2 ?? [])
const stageList = computed(() => stageRows(result.value))
/** 改了硬件才有恢复事项；没改过时后端给 `{ok:true, items:[]}`，回填前为 null */
const changedHw = computed(() => (props.plan.hw_profiles ?? []).length > 0)
const restore = computed(() => result.value?.restore ?? null)
const hasRestore = computed(() => Boolean(restore.value && (restore.value.items?.length ?? 0) > 0))

const kneeBlocks = computed(() =>
  hw.value.map(h => ({
    label: h.label,
    knee: h.knee,
    hits: limitHits(h.limits),
    notes: h.limits?.notes ?? [],
  })),
)

function restoreRowClass(record: TableData): string {
  return (record as unknown as RestoreItemView).ok ? '' : 'prp-restore-bad'
}
</script>

<template>
  <div class="prp">
    <a-empty v-if="!result" description="计划尚未产出结果" />

    <template v-else>
      <a-alert
        v-if="changedHw && !restore"
        type="warning"
        title="本计划改过硬件，恢复结果尚未回填（计划结束后由恢复任务写入）"
        class="prp-gap"
      />

      <div class="prp-sec">
        档位明细
      </div>
      <a-table
        :data="stageList"
        :pagination="false"
        row-key="rowKey"
        size="small"
        :scroll="{ x: 990 }"
      >
        <template #columns>
          <a-table-column title="档位" :width="120">
            <template #cell="{ record }">
              {{ record.hwLabel }}
            </template>
          </a-table-column>
          <a-table-column title="并发" :width="70">
            <template #cell="{ record }">
              {{ formatNumber(record.threads, 0) }}
            </template>
          </a-table-column>
          <a-table-column title="类型" :width="80">
            <template #cell="{ record }">
              {{ stageKindText(record.kind) }}
            </template>
          </a-table-column>
          <a-table-column title="TPS" :width="90">
            <template #cell="{ record }">
              {{ formatMetric(record.tps, 'tps') }}
            </template>
          </a-table-column>
          <a-table-column title="P95" :width="90">
            <template #cell="{ record }">
              {{ formatMetric(record.p95_ms, 'ms') }}
            </template>
          </a-table-column>
          <a-table-column title="错误" :width="70">
            <template #cell="{ record }">
              <span :class="{ 'prp-bad': record.errors > 0 }">{{ formatNumber(record.errors, 0) }}</span>
            </template>
          </a-table-column>
          <a-table-column title="合格" :width="70">
            <template #cell="{ record }">
              <a-tag :color="record.ok ? 'green' : 'red'" size="small">
                {{ record.ok ? '是' : '否' }}
              </a-tag>
            </template>
          </a-table-column>
          <a-table-column title="重跑" :width="70">
            <template #cell="{ record }">
              {{ record.retried ? '是' : '—' }}
            </template>
          </a-table-column>
          <a-table-column title="run" :width="90">
            <template #cell="{ record }">
              <router-link
                v-if="record.run_id"
                :to="{ path: PERF_REPORT_PATH, query: { run_id: record.run_id } }"
              >
                报告
              </router-link>
              <span v-else>—</span>
            </template>
          </a-table-column>
          <a-table-column title="并发基准" :width="130">
            <template #cell="{ record }">
              <!-- 只有「稳定性 + 合格」的档位 run 满足固化前置（rt 稳定、带硬件档位与时长参数） -->
              <ConcPromoteButton
                v-if="record.kind === 'stability' && record.ok && record.run_id"
                :run-id="record.run_id"
                text
              />
              <span v-else>—</span>
            </template>
          </a-table-column>
        </template>
      </a-table>

      <div class="prp-sec">
        曲线 1 · 各档位「并发 → TPS / P95」
      </div>
      <ProbeStageChart :hw="hw" />

      <div class="prp-sec">
        曲线 2 · 档位最优 TPS 与单副本容量
      </div>
      <ProbeHwChart :rows="curve2" />

      <div class="prp-sec">
        拐点限制条件
      </div>
      <div v-if="kneeBlocks.length" class="prp-knees">
        <div v-for="block in kneeBlocks" :key="block.label" class="prp-knee">
          <div class="prp-knee-head">
            <b>{{ block.label }}</b>
            <span>拐点并发 {{ formatNumber(block.knee?.threads, 0) }}</span>
            <span>TPS {{ formatMetric(block.knee?.tps, 'tps') }}</span>
            <span>P95 {{ formatMetric(block.knee?.p95_ms, 'ms') }}</span>
            <span>单副本 {{ formatMetric(block.knee?.per_replica_tps, 'tps') }} TPS</span>
            <a-tag :color="block.knee?.stable ? 'green' : 'orange'" size="small">
              {{ block.knee?.stable ? '稳定' : '未稳定' }}
            </a-tag>
          </div>
          <div v-if="block.hits.length" class="prp-hits">
            <a-tag v-for="hit in block.hits" :key="hit" color="red" size="small">
              {{ hit }}
            </a-tag>
          </div>
          <ul v-if="block.notes.length" class="prp-notes">
            <li v-for="(note, i) in block.notes" :key="i">
              {{ note }}
            </li>
          </ul>
        </div>
      </div>
      <a-empty v-else description="暂无拐点数据" />

      <div class="prp-sec">
        硬件恢复结果
      </div>
      <a-table
        v-if="hasRestore"
        :data="restore?.items ?? []"
        :pagination="false"
        :row-class="restoreRowClass"
        size="small"
      >
        <template #columns>
          <a-table-column title="工作负载" data-index="workload" :width="180" />
          <a-table-column title="动作" :width="120">
            <template #cell="{ record }">
              {{ restoreActionText(record.action) }}
            </template>
          </a-table-column>
          <a-table-column title="结果" :width="80">
            <template #cell="{ record }">
              <a-tag :color="record.ok ? 'green' : 'red'" size="small">
                {{ record.ok ? '成功' : '失败' }}
              </a-tag>
            </template>
          </a-table-column>
          <a-table-column title="详情" data-index="detail" />
        </template>
      </a-table>
      <a-alert
        v-else-if="restore"
        type="success"
        title="未改动硬件，无需恢复"
      />
    </template>
  </div>
</template>

<style scoped>
.prp-gap {
  margin-bottom: 8px;
}

.prp-sec {
  margin: 12px 0 8px;
  color: var(--color-text-1);
  font-weight: 600;
  font-size: 13px;
}

.prp-knees {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.prp-knee {
  padding: 8px;
  background: var(--color-fill-1);
  border-radius: 4px;
}

.prp-knee-head {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.prp-hits {
  margin-top: 6px;
}

.prp-notes {
  margin: 6px 0 0;
  padding-left: 18px;
  color: var(--color-text-2);
  font-size: 12px;
  line-height: 1.8;
}

.prp-bad {
  color: rgb(var(--danger-6));
}

/* 恢复失败的行整行红底（类名由 restoreRowClass 给出） */
:deep(.prp-restore-bad) td {
  background-color: var(--color-danger-light-1);
}
</style>
