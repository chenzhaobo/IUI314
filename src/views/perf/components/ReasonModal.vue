<script setup lang="ts">
/**
 * 「填写原因再提交」的通用确认框：问题台账与问题列表里所有要留依据的动作共用
 * （观察 / 撤回 / 废弃 / 人工标记二开 / 已修复 / 已发版 / 已验证 / 退回 / 撤销转缺陷……）。
 *
 * 原因会写进流转记录。`required` 时空白不能提交（后端同样会拒），
 * 非必填时作为备注一并记录。`submit` 返回 true 表示成功、关闭弹窗。
 */
import { computed, ref, watch } from 'vue'

defineOptions({ name: 'ReasonModal' })

const props = withDefaults(defineProps<{
  title: string
  /** 弹窗顶部的说明（会发生什么、和相邻动作的区别） */
  hint?: string
  label?: string
  placeholder?: string
  okText?: string
  /** 危险动作（废弃 / 撤销）用红色确认按钮 */
  danger?: boolean
  required?: boolean
  maxLength?: number
  submit: (reason: string) => Promise<boolean>
}>(), {
  hint: '',
  label: '原因',
  placeholder: '写明依据，会记入流转记录',
  okText: '确认',
  danger: false,
  required: true,
  maxLength: 500,
})
const visible = defineModel<boolean>('visible', { required: true })

const reason = ref('')
const submitting = ref(false)

watch(visible, (open) => {
  if (open)
    reason.value = ''
})

const blocked = computed(() => props.required && !reason.value.trim())

async function handleBeforeOk(): Promise<boolean> {
  if (blocked.value)
    return false
  submitting.value = true
  try {
    return await props.submit(reason.value.trim())
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <a-modal
    v-model:visible="visible"
    :title="title"
    :ok-text="okText"
    :ok-button-props="{ disabled: blocked, status: danger ? 'danger' : undefined }"
    :ok-loading="submitting"
    :on-before-ok="handleBeforeOk"
    :width="560"
  >
    <a-alert v-if="hint" type="normal" style="margin-bottom: 12px; white-space: pre-line">
      {{ hint }}
    </a-alert>
    <a-form layout="vertical" :model="{ reason }">
      <a-form-item :label="label" :required="required">
        <a-textarea
          v-model="reason"
          :auto-size="{ minRows: 3, maxRows: 6 }"
          :placeholder="placeholder"
          :max-length="maxLength"
          show-word-limit
        />
      </a-form-item>
    </a-form>
  </a-modal>
</template>
