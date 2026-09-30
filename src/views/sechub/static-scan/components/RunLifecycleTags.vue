<script setup lang="ts">
/**
 * 运行行的「扫描范围 + 判定生命周期」标签（006c C02）。
 *
 * - target_type='unified' 标「统一扫描」；旧轨范围（repository/form/microservice）不打标签，保持原列表观感；
 * - confirm_state 非空（统一扫描新协议）时标待判定/判定中/已定稿/定稿失败；null = 历史 run，不展示。
 */
import { computed } from 'vue'
import { confirmStateLabels, runTargetTypeLabels } from '../labels'

const props = defineProps<{
  targetType?: string | null
  confirmState?: string | null
}>()

const targetTag = computed(() => {
  const key = props.targetType?.trim() ?? ''
  return key === 'unified' ? runTargetTypeLabels.unified : null
})

const stateTag = computed(() => {
  const key = props.confirmState?.trim() ?? ''
  if (!key)
    return null
  return confirmStateLabels[key] ?? { label: key, color: 'gray', tip: `判定状态：${key}` }
})
</script>

<template>
  <span v-if="targetTag || stateTag" class="run-lifecycle-tags">
    <a-tag v-if="targetTag" :color="targetTag.color" size="small">
      {{ targetTag.label }}
    </a-tag>
    <a-tooltip v-if="stateTag" :content="stateTag.tip" mini>
      <a-tag :color="stateTag.color" size="small">
        {{ stateTag.label }}
      </a-tag>
    </a-tooltip>
  </span>
</template>

<style scoped>
.run-lifecycle-tags {
  display: inline-flex;
  gap: 4px;
  margin-right: 4px;
  vertical-align: middle;
}
</style>
