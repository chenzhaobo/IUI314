<script setup lang="ts">
/**
 * 配置检查页右上角：手动检查范围（元数据 / 清单 / 全部）、最近检查时间与「重新检查」。
 *
 * 范围（产品线 / 迭代 / 领域 / 项目组）改用 ReleaseScopeBar，本组件不再管迭代与领域。
 */
import type { ConfigRunFamily } from '@/types/sechub-release'

import { CONFIG_RUN_OPTIONS } from '../../../composables/configCheckRules'

defineProps<{
  running: boolean
  lastScanText: string
}>()

const emit = defineEmits<{
  (e: 'run'): void
}>()

const family = defineModel<ConfigRunFamily>('family', { required: true })
</script>

<template>
  <a-card :bordered="false" class="run-bar">
    <div class="row">
      <span class="label">检查范围</span>
      <a-select v-model="family" :options="CONFIG_RUN_OPTIONS" style="width: 130px" />
      <a-button :loading="running" type="primary" @click="emit('run')">
        重新检查
      </a-button>
    </div>
    <div class="hint">
      最近检查：{{ lastScanText }}
    </div>
  </a-card>
</template>

<style scoped>
.run-bar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 300px;
}
.row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.label {
  color: var(--color-text-3);
  font-size: 12px;
}
.hint {
  color: var(--color-text-3);
  font-size: 12px;
}
</style>
