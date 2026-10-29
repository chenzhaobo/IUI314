<script setup lang="ts">
/**
 * AI 投入与效率（默认折叠）：派发次数、AI 生成 / 评审通过率、有效用例来源、Agent 总耗时。
 */
import type { ReleaseAiMetrics } from '@/types/sechub-release'
import { computed } from 'vue'

import { agentMinutesText, rateText } from '../../../composables/releaseDashboardRules'

const props = defineProps<{
  ai: ReleaseAiMetrics
}>()

const cells = computed(() => [
  { label: '派发次数', value: String(props.ai.dispatches) },
  { label: '生成用例数', value: String(props.ai.ai_cases_created) },
  { label: '评审通过率', value: rateText(props.ai.ai_approve_rate) },
  { label: 'AI 有效用例', value: String(props.ai.ai_valid_cases) },
  { label: '人工有效用例', value: String(props.ai.manual_valid_cases) },
  { label: 'Agent 总耗时（分钟）', value: agentMinutesText(props.ai.agent_duration_ms) },
])
</script>

<template>
  <a-card :bordered="false">
    <a-collapse :bordered="false" :default-active-key="[]">
      <a-collapse-item key="ai" header="AI 投入与效率（点击展开）">
        <div class="cells">
          <div v-for="cell in cells" :key="cell.label" class="cell">
            <div class="cell-label">
              {{ cell.label }}
            </div>
            <div class="cell-value">
              {{ cell.value }}
            </div>
          </div>
        </div>
        <div class="hint">
          评审通过率 = 本迭代 AI 生成且复核通过的用例 / AI 生成用例；有效用例按接口聚合。
        </div>
      </a-collapse-item>
    </a-collapse>
  </a-card>
</template>

<style scoped>
.cells {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
}
.cell {
  padding: 10px 12px;
  border: 1px solid var(--color-border-2);
  border-radius: 6px;
}
.cell-label {
  color: var(--color-text-3);
  font-size: 12px;
}
.cell-value {
  margin-top: 4px;
  color: var(--color-text-1);
  font-size: 20px;
  font-weight: 600;
}
.hint {
  margin-top: 10px;
  color: var(--color-text-3);
  font-size: 12px;
}
</style>
