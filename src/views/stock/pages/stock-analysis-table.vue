<script lang="ts" setup>
import type { TableColumnData } from '@arco-design/web-vue'
import { computed } from 'vue'
import Pagination from '@/components/common/pagination.vue'
import { parseTime } from '@/hooks'
import type { stockDiff } from '@/types/stock/stock'
import { DIFF_TYPE_MAP } from '@/types/stock/stock'

defineOptions({ name: 'StockAnalysisTable' })

const props = defineProps({
  isLoading: {
    type: Boolean,
    default: false,
  },
  total: {
    type: Number,
    default: 0,
  },
})

const emit = defineEmits(['pagination'])

const tableData = defineModel<stockDiff[]>('tableData', { required: true })
const page = defineModel('page', { type: Number, default: 1 })
const limit = defineModel('limit', { type: Number, default: 10 })

const columns = computed<TableColumnData[]>(() => [
  {
    title: 'SKU',
    dataIndex: 'sku',
    width: 160,
    ellipsis: true,
    tooltip: true,
  },
  {
    title: 'ASIN',
    dataIndex: 'asin',
    width: 150,
    ellipsis: true,
    tooltip: true,
  },
  {
    title: '商品名称',
    dataIndex: 'product_name',
    ellipsis: true,
    tooltip: true,
  },
  {
    title: 'Amazon 库存',
    dataIndex: 'amazon_qty',
    width: 130,
    align: 'center',
  },
  {
    title: 'Giga 库存',
    dataIndex: 'giga_qty',
    width: 120,
    align: 'center',
  },
  {
    title: 'Amazon 价格',
    dataIndex: 'amazon_price',
    width: 130,
    align: 'right',
    render: ({ record }) => record.amazon_price?.toFixed(2) ?? '-',
  },
  {
    title: 'Giga 价格',
    dataIndex: 'giga_price',
    width: 120,
    align: 'right',
    render: ({ record }) => record.giga_price?.toFixed(2) ?? '-',
  },
  {
    title: '差异类型',
    dataIndex: 'diff_type',
    width: 130,
    align: 'center',
    render: ({ record }) => DIFF_TYPE_MAP[record.diff_type] || record.diff_type,
  },
  {
    title: '分析时间',
    dataIndex: 'analyzed_at',
    width: 180,
    align: 'center',
    render: ({ record }) => parseTime(record.analyzed_at),
  },
])
</script>

<template>
  <a-skeleton v-if="isLoading" :animation="true">
    <a-space direction="vertical" :style="{ width: '100%' }" size="large">
      <a-skeleton-line :rows="10" />
    </a-space>
  </a-skeleton>
  <a-table
    :columns="columns"
    :data="tableData"
    row-key="id"
    :scroll="{ minWidth: 1000 }"
    :pagination="false"
  />
  <Pagination
    v-model:page="page"
    v-model:limit="limit"
    :total="total"
    @pagination="emit('pagination')"
  />
</template>
