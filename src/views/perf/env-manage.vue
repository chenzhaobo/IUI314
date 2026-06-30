<script lang="ts" setup>
import { ref, computed } from 'vue'
import { Message } from '@arco-design/web-vue'
import { useGet, usePost, usePut, useDelete } from '@/hooks'
import { ApiPerfEnv } from '@/api/apis'

defineOptions({ name: 'PerfEnvManage' })

// ── 列表查询 ──────────────────────────────────
const queryParams = ref({
  page_num: 1,
  page_size: 10,
  keyword: '',
  env_type: '',
  status: '',
})

const { isFetching: isLoading, data: rawListData, execute: getList } = useGet<any>(ApiPerfEnv.getList, queryParams, { immediate: true })
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

const envTypeOptions = [
  { label: '全部', value: '' },
  { label: 'SIT', value: 'sit' },
  { label: 'UAT', value: 'uat' },
  { label: '性能', value: 'perf' },
  { label: '生产', value: 'prod' },
]

const columns = [
  { title: '环境名称', dataIndex: 'env_name', width: 160, ellipsis: true, tooltip: true },
  { title: '编码', dataIndex: 'env_code', width: 100 },
  { title: '类型', dataIndex: 'env_type', width: 70, slotName: 'env_type' },
  { title: 'DB地址', dataIndex: 'db_host', width: 130 },
  { title: '端口', dataIndex: 'db_port', width: 60 },
  { title: 'Meta库', dataIndex: 'meta_db_name', width: 140 },
  { title: 'DB前缀', dataIndex: 'db_prefix', width: 110 },
  { title: '同步状态', dataIndex: 'sync_status', width: 80, slotName: 'sync_status' },
  { title: '最后同步', dataIndex: 'last_sync_at', width: 160, slotName: 'last_sync' },
  { title: '状态', dataIndex: 'status', width: 60, slotName: 'status' },
  { title: '操作', dataIndex: 'operations', slotName: 'operations', width: 210, fixed: 'right' as const },
]

// ── 新增/编辑弹窗 ──────────────────────────────────
const modalVisible = ref(false)
const isEdit = ref(false)
const form = ref<any>({})
const submitting = ref(false)

function handleAdd() {
  isEdit.value = false
  form.value = {
    env_name: '', env_code: '', env_type: 'sit',
    db_host: '', db_port: 5432, db_user: 'fitest',
    db_password: '', db_prefix: 'benchmarksit_', meta_db_name: 'benchmarksit_meta',
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
  if (!form.value.env_name) { Message.warning('请输入环境名称'); return }
  if (!form.value.env_code) { Message.warning('请输入环境编码'); return }
  if (!form.value.db_host) { Message.warning('请输入数据库地址'); return }
  submitting.value = true
  try {
    if (isEdit.value) {
      const { execute, error } = usePut(ApiPerfEnv.edit, form.value)
      await execute()
      if (error.value) { Message.error('编辑失败'); return }
      Message.success('编辑成功')
    } else {
      const { execute, error } = usePost(ApiPerfEnv.add, form.value)
      await execute()
      if (error.value) { Message.error('添加失败'); return }
      Message.success('添加成功')
    }
    modalVisible.value = false
    getList()
  } finally {
    submitting.value = false
  }
}

// ── 删除 ──────────────────────────────────
async function handleDelete(record: any) {
  const { execute, error } = useDelete(ApiPerfEnv.delete, { ids: [record.id] })
  await execute()
  if (error.value) { Message.error('删除失败'); return }
  Message.success('删除成功')
  getList()
}

// ── 同步菜单（从被测系统 meta 库拉取到当前环境）──────────────────────────
const syncingId = ref('')

function formatTime(time: string) {
  if (!time) return '-'
  return time.replace('T', ' ').substring(0, 19)
}
async function handleSyncMenus(record: any) {
  syncingId.value = record.id
  try {
    const { execute, error, data } = usePost<any>(ApiPerfEnv.sync, { id: record.id })
    await execute()
    if (error.value) { Message.error('同步失败，请查看同步状态'); return }
    const r = data.value
    Message.success(`同步成功：${r?.cloud_count ?? 0} 云 / ${r?.app_count ?? 0} 应用 / ${r?.menu_count ?? 0} 菜单`)
    getList()
  } finally {
    syncingId.value = ''
  }
}
</script>

<template>
  <div class="perf-env-manage">
    <a-card :bordered="false" class="m-b-8px">
      <a-row :gutter="16">
        <a-col :span="6">
          <a-input-search v-model="queryParams.keyword" placeholder="搜索环境名称/编码" allow-clear @search="handleSearch" @press-enter="handleSearch" />
        </a-col>
        <a-col :span="4">
          <a-select v-model="queryParams.env_type" :options="envTypeOptions" placeholder="环境类型" allow-clear @change="handleSearch" />
        </a-col>
        <a-col :span="6">
          <a-space>
            <a-button type="primary" @click="handleSearch">搜索</a-button>
            <a-button type="primary" status="success" @click="handleAdd">
              <template #icon><icon-plus /></template>
              新增环境
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
        <template #env_type="{ record }">
          <a-tag>{{ record.env_type }}</a-tag>
        </template>
        <template #sync_status="{ record }">
          <a-tag :color="record.sync_status === 'success' ? 'green' : record.sync_status === 'syncing' ? 'blue' : record.sync_status === 'failed' ? 'red' : 'gray'">
            {{ record.sync_status || 'idle' }}
          </a-tag>
        </template>
        <template #last_sync="{ record }">
          {{ formatTime(record.last_sync_at) }}
        </template>
        <template #status="{ record }">
          <a-tag :color="record.status === '1' ? 'green' : 'red'">{{ record.status === '1' ? '启用' : '禁用' }}</a-tag>
        </template>
        <template #operations="{ record }">
          <a-space>
            <a-button type="text" size="small" @click="handleEdit(record)">编辑</a-button>
            <a-button type="text" size="small" status="success" :loading="syncingId === record.id" @click="handleSyncMenus(record)">同步菜单</a-button>
            <a-popconfirm content="确认删除？删除后不可恢复" @ok="handleDelete(record)">
              <a-button type="text" size="small" status="danger">删除</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </a-table>
    </a-card>

    <!-- 新增/编辑弹窗 -->
    <a-modal v-model:visible="modalVisible" :title="isEdit ? '编辑环境' : '新增环境'" :width="600" :ok-loading="submitting" @ok="handleSubmit">
      <a-form :model="form" layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="环境名称" required>
              <a-input v-model="form.env_name" placeholder="如：SIT性能测试环境" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="环境编码" required>
              <a-input v-model="form.env_code" placeholder="如：benchmarksit" :disabled="isEdit" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item label="环境类型">
              <a-select v-model="form.env_type">
                <a-option value="sit">SIT</a-option>
                <a-option value="uat">UAT</a-option>
                <a-option value="perf">性能</a-option>
                <a-option value="prod">生产</a-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="状态">
              <a-select v-model="form.status">
                <a-option value="1">启用</a-option>
                <a-option value="0">禁用</a-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="16">
            <a-form-item label="数据库地址" required>
              <a-input v-model="form.db_host" placeholder="如：172.20.198.11" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="端口">
              <a-input-number v-model="form.db_port" :min="1" :max="65535" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item label="数据库用户">
              <a-input v-model="form.db_user" placeholder="fitest" />
            </a-form-item>
          </a-col>
          <a-col :span="16">
            <a-form-item label="数据库密码">
              <a-input-password v-model="form.db_password" placeholder="密码" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="数据库前缀">
              <a-input v-model="form.db_prefix" placeholder="如：benchmarksit_" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="Meta库名">
              <a-input v-model="form.meta_db_name" placeholder="如：benchmarksit_meta" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="备注">
          <a-textarea v-model="form.remark" :auto-size="{ minRows: 2, maxRows: 4 }" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<style scoped>
.perf-env-manage { padding: 0; }
</style>
