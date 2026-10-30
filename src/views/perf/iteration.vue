<script lang="ts" setup>
import type { IterationFormValue, IterationRecord } from './components/IterationFormModal.vue'
import type { ColumnFilterState } from '@/hooks'
import { Message } from '@arco-design/web-vue'
import { computed, onMounted, ref } from 'vue'
import { ApiPerfIteration, ApiSysDictData } from '@/api/apis'
import ColumnFilterPanel from '@/components/common/ColumnFilterPanel.vue'
import { deleteAction, emptyFilter, isFilterActive, postAction, putAction, toServerFilters, useFilterPersistence, useGet, useTableAutoHeight, withTableDefaults } from '@/hooks'
import IterationFormModal from './components/IterationFormModal.vue'

defineOptions({ name: 'Iteration' })

// ── 产品线字典 ──────────────────────────────────
interface DictDataItem {
  dict_label: string
  dict_value: string
  is_default?: string
}

const { data: productLineDict } = useGet<DictDataItem[]>(ApiSysDictData.getByType, { dict_type: 'perf_product_line' }, { immediate: true })
const productLineOptions = computed(() =>
  (productLineDict.value ?? []).map(d => ({ label: d.dict_label, value: d.dict_value })),
)
const defaultProductLine = computed(() => {
  const list = productLineDict.value ?? []
  return (list.find(d => d.is_default === 'Y') ?? list[0])?.dict_value ?? ''
})

// ── 当前迭代 ──────────────────────────────────
const { data: currentIter, execute: fetchCurrent } = useGet<any>(ApiPerfIteration.current, {}, { immediate: true })

// ── 列表查询 ──────────────────────────────────
const queryParams = ref({
  page_num: 1,
  page_size: 10,
  keyword: '',
  status: '',
  is_current: '',
  build_no: '',
  product_line: '',
  filters: undefined as string | undefined,
})

const { isFetching: isLoading, data: rawListData, execute: getList } = useGet<any>(ApiPerfIteration.getList, queryParams, { immediate: true })
const dataList = computed(() => rawListData.value?.list || [])
const total = computed(() => rawListData.value?.total || 0)

// ── 列头筛选（服务端）──────────────────────────────
// 服务端分页页面必须走后端筛，前端筛只筛当前页，搜靠后的记录会搜不到。
const FILTERABLE_COLUMNS = ['code', 'name', 'project_name', 'build_no'] as const
const columnFilters = ref<Record<string, ColumnFilterState>>(
  Object.fromEntries(FILTERABLE_COLUMNS.map(k => [k, emptyFilter('text')])),
)

function filterableOf(key: string) {
  return {
    slotName: `filter-${key}`,
    filteredValue: isFilterActive(columnFilters.value[key]) ? ['1'] : [],
    filter: () => true,
    hideButton: true,
  }
}

function onColumnFilterChange() {
  // 条件变了：把列筛选序列化成后端 filters 参数，复位到第一页再查
  queryParams.value.filters = toServerFilters(columnFilters.value)
  queryParams.value.page_num = 1
  getList()
}

function handleSearch() {
  queryParams.value.page_num = 1
  getList()
}
function handlePageChange(page: number) {
  queryParams.value.page_num = page
  getList()
}
// 改每页条数必须同时回到第 1 页：原本停在第 5 页、条数从 10 改成 50 时，
// 第 5 页往往已超出新的总页数，后端返回空列表，看起来像"数据没了"。
function handlePageSizeChange(size: number) {
  queryParams.value.page_size = size
  queryParams.value.page_num = 1
  getList()
}

const statusOptions = [
  { label: '全部', value: '' },
  { label: '启用', value: '1' },
  { label: '禁用', value: '0' },
]
const currentOptions = [
  { label: '全部', value: '' },
  { label: '当前', value: '1' },
  { label: '非当前', value: '0' },
]

const columns = computed(() => withTableDefaults([
  { title: '编码', dataIndex: 'code', width: 140, filterable: filterableOf('code') },
  { title: '名称', dataIndex: 'name', width: 160, filterable: filterableOf('name') },
  { title: '产品线', dataIndex: 'product_line', width: 90 },
  { title: '项目', dataIndex: 'project_name', width: 180, filterable: filterableOf('project_name') },
  { title: '开始日期', dataIndex: 'start_date', width: 110 },
  { title: '结束日期', dataIndex: 'end_date', width: 110 },
  { title: '构建号', dataIndex: 'build_no', width: 130, filterable: filterableOf('build_no') },
  { title: '当前', dataIndex: 'is_current', width: 70, slotName: 'is_current' },
  { title: '状态', dataIndex: 'status', width: 60, slotName: 'status' },
  { title: '操作', dataIndex: 'operations', slotName: 'operations', width: 200, fixed: 'right' as const },
]))

// ── 表格高度自适应（滚动条在表格内，表头固定）──────────
const tableWrap = ref<HTMLElement>()
const { tableHeight } = useTableAutoHeight(tableWrap)

// 列筛选条件按标签页暂存；恢复后（内部 onMounted 已 restore）同步到查询参数并重查一次
useFilterPersistence('perf-iteration', {
  columnFilters,
})
onMounted(() => {
  const restored = toServerFilters(columnFilters.value)
  if (restored) {
    queryParams.value.filters = restored
    queryParams.value.page_num = 1
    getList()
  }
})

// ── 新增/编辑弹窗 ──────────────────────────────────
const modalVisible = ref(false)
const modalRecord = ref<IterationRecord | null>(null)

function handleAdd() {
  modalRecord.value = null
  modalVisible.value = true
}

function handleEdit(record: IterationRecord) {
  modalRecord.value = record
  modalVisible.value = true
}

async function submitIteration(value: IterationFormValue): Promise<boolean> {
  const editing = Boolean(value.id)
  const res = editing
    ? await putAction(ApiPerfIteration.edit, value)
    : await postAction(ApiPerfIteration.add, value)
  if (!res)
    return false
  Message.success(editing ? '编辑成功' : '添加成功')
  getList()
  fetchCurrent()
  return true
}

// ── 删除 ──────────────────────────────────
async function handleDelete(record: any) {
  const res = await deleteAction(ApiPerfIteration.delete, { ids: [record.id] })
  if (!res)
    return
  Message.success('删除成功')
  getList()
  fetchCurrent()
}

// ── 设为当前迭代 ──────────────────────────────────
async function handleSetCurrent(record: any) {
  const res = await putAction(ApiPerfIteration.setCurrent, { id: record.id })
  if (!res)
    return
  Message.success('已设为当前迭代')
  getList()
  fetchCurrent()
}
</script>

<template>
  <div class="perf-iteration">
    <!-- 当前迭代卡片 -->
    <a-card v-if="currentIter" :bordered="false" class="m-b-8px">
      <a-descriptions :column="4" bordered size="small">
        <a-descriptions-item label="当前迭代">
          {{ currentIter?.name || '-' }}
        </a-descriptions-item>
        <a-descriptions-item label="编码">
          {{ currentIter?.code || '-' }}
        </a-descriptions-item>
        <a-descriptions-item label="构建号">
          {{ currentIter?.build_no || '-' }}
        </a-descriptions-item>
        <a-descriptions-item label="迭代周期">
          {{ currentIter?.start_date || '-' }} ~ {{ currentIter?.end_date || '-' }}
        </a-descriptions-item>
      </a-descriptions>
    </a-card>

    <!-- 搜索栏 -->
    <a-card :bordered="false" class="m-b-8px">
      <a-row :gutter="16">
        <a-col :span="6">
          <a-input-search v-model="queryParams.keyword" placeholder="搜索编码/名称/构建号" allow-clear @search="handleSearch" @press-enter="handleSearch" />
        </a-col>
        <a-col :span="4">
          <a-select v-model="queryParams.product_line" :options="productLineOptions" placeholder="产品线" allow-clear @change="handleSearch" />
        </a-col>
        <a-col :span="4">
          <a-select v-model="queryParams.is_current" :options="currentOptions" placeholder="是否当前" allow-clear @change="handleSearch" />
        </a-col>
        <a-col :span="4">
          <a-select v-model="queryParams.status" :options="statusOptions" placeholder="状态" allow-clear @change="handleSearch" />
        </a-col>
        <a-col :span="6">
          <a-space>
            <a-button type="primary" @click="handleSearch">
              搜索
            </a-button>
            <a-button type="primary" status="success" @click="handleAdd">
              <template #icon>
                <icon-plus />
              </template>
              新增迭代
            </a-button>
          </a-space>
        </a-col>
      </a-row>
    </a-card>

    <!-- 表格 -->
    <div ref="tableWrap">
      <a-card :bordered="false">
        <a-table
          column-resizable
          :loading="isLoading"
          :data="dataList"
          :columns="columns"
          :pagination="{ total, current: queryParams.page_num, pageSize: queryParams.page_size, showTotal: true, showPageSize: true }"
          row-key="id"
          :scroll="{ y: tableHeight }"
          @page-change="handlePageChange"
          @page-size-change="handlePageSizeChange"
        >
          <template v-for="key in FILTERABLE_COLUMNS" #[`filter-${key}`] :key="key">
            <ColumnFilterPanel v-model="columnFilters[key]" @change="onColumnFilterChange" />
          </template>
          <template #is_current="{ record }">
            <a-tag :color="record.is_current === '1' ? 'green' : 'gray'">
              {{ record.is_current === '1' ? '当前' : '-' }}
            </a-tag>
          </template>
          <template #status="{ record }">
            <a-tag :color="record.status === '1' ? 'green' : 'red'">
              {{ record.status === '1' ? '启用' : '禁用' }}
            </a-tag>
          </template>
          <template #operations="{ record }">
            <a-space>
              <a-button type="text" size="small" @click="handleEdit(record)">
                编辑
              </a-button>
              <a-button type="text" size="small" status="success" :disabled="record.is_current === '1'" @click="handleSetCurrent(record)">
                设为当前
              </a-button>
              <a-popconfirm content="确认删除？删除后不可恢复" @ok="handleDelete(record)">
                <a-button type="text" size="small" status="danger">
                  删除
                </a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </a-table>
      </a-card>
    </div>

    <!-- 新增/编辑弹窗 -->
    <IterationFormModal
      v-model:visible="modalVisible"
      :record="modalRecord"
      :product-line-options="productLineOptions"
      :default-product-line="defaultProductLine"
      :submit="submitIteration"
    />
  </div>
</template>

<style scoped>
.perf-iteration { padding: 0; }
</style>
