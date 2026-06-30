<script lang="ts" setup>
import { ref, computed, watch } from 'vue'
import { Message } from '@arco-design/web-vue'
import { useGet, usePost, usePut, useDelete, useToken } from '@/hooks'
import { ApiPerfScript } from '@/api/apis'

defineOptions({ name: 'PerfScript' })

// ── 列表查询 ──────────────────────────────────
const queryParams = ref({
  page_num: 1,
  page_size: 10,
  keyword: '',
  domain: '',
})

const { isFetching: isLoading, data: rawListData, execute: getList } = useGet<any>(ApiPerfScript.getList, queryParams, { immediate: true })
const dataList = computed(() => rawListData.value?.list || [])
const total = computed(() => rawListData.value?.total || 0)
const domainList = computed(() => {
  const set = new Set<string>()
  for (const s of dataList.value) {
    if (s.domain) set.add(s.domain)
  }
  return Array.from(set)
})

function handleSearch() {
  queryParams.value.page_num = 1
  getList()
}

function handlePageChange(page: number) {
  queryParams.value.page_num = page
  getList()
}

const columns = [
  { title: '脚本名称', dataIndex: 'name', width: 160, ellipsis: true, tooltip: true },
  { title: '编码', dataIndex: 'code', width: 120 },
  { title: '云', dataIndex: 'cloud', width: 80, ellipsis: true, tooltip: true },
  { title: '领域', dataIndex: 'domain', width: 100, ellipsis: true, tooltip: true },
  { title: '模块', dataIndex: 'module_name', width: 100, ellipsis: true, tooltip: true },
  { title: '功能', dataIndex: 'function_name', width: 100, ellipsis: true, tooltip: true },
  { title: '测试类型', dataIndex: 'test_type', width: 80, ellipsis: true, tooltip: true },
  { title: '版本', dataIndex: 'version', width: 60 },
  { title: '文件名', dataIndex: 'jmx_file_name', width: 180, ellipsis: true, tooltip: true },
  { title: '大小(KB)', dataIndex: 'jmx_file_size', width: 90, render: ({ record }: any) => (record.jmx_file_size / 1024).toFixed(1) },
  { title: '运行次数', dataIndex: 'run_count', width: 80 },
  { title: '状态', dataIndex: 'status', width: 60, slotName: 'status' },
  { title: '操作', dataIndex: 'operations', slotName: 'operations', width: 160, fixed: 'right' as const },
]

// ── 上传弹窗 ──────────────────────────────────
const uploadVisible = ref(false)
const uploadForm = ref({
  name: '',
  code: '',
  project_group_id: '',
  description: '',
  tags: '',
  remark: '',
  cloud: '',
  domain: '',
  module_name: '',
  function_name: '',
  test_type: '',
})
const uploadFile = ref<File | null>(null)
const uploading = ref(false)

function handleUploadClick() {
  uploadForm.value = { name: '', code: '', project_group_id: '', description: '', tags: '', remark: '', cloud: '', domain: '', module_name: '', function_name: '', test_type: '' }
  uploadFile.value = null
  uploadVisible.value = true
}

function handleFileChange(fileList: any[]) {
  if (fileList.length > 0) {
    const item = fileList[0]
    // Arco Design Upload @change passes FileItem[], item.file is the native File
    uploadFile.value = item.file || item
    if (!uploadForm.value.name) {
      const fileName = item.name || item.file?.name || ''
      uploadForm.value.name = fileName.replace(/\.jmx$/i, '')
    }
  }
}

async function handleUploadSubmit() {
  if (!uploadForm.value.name) { Message.warning('请输入脚本名称'); return }
  if (!uploadForm.value.code) { Message.warning('请输入脚本编码'); return }
  if (!uploadFile.value) { Message.warning('请选择 .jmx 文件'); return }

  const formData = new FormData()
  formData.append('file', uploadFile.value)
  formData.append('name', uploadForm.value.name)
  formData.append('code', uploadForm.value.code)
  formData.append('project_group_id', uploadForm.value.project_group_id)
  formData.append('description', uploadForm.value.description)
  formData.append('tags', uploadForm.value.tags)
  formData.append('remark', uploadForm.value.remark)
  formData.append('cloud', uploadForm.value.cloud)
  formData.append('domain', uploadForm.value.domain)
  formData.append('module_name', uploadForm.value.module_name)
  formData.append('function_name', uploadForm.value.function_name)
  formData.append('test_type', uploadForm.value.test_type)

  uploading.value = true
  try {
    const { token } = useToken()
    const resp = await fetch(import.meta.env.VITE_API_BASE_URL + ApiPerfScript.upload, {
      method: 'POST',
      body: formData,
      headers: { Authorization: token },
    })
    const data = await resp.json()
    if (data.code === 200) {
      Message.success('上传成功')
      uploadVisible.value = false
      getList()
    } else {
      Message.error(data.msg || '上传失败')
    }
  } catch (e) {
    Message.error('上传失败')
  } finally {
    uploading.value = false
  }
}

// ── 编辑弹窗 ──────────────────────────────────
const editVisible = ref(false)
const editForm = ref<any>({})
const isEdit = ref(false)

function handleEdit(record: any) {
  isEdit.value = true
  editForm.value = { ...record }
  editVisible.value = true
}

async function handleEditSubmit() {
  const { execute, error } = usePut(ApiPerfScript.edit, editForm.value)
  await execute()
  if (error.value) { Message.error('编辑失败'); return }
  Message.success('编辑成功')
  editVisible.value = false
  getList()
}

// ── 删除 ──────────────────────────────────
async function handleDelete(record: any) {
  const { execute, error } = useDelete(ApiPerfScript.delete, { ids: [record.id] })
  await execute()
  if (error.value) { Message.error('删除失败'); return }
  Message.success('删除成功')
  getList()
}

const editFields = [
  { label: '脚本名称', field: 'name', required: true },
  { label: '脚本编码', field: 'code', required: true },
  { label: '云', field: 'cloud' },
  { label: '领域', field: 'domain' },
  { label: '模块', field: 'module_name' },
  { label: '功能', field: 'function_name' },
  { label: '测试类型', field: 'test_type' },
  { label: '版本', field: 'version' },
  { label: '标签', field: 'tags' },
  { label: '描述', field: 'description' },
  { label: '备注', field: 'remark' },
]

// ── 领域筛选 ──────────────────────────────────
const domainFilter = ref('')
watch(domainFilter, (v) => {
  queryParams.value.domain = v
  queryParams.value.page_num = 1
  getList()
})

// ── 批量上传 ──────────────────────────────────
const batchUploadVisible = ref(false)
const batchFiles = ref<File[]>([])
const batchUploading = ref(false)
const batchProjectGroupId = ref('')

function handleBatchUploadClick() {
  batchFiles.value = []
  batchProjectGroupId.value = ''
  batchUploadVisible.value = true
}

function handleBatchFileChange(fileList: any[]) {
  batchFiles.value = fileList.map((item: any) => item.file || item).filter((f: File) => f && f.name.endsWith('.jmx'))
}

async function handleBatchUploadSubmit() {
  if (batchFiles.value.length === 0) { Message.warning('请选择 .jmx 文件'); return }
  batchUploading.value = true

  const formData = new FormData()
  for (const f of batchFiles.value) {
    formData.append('files', f)
  }
  if (batchProjectGroupId.value) {
    formData.append('project_group_id', batchProjectGroupId.value)
  }

  try {
    const { token } = useToken()
    const resp = await fetch(import.meta.env.VITE_API_BASE_URL + ApiPerfScript.batchUpload, {
      method: 'POST',
      body: formData,
      headers: { Authorization: token },
    })
    const data = await resp.json()
    if (data.code === 200) {
      Message.success(data.msg || '批量上传完成')
      batchUploadVisible.value = false
      getList()
    } else {
      Message.error(data.msg || '批量上传失败')
    }
  } catch (e) {
    Message.error('批量上传失败')
  } finally {
    batchUploading.value = false
  }
}
</script>

<template>
  <div class="perf-script">
    <a-card :bordered="false" class="m-b-8px">
      <a-row :gutter="16">
        <a-col :span="6">
          <a-input-search v-model="queryParams.keyword" placeholder="搜索脚本名称/编码" allow-clear @search="handleSearch" @press-enter="handleSearch" />
        </a-col>
        <a-col :span="4">
          <a-select v-model="domainFilter" placeholder="选择领域" allow-clear>
            <a-option v-for="d in domainList" :key="d" :value="d">{{ d }}</a-option>
          </a-select>
        </a-col>
        <a-col :span="6">
          <a-space>
            <a-button type="primary" @click="handleSearch">搜索</a-button>
            <a-button type="primary" status="success" @click="handleUploadClick">
              <template #icon><icon-upload /></template>
              上传脚本
            </a-button>
            <a-button type="primary" status="warning" @click="handleBatchUploadClick">
              <template #icon><icon-storage /></template>
              批量上传
            </a-button>
          </a-space>
        </a-col>
      </a-row>
    </a-card>

    <a-card :bordered="false">
      <a-table
        :loading="isLoading"
        :data="dataList"
        :columns="columns"
        :pagination="{ total, current: queryParams.page_num, pageSize: queryParams.page_size, showTotal: true, showPageSize: true }"
        row-key="id"
        @page-change="handlePageChange"
      >
        <template #status="{ record }">
          <a-tag :color="record.status === '1' ? 'green' : 'red'">{{ record.status === '1' ? '启用' : '禁用' }}</a-tag>
        </template>
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

    <!-- 上传弹窗 -->
    <a-modal v-model:visible="uploadVisible" title="上传JMX脚本" :width="560" :ok-loading="uploading" @ok="handleUploadSubmit">
      <a-form :model="uploadForm" layout="vertical">
        <a-form-item label="脚本名称" required>
          <a-input v-model="uploadForm.name" placeholder="请输入脚本名称" />
        </a-form-item>
        <a-form-item label="脚本编码" required>
          <a-input v-model="uploadForm.code" placeholder="如：login_test" />
        </a-form-item>
        <a-row :gutter="16">
          <a-col :span="12"><a-form-item label="云"><a-input v-model="uploadForm.cloud" placeholder="如：司库云" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="领域"><a-input v-model="uploadForm.domain" placeholder="如：账户管理" /></a-form-item></a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12"><a-form-item label="模块"><a-input v-model="uploadForm.module_name" placeholder="如：银行账户管理" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="功能"><a-input v-model="uploadForm.function_name" placeholder="如：销户申请" /></a-form-item></a-col>
        </a-row>
        <a-form-item label="测试类型">
          <a-input v-model="uploadForm.test_type" placeholder="如：列表测试" />
        </a-form-item>
        <a-form-item label="项目组ID">
          <a-input v-model="uploadForm.project_group_id" placeholder="可选" />
        </a-form-item>
        <a-form-item label="JMX文件" required>
          <a-upload :auto-upload="false" :limit="1" accept=".jmx" @change="handleFileChange" />
        </a-form-item>
        <a-form-item label="标签">
          <a-input v-model="uploadForm.tags" placeholder="逗号分隔" />
        </a-form-item>
        <a-form-item label="描述">
          <a-textarea v-model="uploadForm.description" :auto-size="{ minRows: 2, maxRows: 4 }" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 编辑弹窗 -->
    <a-modal v-model:visible="editVisible" title="编辑脚本" :width="560" @ok="handleEditSubmit">
      <a-form :model="editForm" layout="vertical">
        <a-form-item v-for="f in editFields" :key="f.field" :label="f.label" :required="f.required">
          <a-input v-model="editForm[f.field]" :placeholder="`请输入${f.label}`" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 批量上传弹窗 -->
    <a-modal v-model:visible="batchUploadVisible" title="批量上传JMX脚本" :width="560" :ok-loading="batchUploading" @ok="handleBatchUploadSubmit">
      <a-alert type="info" :style="{ marginBottom: '12px' }">
        文件名需符合规范: code-基准-云-领域-模块-功能-测试类型.jmx
        系统将从文件名自动解析领域信息并查重跳过已存在脚本。
      </a-alert>
      <a-form layout="vertical">
        <a-form-item label="项目组ID（可选）">
          <a-input v-model="batchProjectGroupId" placeholder="所有脚本共享此项目组" />
        </a-form-item>
        <a-form-item label="选择JMX文件（可多选）" required>
          <a-upload :auto-upload="false" multiple accept=".jmx" @change="handleBatchFileChange" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<style scoped>
.perf-script { padding: 0; }
</style>
