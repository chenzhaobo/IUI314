<script lang="ts" setup>
/**
 * 报告页「性能剖析」页签（101h）：火焰图台账 + 方法占比 Top 20 + 差分 Top 30 + 取证跑。
 *
 * 火焰图 HTML 由后端鉴权接口以 text/html 原文下发，这里 fetch 成 Blob 再喂给
 * sandbox="allow-scripts" 的 iframe（D17：不给 allow-same-origin，卸载/换图时 revoke）。
 * 取数与状态都在 useProfileTab。
 */
import { computed } from 'vue'
import { formatTime, withTableDefaults } from '@/hooks'
import { EMPTY_TEXT, formatMetric, formatNumber } from '@/utils/perfFormat'
import {
  attributionColor,
  attributionText,
  attributionTip,
  FLAME_EVENT_OPTIONS,
  flameEventText,
  flameStatusColor,
  flameStatusText,
  flameTriggerText,
} from './profile/types'
import { useProfileTab } from './profile/useProfileTab'

defineOptions({ name: 'ProfileTab' })

const props = defineProps<{ runId: string }>()

const {
  loading,
  flames,
  selectedIds,
  evidenceEvent,
  evidenceSubmitting,
  evidenceRunId,
  topLoading,
  topRows,
  topTitle,
  diffLoading,
  diffRows,
  diffTitle,
  diffBlockedReason,
  htmlVisible,
  htmlLoading,
  htmlUrl,
  htmlTitle,
  load,
  submitEvidence,
  loadTop,
  clearTop,
  runDiff,
  clearDiff,
  viewFlame,
  closeHtml,
} = useProfileTab(computed(() => props.runId))

/** 不可差分的行注入 disabled，Arco 的勾选框按行禁用（差分前置条件） */
const tableRows = computed(() => flames.value.map(row => ({ ...row, disabled: !row.diffable })))

/** 占比列：后端给的已是百分数（0~100），只按统一口径取 2 位小数 */
function fmtPct(value?: number | null): string {
  return value === null || value === undefined ? EMPTY_TEXT : `${formatNumber(value, 2)}%`
}

/** 差分列：带符号的百分点（+ 变慢 / − 变快） */
function fmtDelta(value: number | null | undefined): string {
  if (value === null || value === undefined)
    return EMPTY_TEXT
  return `${value > 0 ? '+' : ''}${formatNumber(value, 2)}`
}

const columns = withTableDefaults([
  { title: '事件', slotName: 'event', width: 120 },
  { title: '应用 / 实例', slotName: 'instance', width: 220 },
  { title: 'Pod', dataIndex: 'pod_name', width: 220 },
  { title: '归因', slotName: 'attribution', width: 160 },
  { title: '状态', slotName: 'status', width: 200 },
  { title: '触发方式', slotName: 'trigger', width: 100 },
  { title: '大小', slotName: 'size', width: 90 },
  { title: '采集时间', slotName: 'created', width: 160 },
  { title: '到期时间', slotName: 'expire', width: 160 },
  { title: '操作', slotName: 'ops', width: 170, fixed: 'right' as const },
])

const topColumns = withTableDefaults([
  { title: '方法', dataIndex: 'frame', width: 560 },
  { title: '自身占比', slotName: 'self', width: 120 },
  { title: '累计占比', slotName: 'total', width: 120 },
])

const diffColumns = withTableDefaults([
  { title: '方法', dataIndex: 'frame', width: 520 },
  { title: '基准占比', slotName: 'base', width: 120 },
  { title: '对比占比', slotName: 'cur', width: 120 },
  { title: '变化(百分点)', slotName: 'delta', width: 140 },
])
</script>

<template>
  <div class="pf-wrap">
    <a-card :bordered="false" size="small" class="m-b-8px">
      <template #title>
        火焰图台账
      </template>
      <template #extra>
        <a-space>
          <a-select v-model="evidenceEvent" size="small" style="width: 170px">
            <a-option v-for="e in FLAME_EVENT_OPTIONS" :key="e.value" :value="e.value">
              {{ e.label }}
            </a-option>
          </a-select>
          <a-tooltip content="取证跑只做剖析取证，数值标记 aux，不参与基线比对">
            <a-button type="primary" size="small" :loading="evidenceSubmitting" :disabled="!runId" @click="submitEvidence">
              发起取证跑
            </a-button>
          </a-tooltip>
          <a-tooltip :content="diffBlockedReason || '差分 Top 30：delta>0 为变慢（红），<0 为变快（绿）'">
            <a-button size="small" :loading="diffLoading" :disabled="!!diffBlockedReason" @click="runDiff">
              差分 Top 30（{{ selectedIds.length }}/2）
            </a-button>
          </a-tooltip>
          <a-button size="small" :loading="loading" @click="load">
            刷新
          </a-button>
        </a-space>
      </template>

      <a-alert v-if="evidenceRunId" type="success" class="m-b-8px">
        已发起取证跑（新记录 {{ evidenceRunId }}），采样与执行在后台串行进行；完成后可在「报告列表」按该 run 查看火焰图。
      </a-alert>

      <a-table
        v-model:selected-keys="selectedIds"
        :data="tableRows"
        :loading="loading"
        :columns="columns"
        :pagination="false"
        :row-selection="{ type: 'checkbox', showCheckedAll: true }"
        row-key="id"
        size="small"
        :scroll="{ minWidth: 1600 }"
      >
        <template #event="{ record }">
          {{ flameEventText(record.event) }}
          <span class="pf-hint">/ {{ record.sample_seconds }}s</span>
        </template>
        <template #instance="{ record }">
          {{ record.app_name }} / {{ record.instance_ip }}
        </template>
        <template #attribution="{ record }">
          <a-tooltip :content="attributionTip(record.attribution)">
            <a-tag :color="attributionColor(record.attribution)" size="small">
              {{ attributionText(record.attribution) }}
            </a-tag>
          </a-tooltip>
        </template>
        <template #status="{ record }">
          <a-tag :color="flameStatusColor(record.status)" size="small">
            {{ flameStatusText(record.status) }}
          </a-tag>
          <a-popover v-if="record.error" position="left" :width="520">
            <span class="pf-err">{{ record.error }}</span>
            <template #content>
              <div class="pf-err-full">
                {{ record.error }}
              </div>
            </template>
          </a-popover>
        </template>
        <template #trigger="{ record }">
          {{ flameTriggerText(record.trigger) }}
        </template>
        <template #size="{ record }">
          {{ formatMetric(record.html_bytes, 'byte') }}
        </template>
        <template #created="{ record }">
          {{ formatTime(record.created_at) }}
        </template>
        <template #expire="{ record }">
          {{ formatTime(record.expire_at) }}
        </template>
        <template #ops="{ record }">
          <a-space>
            <a-tooltip :content="record.html_bytes == null ? '尚未归档（待采样/采集中），暂无可查看的 HTML' : '在新窗口外框内查看火焰图（沙箱渲染）'">
              <a-button type="text" size="mini" :disabled="record.html_bytes == null" @click="viewFlame(record)">
                查看火焰图
              </a-button>
            </a-tooltip>
            <a-tooltip :content="record.diffable ? '该图折叠栈可用，可参与差分' : '折叠栈不可用（解析失败或已过期清理），无法计算方法占比与差分'">
              <a-button type="text" size="mini" :disabled="!record.diffable" @click="loadTop(record)">
                方法占比
              </a-button>
            </a-tooltip>
          </a-space>
        </template>
      </a-table>
      <div class="pf-hint m-t-8px">
        勾选两张已归档且可差分的火焰图可做差分（按采集时刻早者为基准）；不可差分的行勾选框不可用。
      </div>
    </a-card>

    <a-card v-if="topLoading || topRows.length" :bordered="false" size="small" class="m-b-8px">
      <template #title>
        方法占比 Top 20 <span class="pf-hint">— {{ topTitle }}</span>
      </template>
      <template #extra>
        <a-button type="text" size="mini" @click="clearTop">
          关闭
        </a-button>
      </template>
      <a-table :data="topRows" :loading="topLoading" :columns="topColumns" :pagination="false" row-key="frame" size="small" :scroll="{ minWidth: 800 }">
        <template #self="{ record }">
          {{ fmtPct(record.self_pct) }}
        </template>
        <template #total="{ record }">
          {{ fmtPct(record.total_pct) }}
        </template>
      </a-table>
    </a-card>

    <a-card v-if="diffLoading || diffRows.length" :bordered="false" size="small" class="m-b-8px">
      <template #title>
        差分 Top 30 <span class="pf-hint">— {{ diffTitle }}</span>
      </template>
      <template #extra>
        <a-button type="text" size="mini" @click="clearDiff">
          关闭
        </a-button>
      </template>
      <a-table :data="diffRows" :loading="diffLoading" :columns="diffColumns" :pagination="false" row-key="frame" size="small" :scroll="{ minWidth: 900 }">
        <template #base="{ record }">
          {{ fmtPct(record.base_pct) }}
        </template>
        <template #cur="{ record }">
          {{ fmtPct(record.cur_pct) }}
        </template>
        <template #delta="{ record }">
          <span :style="{ color: record.delta > 0 ? 'red' : (record.delta < 0 ? 'green' : 'inherit') }">
            {{ fmtDelta(record.delta) }}
          </span>
        </template>
      </a-table>
      <div class="pf-hint m-t-8px">
        按 |变化| 降序；红=对比图中该方法占比升高（变慢），绿=下降。
      </div>
    </a-card>

    <a-modal
      :visible="htmlVisible"
      :title="`火焰图 — ${htmlTitle}`"
      :width="1280"
      :footer="false"
      :body-style="{ padding: '0', height: '80vh' }"
      @cancel="closeHtml"
    >
      <iframe v-if="htmlUrl" :src="htmlUrl" sandbox="allow-scripts" style="width: 100%; height: 80vh; border: none;" />
      <a-spin v-else style="display: block; height: 80vh;" :loading="htmlLoading" />
    </a-modal>
  </div>
</template>

<style scoped>
.pf-wrap {
  display: block;
  width: 100%;
}

.pf-hint {
  color: var(--color-text-3);
  font-size: 12px;
  font-weight: normal;
}

.pf-err {
  display: inline-block;
  max-width: 150px;
  overflow: hidden;
  color: rgb(var(--red-6));
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: bottom;
}

.pf-err-full {
  max-height: 320px;
  overflow: auto;
  word-break: break-all;
  white-space: pre-wrap;
}
</style>
