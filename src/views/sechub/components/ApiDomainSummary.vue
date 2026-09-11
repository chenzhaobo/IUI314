<script setup lang="ts">
/**
 * API 域摘要条（API测试结果页顶部）
 *
 * 数据来自域视图 GET /sechub/scan/domain/cases?domain=openapi 的 summary：
 *   用例总数 / 最近一次含该域结果的运行 / 该运行的判定分布。
 */
import { computed } from 'vue'

import { formatTime } from '@/hooks'
import { verdictColor } from './apiTestShared'

const props = defineProps<{
  summary?: Record<string, any> | null
}>()

const RUN_STATUS: Record<string, { label: string, color: string }> = {
  pending: { label: '待执行', color: 'gray' },
  running: { label: '运行中', color: 'blue' },
  success: { label: 'PASS', color: 'green' },
  failed: { label: 'FAIL', color: 'red' },
  partial: { label: '部分通过', color: 'orange' },
  cancelled: { label: '已取消', color: 'gray' },
}
function runStatusMeta(status?: string | null) {
  return RUN_STATUS[status || ''] ?? { label: status || '--', color: 'gray' }
}

const verdictStats = computed(() => {
  const counts = props.summary?.verdict_counts || {}
  return ['PASS', 'FAIL', 'REVIEW', 'BLOCKED', 'ERROR']
    .map(v => ({ label: v, value: counts[v] || 0, color: verdictColor(v) }))
    .filter(x => x.value > 0)
})
</script>

<template>
  <div class="domain-summary">
    <div class="summary-item">
      <span class="summary-label">API 用例总数</span>
      <span class="summary-value">{{ summary?.case_total ?? 0 }}</span>
    </div>
    <div class="summary-item">
      <span class="summary-label">最近执行</span>
      <template v-if="summary?.last_run">
        <a-tag :color="runStatusMeta(summary.last_run.status).color">
          {{ runStatusMeta(summary.last_run.status).label }}
        </a-tag>
        <span class="summary-value">{{ summary.last_run.run_name }}</span>
        <span class="summary-sub">{{ formatTime(summary.last_run.finished_at || summary.last_run.started_at) }}</span>
      </template>
      <span v-else class="summary-sub">暂无执行记录</span>
    </div>
    <div class="summary-item">
      <span class="summary-label">判定分布</span>
      <template v-if="verdictStats.length">
        <a-tag v-for="s in verdictStats" :key="s.label" :color="s.color">
          {{ s.label }}: {{ s.value }}
        </a-tag>
      </template>
      <span v-else class="summary-sub">--</span>
    </div>
  </div>
</template>

<style scoped>
.domain-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  align-items: center;
  padding: 10px 14px;
  margin-bottom: 10px;
  background: var(--color-fill-1);
  border-radius: 4px;
}

.summary-item {
  display: flex;
  gap: 8px;
  align-items: center;
}

.summary-label {
  color: var(--color-text-3);
}

.summary-value {
  font-weight: 600;
}

.summary-sub {
  color: var(--color-text-3);
  font-size: 12px;
}
</style>
