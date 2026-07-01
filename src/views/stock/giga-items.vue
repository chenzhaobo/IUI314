<script lang="ts" setup>
import { IconRefresh, IconSync } from '@arco-design/web-vue/es/icon'
import { computed, h, onMounted, ref } from 'vue'
import { ErrorFlag } from '@/api/apis'
import { ApiStockGiga } from '@/api/stockApis'
import RightToolBar from '@/components/common/right-tool-bar.vue'
import { useGet, usePost } from '@/hooks'
import { systemMenus } from '@/router'
import type { gigaItem, gigaItemSearchReq, gigaSyncReq } from '@/types/stock/stock'
import IuQueryForm from '@/components/iui/iu-query-form.vue'
import { FormItemType, type IuQueryFormField } from '@/types/base/iu-form'
import Pagination from '@/components/common/pagination.vue'
import { parseTime } from '@/hooks'

defineOptions({
  name: systemMenus.gigaItems.path,
})

const showSearch = ref(true)
const loading = ref(false)
const tableData = ref<gigaItem[]>([])
const total = ref(0)
const syncModalVisible = ref(false)
const syncLoading = ref(false)
const syncForm = ref<gigaSyncReq>({ cookie: '' })

const queryParams = ref<gigaItemSearchReq>({
  page_num: 1,
  page_size: 10,
})

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
    field: 'product_name',
    label: '商品名称',
    type: FormItemType.input,
    input: {
      placeholder: '请输入商品名称',
      allowClear: true,
    },
  },
  {
    field: 'store_name',
    label: '店铺名称',
    type: FormItemType.input,
    input: {
      placeholder: '请输入店铺名称',
      allowClear: true,
    },
  },
])

import type { TableColumnData } from '@arco-design/web-vue'

const columns = computed<TableColumnData[]>(() => [
  {
    title: 'SKU',
    dataIndex: 'sku',
    width: 160,
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
    title: '图片',
    dataIndex: 'image',
    width: 80,
    align: 'center',
    render: ({ record }) => {
      if (!record.image) return '-'
      return h('img', { src: record.image, style: 'width:40px;height:40px;object-fit:cover;border-radius:4px' })
    },
  },
  {
    title: '库存',
    dataIndex: 'quantity',
    width: 80,
    align: 'center',
  },
  {
    title: '价格',
    dataIndex: 'price',
    width: 100,
    align: 'right',
    render: ({ record }) => record.price?.toFixed(2) ?? '-',
  },
  {
    title: '代发总价',
    dataIndex: 'drop_shipping_total_cost',
    width: 110,
    align: 'right',
    render: ({ record }) => record.drop_shipping_total_cost?.toFixed(2) ?? '-',
  },
  {
    title: '运费',
    dataIndex: 'freight',
    width: 80,
    align: 'right',
    render: ({ record }) => record.freight?.toFixed(2) ?? '-',
  },
  {
    title: '可用',
    dataIndex: 'is_available',
    width: 70,
    align: 'center',
    render: ({ record }) => record.is_available ? '是' : '否',
  },
  {
    title: '店铺',
    dataIndex: 'store_name',
    width: 120,
    ellipsis: true,
    tooltip: true,
  },
  {
    title: '抓取时间',
    dataIndex: 'fetched_at',
    width: 170,
    align: 'center',
    render: ({ record }) => parseTime(record.fetched_at),
  },
])

async function getList() {
  loading.value = true
  const { data, execute } = useGet<{ list: gigaItem[], total: number }>(
    ApiStockGiga.getList,
    queryParams,
  )
  await execute()
  loading.value = false
  if (data.value === ErrorFlag)
    return
  tableData.value = data.value?.list || []
  total.value = data.value?.total || 0
}

async function handleSyncOk() {
  if (!syncForm.value.cookie.trim()) {
    return false
  }
  syncLoading.value = true
  const { data, execute } = usePost<string>(ApiStockGiga.sync, syncForm)
  await execute()
  syncLoading.value = false
  if (data.value === ErrorFlag)
    return false
  syncForm.value.cookie = ''
  syncModalVisible.value = false
  await getList()
  return true
}

function handleSyncCancel() {
  syncForm.value.cookie = ''
  syncModalVisible.value = false
}

function handlePageChange() {
  getList()
}

onMounted(() => {
  getList()
})
</script>

<template>
  <div>
    <!-- 操作区域 -->
    <a-card class="m-b-8px" :bordered="false">
      <a-row :gutter="10" align="center" justify="space-between">
        <a-col>
          <a-space>
            <a-button type="primary" @click="syncModalVisible = true">
              <template #icon>
                <IconSync />
              </template>
              同步 Giga
            </a-button>
            <a-button @click="getList">
              <template #icon>
                <IconRefresh />
              </template>
              刷新
            </a-button>
          </a-space>
        </a-col>
      </a-row>
    </a-card>

    <!-- 查询区域 -->
    <IuQueryForm
      v-show="showSearch"
      v-model:form-value="queryParams"
      :form-items="queryFormItems"
      @query="getList"
    />

    <!-- 表格区域 -->
    <a-row :gutter="10" class="m-b-8px">
      <a-col flex="auto" />
      <RightToolBar v-model:showSearch="showSearch" @query-table="getList" />
    </a-row>

    <a-skeleton v-if="loading" :animation="true">
      <a-space direction="vertical" :style="{ width: '100%' }" size="large">
        <a-skeleton-line :rows="10" />
      </a-space>
    </a-skeleton>
    <a-table
      v-else
      :columns="columns"
      :data="tableData"
      row-key="id"
      :scroll="{ minWidth: 1200 }"
      :pagination="false"
    />
    <Pagination
      v-model:page="queryParams.page_num"
      v-model:limit="queryParams.page_size"
      :total="total"
      @pagination="handlePageChange"
    />

    <!-- Cookie 同步弹窗 -->
    <a-modal
      v-model:visible="syncModalVisible"
      title="同步 GigaB2B 收藏夹"
      :ok-loading="syncLoading"
      @ok="handleSyncOk"
      @cancel="handleSyncCancel"
    >
      <a-form :model="syncForm" auto-label-width>
        <a-form-item label="Cookie" field="cookie" required>
          <a-textarea
            v-model="syncForm.cookie"
            placeholder="请粘贴 GigaB2B 的 Cookie 字符串"
            :auto-size="{ minRows: 4, maxRows: 8 }"
            allow-clear
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>
