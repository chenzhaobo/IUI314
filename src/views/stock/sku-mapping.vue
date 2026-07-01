<script lang="ts" setup>
import { IconDelete, IconPlus, IconRefresh, IconSync } from '@arco-design/web-vue/es/icon'
import { computed, h, onMounted, ref } from 'vue'
import { ErrorFlag } from '@/api/apis'
import { ApiStockSkuMapping } from '@/api/stockApis'
import RightToolBar from '@/components/common/right-tool-bar.vue'
import { useGet, usePost, useDelete, useTableUtil } from '@/hooks'
import { systemMenus } from '@/router'
import type { skuMapping, skuMappingSearchReq, skuMappingAddReq, skuMappingEditReq } from '@/types/stock/stock'
import IuQueryForm from '@/components/iui/iu-query-form.vue'
import { FormItemType, type IuQueryFormField } from '@/types/base/iu-form'
import Pagination from '@/components/common/pagination.vue'
import { parseTime } from '@/hooks'
import { Modal, Message } from '@arco-design/web-vue'
import type { TableColumnData } from '@arco-design/web-vue'

defineOptions({
  name: systemMenus.skuMapping.path,
})

const showSearch = ref(true)
const loading = ref(false)
const tableData = ref<skuMapping[]>([])
const total = ref(0)

const queryParams = ref<skuMappingSearchReq>({
  page_num: 1,
  page_size: 10,
})

// Modal state
const modalVisible = ref(false)
const modalTitle = ref('新增 SKU 映射')
const modalLoading = ref(false)
const form = ref<skuMappingAddReq & { id?: string }>({
  giga_sku: '',
  amazon_sku: '',
})

// Table selection
const { useTableSelectChange } = useTableUtil()
const { ids, values, single, selected } = useTableSelectChange()

const queryFormItems = computed<IuQueryFormField[]>(() => [
  {
    field: 'giga_sku',
    label: 'Giga SKU',
    type: FormItemType.input,
    input: { placeholder: '请输入 Giga SKU', allowClear: true },
  },
  {
    field: 'amazon_sku',
    label: 'Amazon SKU',
    type: FormItemType.input,
    input: { placeholder: '请输入 Amazon SKU', allowClear: true },
  },
  {
    field: 'asin',
    label: 'ASIN',
    type: FormItemType.input,
    input: { placeholder: '请输入 ASIN', allowClear: true },
  },
])

const columns = computed<TableColumnData[]>(() => [
  {
    type: 'checkbox',
    width: 50,
    align: 'center',
  },
  {
    title: 'Giga SKU',
    dataIndex: 'giga_sku',
    width: 160,
    ellipsis: true,
    tooltip: true,
  },
  {
    title: 'Amazon SKU',
    dataIndex: 'amazon_sku',
    width: 160,
    ellipsis: true,
    tooltip: true,
  },
  {
    title: 'ASIN',
    dataIndex: 'asin',
    width: 120,
    ellipsis: true,
    tooltip: true,
    render: ({ record }) => record.asin || '-',
  },
  {
    title: '商品名称',
    dataIndex: 'product_name',
    ellipsis: true,
    tooltip: true,
    render: ({ record }) => record.product_name || '-',
  },
  {
    title: '备注',
    dataIndex: 'remark',
    width: 150,
    ellipsis: true,
    tooltip: true,
    render: ({ record }) => record.remark || '-',
  },
  {
    title: '创建时间',
    dataIndex: 'created_at',
    width: 170,
    align: 'center',
    render: ({ record }) => parseTime(record.created_at),
  },
  {
    title: '操作',
    dataIndex: 'operations',
    width: 150,
    align: 'center',
    fixed: 'right',
    render: ({ record }) => {
      return h('div', { style: 'display:flex;gap:8px;justify-content:center' }, [
        h('a', {
          style: 'cursor:pointer',
          onClick: () => handleUpdate(record),
        }, '编辑'),
        h('a', {
          style: 'cursor:pointer;color:rgb(var(--danger-6))',
          onClick: () => handleDelete(record),
        }, '删除'),
      ])
    },
  },
])

async function getList() {
  loading.value = true
  const { data, execute } = useGet<{ list: skuMapping[], total: number }>(
    ApiStockSkuMapping.getList,
    queryParams,
  )
  await execute()
  loading.value = false
  if (data.value === ErrorFlag) return
  tableData.value = data.value?.list || []
  total.value = data.value?.total || 0
}

function handleAdd() {
  modalTitle.value = '新增 SKU 映射'
  form.value = { giga_sku: '', amazon_sku: '' }
  modalVisible.value = true
}

function handleUpdate(row: skuMapping) {
  modalTitle.value = '编辑 SKU 映射'
  form.value = {
    id: row.id,
    giga_sku: row.giga_sku,
    amazon_sku: row.amazon_sku,
    asin: row.asin,
    product_name: row.product_name,
    remark: row.remark,
  }
  modalVisible.value = true
}

async function handleSubmit() {
  if (!form.value.giga_sku || !form.value.amazon_sku) {
    Message.warning('Giga SKU 和 Amazon SKU 不能为空')
    return false
  }
  modalLoading.value = true
  if (form.value.id) {
    const editReq: skuMappingEditReq = {
      id: form.value.id,
      giga_sku: form.value.giga_sku,
      amazon_sku: form.value.amazon_sku,
      asin: form.value.asin,
      product_name: form.value.product_name,
      remark: form.value.remark,
    }
    const { data, execute } = usePost(ApiStockSkuMapping.edit, editReq)
    await execute()
    modalLoading.value = false
    if (data.value === ErrorFlag) return false
    Message.success('编辑成功')
  } else {
    const addReq: skuMappingAddReq = {
      giga_sku: form.value.giga_sku,
      amazon_sku: form.value.amazon_sku,
      asin: form.value.asin,
      product_name: form.value.product_name,
      remark: form.value.remark,
    }
    const { data, execute } = usePost(ApiStockSkuMapping.add, addReq)
    await execute()
    modalLoading.value = false
    if (data.value === ErrorFlag) return false
    Message.success('新增成功')
  }
  modalVisible.value = false
  await getList()
  return true
}

function handleDelete(row?: skuMapping) {
  Modal.warning({
    title: '确认删除',
    content: '确定要删除选中的映射记录吗？',
    hideCancel: false,
    onOk: async () => {
      if (row) {
        const { execute } = useDelete(ApiStockSkuMapping.delete, { id: row.id })
        await execute()
      } else {
        for (const id of ids.value) {
          const { execute } = useDelete(ApiStockSkuMapping.delete, { id })
          await execute()
        }
      }
      Message.success('删除成功')
      await getList()
    },
  })
}

function handleAutoGen() {
  Modal.confirm({
    title: '自动生成映射',
    content: '将以 Giga 商品 SKU 为准，自动生成 1:1 映射（amazon_sku 默认等于 giga_sku，后续可手动修改）。',
    okText: '覆盖生成',
    cancelText: '增量生成',
    hideCancel: false,
    onOk: async () => {
      const { data, execute } = usePost<string>(ApiStockSkuMapping.autoGen, { overwrite: true })
      await execute()
      if (data.value === ErrorFlag) return
      Message.success(data.value || '生成成功')
      await getList()
    },
    onCancel: () => {
      return new Promise<void>(async (resolve) => {
        const { data, execute } = usePost<string>(ApiStockSkuMapping.autoGen, { overwrite: false })
        await execute()
        if (data.value !== ErrorFlag) {
          Message.success(data.value || '生成成功')
          await getList()
        }
        resolve()
      })
    },
  })
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
            <a-button type="primary" @click="handleAutoGen">
              <template #icon><IconSync /></template>
              自动生成
            </a-button>
            <a-button type="primary" @click="handleAdd">
              <template #icon><IconPlus /></template>
              新增
            </a-button>
            <a-button :disabled="!selected" status="danger" @click="handleDelete()">
              <template #icon><IconDelete /></template>
              批量删除
            </a-button>
            <a-button @click="getList">
              <template #icon><IconRefresh /></template>
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
      :scroll="{ minWidth: 1000 }"
      :pagination="false"
      :row-selection="{ type: 'checkbox', showCheckedAll: true }"
      v-model:selectedKeys="ids"
      @selection-change="values = $event"
    />
    <Pagination
      v-model:page="queryParams.page_num"
      v-model:limit="queryParams.page_size"
      :total="total"
      @pagination="handlePageChange"
    />

    <!-- 新增/编辑弹窗 -->
    <a-modal
      v-model:visible="modalVisible"
      :title="modalTitle"
      :ok-loading="modalLoading"
      @ok="handleSubmit"
      @cancel="modalVisible = false"
    >
      <a-form :model="form" auto-label-width>
        <a-form-item label="Giga SKU" field="giga_sku" required>
          <a-input v-model="form.giga_sku" placeholder="请输入 GigaB2B SKU" allow-clear />
        </a-form-item>
        <a-form-item label="Amazon SKU" field="amazon_sku" required>
          <a-input v-model="form.amazon_sku" placeholder="请输入 Amazon seller-sku" allow-clear />
        </a-form-item>
        <a-form-item label="ASIN" field="asin">
          <a-input v-model="form.asin" placeholder="请输入 ASIN（可选）" allow-clear />
        </a-form-item>
        <a-form-item label="商品名称" field="product_name">
          <a-input v-model="form.product_name" placeholder="请输入商品名称（可选）" allow-clear />
        </a-form-item>
        <a-form-item label="备注" field="remark">
          <a-textarea v-model="form.remark" placeholder="请输入备注（可选）" :auto-size="{ minRows: 2, maxRows: 4 }" allow-clear />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>
