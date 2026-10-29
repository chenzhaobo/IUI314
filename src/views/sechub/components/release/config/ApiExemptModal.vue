<script setup lang="ts">
/**
 * 新增接口免测弹窗：接口路径 + 方法 + 原因 + 到期时间。
 *
 * 提交固定 rule_code = API_EXEMPT、match_type = exact、object_key = PATH|METHOD，
 * 不带环境（所有环境生效），由 useWaivers 组装请求。
 */
import type { ExemptFormInput } from '../../../composables/configCheckRules'
import { Message } from '@arco-design/web-vue'
import { reactive, ref, watch } from 'vue'

import {
  HTTP_METHOD_OPTIONS,
  validateExemptForm,
} from '../../../composables/configCheckRules'

defineProps<{ loading: boolean }>()

const emit = defineEmits<{
  (e: 'submit', form: ExemptFormInput): void
}>()

const visible = defineModel<boolean>('visible', { default: false })

const form = reactive({ path: '', method: 'GET', reason: '', expiresAt: '' })
const expiresAt = ref<string | undefined>(undefined)

watch(visible, (value) => {
  if (!value)
    return
  form.path = ''
  form.method = 'GET'
  form.reason = ''
  form.expiresAt = ''
  expiresAt.value = undefined
})

watch(expiresAt, (value) => {
  form.expiresAt = value ?? ''
})

function confirm() {
  const error = validateExemptForm(form)
  if (error) {
    Message.warning(error)
    return
  }
  emit('submit', { ...form })
}
</script>

<template>
  <a-modal
    v-model:visible="visible"
    :closable="!loading"
    :mask-closable="!loading"
    :ok-loading="loading"
    :width="560"
    title="新增接口免测"
    @ok="confirm"
  >
    <a-alert type="info" :show-icon="false" style="margin-bottom: 12px">
      免测只对「接口覆盖」判定生效：该 PATH|METHOD 不再计入未覆盖统计，需要回归时请撤销。
    </a-alert>
    <a-form :model="form" layout="vertical">
      <a-form-item label="接口路径" required>
        <a-input v-model="form.path" allow-clear placeholder="如：/kapi/gl/total/list" />
      </a-form-item>
      <a-form-item label="HTTP 方法" required>
        <a-select v-model="form.method" :options="HTTP_METHOD_OPTIONS" style="width: 200px" />
      </a-form-item>
      <a-form-item label="原因" required>
        <a-textarea v-model="form.reason" :auto-size="{ minRows: 2 }" placeholder="至少 4 个字符，说明为什么本迭代不回归" />
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
  </a-modal>
</template>
