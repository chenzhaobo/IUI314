<script setup lang="ts">
/**
 * 「影响面」单元格：等级 tag + 分数，悬停给出构成；待补证的额外挂一个标记。
 *
 * 从台账页搬出来的共用件 —— 问题列表也要显示同一个分数，
 * 两边各写一份必然慢慢长歪（措辞、口径行、未评分的样子）。
 */
import type { AnalysisRecord } from './analysisFields'
import { impactColor } from './analysisFields'
import ImpactBreakdown from './ImpactBreakdown.vue'

defineProps<{ record: AnalysisRecord }>()
</script>

<template>
  <!-- Arco 默认 .arco-tooltip-content 是 max-width: 350px，四口径对比表（七列）
       被压成"又窄又高"；content-style 就挂在该元素上，放宽后表格才能单行铺开 -->
  <a-tooltip
    v-if="record?.impact_score !== null && record?.impact_score !== undefined"
    position="right"
    :content-style="{ maxWidth: '640px' }"
  >
    <template #content>
      <div style="min-width: 320px">
        <div style="font-weight: 600; margin-bottom: 4px">
          影响面 {{ record.impact_score }} 分（{{ record.impact_level }}）
        </div>
        <ImpactBreakdown :record="record" />
        <div style="margin-top: 6px; opacity: 0.7; font-size: 12px">
          影响面 = 受影响人次 × 客户广度 × 体验劣化，不是严重程度
        </div>
      </div>
    </template>
    <span>
      <a-tag :color="impactColor(record.impact_level)" size="small">{{ record.impact_level || '--' }}</a-tag>
      <span style="margin-left: 6px; font-variant-numeric: tabular-nums">{{ record.impact_score }}</span>
      <!-- 待补证：分数是按未证实的猜测折算的，不参与优先排序 ——
           行上不标出来，人只会看到它排在后面而不知道原因 -->
      <a-tag v-if="record.evidence_pending" color="orange" size="small" style="margin-left: 6px">待补证</a-tag>
    </span>
  </a-tooltip>
  <span v-else style="color: #c9cdd4">未评分</span>
</template>
