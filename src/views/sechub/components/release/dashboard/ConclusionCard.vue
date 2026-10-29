<script setup lang="ts">
/**
 * 质量看板结论卡：结论色块（阻断红 / 有风险黄 / 通过绿）、迭代剩余天数、触发项。
 *
 * 触发项已由后端按 Blocked 在前截到 10 条，这里再兜一次底。
 */
import type { ReleaseConclusion, ReleaseIterationScope, ReleaseTrigger } from '@/types/sechub-release'
import { computed } from 'vue'

import { conclusionMeta, daysLeftText } from '../../../composables/releaseDashboardRules'

const props = withDefaults(defineProps<{
  conclusion: ReleaseConclusion
  iteration: ReleaseIterationScope | null
  triggers?: ReleaseTrigger[]
}>(), {
  triggers: () => [],
})

const meta = computed(() => conclusionMeta(props.conclusion))
const days = computed(() => daysLeftText(props.iteration?.days_left))
const shown = computed(() => props.triggers.slice(0, 10))
</script>

<template>
  <a-card :bordered="false" class="conclusion-card" :class="`tone-${meta.key || 'unknown'}`">
    <div class="head">
      <div>
        <div class="label">
          发版结论
        </div>
        <div class="value">
          {{ meta.label }}
        </div>
      </div>
      <div class="side">
        <div class="label">
          {{ iteration?.name || '未选择迭代' }}
        </div>
        <a-tag :color="meta.color" size="small">
          {{ days }}
        </a-tag>
        <div v-if="iteration" class="range">
          {{ iteration.start_date }} ~ {{ iteration.end_date }}
        </div>
      </div>
    </div>
    <div class="triggers">
      <div class="label">
        触发项（{{ triggers.length }}）
      </div>
      <span v-if="!shown.length" class="empty">没有触发项</span>
      <ul v-else>
        <li v-for="(trigger, index) in shown" :key="`${trigger.code}-${index}`">
          <a-tag :color="conclusionMeta(trigger.level).color" size="small">
            {{ conclusionMeta(trigger.level).label }}
          </a-tag>
          <span class="trigger-text">{{ trigger.text }}</span>
        </li>
      </ul>
    </div>
  </a-card>
</template>

<style scoped>
.conclusion-card {
  border-left: 4px solid var(--color-border-2);
}
.tone-blocked {
  border-left-color: rgb(var(--danger-6));
  background: var(--color-danger-light-1);
}
.tone-risky {
  border-left-color: rgb(var(--warning-6));
  background: var(--color-warning-light-1);
}
.tone-passed {
  border-left-color: rgb(var(--success-6));
  background: var(--color-success-light-1);
}
.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.label {
  color: var(--color-text-3);
  font-size: 12px;
}
.value {
  margin-top: 6px;
  color: var(--color-text-1);
  font-size: 28px;
  font-weight: 700;
  line-height: 1.2;
}
.side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}
.range {
  color: var(--color-text-3);
  font-size: 12px;
}
.triggers {
  margin-top: 14px;
}
.triggers ul {
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
}
.triggers li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 0;
}
.trigger-text {
  color: var(--color-text-1);
  font-size: 13px;
}
.empty {
  display: inline-block;
  margin-top: 8px;
  color: var(--color-text-3);
  font-size: 13px;
}
</style>
