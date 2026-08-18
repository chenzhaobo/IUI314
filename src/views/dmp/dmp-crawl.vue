<script lang="ts" setup>
import { computed, onUnmounted, ref } from 'vue'
import { Message, Modal } from '@arco-design/web-vue'
import { ErrorFlag } from '@/api/apis'
import {
  ApiDmp,
  type DmpBatchBrief,
  type DmpCrawlBatch,
  type DmpCrawlData,
  type DmpCrawlTask,
  type DmpListResult,
  type DmpTokenStatus,
} from '@/api/dmpApis'
import { useGet, usePost, usePut } from '@/hooks'

defineOptions({ name: 'dmp-crawl' })

function requestFailed(data: { value: unknown }, error: { value: unknown }) {
  return Boolean(error.value) || data.value === ErrorFlag
}

// ═══════════════════════════════════════════════════════════
//  Token 状态
// ═══════════════════════════════════════════════════════════
const { data: tokenStatusRaw, execute: loadTokenStatus } = useGet<DmpTokenStatus>(
  ApiDmp.tokenStatus,
  undefined,
  { immediate: true },
)
const tokenStatus = computed(() => tokenStatusRaw.value || null)

// ── 更新 Token 弹框 ──────────────────────────────────
const tokenModalVisible = ref(false)
const tokenInput = ref('')
const savePayload = ref({ token: '' })
const { isFetching: saving, execute: saveTokenExec, data: saveData, error: saveError } = usePost(
  ApiDmp.tokenSave,
  savePayload,
)

function openTokenModal() {
  tokenInput.value = ''
  tokenModalVisible.value = true
}

async function handleSaveToken() {
  const token = tokenInput.value.trim()
  if (!token) {
    Message.warning('请填写 Token')
    return
  }
  savePayload.value = { token }
  await saveTokenExec()
  if (requestFailed(saveData, saveError)) return
  Message.success('Token 保存成功')
  tokenModalVisible.value = false
  loadTokenStatus()
}

// ═══════════════════════════════════════════════════════════
//  任务列表
// ═══════════════════════════════════════════════════════════
const { data: taskListRaw, execute: loadTasks, isFetching: taskLoading } = useGet<DmpCrawlTask[]>(
  ApiDmp.taskList,
  undefined,
  { immediate: true },
)
const taskList = computed(() => taskListRaw.value || [])

const taskColumns = [
  { title: '任务名称', dataIndex: 'name', width: 140 },
  { title: '目标标识', dataIndex: 'target_key', width: 130, ellipsis: true, tooltip: true },
  { title: '菜单路径', dataIndex: 'menu_path_display', width: 220, ellipsis: true, tooltip: true, slotName: 'menu_path' },
  { title: '同步模式', dataIndex: 'sync_mode', width: 80, slotName: 'sync_mode' },
  { title: 'ETL', dataIndex: 'etl_enabled', width: 100, slotName: 'etl_status' },
  { title: '定时', dataIndex: 'schedule_enabled', width: 80, slotName: 'schedule' },
  { title: '状态', dataIndex: 'status', width: 70, slotName: 'task_status' },
  { title: '操作', dataIndex: 'ops', slotName: 'task_ops', width: 200, fixed: 'right' as const },
]

function getMenuPath(record: DmpCrawlTask): string {
  const parts = [record.cloud, record.app, record.menu1, record.menu2].filter(Boolean)
  return parts.join(' / ')
}

// ── 手动触发 ──────────────────────────────────
const triggerPayload = ref({ task_id: '' })
const { execute: triggerExec, data: triggerData, error: triggerError } = usePost<string>(ApiDmp.taskTrigger, triggerPayload)

async function handleTrigger(task: DmpCrawlTask) {
  if (!tokenStatus.value?.configured) {
    Message.warning('尚未配置 Token，请先更新 Token')
    openTokenModal()
    return
  }
  triggerPayload.value = { task_id: task.id }
  await triggerExec()
  if (requestFailed(triggerData, triggerError)) return
  const batchId = String(triggerData.value || '')
  Message.success(`「${task.name}」爬取已启动`)
  if (batchId) startPolling(batchId)
  getBatches()
}

// ── 编辑调度 ──────────────────────────────────
const editModalVisible = ref(false)
const editPayload = ref<Record<string, unknown>>({ id: '', schedule_enabled: '0', schedule_type: 'daily' })
const { isFetching: editSaving, execute: editExec, data: editData, error: editError } = usePut(ApiDmp.taskEdit, editPayload)
const editingTask = ref<DmpCrawlTask | null>(null)

function openEditModal(task: DmpCrawlTask) {
  editingTask.value = task
  editPayload.value = {
    id: task.id,
    schedule_enabled: task.schedule_enabled,
    schedule_type: task.schedule_type || 'daily',
    target_table: task.target_table || '',
    upsert_key: task.upsert_key || '',
    field_mapping: task.field_mapping ? JSON.stringify(task.field_mapping, null, 2) : '',
    filter_config: task.filter_config ? JSON.stringify(task.filter_config, null, 2) : '',
  }
  editModalVisible.value = true
}

async function handleEditSave() {
  const payload: Record<string, unknown> = { ...editPayload.value }
  if (typeof payload.field_mapping === 'string' && payload.field_mapping) {
    try { payload.field_mapping = JSON.parse(payload.field_mapping as string) } catch { Message.error('field_mapping JSON 格式错误'); return }
  } else { delete payload.field_mapping }
  if (typeof payload.filter_config === 'string' && payload.filter_config) {
    try { payload.filter_config = JSON.parse(payload.filter_config as string) } catch { Message.error('filter_config JSON 格式错误'); return }
  } else { delete payload.filter_config }
  if (!payload.target_table) delete payload.target_table
  if (!payload.upsert_key) delete payload.upsert_key
  editPayload.value = payload
  await editExec()
  if (requestFailed(editData, editError)) return
  Message.success('任务配置已更新')
  editModalVisible.value = false
  loadTasks()
}

// ── 新增任务 ──────────────────────────────────
const addModalVisible = ref(false)
const addPayload = ref<Record<string, unknown>>({
  target_key: '', name: '', cloud: '', app: '', menu1: '', menu2: '',
  sync_mode: 'full', target_table: '', upsert_key: '', field_mapping: '',
})
const { isFetching: addSaving, execute: addExec, data: addData, error: addError } = usePost(ApiDmp.taskAdd, addPayload)

function openAddModal() {
  addPayload.value = {
    target_key: '', name: '', cloud: '', app: '', menu1: '', menu2: '',
    sync_mode: 'full', target_table: '', upsert_key: '', field_mapping: '',
  }
  addModalVisible.value = true
}

async function handleAddSave() {
  const p = addPayload.value
  if (!p.target_key || !p.name || !p.cloud || !p.app) {
    Message.warning('请填写必填字段（目标标识、名称、云、应用）')
    return
  }
  const payload: Record<string, unknown> = { ...p }
  if (typeof payload.field_mapping === 'string' && payload.field_mapping) {
    try { payload.field_mapping = JSON.parse(payload.field_mapping as string) } catch { Message.error('field_mapping JSON 格式错误'); return }
  } else { delete payload.field_mapping }
  if (!payload.target_table) delete payload.target_table
  if (!payload.upsert_key) delete payload.upsert_key
  if (!payload.menu1) delete payload.menu1
  if (!payload.menu2) delete payload.menu2
  addPayload.value = payload
  await addExec()
  if (requestFailed(addData, addError)) return
  Message.success('任务创建成功')
  addModalVisible.value = false
  loadTasks()
}

// ── 删除任务 ──────────────────────────────────
const deletePayload = ref({ id: '' })
const { execute: deleteExec, data: deleteData, error: deleteError } = usePost(ApiDmp.taskDelete, deletePayload)

function handleDelete(task: DmpCrawlTask) {
  Modal.warning({
    title: '确认删除',
    content: `确定要删除任务「${task.name}」吗？此操作不可恢复。`,
    hideCancel: false,
    okText: '删除',
    onOk: async () => {
      deletePayload.value = { id: task.id }
      await deleteExec()
      if (requestFailed(deleteData, deleteError)) return
      Message.success('任务已删除')
      loadTasks()
    },
  })
}

// ═══════════════════════════════════════════════════════════
//  爬取批次列表
// ═══════════════════════════════════════════════════════════
const batchQuery = ref({ page_num: 1, page_size: 10 })
const {
  isFetching: batchLoading,
  data: batchRaw,
  execute: getBatches,
} = useGet<DmpListResult<DmpCrawlBatch>>(ApiDmp.crawlBatches, batchQuery, { immediate: true })

const batchList = computed(() => batchRaw.value?.list || [])
const batchTotal = computed(() => batchRaw.value?.total || 0)

function handleBatchPageChange(page: number) {
  batchQuery.value.page_num = page
  getBatches()
}

const batchColumns = [
  { title: '批次ID', dataIndex: 'id', width: 180, ellipsis: true, tooltip: true },
  { title: '菜单路径', dataIndex: 'menu_path', width: 240, ellipsis: true, tooltip: true },
  { title: '状态', dataIndex: 'status', width: 90, slotName: 'status' },
  { title: '数据量', dataIndex: 'total_count', width: 80, align: 'right' as const },
  { title: '错误信息', dataIndex: 'error_msg', width: 200, ellipsis: true, tooltip: true },
  { title: '创建时间', dataIndex: 'created_at', width: 160, slotName: 'created_at' },
  { title: '操作', dataIndex: 'operations', slotName: 'operations', width: 90, fixed: 'right' as const },
]

const statusMap: Record<string, { label: string, color: string }> = {
  running: { label: '爬取中', color: 'blue' },
  success: { label: '成功', color: 'green' },
  failed: { label: '失败', color: 'red' },
}

// ═══════════════════════════════════════════════════════════
//  状态轮询
// ═══════════════════════════════════════════════════════════
const statusQuery = ref({ batch_id: '' })
const { data: statusRaw, execute: pollStatusExec } = useGet<DmpBatchBrief>(ApiDmp.crawlStatus, statusQuery)

let pollTimer: ReturnType<typeof setInterval> | null = null

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function startPolling(batchId: string) {
  stopPolling()
  statusQuery.value.batch_id = batchId
  pollTimer = setInterval(async () => {
    await pollStatusExec()
    const brief = statusRaw.value
    if (brief && brief.status !== 'running') {
      stopPolling()
      getBatches()
      if (brief.status === 'success') {
        Message.success(`爬取完成，共 ${brief.total_count} 条数据`)
      } else {
        Message.error(`爬取失败：${brief.error_msg || '未知错误'}`)
      }
    }
  }, 2000)
}

onUnmounted(stopPolling)

// ═══════════════════════════════════════════════════════════
//  批次数据查看（抽屉）
// ═══════════════════════════════════════════════════════════
const dataDrawerVisible = ref(false)
const dataQuery = ref({ batch_id: '', page_num: 1, page_size: 20 })
const {
  isFetching: dataLoading,
  data: dataRaw,
  execute: getBatchData,
} = useGet<DmpListResult<DmpCrawlData>>(ApiDmp.crawlData, dataQuery)

const dataList = computed(() => dataRaw.value?.list || [])
const dataTotal = computed(() => dataRaw.value?.total || 0)

const dataColumnKeys = computed(() => {
  const list = dataList.value
  if (!list.length) return []
  const first = list[0].raw_json || {}
  return Object.keys(first).filter(k => k !== '_raw').slice(0, 10)
})
const dataColumns = computed(() => [
  ...dataColumnKeys.value.map(k => ({
    title: k,
    dataIndex: k,
    slotName: k,
    ellipsis: true,
    tooltip: true,
  })),
  { title: '操作', dataIndex: 'ops', slotName: 'rowOps', width: 80, fixed: 'right' as const },
])

const isFallbackData = computed(() => {
  const list = dataList.value
  return list.length > 0 && Object.prototype.hasOwnProperty.call(list[0].raw_json || {}, '_raw')
})

function handleViewData(record: DmpCrawlBatch) {
  dataQuery.value = { batch_id: record.id, page_num: 1, page_size: 20 }
  dataDrawerVisible.value = true
  getBatchData()
}

function handleDataPageChange(page: number) {
  dataQuery.value.page_num = page
  getBatchData()
}

// ── 行详情 ──────────────────────────────────
const rowDetailVisible = ref(false)
const rowDetailJson = ref('')
function handleRowDetail(record: DmpCrawlData) {
  rowDetailJson.value = JSON.stringify(record.raw_json, null, 2)
  rowDetailVisible.value = true
}

// ═══════════════════════════════════════════════════════════
//  工具函数
// ═══════════════════════════════════════════════════════════
function formatTime(time: string | null) {
  if (!time) return '-'
  return time.replace('T', ' ').substring(0, 19)
}

function formatCell(val: unknown): string {
  if (val === null || val === undefined) return '-'
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}
</script>

<template>
  <div class="dmp-crawl">
    <!-- Token 状态 -->
    <a-card :bordered="false" class="m-b-8px">
      <a-space size="large" wrap>
        <div>
          <span class="label">Token：</span>
          <a-tag v-if="tokenStatus?.configured" :color="tokenStatus.status === '1' ? 'green' : 'orange'" size="small">
            {{ tokenStatus.masked_token || '已配置' }}
          </a-tag>
          <a-tag v-else color="gray" size="small">未配置</a-tag>
        </div>
        <div v-if="tokenStatus?.configured">
          <span class="label">更新：</span>
          <span>{{ formatTime(tokenStatus.updated_at) }}</span>
        </div>
        <a-button size="small" @click="openTokenModal">更新 Token</a-button>
      </a-space>
    </a-card>

    <!-- 任务列表 -->
    <a-card :bordered="false" title="爬取任务" class="m-b-8px">
      <template #extra>
        <a-space>
          <a-button size="small" type="primary" @click="openAddModal">新增任务</a-button>
          <a-button size="small" @click="() => loadTasks()">刷新</a-button>
        </a-space>
      </template>
      <a-table
        :loading="taskLoading"
        :data="taskList"
        :columns="taskColumns"
        :pagination="false"
        row-key="id"
        size="small"
      >
        <template #menu_path="{ record }">{{ getMenuPath(record) }}</template>
        <template #sync_mode="{ record }">
          <a-tag :color="record.sync_mode === 'incremental' ? 'orange' : 'blue'" size="small">
            {{ record.sync_mode === 'incremental' ? '增量' : '全量' }}
          </a-tag>
        </template>
        <template #etl_status="{ record }">
          <a-tag v-if="record.etl_enabled === '1'" color="green" size="small">{{ record.target_table || 'ETL' }}</a-tag>
          <a-tag v-else color="gray" size="small">关</a-tag>
        </template>
        <template #schedule="{ record }">
          <a-tag :color="record.schedule_enabled === '1' ? 'green' : 'gray'" size="small">
            {{ record.schedule_enabled === '1' ? (record.schedule_type || 'daily') : '关' }}
          </a-tag>
        </template>
        <template #task_status="{ record }">
          <a-tag :color="record.status === '1' ? 'green' : 'red'" size="small">
            {{ record.status === '1' ? '启用' : '停用' }}
          </a-tag>
        </template>
        <template #task_ops="{ record }">
          <a-space>
            <a-button type="primary" size="mini" @click="handleTrigger(record)">
              <template #icon><icon-play-arrow /></template>
              执行
            </a-button>
            <a-button size="mini" @click="openEditModal(record)">配置</a-button>
            <a-button size="mini" status="danger" :disabled="record.is_preset === '1'" @click="handleDelete(record)">删除</a-button>
          </a-space>
        </template>
      </a-table>
    </a-card>

    <!-- 爬取批次 -->
    <a-card :bordered="false" title="执行记录">
      <template #extra>
        <a-button size="small" @click="() => getBatches()">刷新</a-button>
      </template>
      <a-table
        :loading="batchLoading"
        :data="batchList"
        :columns="batchColumns"
        :pagination="{ total: batchTotal, current: batchQuery.page_num, pageSize: batchQuery.page_size, showTotal: true }"
        row-key="id"
        size="small"
        @page-change="handleBatchPageChange"
      >
        <template #status="{ record }">
          <a-tag :color="statusMap[record.status]?.color || 'gray'" size="small">
            {{ statusMap[record.status]?.label || record.status }}
          </a-tag>
        </template>
        <template #created_at="{ record }">{{ formatTime(record.created_at) }}</template>
        <template #operations="{ record }">
          <a-button type="text" size="small" :disabled="record.status !== 'success'" @click="handleViewData(record)">
            查看数据
          </a-button>
        </template>
      </a-table>
    </a-card>

    <!-- 更新 Token 弹框 -->
    <a-modal v-model:visible="tokenModalVisible" title="更新 DMP Token" :ok-loading="saving" @ok="handleSaveToken">
      <a-alert type="info" class="m-b-12px">
        Token 为云之家 CloudHub 的 opentoken（32位），保存时加密存储。
      </a-alert>
      <a-input-password v-model="tokenInput" placeholder="请粘贴 opentoken" allow-clear @press-enter="handleSaveToken" />
    </a-modal>

    <!-- 任务配置弹框 -->
    <a-modal v-model:visible="editModalVisible" title="任务配置" :ok-loading="editSaving" :width="600" @ok="handleEditSave">
      <a-form layout="vertical">
        <a-form-item label="任务">
          <a-input :model-value="editingTask?.name" disabled />
        </a-form-item>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="启用定时">
              <a-switch
                :model-value="editPayload.schedule_enabled === '1'"
                @change="(v: boolean | (string | number)[]) => editPayload.schedule_enabled = v ? '1' : '0'"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="调度周期">
              <a-select v-model="editPayload.schedule_type">
                <a-option value="hourly">每小时</a-option>
                <a-option value="daily">每天</a-option>
                <a-option value="weekly">每周</a-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="目标表 (target_table)">
              <a-input v-model="editPayload.target_table" placeholder="如 sec_project_group" allow-clear />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="去重键 (upsert_key)">
              <a-input v-model="editPayload.upsert_key" placeholder="如 code" allow-clear />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="字段映射 (field_mapping JSON)">
          <a-textarea v-model="editPayload.field_mapping" :auto-size="{ minRows: 3, maxRows: 8 }" placeholder='{"苍穹字段":"本地列名"}' />
        </a-form-item>
        <a-form-item label="过滤配置 (filter_config JSON)">
          <a-textarea v-model="editPayload.filter_config" :auto-size="{ minRows: 2, maxRows: 5 }" placeholder="可选" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 新增任务弹框 -->
    <a-modal v-model:visible="addModalVisible" title="新增爬取任务" :ok-loading="addSaving" :width="600" @ok="handleAddSave">
      <a-form layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="目标标识 *">
              <a-input v-model="addPayload.target_key" placeholder="唯一标识，如 ticket_detail" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="任务名称 *">
              <a-input v-model="addPayload.name" placeholder="显示名称" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="云 *">
              <a-input v-model="addPayload.cloud" placeholder="如 DEVOPS云" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="应用 *">
              <a-input v-model="addPayload.app" placeholder="如 质量管理" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="一级菜单">
              <a-input v-model="addPayload.menu1" placeholder="如 质量看板" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="二级菜单">
              <a-input v-model="addPayload.menu2" placeholder="如 提单详细数据" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item label="同步模式">
              <a-select v-model="addPayload.sync_mode">
                <a-option value="full">全量</a-option>
                <a-option value="incremental">增量</a-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="目标表">
              <a-input v-model="addPayload.target_table" placeholder="可选" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="去重键">
              <a-input v-model="addPayload.upsert_key" placeholder="可选" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="字段映射 (field_mapping JSON)">
          <a-textarea v-model="addPayload.field_mapping" :auto-size="{ minRows: 3, maxRows: 8 }" placeholder='{"苍穹字段":"本地列名"}' />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 批次数据抽屉 -->
    <a-drawer v-model:visible="dataDrawerVisible" title="爬取数据详情" :width="900" unmount-on-close>
      <a-alert v-if="isFallbackData" type="warning" class="m-b-12px">
        未能自动识别列表结构，以下为原始响应数据。
      </a-alert>
      <a-table
        :loading="dataLoading"
        :data="dataList"
        :columns="dataColumns"
        :pagination="{ total: dataTotal, current: dataQuery.page_num, pageSize: dataQuery.page_size, showTotal: true }"
        row-key="id"
        size="small"
        @page-change="handleDataPageChange"
      >
        <template v-for="col in dataColumnKeys" :key="col" #[col]="{ record }">
          <span>{{ formatCell(record.raw_json?.[col]) }}</span>
        </template>
        <template #rowOps="{ record }">
          <a-button type="text" size="small" @click="handleRowDetail(record)">详情</a-button>
        </template>
      </a-table>
    </a-drawer>

    <!-- 行详情 JSON 抽屉 -->
    <a-drawer v-model:visible="rowDetailVisible" title="数据行详情（原始 JSON）" :width="640" unmount-on-close>
      <pre class="json-content">{{ rowDetailJson }}</pre>
    </a-drawer>
  </div>
</template>

<style scoped>
.dmp-crawl {
  padding: 0;
}
.label {
  color: var(--color-text-3);
  font-size: 13px;
}
.json-content {
  background: var(--color-fill-2);
  padding: 12px;
  border-radius: 4px;
  max-height: 600px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
  font-size: 13px;
}
</style>
