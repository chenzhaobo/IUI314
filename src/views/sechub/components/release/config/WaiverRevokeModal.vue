<script setup lang="ts">
/**
 * 撤销白名单弹窗：原因必填，提交后不再被其他有效白名单覆盖的检查项退回待处理。
 */
import type { ReleaseWaiver } from '@/types/sechub-release'
import { Message } from '@arco-design/web-vue'
import { ref, watch } from 'vue'

import { matchTypeLabel } from '../../../composables/configCheckRules'

defineProps<{
  waiver: ReleaseWaiver | null
  loading: boolean
}>()

const emit = defineEmits<{
  (e: 'confirm', reason: string): void
}>()

const visible = defineModel<boolean>('visible', { default: false })
const reason = ref('')

watch(visible, (value) => {
  if (value)
    reason.value = ''
})

function confirm() {
  if (!reason.value.trim()) {
    Message.warning('撤销原因不能为空')
    return
  }
  emit('confirm', reason.value.trim())
}
</script>

<template>
  <a-modal
    v-model:visible="visible"
    :closable="!loading"
    :mask-closable="!loading"
    :ok-loading="loading"
    :width="520"
    title="撤销白名单"
    @ok="confirm"
  >
    <template v-if="waiver">
      <a-alert type="warning" :show-icon="false" style="margin-bottom: 12px">
        撤销后，不再被其他有效白名单覆盖的检查项会退回「待处理」并重新计入发版结论。
      </a-alert>
      <a-descriptions :column="1" bordered size="small" style="margin-bottom: 12px">
        <a-descriptions-item label="规则">
          {{ waiver.rule_code }}（{{ matchTypeLabel(waiver.match_type) }}）
        </a-descriptions-item>
        <a-descriptions-item label="对象">
          {{ waiver.object_key }}
        </a-descriptions-item>
      </a-descriptions>
      <a-form :model="{ reason }" layout="vertical">
        <a-form-item label="撤销原因" required>
          <a-textarea v-model="reason" :auto-size="{ minRows: 2 }" placeholder="说明为什么撤销" />
        </a-form-item>
      </a-form>
    </template>
  </a-modal>
</template>
