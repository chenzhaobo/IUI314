<script setup lang="ts">
/**
 * 配置检查页头：迭代 / 范围切换、两个分类页签、立即检查与最近检查时间。
 *
 * 「立即检查」按当前页签签发 family（meta / api），后端后台执行后立即返回。
 */
import type { ConfigRuleFamily, ConfigScope, ReleaseIteration } from '@/types/sechub-release'
import { computed } from 'vue'

import { CONFIG_FAMILY_TABS, CONFIG_SCOPE_OPTIONS } from '../../../composables/configCheckRules'

const props = defineProps<{
  iterations: ReleaseIteration[]
  running: boolean
  lastScanText: string
  productDomains: string[]
}>()

const emit = defineEmits<{
  (e: 'iterationChange'): void
  (e: 'scopeChange'): void
  (e: 'familyChange'): void
  (e: 'run'): void
}>()

const iterationId = defineModel<string>('iterationId', { required: true })
const scope = defineModel<ConfigScope>('scope', { required: true })
const family = defineModel<ConfigRuleFamily>('family', { required: true })

const iterationOptions = computed(() => props.iterations.map(item => ({
  value: item.id,
  label: `${item.name}（${item.code}）`,
})))

const domainText = computed(() => {
  if (scope.value === 'all')
    return '全部'
  return props.productDomains.length ? props.productDomains.join('、') : '未配置领域'
})

function onFamilyChange(key: string | number) {
  family.value = key === 'api' ? 'api' : 'meta'
  emit('familyChange')
}
</script>

<template>
  <a-card :bordered="false">
    <div class="toolbar">
      <a-space wrap>
        <a-select
          v-model="iterationId"
          :options="iterationOptions"
          placeholder="选择迭代"
          style="width: 240px"
          @change="emit('iterationChange')"
        />
        <a-select
          v-model="scope"
          :options="CONFIG_SCOPE_OPTIONS"
          style="width: 120px"
          @change="emit('scopeChange')"
        />
        <span class="hint">范围领域：{{ domainText }}</span>
      </a-space>
      <a-space>
        <span class="hint">最近检查：{{ lastScanText }}</span>
        <a-button type="primary" :loading="running" @click="emit('run')">
          立即检查
        </a-button>
      </a-space>
    </div>
    <a-tabs :active-key="family" type="rounded" @change="onFamilyChange">
      <a-tab-pane v-for="tab in CONFIG_FAMILY_TABS" :key="tab.value" :title="tab.label" />
    </a-tabs>
  </a-card>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.hint {
  color: var(--color-text-3);
  font-size: 12px;
}
</style>
