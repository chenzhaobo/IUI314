<script setup lang="ts">
import { computed } from 'vue'
import IuQueryForm from '@/components/iui/iu-query-form.vue'
import { FormItemType, type IuQueryFormField } from '@/types/base/iu-form'
import type { stockDiffSearchReq } from '@/types/stock/stock'
import { DIFF_TYPE_MAP } from '@/types/stock/stock'

defineOptions({ name: 'StockAnalysisQuery' })

const emits = defineEmits(['getList'])
const queryParams = defineModel<stockDiffSearchReq>('queryParams', { required: true })
const showSearch = defineModel<boolean>('showSearch', { required: true })

const queryFormItems = computed<IuQueryFormField[]>(() => [
  {
    field: 'sku',
    label: 'SKU',
    type: FormItemType.input,
    input: {
      placeholder: '请输入 SKU',
      allowClear: true,
    },
  },
  {
    field: 'asin',
    label: 'ASIN',
    type: FormItemType.input,
    input: {
      placeholder: '请输入 ASIN',
      allowClear: true,
    },
  },
  {
    field: 'diff_type',
    label: '差异类型',
    type: FormItemType.select,
    select: {
      placeholder: '请选择差异类型',
      options: Object.entries(DIFF_TYPE_MAP).map(([value, label]) => ({ label, value })),
      fieldNames: { label: 'label', value: 'value' },
      allowClear: true,
    },
  },
])
</script>

<template>
  <IuQueryForm
    v-show="showSearch"
    v-model:form-value="queryParams"
    v-model:form-items="queryFormItems"
    @query="emits('getList')"
  />
</template>

<style scoped lang="scss">

</style>
