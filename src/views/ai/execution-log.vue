<script lang="ts" setup>
import { computed, ref } from 'vue'
import { Message, Modal } from '@arco-design/web-vue'
import { useGet, usePost } from '@/hooks'
import { ApiAiExecution, type AiExecution, type AiExecutionStats, type AiListResult } from '@/api/aiApis'

defineOptions({ name: 'ai-execution-log' })

// ── 统计数据 ──────────────────────────────────
const { data: statsRaw } = useGet<AiExecutionStats>(ApiAiExecution.stats, {}, { immediate: true })
const stats = computed(() => statsRaw.value || { total: 0, succeeded: 0, failed: 0, running: 0, success_rate: 0, avg_duration_ms: 0 })

// ── 列表数据 ──────────────────────────────────
const queryParams = ref({ agent_id: '', skill_id: '', caller_module: '', status: '', start_time: '', end_time: '', page_num: 1, page_size: 10 })
const dateRange = ref<string[] | undefined>(undefined)
const { isFetching: loading, data: listRaw, execute: fetchList } = useGet<AiListResult<AiExecution>>(
  ApiAiExecution.getList,
  queryParams,
  { immediate: true },
)
const list = computed(() => listRaw.value?.list || [])
const total = computed(() => listRaw.value?.total || 0)

function handleSearch() {
  queryParams.value.page_num = 1
  // 处理日期范围
  if (dateRange.value && dateRange.value.length === 2) {
    queryParams.value.start_time = dateRange.value[0] || ''
    queryParams.value.end_time = dateRange.value[1] || ''
  } else {
    queryParams.value.start_time = ''
    queryParams.value.end_time = ''
  }
  fetchList()
}
function handlePageChange(page: number) { queryParams.value.page_num = page; fetchList() }

// ── 批量删除（清理等待中的僵尸队列）──────────────────
const selectedKeys = ref<string[]>([])
const deleting = ref(false)

/** 删除勾选的记录（后端排除 running，避免删掉正在执行的） */
async function deleteSelected() {
  if (selectedKeys.value.length === 0) {
    Message.warning('请先勾选要删除的记录')
    return
  }
  Modal.warning({
    title: '确认删除选中的执行记录？',
    content: `将删除 ${selectedKeys.value.length} 条记录（正在运行的记录会被自动跳过）。此操作不可恢复。`,
    okText: '确认删除',
    cancelText: '取消',
    okButtonProps: { status: 'danger' },
    onOk: async () => {
      await doDelete({ ids: selectedKeys.value })
    },
  })
}

/** 按当前查询条件删除所有「等待中」记录（后端强制仅删 pending，需至少一个查询条件） */
async function deleteAllMatching() {
  const f = {
    caller_module: queryParams.value.caller_module,
    status: queryParams.value.status,
    start_time: queryParams.value.start_time,
    end_time: queryParams.value.end_time,
    agent_id: queryParams.value.agent_id,
    skill_id: queryParams.value.skill_id,
  }
  const hasFilter = Object.values(f).some(v => v && v !== '')
  if (!hasFilter) {
    Message.warning('按条件删除需至少设置一个查询条件（如状态=等待中），避免误删全部')
    return
  }
  Modal.warning({
    title: '确认按当前查询条件删除？',
    content: '将删除符合当前查询条件的所有「等待中(pending)」记录（其它状态不受影响）。此操作不可恢复。',
    okText: '确认删除',
    cancelText: '取消',
    okButtonProps: { status: 'danger' },
    onOk: async () => {
      await doDelete({ filter: f })
    },
  })
}

async function doDelete(payload: Record<string, unknown>) {
  deleting.value = true
  try {
    const { data, execute, error } = usePost<{ deleted: number, message?: string }>(
      ApiAiExecution.batchDelete,
      payload,
      { immediate: false },
    )
    await execute()
    if (error.value) {
      Message.error('删除失败')
      return
    }
    if (data.value) {
      Message.success(data.value.message || `已删除 ${data.value.deleted} 条`)
      selectedKeys.value = []
      fetchList()
    }
  }
  finally {
    deleting.value = false
  }
}

// ── 详情抽屉 ──────────────────────────────────
const drawerVisible = ref(false)
const detail = ref<AiExecution | null>(null)

function showDetail(record: AiExecution) {
  detail.value = record
  drawerVisible.value = true
}

function formatJson(jsonStr: string | null): string {
  if (!jsonStr) return '-'
  try {
    return JSON.stringify(JSON.parse(jsonStr), null, 2)
  } catch {
    return jsonStr
  }
}

function statusColor(status: string) {
  const map: Record<string, string> = { succeeded: 'green', failed: 'red', timeout: 'orangered', running: 'blue', pending: 'gray', cancelled: 'orange' }
  return map[status] || 'gray'
}

// ── 表格列 ──────────────────────────────────
const columns = [
  { title: 'ID', dataIndex: 'id', width: 200, ellipsis: true, tooltip: true },
  { title: '调用人', dataIndex: 'created_by', width: 100 },
  { title: '调用模块', dataIndex: 'caller_module', width: 100 },
  { title: '状态', dataIndex: 'status', width: 90, slotName: 'status' },
  { title: '耗时(ms)', dataIndex: 'duration_ms', width: 90 },
  { title: 'Exit Code', dataIndex: 'exit_code', width: 80 },
  { title: '创建时间', dataIndex: 'created_at', width: 170 },
  { title: '操作', dataIndex: 'operations', slotName: 'operations', width: 80, fixed: 'right' as const },
]
</script>

<template>
  <div class="ai-execution-log">
    <!-- 统计卡片 -->
    <a-card :bordered="false" class="m-b-8px">
      <a-row :gutter="16">
        <a-col :span="4"><a-statistic title="总执行次数" :value="stats.total" /></a-col>
        <a-col :span="4"><a-statistic title="成功" :value="stats.succeeded" /></a-col>
        <a-col :span="4"><a-statistic title="失败" :value="stats.failed" /></a-col>
        <a-col :span="4"><a-statistic title="运行中" :value="stats.running" /></a-col>
        <a-col :span="4"><a-statistic title="成功率" :value="stats.success_rate" :precision="1" suffix="%" /></a-col>
        <a-col :span="4"><a-statistic title="平均耗时" :value="Math.round(stats.avg_duration_ms)" suffix="ms" /></a-col>
      </a-row>
    </a-card>

    <!-- 查询区 -->
    <a-card :bordered="false" class="m-b-8px">
      <a-row :gutter="16" align="center">
        <a-col :span="4">
          <a-input v-model="queryParams.caller_module" placeholder="调用模块" allow-clear @press-enter="handleSearch" />
        </a-col>
        <a-col :span="4">
          <a-select v-model="queryParams.status" placeholder="状态" allow-clear @change="handleSearch">
            <a-option value="pending">等待中</a-option>
            <a-option value="running">运行中</a-option>
            <a-option value="succeeded">成功</a-option>
            <a-option value="failed">失败</a-option>
            <a-option value="timeout">超时</a-option>
            <a-option value="cancelled">已取消</a-option>
          </a-select>
        </a-col>
        <a-col :span="6">
          <a-range-picker v-model="dateRange" show-time format="YYYY-MM-DD HH:mm:ss" value-format="YYYY-MM-DD HH:mm:ss" @change="handleSearch" />
        </a-col>
        <a-col :span="4">
          <a-button type="primary" @click="handleSearch">搜索</a-button>
        </a-col>
        <a-col :span="6">
          <a-space>
            <a-button status="danger" :loading="deleting" :disabled="selectedKeys.length === 0" @click="deleteSelected">
              删除选中{{ selectedKeys.length ? `(${selectedKeys.length})` : '' }}
            </a-button>
            <a-button status="danger" :loading="deleting" @click="deleteAllMatching">
              按条件删除等待中
            </a-button>
          </a-space>
        </a-col>
      </a-row>
    </a-card>

    <!-- 表格 -->
    <a-card :bordered="false">
      <a-table
        :loading="loading"
        :data="list"
        :columns="columns"
        row-key="id"
        v-model:selectedKeys="selectedKeys"
        :row-selection="{ type: 'checkbox', showCheckedAll: true }"
        :pagination="{ total, current: queryParams.page_num, pageSize: queryParams.page_size, showTotal: true }"
        @page-change="handlePageChange"
        :scroll="{ x: 900 }"
      >
        <template #status="{ record }">
          <a-tag :color="statusColor(record.status)">{{ record.status }}</a-tag>
        </template>
        <template #operations="{ record }">
          <a-button type="text" size="small" @click="showDetail(record)">详情</a-button>
        </template>
      </a-table>
    </a-card>

    <!-- 详情抽屉 -->
    <a-drawer v-model:visible="drawerVisible" title="执行详情" :width="680" :footer="false">
      <template v-if="detail">
        <a-descriptions :column="2" bordered size="small" class="m-b-16px">
          <a-descriptions-item label="执行 ID">{{ detail.id }}</a-descriptions-item>
          <a-descriptions-item label="状态"><a-tag :color="statusColor(detail.status)">{{ detail.status }}</a-tag></a-descriptions-item>
          <a-descriptions-item label="调用模块">{{ detail.caller_module }}</a-descriptions-item>
          <a-descriptions-item label="调用方 ID">{{ detail.caller_id || '-' }}</a-descriptions-item>
          <a-descriptions-item label="耗时">{{ detail.duration_ms ? `${detail.duration_ms}ms` : '-' }}</a-descriptions-item>
          <a-descriptions-item label="Exit Code">{{ detail.exit_code ?? '-' }}</a-descriptions-item>
          <a-descriptions-item label="工作目录" :span="2">{{ detail.work_dir || '-' }}</a-descriptions-item>
          <a-descriptions-item label="Session ID" :span="2">{{ detail.session_id || '-' }}</a-descriptions-item>
          <a-descriptions-item label="创建时间">{{ detail.created_at }}</a-descriptions-item>
          <a-descriptions-item label="完成时间">{{ detail.finished_at || '-' }}</a-descriptions-item>
        </a-descriptions>

        <a-collapse :default-active-key="['prompt', 'output']">
          <a-collapse-item header="渲染后的 Prompt" key="prompt">
            <pre class="detail-pre">{{ detail.rendered_prompt || '-' }}</pre>
          </a-collapse-item>
          <a-collapse-item header="执行命令" key="command">
            <pre class="detail-pre">{{ detail.raw_command || '-' }}</pre>
          </a-collapse-item>
          <a-collapse-item header="输出结果 (JSON)" key="output">
            <pre class="detail-pre">{{ formatJson(detail.output_json) }}</pre>
          </a-collapse-item>
          <a-collapse-item header="产出文件" key="files">
            <pre class="detail-pre">{{ formatJson(detail.output_files_json) }}</pre>
          </a-collapse-item>
          <a-collapse-item v-if="detail.error_message" header="错误信息" key="error">
            <pre class="detail-pre error-text">{{ detail.error_message }}</pre>
          </a-collapse-item>
        </a-collapse>
      </template>
    </a-drawer>
  </div>
</template>

<style scoped>
.ai-execution-log { padding: 0; }
.detail-pre { max-height: 300px; overflow: auto; font-size: 12px; white-space: pre-wrap; word-break: break-all; background: var(--color-fill-1); padding: 12px; border-radius: 4px; }
.error-text { color: rgb(var(--red-6)); }
</style>
