<script lang="ts" setup>
import { ref, computed, watch } from 'vue'
import { Message } from '@arco-design/web-vue'
import { useGet, usePost, usePut, useDelete, useToken } from '@/hooks'
import { ApiPerfScript, ApiSecProjectGroup } from '@/api/apis'

defineOptions({ name: 'PerfScript' })

// ── 列表查询 ──────────────────────────────────
const queryParams = ref({
  page_num: 1,
  page_size: 10,
  keyword: '',
  project_group_id: '',
})

const { isFetching: isLoading, data: rawListData, execute: getList } = useGet<any>(ApiPerfScript.getList, queryParams, { immediate: true })
const dataList = computed(() => rawListData.value?.list || [])
const total = computed(() => rawListData.value?.total || 0)

// ── 项目组选项 ──────────────────────────────────
const { data: pgRawData } = useGet<any>(ApiSecProjectGroup.getAll, {}, { immediate: true })
const projectGroupOptions = computed(() => {
  const all = Array.isArray(pgRawData.value) ? pgRawData.value : []
  return all.map((pg: any) => ({ label: pg.name, value: pg.id }))
})

function handleSearch() {
  queryParams.value.page_num = 1
  getList()
}

function handlePageChange(page: number) {
  queryParams.value.page_num = page
  getList()
}

// ── 时间格式化 ──────────────────────────────────
function formatTime(time?: string | null) {
  if (!time) return '-'
  return time.replace('T', ' ').substring(0, 19)
}

const columns = [
  { title: '脚本名称', dataIndex: 'name', width: 160, ellipsis: true, tooltip: true },
  { title: '编码', dataIndex: 'code', width: 120 },
  { title: '应用编码', dataIndex: 'app_code', width: 90 },
  { title: '测试类型', dataIndex: 'test_type', width: 80, ellipsis: true, tooltip: true },
  { title: '绑定数', dataIndex: 'bind_count', width: 70 },
  { title: '事务', dataIndex: 'txn_summary', width: 100, slotName: 'txnSummary' },
  { title: '版本', dataIndex: 'version', width: 60 },
  { title: '文件名', dataIndex: 'jmx_file_name', width: 180, ellipsis: true, tooltip: true },
  { title: '大小(KB)', dataIndex: 'jmx_file_size', width: 90, render: ({ record }: any) => (record.jmx_file_size / 1024).toFixed(1) },
  { title: '运行次数', dataIndex: 'run_count', width: 80 },
  { title: '创建时间', dataIndex: 'created_at', width: 160, slotName: 'created_at' },
  { title: '更新时间', dataIndex: 'updated_at', width: 160, slotName: 'updated_at' },
  { title: '更新人', dataIndex: 'update_by', width: 100, ellipsis: true, tooltip: true },
  { title: '状态', dataIndex: 'status', width: 60, slotName: 'status' },
  { title: '操作', dataIndex: 'operations', slotName: 'operations', width: 280, fixed: 'right' as const },
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
  test_type: '',
})
const uploadFile = ref<File | null>(null)
const uploading = ref(false)

function handleUploadClick() {
  uploadForm.value = { name: '', code: '', project_group_id: '', description: '', tags: '', remark: '', test_type: '' }
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
  { label: '测试类型', field: 'test_type' },
  { label: '版本', field: 'version' },
  { label: '标签', field: 'tags' },
  { label: '描述', field: 'description' },
  { label: '备注', field: 'remark' },
]

// ── 项目组筛选 ──────────────────────────────────
watch(() => queryParams.value.project_group_id, () => {
  queryParams.value.page_num = 1
  getList()
})

// ── 事务详情抽屉 ──────────────────────────────────
const txnDrawerVisible = ref(false)
const txnDrawerData = ref<any>(null)
const txnDrawerTitle = ref('')

const txnDetailColumns = [
  { title: '#', width: 60, render: ({ rowIndex }: any) => rowIndex + 1 },
  { title: '事务名称', dataIndex: 'name', width: 300, ellipsis: true, tooltip: true },
  { title: '事务编码', dataIndex: 'txn_code', width: 180, ellipsis: true, tooltip: true },
  { title: '按钮Key', dataIndex: 'button_key', width: 120, ellipsis: true, tooltip: true },
  { title: '类型', dataIndex: 'txn_type', width: 130, slotName: 'txnType' },
  { title: '启用', dataIndex: 'enabled', width: 70, slotName: 'enabled' },
  { title: '关键事务', dataIndex: 'is_key_txn', width: 90, slotName: 'keyTxn' },
  { title: '父样本', dataIndex: 'is_parent', width: 80, slotName: 'isParent' },
]

function handleViewTxn(record: any) {
  txnDrawerTitle.value = `事务详情 - ${record.name}`
  const txnDetail = record.txn_detail_json
  if (!txnDetail) {
    txnDrawerData.value = { transactions: [], key_txn_count: 0, total_txn_count: 0, empty: true }
  } else {
    txnDrawerData.value = txnDetail
  }
  txnDrawerVisible.value = true
}

function getTxnSummary(record: any): string {
  const txn = record.txn_detail_json
  if (!txn) return '-'
  return `${txn.key_txn_count ?? 0} / ${txn.total_txn_count ?? 0}`
}

// ── 重新解析 ──────────────────────────────────
const reparsing = ref(false)

async function handleReparse(record: any) {
  reparsing.value = true
  const { execute, error } = usePut(ApiPerfScript.reparse + '?id=' + record.id)
  await execute()
  reparsing.value = false
  if (error.value) { Message.error('重新解析失败'); return }
  Message.success('事务详情解析成功')
  getList()
}

async function handleReparseAll() {
  reparsing.value = true
  const { execute, error, data } = usePost(ApiPerfScript.reparseAll, {})
  await execute()
  reparsing.value = false
  if (error.value) { Message.error('批量解析失败'); return }
  Message.success(data.value?.msg || '批量解析完成')
  getList()
}

// ── 自动关联 ──────────────────────────────────
const autoBinding = ref(false)
const autoBindingAll = ref(false)

async function handleAutoBind(record: any) {
  autoBinding.value = true
  const { execute, error, data } = usePost(ApiPerfScript.autoBind + '?id=' + record.id)
  await execute()
  autoBinding.value = false
  if (error.value) { Message.error('自动关联失败'); return }
  const r = data.value
  if (r) {
    Message.success(`匹配${r.menu_count}个菜单，新建${r.bind_count}条绑定，事务匹配${r.txn_matched}/${r.txn_total}`)
  } else {
    Message.success('自动关联完成')
  }
  getList()
}

async function handleAutoBindAll() {
  autoBindingAll.value = true
  const { execute, error, data } = usePost(ApiPerfScript.autoBindAll, {})
  await execute()
  autoBindingAll.value = false
  if (error.value) { Message.error('批量自动关联失败'); return }
  const r = data.value
  if (r) {
    Message.success(r.message || `批量关联完成: 共${r.total}个脚本, ${r.matched}个匹配到菜单`)
  } else {
    Message.success('批量自动关联完成')
  }
  getList()
}

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
        <a-col :span="8">
          <a-input-search v-model="queryParams.keyword" placeholder="搜索脚本名称/编码" allow-clear @search="handleSearch" @press-enter="handleSearch" />
        </a-col>
        <a-col :span="5">
          <a-select v-model="queryParams.project_group_id" :options="projectGroupOptions" placeholder="全部项目组" allow-search allow-clear />
        </a-col>
        <a-col :span="8">
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
            <a-button :loading="reparsing" @click="handleReparseAll">
              <template #icon><icon-refresh /></template>
              重新解析
            </a-button>
            <a-button type="primary" status="success" :loading="autoBindingAll" @click="handleAutoBindAll">
              <template #icon><icon-link /></template>
              批量自动关联
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
        <template #created_at="{ record }">{{ formatTime(record.created_at) }}</template>
        <template #updated_at="{ record }">{{ formatTime(record.updated_at) }}</template>
        <template #status="{ record }">
          <a-tag :color="record.status === '1' ? 'green' : 'red'">{{ record.status === '1' ? '启用' : '禁用' }}</a-tag>
        </template>
        <template #txnSummary="{ record }">
          <a-button type="text" size="small" @click="handleViewTxn(record)">
            {{ getTxnSummary(record) }}
          </a-button>
        </template>
        <template #operations="{ record }">
          <a-space>
            <a-button type="text" size="small" @click="handleViewTxn(record)">事务详情</a-button>
            <a-button type="text" size="small" :loading="reparsing" @click="handleReparse(record)">解析</a-button>
            <a-button type="text" size="small" :loading="autoBinding" @click="handleAutoBind(record)">自动关联</a-button>
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

    <!-- 事务详情抽屉 -->
    <a-drawer :visible="txnDrawerVisible" :width="860" :title="txnDrawerTitle" @cancel="txnDrawerVisible = false" @ok="txnDrawerVisible = false">
      <template v-if="txnDrawerData?.empty">
        <a-empty description="该脚本尚未解析事务详情，请点击「解析」按钮重新解析" />
      </template>
      <template v-else>
        <a-descriptions :data="[
          { label: '事务总数', value: txnDrawerData?.total_txn_count ?? 0 },
          { label: '[A]关键事务', value: txnDrawerData?.key_txn_count ?? 0 },
          { label: '启用', value: txnDrawerData?.enabled_count ?? 0 },
        ]" :column="3" layout="inline-horizontal" style="margin-bottom: 16px" />
        <a-table
          :data="txnDrawerData?.transactions || []"
          :columns="txnDetailColumns"
          :pagination="false"
          row-key="name"
          size="small"
          column-resizable
          :scroll="{ x: 920, y: 480 }"
        >
          <template #txnType="{ record }">
            <a-tag :color="record.txn_type === 'transaction_controller' ? 'blue' : 'gray'" size="small">
              {{ record.txn_type === 'transaction_controller' ? '事务控制器' : 'HTTP请求' }}
            </a-tag>
          </template>
          <template #enabled="{ record }">
            <a-tag :color="record.enabled ? 'green' : 'red'" size="small">{{ record.enabled ? '是' : '否' }}</a-tag>
          </template>
          <template #keyTxn="{ record }">
            <a-tag v-if="record.is_key_txn" color="red" size="small">[A]</a-tag>
            <span v-else>-</span>
          </template>
          <template #isParent="{ record }">
            <a-tag v-if="record.is_parent" color="orange" size="small">是</a-tag>
            <span v-else>-</span>
          </template>
        </a-table>
      </template>
    </a-drawer>

    <!-- 批量上传弹窗 -->
    <a-modal v-model:visible="batchUploadVisible" title="批量上传JMX脚本" :width="560" :ok-loading="batchUploading" @ok="handleBatchUploadSubmit">
      <a-alert type="info" :style="{ marginBottom: '12px' }">
        文件名需符合规范: code-基准-云-领域-模块-功能-测试类型.jmx
        系统将从文件名自动解析编码和测试类型，并按MD5查重跳过已存在脚本。
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
