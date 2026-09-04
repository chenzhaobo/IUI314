<template>
  <div class="page-container">
    <a-card title="同步任务管理" :bordered="false">
      <template #extra>
        <a-button type="primary" @click="openAddModal">新增同步任务</a-button>
      </template>

      <!-- 任务列表 -->
      <a-table :data="taskList" :loading="loading" :pagination="pagination" @page-change="handlePageChange" row-key="id">
        <template #columns>
          <a-table-column title="任务名称" :width="220">
            <template #cell="{ record }">
              <span>{{ record.name }}</span>
              <a-tag v-if="record.is_preset === '1'" color="arcoblue" size="small" style="margin-left: 6px">预置</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="产品线" :width="90">
            <template #cell="{ record }">
              <a-tag :color="record.product_line === '星空' ? 'purple' : 'blue'" size="small">{{ record.product_line || '星瀚' }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="查询条件" ellipsis>
            <template #cell="{ record }">{{ formatCondition(record) }}</template>
          </a-table-column>
          <a-table-column title="查询字段" :width="100">
            <template #cell="{ record }">
              <a-tooltip :content="formatFields(record.query_fields)">
                <span>{{ countFields(record.query_fields) }}维</span>
              </a-tooltip>
            </template>
          </a-table-column>
          <a-table-column title="定时" :width="140">
            <template #cell="{ record }">
              <span v-if="record.schedule_enabled === '1'">{{ formatSchedule(record) }}</span>
              <span v-else style="color: #999">关闭</span>
            </template>
          </a-table-column>
          <a-table-column title="状态" :width="80">
            <template #cell="{ record }">
              <a-tag :color="record.status === '1' ? 'green' : 'red'" size="small">{{ record.status === '1' ? '启用' : '停用' }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="操作" :width="220" fixed="right">
            <template #cell="{ record }">
              <a-space>
                <a-link @click="handleTrigger(record)">执行</a-link>
                <a-link @click="openEditModal(record)">编辑</a-link>
                <a-link @click="openRecords(record)">记录</a-link>
                <a-popconfirm v-if="record.is_preset !== '1'" content="确认删除该任务？" @ok="handleDelete(record)">
                  <a-link status="danger">删除</a-link>
                </a-popconfirm>
              </a-space>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </a-card>

    <!-- 新增/编辑弹框 -->
    <a-modal v-model:visible="modalVisible" :title="isEdit ? '编辑同步任务' : '新增同步任务'" :width="620" @ok="handleSave" :ok-loading="saving">
      <a-form :model="form" layout="vertical">
        <a-form-item label="任务名称" required>
          <a-input v-model="form.name" placeholder="如: 星瀚-共享-本周" />
        </a-form-item>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="产品线">
              <a-select v-model="form.product_line">
                <a-option value="星瀚">星瀚</a-option>
                <a-option value="星空">星空</a-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="时间范围">
              <a-select v-model="form.time_type">
                <a-option value="yesterday">昨天</a-option>
                <a-option value="last_7_days">近7天</a-option>
                <a-option value="this_week">本周</a-option>
                <a-option value="last_week">上周</a-option>
                <a-option value="this_month">本月</a-option>
                <a-option value="last_month">上月</a-option>
                <a-option value="this_year">今年至今(1月~最新)</a-option>
                <a-option value="custom">自定义</a-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
        <a-row v-if="form.time_type === 'custom'" :gutter="16">
          <a-col :span="12">
            <a-form-item label="开始日期">
              <a-date-picker v-model="form.period_start" value-format="YYYY-MM-DD" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="结束日期">
              <a-date-picker v-model="form.period_end" value-format="YYYY-MM-DD" style="width: 100%" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="产品领域">
              <a-select v-model="form.product_domain" allow-clear placeholder="全部" @change="onProductDomainChange">
                <a-option v-for="o in domainOptions" :key="o.code" :value="o.code">{{ o.name }}</a-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="业务领域">
              <a-select v-model="form.business_area" allow-clear placeholder="全部" @change="onBusinessAreaChange">
                <a-option v-for="o in areaOptions" :key="o.code" :value="o.code">{{ o.name }}</a-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="项目组">
              <a-select v-model="form.project_group_code" allow-clear placeholder="全部" @change="onPgChange">
                <a-option v-for="o in pgOptions" :key="o.code" :value="o.code">{{ o.name }}</a-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="应用">
              <a-select v-model="form.app_numbers" multiple allow-clear allow-search placeholder="全部">
                <a-option v-for="o in appOptions" :key="o.code" :value="o.code">{{ o.name }} ({{ o.code }})</a-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="查询字段 (固定6维)">
          <a-input model-value="cloud_name, cloud_number, app_name, app_number, form_id, control_name" disabled />
        </a-form-item>
        <a-divider orientation="left">定时调度</a-divider>
        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item label="定时开关">
              <a-switch v-model="scheduleOn" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item v-if="scheduleOn" label="频率">
              <a-select v-model="form.schedule_type">
                <a-option value="daily">每天</a-option>
                <a-option value="weekly">每周</a-option>
                <a-option value="monthly">每月</a-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item v-if="scheduleOn && form.schedule_type === 'weekly'" label="星期">
              <a-select v-model="scheduleDay">
                <a-option value="MON">周一</a-option>
                <a-option value="TUE">周二</a-option>
                <a-option value="WED">周三</a-option>
                <a-option value="THU">周四</a-option>
                <a-option value="FRI">周五</a-option>
                <a-option value="SAT">周六</a-option>
                <a-option value="SUN">周日</a-option>
              </a-select>
            </a-form-item>
            <a-form-item v-if="scheduleOn && form.schedule_type === 'monthly'" label="日期">
              <a-input-number v-model="scheduleMonthDay" :min="1" :max="28" style="width: 100%" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item v-if="scheduleOn" label="执行时间">
          <a-time-picker v-model="scheduleTime" format="HH:mm" value-format="HH:mm" style="width: 150px" />
        </a-form-item>
        <a-form-item label="备注">
          <a-textarea v-model="form.description" :max-length="500" show-word-limit />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 执行记录抽屉 -->
    <a-drawer v-model:visible="drawerVisible" :title="`执行记录: ${currentTask?.name || ''}`" :width="680" :footer="false">
      <a-table :data="recordList" :loading="recordLoading" :pagination="false" size="small">
        <template #columns>
          <a-table-column title="状态" :width="100">
            <template #cell="{ record }">
              <a-tag :color="recordStatusColor(record.status)" size="small">{{ recordStatusText(record.status) }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="进度" :width="120">
            <template #cell="{ record }">
              <a-progress v-if="record.status === 'running' || record.status === 'pending'" :percent="(record.progress || 0) / 100" size="small" />
              <span v-else-if="record.status === 'success'" style="color: #00b42a">100%</span>
              <span v-else>-</span>
            </template>
          </a-table-column>
          <a-table-column title="实际条件" ellipsis>
            <template #cell="{ record }">
              <span v-if="record.actual_period_start">{{ record.actual_period_start }} ~ {{ record.actual_period_end }}</span>
              <span v-if="record.actual_app_numbers" style="margin-left: 4px; color: #666">{{ formatApps(record.actual_app_numbers) }}</span>
            </template>
          </a-table-column>
          <a-table-column title="结果" data-index="result_summary" ellipsis :width="160" />
          <a-table-column title="重试" :width="60">
            <template #cell="{ record }">
              <a-link v-if="record.status === 'superset_timeout'" @click="handleRetry(record)">重试</a-link>
              <span v-else>-</span>
            </template>
          </a-table-column>
          <a-table-column title="时间" data-index="created_at" :width="130" />
        </template>
      </a-table>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onUnmounted } from 'vue'
import { Message } from '@arco-design/web-vue'
import { ApiPerfSyncTask, ApiPerfCompliance } from '@/api/perfApis'
import { useGet, usePost, usePut, useDelete } from '@/hooks'

defineOptions({ name: 'sync-manage' })

// ── 任务列表 ──────────────────────────────────
const pageNum = ref(1)
const pageSize = ref(20)
const queryParams = computed(() => ({ page_num: pageNum.value, page_size: pageSize.value }))
const { isFetching: loading, data: rawData, execute: fetchTasks } = useGet<any>(ApiPerfSyncTask.list, queryParams, { immediate: true })
const taskList = computed(() => rawData.value?.list || [])
const pagination = computed(() => ({ current: pageNum.value, pageSize: pageSize.value, total: rawData.value?.total || 0 }))
const handlePageChange = (page: number) => { pageNum.value = page; fetchTasks() }

// ── 维度选项（级联） ──────────────────────────────
const domainOptions = ref<any[]>([])
const areaOptions = ref<any[]>([])
const pgOptions = ref<any[]>([])
const appOptions = ref<any[]>([])

const dimPayload = ref<any>({})
const { execute: fetchDimOptions } = useGet<any>(ApiPerfCompliance.dimensionOptions, dimPayload, {
  immediate: false,
  onSuccess(data: any) {
    const level = dimPayload.value.level
    if (level === 'product_domain') domainOptions.value = data || []
    else if (level === 'business_area') areaOptions.value = data || []
    else if (level === 'project_group') pgOptions.value = data || []
    else if (level === 'app') appOptions.value = data || []
  },
})

const loadDomains = () => { dimPayload.value = { level: 'product_domain' }; fetchDimOptions() }
const onProductDomainChange = () => {
  form.business_area = undefined; form.project_group_code = undefined; form.app_numbers = []
  dimPayload.value = { level: 'business_area', product_domain: form.product_domain || '' }; fetchDimOptions()
}
const onBusinessAreaChange = () => {
  form.project_group_code = undefined; form.app_numbers = []
  dimPayload.value = { level: 'project_group', product_domain: form.product_domain || '', business_area: form.business_area || '' }; fetchDimOptions()
}
const onPgChange = () => {
  form.app_numbers = []
  dimPayload.value = { level: 'app', project_group_code: form.project_group_code || '' }; fetchDimOptions()
}

// ── 新增/编辑弹框 ──────────────────────────────
const modalVisible = ref(false)
const isEdit = ref(false)
const saving = ref(false)
const editId = ref('')
const form = reactive<any>({
  name: '', product_line: '星瀚', time_type: 'yesterday', period_start: '', period_end: '',
  product_domain: undefined, business_area: undefined, project_group_code: undefined, app_numbers: [],
  schedule_type: 'daily', description: '',
})
const scheduleOn = ref(false)
const scheduleDay = ref('MON')
const scheduleMonthDay = ref(1)
const scheduleTime = ref('02:00')

const openAddModal = () => {
  isEdit.value = false; editId.value = ''
  Object.assign(form, { name: '', product_line: '星瀚', time_type: 'yesterday', period_start: '', period_end: '', product_domain: undefined, business_area: undefined, project_group_code: undefined, app_numbers: [], schedule_type: 'daily', description: '' })
  scheduleOn.value = false; scheduleDay.value = 'MON'; scheduleMonthDay.value = 1; scheduleTime.value = '02:00'
  loadDomains()
  modalVisible.value = true
}

const openEditModal = (record: any) => {
  isEdit.value = true; editId.value = record.id
  Object.assign(form, {
    name: record.name, product_line: record.product_line, time_type: record.time_type,
    period_start: record.period_start || '', period_end: record.period_end || '',
    product_domain: record.product_domain || undefined, business_area: record.business_area || undefined,
    project_group_code: record.project_group_code || undefined,
    app_numbers: record.app_numbers ? JSON.parse(record.app_numbers) : [],
    schedule_type: record.schedule_type || 'weekly', description: record.description || '',
  })
  scheduleOn.value = record.schedule_enabled === '1'
  // 解析 cron
  if (record.schedule_cron) {
    const parts = record.schedule_cron.split(' ')
    if (parts.length >= 6) { scheduleTime.value = `${parts[1].padStart(2, '0')}:${parts[0].padStart(2, '0')}`; scheduleDay.value = parts[5] }
    if (parts.length >= 3 && record.schedule_type === 'monthly') scheduleMonthDay.value = parseInt(parts[2]) || 1
  }
  loadDomains()
  modalVisible.value = true
}

const buildCron = (): string => {
  const [h, m] = (scheduleTime.value || '02:00').split(':')
  if (form.schedule_type === 'weekly') return `${parseInt(m)} ${parseInt(h)} * * * ${scheduleDay.value}`
  if (form.schedule_type === 'monthly') return `${parseInt(m)} ${parseInt(h)} ${scheduleMonthDay.value} * *`
  return `${parseInt(m)} ${parseInt(h)} * * *` // daily：每天定时执行
}

const addPayload = ref<any>({})
const { execute: doAdd } = usePost<any>(ApiPerfSyncTask.add, addPayload, { immediate: false })
const editPayload = ref<any>({})
const { execute: doEdit } = usePut<any>(ApiPerfSyncTask.edit, editPayload, { immediate: false })

const handleSave = async () => {
  if (!form.name) { Message.warning('请输入任务名称'); return }
  saving.value = true
  const payload: any = {
    name: form.name, product_line: form.product_line, time_type: form.time_type,
    period_start: form.period_start || undefined, period_end: form.period_end || undefined,
    product_domain: form.product_domain || undefined, business_area: form.business_area || undefined,
    project_group_code: form.project_group_code || undefined,
    app_numbers: form.app_numbers?.length ? form.app_numbers : undefined,
    schedule_enabled: scheduleOn.value ? '1' : '0',
    schedule_type: scheduleOn.value ? form.schedule_type : undefined,
    schedule_cron: scheduleOn.value ? buildCron() : undefined,
    description: form.description || undefined,
  }
  try {
    if (isEdit.value) { editPayload.value = { id: editId.value, ...payload }; await doEdit(); Message.success('编辑成功') }
    else { addPayload.value = payload; await doAdd(); Message.success('新增成功') }
    modalVisible.value = false; fetchTasks()
  } finally { saving.value = false }
}

// ── 删除 ──────────────────────────────────
const delPayload = ref<any>({})
const { execute: doDelete } = useDelete<any>(ApiPerfSyncTask.delete, delPayload, { immediate: false })
const handleDelete = async (record: any) => {
  delPayload.value = { id: record.id }
  await doDelete()
  Message.success('删除成功'); fetchTasks()
}

// ── 触发执行 ──────────────────────────────────
const triggerPayload = ref<any>({})
const { execute: doTrigger } = usePost<any>(ApiPerfSyncTask.trigger, triggerPayload, { immediate: false })
const handleTrigger = async (record: any) => {
  triggerPayload.value = { task_id: record.id }
  await doTrigger()
  Message.success('执行已触发')
}

// ── 执行记录 ──────────────────────────────────
const drawerVisible = ref(false)
const currentTask = ref<any>(null)
const recordList = ref<any[]>([])
const recordLoading = ref(false)
const recordPayload = ref<any>({})
const { execute: fetchRecords } = useGet<any>(ApiPerfSyncTask.records, recordPayload, {
  immediate: false,
  onSuccess(data: any) { recordList.value = data?.list || [] },
})
const openRecords = (record: any) => {
  currentTask.value = record; drawerVisible.value = true; recordLoading.value = true
  recordPayload.value = { task_id: record.id, page_num: 1, page_size: 50 }
  fetchRecords().finally(() => { recordLoading.value = false })
}

// 抽屉打开且存在 运行中/等待中 记录时每 5 秒自动刷新进度（后台按天推进 progress）
let recordTimer: ReturnType<typeof setInterval> | null = null
const stopRecordTimer = () => { if (recordTimer) { clearInterval(recordTimer); recordTimer = null } }
watch([drawerVisible, recordList], ([visible, list]) => {
  stopRecordTimer()
  if (visible && list.some((r: any) => r.status === 'running' || r.status === 'pending')) {
    recordTimer = setInterval(() => { fetchRecords() }, 5000)
  }
}, { deep: true })
onUnmounted(stopRecordTimer)

// ── 重试 ──────────────────────────────────
const retryPayload = ref<any>({})
const { execute: doRetry } = usePost<any>(ApiPerfSyncTask.retry, retryPayload, { immediate: false })
const handleRetry = async (record: any) => {
  retryPayload.value = { record_id: record.id }
  await doRetry()
  Message.success('重试已触发')
  if (currentTask.value) openRecords(currentTask.value)
}

// ── 格式化辅助 ──────────────────────────────────
const timeTypeMap: Record<string, string> = { yesterday: '昨天', last_7_days: '近7天', this_week: '本周', last_week: '上周', this_month: '本月', last_month: '上月', this_year: '今年至今', custom: '自定义' }
const formatCondition = (r: any) => {
  const parts: string[] = [timeTypeMap[r.time_type] || r.time_type]
  if (r.product_domain) parts.push(`产品域:${r.product_domain}`)
  if (r.business_area) parts.push(`业务域:${r.business_area}`)
  if (r.project_group_code) parts.push(`项目组:${r.project_group_code}`)
  if (r.app_numbers) { try { const apps = JSON.parse(r.app_numbers); if (apps.length) parts.push(apps.join(',')) } catch {} }
  return parts.join(' | ')
}
const countFields = (f: string) => { try { return JSON.parse(f).length } catch { return 6 } }
const formatFields = (f: string) => { try { return JSON.parse(f).join(', ') } catch { return f } }
const formatSchedule = (r: any) => {
  if (!r.schedule_cron) return '已开启'
  const parts = r.schedule_cron.split(' ')
  const time = `${(parts[1] || '0').padStart(2, '0')}:${(parts[0] || '0').padStart(2, '0')}`
  if (r.schedule_type === 'weekly') { const dayMap: Record<string, string> = { MON: '一', TUE: '二', WED: '三', THU: '四', FRI: '五', SAT: '六', SUN: '日' }; return `每周${dayMap[parts[5]] || ''} ${time}` }
  return `每月${parts[2]}日 ${time}`
}
const formatApps = (s: string) => { try { const a = JSON.parse(s); return a.length ? a.join(',') : '全部' } catch { return s } }
const recordStatusText = (s: string) => ({ pending: '等待中', running: '运行中', success: '成功', failed: '失败', superset_timeout: '超时', cancelled: '已取消' }[s] || s)
const recordStatusColor = (s: string) => ({ pending: 'gray', running: 'blue', success: 'green', failed: 'red', superset_timeout: 'orangered', cancelled: 'orange' }[s] || 'gray')
</script>
