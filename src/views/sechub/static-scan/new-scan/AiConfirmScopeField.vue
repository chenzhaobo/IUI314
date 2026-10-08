<script setup lang="ts">
/**
 * AI 确认的「确认范围」下拉（行级与批量弹窗共用）：全部，或 run 内出现过的某个扫描点。
 * 选项由 ./useRunScanPoints 提供（数据源 /prescan/summary）。
 */
import type { AiConfirmScopeOption } from './types'

defineProps<{
  options: AiConfirmScopeOption[]
  loading?: boolean
  disabled?: boolean
  /** 批量入口：提示不含所选扫描点的运行会被跳过 */
  batch?: boolean
}>()
const scope = defineModel<string>({ required: true })
</script>

<template>
  <a-form-item label="确认范围">
    <a-select v-model="scope" :loading="loading" :disabled="disabled" allow-search>
      <a-option v-for="opt in options" :key="opt.value" :value="opt.value">
        {{ opt.label }}
      </a-option>
    </a-select>
    <div v-if="scope !== 'all'" class="text-xs text-gray" style="margin-top: 4px">
      只确认该扫描点下的待确认候选{{ batch ? '；不含该扫描点的运行会跳过' : '' }}。
    </div>
  </a-form-item>
</template>
