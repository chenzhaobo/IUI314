<script lang="ts" setup>
/**
 * 通用 CRUD 页面组件
 * 通过配置驱动：列定义、表单字段、API 端点
 */
import { computed, ref, watch } from 'vue'
import { Message } from '@arco-design/web-vue'
import { useGet, usePost, usePut, useDelete } from '@/hooks'
import { ErrorFlag } from '@/api/apis'

export interface SecField {
  label: string
  field: string
  type?: 'text' | 'textarea' | 'number' | 'select' | 'date'
  options?: { label: string; value: string }[]
  required?: boolean
  span?: number
}

export interface SecColumn {
  title: string
  dataIndex?: string
  width?: number
  ellipsis?: boolean
  tooltip?: boolean
  slotName?: string
  fixed?: 'left' | 'right'
}

export interface SecFilter {
  label: string
  field: string
  type?: 'select'
  options?: { label: string; value: string }[]
  placeholder?: string
}

const props = withDefaults(
  defineProps<{
    title: string
    apiList: string
    apiAdd?: string
    apiEdit?: string
    apiDelete?: string
    columns: SecColumn[]
    fields: SecField[]
    filters?: SecFilter[]
    searchFields?: string[]
    idField?: string
    nameField?: string
    extraActions?: boolean
  }>(),
  {
    idField: 'id',
    nameField: 'name',
    extraActions: false,
  },
)

// ── 查询 ──────────────────────────────────────────
const queryParams = ref<Record<string, any>>({
  page_num: 1,
  page_size: 10,
  keyword: '',
})

// 初始化过滤字段默认值
if (props.filters) {
  props.filters.forEach((f) => {
    queryParams.value[f.field] = ''
  })
}

const {
  isFetching: isLoading,
  data: rawListData,
  execute: getList,
} = useGet<any>(props.apiList, queryParams, { immediate: true })

const dataList = computed(() => rawListData.value?.list || [])
const total = computed(() => rawListData.value?.total || 0)

// ── 弹窗 ──────────────────────────────────────────
const modalVisible = ref(false)
const modalTitle = ref('')
const formData = ref<Record<string, any>>({})
const isEdit = ref(false)

function handleAdd() {
  isEdit.value = false
  modalTitle.value = `新增${props.title}`
  formData.value = {}
  // 初始化默认值
  props.fields.forEach((f) => {
    if (f.type === 'number') formData.value[f.field] = 0
    else if (f.type === 'select' && f.options?.length)
      formData.value[f.field] = f.options[0].value
    else formData.value[f.field] = ''
  })
  modalVisible.value = true
}

function handleEdit(record: any) {
  isEdit.value = true
  modalTitle.value = `编辑${props.title}`
  formData.value = { ...record }
  modalVisible.value = true
}

async function handleSubmit() {
  // 校验必填
  for (const f of props.fields) {
    if (f.required && !formData.value[f.field]) {
      Message.warning(`请填写${f.label}`)
      return
    }
  }

  if (isEdit.value && props.apiEdit) {
    const { execute, data, error } = usePut(props.apiEdit, formData)
    await execute()
    if (error.value || data.value === ErrorFlag) {
      return
    }
    Message.success('编辑成功')
  } else if (props.apiAdd) {
    const { execute, data, error } = usePost(props.apiAdd, formData)
    await execute()
    if (error.value || data.value === ErrorFlag) {
      return
    }
    Message.success('新增成功')
  }
  modalVisible.value = false
  await getList()
}

// ── 删除 ──────────────────────────────────────────
const selectedIds = ref<string[]>([])

function handleSelectionChange(keys: (string | number)[]) {
  selectedIds.value = keys as string[]
}

async function handleDelete(record?: any) {
  const ids = record ? [record[props.idField]] : selectedIds.value
  if (!ids.length) {
    Message.warning('请选择要删除的数据')
    return
  }

  if (!props.apiDelete) return

  const { execute, data, error } = useDelete(props.apiDelete, { ids })
  await execute()
  if (error.value || data.value === ErrorFlag) {
    return
  }
  Message.success('删除成功')
  await getList()
}

// ── 搜索 ──────────────────────────────────────────
function handleSearch() {
  queryParams.value.page_num = 1
  getList()
}

function handleReset() {
  queryParams.value.keyword = ''
  if (props.filters) {
    props.filters.forEach((f) => {
      queryParams.value[f.field] = ''
    })
  }
  queryParams.value.page_num = 1
  getList()
}

// 分页变化
function handlePageChange(page: number) {
  queryParams.value.page_num = page
  getList()
}
function handlePageSizeChange(size: number) {
  queryParams.value.page_size = size
  queryParams.value.page_num = 1
  getList()
}
</script>

<template>
  <div class="sechub-crud-page">
    <!-- 搜索栏 -->
    <a-card :bordered="false" class="m-b-8px">
      <a-row :gutter="16" align="center">
        <a-col :span="6">
          <a-input-search
            v-model="queryParams.keyword"
            placeholder="输入关键词搜索"
            allow-clear
            @search="handleSearch"
            @press-enter="handleSearch"
          />
        </a-col>
        <template v-if="filters && filters.length">
          <a-col v-for="f in filters" :key="f.field" :span="5">
            <a-select
              v-model="queryParams[f.field]"
              :placeholder="f.placeholder || `选择${f.label}`"
              allow-clear
              @change="handleSearch"
            >
              <a-option v-for="opt in f.options" :key="opt.value" :value="opt.value">{{ opt.label }}</a-option>
            </a-select>
          </a-col>
        </template>
        <a-col :span="4">
          <a-space>
            <a-button type="primary" @click="handleSearch">搜索</a-button>
            <a-button @click="handleReset">重置</a-button>
          </a-space>
        </a-col>
      </a-row>
    </a-card>

    <!-- 操作栏 + 表格 -->
    <a-card :bordered="false">
      <a-row class="m-b-8px">
        <a-space>
          <a-button
            v-if="apiAdd"
            type="primary"
            status="success"
            @click="handleAdd"
          >
            <template #icon><icon-plus /></template>
            新增
          </a-button>
          <a-button
            v-if="apiDelete"
            status="danger"
            :disabled="!selectedIds.length"
            @click="handleDelete()"
          >
            <template #icon><icon-delete /></template>
            批量删除
          </a-button>
        </a-space>
      </a-row>

      <a-table
        :loading="isLoading"
        :data="dataList"
        :columns="columns"
        :pagination="{
          total,
          current: queryParams.page_num,
          pageSize: queryParams.page_size,
          showTotal: true,
          showPageSize: true,
        }"
        :row-key="idField"
        :row-selection="{ type: 'checkbox', showCheckedAll: true }"
        @page-change="handlePageChange"
        @page-size-change="handlePageSizeChange"
        @selection-change="handleSelectionChange"
      >
        <template #operations="{ record }">
          <a-space>
            <a-button
              v-if="apiEdit"
              type="text"
              size="small"
              @click="handleEdit(record)"
            >
              编辑
            </a-button>
            <a-popconfirm content="确认删除？" @ok="handleDelete(record)">
              <a-button
                v-if="apiDelete"
                type="text"
                size="small"
                status="danger"
              >
                删除
              </a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </a-table>
    </a-card>

    <!-- 新增/编辑弹窗 -->
    <a-modal
      v-model:visible="modalVisible"
      :title="modalTitle"
      :width="640"
      @ok="handleSubmit"
      @cancel="modalVisible = false"
    >
      <a-form :model="formData" layout="vertical">
        <a-row :gutter="16">
          <a-col
            v-for="f in fields"
            :key="f.field"
            :span="f.span || 12"
          >
            <a-form-item
              :label="f.label"
              :required="f.required"
            >
              <a-input
                v-if="!f.type || f.type === 'text'"
                v-model="formData[f.field]"
                :placeholder="`请输入${f.label}`"
              />
              <a-textarea
                v-else-if="f.type === 'textarea'"
                v-model="formData[f.field]"
                :placeholder="`请输入${f.label}`"
                :auto-size="{ minRows: 2, maxRows: 4 }"
              />
              <a-input-number
                v-else-if="f.type === 'number'"
                v-model="formData[f.field]"
                :placeholder="`请输入${f.label}`"
              />
              <a-select
                v-else-if="f.type === 'select'"
                v-model="formData[f.field]"
                :options="f.options"
                :placeholder="`请选择${f.label}`"
              />
              <a-date-picker
                v-else-if="f.type === 'date'"
                v-model="formData[f.field]"
                :placeholder="`请选择${f.label}`"
              />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-modal>
  </div>
</template>

<style scoped>
.sechub-crud-page {
  padding: 0;
}
</style>
