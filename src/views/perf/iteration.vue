<script lang="ts" setup>
import { ref, computed } from 'vue'
import { Message } from '@arco-design/web-vue'
import { useGet, usePost, usePut, useDelete } from '@/hooks'
import { ApiPerfIteration } from '@/api/apis'

defineOptions({ name: 'PerfIteration' })

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
})

const { isFetching: isLoading, data: rawListData, execute: getList } = useGet<any>(ApiPerfIteration.getList, queryParams, { immediate: true })
const dataList = computed(() => rawListData.value?.list || [])
const total = computed(() => rawListData.value?.total || 0)

function handleSearch() {
  queryParams.value.page_num = 1
  getList()
}
function handlePageChange(page: number) {
  queryParams.value.page_num = page
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

const columns = [
  { title: '编码', dataIndex: 'code', width: 140 },
  { title: '名称', dataIndex: 'name', width: 160, ellipsis: true, tooltip: true },
  { title: '项目', dataIndex: 'project_name', width: 180, ellipsis: true, tooltip: true },
  { title: '开始日期', dataIndex: 'start_date', width: 110 },
  { title: '结束日期', dataIndex: 'end_date', width: 110 },
  { title: '构建号', dataIndex: 'build_no', width: 130, ellipsis: true, tooltip: true },
  { title: '当前', dataIndex: 'is_current', width: 70, slot: 'is_current' },
  { title: '状态', dataIndex: 'status', width: 60, slot: 'status' },
  { title: '操作', dataIndex: 'operations', slot: 'operations', width: 200, fixed: 'right' as const },
]

// ── 新增/编辑弹窗 ──────────────────────────────────
const modalVisible = ref(false)
const isEdit = ref(false)
const form = ref<any>({})
const submitting = ref(false)

function handleAdd() {
  isEdit.value = false
  form.value = {
    code: '', name: '', project_name: '金蝶云苍穹&星瀚V8.0',
    start_date: '', end_date: '', build_no: '',
    status: '1', remark: '',
  }
  modalVisible.value = true
}

function handleEdit(record: any) {
  isEdit.value = true
  form.value = { ...record }
  modalVisible.value = true
}

async function handleSubmit() {
  if (!form.value.code) { Message.warning('请输入迭代编码'); return }
  if (!form.value.name) { Message.warning('请输入迭代名称'); return }
  if (!form.value.start_date) { Message.warning('请选择开始日期'); return }
  if (!form.value.end_date) { Message.warning('请选择结束日期'); return }
  submitting.value = true
  try {
    if (isEdit.value) {
      const { execute, error } = usePut(ApiPerfIteration.edit, form.value)
      await execute()
      if (error.value) { Message.error('编辑失败'); return }
      Message.success('编辑成功')
    } else {
      const { execute, error } = usePost(ApiPerfIteration.add, form.value)
      await execute()
      if (error.value) { Message.error('添加失败'); return }
      Message.success('添加成功')
    }
    modalVisible.value = false
    getList()
    fetchCurrent()
  } finally {
    submitting.value = false
  }
}

// ── 删除 ──────────────────────────────────
async function handleDelete(record: any) {
  const { execute, error } = useDelete(ApiPerfIteration.delete, { ids: [record.id] })
  await execute()
  if (error.value) { Message.error('删除失败'); return }
  Message.success('删除成功')
  getList()
  fetchCurrent()
}

// ── 设为当前迭代 ──────────────────────────────────
async function handleSetCurrent(record: any) {
  const { execute, error } = usePut(ApiPerfIteration.setCurrent, { id: record.id })
  await execute()
  if (error.value) { Message.error('设置失败'); return }
  Message.success('已设为当前迭代')
  getList()
  fetchCurrent()
}
</script>

<template>
  <div class="perf-iteration">
    <!-- 当前迭代卡片 -->
    <a-card :bordered="false" class="m-b-8px" v-if="currentIter">
      <a-descriptions :column="4" bordered size="small">
        <a-descriptions-item label="当前迭代">{{ currentIter?.name || '-' }}</a-descriptions-item>
        <a-descriptions-item label="编码">{{ currentIter?.code || '-' }}</a-descriptions-item>
        <a-descriptions-item label="构建号">{{ currentIter?.build_no || '-' }}</a-descriptions-item>
        <a-descriptions-item label="迭代周期">{{ currentIter?.start_date || '-' }} ~ {{ currentIter?.end_date || '-' }}</a-descriptions-item>
      </a-descriptions>
    </a-card>

    <!-- 搜索栏 -->
    <a-card :bordered="false" class="m-b-8px">
      <a-row :gutter="16">
        <a-col :span="6">
          <a-input-search v-model="queryParams.keyword" placeholder="搜索编码/名称/构建号" allow-clear @search="handleSearch" @press-enter="handleSearch" />
        </a-col>
        <a-col :span="4">
          <a-select v-model="queryParams.is_current" :options="currentOptions" placeholder="是否当前" allow-clear @change="handleSearch" />
        </a-col>
        <a-col :span="4">
          <a-select v-model="queryParams.status" :options="statusOptions" placeholder="状态" allow-clear @change="handleSearch" />
        </a-col>
        <a-col :span="6">
          <a-space>
            <a-button type="primary" @click="handleSearch">搜索</a-button>
            <a-button type="primary" status="success" @click="handleAdd">
              <template #icon><icon-plus /></template>
              新增迭代
            </a-button>
          </a-space>
        </a-col>
      </a-row>
    </a-card>

    <!-- 表格 -->
    <a-card :bordered="false">
      <a-table
        :loading="isLoading"
        :data="dataList"
        :columns="columns"
        :pagination="{ total, current: queryParams.page_num, pageSize: queryParams.page_size, showTotal: true, showPageSize: true }"
        row-key="id"
        @page-change="handlePageChange"
      >
        <template #is_current="{ record }">
          <a-tag :color="record.is_current === '1' ? 'green' : 'gray'">{{ record.is_current === '1' ? '当前' : '-' }}</a-tag>
        </template>
        <template #status="{ record }">
          <a-tag :color="record.status === '1' ? 'green' : 'red'">{{ record.status === '1' ? '启用' : '禁用' }}</a-tag>
        </template>
        <template #operations="{ record }">
          <a-space>
            <a-button type="text" size="small" @click="handleEdit(record)">编辑</a-button>
            <a-button type="text" size="small" status="success" :disabled="record.is_current === '1'" @click="handleSetCurrent(record)">设为当前</a-button>
            <a-popconfirm content="确认删除？删除后不可恢复" @ok="handleDelete(record)">
              <a-button type="text" size="small" status="danger">删除</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </a-table>
    </a-card>

    <!-- 新增/编辑弹窗 -->
    <a-modal v-model:visible="modalVisible" :title="isEdit ? '编辑迭代' : '新增迭代'" :width="600" :ok-loading="submitting" @ok="handleSubmit">
      <a-form :model="form" layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="迭代编码" required>
              <a-input v-model="form.code" placeholder="如：PM-000006-151" :disabled="isEdit" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="迭代名称" required>
              <a-input v-model="form.name" placeholder="如：2026年6月迭代二" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="开始日期" required>
              <a-date-picker v-model="form.start_date" value-format="YYYY-MM-DD" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="结束日期" required>
              <a-date-picker v-model="form.end_date" value-format="YYYY-MM-DD" style="width: 100%" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="构建号">
              <a-input v-model="form.build_no" placeholder="如：BIZ_V8.0.15" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="状态">
              <a-select v-model="form.status">
                <a-option value="1">启用</a-option>
                <a-option value="0">禁用</a-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="项目名称">
          <a-input v-model="form.project_name" placeholder="如：金蝶云苍穹&星瀚V8.0" />
        </a-form-item>
        <a-form-item label="备注">
          <a-textarea v-model="form.remark" :auto-size="{ minRows: 2, maxRows: 4 }" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<style scoped>
.perf-iteration { padding: 0; }
</style>
