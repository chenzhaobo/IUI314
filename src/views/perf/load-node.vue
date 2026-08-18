<script lang="ts" setup>
import { ref, computed } from 'vue'
import { Message } from '@arco-design/web-vue'
import { useGet, usePost, usePut, useDelete, useToken } from '@/hooks'
import { ApiPerfLoadNode } from '@/api/apis'

defineOptions({ name: 'load-node' })

// ── 列表查询 ──────────────────────────────────
const queryParams = ref({
  page_num: 1,
  page_size: 10,
  keyword: '',
  status: '',
})

const { isFetching: isLoading, data: rawListData, execute: getList } = useGet<any>(ApiPerfLoadNode.getList, queryParams, { immediate: true })
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

function formatTime(time: string) {
  if (!time) return '-'
  return time.replace('T', ' ').substring(0, 19)
}

const statusColorMap: Record<string, string> = {
  online: 'green',
  offline: 'gray',
  disabled: 'red',
}

const statusTextMap: Record<string, string> = {
  online: '在线',
  offline: '离线',
  disabled: '禁用',
}

const columns = [
  { title: '节点名称', dataIndex: 'node_name', width: 140, ellipsis: true, tooltip: true },
  { title: 'IP地址', dataIndex: 'host_ip', width: 130 },
  { title: '端口', dataIndex: 'agent_port', width: 70 },
  { title: '操作系统', dataIndex: 'os_type', width: 90, slotName: 'os_type' },
  { title: '状态', dataIndex: 'status', width: 80, slotName: 'status' },
  { title: '当前负载', dataIndex: 'current_load', width: 90, slotName: 'load' },
  { title: '最大并发', dataIndex: 'max_concurrency', width: 90 },
  { title: 'Agent版本', dataIndex: 'agent_version', width: 100 },
  { title: '最后心跳', dataIndex: 'last_heartbeat', width: 160, slotName: 'last_heartbeat' },
  { title: '操作', dataIndex: 'operations', slotName: 'operations', width: 220, fixed: 'right' as const },
]

// ── 新增/编辑弹窗 ──────────────────────────────────
const modalVisible = ref(false)
const isEdit = ref(false)
const form = ref<any>({})
const submitting = ref(false)

function handleAdd() {
  isEdit.value = false
  form.value = {
    node_name: '',
    host_ip: '',
    agent_port: 9900,
    auth_token: '',
    jmeter_home_dir: '',
    java_home_dir: '',
    work_dir: '',
    max_concurrency: 1,
    status: 'online',
    remark: '',
  }
  modalVisible.value = true
}

function handleEdit(record: any) {
  isEdit.value = true
  form.value = { ...record }
  modalVisible.value = true
}

async function handleSubmit() {
  if (!form.value.node_name) { Message.warning('请输入节点名称'); return }
  if (!form.value.host_ip) { Message.warning('请输入IP地址'); return }
  submitting.value = true
  try {
    if (isEdit.value) {
      const { execute, error } = usePut(ApiPerfLoadNode.edit, form.value)
      await execute()
      if (error.value) { Message.error('编辑失败'); return }
      Message.success('编辑成功')
    } else {
      const { execute, error } = usePost(ApiPerfLoadNode.add, form.value)
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
  const { execute, error } = useDelete(ApiPerfLoadNode.delete, { ids: [record.id] })
  await execute()
  if (error.value) { Message.error('删除失败'); return }
  Message.success('删除成功')
  getList()
}

// ── 测试连接 ──────────────────────────────────
const testVisible = ref(false)
const testLoading = ref(false)
const testResult = ref<any>(null)

async function handleTestConnection(record: any) {
  testVisible.value = true
  testLoading.value = true
  testResult.value = null
  const { token } = useToken()
  const base = import.meta.env.VITE_API_BASE_URL || ''
  try {
    const resp = await fetch(`${base}${ApiPerfLoadNode.testConnection}?id=${encodeURIComponent(record.id)}`, {
      headers: { Authorization: token },
    })
    const data = await resp.json()
    testResult.value = data.data || data
  } finally {
    testLoading.value = false
  }
}

const statusOptions = [
  { label: '全部', value: '' },
  { label: '在线', value: 'online' },
  { label: '离线', value: 'offline' },
  { label: '禁用', value: 'disabled' },
]
</script>

<template>
  <div class="perf-load-node">
    <a-card :bordered="false" class="m-b-8px">
      <a-row :gutter="16">
        <a-col :span="6">
          <a-input-search v-model="queryParams.keyword" placeholder="搜索节点名称/IP" allow-clear @search="handleSearch" @press-enter="handleSearch" />
        </a-col>
        <a-col :span="4">
          <a-select v-model="queryParams.status" :options="statusOptions" placeholder="状态" allow-clear @change="handleSearch" />
        </a-col>
        <a-col :span="6">
          <a-space>
            <a-button type="primary" @click="handleSearch">搜索</a-button>
            <a-button type="primary" status="success" @click="handleAdd">
              <template #icon><icon-plus /></template>
              新增节点
            </a-button>
          </a-space>
        </a-col>
      </a-row>
    </a-card>

    <a-card :bordered="false">
<a-table
  column-resizable
        :loading="isLoading"
        :data="dataList"
        :columns="columns"
        :pagination="{ total, current: queryParams.page_num, pageSize: queryParams.page_size, showTotal: true, showPageSize: true }"
        row-key="id"
        @page-change="handlePageChange"
      >
        <template #os_type="{ record }">
          <a-tag>{{ record.os_type || '-' }}</a-tag>
        </template>
        <template #status="{ record }">
          <a-badge :status="record.status === 'online' ? 'success' : record.status === 'disabled' ? 'danger' : 'default'" :text="statusTextMap[record.status] || record.status" />
        </template>
        <template #load="{ record }">
          <span :style="{ color: record.current_load >= record.max_concurrency ? 'rgb(var(--danger-6))' : '' }">
            {{ record.current_load || 0 }} / {{ record.max_concurrency || 1 }}
          </span>
        </template>
        <template #last_heartbeat="{ record }">
          {{ formatTime(record.last_heartbeat) }}
        </template>
        <template #operations="{ record }">
          <a-space>
            <a-button type="text" size="small" @click="handleTestConnection(record)">测试连接</a-button>
            <a-button type="text" size="small" @click="handleEdit(record)">编辑</a-button>
            <a-popconfirm content="确认删除？删除后不可恢复" @ok="handleDelete(record)">
              <a-button type="text" size="small" status="danger">删除</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </a-table>
    </a-card>

    <!-- 新增/编辑弹窗 -->
    <a-modal v-model:visible="modalVisible" :title="isEdit ? '编辑节点' : '新增节点'" :width="600" :ok-loading="submitting" @ok="handleSubmit">
      <a-form :model="form" layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="节点名称" required>
              <a-input v-model="form.node_name" placeholder="如：压测机-生产环境" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="IP地址" required>
              <a-input v-model="form.host_ip" placeholder="如：172.20.198.100" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item label="Agent端口">
              <a-input-number v-model="form.agent_port" :min="1" :max="65535" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="最大并发">
              <a-input-number v-model="form.max_concurrency" :min="1" :max="20" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="状态">
              <a-select v-model="form.status">
                <a-option value="online">在线</a-option>
                <a-option value="offline">离线</a-option>
                <a-option value="disabled">禁用</a-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="认证Token">
          <a-input-password v-model="form.auth_token" placeholder="Bearer Token (可选，内网可不填)" />
        </a-form-item>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="JMeter安装目录">
              <a-input v-model="form.jmeter_home_dir" placeholder="如：C:\jmeter 或 /opt/jmeter" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="Java安装目录">
              <a-input v-model="form.java_home_dir" placeholder="留空使用系统默认" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="Agent工作目录">
          <a-input v-model="form.work_dir" placeholder="如：C:\perf-agent\data 或 /opt/perf-agent/data" />
        </a-form-item>
        <a-form-item label="备注">
          <a-textarea v-model="form.remark" :auto-size="{ minRows: 2, maxRows: 4 }" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 测试连接弹窗 -->
    <a-modal v-model:visible="testVisible" title="测试连接" :footer="false" :width="480">
      <a-spin :loading="testLoading" style="width: 100%">
        <div v-if="testResult" style="text-align: center; padding: 20px 0">
          <a-result
            :status="testResult.status === 'online' ? 'success' : 'error'"
            :title="testResult.status === 'online' ? '连接成功' : '连接失败'"
          >
            <template #extra>
              <a-descriptions :column="1" layout="inline" bordered size="small" style="text-align: left">
                <a-descriptions-item label="节点状态">{{ testResult.status || '-' }}</a-descriptions-item>
                <a-descriptions-item label="操作系统">{{ testResult.os_type || '-' }}</a-descriptions-item>
                <a-descriptions-item label="当前负载">{{ testResult.current_load || 0 }} / {{ testResult.max_concurrency || 1 }}</a-descriptions-item>
                <a-descriptions-item v-if="testResult.jmeter_version" label="JMeter版本">{{ testResult.jmeter_version }}</a-descriptions-item>
                <a-descriptions-item v-if="testResult.agent_version" label="Agent版本">{{ testResult.agent_version }}</a-descriptions-item>
                <a-descriptions-item v-if="testResult.cached_files_count !== undefined" label="缓存文件数">{{ testResult.cached_files_count }}</a-descriptions-item>
                <a-descriptions-item v-if="testResult.cache_size_mb !== undefined" label="缓存大小">{{ (testResult.cache_size_mb || 0).toFixed(2) }} MB</a-descriptions-item>
                <a-descriptions-item v-if="testResult.jmeter_home !== undefined" label="JMeter目录">
                  <a-tag :color="testResult.jmeter_ok ? 'green' : 'red'" size="small">{{ testResult.jmeter_ok ? '正常' : '未找到' }}</a-tag>
                  <span style="margin-left: 8px; font-size: 12px; color: #999">{{ testResult.jmeter_home || '-' }}</span>
                </a-descriptions-item>
                <a-descriptions-item v-if="testResult.jmeter_bin_path" label="JMeter可执行">
                  <span style="font-size: 12px; color: #999">{{ testResult.jmeter_bin_path }}</span>
                </a-descriptions-item>
                <a-descriptions-item v-if="testResult.java_home !== undefined" label="Java环境">
                  <a-tag :color="testResult.java_ok ? 'green' : 'red'" size="small">{{ testResult.java_ok ? '正常' : '未找到' }}</a-tag>
                  <span style="margin-left: 8px; font-size: 12px; color: #999">{{ testResult.java_home || '(系统默认)' }}</span>
                </a-descriptions-item>
                <a-descriptions-item v-if="testResult.work_dir !== undefined" label="工作目录">
                  <a-tag :color="testResult.work_dir_ok ? 'green' : 'orange'" size="small">{{ testResult.work_dir_ok ? '已创建' : '待创建' }}</a-tag>
                  <span style="margin-left: 8px; font-size: 12px; color: #999">{{ testResult.work_dir || '-' }}</span>
                </a-descriptions-item>
                <a-descriptions-item v-if="testResult.error" label="错误信息">{{ testResult.error }}</a-descriptions-item>
              </a-descriptions>
            </template>
          </a-result>
        </div>
      </a-spin>
    </a-modal>
  </div>
</template>

<style scoped>
.perf-load-node { padding: 0; }
</style>
