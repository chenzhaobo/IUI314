<script setup lang="ts">
import type { ColumnFilterState } from '@/hooks'
import type { ModuleWithRepository, MutationReceipt, RepositoryEditRequest, RepositorySyncResponse } from '@/types/static-scan'
import { Message } from '@arco-design/web-vue'
import { useDebounceFn } from '@vueuse/core'
import { computed, reactive, ref, watch } from 'vue'
import { ApiPerfModule } from '@/api/perfApis'
import { ApiSecModuleRepository } from '@/api/sechubApis'
import ColumnFilterPanel from '@/components/common/ColumnFilterPanel.vue'
import {
  applyColumnFilters,
  emptyFilter,
  isFilterActive,
  newIdempotencyKey,
  postAction,
  putAction,
  useFilterPersistence,
  useGet,
  useTableAutoHeight,
  withTableDefaults,
} from '@/hooks'

defineOptions({ name: 'repositories' })

// 加载已绑定仓库的模块列表
const { data: listData, isFetching: loading, execute: loadList } = useGet<ModuleWithRepository[]>(
  ApiSecModuleRepository.listWithModule,
  {},
  { immediate: true },
)
const rows = computed(() => listData.value ?? [])

// ===== 新增弹窗 =====
const addVisible = ref(false)
const addLoading = ref(false)
const addForm = reactive({
  module_id: '',
  code: '',
  name: '',
  git_url: '',
  // 默认分支默认值改为 feature_sit（内网静态扫描场景标准分支）
  default_branch: 'feature_sit',
  root_path: '',
  scan_enabled: true,
})

// 模块选项（从模块管理查询，走后端 keyword 远程搜索）
// perf_module 有 2000+ 条，一次性拉前 N 条 + 前端过滤会搜不到靠后的模块，
// 所以这里把关键字交给后端过滤（对 name/code/module_code 做 contains）。
interface ModuleOption {
  id: string
  name: string
  module_code: string
  code: string
}

const MODULE_PAGE_SIZE = 100
const moduleOptions = ref<ModuleOption[]>([])
const moduleLoading = ref(false)
// 已选模块单独留存：远程搜索会整体替换 options，否则已选项的回显文本会丢
const selectedModule = ref<ModuleOption | null>(null)

const moduleSelectOptions = computed<ModuleOption[]>(() => {
  const list = moduleOptions.value
  const picked = selectedModule.value
  if (picked && !list.some(m => m.id === picked.id))
    return [picked, ...list]
  return list
})

// module_code 存在重复（如 ssc 有多条），标签里附带应用编码以便区分
function moduleLabel(m: ModuleOption) {
  const parts = [m.name]
  if (m.module_code)
    parts.push(`(${m.module_code})`)
  if (m.code && m.code !== m.module_code)
    parts.push(`· ${m.code}`)
  return parts.join(' ')
}

async function loadModuleOptions(keyword = '') {
  moduleLoading.value = true
  try {
    const { data, execute } = useGet<any>(
      ApiPerfModule.getList,
      { page_num: 1, page_size: MODULE_PAGE_SIZE, keyword },
      { immediate: false },
    )
    await execute()
    const list = data.value?.list ?? data.value ?? []
    moduleOptions.value = Array.isArray(list)
      ? list.map((m: any) => ({
          id: m.id,
          name: m.name ?? '',
          module_code: m.module_code ?? '',
          code: m.code ?? '',
        }))
      : []
  }
  finally {
    moduleLoading.value = false
  }
}

const onModuleSearch = useDebounceFn((keyword: string) => {
  void loadModuleOptions((keyword ?? '').trim())
}, 300)

function onModuleChange(value: unknown) {
  const id = value == null ? '' : String(value)
  selectedModule.value = moduleOptions.value.find(m => m.id === id) ?? null
}

function openAddDialog() {
  addForm.module_id = ''
  addForm.code = ''
  addForm.name = ''
  addForm.git_url = ''
  // 重置时同样使用 feature_sit，与表单初始值保持一致
  addForm.default_branch = 'feature_sit'
  addForm.root_path = ''
  addForm.scan_enabled = true
  addVisible.value = true
  selectedModule.value = null
  // 每次打开都重新拉第一页，避免沿用上次搜索后的残留列表
  void loadModuleOptions()
}

async function submitAdd() {
  if (!addForm.module_id) {
    Message.warning('请选择模块')
    return
  }
  if (!addForm.git_url) {
    Message.warning('请填写 Git URL')
    return
  }
  addLoading.value = true
  try {
    // 失败判定必须用 postAction（返回 null）而不是 error.value ——
    // 拦截器对业务错误只把 data 换成 ErrorFlag，从不设置 error，
    // 用 error.value 判断会把「后端明确拒绝」当成成功，然后弹「绑定成功」
    // 把拦截器的红色提示覆盖掉：用户看到成功，库里没有数据。
    const ok = await postAction<MutationReceipt>(
      ApiSecModuleRepository.bind,
      {
        module_id: addForm.module_id,
        code: addForm.code || addForm.git_url.split('/').pop()?.replace('.git', '') || 'repo',
        name: addForm.name || addForm.code || addForm.git_url.split('/').pop()?.replace('.git', '') || 'repo',
        git_url: addForm.git_url,
        default_branch: addForm.default_branch || 'feature_sit',
        root_path: addForm.root_path || null,
        scan_enabled: addForm.scan_enabled,
        is_primary: true,
        allow_local_test_repository: false,
        idempotency_key: newIdempotencyKey(),
      },
    )
    if (!ok)
      return
    Message.success('代码仓库绑定成功，状态为「待验证」，请点击「验证」确认可达')
    addVisible.value = false
    await loadList()
  }
  finally {
    addLoading.value = false
  }
}

// ===== 编辑弹窗 =====
// 只提交与原值不同的字段：后端 validate_edit_request 会拒绝「没有任何变更」的请求，
// 且 git_url / 默认分支 / 凭据变更会把状态退回 pending_validation，不能无脑全量提交。
const editVisible = ref(false)
const editLoading = ref(false)
const editRecord = ref<ModuleWithRepository | null>(null)
const editForm = reactive({
  name: '',
  code: '',
  git_url: '',
  default_branch: '',
  root_path: '',
  scan_enabled: true,
})

function openEditDialog(record: ModuleWithRepository) {
  editRecord.value = record
  editForm.name = record.repository_name
  editForm.code = record.repository_code
  editForm.git_url = record.git_url
  editForm.default_branch = record.default_branch
  editForm.root_path = record.root_path ?? ''
  editForm.scan_enabled = record.scan_enabled
  editVisible.value = true
}

function buildEditPayload(record: ModuleWithRepository): RepositoryEditRequest | null {
  const payload: RepositoryEditRequest = {
    module_id: record.module_id,
    relation_id: record.relation_id,
    idempotency_key: newIdempotencyKey(),
  }
  let changed = false
  const name = editForm.name.trim()
  if (name && name !== record.repository_name) {
    payload.name = name
    changed = true
  }
  const code = editForm.code.trim()
  if (code && code !== record.repository_code) {
    payload.code = code
    changed = true
  }
  const gitUrl = editForm.git_url.trim()
  if (gitUrl && gitUrl !== record.git_url) {
    payload.git_url = gitUrl
    payload.allow_local_test_repository = gitUrl.startsWith('local-test:')
    // 后端要求切到 local-test 时必须显式清空凭据
    if (payload.allow_local_test_repository)
      payload.clear_credential = true
    changed = true
  }
  const branch = editForm.default_branch.trim()
  if (branch && branch !== record.default_branch) {
    payload.default_branch = branch
    changed = true
  }
  const rootPath = editForm.root_path.trim()
  const originalRootPath = (record.root_path ?? '').trim()
  if (rootPath !== originalRootPath) {
    if (rootPath)
      payload.root_path = rootPath
    else
      payload.clear_root_path = true
    changed = true
  }
  if (editForm.scan_enabled !== record.scan_enabled) {
    payload.scan_enabled = editForm.scan_enabled
    changed = true
  }
  return changed ? payload : null
}

async function submitEdit() {
  const record = editRecord.value
  if (!record)
    return
  if (!editForm.name.trim() || !editForm.code.trim() || !editForm.git_url.trim() || !editForm.default_branch.trim()) {
    Message.warning('仓库名称、编码、Git URL 与默认分支不能为空')
    return
  }
  const payload = buildEditPayload(record)
  if (!payload) {
    Message.info('没有任何修改')
    return
  }
  editLoading.value = true
  try {
    const data = await putAction<MutationReceipt>(
      ApiSecModuleRepository.edit,
      payload as unknown as Record<string, unknown>,
    )
    if (!data)
      return
    // 改了 Git URL / 分支 / 凭据后状态会退回待验证，明确提示用户重新验证
    if (data.status === 'pending_validation')
      Message.success('已保存，仓库地址或分支已变更，状态退回待验证，请重新执行验证')
    else
      Message.success('已保存')
    editVisible.value = false
    await loadList()
  }
  finally {
    editLoading.value = false
  }
}

// ===== 表格列 =====
//
// 三件此前缺失的能力，全部靠 Arco a-table 的既有 props 打开，不需要换组件：
//   · column-resizable → 列宽可拖动。**这是表级 prop**，不是列级的。
//     仓库里有 43 个文件在列定义里写 `resizable: true`，但 Arco 的
//     `TableColumnData`（es/table/interface.d.ts:53）**没有这个字段** ——
//     那是个不存在的属性，完全不生效，列宽照样拖不动。真正的开关只有表上这一个。
//   · filterable → 列头筛选漏斗；Arco 自带的是"枚举多选"，而这里要过滤仓库名/编码/
//     Git URL 这类自由文本，候选无穷、枚举不适用，所以用自家的 ColumnFilterPanel
//     （运算符面板：包含/不包含/等于/不等于），见 @/hooks/util/useColumnFilter
//   · a-table 的 :pagination 传对象而不是 false → 分页 + 每页条数下拉
// 分页状态（声明在列过滤之前：onColumnFilterChange 要复位页码）
const pageNum = ref(1)
const pageSize = ref(20)
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 200]

const FILTERABLE_COLUMNS = [
  'module_name',
  'module_code',
  'repository_name',
  'repository_code',
  'git_url',
  'default_branch',
  'root_path',
] as const

/** 列过滤条件：按 dataIndex 存一份 */
const columnFilters = ref<Record<string, ColumnFilterState>>(
  Object.fromEntries(FILTERABLE_COLUMNS.map(k => [k, emptyFilter('text')])),
)

function onColumnFilterChange() {
  // 条件变了要回第一页；持久化由 useFilterPersistence 的 deep watch 自动完成
  pageNum.value = 1
}

/** 生成列的 filterable 配置；带激活态高亮，否则用户看不出哪列在过滤 */
function filterableOf(key: string) {
  return {
    slotName: `filter-${key}`,
    // Arco 靠 filteredValue 非空给漏斗图标加高亮，这里借它表达"该列有过滤生效"
    filteredValue: isFilterActive(columnFilters.value[key]) ? ['1'] : [],
    // 过滤实际由 applyColumnFilters 在 filteredRows 里做（要和顶部关键字取交集，
    // 还要驱动分页复位）。这里必须给个恒真的 filter 满足 Arco 的类型契约，
    // 否则它会再按自己那套枚举语义过滤一遍。
    filter: () => true,
    // 隐藏 Arco 自带的确定/重置按钮，面板里已有「清空 / 筛选」
    hideButton: true,
  }
}

const columns = computed(() => withTableDefaults([
  { title: '模块名称', dataIndex: 'module_name', width: 160, filterable: filterableOf('module_name') },
  { title: '模块简码', dataIndex: 'module_code', width: 120, filterable: filterableOf('module_code') },
  { title: '仓库名称', dataIndex: 'repository_name', width: 160, filterable: filterableOf('repository_name') },
  { title: '仓库编码', dataIndex: 'repository_code', width: 120, filterable: filterableOf('repository_code') },
  { title: 'Git URL', dataIndex: 'git_url', width: 280, filterable: filterableOf('git_url') },
  { title: '默认分支', dataIndex: 'default_branch', width: 100, filterable: filterableOf('default_branch') },
  { title: '根路径', dataIndex: 'root_path', width: 120, filterable: filterableOf('root_path') },
  { title: '扫描启用', dataIndex: 'scan_enabled', slotName: 'scanEnabled', width: 90 },
  { title: '状态', dataIndex: 'status', slotName: 'status', width: 100 },
  { title: '操作', slotName: 'operations', width: 340, fixed: 'right' as const },
]))

// ===== 过滤条件 =====
const keyword = ref('')
const statusFilter = ref('')

/**
 * 顶部关键字：一次覆盖「模块名称/简码 + 仓库名称/编码 + Git URL」。
 *
 * 原实现漏了 `module_code`（模块简码）——它恰好是内网找仓库最常用的入口，
 * 搜 `ssc` 之类的简码搜不到东西。列头筛选是精确定位某一列，
 * 顶部关键字是"不确定在哪一列"时的粗筛，两者互补。
 */
const filteredRows = computed(() => {
  let list = rows.value
  if (statusFilter.value)
    list = list.filter(r => r.status === statusFilter.value)

  const kw = keyword.value.trim().toLowerCase()
  if (kw) {
    const hit = (v: string | null | undefined) => (v ?? '').toLowerCase().includes(kw)
    list = list.filter(r =>
      hit(r.module_name) || hit(r.module_code)
      || hit(r.repository_name) || hit(r.repository_code)
      || hit(r.git_url),
    )
  }
  // 列头筛选叠加在上面的粗筛之上（取交集）
  return applyColumnFilters(list, columnFilters.value)
})

// ===== 分页（前端分页）=====
//
// 为什么在前端分页：`/module/repositories-with-module` 是一次返回全量绑定的接口
// （本机测试库 186 条，生产 182 条），后端没有分页参数。为它加分页要动接口契约，
// 而这个量级前端切片毫无压力；真正的痛点是"一屏 180 行滚不到底"，切片就解决了。
// 数据量再涨一个数量级时再推后端分页。

const pagedRows = computed(() => {
  const start = (pageNum.value - 1) * pageSize.value
  return filteredRows.value.slice(start, start + pageSize.value)
})

// 过滤后总数变少时，当前页可能已越界（例如停在第 9 页又筛出 3 条），
// 不复位就会显示空表格而用户以为"没数据"。
watch(filteredRows, (list) => {
  const maxPage = Math.max(1, Math.ceil(list.length / pageSize.value))
  if (pageNum.value > maxPage)
    pageNum.value = maxPage
})

function onPageSizeChange(size: number) {
  pageSize.value = size
  pageNum.value = 1
}

// 关键字/状态变化都要回到第一页，否则同上会看到空表格
watch([keyword, statusFilter], () => {
  pageNum.value = 1
})

// 每页条数与筛选条件按标签页暂存：页内往返（点进详情再回来）不用重新设一遍。
// 见 @/hooks/util/useFilterPersistence 里关于 keep-alive key 带 query 的说明。
useFilterPersistence('sechub-repositories', {
  keyword,
  statusFilter,
  pageSize,
  columnFilters,
})

// ===== 表格高度自适应（滚动条出现在表格内，表头固定）=====
//
// 原来只给了 `:scroll.x`，没有 y —— 数据一多就得拖整个页面的滚动条，
// 表头跟着滚出视口，看到第 30 行时已经不知道哪列是哪列。
// 固定写 y: 400 在大屏上又白浪费半屏，所以按视口实时算。
const tableWrap = ref<HTMLElement>()
const { tableHeight } = useTableAutoHeight(tableWrap)

// ===== 详情抽屉 =====
const detailVisible = ref(false)
const detailRecord = ref<ModuleWithRepository | null>(null)
function openDetail(record: ModuleWithRepository) {
  detailRecord.value = record
  detailVisible.value = true
}

const statusMap: Record<string, { label: string, color: string }> = {
  // 后端 ck_sec_repository_status 只允许这四个取值
  pending_validation: { label: '待验证', color: 'orange' },
  active: { label: '已验证', color: 'green' },
  invalid: { label: '校验失败', color: 'red' },
  disabled: { label: '禁用', color: 'gray' },
}

function statusInfo(status: string) {
  return statusMap[status] ?? { label: status, color: 'gray' }
}

// 验证仓库：带上 module_id/relation_id，后端才会以库里存的配置为准并写回状态
const validatingId = ref('')
async function validateRepo(record: ModuleWithRepository) {
  validatingId.value = record.relation_id
  try {
    const ok = await postAction(
      ApiSecModuleRepository.validate,
      {
        module_id: record.module_id,
        relation_id: record.relation_id,
        git_url: record.git_url,
        default_branch: record.default_branch,
        allow_local_test_repository: record.git_url.startsWith('local-test:'),
        idempotency_key: newIdempotencyKey(),
      },
    )
    // 失败也要刷新：后端已把 status 写成 invalid、validation_error 落库
    await loadList()
    if (ok)
      Message.success('仓库校验通过')
  }
  finally {
    validatingId.value = ''
  }
}

// 触发源码快照
const snapshottingId = ref('')
async function triggerSnapshot(record: ModuleWithRepository) {
  snapshottingId.value = record.relation_id
  try {
    const ok = await postAction(
      ApiSecModuleRepository.sourceSnapshot,
      {
        module_id: record.module_id,
        relation_id: record.relation_id,
        operation: 'update',
        revision: {},
        idempotency_key: newIdempotencyKey(),
      },
    )
    if (ok)
      Message.success('已提交源码快照任务')
  }
  finally {
    snapshottingId.value = ''
  }
}

// 克隆/拉取仓库：调 sync 接口，展示可读结果（动作/分支数/head_sha/耗时）
const syncingId = ref('')
async function syncRepo(record: ModuleWithRepository) {
  syncingId.value = record.relation_id
  try {
    const res = await postAction<RepositorySyncResponse>(
      ApiSecModuleRepository.sync,
      {
        module_id: record.module_id,
        relation_id: record.relation_id,
      },
    )
    if (!res)
      return
    // 动作翻译：cloned→已克隆，fetched→已拉取，其余原样展示
    const actionLabel = res.action === 'cloned' ? '已克隆' : res.action === 'fetched' ? '已拉取' : res.action
    const shortSha = res.head_sha ? res.head_sha.slice(0, 8) : '-'
    const dur = res.duration_ms != null ? `${(res.duration_ms / 1000).toFixed(1)}s` : '-'
    Message.success(`${actionLabel}，分支数 ${res.branch_count}，HEAD ${shortSha}，耗时 ${dur}`)
  }
  finally {
    syncingId.value = ''
  }
}
</script>

<template>
  <div class="static-scan-repositories">
    <a-card :bordered="false" class="m-b-8px">
      <a-space wrap>
        <a-button type="primary" @click="openAddDialog">
          <template #icon>
            <icon-plus />
          </template>
          新增
        </a-button>
        <a-button :loading="loading" @click="loadList()">
          <template #icon>
            <icon-refresh />
          </template>
          刷新
        </a-button>
        <a-input-search
          v-model="keyword"
          placeholder="搜索模块/仓库/Git URL"
          allow-clear
          style="width: 240px"
        />
        <a-select v-model="statusFilter" placeholder="状态" allow-clear style="width: 120px">
          <a-option value="pending_validation">
            待验证
          </a-option>
          <a-option value="active">
            已验证
          </a-option>
          <a-option value="invalid">
            校验失败
          </a-option>
          <a-option value="disabled">
            禁用
          </a-option>
        </a-select>
        <a-typography-text type="secondary">
          共 {{ filteredRows.length }} 条
        </a-typography-text>
      </a-space>
    </a-card>

    <div ref="tableWrap">
      <a-card :bordered="false">
        <a-table
          :data="pagedRows"
          :columns="columns"
          :loading="loading"
          :pagination="{
            current: pageNum,
            pageSize,
            total: filteredRows.length,
            showTotal: true,
            showPageSize: true,
            pageSizeOptions: PAGE_SIZE_OPTIONS,
          }"
          column-resizable
          row-key="relation_id"
          :scroll="{ x: 1400, y: tableHeight }"
          @page-change="(p: number) => (pageNum = p)"
          @page-size-change="onPageSizeChange"
        >
          <!-- 列头筛选面板：Arco 自带的 filters 是枚举多选，这里要过滤自由文本，
               所以用共享的运算符面板（包含/不包含/等于/不等于） -->
          <template v-for="key in FILTERABLE_COLUMNS" #[`filter-${key}`] :key="key">
            <ColumnFilterPanel v-model="columnFilters[key]" @change="onColumnFilterChange" />
          </template>

          <template #scanEnabled="{ record }">
            <a-tag :color="record.scan_enabled ? 'green' : 'gray'" size="small">
              {{ record.scan_enabled ? '启用' : '禁用' }}
            </a-tag>
          </template>

          <template #status="{ record }">
            <a-tag :color="statusInfo(record.status).color" size="small">
              {{ statusInfo(record.status).label }}
            </a-tag>
          </template>

          <template #operations="{ record }">
            <a-space>
              <a-button type="text" size="small" @click="openDetail(record)">
                详情
              </a-button>
              <a-button type="text" size="small" @click="openEditDialog(record)">
                编辑
              </a-button>
              <a-button
                type="text"
                size="small"
                :loading="validatingId === record.relation_id"
                @click="validateRepo(record)"
              >
                验证
              </a-button>
              <a-button
                type="text"
                size="small"
                :loading="snapshottingId === record.relation_id"
                @click="triggerSnapshot(record)"
              >
                快照
              </a-button>
              <!-- 克隆/拉取：调 sync 接口，单行 loading，成功展示动作/分支数/head_sha/耗时 -->
              <a-button
                type="text"
                size="small"
                :loading="syncingId === record.relation_id"
                @click="syncRepo(record)"
              >
                克隆/拉取
              </a-button>
            </a-space>
          </template>
        </a-table>
      </a-card>
    </div>

    <!-- 新增代码仓库弹窗 -->
    <a-modal
      v-model:visible="addVisible"
      title="新增代码仓库"
      :ok-loading="addLoading"
      @ok="submitAdd"
      @cancel="addVisible = false"
    >
      <a-form :model="addForm" layout="vertical">
        <a-form-item label="模块" required>
          <a-select
            v-model="addForm.module_id"
            placeholder="输入模块名称 / 简码 / 应用编码搜索"
            allow-search
            :filter-option="false"
            :loading="moduleLoading"
            @search="onModuleSearch"
            @change="onModuleChange"
          >
            <a-option v-for="m in moduleSelectOptions" :key="m.id" :value="m.id">
              {{ moduleLabel(m) }}
            </a-option>
            <template #empty>
              <div style="padding: 8px; color: var(--color-text-3)">
                {{ moduleLoading ? '搜索中…' : '无匹配模块，请输入关键字搜索' }}
              </div>
            </template>
          </a-select>
        </a-form-item>
        <a-form-item label="仓库编码">
          <a-input v-model="addForm.code" placeholder="留空则自动从 Git URL 提取" />
        </a-form-item>
        <a-form-item label="仓库名称">
          <a-input v-model="addForm.name" placeholder="留空则自动从 Git URL 提取" />
        </a-form-item>
        <a-form-item label="Git URL" required>
          <a-input v-model="addForm.git_url" placeholder="https://git.example.com/group/repo.git" />
        </a-form-item>
        <a-form-item label="默认分支">
          <a-input v-model="addForm.default_branch" placeholder="master" />
        </a-form-item>
        <a-form-item label="根路径">
          <a-input v-model="addForm.root_path" placeholder="留空表示仓库根目录" />
        </a-form-item>
        <a-form-item label="启用扫描">
          <a-switch v-model="addForm.scan_enabled" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 编辑代码仓库弹窗 -->
    <a-modal
      v-model:visible="editVisible"
      title="编辑代码仓库"
      :ok-loading="editLoading"
      @ok="submitEdit"
      @cancel="editVisible = false"
    >
      <a-form :model="editForm" layout="vertical">
        <a-form-item label="所属模块">
          <span>{{ editRecord?.module_name }}（{{ editRecord?.module_code }}）</span>
        </a-form-item>
        <a-form-item label="仓库名称" required>
          <a-input v-model="editForm.name" placeholder="仓库名称" />
        </a-form-item>
        <a-form-item label="仓库编码" required>
          <a-input v-model="editForm.code" placeholder="全局唯一" />
        </a-form-item>
        <a-form-item label="Git URL" required>
          <a-input v-model="editForm.git_url" placeholder="https://git.example.com/group/repo.git" />
        </a-form-item>
        <a-form-item label="默认分支" required>
          <a-input v-model="editForm.default_branch" placeholder="master" />
        </a-form-item>
        <a-form-item label="根路径">
          <a-input v-model="editForm.root_path" placeholder="留空表示仓库根目录" />
        </a-form-item>
        <a-form-item label="启用扫描">
          <a-switch v-model="editForm.scan_enabled" />
        </a-form-item>
        <a-alert type="warning">
          修改 Git URL 或默认分支后，仓库状态会退回「待验证」，需要重新执行验证。
        </a-alert>
      </a-form>
    </a-modal>

    <!-- 详情抽屉 -->
    <a-drawer
      v-model:visible="detailVisible"
      title="代码仓库详情"
      :width="520"
      :footer="false"
    >
      <a-descriptions v-if="detailRecord" :column="1" bordered size="small">
        <a-descriptions-item label="模块名称">
          {{ detailRecord.module_name }}
        </a-descriptions-item>
        <a-descriptions-item label="模块简码">
          {{ detailRecord.module_code }}
        </a-descriptions-item>
        <a-descriptions-item label="项目组">
          {{ detailRecord.project_group_name }}
        </a-descriptions-item>
        <a-descriptions-item label="业务领域">
          {{ detailRecord.business_area }}
        </a-descriptions-item>
        <a-descriptions-item label="产品领域">
          {{ detailRecord.product_domain }}
        </a-descriptions-item>
        <a-descriptions-item label="仓库名称">
          {{ detailRecord.repository_name }}
        </a-descriptions-item>
        <a-descriptions-item label="仓库编码">
          {{ detailRecord.repository_code }}
        </a-descriptions-item>
        <a-descriptions-item label="Git URL">
          {{ detailRecord.git_url }}
        </a-descriptions-item>
        <a-descriptions-item label="默认分支">
          {{ detailRecord.default_branch }}
        </a-descriptions-item>
        <a-descriptions-item label="根路径">
          {{ detailRecord.root_path || '/' }}
        </a-descriptions-item>
        <a-descriptions-item label="扫描启用">
          <a-tag :color="detailRecord.scan_enabled ? 'green' : 'gray'" size="small">
            {{ detailRecord.scan_enabled ? '启用' : '禁用' }}
          </a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="状态">
          <a-tag :color="statusInfo(detailRecord.status).color" size="small">
            {{ statusInfo(detailRecord.status).label }}
          </a-tag>
        </a-descriptions-item>
      </a-descriptions>
    </a-drawer>
  </div>
</template>

<style scoped>
.static-scan-repositories {
  padding: 16px;
}
</style>
