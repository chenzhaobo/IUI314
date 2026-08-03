<script lang="ts" setup>
import type {
  BranchesControlResponse,
  ModuleSummary,
  MutationReceipt,
  PageResult,
  RepositoryBinding,
  RepositoryBindRequest,
  RepositoryBranch,
  RepositoryListResponse,
  SourceJobStatus,
  SourceSnapshotRequest,
  WorkerJobReceipt,
} from '@/types/static-scan'
import { Message } from '@arco-design/web-vue'
import { computed, onMounted, ref, watch } from 'vue'
import * as XLSX from 'xlsx'
import { ApiPerfModule } from '@/api/perfApis'
import { ApiSecModuleRepository, ApiSecProjectGroup } from '@/api/sechubApis'
import StatusBadge from '@/components/static-scan/StatusBadge.vue'
import { useDelete, useDicts, useGet, usePost, usePut } from '@/hooks'

defineOptions({ name: 'ModuleMng' })

interface ProjectGroup {
  id: string
  name: string
}

interface DictOption {
  label: string
  value: string
}

interface ModuleForm {
  id?: string
  name: string
  code: string
  status: string
  module_code: string
  scrum_team: string
  project_group_id?: string
  product_group: string
  owner: string
  requirement_owner: string
  offering_product: string
  material_code: string
  material_name: string
  material_short_code: string
  material_type: string
  parent_cloud: string
}

interface SyncCloudResult {
  total?: number
  updated?: number
  skipped?: number
  unmatched?: number
}

type ExcelCell = string | number | boolean | null | undefined
type ExcelRow = Record<string, ExcelCell>
type ImportModule = Record<string, string | null>
type RepositoryBindForm = Omit<RepositoryBindRequest, 'credential_ref' | 'root_path' | 'default_scan_branch'> & {
  credential_ref: string
  root_path: string
  default_scan_branch: string
}

function listOf<T>(value: unknown): T[] {
  if (Array.isArray(value))
    return value as T[]
  if (value && typeof value === 'object' && Array.isArray((value as { list?: unknown }).list))
    return (value as PageResult<T>).list
  return []
}

function emptyModuleForm(): ModuleForm {
  return {
    name: '',
    code: '',
    status: '可用',
    module_code: '',
    scrum_team: '',
    project_group_id: undefined,
    product_group: '',
    owner: '',
    requirement_owner: '',
    offering_product: '',
    material_code: '',
    material_name: '',
    material_short_code: '',
    material_type: '',
    parent_cloud: '',
  }
}

function toModuleForm(record: ModuleSummary): ModuleForm {
  return {
    id: record.id,
    name: record.name,
    code: record.code,
    status: record.status,
    module_code: record.module_code,
    scrum_team: record.scrum_team ?? '',
    project_group_id: record.project_group_id || undefined,
    product_group: record.product_group ?? '',
    owner: record.owner ?? '',
    requirement_owner: record.requirement_owner ?? '',
    offering_product: record.offering_product ?? '',
    material_code: record.material_code ?? '',
    material_name: record.material_name ?? '',
    material_short_code: record.material_short_code ?? '',
    material_type: record.material_type ?? '',
    parent_cloud: record.parent_cloud ?? '',
  }
}

// ── 项目组和所属云 ────────────────────────────────
const projectGroupOptions = ref<Array<{ label: string, value: string }>>([])
const projectGroupMap = ref(new Map<string, string>())
const cloudOptions = ref<string[]>([])

async function loadProjectGroups() {
  const { execute, data } = useGet<ProjectGroup[]>(ApiSecProjectGroup.getAll, {}, { immediate: false })
  await execute()
  const list = listOf<ProjectGroup>(data.value)
  projectGroupOptions.value = list.map(pg => ({ label: pg.name, value: pg.id }))
  projectGroupMap.value = new Map(list.map(pg => [pg.id, pg.name]))
}

async function loadCloudOptions() {
  const { execute, data } = useGet<string[]>(ApiPerfModule.cloudOptions, {}, { immediate: false })
  await execute()
  cloudOptions.value = listOf<string>(data.value)
}

onMounted(() => {
  void loadProjectGroups()
  void loadCloudOptions()
})

// ── 列表查询 ──────────────────────────────────────
const queryParams = ref({
  page_num: 1,
  page_size: 20,
  keyword: '',
  status: '',
  project_group_id: '',
  parent_cloud: '',
})

const { isFetching: isLoading, data: rawListData, execute: getList } = useGet<PageResult<ModuleSummary>>(
  ApiPerfModule.getList,
  queryParams,
  { immediate: true },
)
const dataList = computed(() => rawListData.value?.list ?? [])
const total = computed(() => rawListData.value?.total ?? 0)

function handleSearch() {
  queryParams.value.page_num = 1
  void getList()
}

function handlePageChange(page: number) {
  queryParams.value.page_num = page
  void getList()
}

// ── 字典：状态 ────────────────────────────────────
const dicts = useDicts('perf_module_status')
const statusOptions = computed<DictOption[]>(() => {
  const rawItems: unknown = dicts.value.perf_module_status
  const items = Array.isArray(rawItems) ? rawItems : []
  const dynamicItems = items
    .filter((item): item is DictOption => Boolean(
      item
      && typeof item === 'object'
      && 'label' in item
      && 'value' in item
      && typeof item.label === 'string'
      && typeof item.value === 'string',
    ))
  return [{ label: '全部', value: '' }, ...dynamicItems]
})
const statusTagColor: Readonly<Record<string, string>> = { 可用: 'green', 禁用: 'red' }

const columns = [
  { title: '名称', dataIndex: 'name', width: 180, ellipsis: true, tooltip: true },
  { title: '编码', dataIndex: 'code', width: 130, ellipsis: true, tooltip: true },
  { title: '状态', dataIndex: 'status', width: 80, slotName: 'status' },
  { title: '模块简码', dataIndex: 'module_code', width: 120, ellipsis: true, tooltip: true },
  { title: '关联项目组', dataIndex: 'scrum_team', width: 140, ellipsis: true, tooltip: true, slotName: 'scrum_team' },
  { title: '物料简码', dataIndex: 'material_short_code', width: 120, ellipsis: true, tooltip: true },
  { title: '物料类型', dataIndex: 'material_type', width: 100, ellipsis: true, tooltip: true },
  { title: '所属云', dataIndex: 'parent_cloud', width: 120, ellipsis: true, tooltip: true },
  { title: '负责人', dataIndex: 'owner', width: 90, ellipsis: true, tooltip: true },
  { title: '操作', dataIndex: 'operations', slotName: 'operations', width: 200, fixed: 'right' as const },
]

// ── 新增/编辑 ─────────────────────────────────────
const modalVisible = ref(false)
const isEdit = ref(false)
const form = ref<ModuleForm>(emptyModuleForm())
const submitting = ref(false)

function handleAdd() {
  isEdit.value = false
  form.value = emptyModuleForm()
  modalVisible.value = true
}

function handleEdit(record: ModuleSummary) {
  isEdit.value = true
  form.value = toModuleForm(record)
  modalVisible.value = true
}

function handleProjectGroupChange(value: unknown) {
  const pgId = typeof value === 'string' ? value : ''
  form.value.project_group_id = pgId || undefined
  form.value.scrum_team = pgId ? (projectGroupMap.value.get(pgId) ?? '') : ''
}

async function handleSubmit() {
  if (!form.value.name) {
    Message.warning('请输入名称')
    return
  }
  if (!form.value.code) {
    Message.warning('请输入编码')
    return
  }
  if (!form.value.module_code) {
    Message.warning('请输入模块简码')
    return
  }
  submitting.value = true
  try {
    if (isEdit.value) {
      const { execute, error } = usePut(ApiPerfModule.edit, form.value)
      await execute()
      if (error.value) {
        Message.error('编辑失败')
        return
      }
      Message.success('编辑成功')
    }
    else {
      const { execute, error } = usePost(ApiPerfModule.add, form.value)
      await execute()
      if (error.value) {
        Message.error('添加失败')
        return
      }
      Message.success('添加成功')
    }
    modalVisible.value = false
    void getList()
  }
  finally {
    submitting.value = false
  }
}

async function handleDelete(record: ModuleSummary) {
  const { execute, error } = useDelete(ApiPerfModule.delete, { ids: [record.id] })
  await execute()
  if (error.value) {
    Message.error('删除失败')
    return
  }
  Message.success('删除成功')
  void getList()
}

const syncingCloud = ref(false)
async function handleSyncCloud() {
  syncingCloud.value = true
  try {
    const { execute, error, data } = usePost<SyncCloudResult>(ApiPerfModule.syncCloud, {})
    await execute()
    if (error.value) {
      Message.error('同步失败')
      return
    }
    const result = data.value ?? {}
    Message.success(`同步完成：共 ${result.total ?? 0} 条，更新 ${result.updated ?? 0} 条，跳过 ${result.skipped ?? 0} 条，未匹配 ${result.unmatched ?? 0} 条`)
    void getList()
    void loadCloudOptions()
  }
  finally {
    syncingCloud.value = false
  }
}

// ── Excel 导入 ────────────────────────────────────
const fileInputRef = ref<HTMLInputElement | null>(null)
const importing = ref(false)

function handleImportClick() {
  fileInputRef.value?.click()
}

async function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file)
    return

  importing.value = true
  try {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const firstSheetName = workbook.SheetNames[0]
    const sheet = firstSheetName ? workbook.Sheets[firstSheetName] : undefined
    if (!sheet) {
      Message.warning('Excel 中没有可读取的工作表')
      return
    }
    const rows = XLSX.utils.sheet_to_json<ExcelRow>(sheet, { defval: '' })
    const fieldMap: Readonly<Record<string, string>> = {
      名称: 'name',
      编码: 'code',
      状态: 'status',
      模块简码: 'module_code',
      关联Scrum团队: 'scrum_team',
      产品领域: 'product_group',
      负责人: 'owner',
      需求负责人: 'requirement_owner',
      offering产品: 'offering_product',
      研发物料编码: 'material_code',
      研发物料名称: 'material_name',
      物料简码: 'material_short_code',
      物料类型: 'material_type',
      所属云: 'parent_cloud',
    }

    const modules: ImportModule[] = []
    let skipped = 0
    for (const row of rows) {
      const module: ImportModule = {}
      for (const [cn, en] of Object.entries(fieldMap)) {
        const cell = row[cn]
        if (cell !== undefined && cell !== null && cell !== '')
          module[en] = String(cell).trim()
        else
          module[en] = en === 'status' ? '可用' : (['name', 'code', 'module_code'].includes(en) ? '' : null)
      }
      if (!module.module_code) {
        skipped += 1
        continue
      }
      if (!module.name)
        module.name = module.module_code
      if (!module.code)
        module.code = module.module_code
      modules.push(module)
    }

    if (!modules.length) {
      Message.warning(`没有可导入的数据（跳过 ${skipped} 条模块简码为空的行）`)
      return
    }
    const { execute, error } = usePost(ApiPerfModule.import, modules)
    await execute()
    if (error.value) {
      Message.error('导入失败')
      return
    }
    Message.success(`导入完成！共 ${modules.length} 条（跳过 ${skipped} 条空模块简码）`)
    void getList()
  }
  catch (error: unknown) {
    Message.error('文件解析失败，请检查格式')
    console.error(error)
  }
  finally {
    importing.value = false
    if (fileInputRef.value)
      fileInputRef.value.value = ''
  }
}

// ── 模块详情 / 代码仓库 ──────────────────────────
const detailVisible = ref(false)
const detailTab = ref('base')
const detailModule = ref<ModuleSummary | null>(null)
const repositories = ref<RepositoryBinding[]>([])
const repositoryLoading = ref(false)
const branchLoading = ref(false)
const branches = ref<RepositoryBranch[]>([])
const selectedRelationId = ref('')
const checkoutBranch = ref('')
const checkoutRef = ref('')
const operationLoading = ref('')
const sourceJobs = ref<SourceJobStatus[]>([])
const bindVisible = ref(false)
const bindLoading = ref(false)
const bindForm = ref<RepositoryBindForm>({
  module_id: '',
  code: '',
  git_url: '',
  name: '',
  default_branch: 'main',
  credential_ref: '',
  root_path: '',
  default_scan_branch: 'main',
  scan_enabled: true,
  is_primary: true,
  allow_local_test_repository: false,
  idempotency_key: '',
})

const selectedRepository = computed(() => repositories.value.find(item => item.relation_id === selectedRelationId.value) ?? null)
const repositoryColumns = [
  { title: '仓库', dataIndex: 'name', slotName: 'repository', width: 250 },
  { title: '默认 / 扫描分支', dataIndex: 'default_branch', slotName: 'branch', width: 180 },
  { title: '凭据引用', dataIndex: 'credential_ref', slotName: 'credential', width: 190 },
  { title: '状态', dataIndex: 'status', slotName: 'repo_status', width: 130 },
  { title: '操作', slotName: 'repo_operations', width: 300, fixed: 'right' as const },
]
const taskColumns = [
  { title: 'Job ID', dataIndex: 'job_id', width: 260, ellipsis: true, tooltip: true },
  { title: '任务类型', dataIndex: 'job_kind', width: 120 },
  { title: '状态', dataIndex: 'status', slotName: 'task_status', width: 120 },
  { title: '尝试', dataIndex: 'attempt_count', slotName: 'attempts', width: 90 },
  { title: '结果 / 错误', dataIndex: 'error_message', slotName: 'task_result', ellipsis: true, tooltip: true },
]

const terminalSourceJobStatuses = new Set(['succeeded', 'failed', 'cancelled', 'timed_out'])
const pollingSourceJobIds = new Set<string>()

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function trackSourceJob(receipt: WorkerJobReceipt) {
  const job: SourceJobStatus = {
    ...receipt,
    attempt_count: 0,
    max_attempts: 3,
  }
  sourceJobs.value = [job, ...sourceJobs.value.filter(item => item.job_id !== job.job_id)]
  void pollSourceJob(job.job_id)
}

async function pollSourceJob(jobId: string) {
  if (pollingSourceJobIds.has(jobId))
    return
  pollingSourceJobIds.add(jobId)
  try {
    for (let poll = 0; poll < 300 && detailVisible.value; poll += 1) {
      const { data, execute, error } = useGet<SourceJobStatus>(
        ApiSecModuleRepository.sourceJob,
        { job_id: jobId },
        { immediate: false },
      )
      await execute()
      if (!error.value && data.value) {
        const status = data.value
        const index = sourceJobs.value.findIndex(item => item.job_id === jobId)
        if (index >= 0)
          sourceJobs.value[index] = status
        if (terminalSourceJobStatuses.has(status.status)) {
          if (status.status === 'succeeded')
            Message.success(`${status.job_kind} 已完成${status.output_commit_sha ? `：${status.output_commit_sha.slice(0, 12)}` : ''}`)
          else
            Message.error(`${status.job_kind} ${status.status}：${status.error_message || status.error_class || '未返回错误详情'}`)
          await loadRepositories()
          return
        }
      }
      await delay(2000)
    }
  }
  finally {
    pollingSourceJobIds.delete(jobId)
  }
}

async function loadRepositories() {
  if (!detailModule.value)
    return
  repositoryLoading.value = true
  try {
    const { data, execute } = useGet<RepositoryListResponse>(
      ApiSecModuleRepository.list,
      { module_id: detailModule.value.id, include_disabled: true },
      { immediate: false },
    )
    await execute()
    repositories.value = data.value?.list ?? []
    if (!selectedRelationId.value || !repositories.value.some(item => item.relation_id === selectedRelationId.value))
      selectedRelationId.value = repositories.value[0]?.relation_id ?? ''
  }
  finally {
    repositoryLoading.value = false
  }
}

async function openDetail(record: ModuleSummary) {
  detailModule.value = record
  detailTab.value = 'base'
  detailVisible.value = true
  selectedRelationId.value = ''
  sourceJobs.value = []
  await loadRepositories()
}

function openBind() {
  bindForm.value = {
    module_id: detailModule.value?.id ?? '',
    code: detailModule.value?.code ?? '',
    git_url: '',
    name: `${detailModule.value?.name ?? ''}代码仓库`,
    default_branch: 'main',
    credential_ref: '',
    root_path: '',
    default_scan_branch: 'main',
    scan_enabled: true,
    is_primary: repositories.value.length === 0,
    allow_local_test_repository: false,
    idempotency_key: crypto.randomUUID(),
  }
  bindVisible.value = true
}

async function submitBind() {
  if (!detailModule.value || !bindForm.value.git_url || !bindForm.value.default_branch) {
    Message.warning('请填写 Git URL 和默认分支')
    return
  }
  bindLoading.value = true
  try {
    const payload: RepositoryBindRequest = {
      ...bindForm.value,
      module_id: detailModule.value.id,
      code: bindForm.value.code || detailModule.value.code,
      credential_ref: bindForm.value.credential_ref || null,
      root_path: bindForm.value.root_path || null,
      default_scan_branch: bindForm.value.default_scan_branch || null,
      idempotency_key: crypto.randomUUID(),
    }
    const { execute, error } = usePost<MutationReceipt>(ApiSecModuleRepository.bind, payload, { immediate: false })
    await execute()
    if (error.value)
      return
    Message.success('仓库绑定成功，凭据仅保存引用')
    bindVisible.value = false
    await loadRepositories()
  }
  finally {
    bindLoading.value = false
  }
}

async function validateRepository(repository: RepositoryBinding) {
  operationLoading.value = `validate:${repository.relation_id}`
  try {
    const { data, execute, error } = usePost<WorkerJobReceipt>(
      ApiSecModuleRepository.validate,
      {
        git_url: repository.git_url,
        credential_ref: repository.credential_ref ?? null,
        default_branch: repository.default_branch,
        allow_local_test_repository: repository.git_url.startsWith('local-test:'),
        idempotency_key: crypto.randomUUID(),
      },
      { immediate: false },
    )
    await execute()
    if (error.value)
      return
    if (data.value)
      trackSourceJob(data.value)
    Message.success('已提交连通性验证')
    await loadRepositories()
  }
  finally {
    operationLoading.value = ''
  }
}

async function repositoryOperation(repository: RepositoryBinding, operation: 'clone' | 'update' | 'checkout') {
  operationLoading.value = `${operation}:${repository.relation_id}`
  try {
    const revision: SourceSnapshotRequest['revision'] = {}
    if (operation === 'checkout') {
      const explicitRef = checkoutRef.value.trim()
      if (explicitRef) {
        if (/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/i.test(explicitRef))
          revision.commit = explicitRef
        else
          revision.tag = explicitRef
      }
      else if (checkoutBranch.value) {
        revision.branch = checkoutBranch.value
      }
      else {
        Message.warning('请选择分支，或输入 Tag / 完整 Commit SHA')
        return
      }
    }
    const payload: SourceSnapshotRequest = {
      module_id: repository.module_id,
      relation_id: repository.relation_id,
      operation,
      revision,
      idempotency_key: crypto.randomUUID(),
    }
    const { data, execute, error } = usePost<WorkerJobReceipt>(ApiSecModuleRepository.sourceSnapshot, payload, { immediate: false })
    await execute()
    if (error.value)
      return
    if (data.value)
      trackSourceJob(data.value)
    Message.success(`已提交 ${operation} 任务；更新采用 fetch + 新 checkout，不改历史快照`)
    await loadRepositories()
  }
  finally {
    operationLoading.value = ''
  }
}

async function loadBranches() {
  const repository = selectedRepository.value
  branches.value = []
  if (!repository)
    return
  branchLoading.value = true
  try {
    const { data, execute } = useGet<BranchesControlResponse>(
      ApiSecModuleRepository.branches,
      { module_id: repository.module_id, relation_id: repository.relation_id, refresh: false },
      { immediate: false },
    )
    await execute()
    branches.value = data.value?.result === 'cached' ? data.value.data.branches : []
    checkoutBranch.value = repository.default_scan_branch || repository.default_branch
  }
  finally {
    branchLoading.value = false
  }
}

watch(selectedRelationId, () => void loadBranches())
</script>

<template>
  <div class="perf-module-mng">
    <a-card :bordered="false" class="m-b-8px">
      <a-row :gutter="16">
        <a-col :span="6">
          <a-input-search v-model="queryParams.keyword" placeholder="搜索名称/编码/模块简码" allow-clear @search="handleSearch" @press-enter="handleSearch" />
        </a-col>
        <a-col :span="4">
          <a-select v-model="queryParams.status" :options="statusOptions" placeholder="状态" allow-clear @change="handleSearch" />
        </a-col>
        <a-col :span="4">
          <a-select v-model="queryParams.parent_cloud" placeholder="所属云" allow-clear allow-search @change="handleSearch">
            <a-option v-for="cloud in cloudOptions" :key="cloud" :value="cloud">
              {{ cloud }}
            </a-option>
          </a-select>
        </a-col>
        <a-col :span="5">
          <a-select v-model="queryParams.project_group_id" :options="projectGroupOptions" placeholder="项目组" allow-clear allow-search @change="handleSearch" />
        </a-col>
        <a-col :span="5">
          <a-space>
            <a-button type="primary" @click="handleSearch">
              搜索
            </a-button>
            <a-button type="primary" status="success" @click="handleAdd">
              <template #icon>
                <icon-plus />
              </template>新增
            </a-button>
            <a-button type="primary" status="warning" :loading="importing" @click="handleImportClick">
              <template #icon>
                <icon-upload />
              </template>Excel导入
            </a-button>
          </a-space>
        </a-col>
      </a-row>
      <a-row :gutter="16" class="m-t-8px">
        <a-col :span="6">
          <a-button :loading="syncingCloud" @click="handleSyncCloud">
            <template #icon>
              <icon-sync />
            </template>同步所属云
          </a-button>
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
        <template #status="{ record }">
          <a-tag :color="statusTagColor[record.status] || 'gray'">
            {{ record.status }}
          </a-tag>
        </template>
        <template #scrum_team="{ record }">
          {{ projectGroupMap.get(record.project_group_id) || record.scrum_team || '-' }}
        </template>
        <template #operations="{ record }">
          <a-space>
            <a-button type="text" size="small" @click="openDetail(record)">
              详情
            </a-button>
            <a-button type="text" size="small" @click="handleEdit(record)">
              编辑
            </a-button>
            <a-popconfirm content="确认删除？删除后不可恢复" @ok="handleDelete(record)">
              <a-button type="text" size="small" status="danger">
                删除
              </a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </a-table>
    </a-card>

    <a-modal v-model:visible="modalVisible" :title="isEdit ? '编辑模块' : '新增模块'" :width="720" :ok-loading="submitting" @ok="handleSubmit">
      <a-form :model="form" layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="名称" required>
              <a-input v-model="form.name" placeholder="请输入名称" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="编码" required>
              <a-input v-model="form.code" placeholder="请输入编码" :disabled="isEdit" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="模块简码" required>
              <a-input v-model="form.module_code" placeholder="请输入模块简码" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="状态">
              <a-select v-model="form.status" :options="statusOptions.filter(option => option.value)" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="关联项目组">
              <a-select v-model="form.project_group_id" :options="projectGroupOptions" placeholder="选择项目组" allow-clear allow-search @change="handleProjectGroupChange" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="产品领域">
              <a-input v-model="form.product_group" placeholder="请输入" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="负责人">
              <a-input v-model="form.owner" placeholder="请输入" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="需求负责人">
              <a-input v-model="form.requirement_owner" placeholder="请输入" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="offering产品">
              <a-input v-model="form.offering_product" placeholder="请输入" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="所属云">
              <a-input v-model="form.parent_cloud" placeholder="请输入" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item label="研发物料编码">
              <a-input v-model="form.material_code" placeholder="请输入" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="物料简码">
              <a-input v-model="form.material_short_code" placeholder="请输入" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="物料类型">
              <a-input v-model="form.material_type" placeholder="请输入" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="研发物料名称">
          <a-input v-model="form.material_name" placeholder="请输入" />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-drawer :visible="detailVisible" :width="1220" :title="`模块详情 · ${detailModule?.name || ''}`" @cancel="detailVisible = false" @ok="detailVisible = false">
      <a-tabs v-model:active-key="detailTab">
        <a-tab-pane key="base" title="基本信息">
          <a-descriptions
            v-if="detailModule" bordered :column="3" :data="[
              { label: '名称', value: detailModule.name },
              { label: '编码', value: detailModule.code },
              { label: '模块简码', value: detailModule.module_code },
              { label: '状态', value: detailModule.status },
              { label: '负责人', value: detailModule.owner || '-' },
              { label: '项目组', value: projectGroupMap.get(detailModule.project_group_id || '') || detailModule.scrum_team || '-' },
            ]"
          />
        </a-tab-pane>
        <a-tab-pane key="repository" title="代码仓库">
          <a-alert type="info" show-icon class="m-b-12px">
            Git 凭据只显示引用和状态；“更新工程”底层是 fetch + 新不可变 checkout，不会污染历史扫描快照。
          </a-alert>
          <a-space class="m-b-12px">
            <a-button type="primary" @click="openBind">
              绑定仓库
            </a-button>
            <a-button :loading="repositoryLoading" @click="loadRepositories">
              刷新
            </a-button>
          </a-space>
          <a-table :loading="repositoryLoading" :data="repositories" :columns="repositoryColumns" :pagination="false" row-key="relation_id" :scroll="{ x: 1280 }" size="small">
            <template #repository="{ record }">
              <div>
                <strong>{{ record.name }}</strong> <a-tag v-if="record.git_url.startsWith('local-test:')" color="orangered">
                  LOCAL TEST · 服务端策略门禁
                </a-tag>
              </div>
              <a-link :href="record.git_url" target="_blank">
                {{ record.git_url }}
              </a-link>
              <div class="secondary">
                root: {{ record.root_path || '.' }}
              </div>
            </template>
            <template #branch="{ record }">
              <div>默认：{{ record.default_branch }}</div>
              <div>扫描：{{ record.default_scan_branch || '-' }}</div>
            </template>
            <template #credential="{ record }">
              <div>{{ record.credential_ref || '未配置引用' }}</div>
            </template>
            <template #repo_status="{ record }">
              <StatusBadge :status="record.status" size="small" />
            </template>
            <template #repo_operations="{ record }">
              <a-space>
                <a-button type="text" size="small" :loading="operationLoading === `validate:${record.relation_id}`" @click="validateRepository(record)">
                  Validate
                </a-button>
                <a-button type="text" size="small" :loading="operationLoading === `clone:${record.relation_id}`" @click="repositoryOperation(record, 'clone')">
                  Clone
                </a-button>
                <a-button type="text" size="small" :loading="operationLoading === `update:${record.relation_id}`" @click="repositoryOperation(record, 'update')">
                  Update
                </a-button>
                <a-button type="text" size="small" @click="selectedRelationId = record.relation_id">
                  分支
                </a-button>
              </a-space>
            </template>
          </a-table>

          <a-card v-if="selectedRepository" title="分支 / Ref checkout" class="m-t-12px" :bordered="true">
            <a-alert v-if="selectedRepository.git_url.startsWith('local-test:')" type="warning" show-icon class="m-b-12px">
              当前为 local-test 仓库；请求 opt-in 不能绕过后端运行环境与白名单策略。
            </a-alert>
            <a-space align="end">
              <a-form-item label="仓库">
                <a-select v-model="selectedRelationId" style="width: 220px">
                  <a-option v-for="repository in repositories" :key="repository.relation_id" :value="repository.relation_id">
                    {{ repository.name }}
                  </a-option>
                </a-select>
              </a-form-item>
              <a-form-item label="Branch">
                <a-select v-model="checkoutBranch" :loading="branchLoading" allow-search style="width: 240px">
                  <a-option v-for="branch in branches" :key="branch.name" :value="branch.name">
                    {{ branch.name }} · {{ branch.commit_sha.slice(0, 8) }}
                  </a-option>
                </a-select>
              </a-form-item>
              <a-form-item label="Tag / Commit（与 Branch 二选一）">
                <a-input v-model="checkoutRef" placeholder="Tag 或完整 40/64 位 SHA" style="width: 240px" />
              </a-form-item>
              <a-form-item label=" ">
                <a-button type="primary" :loading="operationLoading === `checkout:${selectedRepository.relation_id}`" @click="repositoryOperation(selectedRepository, 'checkout')">
                  Checkout 新快照
                </a-button>
              </a-form-item>
            </a-space>
          </a-card>

          <a-card title="本次操作任务" class="m-t-12px" :bordered="true">
            <a-table :data="sourceJobs" :columns="taskColumns" :pagination="false" row-key="job_id" size="small">
              <template #task_status="{ record }">
                <StatusBadge :status="record.status" size="small" />
              </template>
              <template #attempts="{ record }">
                {{ record.attempt_count }}/{{ record.max_attempts }}
              </template>
              <template #task_result="{ record }">
                <span v-if="record.error_message" class="job-error">{{ record.error_message }}</span>
                <span v-else-if="record.output_commit_sha">commit {{ record.output_commit_sha.slice(0, 12) }}</span>
                <span v-else-if="record.output_snapshot_id">snapshot {{ record.output_snapshot_id }}</span>
                <span v-else>-</span>
              </template>
            </a-table>
          </a-card>
        </a-tab-pane>
      </a-tabs>
    </a-drawer>

    <a-modal v-model:visible="bindVisible" title="绑定代码仓库" :width="680" :ok-loading="bindLoading" @ok="submitBind">
      <a-alert type="warning" show-icon class="m-b-12px">
        只填写凭据引用编码，禁止录入用户名、Token 或私钥明文。
      </a-alert>
      <a-form :model="bindForm" layout="vertical">
        <a-form-item label="仓库名称" required>
          <a-input v-model="bindForm.name" />
        </a-form-item>
        <a-form-item label="Git URL" required>
          <a-input v-model="bindForm.git_url" placeholder="https:// 或 ssh 白名单地址" />
        </a-form-item>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="默认分支" required>
              <a-input v-model="bindForm.default_branch" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="默认扫描分支">
              <a-input v-model="bindForm.default_scan_branch" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="凭据引用">
              <a-input v-model="bindForm.credential_ref" placeholder="credential reference" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="模块根路径">
              <a-input v-model="bindForm.root_path" placeholder="src（留空表示仓库根）" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-space size="large">
          <a-checkbox v-model="bindForm.scan_enabled">
            启用扫描
          </a-checkbox>
          <a-checkbox v-model="bindForm.is_primary">
            主仓库
          </a-checkbox>
          <a-checkbox v-model="bindForm.allow_local_test_repository">
            申请使用 local-test 仓库（仍受服务端环境策略限制）
          </a-checkbox>
        </a-space>
      </a-form>
    </a-modal>

    <input ref="fileInputRef" type="file" accept=".xlsx,.xls" class="hidden-file-input" @change="handleFileChange">
  </div>
</template>

<style scoped>
.perf-module-mng { padding: 0; }
.secondary { margin-top: 4px; color: var(--color-text-3); }
.job-error { color: rgb(var(--danger-6)); }
.hidden-file-input { display: none; }
</style>
