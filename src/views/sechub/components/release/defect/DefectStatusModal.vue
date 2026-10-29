<script setup lang="ts">
/**
 * 缺陷状态流转确认弹窗：标记已提交时可选补录外部缺陷编号。
 */
import type { DefectAction } from '../../../composables/defectDraftRules'
import type { ReleaseDefect } from '@/types/sechub-release'
import { computed, ref, watch } from 'vue'

import { defectStatusLabel } from '../../../composables/defectDraftRules'

const props = defineProps<{
  defect: ReleaseDefect | null
  action: DefectAction | null
  loading: boolean
}>()

const emit = defineEmits<{
  (e: 'confirm', externalNo: string): void
}>()

const visible = defineModel<boolean>('visible', { default: false })

const externalNo = ref('')

const targetLabel = computed(() => (props.action ? defectStatusLabel(props.action.target) : '-'))

watch(visible, (value) => {
  if (value)
    externalNo.value = props.defect?.external_no ?? ''
})

function confirm() {
  emit('confirm', externalNo.value)
}
</script>

<template>
  <a-modal
    v-model:visible="visible"
    :closable="!loading"
    :mask-closable="!loading"
    :title="action?.label || '状态变更'"
    :width="520"
  >
    <a-alert type="info" :show-icon="false">
      {{ action?.label }}后状态将变为「{{ targetLabel }}」。
    </a-alert>
    <div v-if="defect" class="defect-line">
      {{ defect.defect_code }} · {{ defect.title }}
    </div>
    <a-form v-if="action?.needsExternalNo" :model="{ externalNo }" layout="vertical" style="margin-top: 12px">
      <a-form-item label="外部缺陷编号（可选）">
        <a-input v-model="externalNo" allow-clear placeholder="粘贴外部缺陷系统编号" />
      </a-form-item>
    </a-form>
    <template #footer>
      <a-space>
        <a-button :disabled="loading" @click="visible = false">
          取消
        </a-button>
        <a-button type="primary" :loading="loading" @click="confirm">
          确定
        </a-button>
      </a-space>
    </template>
  </a-modal>
</template>

<style scoped>
.defect-line {
  margin-top: 12px;
  color: var(--color-text-2);
  font-size: 13px;
  word-break: break-word;
}
</style>
