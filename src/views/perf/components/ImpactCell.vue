<script setup lang="ts">
/**
 * 「影响面」单元格：等级 tag + 分数，悬停给出构成。
 *
 * 从台账页搬出来的共用件 —— 问题列表也要显示同一个分数，
 * 两边各写一份必然慢慢长歪（措辞、口径行、未评分的样子）。
 */
import type { AnalysisRecord } from './analysisFields'
import { impactColor, impactRows } from './analysisFields'

defineProps<{ record: AnalysisRecord }>()
</script>

<template>
  <a-tooltip v-if="record?.impact_score !== null && record?.impact_score !== undefined" position="right">
    <template #content>
      <div style="line-height: 1.9; min-width: 300px">
        <div style="font-weight: 600; margin-bottom: 4px">
          影响面 {{ record.impact_score }} 分（{{ record.impact_level }}）
        </div>
        <div v-for="row in impactRows(record)" :key="row.k" style="display: flex; gap: 10px">
          <span style="width: 84px; opacity: 0.75">{{ row.k }}</span>
          <span style="flex: 1">{{ row.v }}</span>
        </div>
        <div style="margin-top: 6px; opacity: 0.7; font-size: 12px">
          影响面 = 受影响人次 × 客户广度 × 体验劣化，不是严重程度
        </div>
      </div>
    </template>
    <span>
      <a-tag :color="impactColor(record.impact_level)" size="small">{{ record.impact_level || '--' }}</a-tag>
      <span style="margin-left: 6px; font-variant-numeric: tabular-nums">{{ record.impact_score }}</span>
    </span>
  </a-tooltip>
  <span v-else style="color: #c9cdd4">未评分</span>
</template>
