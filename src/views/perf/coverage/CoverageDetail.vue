<template>
  <div class="page-container">
    <a-card :bordered="false">
      <!-- 筛选栏 -->
      <a-row :gutter="16" style="margin-bottom: 16px">
        <a-col :span="4">
          <a-input v-model="appNumber" placeholder="应用编码" allow-clear @press-enter="handleSearch" />
        </a-col>
        <a-col :span="4">
          <a-input v-model="formId" placeholder="表单ID" allow-clear @press-enter="handleSearch" />
        </a-col>
        <a-col :span="3">
          <a-select v-model="hasTxn" placeholder="关联事务" allow-clear>
            <a-option value="1">已关联</a-option>
            <a-option value="0">未关联</a-option>
          </a-select>
        </a-col>
        <a-col :span="3">
          <a-select v-model="isImportant" placeholder="是否高频" allow-clear>
            <a-option value="1">高频</a-option>
            <a-option value="0">非高频</a-option>
          </a-select>
        </a-col>
        <a-col :span="3">
          <a-select v-model="isQuery" placeholder="是否查询" allow-clear>
            <a-option value="1">查询</a-option>
            <a-option value="0">非查询</a-option>
          </a-select>
        </a-col>
        <a-col :span="7">
          <a-space>
            <a-button type="primary" @click="handleSearch">查询</a-button>
            <a-button @click="handleExport">导出</a-button>
            <a-button @click="handleBack">返回</a-button>
          </a-space>
        </a-col>
      </a-row>

      <!-- 数据表格（按钮级明细） -->
      <div ref="tableWrap">
      <a-table :data="tableData" :loading="loading" :pagination="pagination" @page-change="handlePageChange"
 @page-size-change="handlePageSizeChange" row-key="button_key" size="small" :scroll="{ y: tableHeight }">
        <template #columns>
          <a-table-column title="云" data-index="cloud_name" :width="100" ellipsis />
          <a-table-column title="应用" data-index="app_name" :width="130" ellipsis />
          <a-table-column title="表单" data-index="form_name" :width="160" ellipsis />
          <a-table-column title="按钮名" data-index="button_name" :width="120" ellipsis />
          <a-table-column title="按钮Key" data-index="button_key" :width="110" ellipsis />
          <a-table-column title="是否查询" data-index="is_query" :width="80" align="center">
            <template #cell="{ record }">
              <a-tag :color="record.is_query === '1' ? 'blue' : 'gray'" size="small">{{ record.is_query === '1' ? '是' : '否' }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="是否高频" data-index="is_important" :width="80" align="center">
            <template #cell="{ record }">
              <a-tag :color="record.is_important === '1' ? 'orangered' : 'gray'" size="small">{{ record.is_important === '1' ? '是' : '否' }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="已关联事务" data-index="has_txn" :width="90" align="center">
            <template #cell="{ record }">
              <a-tag :color="record.has_txn === '1' ? 'green' : 'red'" size="small">{{ record.has_txn === '1' ? '是' : '否' }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="事务编码" data-index="txn_code" :width="140" ellipsis />
          <a-table-column title="有基准值" data-index="has_baseline" :width="80" align="center">
            <template #cell="{ record }">
              <a-tag :color="record.has_baseline === '1' ? 'green' : 'gray'" size="small">{{ record.has_baseline === '1' ? '是' : '否' }}</a-tag>
            </template>
          </a-table-column>
        </template>
      </a-table>
      </div>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ApiPerfCoverage } from '@/api/perfApis'
import { useDownload, useGet, useTableAutoHeight } from '@/hooks'

const { downloadWithTip } = useDownload()

defineOptions({ name: 'coverage-detail' })

// 表格高度自适应（滚动条在表格内，表头固定）
const tableWrap = ref<HTMLElement>()
const { tableHeight } = useTableAutoHeight(tableWrap)

const route = useRoute()
const router = useRouter()
const appNumber = ref((route.query.app_number as string) || '')
const formId = ref((route.query.form_id as string) || '')
const hasTxn = ref('')
const isImportant = ref('')
const isQuery = ref('')
const pageNum = ref(1)
const pageSize = ref(20)

const queryParams = computed(() => {
  const params: any = {
    page_num: pageNum.value,
    page_size: pageSize.value,
  }
  if (appNumber.value) params.app_number = appNumber.value
  if (formId.value) params.form_id = formId.value
  if (hasTxn.value) params.has_txn = hasTxn.value
  if (isImportant.value) params.is_important = isImportant.value
  if (isQuery.value) params.is_query = isQuery.value
  return params
})

const { isFetching: loading, data: rawData, execute: fetchData } = useGet<any>(ApiPerfCoverage.detail, queryParams, { immediate: true })
const tableData = computed(() => rawData.value?.list || [])
const pagination = computed(() => ({ current: pageNum.value, pageSize: pageSize.value, total: rawData.value?.total || 0, showTotal: true, showPageSize: true }))

const handleSearch = () => { pageNum.value = 1; fetchData() }
const handlePageChange = (page: number) => { pageNum.value = page; fetchData() }
// 改每页条数必须同时回到第 1 页：原本停在第 5 页、条数改大后该页往往已超出总页数，
// 后端返回空列表，看起来像"数据没了"。
const handlePageSizeChange = (size: number) => { pageSize.value = size; pageNum.value = 1; fetchData() }

const handleExport = () => {
  const params: any = {}
  if (appNumber.value) params.app_number = appNumber.value
  if (formId.value) params.form_id = formId.value
  if (hasTxn.value) params.has_txn = hasTxn.value
  if (isImportant.value) params.is_important = isImportant.value
  if (isQuery.value) params.is_query = isQuery.value
  downloadWithTip(`${ApiPerfCoverage.export}?${new URLSearchParams(params).toString()}`, 'coverage_export.csv', '导出失败')
}

const handleBack = () => { router.back() }
</script>
