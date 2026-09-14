<script setup lang="ts">
/**
 * 领域资产详情抽屉。
 *
 * 打开时**必须**重新拉详情（GET /sechub/domain-assets/{id}）：列表行只是快照，
 * 既不含内嵌的插件绑定 / 菜单 / Helper 依赖，也给不出重匹配需要的匹配证据。
 *
 * 数据来源与分页策略：
 *   - 插件绑定（form.surfaces[].bindings[]）/ 菜单（form.menus）/
 *     Helper 依赖（microservice.helper_files）随详情**内嵌**返回，后端没有独立分页接口，
 *     这里做**客户端分页**：绑定可达 2 万条，一次全渲染会把页面卡死；
 *   - 文件 / 候选 / 问题 / 同步历史各有独立分页接口，走服务端分页。
 *
 * 人工字段 PATCH **只提交后端支持的四个字段**（owner / tags_json / in_scope / remark），
 * 见 types.ts 的 buildManualFieldsPayload；
 * 重新匹配仅对表单资产开放，证据 = last_sync_run_id + 绑定里最新的 match_row，
 * 缺证据时按钮禁用并写明原因，见 resolveRematchEvidence。
 */
import type { AssetColumnDef, AssetSubListFilter, AssetTabKind, DomainAsset, DomainAssetDetail, DomainAssetManualFieldsRequest, DomainAssetSyncRunsFilter } from './types'
import type { secTestEnv } from '@/types/sechub'
import type { ModuleWithRepository, PageResult } from '@/types/static-scan'
import { Message } from '@arco-design/web-vue'
import { computed, reactive, ref, watch } from 'vue'
import { ApiSecDomainAsset, ApiSecModuleRepository, ApiSecPrescan, ApiSecTestEnv, resolveStaticScanApi } from '@/api/sechubApis'
import { formatTime, getAction, isRequestFailed, postAction, useGet, usePagedQuery, useRequest } from '@/hooks'
import {
  applyManualFields,
  assetIdentityLabel,
  assetIdentityValue,
  assetKind,
  assetTabs,
  assetTypeMeta,
  asText,
  buildHelperRows,
  buildManualFieldsPayload,
  buildMenuRows,
  buildPluginRows,
  buildPrescanTriggerPayload,
  CANDIDATE_COLUMNS,
  cellTagMeta,
  compactQuery,
  createAssetCellRenderer,
  deriveScalarColumns,
  DOMAIN_ASSET_PAGE_SIZES,
  isEmbeddedTabKind,
  ISSUE_COLUMNS,
  matchStatusCountsText,
  resolveRematchEvidence,
  scanTriggerDisabledReason,
  toManualDraft,
  toTableColumns,
} from './types'

defineOptions({ name: 'DomainAssetDetail' })

const props = defineProps<{
  /** 抽屉可见性（v-model:visible） */
  visible: boolean
  /** 列表行：打开瞬间先拿它兜底展示，详情接口返回后覆盖 */
  asset: DomainAsset | null
}>()

const emit = defineEmits<{
  'update:visible': [visible: boolean]
  'changed': []
}>()

// ── 详情 ──────────────────────────────────────────

const detail = ref<DomainAssetDetail | null>(null)
const detailLoading = ref(false)
const detailFailed = ref(false)
/** 已保存的人工字段：叠加在详情/列表之上，保证保存后展示立刻一致 */
const manualOverrides = ref<DomainAssetManualFieldsRequest | null>(null)

/** 展示快照：详情优先，未加载时退回列表行（打开瞬间不至于空白） */
const snapshot = computed<DomainAsset | null>(() => {
  const base = detail.value ?? props.asset
  if (!base)
    return null
  return manualOverrides.value ? applyManualFields(base, manualOverrides.value) : base
})

const tabs = computed(() => assetTabs(props.asset?.asset_type))
const activeTabKey = ref<string | number>('basic')
const activeTabDef = computed(() => tabs.value.find(tab => tab.key === activeTabKey.value) ?? tabs.value[0])
const activeKind = computed<AssetTabKind | null>(() => activeTabDef.value?.kind ?? null)

async function fetchDetail() {
  const id = props.asset?.id
  if (!id) {
    detail.value = null
    return
  }
  detailLoading.value = true
  detailFailed.value = false
  const res = await getAction<DomainAssetDetail>(resolveStaticScanApi(ApiSecDomainAsset.getById, { id }), {})
  detailLoading.value = false
  if (!res) {
    // 拿不到详情时列表快照仍可用，顶部提示条里给重试入口
    detailFailed.value = true
    return
  }
  detail.value = res
}

// ── 环境下拉 / 仓库下拉（用于把 id 显示成名字）──────

const { data: envRes } = useGet<{ list?: secTestEnv[] }>(
  ApiSecTestEnv.getList,
  { page_num: 1, page_size: 200 },
  { immediate: true },
)
const envOptions = computed(() => (envRes.value?.list ?? []).map(env => ({
  value: env.id ?? '',
  label: env.env_name ? `${env.env_name}（${env.env_type || env.id}）` : (env.id ?? '--'),
})))

function envName(id?: string | null) {
  if (!id)
    return '--'
  return envOptions.value.find(option => option.value === id)?.label || id
}

// 与问题页同源：/sechub/module/repositories-with-module（带模块名，便于辨认）
const { data: repoRes } = useGet<ModuleWithRepository[]>(ApiSecModuleRepository.listWithModule, {}, { immediate: true })
const repositoryOptions = computed(() => (repoRes.value ?? []).map(repo => ({
  value: repo.repository_id,
  label: `${repo.module_name}（${repo.repository_name}）`,
})))

function repoName(id?: string | null) {
  if (!id)
    return '--'
  return repositoryOptions.value.find(option => option.value === id)?.label || id
}

// ── 子列表：文件 / 候选 / 问题 / 同步历史（服务端分页）──

/**
 * 四个子列表结构一致（分页状态 + 请求 + 失败哨兵），收敛成一个工厂，
 * 避免四份近乎相同的代码各自漏掉页码复位或失败判定。
 */
function useAssetSubList<TQuery extends Record<string, any>>(url: () => string, initial: TQuery) {
  // `attempted` 不能省：useGet 首次执行前 data 是 null，
  // 直接判 isRequestFailed 会把「还没查」误报成「查询失败」
  const attempted = ref(false)
  const { query, total, pagination, onPageChange, onPageSizeChange } = usePagedQuery<TQuery>(
    initial,
    () => fetchList(),
    { pageSize: 20, pageSizeOptions: DOMAIN_ASSET_PAGE_SIZES },
  )
  const { data, isFetching, execute } = useGet<PageResult<Record<string, unknown>>>(
    computed(url),
    computed(() => compactQuery(query.value)),
    { immediate: false, onSuccess: page => (total.value = page.total ?? 0) },
  )

  const rows = computed<Record<string, unknown>[]>(() => {
    const page = data.value
    return page && Array.isArray(page.list) ? page.list : []
  })
  const failed = computed(() => attempted.value && !isFetching.value && isRequestFailed(data.value))

  async function fetchList() {
    if (!url())
      return
    attempted.value = true
    await execute()
  }

  /** 切换资产时复位：回第 1 页并清掉「已查过」标记（下次进入该 tab 再查） */
  function reset() {
    query.value.page_num = 1
    attempted.value = false
  }

  return { query, rows, failed, loading: isFetching, pagination, fetchList, reset, onPageChange, onPageSizeChange }
}

const filesList = useAssetSubList<AssetSubListFilter>(
  () => (props.asset?.id ? resolveStaticScanApi(ApiSecDomainAsset.files, { id: props.asset.id }) : ''),
  {},
)
const candidatesList = useAssetSubList<AssetSubListFilter>(
  () => (props.asset?.id ? resolveStaticScanApi(ApiSecDomainAsset.candidates, { id: props.asset.id }) : ''),
  {},
)
const issuesList = useAssetSubList<AssetSubListFilter>(
  () => (props.asset?.id ? resolveStaticScanApi(ApiSecDomainAsset.issues, { id: props.asset.id }) : ''),
  {},
)
// 同步历史按资产类型+来源过滤：表单挂环境维度（domain=form,source_ref_type=env,source_ref_id=env_id），
// 微服务挂仓库维度（domain=microservice,source_ref_type=repository,source_ref_id/repository_id=repository_id）
const syncRunsList = useAssetSubList<DomainAssetSyncRunsFilter>(
  () => ApiSecDomainAsset.syncRuns,
  { domain: '', source_ref_type: '', source_ref_id: '', repository_id: '', status: '', keyword: '' },
)

const activeSubList = computed(() => {
  switch (activeKind.value) {
    case 'files': return filesList
    case 'candidates': return candidatesList
    case 'issues': return issuesList
    case 'sync_history': return syncRunsList
    default: return null
  }
})

// ── 内嵌数据（插件 / 菜单 / Helper）的客户端分页 ────

/** 两个分页来源（服务端 usePagedQuery / 客户端切片）的统一形状 */
interface TablePagination {
  total: number
  current: number
  pageSize: number
  showTotal: boolean
  showPageSize: boolean
  pageSizeOptions?: number[]
}

const clientPage = ref(1)
const clientPageSize = ref(20)

const embeddedRows = computed<Record<string, unknown>[]>(() => {
  switch (activeKind.value) {
    case 'plugins': return buildPluginRows(detail.value?.form)
    case 'menus': return buildMenuRows(detail.value?.form)
    case 'helper_files': return buildHelperRows(detail.value?.microservice)
    default: return []
  }
})

const clientRows = computed(() => {
  const start = (clientPage.value - 1) * clientPageSize.value
  return embeddedRows.value.slice(start, start + clientPageSize.value)
})

const clientPagination = computed<TablePagination>(() => ({
  total: embeddedRows.value.length,
  current: clientPage.value,
  pageSize: clientPageSize.value,
  showTotal: true,
  showPageSize: true,
  pageSizeOptions: DOMAIN_ASSET_PAGE_SIZES,
}))

function onClientPageChange(page: number) {
  clientPage.value = page
}

function onClientPageSizeChange(size: number) {
  clientPageSize.value = size
  clientPage.value = 1
}

// ── 表格（当前 tab 一张表，内嵌走客户端分页 / 其余走后端分页）──

const cellRender = createAssetCellRenderer({ envName, repositoryName: repoName })

/** 内嵌数据的列从**全量行**推导（只在数据变化时算一次，翻页不重算、列不跳变） */
const embeddedColumns = computed(() => toTableColumns(deriveScalarColumns(embeddedRows.value), cellRender))

function subColumns(kind: AssetTabKind, rows: Record<string, unknown>[]): AssetColumnDef[] {
  if (kind === 'candidates')
    return CANDIDATE_COLUMNS()
  if (kind === 'issues')
    return ISSUE_COLUMNS()
  // 文件与同步运行的响应字段后端未固定契约，按行内容推导，不写死列
  return deriveScalarColumns(rows)
}

interface ActiveTable {
  data: Record<string, unknown>[]
  columns: Record<string, any>[]
  loading: boolean
  failed: boolean
  emptyText: string
  pagination: TablePagination
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  retry: () => void
}

const activeTable = computed<ActiveTable | null>(() => {
  const def = activeTabDef.value
  const kind = def?.kind
  if (!def || !kind)
    return null
  const emptyText = def.emptyText ?? '暂无数据'
  if (isEmbeddedTabKind(kind)) {
    return {
      data: clientRows.value,
      columns: embeddedColumns.value,
      loading: detailLoading.value,
      failed: detailFailed.value,
      emptyText,
      pagination: clientPagination.value,
      onPageChange: onClientPageChange,
      onPageSizeChange: onClientPageSizeChange,
      retry: fetchDetail,
    }
  }
  const list = activeSubList.value
  if (!list)
    return null
  return {
    data: list.rows.value,
    columns: toTableColumns(subColumns(kind, list.rows.value), cellRender),
    loading: list.loading.value,
    failed: list.failed.value,
    emptyText,
    pagination: list.pagination.value,
    onPageChange: list.onPageChange,
    onPageSizeChange: list.onPageSizeChange,
    retry: list.fetchList,
  }
})

/** 横向滚动阈值：列宽合计不足时按抽屉宽度铺满 */
const tableMinWidth = computed(() => {
  const total = (activeTable.value?.columns ?? []).reduce(
    (sum, column) => sum + (typeof column.width === 'number' ? column.width : 160),
    0,
  )
  return Math.max(1200, total)
})

// ── 基本信息展示 ──────────────────────────────────

const assetTypeTag = computed(() => assetTypeMeta(props.asset?.asset_type))
const identityLabel = computed(() => assetIdentityLabel(props.asset?.asset_type))
const identityValue = computed(() => (snapshot.value ? assetIdentityValue(snapshot.value) : '--'))
const isFormAsset = computed(() => assetKind(props.asset?.asset_type) === 'form')
const idText = computed(() => asText(snapshot.value?.id))
const envText = computed(() => envName(snapshot.value?.env_id))
const repositoryText = computed(() => repoName(snapshot.value?.repository_id))
const appText = computed(() => asText(snapshot.value?.app_id))
const pluginClassText = computed(() => asText(snapshot.value?.plugin_class))
const sourceRefText = computed(() => asText(snapshot.value?.source_ref_type))
const matchCountsText = computed(() => matchStatusCountsText(snapshot.value?.match_status_counts))
const lastSyncRunText = computed(() => asText(snapshot.value?.last_sync_run_id))
const inScopeMeta = computed(() => cellTagMeta('scope', snapshot.value?.in_scope))
const activeMeta = computed(() => cellTagMeta('active', snapshot.value?.active))
const createdAtText = computed(() => formatTime(snapshot.value?.created_at))
const updatedAtText = computed(() => formatTime(snapshot.value?.updated_at))

// ── 人工覆盖（PATCH 仅四个字段）────────────────────

const draft = reactive(toManualDraft(null))
const saving = ref(false)

/** 用当前快照重置编辑草稿（打开抽屉、保存成功、点「还原」时调用） */
function syncDraft() {
  Object.assign(draft, toManualDraft(snapshot.value))
}

/** PATCH /manual-fields：vueuse 的 createFetch 直接支持 patch 链 */
async function patchManualFields(id: string, payload: DomainAssetManualFieldsRequest): Promise<Record<string, unknown> | null> {
  const request = useRequest<Record<string, unknown>>(
    resolveStaticScanApi(ApiSecDomainAsset.manualFields, { id }),
    { immediate: false },
  )
    .patch(payload, 'json')
    .json<Record<string, unknown>>()
  await request.execute()
  const data = request.data.value
  return isRequestFailed(data) ? null : (data as Record<string, unknown>)
}

async function handleSave() {
  const asset = snapshot.value
  if (!asset)
    return
  const payload = buildManualFieldsPayload(asset, draft)
  if (!payload) {
    Message.info('没有需要保存的改动')
    return
  }
  saving.value = true
  const res = await patchManualFields(asset.id, payload)
  saving.value = false
  if (!res)
    return // 失败原因拦截器已经提示过
  // 不假设 PATCH 返回完整资产对象：把已提交的改动叠加到展示快照上即可
  manualOverrides.value = manualOverrides.value ? { ...manualOverrides.value, ...payload } : payload
  syncDraft()
  Message.success('已保存')
  emit('changed')
}

// ── 重新匹配（仅表单资产，且需要匹配证据）───────────

const rematching = ref(false)
const rematchEvidence = computed(() => resolveRematchEvidence(snapshot.value, detail.value))

async function handleRematch() {
  const evidence = rematchEvidence.value
  if (!evidence.ready) {
    Message.warning(evidence.reason || '当前资产暂不可重新匹配')
    return
  }
  rematching.value = true
  const res = await postAction<Record<string, unknown>>(ApiSecDomainAsset.rematch, {
    form_sync_run_id: evidence.form_sync_run_id,
    repository_id: evidence.repository_id,
    snapshot_commit: evidence.snapshot_commit,
  })
  rematching.value = false
  if (!res)
    return
  Message.success('已发起重新匹配')
  await refreshAll()
  emit('changed')
}

// ── 专项扫描（后端尚未提供资产级安全参数，保持禁用）──

const scanDisabledReason = computed(() => scanTriggerDisabledReason(snapshot.value))

async function handleSpecialScan() {
  const reason = scanDisabledReason.value
  if (reason) {
    Message.warning(reason)
    return
  }
  const asset = snapshot.value
  if (!asset)
    return
  const res = await postAction<Record<string, unknown>>(ApiSecPrescan.trigger, buildPrescanTriggerPayload(asset))
  if (res)
    Message.success('已发起专项扫描')
}

// ── 打开 / 刷新 / 重新匹配后的数据同步 ─────────────

async function refreshAll() {
  await fetchDetail()
  await activeSubList.value?.fetchList()
}

/**
 * 打开抽屉（或换资产）时的复位。
 *
 * 必须重新拉详情：列表行不含内嵌数据；同时把 tab 回到基本信息，
 * 避免上一个资产的停留位置串到下一条。
 */
function prepareForOpen() {
  activeTabKey.value = 'basic'
  clientPage.value = 1
  detail.value = null
  detailFailed.value = false
  manualOverrides.value = null
  filesList.reset()
  candidatesList.reset()
  issuesList.reset()
  syncRunsList.reset()
  {
    const q = syncRunsList.query.value
    const isForm = assetKind(props.asset?.asset_type) === 'form'
    q.domain = isForm ? 'form' : 'microservice'
    q.source_ref_type = isForm ? 'env' : 'repository'
    q.source_ref_id = isForm ? (props.asset?.env_id ?? '') : (props.asset?.repository_id ?? '')
    q.repository_id = isForm ? '' : (props.asset?.repository_id ?? '')
    q.status = ''
    q.keyword = ''
  }
  syncDraft()
  fetchDetail()
}

watch([() => props.visible, () => props.asset?.id], ([visible]) => {
  if (visible)
    prepareForOpen()
}, { immediate: true })

// 切到某个 tab 时按需拉取它的数据；每次切回来都重拉，保证重匹配/保存后的状态能立刻反映。
// 内嵌三类直接用详情数据，不额外请求。
watch(activeTabKey, () => {
  clientPage.value = 1
  activeSubList.value?.fetchList()
})

function close() {
  emit('update:visible', false)
}
</script>

<template>
  <a-drawer
    :visible="visible"
    :width="1000"
    :footer="false"
    unmount-on-close
    @cancel="close"
  >
    <template #title>
      <div class="title-line">
        <span>{{ identityValue }}</span>
        <a-tag :color="assetTypeTag.color" size="small">
          {{ assetTypeTag.label }}
        </a-tag>
      </div>
    </template>

    <a-alert v-if="detailFailed" type="warning" class="m-b-12px">
      <div class="alert-line">
        <span>详情接口未返回数据，以下为列表快照；插件绑定 / 菜单 / Helper 依赖需要详情。</span>
        <a-link @click="fetchDetail">
          重试
        </a-link>
      </div>
    </a-alert>

    <div class="m-b-8px">
      <a-space>
        <a-button size="small" :loading="detailLoading" @click="refreshAll">
          <template #icon>
            <icon-refresh />
          </template>
          刷新
        </a-button>
        <a-tooltip :content="rematchEvidence.ready ? '按最近一次同步的运行与匹配快照重新执行匹配' : rematchEvidence.reason">
          <span class="inline-block">
            <a-button
              size="small"
              type="primary"
              :loading="rematching"
              :disabled="!rematchEvidence.ready"
              @click="handleRematch"
            >
              重新匹配
            </a-button>
          </span>
        </a-tooltip>
        <a-tooltip :content="scanDisabledReason || '按该资产发起安全专项扫描'">
          <span class="inline-block">
            <a-button size="small" :disabled="!!scanDisabledReason" @click="handleSpecialScan">
              发起专项扫描
            </a-button>
          </span>
        </a-tooltip>
      </a-space>
    </div>

    <a-tabs v-model:active-key="activeTabKey" type="line" size="small">
      <a-tab-pane v-for="tab in tabs" :key="tab.key" :title="tab.title">
        <!-- 只渲染当前 tab 的内容：表格同一时刻只有一张，插件 2 万行不会一次性进 DOM -->
        <template v-if="tab.key === activeTabKey">
          <template v-if="tab.key === 'basic'">
            <a-descriptions :column="2" bordered>
              <a-descriptions-item label="资产ID">
                {{ idText }}
              </a-descriptions-item>
              <a-descriptions-item label="资产类型">
                <a-tag :color="assetTypeTag.color" size="small">
                  {{ assetTypeTag.label }}
                </a-tag>
              </a-descriptions-item>
              <a-descriptions-item :label="identityLabel">
                {{ identityValue }}
              </a-descriptions-item>
              <a-descriptions-item label="环境">
                {{ envText }}
              </a-descriptions-item>
              <a-descriptions-item label="代码仓库">
                {{ repositoryText }}
              </a-descriptions-item>
              <a-descriptions-item label="应用">
                {{ appText }}
              </a-descriptions-item>
              <a-descriptions-item v-if="isFormAsset" label="插件类">
                {{ pluginClassText }}
              </a-descriptions-item>
              <a-descriptions-item label="来源类型">
                {{ sourceRefText }}
              </a-descriptions-item>
              <a-descriptions-item label="匹配状态">
                {{ matchCountsText }}
              </a-descriptions-item>
              <a-descriptions-item label="扫描范围">
                <a-tag :color="inScopeMeta.color" size="small">
                  {{ inScopeMeta.label }}
                </a-tag>
              </a-descriptions-item>
              <a-descriptions-item label="启用">
                <a-tag :color="activeMeta.color" size="small">
                  {{ activeMeta.label }}
                </a-tag>
              </a-descriptions-item>
              <a-descriptions-item label="最近同步运行">
                {{ lastSyncRunText }}
              </a-descriptions-item>
              <a-descriptions-item label="创建时间">
                {{ createdAtText }}
              </a-descriptions-item>
              <a-descriptions-item label="更新时间">
                {{ updatedAtText }}
              </a-descriptions-item>
            </a-descriptions>

            <a-divider orientation="left">
              人工覆盖
            </a-divider>
            <a-form :model="draft" :label-col-props="{ span: 4 }" :wrapper-col-props="{ span: 16 }">
              <a-form-item label="扫描范围">
                <a-switch v-model="draft.in_scope" checked-text="范围内" unchecked-text="范围外" />
              </a-form-item>
              <a-form-item label="负责人">
                <a-input v-model="draft.owner" placeholder="该资产负责人" allow-clear />
              </a-form-item>
              <a-form-item label="标签">
                <a-input-tag v-model="draft.tags" placeholder="输入后回车添加标签" allow-clear />
              </a-form-item>
              <a-form-item label="备注">
                <a-textarea v-model="draft.remark" placeholder="补充说明" :auto-size="{ minRows: 2, maxRows: 4 }" />
              </a-form-item>
              <a-form-item :wrapper-col-props="{ offset: 4, span: 16 }">
                <a-space>
                  <a-button type="primary" :loading="saving" @click="handleSave">
                    保存
                  </a-button>
                  <a-button :disabled="saving" @click="syncDraft">
                    还原
                  </a-button>
                </a-space>
              </a-form-item>
            </a-form>
          </template>

          <template v-else-if="activeTable">
            <a-table
              :data="activeTable.data"
              :columns="activeTable.columns"
              :loading="activeTable.loading"
              :pagination="activeTable.pagination"
              :scroll="{ minWidth: tableMinWidth }"
              size="small"
              @page-change="activeTable.onPageChange"
              @page-size-change="activeTable.onPageSizeChange"
            >
              <template #empty>
                <a-result v-if="activeTable.failed" status="warning" title="加载失败">
                  <template #extra>
                    <a-button size="small" type="primary" @click="activeTable.retry()">
                      重试
                    </a-button>
                  </template>
                </a-result>
                <a-empty v-else :description="activeTable.emptyText" />
              </template>
            </a-table>
          </template>
        </template>
      </a-tab-pane>
    </a-tabs>
  </a-drawer>
</template>

<style scoped>
.title-line {
  display: flex;
  align-items: center;
  gap: 8px;
}

.alert-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
</style>
