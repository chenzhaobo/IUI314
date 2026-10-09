<script lang="ts" setup>
/**
 * 批次观测 →「资源视角」：批次曲线（脚本窗口标区）+ 脚本排行 + 勾选发起取证跑。
 *
 * 纯展示：曲线点位、窗口、排行行都由 useTaskObserve 备好。
 */
import type { TableData } from '@arco-design/web-vue'
import type { RunRankRow, SeriesGroup } from './types'
import TimeSeriesChart from '@/components/charts/TimeSeriesChart.vue'
import { withTableDefaults } from '@/hooks'
import { formatMetric } from '@/utils/perfFormat'
import { EVIDENCE_EVENTS, metricTitle, rowMetrics } from './types'

defineOptions({ name: 'TaskResourceView' })

defineProps<{
  seriesGroups: SeriesGroup[]
  markAreas: Array<{ name: string, start_ms: number | null, end_ms: number | null }>
  activeMarkArea: string
  rankRows: RunRankRow[]
  evidenceSubmitting: boolean
}>()

const emit = defineEmits<{
  (e: 'selectRow', row: RunRankRow): void
  (e: 'submitEvidence'): void
}>()
const keyword = defineModel<string>('keyword', { required: true })
const confidenceFilter = defineModel<string>('confidenceFilter', { required: true })
const selectedRunIds = defineModel<string[]>('selectedRunIds', { required: true })
const evidenceEvent = defineModel<string>('evidenceEvent', { required: true })

const columns = withTableDefaults([
  { title: '脚本', dataIndex: 'script_name', slotName: 'script', width: 240, fixed: 'left' as const },
  { title: '净 CPU', slotName: 'net', width: 110 },
  { title: '峰值 CPU', slotName: 'max', width: 110 },
  { title: '内存峰值', slotName: 'mem', width: 120 },
  { title: '限流比例', slotName: 'throttle', width: 100 },
  { title: '点数', slotName: 'samples', width: 90 },
  { title: '置信度', slotName: 'confidence', width: 100 },
])

// Arco 的 row-click 回调给的是 TableData（Record<string, any>），行数据由 row-key 保证形状
function handleRowClick(record: TableData) {
  emit('selectRow', record as unknown as RunRankRow)
}
</script>

<template>
  <div class="tr-view">
    <a-card v-for="group in seriesGroups" :key="group.metricKey" :bordered="false" size="small" class="m-b-8px">
      <template #title>
        {{ metricTitle(group.metricKey) }}
        <span class="tr-hint">（灰块=脚本执行窗口，点击排行行高亮）</span>
      </template>
      <TimeSeriesChart
        :series="group.series"
        :mark-areas="markAreas"
        :active-mark-area="activeMarkArea"
        height="240px"
      />
    </a-card>
    <a-empty v-if="!seriesGroups.length" description="该批次暂无批次级曲线（回查未完成或未绑定数据源）" class="m-b-8px" />

    <a-card :bordered="false" size="small" title="脚本排行">
      <template #extra>
        <a-space>
          <a-input v-model="keyword" size="small" placeholder="按脚本名过滤" allow-clear style="width: 180px" />
          <a-select v-model="confidenceFilter" size="small" placeholder="置信度" allow-clear style="width: 110px">
            <a-option value="high">
              高置信
            </a-option>
            <a-option value="low">
              低置信
            </a-option>
          </a-select>
          <a-select v-model="evidenceEvent" size="small" style="width: 190px">
            <a-option v-for="e in EVIDENCE_EVENTS" :key="e.value" :value="e.value">
              {{ e.label }}
            </a-option>
          </a-select>
          <a-tooltip content="取证跑只做剖析取证，其数值标记 aux，不参与基线比对">
            <a-button
              type="primary"
              size="small"
              :loading="evidenceSubmitting"
              :disabled="!selectedRunIds.length"
              @click="emit('submitEvidence')"
            >
              对选中脚本发起取证跑（{{ selectedRunIds.length }}）
            </a-button>
          </a-tooltip>
        </a-space>
      </template>
      <a-table
        v-model:selected-keys="selectedRunIds"
        :data="rankRows"
        :columns="columns"
        :pagination="false"
        row-key="run_id"
        size="small"
        :row-selection="{ type: 'checkbox', showCheckedAll: true }"
        :scroll="{ minWidth: 900 }"
        @row-click="handleRowClick"
      >
        <template #script="{ record }">
          <span class="tr-script">{{ record.script_name || record.script_id }}</span>
        </template>
        <template #net="{ record }">
          {{ formatMetric(rowMetrics(record).netCpu, 'core') }}
        </template>
        <template #max="{ record }">
          {{ formatMetric(rowMetrics(record).maxCpu, 'core') }}
        </template>
        <template #mem="{ record }">
          {{ formatMetric(rowMetrics(record).memMax, 'byte') }}
        </template>
        <template #throttle="{ record }">
          {{ formatMetric(rowMetrics(record).throttle, 'ratio') }}
        </template>
        <template #samples="{ record }">
          {{ formatMetric(rowMetrics(record).sampleCount, 'count') }}
        </template>
        <template #confidence="{ record }">
          <a-tag :color="rowMetrics(record).confidence === 'low' ? 'gray' : 'green'" size="small">
            {{ rowMetrics(record).confidence === 'low' ? '低置信' : '高置信' }}
          </a-tag>
        </template>
      </a-table>
      <div class="tr-hint m-t-8px">
        取证跑数值不参与基线比对（compare_role=aux）。
      </div>
    </a-card>
  </div>
</template>

<style scoped>
.tr-hint {
  color: var(--color-text-3);
  font-size: 12px;
  font-weight: normal;
}

.tr-script {
  font-weight: 600;
}
</style>
