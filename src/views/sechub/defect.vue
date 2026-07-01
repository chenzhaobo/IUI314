<script lang="ts" setup>
import { computed, ref } from 'vue'
import { Message } from '@arco-design/web-vue'
import { ApiSecDefect } from '@/api/apis'
import { useGet, usePost, usePut, useDelete } from '@/hooks'

defineOptions({ name: 'SecDefect' })

const queryParams = ref({ page_num: 1, page_size: 10, keyword: '', project_group_id: '' })
const { isFetching: isLoading, data: rawListData, execute: getList } = useGet<any>(ApiSecDefect.getList, queryParams, { immediate: true })
const dataList = computed(() => rawListData.value?.list || [])
const total = computed(() => rawListData.value?.total || 0)

// ── 新增/编辑 ──────────────────────────────────────
const modalVisible = ref(false)
const modalTitle = ref('')
const formData = ref<Record<string, any>>({})
const isEdit = ref(false)

function handleAdd() {
  isEdit.value = false
  modalTitle.value = '新增缺陷'
  formData.value = { defect_code: '', defect_title: '', defect_status: 'open', is_security: '1', priority: 'medium' }
  modalVisible.value = true
}
function handleEdit(record: any) {
  isEdit.value = true
  modalTitle.value = '编辑缺陷'
  formData.value = { ...record }
  modalVisible.value = true
}
async function handleSubmit() {
  if (!formData.value.defect_title) { Message.warning('请填写缺陷标题'); return }
  if (isEdit.value) {
    const { execute, error } = usePut(ApiSecDefect.edit, formData)
    await execute()
    if (error.value) { Message.error('编辑失败'); return }
    Message.success('编辑成功')
  } else {
    const { execute, error } = usePost(ApiSecDefect.add, formData)
    await execute()
    if (error.value) { Message.error('新增失败'); return }
    Message.success('新增成功')
  }
  modalVisible.value = false
  getList()
}

// ── 从 Finding 创建 ────────────────────────────────
const fromFindingVisible = ref(false)
const findingId = ref('')
async function handleFromFinding() {
  if (!findingId.value) { Message.warning('请输入Finding ID'); return }
  const { execute, error } = usePost(ApiSecDefect.fromFinding, { finding_id: findingId.value })
  await execute()
  if (error.value) { Message.error('创建失败'); return }
  Message.success('从Finding创建缺陷成功')
  fromFindingVisible.value = false
  findingId.value = ''
  getList()
}

// ── 删除 ──────────────────────────────────────────
async function handleDelete(record: any) {
  const { execute, error } = useDelete(ApiSecDefect.delete, { ids: [record.id] })
  await execute()
  if (error.value) { Message.error('删除失败'); return }
  Message.success('删除成功')
  getList()
}

const columns = [
  { title: '缺陷代码', dataIndex: 'defect_code', width: 120 },
  { title: '缺陷标题', dataIndex: 'defect_title', width: 200, ellipsis: true, tooltip: true },
  { title: '状态', dataIndex: 'defect_status', width: 80 },
  { title: '优先级', dataIndex: 'priority', width: 80 },
  { title: '项目组', dataIndex: 'project_group_name', width: 120 },
  { title: '模块路径', dataIndex: 'module_path', width: 160, ellipsis: true, tooltip: true },
  { title: '负责人', dataIndex: 'assignee_names', width: 100 },
  { title: '发现人', dataIndex: 'discoverer_names', width: 100 },
  { title: '安全缺陷', dataIndex: 'is_security', width: 80 },
  { title: '操作', slotName: 'operations', width: 150, fixed: 'right' as const },
]
</script>
<template>
  <div>
    <a-card :bordered="false" class="m-b-8px">
      <a-row :gutter="16">
        <a-col :span="6"><a-input v-model="queryParams.keyword" placeholder="搜索缺陷代码/标题" allow-clear @press-enter="() => { queryParams.page_num = 1; getList() }" /></a-col>
        <a-col :span="4"><a-input v-model="queryParams.project_group_id" placeholder="项目组ID" allow-clear @press-enter="() => { queryParams.page_num = 1; getList() }" /></a-col>
        <a-col :span="6">
          <a-space>
            <a-button type="primary" @click="() => { queryParams.page_num = 1; getList() }">搜索</a-button>
            <a-button type="primary" status="success" @click="handleAdd">新增缺陷</a-button>
            <a-button @click="fromFindingVisible = true">从Finding创建</a-button>
          </a-space>
        </a-col>
      </a-row>
    </a-card>
    <a-card :bordered="false">
      <a-table :loading="isLoading" :data="dataList" :columns="columns" :pagination="{ total, current: queryParams.page_num, pageSize: queryParams.page_size, showTotal: true }" row-key="id" @page-change="(p: number) => { queryParams.page_num = p; getList() }">
        <template #operations="{ record }">
          <a-space>
            <a-button type="text" size="small" @click="handleEdit(record)">编辑</a-button>
            <a-popconfirm content="确认删除？" @ok="handleDelete(record)">
              <a-button type="text" size="small" status="danger">删除</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </a-table>
    </a-card>
    <!-- 新增/编辑弹窗 -->
    <a-modal v-model:visible="modalVisible" :title="modalTitle" :width="640" @ok="handleSubmit">
      <a-form :model="formData" layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12"><a-form-item label="缺陷代码"><a-input v-model="formData.defect_code" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="缺陷状态"><a-select v-model="formData.defect_status"><a-option value="open">打开</a-option><a-option value="fixed">已修复</a-option><a-option value="verified">已验证</a-option><a-option value="closed">已关闭</a-option></a-select></a-form-item></a-col>
          <a-col :span="24"><a-form-item label="缺陷标题" required><a-input v-model="formData.defect_title" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="优先级"><a-select v-model="formData.priority"><a-option value="critical">严重</a-option><a-option value="high">高</a-option><a-option value="medium">中</a-option><a-option value="low">低</a-option></a-select></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="安全缺陷"><a-select v-model="formData.is_security"><a-option value="1">是</a-option><a-option value="0">否</a-option></a-select></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="项目组ID"><a-input v-model="formData.project_group_id" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="发布窗口ID"><a-input v-model="formData.release_window_id" /></a-form-item></a-col>
          <a-col :span="24"><a-form-item label="模块路径"><a-input v-model="formData.module_path" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="负责人"><a-input v-model="formData.assignee_names" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="发现人"><a-input v-model="formData.discoverer_names" /></a-form-item></a-col>
          <a-col :span="24"><a-form-item label="描述"><a-textarea v-model="formData.description" :auto-size="{ minRows: 2, maxRows: 4 }" /></a-form-item></a-col>
        </a-row>
      </a-form>
    </a-modal>
    <!-- 从Finding创建弹窗 -->
    <a-modal v-model:visible="fromFindingVisible" title="从Finding创建缺陷" @ok="handleFromFinding">
      <a-form :model="{ findingId }" layout="vertical">
        <a-form-item label="Finding ID" required>
          <a-input v-model="findingId" placeholder="请输入已确认的Finding ID" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>
