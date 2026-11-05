<script setup lang="ts">
/**
 * 处理信息字段：预计完成 / 用户故事 / 缺陷编码 / 处理意见。
 *
 * 单条编辑（详情抽屉）与批量填写共用；批量时留空 = 不修改。
 */
import type { HandleForm } from '../types'

defineProps<{
  /** 批量模式：提示「留空不修改」 */
  batch?: boolean
  disabled?: boolean
}>()

const form = defineModel<HandleForm>('form', { required: true })
</script>

<template>
  <a-form :model="form" layout="vertical" :disabled="disabled">
    <a-form-item label="预计完成日期">
      <a-date-picker v-model="form.plan_finish_date" value-format="YYYY-MM-DD" style="width: 100%" />
    </a-form-item>
    <a-form-item label="用户故事">
      <a-input v-model="form.story_no" :placeholder="batch ? '留空则不修改' : '用户故事编号'" allow-clear />
    </a-form-item>
    <a-form-item label="缺陷编码">
      <a-input v-model="form.defect_code" :placeholder="batch ? '留空则不修改' : '缺陷编码'" allow-clear />
    </a-form-item>
    <a-form-item label="处理意见">
      <a-textarea
        v-model="form.handle_note"
        :auto-size="{ minRows: 2, maxRows: 5 }"
        :placeholder="batch ? '留空则不修改' : '处理意见'"
      />
    </a-form-item>
  </a-form>
</template>
