<script setup lang="ts">
/**
 * 一轮判定下的 AI-01 权限分组结论子表（只读）。
 *
 * 分组结论不单独出报告（报告挂在本轮的候选聚合结论上），所以这里没有报告列。
 */
import type { TableColumnData } from '@arco-design/web-vue'
import type { CandidateVerdictRow } from '@/types/static-scan'
import { confidenceText, shortGroupKey, verdictTag } from './useCandidateVerdictHistory'

defineProps<{ groups: CandidateVerdictRow[] }>()

const columns: TableColumnData[] = [
  { title: '权限分组', slotName: 'gKey', width: 220 },
  { title: '结论', slotName: 'gVerdict', width: 100 },
  { title: '风险', dataIndex: 'risk_level', width: 70 },
  { title: '置信度', slotName: 'gConfidence', width: 80 },
  { title: '判定依据', dataIndex: 'rationale', ellipsis: true, tooltip: true },
]
</script>

<template>
  <div class="group-panel">
    <div class="group-title">
      权限分组结论（{{ groups.length }} 组）
      <span class="group-note">分组结论不单独出报告，见本轮采信报告</span>
    </div>
    <a-table :data="groups" :columns="columns" :pagination="false" row-key="id" size="mini">
      <template #gKey="{ record: g }">
        <a-tooltip :content="g.group_key || '-'" mini>
          <span class="group-key">{{ shortGroupKey(g.group_key) }}</span>
        </a-tooltip>
      </template>
      <template #gVerdict="{ record: g }">
        <a-tag :color="verdictTag(g.verdict).color" size="small">
          {{ verdictTag(g.verdict).label }}
        </a-tag>
      </template>
      <template #gConfidence="{ record: g }">
        {{ confidenceText(g.confidence) }}
      </template>
    </a-table>
  </div>
</template>

<style scoped>
.group-panel { padding: 4px 0 4px 8px; }
.group-title { margin-bottom: 6px; color: var(--color-text-2); font-size: 12px; font-weight: 500; }
.group-note { margin-left: 8px; color: var(--color-text-3); font-weight: normal; }
.group-key { font-family: var(--font-mono, monospace); }
</style>
