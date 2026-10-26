<script setup lang="ts">
import { CRON_HINT } from '@/utils/cron'

defineProps<{
  enabled: boolean
  cron: string
  nextRunAt?: string
}>()

const emit = defineEmits<{
  'update:enabled': [value: boolean]
  'update:cron': [value: string]
}>()
</script>

<template>
  <div class="task-schedule">
    <div class="task-schedule__row">
      <a-switch
        :model-value="enabled"
        @change="value => emit('update:enabled', Boolean(value))"
      />
      <span class="task-schedule__label">启用定时执行</span>
      <span v-if="nextRunAt" class="task-schedule__next">下次：{{ nextRunAt }}</span>
    </div>
    <a-input
      :model-value="cron"
      placeholder="如 0 0 2 * * *（每天 02:00）"
      allow-clear
      @update:model-value="value => emit('update:cron', String(value ?? ''))"
    />
    <div class="task-schedule__hint">
      {{ CRON_HINT }}
    </div>
  </div>
</template>

<style scoped>
.task-schedule {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.task-schedule__row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.task-schedule__label {
  color: var(--color-text-2);
}

.task-schedule__next {
  color: var(--color-text-3);
  font-size: 12px;
}

.task-schedule__hint {
  color: var(--color-text-3);
  font-size: 12px;
  line-height: 1.5;
}
</style>
