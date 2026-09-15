<script setup lang="ts">
/**
 * 影响面构成明细：按数据来源分段（本问题的折算 / 快照依据 / 本次分析）。
 *
 * tooltip 与两个详情抽屉共用这一份 markup —— 同一份数据在三处各写一遍，
 * 迟早出现"tooltip 改了、抽屉没改"的口径不一致。
 */
import type { AnalysisRecord } from './analysisFields'
import { computed } from 'vue'
import { impactPendingNote, impactSections } from './analysisFields'

const props = defineProps<{ record: AnalysisRecord }>()

const sections = computed(() => impactSections(props.record))
const pendingNote = computed(() => impactPendingNote(props.record))
</script>

<template>
  <div style="line-height: 1.85">
    <!-- 待补证排在最前：它决定这些数能不能拿来排期，比任何一项数字都重要 -->
    <div v-if="pendingNote" style="margin-bottom: 6px; color: #f77234">
      {{ pendingNote }}
    </div>
    <div v-for="(section, si) in sections" :key="section.title" :style="si > 0 ? 'margin-top: 8px' : ''">
      <div style="font-weight: 600; opacity: 0.85">
        {{ section.title }}
      </div>
      <div v-for="line in section.lines" :key="line.k" style="display: flex; gap: 10px">
        <span style="width: 84px; flex-shrink: 0; opacity: 0.7">{{ line.k }}</span>
        <span style="flex: 1">{{ line.v }}</span>
      </div>
    </div>
    <div v-if="!sections.length" style="opacity: 0.7">
      暂无构成明细
    </div>
  </div>
</template>
