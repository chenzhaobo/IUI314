<script setup lang="ts">
import { computed } from 'vue'

defineOptions({ name: 'StaticScanStatusBadge' })

const props = withDefaults(defineProps<{
  status: string
  label?: string
  size?: 'small' | 'medium' | 'large'
}>(), {
  label: '',
  size: 'medium',
})

const labels: Readonly<Record<string, string>> = {
  pass: '通过',
  fail: '业务不通过',
  not_applicable: '不适用',
  unknown: '未知/不完整',
  authoritative: '权威结果',
  non_authoritative: '非权威诊断',
  succeeded: '执行成功',
  failed: '执行失败',
  cancelled: '已取消',
  candidate_only: '仅候选',
  reconstructed_pending_confirmation: '待业务确认',
  formal: '正式发布',
  knowledge_only: '仅知识',
  released: '正式发布',
  draft: '草稿',
  fixed: '已修复',
  still_present: '仍存在',
  unverifiable: '无法验证',
  pending: '等待中',
  running: '执行中',
  queued: '排队中',
  retry_wait: '等待重试',
  needs_human_review: '需人工复核',
  timed_out: '超时',
  invalid_output: '输出无效',
  missing: '缺失',
}

const colors: Readonly<Record<string, string>> = {
  pass: 'green',
  authoritative: 'green',
  succeeded: 'green',
  released: 'green',
  formal: 'green',
  fixed: 'green',
  fail: 'red',
  failed: 'red',
  still_present: 'red',
  invalid_output: 'red',
  non_authoritative: 'orangered',
  unknown: 'orangered',
  candidate_only: 'orangered',
  reconstructed_pending_confirmation: 'orangered',
  unverifiable: 'orangered',
  needs_human_review: 'orangered',
  cancelled: 'gray',
  not_applicable: 'gray',
  draft: 'gray',
  knowledge_only: 'gray',
  missing: 'gray',
  pending: 'blue',
  running: 'arcoblue',
  queued: 'blue',
  retry_wait: 'purple',
  timed_out: 'orange',
}

const text = computed(() => props.label || labels[props.status] || props.status)
const color = computed(() => colors[props.status] || 'gray')
</script>

<template>
  <a-tag :color="color" :size="size">
    {{ text }}
  </a-tag>
</template>
