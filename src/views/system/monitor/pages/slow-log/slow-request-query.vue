<script setup lang="ts">
import type { IuQueryFormField } from '@/types/base/iu-form'
import type { slowRequestLogQueryParam } from '@/types/system/slow-log'
import { ref } from 'vue'
import IuQueryForm from '@/components/iui/iu-query-form.vue'
import { FormItemType } from '@/types/base/iu-form'

defineOptions({ name: 'SlowRequestQuery' })
const emits = defineEmits(['query'])
const queryParams = defineModel<slowRequestLogQueryParam>('queryParams', { required: true })
const methodOptions = ['GET', 'POST', 'PUT', 'DELETE'].map(value => ({ label: value, value }))
const statusOptions = [200, 400, 401, 403, 404, 500].map(value => ({ label: String(value), value }))

const formItems = ref<IuQueryFormField[]>([
  { field: 'request_path', label: '请求路径', type: FormItemType.input, input: { allowClear: true, placeholder: '包含匹配' } },
  { field: 'user_name', label: '用户', type: FormItemType.input, input: { allowClear: true, placeholder: '用户名' } },
  { field: 'trace_id', label: 'Trace ID', type: FormItemType.input, input: { allowClear: true, placeholder: '完整 trace_id' } },
  {
    field: 'request_method',
    label: '请求方式',
    type: FormItemType.select,
    select: { allowClear: true, options: methodOptions, fieldNames: { label: 'label', value: 'value' } },
  },
  {
    field: 'http_status',
    label: '状态码',
    type: FormItemType.select,
    select: { allowClear: true, options: statusOptions, fieldNames: { label: 'label', value: 'value' } },
  },
  { field: 'min_elapsed_ms', label: '耗时下限', type: FormItemType.input, input: { allowClear: true, placeholder: '毫秒，如 1000' } },
  { field: 'begin_time', label: '开始日期', type: FormItemType.datePicker, datePicker: { allowClear: true } },
  { field: 'end_time', label: '结束日期', type: FormItemType.datePicker, datePicker: { allowClear: true } },
])
</script>

<template>
  <IuQueryForm v-model:form-value="queryParams" v-model:form-items="formItems" @query="emits('query')" />
</template>
