<script setup lang="ts">
/**
 * 领域资产 — 统一列表（表单 / 微服务两类资产，AS-03 真实契约）
 *
 *   - 列表：GET /sechub/domain-assets（服务端分页）。筛选字段与后端 AssetListQuery 一一对应：
 *     page_num / page_size / keyword / asset_type / source_ref_type / env_id / repository_id /
 *     app_id / form_id / plugin_class / service_name / match_status / in_scope / active
 *     —— **没有 status / env_name**；且列表给的是 `match_status_counts` 聚合计数，
 *     不是单个 match_status，所以「匹配状态」列渲染的是「已匹配 3 / 未匹配 2」这类文本。
 *   - 同步（env 维度）：POST /sechub/form-assets/sync/preview 预览 → POST /sechub/form-assets/sync
 *     执行（返回 task_id）→ GET /sechub/form-assets/sync/{task_id} 轮询到终态。
 *     预览与任务状态的响应结构未被后端固定为契约，按实际返回字段宽松展示，不假设计数键。
 *   - 详情 / 文件 / 候选 / 问题 / 同步历史 / 重匹配 / 人工字段都在 DomainAssetDetail.vue
 *     （打开时会重新拉真实详情，本页的列表行只是快照）。
 *
 * 候选与问题在本页只做计数展示、不复制状态机：确认与流转仍在扫描结果 / 缺陷页完成。
 */
import type { AssetColumnDef, DomainAsset, DomainAssetListQuery, DomainAssetPage, FormAssetSyncTask } from './types'
import type { ModuleWithRepository } from '@/types/static-scan'
import { Message } from '@arco-design/web-vue'
import { computed, onDeactivated, onUnmounted, ref } from 'vue'
import { ApiPerfEnv } from '@/api/apis'
import { ApiSecDomainAsset, ApiSecFormAssetSync, ApiSecModuleRepository, resolveStaticScanApi } from '@/api/sechubApis'
import ListPage from '@/components/common/ListPage.vue'
import { getAction, postAction, useGet, usePagedQuery } from '@/hooks'
import DomainAssetDetail from './DomainAssetDetail.vue'
import {
  ACTIVE_OPTIONS,
  ASSET_TYPE_OPTIONS,
  compactQuery,
  createAssetCellRenderer,
  derivePlainColumns,
  DOMAIN_ASSET_PAGE_SIZES,
  flattenScalarEntries,
  IN_SCOPE_OPTIONS,
  isTerminalSyncStatus,
  matchStatusLabels,
  pickArrayTables,
  syncTaskText,
  toTableColumns,
} from './types'

// 组件名必须与路由 name（= sys_menu.path）一致，keep-alive :include 按它对上缓存
// （见 components/layout/app-main.vue 的注释）。菜单 component 指向本目录 index，
// 动态加载（stores/modules/permission.ts 的 loadView）按「views/ 后、.vue 前」匹配，
// 因此无需改 router。
// eslint-disable-next-line vue/component-definition-name-casing
defineOptions({ name: 'domain-assets' })

// ── 列表查询（服务端分页）─────────────────────────
// fetchList 必须是函数声明而不是 const 箭头函数：usePagedQuery 在声明处就要引用它
// 重拉列表，而 `ts/no-use-before-define` 对变量（variables: true）报错、对函数声明
// （functions: false）放行 —— 函数提升在这里是真实可用的（回调只在事件里触发）。
const { query, total, pagination, onPageChange, onPageSizeChange, search, reset }
  = usePagedQuery<DomainAssetListQuery>(
    {
      keyword: '',
      asset_type: '',
      source_ref_type: '',
      env_id: '',
      repository_id: '',
      app_id: '',
      form_id: '',
      plugin_class: '',
      service_name: '',
      match_status: '',
      in_scope: '',
      active: '',
    },
    () => fetchList(),
    { pageSize: 20, pageSizeOptions: DOMAIN_ASSET_PAGE_SIZES },
  )

const { isFetching: loading, data: rawData, error: listError, execute: executeList } = useGet<DomainAssetPage>(
  ApiSecDomainAsset.getList,
  // 空字符串表示「不过滤」，必须在发送前剔除：后端 in_scope / active 是布尔、
  // env_id 等是 Option<T>，收到空串会反序列化失败
  computed(() => compactQuery(query.value)),
  {
    immediate: true,
    onSuccess: (page) => {
      total.value = Number(page.total) || 0
    },
  },
)

function fetchList() {
  return executeList()
}

const rows = computed<DomainAsset[]>(() => {
  const page = rawData.value
  return page && Array.isArray(page.list) ? page.list : []
})

/**
 * 失败态判定用请求自己的 `error`，不用 `isRequestFailed(data)`：
 * 后者在**首次响应回来之前** data 是 null，会把「还没查」误报成「查询失败」并闪一下错误态；
 * 而 error 在每次 execute 开始时被清空，只有真的失败（网络错误或业务码非 200）才被拦截器写入。
 */
const listFailed = computed(() => Boolean(listError.value))

// ── 环境下拉（筛选 + 同步弹窗共用）─────────────────

interface PerfEnvOption {
  id: string
  env_name: string
  env_code: string
  env_type: string
}

const { data: envRes } = useGet<{ list?: PerfEnvOption[] }>(
  ApiPerfEnv.getList,
  { page_num: 1, page_size: 200, status: '1' },
  { immediate: true },
)

const envOptions = computed(() => {
  const list = envRes.value?.list
  if (!Array.isArray(list))
    return []
  return list
    .map(env => ({
      value: String(env.id ?? ''),
      label: env.env_name ? `${env.env_name}（${env.env_code || env.env_type || env.id}）` : String(env.id ?? '--'),
    }))
    .filter(option => option.value !== '')
})

function envName(id?: string | null): string {
  if (!id)
    return '--'
  return envOptions.value.find(option => option.value === String(id))?.label || String(id)
}

// ── 代码仓库下拉（筛选 + 表格里 repository_id → 名称）──
// 复用「模块-代码仓库」绑定列表（真实接口）：同一仓库可能绑定多个模块，按 repository_id 去重

const { data: repoRes } = useGet<ModuleWithRepository[]>(
  ApiSecModuleRepository.listWithModule,
  {},
  { immediate: true },
)

const repoOptions = computed(() => {
  const list = repoRes.value
  if (!Array.isArray(list))
    return []
  const seen = new Set<string>()
  const options: { value: string, label: string }[] = []
  for (const repo of list) {
    const id = String(repo.repository_id ?? '')
    if (!id || seen.has(id))
      continue
    seen.add(id)
    options.push({ value: id, label: `${repo.module_name}（${repo.repository_name}）` })
  }
  return options
})

function repoName(id?: string | null): string {
  if (!id)
    return '--'
  return repoOptions.value.find(option => option.value === String(id))?.label || String(id)
}

// ── 资产同步：预览 → 执行 → 按 task_id 轮询 ────────
const syncVisible = ref(false)
const syncEnvId = ref('')
const syncPreviewing = ref(false)
const syncExecuting = ref(false)
/** 预览响应原样保存（结构未固定契约），展示时才摊平 */
const syncPreview = ref<Record<string, unknown> | null>(null)
const syncPreviewEntries = computed(() => (syncPreview.value ? flattenScalarEntries(syncPreview.value) : []))
const syncPreviewTables = computed(() => pickArrayTables(syncPreview.value))

/** 预览里的数组表格最多渲染这么多行：预览可能命中上万条绑定，全渲染会卡住弹窗 */
const PREVIEW_TABLE_MAX_ROWS = 200

function previewRows(rowsInTable: Record<string, unknown>[]) {
  return rowsInTable.slice(0, PREVIEW_TABLE_MAX_ROWS)
}

/** 预览列也按行内容推导；用纯文本渲染，避免把预览里的状态误读成业务标签 */
function previewColumns(previewTableRows: Record<string, unknown>[]) {
  return toTableColumns(derivePlainColumns(previewTableRows), createAssetCellRenderer())
}

function openSyncModal() {
  syncPreview.value = null
  // 带上列表当前的环境筛选，少选一次；筛选没设环境时保持上次选择
  if (!syncEnvId.value && query.value.env_id)
    syncEnvId.value = query.value.env_id
  syncVisible.value = true
}

function onSyncEnvChange() {
  // 换环境后旧预览作废，避免"看着 A 环境的预览、同步 B 环境"
  syncPreview.value = null
}

async function handleSyncPreview() {
  if (!syncEnvId.value) {
    Message.warning('请先选择要同步的环境')
    return
  }
  syncPreviewing.value = true
  try {
    const res = await postAction<Record<string, unknown>>(
      ApiSecFormAssetSync.preview,
      { env_id: syncEnvId.value },
    )
    if (!res)
      return
    syncPreview.value = res
    Message.success('已获取同步预览，请确认变更范围')
  }
  finally {
    syncPreviewing.value = false
  }
}

async function handleSyncExecute() {
  if (!syncEnvId.value) {
    Message.warning('请先选择要同步的环境')
    return
  }
  if (!syncPreview.value) {
    Message.warning('请先执行同步预览，确认变更范围后再执行同步')
    return
  }
  syncExecuting.value = true
  try {
    const task = await postAction<FormAssetSyncTask>(
      ApiSecFormAssetSync.sync,
      { env_id: syncEnvId.value },
    )
    if (!task)
      return
    syncVisible.value = false
    // 同步会改动资产列表（新增 / 更新 / 失效），先刷新一次
    void fetchList()
    if (!task.task_id) {
      // 没有任务号就无法跟踪进度：如实说明并让用户稍后手动刷新，不伪造进度
      Message.warning('同步已启动，但本次未返回任务号，无法跟踪进度；请稍后手动刷新列表查看结果')
      return
    }
    startSyncPolling(String(task.task_id))
    Message.success('同步已启动，正在跟踪进度')
  }
  finally {
    syncExecuting.value = false
  }
}

const SYNC_POLL_INTERVAL = 2000
/** 轮询上限（约 5 分钟）与连续失败上限：超限就停并提示，避免无限打接口 */
const SYNC_MAX_POLLS = 150
const SYNC_MAX_FAILURES = 5

const syncTaskId = ref('')
const syncTaskPayload = ref<Record<string, unknown> | null>(null)
const syncPolling = ref(false)
let syncTimer: number | null = null
let syncPollCount = 0
let syncFailCount = 0

const syncStatusText = computed(() => syncTaskText(syncTaskPayload.value))

function stopSyncPolling() {
  if (syncTimer !== null) {
    window.clearTimeout(syncTimer)
    syncTimer = null
  }
  syncPolling.value = false
}

async function pollSyncTask() {
  const taskId = syncTaskId.value
  if (!syncPolling.value || !taskId)
    return
  syncPollCount += 1
  const payload = await getAction<Record<string, unknown>>(
    resolveStaticScanApi(ApiSecFormAssetSync.status, { task_id: taskId }),
    {},
  )
  // 等接口期间可能被停止（离开页面）或又启动了新任务，此时这次结果作废
  if (!syncPolling.value || syncTaskId.value !== taskId)
    return
  if (!payload) {
    syncFailCount += 1
    if (syncFailCount >= SYNC_MAX_FAILURES) {
      stopSyncPolling()
      Message.warning('同步进度连续查询失败，已停止跟踪；请稍后刷新列表查看结果')
      void fetchList()
      return
    }
  }
  else {
    syncFailCount = 0
    syncTaskPayload.value = payload
    if (isTerminalSyncStatus(String(payload.status ?? ''))) {
      stopSyncPolling()
      Message.success(`资产同步已结束：${syncTaskText(payload) || '完成'}`)
      void fetchList()
      return
    }
  }
  if (syncPollCount >= SYNC_MAX_POLLS) {
    stopSyncPolling()
    Message.warning('同步耗时较长，已停止自动跟踪；请稍后刷新列表查看结果')
    return
  }
  syncTimer = window.setTimeout(() => {
    void pollSyncTask()
  }, SYNC_POLL_INTERVAL)
}

function startSyncPolling(taskId: string) {
  stopSyncPolling()
  syncTaskId.value = taskId
  syncTaskPayload.value = null
  syncPollCount = 0
  syncFailCount = 0
  syncPolling.value = true
  syncTimer = window.setTimeout(() => {
    void pollSyncTask()
  }, SYNC_POLL_INTERVAL)
}

// keep-alive 缓存的页面切走时**不会**触发 onUnmounted，只在 onDeactivated 里停表，
// 否则后台一直打接口（app-main.vue 对此有明确提示）
onDeactivated(stopSyncPolling)
onUnmounted(stopSyncPolling)

// ── 详情抽屉 ──────────────────────────────────────
const detailVisible = ref(false)
const detailAsset = ref<DomainAsset | null>(null)

function openDetail(record: Record<string, unknown>) {
  // 列表行只作为打开瞬间的兜底快照，详情由抽屉自己重新拉取
  detailAsset.value = record as DomainAsset
  detailVisible.value = true
}

async function handleDetailChanged() {
  await fetchList()
}

// ── 表格列 ────────────────────────────────────────
// 列与后端 AssetListQuery / DomainAsset 的真实字段一一对应；
// 单元格统一走 types.ts 的渲染器（时间格式、等宽、环境/仓库名解析、标签配色）
const cellRender = createAssetCellRenderer({ envName, repositoryName: repoName })

const COLUMN_DEFS: AssetColumnDef[] = [
  { title: '资产类型', dataIndex: 'asset_type', width: 90, cell: 'tag', meta: 'asset_type' },
  { title: '表单ID', dataIndex: 'form_id', width: 160, cell: 'code' },
  { title: '服务名', dataIndex: 'service_name', width: 180, cell: 'code' },
  { title: '插件类', dataIndex: 'plugin_class', width: 180, cell: 'code' },
  { title: '来源类型', dataIndex: 'source_ref_type', width: 110 },
  { title: '环境', dataIndex: 'env_id', width: 160, cell: 'env' },
  { title: '代码仓库', dataIndex: 'repository_id', width: 220, cell: 'repo' },
  { title: '应用', dataIndex: 'app_id', width: 140, cell: 'code' },
  { title: '匹配状态', dataIndex: 'match_status_counts', width: 200, cell: 'match_counts' },
  { title: '扫描范围', dataIndex: 'in_scope', width: 90, cell: 'tag', meta: 'scope' },
  { title: '启用', dataIndex: 'active', width: 80, cell: 'tag', meta: 'active' },
  { title: '负责人', dataIndex: 'owner', width: 110 },
  { title: '最近同步运行', dataIndex: 'last_sync_run_id', width: 160, cell: 'code' },
  { title: '更新时间', dataIndex: 'updated_at', width: 160, cell: 'time' },
]

const OPERATIONS_COLUMN: Record<string, any> = {
  title: '操作',
  slotName: 'operations',
  width: 80,
  fixed: 'right',
}

const columns = computed(() => [...toTableColumns(COLUMN_DEFS, cellRender), OPERATIONS_COLUMN])

/** 横向最小宽度按列宽求和算出来，避免手工写的常量与列定义不同步 */
const tableMinWidth = computed(() => COLUMN_DEFS.reduce((sum, col) => sum + (col.width ?? 120), 0) + OPERATIONS_COLUMN.width)
</script>

<template>
  <div>
    <ListPage>
      <!--
        筛选区。Arco 的 Input / Select 是 inheritAttrs: false，class 不会落到根节点上，
        所以每个控件都要包一层原生 div 来给宽度（见 scan-task-list.vue 的注释）。
      -->
      <template #filter>
        <div class="filter-bar">
          <div class="f-wide">
            <a-input
              v-model="query.keyword"
              placeholder="关键词（表单ID / 服务名 / 插件类…）"
              allow-clear
              @press-enter="search"
              @clear="search"
            />
          </div>
          <div class="f-mid">
            <a-select v-model="query.asset_type" placeholder="资产类型" allow-clear @change="search">
              <a-option v-for="opt in ASSET_TYPE_OPTIONS" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </a-option>
            </a-select>
          </div>
          <div class="f-sm">
            <a-input
              v-model="query.source_ref_type"
              placeholder="来源类型"
              allow-clear
              @press-enter="search"
              @clear="search"
            />
          </div>
          <div class="f-mid">
            <a-select v-model="query.env_id" placeholder="环境" allow-clear allow-search @change="search">
              <a-option v-for="opt in envOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </a-option>
            </a-select>
          </div>
          <div class="f-repo">
            <a-select
              v-model="query.repository_id"
              placeholder="代码仓库"
              allow-clear
              allow-search
              @change="search"
            >
              <a-option v-for="opt in repoOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </a-option>
            </a-select>
          </div>
          <div class="f-sm">
            <a-input
              v-model="query.app_id"
              placeholder="应用"
              allow-clear
              @press-enter="search"
              @clear="search"
            />
          </div>
          <div class="f-mid">
            <a-input
              v-model="query.form_id"
              placeholder="表单ID"
              allow-clear
              @press-enter="search"
              @clear="search"
            />
          </div>
          <div class="f-mid">
            <a-input
              v-model="query.plugin_class"
              placeholder="插件类"
              allow-clear
              @press-enter="search"
              @clear="search"
            />
          </div>
          <div class="f-mid">
            <a-input
              v-model="query.service_name"
              placeholder="服务名"
              allow-clear
              @press-enter="search"
              @clear="search"
            />
          </div>
          <div class="f-mid">
            <a-select v-model="query.match_status" placeholder="匹配状态" allow-clear @change="search">
              <a-option v-for="(meta, value) in matchStatusLabels" :key="value" :value="value">
                {{ meta.label }}
              </a-option>
            </a-select>
          </div>
          <div class="f-sm">
            <a-select v-model="query.in_scope" placeholder="扫描范围" allow-clear @change="search">
              <a-option v-for="opt in IN_SCOPE_OPTIONS" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </a-option>
            </a-select>
          </div>
          <div class="f-sm">
            <a-select v-model="query.active" placeholder="启用状态" allow-clear @change="search">
              <a-option v-for="opt in ACTIVE_OPTIONS" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </a-option>
            </a-select>
          </div>
          <a-button type="primary" @click="search">
            查询
          </a-button>
          <a-button @click="reset">
            重置
          </a-button>
        </div>
      </template>

      <template #toolbar>
        <a-button :loading="loading" @click="fetchList()">
          <template #icon>
            <icon-refresh />
          </template>
          刷新
        </a-button>
        <a-button type="primary" @click="openSyncModal">
          <template #icon>
            <icon-sync />
          </template>
          资产同步
        </a-button>
        <template v-if="syncPolling">
          <a-tag color="arcoblue">
            同步中
          </a-tag>
          <span class="muted-text">{{ syncStatusText || '正在查询进度…' }}</span>
        </template>
      </template>

      <template #default="{ tableHeight }">
        <a-table
          :data="rows"
          :columns="columns"
          :loading="loading"
          :pagination="pagination"
          :scroll="{ minWidth: tableMinWidth, y: tableHeight }"
          row-key="id"
          @page-change="onPageChange"
          @page-size-change="onPageSizeChange"
        >
          <template #operations="{ record }">
            <a-link @click="openDetail(record)">
              详情
            </a-link>
          </template>

          <template #empty>
            <a-result
              v-if="listFailed"
              status="error"
              title="领域资产列表加载失败"
              subtitle="后端未返回数据，请重试或检查网络与权限"
            >
              <template #extra>
                <a-button size="small" type="primary" @click="fetchList()">
                  重试
                </a-button>
              </template>
            </a-result>
            <a-empty v-else description="暂无领域资产，可先执行一次资产同步" />
          </template>
        </a-table>
      </template>
    </ListPage>

    <!-- 资产同步：按环境预览 → 执行 → 用返回的 task_id 轮询进度到终态 -->
    <a-modal v-model:visible="syncVisible" title="表单资产同步" :width="760" :footer="false">
      <a-descriptions :column="1" size="small" title="同步范围">
        <a-descriptions-item label="环境">
          <!-- 宽度同筛选区：Arco Select 是 inheritAttrs:false，class 必须给包裹 div -->
          <div class="sync-env-select">
            <a-select
              v-model="syncEnvId"
              placeholder="请选择要同步的环境"
              allow-search
              @change="onSyncEnvChange"
            >
              <a-option v-for="opt in envOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </a-option>
            </a-select>
          </div>
        </a-descriptions-item>
      </a-descriptions>

      <a-space class="m-t-12px">
        <a-button type="outline" :loading="syncPreviewing" :disabled="!syncEnvId" @click="handleSyncPreview">
          同步预览
        </a-button>
        <a-button
          type="primary"
          :loading="syncExecuting"
          :disabled="!syncEnvId || !syncPreview"
          @click="handleSyncExecute"
        >
          执行同步
        </a-button>
        <span v-if="!syncPreview" class="muted-text">需先预览确认变更范围，才可执行同步</span>
      </a-space>

      <!-- 预览响应结构未固定为契约：标量字段摊平展示，数组字段渲染成小表，不假设计数键 -->
      <div v-if="syncPreview" class="m-t-12px">
        <a-divider>同步预览</a-divider>
        <a-descriptions v-if="syncPreviewEntries.length" :column="2" size="small" bordered>
          <a-descriptions-item v-for="entry in syncPreviewEntries" :key="entry.key" :label="entry.label">
            {{ entry.text }}
          </a-descriptions-item>
        </a-descriptions>

        <div v-for="table in syncPreviewTables" :key="table.key" class="m-t-12px">
          <div class="preview-table-title">
            {{ table.label }}（共 {{ table.rows.length }} 条）
            <span v-if="table.rows.length > PREVIEW_TABLE_MAX_ROWS" class="muted-text">
              仅展示前 {{ PREVIEW_TABLE_MAX_ROWS }} 条
            </span>
          </div>
          <a-table
            :data="previewRows(table.rows)"
            :columns="previewColumns(table.rows)"
            :pagination="false"
            :scroll="{ y: 240 }"
            size="small"
          />
        </div>

        <a-empty
          v-if="!syncPreviewEntries.length && !syncPreviewTables.length"
          description="预览未返回可展示的内容"
        />
      </div>
    </a-modal>

    <!-- 详情抽屉：基本信息 / 插件 / 菜单 / 文件 / 候选 / 问题 / 同步历史 -->
    <DomainAssetDetail
      v-model:visible="detailVisible"
      :asset="detailAsset"
      @changed="handleDetailChanged"
    />
  </div>
</template>

<style scoped>
/* 筛选区：按需宽度 + 放不下自动换行（与 scan-task-list.vue 一致） */
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

/*
  宽度必须落在包裹 div 上：Arco 的 Input / Select 是 inheritAttrs: false，
  直接给组件写 class 不会生效，控件会保持 width: 100% 在 flex 里各占一行。
*/
.f-wide {
  width: 240px;
}
.f-mid {
  width: 140px;
}
.f-sm {
  width: 110px;
}
.f-repo {
  width: 220px;
}

/* 控件填满它的包裹 div */
.filter-bar > div :deep(.arco-select),
.filter-bar > div :deep(.arco-input-wrapper) {
  width: 100%;
}

/* 弹窗里的环境下拉（不在 filter-bar 里，单独给宽度） */
.sync-env-select {
  width: 320px;
}

.sync-env-select :deep(.arco-select) {
  width: 100%;
}

.preview-table-title {
  margin-bottom: 4px;
  font-size: 13px;
}

.muted-text {
  color: var(--color-text-4);
  font-size: 12px;
}

.m-t-12px {
  margin-top: 12px;
}
</style>
