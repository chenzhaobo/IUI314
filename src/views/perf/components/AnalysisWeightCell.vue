<script setup lang="ts">
/**
 * 「分析权重」单元格：占本维度总慢时间的百分比，悬停给出治理预期。
 *
 * 与「影响面」分开显示是有意的：口径不同（全量统计 vs AI 那一轮抽样），
 * 两者不一致本身就是信息 —— 分析权重高而系统层低，说明低频但高度集中。
 */
import type { AnalysisRecord } from './analysisFields'
import { computed } from 'vue'
import { analysisWeightLines } from './analysisFields'

const props = defineProps<{ record: AnalysisRecord }>()

const lines = computed(() => analysisWeightLines(props.record))
</script>

<template>
  <a-tooltip v-if="record?.analysis_weight !== null && record?.analysis_weight !== undefined">
    <template #content>
      {{ lines[0] }}
      <template v-if="lines.length > 1">
        <br>{{ lines[1] }}
      </template>
    </template>
    <span style="font-variant-numeric: tabular-nums">{{ record.analysis_weight }}%</span>
  </a-tooltip>
  <span v-else style="color: #c9cdd4">--</span>
</template>
