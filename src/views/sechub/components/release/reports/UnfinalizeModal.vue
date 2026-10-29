<script setup lang="ts">
/**
 * 撤销定稿弹窗：原因必填，提交成功由 a-modal 的 on-before-ok 自动关闭，
 * 失败时保持打开以便修改原因。
 */
import type { ReleaseSnapshotRow } from '@/types/sechub-release'
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  snapshot: ReleaseSnapshotRow | null
  submitting: boolean
  submitReason: (reason: string) => Promise<boolean>
}>()

const visible = defineModel<boolean>('visible', { default: false })
const reason = ref('')

const canSubmit = computed(() => reason.value.trim().length > 0 && !props.submitting)

watch(visible, (value) => {
  if (value)
    reason.value = ''
})

async function handleBeforeOk(): Promise<boolean> {
  if (!canSubmit.value)
    return false
  return props.submitReason(reason.value.trim())
}
</script>

<template>
  <a-modal
    v-model:visible="visible"
    :mask-closable="false"
    :ok-loading="submitting"
    :on-before-ok="handleBeforeOk"
    title="撤销定稿"
  >
    <a-alert type="warning">
      撤销后该快照会恢复为未定稿；原因会记录在快照上。
    </a-alert>
    <div class="snapshot-line">
      {{ snapshot?.iteration_name || snapshot?.iteration_id || '-' }}
    </div>
    <a-textarea
      v-model="reason"
      :max-length="200"
      placeholder="请填写撤销原因（必填）"
      show-word-limit
      :auto-size="{ minRows: 3, maxRows: 5 }"
    />
  </a-modal>
</template>

<style scoped>
.snapshot-line {
  margin: 12px 0 8px;
  color: var(--color-text-2);
  font-size: 13px;
}
</style>
