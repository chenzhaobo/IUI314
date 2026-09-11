<script lang="ts" setup>
/**
 * 表单概览（安全测试 → 表单测试）
 *
 * 数据：GET /sechub/form-test/overview
 *   · 表单宇宙 = perf_entity_meta（与「基础配置 → 实体元数据」同一套左树/归属）；
 *   · 每个表单一行：各测试类型的用例数/通过数/状态 + 元数据扫描三态（不通过/不涉及/总数）；
 *   · 点「元数据扫描」列 → 抽屉看该表单的检测点明细（权限 1 + 6 敏感操作，逐个是否通过）。
 */
import { computed, ref } from 'vue'
import { type TableColumnData } from '@arco-design/web-vue'

import { ApiSecFormTest } from '@/api/sechubApis'
import { ApiSysDictData } from '@/api/apis'
import ListPage from '@/components/common/ListPage.vue'
import { getAction, useGet } from '@/hooks'
import EntityMetaTree, { type TreeScope } from '@/views/metadata/components/EntityMetaTree.vue'
import FormOverviewTable from './components/FormOverviewTable.vue'

// 组件名必须与路由 name（= sys_menu.path）一致，keep-alive :include 按它对上缓存
// eslint-disable-next-line vue/component-definition-name-casing
defineOptions({ name: 'form-overview' })

const DIMENSION_OPTIONS = [
  { value: 'app', label: '按应用' },
  { value: 'project_group', label: '按项目组' },
  { value: 'business_area', label: '按业务领域' },
  { value: 'product_domain', label: '按产品领域' },
]

const treeRef = ref<InstanceType<typeof EntityMetaTree>>()
const dimension = ref('app')
const scope = ref<TreeScope>({ dimension: 'app', kind: 'all', code: '', label: '全部实体', appNumber: '' })
const keyword = ref('')

const pageNum = ref(1)
const pageSize = ref(20)

// ── 产品线（数据字典，缺省星瀚）────────────────────
const productLine = ref('')
const { data: dictRaw } = useGet<Array<Record<string, string>>>(ApiSysDictData.getByType, { dict_type: 'perf_product_line' }, { immediate: true })
const productLineOptions = computed(() => (Array.isArray(dictRaw.value) ? dictRaw.value : []).map(d => ({ label: d.dict_label, value: d.dict_value })))

/** 左树选中 → 查询参数（与实体元数据同一套语义） */
const scopeParams = computed<Record<string, string | boolean>>(() => {
  const s = scope.value
  const p: Record<string, string | boolean> = {}
  if (s.kind === 'group') {
    if (dimension.value === 'app')
      p.cloud = s.code
    else
      p[dimension.value] = s.code
  }
  else if (s.kind === 'app') {
    p.app_number = s.code
  }
  else if (s.kind === 'menu') {
    p.form_number = s.code
  }
  else if (s.kind === 'unclassified') {
    p.app_number = s.code
    p.unclassified = true
  }
  return p
})

const { isFetching: loading, data: rawData, execute: fetchData } = useGet<Record<string, unknown>>(
  ApiSecFormTest.overview,
  computed(() => ({
    product_line: productLine.value || undefined,
    page_num: pageNum.value,
    page_size: pageSize.value,
    keyword: keyword.value || undefined,
    ...scopeParams.value,
  })),
  { immediate: false },
)

const rows = computed<Array<Record<string, unknown>>>(() => (rawData.value?.list as Array<Record<string, unknown>>) || [])
const types = computed<Array<{ code: string, name: string, source: string }>>(() => (rawData.value?.types as Array<{ code: string, name: string, source: string }>) || [])
const summary = computed<Record<string, number>>(() => (rawData.value?.summary as Record<string, number>) || {})
const envName = computed(() => (rawData.value?.env as { name?: string } | undefined)?.name || treeRef.value?.envName || '--')
const total = computed(() => Number(rawData.value?.total || 0))

const pagination = computed(() => ({
  current: pageNum.value,
  pageSize: pageSize.value,
  total: total.value ?? 0,
  showTotal: true,
  showPageSize: true,
}))

function handleSearch() {
  pageNum.value = 1
  fetchData()
}

function handleTreeSelect(s: TreeScope) {
  scope.value = s
  handleSearch()
}

function handlePageChange(page: number) {
  pageNum.value = page
  fetchData()
}

function handlePageSizeChange(size: number) {
  pageSize.value = size
  pageNum.value = 1
  fetchData()
}

// 产品线变化：树重拉后 emit select('all') → handleTreeSelect 刷新数据
function handleProductLineChange() {
  void treeRef.value?.reload()
}

// ── 元数据扫描明细抽屉（点行尾「元数据扫描」列）──────────
interface ScanPoint {
  oper_key: string
  oper_name?: string | null
  exists?: boolean
  log_enable?: boolean
  permission_bound?: boolean
  state?: string
}
interface ScanDetail {
  form_number: string
  form_name?: string | null
  app_name?: string | null
  perm_state: string
  fail_total: number
  na_total: number
  check_total: number
  synced_at?: string | null
  detail?: ScanPoint[]
}

const detailVisible = ref(false)
const detailLoading = ref(false)
const detail = ref<ScanDetail | null>(null)
const detailFormNumber = ref('')

const PERM_LABEL: Record<string, string> = { pass: '通过', fail: '不通过', na: '不涉及' }
const POINT_LABEL: Record<string, string> = {
  pass: '通过',
  fail: '不通过',
  na: '不涉及',
}
const POINT_COLOR: Record<string, string> = { pass: 'green', fail: 'red', na: 'gray' }

/** 明细清单：权限 1 项 + 6 个操作检测点（操作名有中文时优先展示中文） */
const detailPoints = computed(() => {
  const d = detail.value
  if (!d)
    return []
  const points: Array<{ key: string, name: string, state: string, note: string }> = [
    {
      key: '__perm__',
      name: '权限配置检查',
      state: d.perm_state,
      note: d.perm_state === 'fail'
        ? '开了功能权限控制（ControlFunction=true）但未配置权限项（PermissionItems）'
        : (d.perm_state === 'na' ? '元数据未开启权限控制开关（不涉及）' : '已配置权限项'),
    },
  ]
  for (const p of d.detail || []) {
    const state = p.state || (p.exists === false ? 'na' : (p.log_enable ? 'pass' : 'fail'))
    points.push({
      key: p.oper_key,
      name: p.oper_name || p.oper_key,
      state,
      note: p.exists === false
        ? '该表单没有此操作（不涉及）'
        : (p.log_enable ? '已开启操作日志' : '未开启操作日志（logEnable != true）'),
    })
  }
  return points
})

async function openScanDetail(record: Record<string, unknown>) {
  detailVisible.value = true
  detailLoading.value = true
  detail.value = null
  detailFormNumber.value = String(record.form_number || '')
  try {
    const res = await getAction<ScanDetail>(ApiSecFormTest.formDetail, {
      form_number: detailFormNumber.value,
      product_line: productLine.value || undefined,
    })
    detail.value = res || null
  }
  finally {
    detailLoading.value = false
  }
}

const detailColumns: TableColumnData[] = [
  { title: '检测点', dataIndex: 'name', width: 160 },
  { title: '状态', dataIndex: 'state', width: 90, slotName: 'state' },
  { title: '说明', dataIndex: 'note' },
]
</script>

<template>
  <div class="form-overview">
    <ListPage :aside-width="320" aside-resizable :aside-max-width="520">
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
        <EntityMetaTree
          ref="treeRef"
          :dimension="dimension"
          :product-line="productLine"
          @select="handleTreeSelect"
        />
      </template>

      <template #filter>
        <div class="filter-bar">
          <div class="f-mid">
            <a-select v-model="productLine" placeholder="产品线" @change="handleProductLineChange">
              <a-option v-for="p in productLineOptions" :key="p.value" :value="p.value">
                {{ p.label }}
              </a-option>
            </a-select>
          </div>
          <div class="f-wide">
            <a-input
              v-model="keyword"
              placeholder="表单编码 / 名称"
              allow-clear
              @press-enter="handleSearch"
              @clear="handleSearch"
            />
          </div>
          <a-button type="primary" @click="handleSearch">
            查询
          </a-button>
        </div>
      </template>

      <template #toolbar>
        <div class="summary-bar">
          <span class="summary-item">
            数据源：{{ envName }} ｜ 表单 {{ (summary.forms || 0).toLocaleString('en-US') }}
          </span>
          <a-divider direction="vertical" />
          <span class="summary-item">
            用例 <b>{{ (summary.case_total || 0).toLocaleString('en-US') }}</b> ／ 通过 <b class="ok">{{ (summary.pass_total || 0).toLocaleString('en-US') }}</b>
          </span>
          <a-divider direction="vertical" />
          <span class="summary-item">
            元数据扫描：不通过 <b class="bad">{{ (summary.meta_fail || 0).toLocaleString('en-US') }}</b>
            ／ 不涉及 <b>{{ (summary.meta_na || 0).toLocaleString('en-US') }}</b>
            ／ 总数 <b>{{ (summary.meta_total || 0).toLocaleString('en-US') }}</b>
            （涉及表单 {{ summary.meta_forms || 0 }}，有不通过 {{ summary.meta_fail_forms || 0 }}）
          </span>
        </div>
        <div class="toolbar-spacer" />
        <a-tag v-if="scope.kind !== 'all'" size="small" color="arcoblue">
          已选：{{ scope.label }}
        </a-tag>
      </template>

      <template #default="{ tableHeight }">
        <FormOverviewTable
          :rows="rows"
          :types="types"
          :loading="loading"
          :pagination="pagination"
          :table-height="tableHeight ?? 0"
          @page-change="handlePageChange"
          @page-size-change="handlePageSizeChange"
          @scan-detail="openScanDetail"
        />
      </template>
    </ListPage>

    <a-drawer
      v-model:visible="detailVisible"
      :width="620"
      :title="`元数据扫描明细：${detailFormNumber}`"
      unmount-on-close
    >
      <a-spin :loading="detailLoading" style="display: block">
        <template v-if="detail">
          <a-descriptions :column="2" size="small" bordered style="margin-bottom: 12px">
            <a-descriptions-item label="表单名称">{{ detail.form_name || '--' }}</a-descriptions-item>
            <a-descriptions-item label="应用">{{ detail.app_name || '--' }}</a-descriptions-item>
            <a-descriptions-item label="不通过">{{ detail.fail_total }}</a-descriptions-item>
            <a-descriptions-item label="不涉及">{{ detail.na_total }}</a-descriptions-item>
            <a-descriptions-item label="检测点总数">{{ detail.check_total }}</a-descriptions-item>
            <a-descriptions-item label="扫描时间">{{ detail.synced_at || '--' }}</a-descriptions-item>
          </a-descriptions>
          <a-table :data="detailPoints" :columns="detailColumns" :pagination="false" row-key="key" size="small">
            <template #state="{ record }">
              <a-tag :color="POINT_COLOR[record.state] || 'gray'" size="small">
                {{ POINT_LABEL[record.state] || record.state }}
              </a-tag>
            </template>
          </a-table>
        </template>
        <a-empty v-else-if="!detailLoading" description="该表单暂无元数据扫描记录（先执行一次包含静态扫描的测试任务）" />
      </a-spin>
    </a-drawer>
  </div>
</template>

<style scoped>
.form-overview {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.form-overview > :deep(.list-page) {
  flex: 1 1 auto;
  min-height: 0;
}

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.f-wide {
  width: 260px;
}

.f-mid {
  width: 150px;
}

.filter-bar > div :deep(.arco-select),
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

.summary-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--color-text-3);
  font-size: 12px;
}

.summary-item b {
  color: var(--color-text-1);
}

.summary-item .ok {
  color: rgb(var(--green-6));
}

.summary-item .bad {
  color: rgb(var(--red-6));
}

.toolbar-spacer {
  flex: 1;
}
</style>
