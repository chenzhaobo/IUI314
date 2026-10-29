<script setup lang="ts">
/**
 * 接口覆盖看板顶部指标条：迭代信息 + 总数 / 覆盖率 / 新增覆盖率 / 待评审 / 下线数。
 *
 * 纯展示组件，所有比率与天数文案在这里算好，页面只传后端出参。
 */
import type { CoverageCounts, ReleaseIterationScope } from '@/types/sechub-release'
import { computed } from 'vue'

import { coverageRateText } from '../../composables/releaseCoverageRules'

const props = defineProps<{
  iteration: ReleaseIterationScope | null
  summary: CoverageCounts | null
  removedTotal: number
}>()

const daysLeftText = computed(() => {
  const days = props.iteration?.days_left
  if (days === undefined)
    return ''
  if (days < 0)
    return `已结束 ${-days} 天`
  if (days === 0)
    return '今天结束'
  return `剩余 ${days} 天`
})

const daysLeftColor = computed(() => {
  const days = props.iteration?.days_left ?? 0
  if (days < 0)
    return 'gray'
  if (days <= 3)
    return 'orange'
  return 'green'
})

const metrics = computed(() => {
  const s = props.summary
  return [
    { label: '接口总数', value: String(s?.total ?? 0), hint: '' },
    {
      label: '覆盖率',
      value: coverageRateText(s?.covered ?? 0, s?.total ?? 0),
      hint: `${s?.covered ?? 0} / ${s?.total ?? 0}`,
    },
    {
      label: '新增接口覆盖率',
      value: s?.new_total ? coverageRateText(s.new_covered, s.new_total) : '-',
      hint: s?.new_total ? `${s.new_covered} / ${s.new_total}` : '本迭代无新增',
    },
    { label: '待评审', value: String(s?.pending_review ?? 0), hint: '接口无有效用例' },
    { label: '本迭代下线', value: String(props.removedTotal), hint: '清单内已删除' },
  ]
})
</script>

<template>
  <div class="summary-bar">
    <div class="summary-card iteration-card">
      <div class="summary-label">
        当前迭代
      </div>
      <div class="iteration-name">
        {{ iteration?.name || '-' }}
      </div>
      <div class="summary-sub">
        <span v-if="iteration">{{ iteration.start_date }} ~ {{ iteration.end_date }}</span>
        <a-tag v-if="iteration" :color="daysLeftColor" size="small">
          {{ daysLeftText }}
        </a-tag>
      </div>
    </div>
    <div v-for="metric in metrics" :key="metric.label" class="summary-card">
      <div class="summary-label">
        {{ metric.label }}
      </div>
      <div class="summary-value">
        {{ metric.value }}
      </div>
      <div v-if="metric.hint" class="summary-sub">
        {{ metric.hint }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.summary-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.summary-card {
  flex: 1 1 150px;
  min-width: 150px;
  padding: 12px 16px;
  border: 1px solid var(--color-border-2);
  border-radius: 6px;
  background: var(--color-bg-2);
}
.iteration-card {
  flex: 1.6 1 220px;
}
.summary-label {
  color: var(--color-text-3);
  font-size: 12px;
}
.summary-value {
  margin-top: 6px;
  color: var(--color-text-1);
  font-size: 24px;
  font-weight: 600;
  line-height: 1.2;
}
.iteration-name {
  margin-top: 6px;
  color: var(--color-text-1);
  font-size: 18px;
  font-weight: 600;
  line-height: 1.3;
}
.summary-sub {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  color: var(--color-text-3);
  font-size: 12px;
}
</style>
