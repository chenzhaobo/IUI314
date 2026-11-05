<script setup lang="ts">
/** 状态流转原因弹窗（关闭 / 不处理 / 误报）。onConfirm 返回 false 时保持打开。 */
defineProps<{
  title: string
  loading: boolean
  onConfirm: () => Promise<boolean>
}>()

const visible = defineModel<boolean>('visible', { required: true })
const reason = defineModel<string>('reason', { required: true })
</script>

<template>
  <a-modal v-model:visible="visible" :title="title" :ok-loading="loading" :on-before-ok="onConfirm">
    <a-textarea v-model="reason" :auto-size="{ minRows: 3, maxRows: 6 }" placeholder="必填：说明原因" :max-length="500" show-word-limit />
  </a-modal>
</template>
