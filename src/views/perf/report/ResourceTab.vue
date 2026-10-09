<script lang="ts" setup>
/**
 * 报告页「资源数据」页签：按当前明细的 run_id 懒加载观测视图。
 *
 * 页签内分「资源数据」「诊断」两栏：资源栏只做展示，取数与状态在 ./useResourceTab；
 * 诊断栏挂共享的 DiagnosisPanel（101i，scope=run）。
 */
import { computed, ref } from 'vue'
import { formatTime } from '@/hooks'
import { formatMetric, formatNumber } from '@/utils/perfFormat'
import DiagnosisPanel from '../components/DiagnosisPanel.vue'
import { isLowConfidence, limitsText, lowConfidenceTip, replicasText, targetKindText, TXN_RESOURCE_MIN_MS } from './types'
import { useResourceTab } from './useResourceTab'

defineOptions({ name: 'ResourceTab' })

const props = defineProps<{ runId: string }>()

const runIdRef = computed(() => props.runId)
const innerTab = ref('resource')
const {
  loading,
  hasView,
  stateText,
  stateColor,
  stateReason,
  execWindow,
  metricRows,
  txnRows,
  snapshotSummary,
  snapshotProfile,
  warnings,
} = useResourceTab(runIdRef)

// 副本 / 限额只在硬件档位（profile）里，快照摘要本身不含
const replicas = computed(() => replicasText(snapshotProfile.value?.replicas))
const limits = computed(() => limitsText(snapshotProfile.value?.limits))

// Arco 的 row-class 回调收 TableData（Record<string, any>），这里只需 confidence 字段
function rowClass(record: { confidence?: string | null }): string {
  return record.confidence === 'low' ? 'rt-row-low' : ''
}
</script>

<template>
  <a-spin :loading="loading" class="rt-wrap">
    <a-tabs v-model:active-key="innerTab" size="small">
      <a-tab-pane key="resource" title="资源数据">
        <a-empty v-if="!loading && !hasView" :description="runId ? '暂无观测数据' : '请先在「报告列表」点击查看明细，再回到本页签'" />
        <template v-else-if="hasView">
          <a-card :bordered="false" size="small" class="m-b-8px">
            <a-space wrap>
              <a-tag :color="stateColor">
                {{ stateText }}
              </a-tag>
              <span v-if="execWindow" class="rt-hint">
                执行窗口：{{ formatTime(execWindow.started) }} ~ {{ formatTime(execWindow.finished) }}
              </span>
              <span v-else class="rt-hint">无 JTL 执行窗口（资源采集已跳过）</span>
            </a-space>
            <a-alert v-if="stateReason" type="error" class="m-t-8px">
              {{ stateReason }}
            </a-alert>
          </a-card>

          <a-card :bordered="false" size="small" title="启动前环境快照" class="m-b-8px">
            <template v-if="snapshotSummary">
              <a-descriptions :column="3" size="small" bordered>
                <a-descriptions-item label="硬件档位">
                  {{ snapshotSummary.hw_label || '未识别' }}
                </a-descriptions-item>
                <a-descriptions-item label="签名">
                  {{ snapshotSummary.hw_signature || '—' }}
                </a-descriptions-item>
                <a-descriptions-item label="采集时间">
                  {{ formatTime(snapshotSummary.captured_at) }}
                </a-descriptions-item>
                <a-descriptions-item label="副本数">
                  {{ replicas }}
                </a-descriptions-item>
                <a-descriptions-item label="限额" :span="2">
                  {{ limits }}
                </a-descriptions-item>
              </a-descriptions>
              <a-alert v-for="(w, i) in warnings" :key="i" type="warning" class="m-t-8px">
                {{ w }}
              </a-alert>
            </template>
            <a-empty v-else description="该 run 未挂环境快照" />
          </a-card>

          <a-card :bordered="false" size="small" title="指标（按目标分组）" class="m-b-8px">
            <a-table
              :data="metricRows"
              :loading="loading"
              :pagination="false"
              row-key="id"
              size="small"
              :scroll="{ minWidth: 1180 }"
              :row-class="rowClass"
            >
              <template #columns>
                <a-table-column title="目标" :width="220">
                  <template #cell="{ record }">
                    <template v-if="record.groupStart">
                      <a-tag size="small">
                        {{ targetKindText(record.target_kind) }}
                      </a-tag>
                      <span>{{ record.target_ref }}</span>
                    </template>
                  </template>
                </a-table-column>
                <a-table-column title="指标" data-index="metric_key" :width="180" />
                <a-table-column title="单位" data-index="unit" :width="80" />
                <a-table-column title="均值" :width="110">
                  <template #cell="{ record }">
                    {{ formatMetric(record.avg_value, record.unit) }}
                  </template>
                </a-table-column>
                <a-table-column title="峰值" :width="110">
                  <template #cell="{ record }">
                    {{ formatMetric(record.max_value, record.unit) }}
                  </template>
                </a-table-column>
                <a-table-column title="P95" :width="110">
                  <template #cell="{ record }">
                    {{ formatMetric(record.p95_value, record.unit) }}
                  </template>
                </a-table-column>
                <a-table-column title="净值" :width="110">
                  <template #cell="{ record }">
                    {{ formatMetric(record.net_value, record.unit) }}
                  </template>
                </a-table-column>
                <a-table-column title="点数" :width="90">
                  <template #cell="{ record }">
                    {{ formatNumber(record.sample_count, 0) }}
                  </template>
                </a-table-column>
                <a-table-column title="置信度" :width="110">
                  <template #cell="{ record }">
                    <a-tooltip :content="isLowConfidence(record) ? lowConfidenceTip(record) : '采样点数充足'">
                      <a-tag :color="isLowConfidence(record) ? 'gray' : 'green'" size="small">
                        {{ isLowConfidence(record) ? '低置信' : '高置信' }}
                      </a-tag>
                    </a-tooltip>
                  </template>
                </a-table-column>
                <a-table-column title="PromQL" :width="110">
                  <template #cell="{ record }">
                    <a-popover position="left" :width="560">
                      <a-button size="mini" type="text">
                        查看 / 复制
                      </a-button>
                      <template #content>
                        <a-typography-paragraph :copyable="true" class="rt-promql">
                          {{ record.promql }}
                        </a-typography-paragraph>
                      </template>
                    </a-popover>
                  </template>
                </a-table-column>
              </template>
            </a-table>
          </a-card>

          <a-card :bordered="false" size="small" title="事务级资源（耗时 ≥ 4 秒）">
            <a-table
              :data="txnRows"
              :loading="loading"
              :pagination="false"
              row-key="id"
              size="small"
              :scroll="{ minWidth: 900 }"
              :row-class="rowClass"
            >
              <template #columns>
                <a-table-column title="事务" data-index="txn_label" :width="260" />
                <a-table-column title="开始(相对)" :width="130">
                  <template #cell="{ record }">
                    {{ formatMetric(record.txn_start_ms, 'ms') }}
                  </template>
                </a-table-column>
                <a-table-column title="耗时" :width="100">
                  <template #cell="{ record }">
                    {{ formatMetric(record.txn_elapsed_ms, 'ms') }}
                  </template>
                </a-table-column>
                <a-table-column title="部署" data-index="workload" :width="180" />
                <a-table-column title="净 CPU" :width="110">
                  <template #cell="{ record }">
                    {{ formatMetric(record.net_cpu, 'core') }}
                  </template>
                </a-table-column>
                <a-table-column title="峰值 CPU" :width="110">
                  <template #cell="{ record }">
                    {{ formatMetric(record.max_cpu, 'core') }}
                  </template>
                </a-table-column>
                <a-table-column title="点数" :width="90">
                  <template #cell="{ record }">
                    {{ formatNumber(record.sample_count, 0) }}
                  </template>
                </a-table-column>
                <a-table-column title="置信度" :width="110">
                  <template #cell="{ record }">
                    <a-tooltip :content="isLowConfidence(record) ? lowConfidenceTip(record) : '采样点数充足'">
                      <a-tag :color="isLowConfidence(record) ? 'gray' : 'green'" size="small">
                        {{ isLowConfidence(record) ? '低置信' : '高置信' }}
                      </a-tag>
                    </a-tooltip>
                  </template>
                </a-table-column>
              </template>
            </a-table>
            <div class="rt-hint">
              低于 {{ TXN_RESOURCE_MIN_MS / 1000 }} 秒的事务按 spec 只标低置信、不单独列资源。
            </div>
          </a-card>
        </template>
      </a-tab-pane>

      <a-tab-pane key="diagnosis" title="诊断">
        <DiagnosisPanel v-if="innerTab === 'diagnosis'" scope="run" :scope-id="runId" />
      </a-tab-pane>
    </a-tabs>
  </a-spin>
</template>

<style scoped>
.rt-wrap {
  display: block;
  width: 100%;
}

.rt-hint {
  color: var(--color-text-3);
  font-size: 12px;
}

.rt-promql {
  margin-bottom: 0;
  font-family: monospace;
  word-break: break-all;
}

:deep(.rt-row-low) td {
  background-color: var(--color-fill-1);
}
</style>
