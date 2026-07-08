<script lang="ts" setup>
import { ref, computed, watch } from 'vue'
import { Message } from '@arco-design/web-vue'
import { useGet, usePost, usePut, useDelete } from '@/hooks'
import { ApiPerfTestPlan, ApiPerfScript, ApiPerfEnv, ApiPerfIteration, ApiSysDictData, ApiPerfLoadNode } from '@/api/apis'

defineOptions({ name: 'PerfTestPlan' })

// ── 视图切换：list | edit ──────────────────────────────────
const viewMode = ref<'list' | 'edit'>('list')

// ── 列表 ──────────────────────────────────
const queryParams = ref({
  page_num: 1,
  page_size: 10,
  keyword: '',
  status: '',
})
const { isFetching: isLoading, data: rawListData, execute: getList } = useGet<any>(ApiPerfTestPlan.getList, queryParams, { immediate: true })
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

// ── 时间格式化 ──────────────────────────────────
function formatTime(time?: string | null) {
  if (!time) return '-'
  return time.replace('T', ' ').substring(0, 19)
}

const columns = [
  { title: '计划名称', dataIndex: 'name', width: 200, ellipsis: true, tooltip: true },
  { title: '执行策略', dataIndex: 'task_type', width: 90, slotName: 'task_type' },
  { title: '并发数', dataIndex: 'max_concurrency', width: 80 },
  { title: '定时', dataIndex: 'schedule_enabled', width: 80, slotName: 'schedule' },
  { title: '状态', dataIndex: 'status', width: 80, slotName: 'status' },
  { title: '创建时间', dataIndex: 'created_at', width: 160, slotName: 'created_at' },
  { title: '操作', dataIndex: 'operations', slotName: 'operations', width: 240, fixed: 'right' as const },
]

// ── 业务领域字典（sec_pg_business_area） ──────────────────────────────────
const { data: domainDictRaw } = useGet<any>(ApiSysDictData.getByType, { dict_type: 'sec_pg_business_area' }, { immediate: true })
const domainOptions = computed(() => {
  const list = domainDictRaw.value?.list || domainDictRaw.value || []
  return list.map((d: any) => ({ label: d.dict_label, value: d.dict_value }))
})

// ── 脚本列表（额外添加用） ──────────────────────────────────
const scriptSearchKeyword = ref('')
const { data: scriptData } = useGet<any>(ApiPerfScript.getList, { page_num: 1, page_size: 500 }, { immediate: true })
const scriptList = computed(() => scriptData.value?.list || [])
const filteredScripts = computed(() => {
  if (!scriptSearchKeyword.value) return scriptList.value
  const kw = scriptSearchKeyword.value.toLowerCase()
  return scriptList.value.filter((s: any) =>
    s.name?.toLowerCase().includes(kw) || s.code?.toLowerCase().includes(kw) || s.domain?.toLowerCase().includes(kw)
  )
})

// ── 环境列表 ──────────────────────────────────
const { data: envData } = useGet<any>(ApiPerfEnv.getList, { page_num: 1, page_size: 100 }, { immediate: true })
const envOptions = computed(() => (envData.value?.list || []).map((e: any) => ({ label: e.env_name, value: e.id })))
function envName(envId?: string | null) {
  if (!envId) return '-'
  const e = envOptions.value.find(o => o.value === envId)
  return e ? e.label : envId
}

// ── 在线压测机列表 ──────────────────────────────────
const { data: loadNodeData } = useGet<any>(ApiPerfLoadNode.onlineList, {}, { immediate: true })
const loadNodeOptions = computed(() => [
  { label: '本地执行（默认，不经过 Agent）', value: '' },
  { label: '自动选择 Agent 节点', value: 'auto' },
  ...(loadNodeData.value || []).map((n: any) => ({
    label: `${n.node_name} (${n.host_ip}:${n.agent_port}) [${n.current_load || 0}/${n.max_concurrency || 1}]`,
    value: n.id,
  })),
])

// ── 迭代列表 ──────────────────────────────────
const { data: iterData } = useGet<any>(ApiPerfIteration.getList, { page_num: 1, page_size: 100, status: '1' }, { immediate: true })
const iterOptions = computed(() => (iterData.value?.list || []).map((i: any) => ({ label: `${i.name} (${i.code})`, value: i.id })))
const { data: currentIterData } = useGet<any>(ApiPerfIteration.current, {}, { immediate: true })

// ── 编辑视图 ──────────────────────────────────
const editSubmitting = ref(false)
const isEdit = ref(false)
const editForm = ref({
  id: '',
  name: '',
  description: '',
  env_id: '',
  task_type: 'sequential',
  max_concurrency: 1,
  default_params_json: {
    threads: undefined as number | undefined,
    rampup: undefined as number | undefined,
    loops: undefined as number | undefined,
    duration: undefined as number | undefined,
    extra_props: '',
    timeout_sec: 600,
    load_node_id: '',
  },
  status: '1',
  cron_expr: '',
  schedule_enabled: '0',
  default_iteration_id: '',
  domains: [] as { domain_code: string; action: string }[],
  scripts: [] as { script_id: string; action: string }[],
})

// 领域关联脚本数（编辑时从后端获取）
const domainScriptCounts = ref<Record<string, number>>({})
// 额外脚本详情
const scriptDetails = ref<any[]>([])

function handleAdd() {
  isEdit.value = false
  editForm.value = {
    id: '',
    name: '',
    description: '',
    env_id: '',
    task_type: 'sequential',
    max_concurrency: 1,
    default_params_json: { threads: undefined, rampup: undefined, loops: undefined, duration: undefined, extra_props: '', timeout_sec: 600, load_node_id: '' },
    status: '1',
    cron_expr: '',
    schedule_enabled: '0',
    default_iteration_id: '',
    domains: [],
    scripts: [],
  }
  domainScriptCounts.value = {}
  scriptDetails.value = []
  scriptSearchKeyword.value = ''
  viewMode.value = 'edit'
}

async function handleEdit(record: any) {
  isEdit.value = true
  const { data, execute } = useGet<any>(ApiPerfTestPlan.getById, { id: record.id })
  await execute()
  if (data.value) {
    const dp = data.value.plan.default_params_json || {}
    editForm.value = {
      id: data.value.plan.id,
      name: data.value.plan.name,
      description: data.value.plan.description || '',
      env_id: data.value.plan.env_id || '',
      task_type: data.value.plan.task_type,
      max_concurrency: data.value.plan.max_concurrency,
      default_params_json: {
        threads: dp.threads,
        rampup: dp.rampup,
        loops: dp.loops,
        duration: dp.duration,
        extra_props: dp.extra_props || '',
        timeout_sec: dp.timeout_sec || 600,
        load_node_id: dp.load_node_id || '',
      },
      status: data.value.plan.status,
      cron_expr: data.value.plan.cron_expr || '',
      schedule_enabled: data.value.plan.schedule_enabled || '0',
      default_iteration_id: data.value.plan.default_iteration_id || '',
      domains: (data.value.domains || []).map((d: any) => ({ domain_code: d.domain_code, action: d.action })),
      scripts: (data.value.scripts || []).map((s: any) => ({ script_id: s.script_id, action: s.action })),
    }
    // 存储领域脚本数和脚本详情
    domainScriptCounts.value = {}
    for (const d of (data.value.domains || [])) {
      domainScriptCounts.value[d.domain_code] = d.script_count || 0
    }
    scriptDetails.value = data.value.script_details || []
    scriptSearchKeyword.value = ''
    viewMode.value = 'edit'
  }
}

function handleBack() {
  viewMode.value = 'list'
  getList()
}

// 领域多选/排除
function toggleDomain(code: string) {
  const idx = editForm.value.domains.findIndex(d => d.domain_code === code)
  if (idx >= 0) {
    const d = editForm.value.domains[idx]
    if (d.action === '1') {
      d.action = '0'
    } else {
      editForm.value.domains.splice(idx, 1)
    }
  } else {
    editForm.value.domains.push({ domain_code: code, action: '1' })
  }
}

function domainAction(code: string): string {
  const d = editForm.value.domains.find(d => d.domain_code === code)
  return d ? d.action : ''
}

// 脚本多选/排除
function toggleScript(sid: string) {
  const idx = editForm.value.scripts.findIndex(s => s.script_id === sid)
  if (idx >= 0) {
    const s = editForm.value.scripts[idx]
    if (s.action === '1') {
      s.action = '0'
    } else {
      editForm.value.scripts.splice(idx, 1)
    }
  } else {
    editForm.value.scripts.push({ script_id: sid, action: '1' })
  }
}

function scriptAction(sid: string): string {
  const s = editForm.value.scripts.find(s => s.script_id === sid)
  return s ? s.action : ''
}

function scriptName(sid: string): string {
  const s = scriptList.value.find((x: any) => x.id === sid)
  return s ? s.name : sid
}

async function handleSave() {
  if (!editForm.value.name) { Message.warning('请输入计划名称'); return }
  editSubmitting.value = true
  const payload = {
    id: editForm.value.id,
    name: editForm.value.name,
    description: editForm.value.description || undefined,
    env_id: editForm.value.env_id || undefined,
    task_type: editForm.value.task_type,
    max_concurrency: editForm.value.max_concurrency,
    default_params_json: editForm.value.default_params_json,
    status: editForm.value.status,
    cron_expr: editForm.value.cron_expr || undefined,
    schedule_enabled: editForm.value.schedule_enabled,
    default_iteration_id: editForm.value.default_iteration_id || undefined,
    domains: editForm.value.domains,
    scripts: editForm.value.scripts,
  }
  if (isEdit.value) {
    const { execute, error } = usePut(ApiPerfTestPlan.edit, payload)
    await execute()
    if (error.value) { Message.error('保存失败'); editSubmitting.value = false; return }
    Message.success('保存成功')
  } else {
    const { execute, error } = usePost(ApiPerfTestPlan.add, payload)
    await execute()
    if (error.value) { Message.error('创建失败'); editSubmitting.value = false; return }
    Message.success('创建成功')
  }
  editSubmitting.value = false
  viewMode.value = 'list'
  getList()
}

// ── 删除 ──────────────────────────────────
async function handleDelete(record: any) {
  const { execute, error } = useDelete(ApiPerfTestPlan.delete, { ids: [record.id] })
  await execute()
  if (error.value) { Message.error('删除失败'); return }
  Message.success('删除成功')
  getList()
}

// ── 预览 ──────────────────────────────────
const previewVisible = ref(false)
const previewData = ref<any>(null)
const previewLoading = ref(false)

async function handlePreview(record: any) {
  previewLoading.value = true
  previewVisible.value = true
  const { data, execute } = useGet<any>(ApiPerfTestPlan.preview, { id: record.id })
  await execute()
  previewData.value = data.value
  previewLoading.value = false
}

const previewColumns = [
  { title: '脚本名称', dataIndex: 'name', width: 250, ellipsis: true, tooltip: true },
  { title: '编码', dataIndex: 'code', width: 150, ellipsis: true, tooltip: true },
  { title: '领域', dataIndex: 'domain', width: 120, ellipsis: true, tooltip: true },
  { title: '来源', dataIndex: 'source', width: 100, slotName: 'source' },
]

// ── 触发弹窗 ──────────────────────────────────
const triggerVisible = ref(false)
const triggerSubmitting = ref(false)
const triggerPlanId = ref('')
const triggerForm = ref({
  plan_id: '',
  iteration_id: '',
  env_id: '',
  task_name: '',
  threads: undefined as number | undefined,
  rampup: undefined as number | undefined,
  loops: undefined as number | undefined,
  duration: undefined as number | undefined,
  extra_props: '',
  timeout_sec: undefined as number | undefined,
  load_node_id: '',
})

function handleTrigger(record: any) {
  triggerPlanId.value = record.id
  triggerForm.value = {
    plan_id: record.id,
    iteration_id: currentIterData.value?.id || '',
    env_id: record.env_id || '',
    task_name: '',
    threads: undefined,
    rampup: undefined,
    loops: undefined,
    duration: undefined,
    extra_props: '',
    timeout_sec: undefined,
    load_node_id: '',
  }
  triggerVisible.value = true
  fetchPlanEstimate(record.id, record.max_concurrency || 1)
}

// ── 预估执行时间 ──────────────────────────────────
const estimateResult = ref<any>(null)
const estimateLoading = ref(false)

function fetchPlanEstimate(planId: string, maxConcurrency: number) {
  estimateResult.value = null
  if (!planId) return
  estimateLoading.value = true
  const { execute, data } = useGet(ApiPerfTestPlan.estimateTime, { plan_id: planId, max_concurrency: maxConcurrency })
  execute().then(() => {
    estimateResult.value = data.value?.data || null
    estimateLoading.value = false
  })
}

async function handleTriggerSubmit() {
  triggerSubmitting.value = true
  const { execute, error } = usePost(ApiPerfTestPlan.trigger, triggerForm.value)
  await execute()
  triggerSubmitting.value = false
  if (error.value) { Message.error('触发失败'); return }
  Message.success('任务已触发')
  triggerVisible.value = false
}
</script>

<template>
  <div class="perf-test-plan">
    <!-- 列表视图 -->
    <template v-if="viewMode === 'list'">
      <a-card :bordered="false" class="m-b-8px">
        <a-row :gutter="16">
          <a-col :span="6">
            <a-input-search v-model="queryParams.keyword" placeholder="搜索计划名称" allow-clear @search="handleSearch" @press-enter="handleSearch" />
          </a-col>
          <a-col :span="4">
            <a-select v-model="queryParams.status" placeholder="状态" allow-clear @change="handleSearch">
              <a-option value="1">启用</a-option>
              <a-option value="0">禁用</a-option>
            </a-select>
          </a-col>
          <a-col :span="6">
            <a-space>
              <a-button type="primary" @click="handleSearch">搜索</a-button>
              <a-button type="primary" status="success" @click="handleAdd">
                <template #icon><icon-plus /></template>
                新建计划
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
          <template #task_type="{ record }">
            <a-tag :color="record.task_type === 'parallel' ? 'blue' : 'gray'">
              {{ record.task_type === 'parallel' ? '并行' : '串行' }}
            </a-tag>
          </template>
          <template #schedule="{ record }">
            <a-tag :color="record.schedule_enabled === '1' ? 'blue' : 'gray'" size="small">
              {{ record.schedule_enabled === '1' ? '定时' : '-' }}
            </a-tag>
          </template>
          <template #status="{ record }">
            <a-tag :color="record.status === '1' ? 'green' : 'gray'">
              {{ record.status === '1' ? '启用' : '禁用' }}
            </a-tag>
          </template>
          <template #created_at="{ record }">{{ formatTime(record.created_at) }}</template>
          <template #operations="{ record }">
            <a-space>
              <a-button type="text" size="small" @click="handlePreview(record)">预览</a-button>
              <a-button type="text" size="small" status="success" @click="handleTrigger(record)">触发</a-button>
              <a-button type="text" size="small" @click="handleEdit(record)">编辑</a-button>
              <a-popconfirm content="确认删除？" @ok="handleDelete(record)">
                <a-button type="text" size="small" status="danger">删除</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </a-table>
      </a-card>
    </template>

    <!-- 编辑视图 -->
    <template v-else>
      <a-card :bordered="false">
        <div class="edit-header">
          <a-button @click="handleBack"><icon-left /> 返回列表</a-button>
          <span class="edit-title">{{ isEdit ? '编辑测试计划' : '新建测试计划' }}</span>
        </div>
        <a-form :model="editForm" layout="vertical" style="margin-top: 16px">
          <a-divider orientation="left">基本信息</a-divider>
          <a-row :gutter="16">
            <a-col :span="8">
              <a-form-item label="计划名称" required>
                <a-input v-model="editForm.name" placeholder="如：司库-2026Q3回归" />
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="默认环境">
                <a-select v-model="editForm.env_id" :options="envOptions" placeholder="选择环境" allow-clear />
              </a-form-item>
            </a-col>
            <a-col :span="4">
              <a-form-item label="执行策略">
                <a-select v-model="editForm.task_type">
                  <a-option value="sequential">串行</a-option>
                  <a-option value="parallel">并行</a-option>
                </a-select>
              </a-form-item>
            </a-col>
            <a-col :span="4">
              <a-form-item label="最大并发数">
                <a-input-number v-model="editForm.max_concurrency" :min="1" :max="10" />
              </a-form-item>
            </a-col>
          </a-row>
          <a-form-item label="描述">
            <a-textarea v-model="editForm.description" placeholder="计划描述" :auto-size="{ minRows: 2 }" />
          </a-form-item>

          <a-divider orientation="left">默认执行参数</a-divider>
          <a-form-item label="默认执行机">
            <a-select v-model="editForm.default_params_json.load_node_id" :options="loadNodeOptions" placeholder="选择默认执行机" allow-clear />
          </a-form-item>
          <a-row :gutter="16">
            <a-col :span="8"><a-form-item label="线程数"><a-input-number v-model="editForm.default_params_json.threads" :min="1" placeholder="默认" /></a-form-item></a-col>
            <a-col :span="8"><a-form-item label="Ramp-up(秒)"><a-input-number v-model="editForm.default_params_json.rampup" :min="0" placeholder="默认" /></a-form-item></a-col>
            <a-col :span="8"><a-form-item label="循环次数"><a-input-number v-model="editForm.default_params_json.loops" :min="1" placeholder="默认" /></a-form-item></a-col>
          </a-row>
          <a-row :gutter="16">
            <a-col :span="8"><a-form-item label="持续时间(秒)"><a-input-number v-model="editForm.default_params_json.duration" :min="0" placeholder="0=不限" /></a-form-item></a-col>
            <a-col :span="8"><a-form-item label="超时(秒)"><a-input-number v-model="editForm.default_params_json.timeout_sec" :min="0" placeholder="默认600" /></a-form-item></a-col>
            <a-col :span="8"><a-form-item label="额外JMeter属性"><a-input v-model="editForm.default_params_json.extra_props" placeholder="key1=v1" /></a-form-item></a-col>
          </a-row>

          <a-divider orientation="left">定时触发</a-divider>
          <a-row :gutter="16">
            <a-col :span="4">
              <a-form-item label="启用定时">
                <a-switch v-model="editForm.schedule_enabled" :checked-value="'1'" :unchecked-value="'0'" />
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="Cron表达式">
                <a-input v-model="editForm.cron_expr" placeholder="如: 0 0 2 * * ?（每天凌晨2点）" :disabled="editForm.schedule_enabled !== '1'" />
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="默认迭代">
                <a-select v-model="editForm.default_iteration_id" :options="iterOptions" placeholder="定时触发使用的迭代" allow-clear :disabled="editForm.schedule_enabled !== '1'" />
              </a-form-item>
            </a-col>
            <a-col :span="4">
              <a-form-item label="计划状态">
                <a-select v-model="editForm.status">
                  <a-option value="1">启用</a-option>
                  <a-option value="0">禁用</a-option>
                </a-select>
              </a-form-item>
            </a-col>
          </a-row>

          <a-divider orientation="left">领域配置（点击切换：包含 ✓ → 排除 ✗ → 移除）</a-divider>
          <div class="domain-tags">
            <a-tag
              v-for="opt in domainOptions"
              :key="opt.value"
              :color="domainAction(opt.value) === '1' ? 'green' : (domainAction(opt.value) === '0' ? 'red' : 'gray')"
              class="domain-tag"
              @click="toggleDomain(opt.value)"
            >
              {{ opt.label }}
              <span v-if="domainAction(opt.value) === '1'"> ✓ ({{ domainScriptCounts[opt.value] ?? 0 }}脚本)</span>
              <span v-else-if="domainAction(opt.value) === '0'"> ✗</span>
            </a-tag>
          </div>
          <div v-if="editForm.domains.filter(d => d.action === '1').length > 0" class="domain-summary">
            <a-alert type="info" :show-icon="true">
              包含领域 {{ editForm.domains.filter(d => d.action === '1').length }} 个，
              领域脚本共 {{ editForm.domains.filter(d => d.action === '1').reduce((sum, d) => sum + (domainScriptCounts[d.domain_code] ?? 0), 0) }} 个
            </a-alert>
          </div>

          <a-divider orientation="left">额外脚本（点击切换：添加 ✓ → 排除 ✗ → 移除）</a-divider>
          <a-input-search v-model="scriptSearchKeyword" placeholder="搜索脚本名称/编码/领域" allow-clear style="margin-bottom: 8px" />
<a-table
  column-resizable
            :data="filteredScripts"
            :pagination="{ pageSize: 10, showTotal: true }"
            row-key="id"
            size="small"
            :scroll="{ y: 400 }"
          >
            <a-table-column title="操作" :width="80">
              <template #cell="{ record }">
                <a-tag
                  :color="scriptAction(record.id) === '1' ? 'green' : (scriptAction(record.id) === '0' ? 'red' : 'gray')"
                  class="domain-tag"
                  @click="toggleScript(record.id)"
                >
                  <span v-if="scriptAction(record.id) === '1'">✓ 添加</span>
                  <span v-else-if="scriptAction(record.id) === '0'">✗ 排除</span>
                  <span v-else>+ 添加</span>
                </a-tag>
              </template>
            </a-table-column>
            <a-table-column title="脚本名称" data-index="name" :width="250" :ellipsis="true" :tooltip="true" />
            <a-table-column title="编码" data-index="code" :width="150" :ellipsis="true" :tooltip="true" />
            <a-table-column title="领域" data-index="domain" :width="120" :ellipsis="true" :tooltip="true" />
          </a-table>

          <div style="margin-top: 16px">
            <a-space>
              <a-button type="primary" :loading="editSubmitting" @click="handleSave">
                {{ isEdit ? '保存修改' : '创建计划' }}
              </a-button>
              <a-button @click="handleBack">取消</a-button>
            </a-space>
          </div>
        </a-form>
      </a-card>
    </template>

    <!-- 预览弹窗 -->
    <a-modal v-model:visible="previewVisible" title="预览脚本列表" :width="750" :footer="false">
      <a-spin :loading="previewLoading" style="width: 100%">
        <div v-if="previewData" class="preview-summary">
          <a-statistic title="最终执行" :value="previewData.total" />
          <a-divider direction="vertical" />
          <a-statistic title="来自领域" :value="previewData.from_domains" />
          <a-statistic title="额外添加" :value="previewData.extra_scripts" />
          <a-statistic title="排除" :value="previewData.excluded" />
        </div>
<a-table
  column-resizable
          v-if="previewData"
          :data="previewData.scripts"
          :columns="previewColumns"
          :pagination="false"
          row-key="id"
          size="small"
          style="margin-top: 12px"
        >
          <template #source="{ record }">
            <a-tag :color="record.source === 'domain' ? 'blue' : 'green'" size="small">
              {{ record.source === 'domain' ? '领域' : '额外' }}
            </a-tag>
          </template>
        </a-table>
      </a-spin>
    </a-modal>

    <!-- 触发弹窗 -->
    <a-modal v-model:visible="triggerVisible" title="从计划触发执行" :width="600" :ok-loading="triggerSubmitting" @ok="handleTriggerSubmit">
      <a-form :model="triggerForm" layout="vertical">
        <a-form-item label="任务名称">
          <a-input v-model="triggerForm.task_name" placeholder="留空则使用计划名称" />
        </a-form-item>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="迭代">
              <a-select v-model="triggerForm.iteration_id" :options="iterOptions" placeholder="选择迭代" allow-clear />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="环境（覆盖计划默认）">
              <a-select v-model="triggerForm.env_id" :options="envOptions" placeholder="选择环境" allow-clear />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="执行机">
          <a-select v-model="triggerForm.load_node_id" :options="loadNodeOptions" placeholder="选择执行机" allow-clear />
        </a-form-item>
        <a-divider orientation="left">覆盖执行参数（留空使用计划默认值）</a-divider>
        <a-row :gutter="16">
          <a-col :span="6"><a-form-item label="线程数"><a-input-number v-model="triggerForm.threads" :min="1" placeholder="默认" /></a-form-item></a-col>
          <a-col :span="6"><a-form-item label="Ramp-up"><a-input-number v-model="triggerForm.rampup" :min="0" placeholder="默认" /></a-form-item></a-col>
          <a-col :span="6"><a-form-item label="循环"><a-input-number v-model="triggerForm.loops" :min="1" placeholder="默认" /></a-form-item></a-col>
          <a-col :span="6"><a-form-item label="持续(秒)"><a-input-number v-model="triggerForm.duration" :min="0" placeholder="默认" /></a-form-item></a-col>
        </a-row>
        <a-form-item label="超时(秒)">
          <a-input-number v-model="triggerForm.timeout_sec" :min="0" placeholder="默认600" />
        </a-form-item>
        <a-form-item label="额外JMeter属性">
          <a-input v-model="triggerForm.extra_props" placeholder="key1=value1,key2=value2" />
        </a-form-item>
        <a-alert v-if="estimateResult || estimateLoading" type="info" :loading="estimateLoading" style="margin-top: 8px">
          <template #title>
            <span>预估执行时间</span>
          </template>
          <div v-if="estimateResult" style="font-size: 13px; line-height: 1.8">
            <span>预估总耗时：</span>
            <b style="color: #165dff; font-size: 16px">{{ estimateResult.estimated_human }}</b>
            <span style="color: #86909c; margin-left: 8px">（串行 {{ estimateResult.serial_total_human }}）</span>
            <br />
            <span>脚本总数：{{ estimateResult.total_scripts }}（有历史数据 {{ estimateResult.scripts_with_data }}，无数据 {{ estimateResult.scripts_no_data }}）</span>
            <br />
            <span>平均单个：{{ estimateResult.avg_per_script_human }}，最长：{{ estimateResult.max_script_human }}</span>
          </div>
        </a-alert>
      </a-form>
    </a-modal>
  </div>
</template>

<style scoped>
.perf-test-plan { padding: 0; }
.domain-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.domain-tag { cursor: pointer; user-select: none; }
.preview-summary { display: flex; align-items: center; gap: 16px; padding: 8px 0; }
.domain-summary { margin-top: 8px; }
.edit-header { display: flex; align-items: center; gap: 12px; }
.edit-title { font-size: 16px; font-weight: 500; }
</style>
