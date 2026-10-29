<script setup lang="ts">
/**
 * 质量看板 6 个 KPI：接口覆盖率 / 新增覆盖率 / 通过率 / 阻塞率 / 未关闭高危缺陷 / 新增高危配置。
 *
 * 有目标线时按 `targets[].met` 着色并显示目标值；比率 1 位小数，null 显示「-」。
 */
import type {
  ReleaseCoverageMetrics,
  ReleaseExecutionMetrics,
  ReleaseIssueInputs,
  ReleaseTargetCheck,
} from '@/types/sechub-release'
import { computed } from 'vue'

import { buildKpiCards } from '../../../composables/releaseDashboardRules'

const props = defineProps<{
  coverage: ReleaseCoverageMetrics
  execution: ReleaseExecutionMetrics
  issues: ReleaseIssueInputs
  targets: ReleaseTargetCheck[]
}>()

const cards = computed(() => buildKpiCards(props.coverage, props.execution, props.issues, props.targets))
</script>

<template>
  <div class="kpi-grid">
    <div
      v-for="card in cards"
      :key="card.key"
      class="kpi-card"
      :class="`tone-${card.tone}`"
    >
      <div class="kpi-label">
        {{ card.label }}
      </div>
      <div class="kpi-value">
        {{ card.value }}
      </div>
      <div class="kpi-hint">
        {{ card.hint }}
      </div>
      <div class="kpi-target">
        {{ card.target }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 12px;
}
.kpi-card {
  padding: 12px 16px;
  border: 1px solid var(--color-border-2);
  border-left: 3px solid var(--color-border-2);
  border-radius: 6px;
  background: var(--color-bg-2);
}
.kpi-label {
  color: var(--color-text-3);
  font-size: 12px;
}
.kpi-value {
  margin-top: 6px;
  color: var(--color-text-1);
  font-size: 24px;
  font-weight: 600;
  line-height: 1.2;
}
.kpi-hint {
  margin-top: 4px;
  color: var(--color-text-3);
  font-size: 12px;
}
.kpi-target {
  margin-top: 6px;
  color: var(--color-text-4);
  font-size: 12px;
}
.tone-ok {
  border-left-color: rgb(var(--success-6));
}
.tone-ok .kpi-value {
  color: rgb(var(--success-6));
}
.tone-bad {
  border-left-color: rgb(var(--danger-6));
}
.tone-bad .kpi-value {
  color: rgb(var(--danger-6));
}
.tone-muted {
  border-left-color: var(--color-border-3);
}
</style>
