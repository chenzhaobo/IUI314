<script setup lang="ts">
/**
 * API测试用例（安全测试 → API测试 → API测试用例）
 *
 * 布局：左树（展开到 API）+ 右表 —— 左树数据源
 *   GET /metadata/api-inventory/tree?depth=api&source=cases（计数=该 API 的用例数）
 * 右表：GET /sechub/scan/cases?filters=... 固定筛 API 域用例类型
 *   （openapi_perm / openapi_inject / script，`in` 的值是逗号分隔字符串），
 *   点左树 API 叶子再叠加 `api_path eq <call_path>`（字段名必须是实体 Column）。
 *
 * 两类用例：
 *   · 平台编排（不写代码）：请求体 + 请求头 + 断言，执行器按角色 token 调用后按断言判定；
 *   · Python 脚本：上传 .py（POST /sechub/scan/scripts）后选用例脚本。
 * 新建用例必须归属扫描任务（后端强校验），编辑走 PUT /sechub/scan/cases/{id}。
 */
import { Message, Modal } from '@arco-design/web-vue'
import { computed, reactive, ref } from 'vue'

import { ApiSecScan, resolveStaticScanApi } from '@/api/sechubApis'
import ListPage from '@/components/common/ListPage.vue'
import { postAction, useGet } from '@/hooks'
import ApiInventoryTree from '@/views/metadata/components/ApiInventoryTree.vue'
import ApiCaseEditorDrawer from './components/ApiCaseEditorDrawer.vue'
import ApiCaseTable from './components/ApiCaseTable.vue'
import ApiScriptCaseDrawer from './components/ApiScriptCaseDrawer.vue'
import { ASSERTION_OPTIONS, TEST_TYPE_LABELS } from './components/apiTestShared'

// 组件名必须与路由 name（= sys_menu.path）一致，keep-alive :include 按它对上缓存
// eslint-disable-next-line vue/component-definition-name-casing
defineOptions({ name: 'api-test-cases' })

/** API 域用例类型（与后端 sec_case::OPENAPI_CASE_TYPES + 手工脚本用例） */
const API_CASE_TYPES = 'openapi_perm,openapi_inject,script'

const DIMENSION_OPTIONS = [
  { value: 'app', label: '按应用' },
  { value: 'project_group', label: '按项目组' },
  { value: 'business_area', label: '按业务领域' },
  { value: 'product_domain', label: '按产品领域' },
]
/** 「未分类」哨兵：与后端 UNCLASSIFIED_FILTER 一致 */
const UNCLASSIFIED_FILTER = '__unclassified__'

const dimension = ref('app')
const scope = ref<any>({ kind: 'all', code: '', appNumber: '', label: '全部接口' })
const selectedApiPath = computed(() => (scope.value.kind === 'api' ? scope.value.code : ''))
/** 工具行的范围提示：云维度在用例表无法过滤，明确告诉用户当前是「全部」 */
const scopeHint = computed(() => {
  const s = scope.value
  if (s.kind === 'all')
    return ''
  if (s.kind === 'group' && dimension.value === 'app')
    return `已选云：${s.label || s.code}（用例表没有云字段，仍按全部范围展示）`
  return `已选：${s.label || s.code}`
})

// ── 右表筛选 / 分页 ───────────────────────────────
const searchForm = reactive({ keyword: '', test_type: '', assertion: '' })
const pageNum = ref(1)
const pageSize = ref(20)

/** 左树范围 → filters（不可表达的维度如「云」不加条件，见下方 hint） */
const scopeFilters = computed(() => {
  const s = scope.value
  if (s.kind === 'api' && s.code)
    return [{ field: 'api_path', op: 'eq', value: s.code }]
  if (s.kind === 'app' && s.code)
    return [{ field: 'app_number', op: 'eq', value: s.code }]
  if (s.kind === 'group') {
    if (s.code === UNCLASSIFIED_FILTER) {
      // 未分类 = 该维度为空
      if (dimension.value === 'project_group')
        return [{ field: 'project_group_code', op: 'isNull' }]
      if (dimension.value === 'business_area')
        return [{ field: 'business_area', op: 'isNull' }]
      if (dimension.value === 'product_domain')
        return [{ field: 'product_domain', op: 'isNull' }]
      return []
    }
    if (dimension.value === 'project_group')
      return [{ field: 'project_group_code', op: 'eq', value: s.code }]
    if (dimension.value === 'business_area')
      return [{ field: 'business_area', op: 'eq', value: s.code }]
    if (dimension.value === 'product_domain')
      return [{ field: 'product_domain', op: 'eq', value: s.code }]
    return [] // 应用维度下组=云，用例表没有云字段，无法过滤
  }
  return []
})

const queryParams = computed(() => ({
  page_num: pageNum.value,
  page_size: pageSize.value,
  keyword: searchForm.keyword,
  filters: JSON.stringify([
    { field: 'case_type', op: 'in', value: API_CASE_TYPES },
    ...scopeFilters.value,
    ...(searchForm.test_type ? [{ field: 'test_type', op: 'eq', value: searchForm.test_type }] : []),
    ...(searchForm.assertion ? [{ field: 'assertion', op: 'eq', value: searchForm.assertion }] : []),
  ]),
}))

const { isFetching: loading, data: rawData, execute: fetchList } = useGet<any>(
  ApiSecScan.caseList,
  queryParams,
  { immediate: false },
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
  searchForm.test_type = ''
  searchForm.assertion = ''
  handleSearch()
}

function handlePageChange(page: number) {
  pageNum.value = page
  fetchList()
}

// 改每页条数必须同时回到第 1 页（否则新页可能已超出总页数）
function handlePageSizeChange(size: number) {
  pageSize.value = size
  pageNum.value = 1
  fetchList()
}

// 左树选中：树在各维度变化时会重新拉取并 emit（含初始加载），列表由此刷新
function handleTreeSelect(s: any) {
  scope.value = s
  handleSearch()
}

// ── 新建 / 编辑 / 删除 ────────────────────────────
const editorVisible = ref(false)
const scriptVisible = ref(false)
const editingRecord = ref<any>(null)

function openCreate(kind: unknown) {
  const target = String(kind)
  editingRecord.value = null
  if (target === 'script')
    scriptVisible.value = true
  else
    editorVisible.value = true
}

function openEdit(record: any) {
  editingRecord.value = record
  if (record.exec_mode === 'script')
    scriptVisible.value = true
  else
    editorVisible.value = true
}

function handleDelete(record: any) {
  const name = record.case_code || record.title || record.api_path || '该用例'
  Modal.confirm({
    title: '删除用例',
    content: `确认删除「${name}」？删除后该用例不再参与后续扫描。`,
    okText: '删除',
    cancelText: '取消',
    onOk: async () => {
      const res = await postAction<string>(resolveStaticScanApi(ApiSecScan.caseDelete, { id: record.id }))
      if (res === null)
        return
      Message.success('删除成功')
      await fetchList()
    },
  })
}

function onSaved() {
  fetchList()
}
</script>

<template>
  <div class="api-test-cases">
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
        <ApiInventoryTree :dimension="dimension" depth="api" source="cases" @select="handleTreeSelect" />
      </template>

      <template #filter>
        <div class="filter-bar">
          <div class="f-wide">
            <a-input
              v-model="searchForm.keyword"
              placeholder="用例ID / 标题 / 接口路径"
              allow-clear
              @press-enter="handleSearch"
              @clear="handleSearch"
            />
          </div>
          <div class="f-mid">
            <a-select v-model="searchForm.test_type" placeholder="测试类型" allow-clear @change="handleSearch">
              <a-option v-for="(label, code) in TEST_TYPE_LABELS" :key="code" :value="code">
                {{ label }}
              </a-option>
            </a-select>
          </div>
          <div class="f-mid">
            <a-select v-model="searchForm.assertion" placeholder="断言" allow-clear @change="handleSearch">
              <a-option v-for="a in ASSERTION_OPTIONS" :key="a.value" :value="a.value">
                {{ a.label }}
              </a-option>
            </a-select>
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
        <span v-else-if="scopeHint" class="scope-hint">{{ scopeHint }}</span>
        <div class="toolbar-spacer" />
        <a-button @click="openCreate('script')">
          上传脚本
        </a-button>
        <a-dropdown trigger="click" @select="openCreate">
          <a-button type="primary">
            新建用例
            <template #icon>
              <icon-down />
            </template>
          </a-button>
          <template #content>
            <a-doption value="orchestration">
              平台编排（请求 + 断言）
            </a-doption>
            <a-doption value="script">
              Python 脚本
            </a-doption>
          </template>
        </a-dropdown>
      </template>

      <template #default="{ tableHeight }">
        <ApiCaseTable
          :rows="rows"
          :loading="loading"
          :pagination="pagination"
          :table-height="tableHeight"
          @page-change="handlePageChange"
          @page-size-change="handlePageSizeChange"
          @edit="openEdit"
          @delete="handleDelete"
        />
      </template>
    </ListPage>

    <!-- 编排编辑器 / 脚本用例 -->
    <ApiCaseEditorDrawer
      v-model:visible="editorVisible"
      :record="editingRecord"
      :preset-api-path="selectedApiPath"
      @saved="onSaved"
    />
    <ApiScriptCaseDrawer
      v-model:visible="scriptVisible"
      :record="editingRecord"
      :preset-api-path="selectedApiPath"
      @saved="onSaved"
    />
  </div>
</template>

<style scoped>
.api-test-cases {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.api-test-cases > .list-page {
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

.toolbar-spacer {
  flex: 1;
}

.scope-hint {
  color: var(--color-text-3);
  font-size: 12px;
}
</style>
