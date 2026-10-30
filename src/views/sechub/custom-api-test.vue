<script setup lang="ts">
/**
 * 自定义API测试（安全测试 → API安全测试 → 自定义API测试）
 *
 * 布局与「测试用例」（./api-test-cases.vue）一致：左树 + 筛选 + 工具栏 + 列表。
 * - 右侧列表：自定义API测试任务（GET /sechub/custom-api-task/list）；
 * - 「导入API信息」：粘贴调用路径（每行一个）→ 后端在 API 资产里逐条精确匹配（自动补 /kapi 前缀）→ 生成一个任务；
 * - 左树：初始为空；点选列表中的任务后，按归属维度展示该任务里的 API
 *   （GET /sechub/custom-api-task/tree?task_id=，结构与 API 资产树一致，展开到 API）。
 * - 「运行」：选 Agent / 模型 / 代码库（默认该应用的反编译源码库）→ 后端定位 API 实现代码 → AI 扫描 → Markdown 报告；
 *   运行在后台，列表每 5 秒轮询状态；
 * - 「扫描结果」：报告（Markdown）+ 逐条结论（未找到API / 已排除 / 确认问题）；
 * - 「删除」：软删除任务（运行中不可删）。
 */
import type { AiAgent } from '@/api/aiApis'
import type { ModuleWithRepository } from '@/types/static-scan'
import { Message, Modal } from '@arco-design/web-vue'
import { MdPreview } from 'md-editor-v3'
import { computed, onActivated, onDeactivated, onUnmounted, reactive, ref, watch } from 'vue'

import { ApiSecCustomApiTask } from '@/api/sechubApis'
import ListPage from '@/components/common/ListPage.vue'
import { formatTime, getAction, postAction, useGet } from '@/hooks'
import ApiInventoryTree from '@/views/metadata/components/ApiInventoryTree.vue'
import { fetchAgents, fetchRepositories } from '@/views/sechub/static-scan/new-scan/service'
import 'md-editor-v3/lib/style.css'

// 组件名必须与路由 name（= sys_menu.path）一致，keep-alive :include 按它对上缓存
// eslint-disable-next-line vue/component-definition-name-casing
defineOptions({ name: 'custom-api-test' })

const DIMENSION_OPTIONS = [
  { value: 'app', label: '按应用' },
  { value: 'project_group', label: '按项目组' },
  { value: 'business_area', label: '按业务领域' },
  { value: 'product_domain', label: '按产品领域' },
]
const STATUS_LABELS: Record<string, { text: string, color: string }> = {
  pending: { text: '待运行', color: 'gray' },
  running: { text: '运行中', color: 'arcoblue' },
  succeeded: { text: '已完成', color: 'green' },
  failed: { text: '失败', color: 'red' },
}
const VERDICT_LABELS: Record<string, { text: string, color: string }> = {
  not_found: { text: '未找到API', color: 'gray' },
  excluded: { text: '已排除', color: 'green' },
  confirmed: { text: '确认问题', color: 'red' },
}
const SEVERITY_LABELS: Record<string, { text: string, color: string }> = {
  high: { text: '高', color: 'red' },
  medium: { text: '中', color: 'orangered' },
  low: { text: '低', color: 'gold' },
  none: { text: '无', color: 'gray' },
}
const ROLE_LABELS: Record<string, string> = {
  api_plugin: 'API 插件',
  controller: '自定义API类',
  op_plugin: '操作插件',
  service_impl: '服务实现',
}
/** 运行状态轮询间隔 */
const POLL_MS = 5000

interface ImplTarget {
  role: string
  class_name: string
  method?: string
  operation?: string
  file?: string | null
}

interface TaskItem {
  id: string
  call_path: string
  http_method?: string | null
  api_name?: string | null
  api_number?: string | null
  app_number?: string | null
  app_name?: string | null
  dev_mode?: string | null
  locate_status?: string | null
  locate_note?: string | null
  impl_json?: ImplTarget[] | null
  verdict?: string | null
  severity?: string | null
  ai_summary?: string | null
}

interface TaskDetail {
  task: any
  items: TaskItem[]
  repository_name?: string | null
  suggested_repository_id?: string | null
}

// ── 左树：跟随选中的任务 ───────────────────────────
const dimension = ref('app')
const selectedTask = ref<any>(null)
const selectedTaskId = computed(() => (selectedTask.value ? String(selectedTask.value.id).trim() : ''))
const treeParams = computed(() => ({ task_id: selectedTaskId.value || undefined }))
const scope = ref<any>({ kind: 'all', code: '', appNumber: '', label: '全部接口' })
const selectedApiPath = computed(() => (scope.value.kind === 'api' ? scope.value.code : ''))

function handleTreeSelect(s: any) {
  scope.value = s
}

// ── 右表：任务列表 ─────────────────────────────────
const searchForm = reactive({ keyword: '' })
const pageNum = ref(1)
const pageSize = ref(20)
const queryParams = computed(() => ({
  page_num: pageNum.value,
  page_size: pageSize.value,
  keyword: searchForm.keyword || undefined,
}))
const { isFetching: loading, data: rawData, execute: fetchList } = useGet<any>(
  ApiSecCustomApiTask.list,
  queryParams,
  { immediate: true },
)
const rows = computed(() => rawData.value?.list || [])
const pagination = computed(() => ({
  current: pageNum.value,
  pageSize: pageSize.value,
  total: rawData.value?.total || 0,
  showTotal: true,
  showPageSize: true,
}))

function handleSearch() {
  pageNum.value = 1
  fetchList()
}

function handleReset() {
  searchForm.keyword = ''
  handleSearch()
}

function handlePageChange(page: number) {
  pageNum.value = page
  fetchList()
}

function handlePageSizeChange(size: number) {
  pageSize.value = size
  pageNum.value = 1
  fetchList()
}

function unmatchedOf(record: any): string[] {
  return Array.isArray(record?.unmatched_json) ? record.unmatched_json : []
}

function selectTask(record: any) {
  selectedTask.value = record
  scope.value = { kind: 'all', code: '', appNumber: '', label: '全部接口' }
}

function rowClass(record: any) {
  return String(record.id).trim() === selectedTaskId.value ? 'row-selected' : ''
}

// ── 导入API信息 ────────────────────────────────────
const importVisible = ref(false)
const importing = ref(false)
const importForm = reactive({ text: '', name: '' })
const inputLineCount = computed(() => importForm.text.split(/\r?\n/).filter(line => line.trim()).length)

function openImport() {
  importForm.text = ''
  importForm.name = ''
  importVisible.value = true
}

async function handleImport() {
  if (!importForm.text.trim()) {
    Message.warning('请输入要测试的 API 调用路径（每行一个）')
    return false
  }
  importing.value = true
  try {
    const res = await postAction<any>(ApiSecCustomApiTask.import, {
      text: importForm.text,
      name: importForm.name.trim() || undefined,
    })
    if (res === null)
      return false
    importVisible.value = false
    pageNum.value = 1
    await fetchList()
    selectTask(res.task)
    if (res.unmatched?.length) {
      Modal.warning({
        title: `已生成任务，${res.unmatched.length} 行未在 API 资产中找到`,
        content: `匹配到 ${res.api_count} 个 API（命中 ${res.matched_lines}/${res.input_count} 行）。未找到：\n${res.unmatched.join('\n')}`,
      })
    }
    else {
      Message.success(`已生成任务「${res.task.name}」：${res.input_count} 行全部匹配，共 ${res.api_count} 个 API`)
    }
    return true
  }
  finally {
    importing.value = false
  }
}

// ── 运行 ───────────────────────────────────────────
const runVisible = ref(false)
const runSubmitting = ref(false)
const runTask = ref<any>(null)
const runForm = reactive({ agentCode: '', model: '', repositoryId: '' })
const agentList = ref<AiAgent[]>([])
const repoList = ref<ModuleWithRepository[]>([])
const runLookupsLoading = ref(false)

/** 同一仓库可能绑在多个模块下：按仓库去重 */
const repoOptions = computed(() => {
  const seen = new Set<string>()
  const out: { value: string, label: string }[] = []
  for (const repo of repoList.value) {
    const id = String(repo.repository_id || '').trim()
    if (!id || seen.has(id))
      continue
    seen.add(id)
    out.push({ value: id, label: `${repo.repository_name || repo.repository_code}（${repo.default_branch || '-'}）` })
  }
  return out
})

const modelOptions = computed(() => {
  const agent = agentList.value.find(a => a.agent_code === runForm.agentCode)
  const defaultLabel = `Agent 默认模型（${agent?.default_model || 'auto'}）`
  const options = [{ label: defaultLabel, value: '' }]
  try {
    const models: string[] = agent?.supported_models_json ? JSON.parse(agent.supported_models_json) : []
    for (const model of models) {
      if (model && model !== 'auto')
        options.push({ label: model, value: model })
    }
  }
  catch { /* 配置串损坏时只留默认模型 */ }
  return options
})

watch(() => runForm.agentCode, () => {
  if (!modelOptions.value.some(option => option.value === runForm.model))
    runForm.model = ''
})

async function ensureRunLookups() {
  if (agentList.value.length && repoList.value.length)
    return
  runLookupsLoading.value = true
  try {
    const [agents, repos] = await Promise.all([fetchAgents(), fetchRepositories()])
    if (agents)
      agentList.value = agents
    if (repos)
      repoList.value = repos
  }
  finally {
    runLookupsLoading.value = false
  }
}

async function openRun(record: any) {
  runTask.value = record
  runVisible.value = true
  await ensureRunLookups()
  const detail = await getAction<TaskDetail>(ApiSecCustomApiTask.detail, { task_id: String(record.id).trim() })
  const agents = agentList.value.map(a => a.agent_code)
  runForm.agentCode = [record.agent_code, 'qoder-cli-scan', agents[0]].find(code => code && agents.includes(code)) || ''
  runForm.model = record.model && modelOptions.value.some(option => option.value === record.model) ? record.model : ''
  const repoIds = repoOptions.value.map(option => option.value)
  runForm.repositoryId = [record.repository_id, detail?.suggested_repository_id].map(id => String(id || '').trim()).find(id => id && repoIds.includes(id)) || ''
}

async function handleRun() {
  if (!runForm.repositoryId) {
    Message.warning('请选择代码库')
    return false
  }
  if (!runForm.agentCode) {
    Message.warning('请选择 Agent')
    return false
  }
  runSubmitting.value = true
  try {
    const res = await postAction<any>(ApiSecCustomApiTask.run, {
      task_id: String(runTask.value.id).trim(),
      repository_id: runForm.repositoryId,
      agent_code: runForm.agentCode,
      model: runForm.model || undefined,
    })
    if (res === null)
      return false
    Message.success('已开始运行：先在代码库中定位 API 代码，再由 AI 扫描，完成后可在「扫描结果」查看报告')
    await fetchList()
    return true
  }
  finally {
    runSubmitting.value = false
  }
}

// ── 扫描结果 ───────────────────────────────────────
const resultVisible = ref(false)
const resultLoading = ref(false)
const resultTaskId = ref('')
const resultDetail = ref<TaskDetail | null>(null)
const resultTab = ref('report')

async function loadResult(taskId: string) {
  resultLoading.value = true
  try {
    const detail = await getAction<TaskDetail>(ApiSecCustomApiTask.detail, { task_id: taskId })
    if (detail?.task)
      resultDetail.value = detail
  }
  finally {
    resultLoading.value = false
  }
}

function openResult(record: any) {
  resultTaskId.value = String(record.id).trim()
  resultDetail.value = null
  resultTab.value = 'report'
  resultVisible.value = true
  void loadResult(resultTaskId.value)
}

function filesOf(item: TaskItem): ImplTarget[] {
  return Array.isArray(item.impl_json) ? item.impl_json.filter(target => target.file) : []
}

function targetLabel(target: ImplTarget): string {
  const role = ROLE_LABELS[target.role] || target.role
  const op = target.operation ? ` · ${target.operation}` : ''
  const method = target.method ? `#${target.method}` : ''
  return `[${role}${op}] ${target.class_name}${method}`
}

// ── 状态轮询：有运行中的任务就每 5 秒刷新列表 ──────
const hasRunning = computed(() => rows.value.some((row: any) => row.status === 'running'))
let pollTimer: ReturnType<typeof setInterval> | null = null

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function syncPolling() {
  if (hasRunning.value && !pollTimer)
    pollTimer = setInterval(() => void fetchList(), POLL_MS)
  else if (!hasRunning.value)
    stopPolling()
}

watch(hasRunning, syncPolling)
// 列表刷新后同步左侧「已选任务」与结果弹窗（状态 running → succeeded 时自动刷新报告）
watch(rows, (list: any[]) => {
  if (!selectedTaskId.value)
    return
  const fresh = list.find((row: any) => String(row.id).trim() === selectedTaskId.value)
  if (fresh)
    selectedTask.value = fresh
  if (resultVisible.value && resultTaskId.value) {
    const current = list.find((row: any) => String(row.id).trim() === resultTaskId.value)
    if (current && current.status !== resultDetail.value?.task?.status)
      void loadResult(resultTaskId.value)
  }
})
onActivated(() => {
  void fetchList()
  syncPolling()
})
onDeactivated(stopPolling)
onUnmounted(stopPolling)

function summaryOf(record: any): Record<string, number> | null {
  return record?.summary_json && typeof record.summary_json === 'object' ? record.summary_json : null
}

// ── 删除 ───────────────────────────────────────────
async function handleDelete(record: any) {
  const res = await postAction<boolean>(ApiSecCustomApiTask.delete, { task_id: String(record.id).trim() })
  if (res === null)
    return
  Message.success(`已删除任务「${record.name}」`)
  if (String(record.id).trim() === selectedTaskId.value) {
    selectedTask.value = null
    scope.value = { kind: 'all', code: '', appNumber: '', label: '全部接口' }
  }
  await fetchList()
}
</script>

<template>
  <div class="custom-api-test">
    <ListPage :aside-width="300" aside-resizable :aside-max-width="520">
      <template #aside-title>
        <div class="aside-title-row">
          <span>归属维度</span>
          <a-select v-model="dimension" size="small" class="dimension-select">
            <a-option v-for="d in DIMENSION_OPTIONS" :key="d.value" :value="d.value">
              {{ d.label }}
            </a-option>
          </a-select>
        </div>
      </template>
      <template #aside>
        <div v-if="selectedTask" class="aside-task">
          任务：{{ selectedTask.name }}
        </div>
        <ApiInventoryTree
          :dimension="dimension"
          depth="api"
          :endpoint="ApiSecCustomApiTask.tree"
          :extra-params="treeParams"
          :idle="!selectedTaskId"
          empty-text="点击右侧列表中的任务，查看其包含的 API"
          @select="handleTreeSelect"
        />
      </template>

      <template #filter>
        <div class="filter-bar">
          <div class="f-wide">
            <a-input
              v-model="searchForm.keyword"
              placeholder="任务名称"
              allow-clear
              @press-enter="handleSearch"
              @clear="handleSearch"
            />
          </div>
          <a-button type="primary" @click="handleSearch">
            查询
          </a-button>
          <a-button @click="handleReset">
            重置
          </a-button>
        </div>
      </template>

      <template #toolbar>
        <a-tag v-if="selectedApiPath" color="arcoblue">
          已选 API：{{ selectedApiPath }}
        </a-tag>
        <span v-else-if="selectedTask" class="scope-hint">已选任务：{{ selectedTask.name }}</span>
        <div class="toolbar-spacer" />
        <a-button type="primary" @click="openImport">
          导入API信息
        </a-button>
      </template>

      <template #default="{ tableHeight }">
        <a-table
          :data="rows"
          :loading="loading"
          :pagination="pagination"
          :scroll="{ y: tableHeight }"
          :row-class="rowClass"
          row-key="id"
          @row-click="selectTask"
          @page-change="handlePageChange"
          @page-size-change="handlePageSizeChange"
        >
          <template #columns>
            <a-table-column title="任务名称" data-index="name" :min-width="220" ellipsis tooltip />
            <a-table-column title="API 数" data-index="api_count" :width="90" />
            <a-table-column title="未匹配" :width="90">
              <template #cell="{ record }">
                <a-tooltip v-if="unmatchedOf(record).length" :content="unmatchedOf(record).join('\n')">
                  <a-tag color="orangered">
                    {{ unmatchedOf(record).length }}
                  </a-tag>
                </a-tooltip>
                <span v-else>0</span>
              </template>
            </a-table-column>
            <a-table-column title="状态" :width="100">
              <template #cell="{ record }">
                <a-tooltip v-if="record.status === 'failed' && record.error_message" :content="record.error_message">
                  <a-tag color="red">
                    失败
                  </a-tag>
                </a-tooltip>
                <a-tag v-else :color="STATUS_LABELS[record.status]?.color || 'gray'">
                  {{ STATUS_LABELS[record.status]?.text || record.status }}
                </a-tag>
              </template>
            </a-table-column>
            <a-table-column title="检测结果" :width="230">
              <template #cell="{ record }">
                <a-space v-if="summaryOf(record)" :size="4" wrap>
                  <a-tag v-if="summaryOf(record)!.confirmed" size="small" color="red">
                    确认问题 {{ summaryOf(record)!.confirmed }}
                  </a-tag>
                  <a-tag size="small" color="green">
                    已排除 {{ summaryOf(record)!.excluded || 0 }}
                  </a-tag>
                  <a-tag size="small" color="gray">
                    未找到 {{ summaryOf(record)!.not_found || 0 }}
                  </a-tag>
                  <a-tag v-if="summaryOf(record)!.undecided" size="small" color="orangered">
                    未判定 {{ summaryOf(record)!.undecided }}
                  </a-tag>
                </a-space>
                <span v-else class="muted">-</span>
              </template>
            </a-table-column>
            <a-table-column title="创建时间" :width="170">
              <template #cell="{ record }">
                {{ formatTime(record.created_at) }}
              </template>
            </a-table-column>
            <a-table-column title="操作" :width="190" fixed="right">
              <template #cell="{ record }">
                <a-space :size="2" @click.stop>
                  <a-button type="text" size="mini" :disabled="record.status === 'running'" @click="openRun(record)">
                    {{ record.status === 'pending' ? '运行' : '重新运行' }}
                  </a-button>
                  <a-button type="text" size="mini" :disabled="record.status === 'pending'" @click="openResult(record)">
                    扫描结果
                  </a-button>
                  <a-popconfirm :content="`确定删除任务「${record.name}」吗？`" type="warning" @ok="handleDelete(record)">
                    <a-button type="text" size="mini" status="danger" :disabled="record.status === 'running'">
                      删除
                    </a-button>
                  </a-popconfirm>
                </a-space>
              </template>
            </a-table-column>
          </template>
        </a-table>
      </template>
    </ListPage>

    <a-modal
      v-model:visible="importVisible"
      title="导入API信息"
      :width="640"
      :ok-loading="importing"
      ok-text="生成任务"
      :on-before-ok="handleImport"
    >
      <a-form :model="importForm" layout="vertical">
        <a-form-item label="要测试的 API（每行一个调用路径）" required>
          <a-textarea
            v-model="importForm.text"
            :auto-size="{ minRows: 8, maxRows: 16 }"
            placeholder="/v2/pom/mftOrderTransmit&#10;/v2/iscc/getQueryBillInfo"
          />
          <template #extra>
            已输入 {{ inputLineCount }} 行。在 API 资产中按调用路径精确匹配，不带 /kapi 前缀时自动补上；也可以带 HTTP 方法或完整 URL。
          </template>
        </a-form-item>
        <a-form-item label="任务名称">
          <a-input v-model="importForm.name" placeholder="留空自动生成" :max-length="200" allow-clear />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal
      v-model:visible="runVisible"
      :title="`运行：${runTask?.name || ''}`"
      :width="560"
      :ok-loading="runSubmitting"
      ok-text="开始运行"
      :on-before-ok="handleRun"
    >
      <a-spin :loading="runLookupsLoading" style="display: block">
        <a-form :model="runForm" layout="vertical">
          <a-form-item label="代码库" required>
            <a-select v-model="runForm.repositoryId" :options="repoOptions" placeholder="选择应用对应的代码库" allow-search />
            <template #extra>
              默认选中任务内 API 所属应用的反编译源码库。平台先按 API 定义里登记的实现类在代码库中定位代码，找不到的直接判为「未找到API」。
            </template>
          </a-form-item>
          <a-form-item label="Agent" required>
            <a-select v-model="runForm.agentCode" placeholder="选择 AI Agent">
              <a-option v-for="agent in agentList" :key="agent.agent_code" :value="agent.agent_code">
                {{ agent.agent_name || agent.agent_code }}（{{ agent.agent_code }}）
              </a-option>
            </a-select>
          </a-form-item>
          <a-form-item label="模型">
            <a-select v-model="runForm.model" :options="modelOptions" allow-search />
          </a-form-item>
        </a-form>
      </a-spin>
    </a-modal>

    <a-modal
      v-model:visible="resultVisible"
      :title="`扫描结果：${resultDetail?.task?.name || ''}`"
      width="80vw"
      :footer="false"
      :body-style="{ maxHeight: '78vh', overflow: 'auto' }"
    >
      <a-spin :loading="resultLoading" style="display: block; min-height: 120px">
        <template v-if="resultDetail">
          <a-descriptions :column="3" size="small" bordered class="result-desc">
            <a-descriptions-item label="状态">
              <a-tag :color="STATUS_LABELS[resultDetail.task.status]?.color || 'gray'">
                {{ STATUS_LABELS[resultDetail.task.status]?.text || resultDetail.task.status }}
              </a-tag>
            </a-descriptions-item>
            <a-descriptions-item label="代码库">
              {{ resultDetail.repository_name || '-' }}
            </a-descriptions-item>
            <a-descriptions-item label="Agent / 模型">
              {{ resultDetail.task.agent_code || '-' }} / {{ resultDetail.task.model || 'Agent 默认' }}
            </a-descriptions-item>
            <a-descriptions-item label="开始时间">
              {{ formatTime(resultDetail.task.started_at) || '-' }}
            </a-descriptions-item>
            <a-descriptions-item label="结束时间">
              {{ formatTime(resultDetail.task.finished_at) || '-' }}
            </a-descriptions-item>
            <a-descriptions-item label="AI 执行">
              {{ resultDetail.task.ai_execution_id || '-' }}
            </a-descriptions-item>
          </a-descriptions>
          <a-alert v-if="resultDetail.task.status === 'running'" type="info" class="result-alert">
            正在运行：定位 API 代码并由 AI 扫描，完成后自动刷新。
          </a-alert>
          <a-alert v-if="resultDetail.task.error_message" type="error" class="result-alert">
            {{ resultDetail.task.error_message }}
          </a-alert>
          <a-tabs v-model:active-key="resultTab">
            <a-tab-pane key="report" title="检测报告">
              <MdPreview v-if="resultDetail.task.report_md" :model-value="resultDetail.task.report_md" />
              <a-empty v-else description="暂无报告" />
            </a-tab-pane>
            <a-tab-pane key="items" :title="`API 明细（${resultDetail.items.length}）`">
              <a-table :data="resultDetail.items" :pagination="false" row-key="id" size="small" :scroll="{ x: 1100 }">
                <template #columns>
                  <a-table-column title="调用路径" :width="300">
                    <template #cell="{ record }">
                      <div class="mono">
                        {{ record.http_method }} {{ record.call_path }}
                      </div>
                      <div class="muted">
                        {{ record.api_name || record.api_number }}
                      </div>
                    </template>
                  </a-table-column>
                  <a-table-column title="结论" :width="110">
                    <template #cell="{ record }">
                      <a-tag v-if="record.verdict" :color="VERDICT_LABELS[record.verdict]?.color || 'gray'">
                        {{ VERDICT_LABELS[record.verdict]?.text || record.verdict }}
                      </a-tag>
                      <a-tag v-else color="orangered">
                        未判定
                      </a-tag>
                    </template>
                  </a-table-column>
                  <a-table-column title="风险" :width="70">
                    <template #cell="{ record }">
                      <a-tag v-if="record.severity" size="small" :color="SEVERITY_LABELS[record.severity]?.color || 'gray'">
                        {{ SEVERITY_LABELS[record.severity]?.text || record.severity }}
                      </a-tag>
                      <span v-else class="muted">-</span>
                    </template>
                  </a-table-column>
                  <a-table-column title="代码定位" :width="380">
                    <template #cell="{ record }">
                      <template v-if="filesOf(record).length">
                        <a-tooltip v-for="target in filesOf(record)" :key="`${target.class_name}-${target.operation || ''}`" :content="target.file || ''">
                          <div class="mono target-line">
                            {{ targetLabel(target) }}
                          </div>
                        </a-tooltip>
                      </template>
                      <span v-else class="muted">{{ record.locate_note || '未定位' }}</span>
                    </template>
                  </a-table-column>
                  <a-table-column title="说明" :min-width="260">
                    <template #cell="{ record }">
                      {{ record.ai_summary || record.locate_note || '-' }}
                    </template>
                  </a-table-column>
                </template>
              </a-table>
            </a-tab-pane>
          </a-tabs>
        </template>
      </a-spin>
    </a-modal>
  </div>
</template>

<style scoped>
.custom-api-test {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.custom-api-test > :deep(.list-page) {
  flex: 1 1 auto;
  min-height: 0;
}

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

/* 宽度落在包裹 div 上：Arco 的 Select / Input 是 inheritAttrs: false */
.f-wide {
  width: 240px;
}

.filter-bar > div :deep(.arco-input-wrapper) {
  width: 100%;
}

.aside-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.aside-title-row > span {
  white-space: nowrap;
}

.dimension-select {
  width: 128px;
  font-weight: 400;
}

.aside-task {
  margin-bottom: 8px;
  color: var(--color-text-2);
  font-size: 12px;
  word-break: break-all;
}

.toolbar-spacer {
  flex: 1;
}

.scope-hint {
  color: var(--color-text-3);
  font-size: 12px;
}

.custom-api-test :deep(.arco-table-tr) {
  cursor: pointer;
}

.muted {
  color: var(--color-text-3);
  font-size: 12px;
}

.mono {
  font-family: var(--font-family-mono, Consolas, monospace);
  font-size: 12px;
  word-break: break-all;
}

.target-line {
  line-height: 18px;
}

.result-desc {
  margin-bottom: 12px;
}

.result-alert {
  margin-bottom: 12px;
}

.custom-api-test :deep(.row-selected > .arco-table-td) {
  background-color: var(--color-primary-light-1);
}
</style>
