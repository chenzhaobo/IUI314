<script setup lang="ts">
import type { AutomationReport } from '../caseTypes'
import type { RoundModel } from '../types'
import { computed, toRef } from 'vue'
import { formatTime } from '@/hooks'
import { CASE_VERDICT_OPTIONS, formatDelta, formatDeltaPct, formatDuration, verdictMeta } from '../caseTypes'
import { useCaseComparison } from '../useCaseComparison'

const props = defineProps<{
  round: RoundModel
}>()
const emit = defineEmits<{
  (e: 'refresh'): void
}>()

const {
  sources,
  executions,
  selectedSourceId,
  selectedExecuteId,
  sourceLoading,
  executionLoading,
  syncing,
  compare,
  compareLoading,
  baselineId,
  keyword,
  verdict,
  pagination,
  startSync,
  loadCompare,
  onPageChange,
  onPageSizeChange,
  search,
} = useCaseComparison(toRef(props, 'round'), () => emit('refresh'))

const sourceOptions = computed(() => sources.value.map(source => ({
  value: source.id,
  label: `${source.name} · ${source.task_name}${source.status === '1' ? '' : '（停用）'}`,
  disabled: source.status !== '1',
})))
const selectedSourceEnabled = computed(() => sources.value.some(source => source.id === selectedSourceId.value && source.status === '1'))
const sourceNotice = computed(() => {
  if (sources.value.some(source => source.status === '1'))
    return ''
  if (!sources.value.length)
    return '尚未配置自动化源，因此下拉没有数据。请先到「自动化源配置」菜单新增任务和 OpenAPI 凭据。'
  const reason = sources.value.map(source => source.remark).find(Boolean)
  return `自动化源当前处于停用状态，因此不能加载执行批次。请到「自动化源配置」修正并启用。${reason || ''}`
})
const executionNotice = computed(() => {
  if (!selectedSourceEnabled.value || executionLoading.value || executions.value.length)
    return ''
  return '自动化源已启用，但未获取到执行批次。请检查任务 ID、OpenAPI 上下文及最近批次是否仍存在。'
})

function isComplete(report: AutomationReport): boolean {
  return Boolean(report.finished_at) && report.execute_state !== 1
}

const executionOptions = computed(() => executions.value.map(report => ({
  value: report.execute_id,
  label: `${formatTime(report.started_at)} · ${report.execute_id} · ${isComplete(report) ? '已完成' : '运行中'}`,
  disabled: !isComplete(report),
})))

const baselineOptions = computed(() => (compare.value?.baseline_options ?? []).map(round => ({
  value: round.round_id,
  label: `${formatTime(round.automation_started_at, { precision: 'minute' })} · ${round.round_no} · ${round.automation_execute_id || '-'}`,
})))
</script>

<template>
  <section class="case-panel">
    <a-divider orientation="left">
      成功用例耗时横比
    </a-divider>
    <a-alert type="info" class="compare-tip">
      比较口径：仅统计当前批次和基线批次都成功的用例（executeState=2），按 caseId 匹配；差值 = 当前耗时 - 基线耗时，负值表示当前更快。
    </a-alert>

    <div class="sync-row">
      <span class="muted">重新采集设置（不改变顶部选择的当前批次）</span>
      <a-select
        v-model="selectedSourceId"
        :options="sourceOptions"
        :loading="sourceLoading"
        placeholder="采集来源"
        allow-search
        class="source-select"
      />
      <a-select
        v-model="selectedExecuteId"
        :options="executionOptions"
        :loading="executionLoading"
        placeholder="用于重新采集的主执行批次"
        allow-search
        class="execute-select"
      />
      <a-button type="primary" size="small" :loading="syncing" :disabled="round.case_sync_status === 'running' || !selectedSourceEnabled" @click="startSync(round.case_sync_status === 'success')">
        {{ round.case_sync_status === 'success' ? '重新采集此批次' : '采集成功用例' }}
      </a-button>
      <a-tag v-if="round.case_sync_status === 'running'" color="arcoblue" size="small">
        正在采集
      </a-tag>
      <a-tag v-else-if="round.case_sync_status === 'success'" color="green" size="small">
        已采集 {{ round.case_total }} 条
      </a-tag>
    </div>

    <a-alert v-if="sourceNotice" type="warning" class="case-alert">
      {{ sourceNotice }}
    </a-alert>
    <a-alert v-else-if="executionNotice" type="warning" class="case-alert">
      {{ executionNotice }}
    </a-alert>

    <a-alert v-if="round.case_sync_status === 'failed'" type="error" class="case-alert">
      采集失败：{{ round.case_sync_error || '未知错误' }}
    </a-alert>
    <a-alert v-else-if="round.case_sync_status === 'running'" type="info" class="case-alert">
      正在读取成功用例（executeState=2），完成后自动加载横比。
    </a-alert>

    <template v-if="round.case_sync_status === 'success'">
      <div class="compare-pair">
        <div class="pair-card current">
          <div class="pair-label">
            当前批次（本轮）
          </div>
          <div class="pair-id">
            {{ round.automation_execute_id || '-' }}
          </div>
          <div class="pair-time">
            {{ formatTime(round.automation_started_at) }}
          </div>
        </div>
        <span class="pair-vs">VS</span>
        <div class="pair-card baseline">
          <div class="pair-label">
            基线批次（对比对象）
          </div>
          <a-select
            v-model="baselineId"
            :options="baselineOptions"
            placeholder="选择基线批次"
            allow-search
            class="baseline-select"
            @change="loadCompare"
          />
          <div v-if="compare?.baseline_round" class="pair-id">
            {{ compare.baseline_round.automation_execute_id || '-' }}
          </div>
          <div v-if="compare?.baseline_round" class="pair-time">
            {{ formatTime(compare.baseline_round.automation_started_at) }}
          </div>
        </div>
      </div>

      <a-space wrap size="mini" class="summary-row">
        <a-tag>共同成功用例 {{ compare?.summary.matched ?? 0 }}</a-tag>
        <a-tag color="green">
          性能提升 {{ compare?.summary.improved ?? 0 }}
        </a-tag>
        <a-tag color="red">
          性能下降 {{ compare?.summary.regressed ?? 0 }}
        </a-tag>
        <a-tag color="gray">
          持平 {{ compare?.summary.unchanged ?? 0 }}
        </a-tag>
        <a-tag>仅当前成功 {{ compare?.summary.current_only ?? 0 }}</a-tag>
        <a-tag>仅基线成功 {{ compare?.summary.baseline_only ?? 0 }}</a-tag>
        <a-tag>无效耗时 {{ compare?.summary.invalid_duration ?? 0 }}</a-tag>
      </a-space>

      <div class="filter-row">
        <a-input v-model="keyword" placeholder="用例名 / 路径 / caseId" allow-clear class="keyword-input" @press-enter="search" />
        <a-select v-model="verdict" :options="CASE_VERDICT_OPTIONS" placeholder="对比结论" allow-clear class="verdict-select" @change="search" />
        <a-button size="small" @click="search">
          查询
        </a-button>
      </div>

      <a-empty v-if="compare && !compare.baseline_round" description="暂无同任务的已采集历史轮次，请先采集另一个批次" />
      <a-table
        v-else
        :data="compare?.list ?? []"
        :loading="compareLoading"
        :pagination="pagination"
        row-key="case_key"
        size="small"
        :scroll="{ minWidth: 1200 }"
        @page-change="onPageChange"
        @page-size-change="onPageSizeChange"
      >
        <template #columns>
          <a-table-column title="用例" :width="250" ellipsis tooltip>
            <template #cell="{ record }">
              <div>{{ record.case_name || '-' }}</div>
              <div class="case-key">
                {{ record.case_key }}
              </div>
            </template>
          </a-table-column>
          <a-table-column title="路径" data-index="case_path" :width="200" ellipsis tooltip />
          <a-table-column title="当前批次耗时" :width="125">
            <template #cell="{ record }">
              {{ formatDuration(record.current_duration_ms) }}
            </template>
          </a-table-column>
          <a-table-column title="基线批次耗时" :width="125">
            <template #cell="{ record }">
              {{ formatDuration(record.baseline_duration_ms) }}
            </template>
          </a-table-column>
          <a-table-column title="差值（当前-基线）" :width="150">
            <template #cell="{ record }">
              {{ formatDelta(record.delta_ms) }}
            </template>
          </a-table-column>
          <a-table-column title="变化率" :width="100">
            <template #cell="{ record }">
              {{ formatDeltaPct(record.delta_pct) }}
            </template>
          </a-table-column>
          <a-table-column title="结论" :width="110">
            <template #cell="{ record }">
              <a-tag :color="verdictMeta(record.verdict).color" size="small">
                {{ verdictMeta(record.verdict).label }}
              </a-tag>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </template>
    <a-empty v-else-if="round.case_sync_status !== 'running'" description="选择自动化源和已结束的主执行批次，采集成功用例后进行横比" />
  </section>
</template>

<style scoped>
.case-panel { margin-top: 16px; }
.sync-row, .filter-row { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.source-select { width: 300px; }
.execute-select { width: 360px; }
.baseline-select { width: 280px; }
.keyword-input { width: 240px; }
.verdict-select { width: 210px; }
.summary-row { margin-bottom: 12px; }
.case-alert, .compare-tip { margin-bottom: 12px; }
.case-key { color: var(--color-text-3); font-size: 12px; }
.muted { color: var(--color-text-3); font-size: 12px; }
.compare-pair { display: flex; align-items: stretch; gap: 12px; margin-bottom: 12px; }
.pair-card { flex: 1; padding: 12px; border: 1px solid var(--color-border-2); border-radius: 6px; background: var(--color-fill-1); }
.pair-card.current { border-left: 3px solid rgb(var(--primary-6)); }
.pair-card.baseline { border-left: 3px solid rgb(var(--warning-6)); }
.pair-label { margin-bottom: 4px; color: var(--color-text-2); font-size: 12px; font-weight: 600; }
.pair-id { font-family: var(--font-family-mono, monospace); font-size: 13px; }
.pair-time { margin-top: 2px; color: var(--color-text-3); font-size: 12px; }
.pair-vs { align-self: center; color: var(--color-text-3); font-weight: 700; }
</style>
