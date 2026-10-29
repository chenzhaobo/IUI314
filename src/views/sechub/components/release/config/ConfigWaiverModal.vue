<script setup lang="ts">
import type { WaiverFormInput } from '../../../composables/configCheckRules'
/**
 * 加白名单弹窗：匹配方式（exact / app）、原因（≥4 字）、到期时间（可选）。
 *
 * 提交取检查项所属环境与对象 key，由页面调用 POST /sechub/release/waivers。
 */
import type { ConfigItem, WaiverMatchType } from '@/types/sechub-release'
import { Message } from '@arco-design/web-vue'
import { ref, watch } from 'vue'

import {
  validateWaiverReason,
  WAIVER_MATCH_OPTIONS,
} from '../../../composables/configCheckRules'

defineProps<{
  item: ConfigItem | null
  loading: boolean
}>()

const emit = defineEmits<{
  (e: 'submit', form: WaiverFormInput): void
}>()

const visible = defineModel<boolean>('visible', { default: false })

const matchType = ref<WaiverMatchType>('exact')
const reason = ref('')
const expiresAt = ref<string | undefined>(undefined)

watch(visible, (value) => {
  if (!value)
    return
  matchType.value = 'exact'
  reason.value = ''
  expiresAt.value = undefined
})

function confirm() {
  const error = validateWaiverReason(reason.value)
  if (error) {
    Message.warning(error)
    return
  }
  emit('submit', {
    matchType: matchType.value,
    reason: reason.value.trim(),
    expiresAt: expiresAt.value ?? '',
  })
}
</script>

<template>
  <a-modal
    v-model:visible="visible"
    :closable="!loading"
    :mask-closable="!loading"
    :ok-loading="loading"
    :width="560"
    title="加白名单"
    @ok="confirm"
  >
    <template v-if="item">
      <a-alert type="info" :show-icon="false" style="margin-bottom: 12px">
        规则 {{ item.rule_code }} · {{ item.rule_title || '-' }}
        <br>
        对象：{{ item.object_key }}
        <br>
        加白后该检查项立即转为「已加白」，扫描不再计入待处理。
      </a-alert>
      <a-form :model="{ matchType, reason, expiresAt }" layout="vertical">
        <a-form-item label="匹配方式">
          <a-select v-model="matchType" :options="WAIVER_MATCH_OPTIONS" />
        </a-form-item>
        <a-form-item label="原因" required>
          <a-textarea v-model="reason" :auto-size="{ minRows: 2 }" placeholder="至少 4 个字符，说明为什么可以加白" />
        </a-form-item>
        <a-form-item label="到期时间（可选）">
          <a-date-picker
            v-model="expiresAt"
            show-time
            style="width: 100%"
            value-format="YYYY-MM-DD HH:mm:ss"
          />
        </a-form-item>
      </a-form>
    </template>
  </a-modal>
</template>
