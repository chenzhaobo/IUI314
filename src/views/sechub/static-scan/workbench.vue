<script setup lang="ts">
import type {
  BranchesControlResponse,
  CompleteScanRequest,
  ModuleSummary,
  PageResult,
  PreflightDecision,
  ReadySourceSnapshotListResponse,
  ReadySourceSnapshotView,
  RepositoryBinding,
  RepositoryBranch,
  RepositoryListResponse,
  RuleSet,
  ScopePreviewRequest,
  ScopePreviewResponse,
  StaticScanDomain,
  StaticScanTaskOption,
  TriggerResult,
} from '@/types/static-scan'
import { Message } from '@arco-design/web-vue'
import { computed, ref, watch } from 'vue'
import { ApiPerfModule } from '@/api/perfApis'
import {
  ApiSecModuleRepository,
  ApiSecRuleSet,
  ApiSecScanRun,
  ApiSecScanScope,
  ApiSecScanTask,
} from '@/api/sechubApis'
import ScopePreviewPanel from '@/components/static-scan/ScopePreviewPanel.vue'
import { newIdempotencyKey, useGet, getAction, postAction } from '@/hooks'

defineOptions({ name: 'StaticScanWorkbench' })

function listOf<T>(value: unknown): T[] {
  if (Array.isArray(value))
    return value as T[]
  if (value && typeof value === 'object' && Array.isArray((value as { list?: unknown }).list))
    return (value as PageResult<T>).list
  return []
}

const modules = ref<ModuleSummary[]>([])
const repositories = ref<RepositoryBinding[]>([])
const branches = ref<RepositoryBranch[]>([])
const readySnapshots = ref<ReadySourceSnapshotView[]>([])
const scanTasks = ref<StaticScanTaskOption[]>([])
const ruleSets = ref<RuleSet[]>([])
const selectedModuleId = ref('')
const filesText = ref('')
const loadingRepositories = ref(false)
const loadingBranches = ref(false)
const loadingSnapshots = ref(false)
const previewLoading = ref(false)
const triggerLoading = ref(false)
const preview = ref<ScopePreviewResponse | null>(null)
const completePreflight = ref<PreflightDecision | null>(null)
const previewFingerprint = ref('')
const readySnapshotId = ref('')
const existingTaskId = ref('')
const completeScanIdempotencyKey = ref('')

interface WorkbenchForm {
  repository_id: string
  scope_type: ScopePreviewRequest['scope_type']
  module_ids: string[]
  file_paths: string[]
  include_dependencies: boolean
  domains: CompleteScanRequest['domains']
  rule_set_id: string
}

const form = ref<WorkbenchForm>({
  repository_id: '',
  scope_type: 'repository',
  module_ids: [],
  file_paths: [],
  include_dependencies: true,
  domains: ['security', 'performance'],
  rule_set_id: '',
})

const modulePageSize = 1000

async function loadModules() {
  const loaded = new Map<string, ModuleSummary>()
  let pageNum = 1
  let total = Number.POSITIVE_INFINITY

  while (loaded.size < total) {
    const page = await getAction<PageResult<ModuleSummary> | ModuleSummary[]>(
      ApiPerfModule.getList,
      { page_num: pageNum, page_size: modulePageSize, status: '可用' },
    )
    if (!page)
      return

    const items = listOf<ModuleSummary>(page)
    if (!items.length)
      break
    items.forEach(module => loaded.set(module.id, module))
    total = Array.isArray(page)
      ? loaded.size
      : Number(page?.total ?? loaded.size)
    pageNum += 1
  }

  modules.value = [...loaded.values()].sort((left, right) =>
    `${left.name}\u0000${left.module_code}`.localeCompare(`${right.name}\u0000${right.module_code}`, 'zh-CN'),
  )
}

const { data: ruleSetData, execute: loadRuleSets } = useGet<PageResult<RuleSet> | RuleSet[]>(
  ApiSecRuleSet.getAll,
  {},
  { immediate: false },
)
const { data: taskData, execute: loadScanTasks } = useGet<PageResult<StaticScanTaskOption>>(
  ApiSecScanTask.getList,
  { page_num: 1, page_size: 1000, keyword: 'static_scan' },
  { immediate: false },
)

async function initialize() {
  await Promise.all([loadModules(), loadRuleSets(), loadScanTasks()])
  ruleSets.value = listOf<RuleSet>(ruleSetData.value)
  scanTasks.value = listOf<StaticScanTaskOption>(taskData.value)
    .filter(task => task.tool_code === 'static_scan' && task.status === '1')
    .map(task => ({ ...task, id: task.id.trim() }))
}
void initialize()

async function loadRepositories() {
  repositories.value = []
  branches.value = []
  readySnapshots.value = []
  form.value.repository_id = ''
  readySnapshotId.value = ''
  completePreflight.value = null
  if (!selectedModuleId.value)
    return
  loadingRepositories.value = true
  try {
    const { data, execute } = useGet<RepositoryListResponse>(
      ApiSecModuleRepository.list,
      { module_id: selectedModuleId.value, include_disabled: false },
      { immediate: false },
    )
    await execute()
    repositories.value = data.value?.list ?? []
  }
  finally {
    loadingRepositories.value = false
  }
}

async function loadBranches() {
  branches.value = []
  const repository = repositories.value.find(item => item.repository_id === form.value.repository_id)
  if (!repository)
    return
  loadingBranches.value = true
  try {
    const { data, execute } = useGet<BranchesControlResponse>(
      ApiSecModuleRepository.branches,
      { module_id: repository.module_id, relation_id: repository.relation_id, refresh: false },
      { immediate: false },
    )
    await execute()
    branches.value = data.value?.result === 'cached' ? data.value.data.branches : []
  }
  finally {
    loadingBranches.value = false
  }
}

async function loadReadySnapshots() {
  readySnapshots.value = []
  readySnapshotId.value = ''
  const repository = repositories.value.find(item => item.repository_id === form.value.repository_id)
  if (!repository)
    return
  loadingSnapshots.value = true
  try {
    const { data, execute } = useGet<ReadySourceSnapshotListResponse>(
      ApiSecModuleRepository.sourceSnapshots,
      { module_id: repository.module_id, relation_id: repository.relation_id },
      { immediate: false },
    )
    await execute()
    readySnapshots.value = data.value?.list ?? []
    readySnapshotId.value = readySnapshots.value[0]?.snapshot_id ?? ''
  }
  finally {
    loadingSnapshots.value = false
  }
}

function syncFiles() {
  form.value.file_paths = filesText.value
    .split(/\r?\n|,/)
    .map(path => path.trim())
    .filter(Boolean)
}

function fingerprint(): string {
  return JSON.stringify({ form: form.value, ready_snapshot_id: readySnapshotId.value, task_id: existingTaskId.value })
}

const selectedSnapshot = computed(() => readySnapshots.value.find(snapshot => snapshot.snapshot_id === readySnapshotId.value) ?? null)
const eligibleScanTasks = computed(() => scanTasks.value.filter((task) => {
  const moduleId = task.target_json?.module_id?.trim() ?? ''
  const repositoryId = task.target_json?.repository_id?.trim() ?? ''
  return moduleId === selectedModuleId.value && repositoryId === form.value.repository_id
}))
const selectedTask = computed(() => eligibleScanTasks.value.find(task => task.id === existingTaskId.value.trim()) ?? null)
const selectedRuleSet = computed(() => ruleSets.value.find(item => item.id === form.value.rule_set_id) ?? null)
const ruleSetDomains = computed<StaticScanDomain[]>(() => selectedRuleSet.value?.domains ?? ['security', 'performance'])
const sourcePrerequisiteBlocked = computed(() => !selectedSnapshot.value || !selectedTask.value)
const canPreview = computed(() => Boolean(
  !sourcePrerequisiteBlocked.value
  && form.value.repository_id
  && form.value.rule_set_id
  && form.value.domains.length
  && (form.value.scope_type !== 'modules' || form.value.module_ids.length)
  && (form.value.scope_type !== 'files' || form.value.file_paths.length),
))
const canTrigger = computed(() => Boolean(
  preview.value?.preflight.decision === 'accepted'
  && completePreflight.value?.accepted
  && previewFingerprint.value === fingerprint(),
))

watch(
  () => [form.value, readySnapshotId.value, existingTaskId.value] as const,
  () => {
    if (previewFingerprint.value && previewFingerprint.value !== fingerprint()) {
      preview.value = null
      completePreflight.value = null
      completeScanIdempotencyKey.value = ''
    }
  },
  { deep: true },
)
watch(
  eligibleScanTasks,
  (tasks) => {
    const currentId = existingTaskId.value.trim()
    existingTaskId.value = tasks.some(task => task.id === currentId)
      ? currentId
      : (tasks[0]?.id ?? '')
  },
  { immediate: true },
)
watch(selectedModuleId, () => void loadRepositories())
watch(() => form.value.repository_id, () => {
  void Promise.all([loadBranches(), loadReadySnapshots()])
})
watch(() => form.value.rule_set_id, () => {
  const allowed = ruleSetDomains.value
  const kept = form.value.domains.filter(domain => allowed.includes(domain))
  form.value.domains = kept.length ? kept : [...allowed]
})
watch(filesText, syncFiles)

function completeScanRequest(): CompleteScanRequest {
  return {
    task_id: existingTaskId.value,
    repository_id: form.value.repository_id,
    snapshot_id: readySnapshotId.value,
    rule_set_id: form.value.rule_set_id,
    scope_type: form.value.scope_type,
    module_ids: form.value.module_ids,
    file_paths: form.value.file_paths,
    include_dependencies: form.value.include_dependencies,
    branch_name: selectedSnapshot.value?.ref_name ?? null,
    ref_name: selectedSnapshot.value?.ref_name ?? null,
    commit_sha: selectedSnapshot.value?.commit_sha ?? null,
    domains: form.value.domains,
    idempotency_key: completeScanIdempotencyKey.value,
  }
}

async function handlePreview() {
  if (sourcePrerequisiteBlocked.value) {
    Message.warning('请选择已有 static_scan 任务和 Worker 已完成的 ready snapshot')
    return
  }
  if (!canPreview.value) {
    Message.warning('请完整选择仓库、扫描范围、Domain 和规则集')
    return
  }
  previewLoading.value = true
  try {
    const scopePayload: ScopePreviewRequest = {
      repository_id: form.value.repository_id,
      snapshot_id: readySnapshotId.value,
      scope_type: form.value.scope_type,
      module_ids: form.value.module_ids,
      file_paths: form.value.file_paths,
      include_dependencies: form.value.include_dependencies,
    }
    const scopeRes = await postAction<ScopePreviewResponse>(ApiSecScanScope.preview, scopePayload)
    if (!scopeRes) {
      preview.value = null
      completePreflight.value = null
      return
    }
    preview.value = scopeRes
    previewFingerprint.value = fingerprint()
    if (preview.value.preflight.decision !== 'accepted') {
      completePreflight.value = null
      Message.warning('Scope capacity preflight 未通过，已禁止触发')
      return
    }

    completeScanIdempotencyKey.value = newIdempotencyKey()
    const preflightRes = await postAction<PreflightDecision>(ApiSecScanRun.preflight, completeScanRequest())
    completePreflight.value = preflightRes
    if (!completePreflight.value?.accepted)
      Message.warning('完整扫描 contract preflight 未通过，已禁止触发')
  }
  finally {
    previewLoading.value = false
  }
}

async function handleTrigger() {
  if (!preview.value || !canTrigger.value) {
    Message.warning('必须由后端 scope 与 complete-scan preflight 全部通过后才能触发')
    return
  }
  triggerLoading.value = true
  try {
    const res = await postAction<TriggerResult>(ApiSecScanRun.trigger, completeScanRequest())
    if (!res)
      return
    Message.success(`完整扫描已触发${res.run_id ? `：${res.run_id}` : ''}`)
  }
  finally {
    triggerLoading.value = false
  }
}
</script>

<template>
  <div class="static-scan-workbench">
    <a-alert v-if="sourcePrerequisiteBlocked" type="warning" show-icon class="m-b-12px">
      <template #title>
        等待静态扫描前置条件
      </template>
      请选择与当前模块和代码仓库绑定的启用 static_scan 任务，并等待 Clone / Update / Checkout Worker 生成 ready immutable snapshot；不匹配的任务不会显示，也不能触发扫描。
    </a-alert>
    <a-card title="完整扫描配置" :bordered="false" class="m-b-12px">
      <a-form :model="form" layout="vertical">
        <a-row :gutter="16">
          <a-col :span="6">
            <a-form-item label="所属模块" required>
              <a-select v-model="selectedModuleId" allow-search placeholder="先选择模块">
                <a-option v-for="item in modules" :key="item.id" :value="item.id">
                  {{ item.name }}（{{ item.module_code }}）
                </a-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="代码仓库" required>
              <a-select v-model="form.repository_id" :loading="loadingRepositories" placeholder="选择已绑定仓库">
                <a-option v-for="item in repositories" :key="item.repository_id" :value="item.repository_id">
                  {{ item.name }}{{ item.git_url.startsWith('local-test:') ? ' [local-test]' : '' }}
                </a-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="已有静态扫描任务" required>
              <a-select v-model="existingTaskId" allow-search placeholder="仅显示当前模块和仓库的启用任务">
                <a-option v-for="task in eligibleScanTasks" :key="task.id" :value="task.id">
                  {{ task.name }} · {{ task.id }}
                </a-option>
              </a-select>
              <template #extra>
                <span v-if="selectedModuleId && form.repository_id && !eligibleScanTasks.length">
                  当前模块/仓库没有可用的 static_scan 任务，不能触发扫描。
                </span>
              </template>
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="Ready immutable snapshot" required>
              <a-select v-model="readySnapshotId" :loading="loadingSnapshots" allow-search placeholder="先在模块管理完成 Clone / Update / Checkout">
                <a-option v-for="snapshot in readySnapshots" :key="snapshot.snapshot_id" :value="snapshot.snapshot_id">
                  {{ snapshot.ref_name || snapshot.job_kind }} · {{ snapshot.commit_sha.slice(0, 12) }}
                </a-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="6">
            <a-form-item label="范围类型" required>
              <a-radio-group v-model="form.scope_type" type="button">
                <a-radio value="repository">
                  整个工程
                </a-radio>
                <a-radio value="modules">
                  模块
                </a-radio>
                <a-radio value="files">
                  文件
                </a-radio>
              </a-radio-group>
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="Domain" required>
              <a-checkbox-group v-model="form.domains">
                <a-checkbox value="security" :disabled="!ruleSetDomains.includes('security')">
                  安全
                </a-checkbox>
                <a-checkbox value="performance" :disabled="!ruleSetDomains.includes('performance')">
                  性能
                </a-checkbox>
              </a-checkbox-group>
              <template #extra>
                <span v-if="selectedRuleSet && !ruleSetDomains.includes('performance')">当前规则集仅覆盖安全域；性能域暂无预置规则</span>
              </template>
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="正式规则集" required>
              <a-select v-model="form.rule_set_id" placeholder="选择规则集">
                <a-option v-for="item in ruleSets" :key="item.id" :value="item.id">
                  {{ item.name }} @ {{ item.version }} · {{ item.release_status }}
                </a-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="依赖扩展">
              <a-switch v-model="form.include_dependencies" />
              <span class="m-l-8px">保留 supporting manifest</span>
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item v-if="form.scope_type === 'modules'" label="模块 ID（可多选）" required>
          <a-select v-model="form.module_ids" multiple allow-create allow-search placeholder="输入或选择仓库内模块 ID" />
        </a-form-item>
        <a-form-item v-if="form.scope_type === 'files'" label="仓库相对文件路径" required>
          <a-textarea v-model="filesText" :auto-size="{ minRows: 4, maxRows: 10 }" placeholder="每行一个路径；禁止绝对路径、.. 和越界软链接" />
        </a-form-item>
        <a-space>
          <a-button type="primary" :disabled="!canPreview" :loading="previewLoading" @click="handlePreview">
            范围预览 / Preflight
          </a-button>
          <a-button type="primary" status="success" :disabled="!canTrigger" :loading="triggerLoading" @click="handleTrigger">
            触发一次完整扫描
          </a-button>
          <span v-if="sourcePrerequisiteBlocked" class="trigger-hint">请选择 ready snapshot 与当前模块/仓库绑定的启用 static_scan 任务</span>
          <span v-else-if="!canTrigger" class="trigger-hint">只有 scope 与 complete-scan 两级后端 preflight 全部通过时可触发</span>
        </a-space>
      </a-form>
    </a-card>
    <a-card title="Scope Preview" :bordered="false">
      <ScopePreviewPanel :preview="preview" :complete-preflight="completePreflight" :loading="previewLoading" />
    </a-card>
  </div>
</template>

<style scoped>
.static-scan-workbench { padding: 0; }
.trigger-hint { color: var(--color-text-3); }
</style>
