<script setup lang="ts">
import type { IuQueryFormField } from '@/types/base/iu-form'
import type { slowSqlLogQueryParam } from '@/types/system/slow-log'
import { ref } from 'vue'
import IuQueryForm from '@/components/iui/iu-query-form.vue'
import { FormItemType } from '@/types/base/iu-form'

defineOptions({ name: 'SlowSqlQuery' })
const emits = defineEmits(['query'])
const queryParams = defineModel<slowSqlLogQueryParam>('queryParams', { required: true })
const sourceOptions = [
  { label: 'HTTP 请求', value: 'http' },
  { label: '后台任务', value: 'background' },
]

const formItems = ref<IuQueryFormField[]>([
  { field: 'request_path', label: '请求路径', type: FormItemType.input, input: { allowClear: true, placeholder: '包含匹配' } },
  { field: 'trace_id', label: 'Trace ID', type: FormItemType.input, input: { allowClear: true, placeholder: '完整 trace_id' } },
  { field: 'sql_hash', label: 'SQL Hash', type: FormItemType.input, input: { allowClear: true, placeholder: '相同 SQL 聚合' } },
  {
    field: 'source',
    label: '来源',
    type: FormItemType.select,
    select: { allowClear: true, options: sourceOptions, fieldNames: { label: 'label', value: 'value' } },
  },
  { field: 'min_elapsed_ms', label: '耗时下限', type: FormItemType.input, input: { allowClear: true, placeholder: '毫秒，如 1000' } },
  { field: 'begin_time', label: '开始日期', type: FormItemType.datePicker, datePicker: { allowClear: true } },
  { field: 'end_time', label: '结束日期', type: FormItemType.datePicker, datePicker: { allowClear: true } },
])
</script>

<template>
  <IuQueryForm v-model:form-value="queryParams" v-model:form-items="formItems" @query="emits('query')" />
</template>
