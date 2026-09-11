<script lang="ts" setup>
/**
 * 实体元数据（基础配置 → 元数据管理）
 *
 * 数据：GET /metadata/entity-meta/{tree,list}
 *   · 左树：云（或项目组/业务领域/产品领域）→ 应用 → 菜单；应用下「未归类」= 没挂菜单的实体；
 *   · 右表：产品线 + 编码/名称 + 树 scope 过滤，行上带表统计的行数/空间。
 *
 * 本页只看实体本身；「表统计列表 / 数据库概览 / 同步表统计」在「环境数据量信息」菜单。
 * 环境不在查询条件里：后端缺省取「该产品线下已有实体数据的环境」，与左树同源。
 */
import { computed, ref, watch } from 'vue'
import { type TableColumnData } from '@arco-design/web-vue'

import { ApiSysDictData } from '@/api/apis'
import { ApiMetadataEntityMeta } from '@/api/metadataApis'
import ListPage from '@/components/common/ListPage.vue'
import { useGet, withTableDefaults } from '@/hooks'
import EntityMetaTree, { type TreeScope } from '@/views/metadata/components/EntityMetaTree.vue'

// 组件名必须与路由 name（= sys_menu.path）一致，keep-alive :include 按它对上缓存
// eslint-disable-next-line vue/component-definition-name-casing
defineOptions({ name: 'entity-meta' })

const DIMENSION_OPTIONS = [
  { value: 'app', label: '按应用' },
  { value: 'project_group', label: '按项目组' },
  { value: 'business_area', label: '按业务领域' },
  { value: 'product_domain', label: '按产品领域' },
]
/** 「未分类」哨兵：与后端 UNCLASSIFIED_FILTER 一致 */
const UNCLASSIFIED_FILTER = '__unclassified__'

const treeRef = ref<InstanceType<typeof EntityMetaTree>>()
const dimension = ref('app')
const scope = ref<TreeScope>({ dimension: 'app', kind: 'all', code: '', label: '全部实体', appNumber: '' })

// ── 产品线（数据字典，缺省星瀚）────────────────────
const productLine = ref('')
const { data: dictRaw } = useGet<Array<Record<string, string>>>(ApiSysDictData.getByType, { dict_type: 'perf_product_line' }, { immediate: true })
const productLineOptions = computed(() => (Array.isArray(dictRaw.value) ? dictRaw.value : []).map(d => ({ label: d.dict_label, value: d.dict_value })))

watch(dictRaw, (val) => {
  if (!productLine.value && Array.isArray(val) && val.length > 0) {
    const def = val.find(d => d.is_default === 'Y')
    productLine.value = def?.dict_value || val[0]?.dict_value || ''
  }
}, { immediate: true })

// ── 右表筛选 / 分页 ───────────────────────────────
const searchForm = ref({ keyword: '' })
const pageNum = ref(1)
const pageSize = ref(20)

/** 左树选中 → 查询参数 */
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

const { isFetching: loading, data: rawData, execute: fetchList } = useGet<Record<string, unknown>>(
  ApiMetadataEntityMeta.list,
  computed(() => ({
    product_line: productLine.value || undefined,
    page_num: pageNum.value,
    page_size: pageSize.value,
    keyword: searchForm.value.keyword || undefined,
    ...scopeParams.value,
  })),
  { immediate: false },
)

const rows = computed<Array<Record<string, unknown>>>(() => (rawData.value?.list as Array<Record<string, unknown>>) || [])
const total = computed(() => Number(rawData.value?.total || 0))

function handleSearch() {
  pageNum.value = 1
  fetchList()
}

function handleReset() {
  searchForm.value.keyword = ''
  handleSearch()
}

function handleTreeSelect(s: TreeScope) {
  scope.value = s
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

// 产品线变化：树会重拉并 emit select('all')，列表由 handleTreeSelect 刷新
function handleProductLineChange() {
  void treeRef.value?.reload()
}

function formatNumber(val: unknown): string {
  const n = Number(val)
  return val === null || val === undefined || Number.isNaN(n) ? '--' : n.toLocaleString('en-US')
}

function formatTimeText(val: unknown): string {
  if (!val)
    return '--'
  const d = new Date(String(val))
  return Number.isNaN(d.getTime()) ? String(val) : d.toLocaleString('zh-CN', { hour12: false })
}

const columns: TableColumnData[] = withTableDefaults([
  { title: '元数据编码', dataIndex: 'form_number', width: 180, ellipsis: true, tooltip: true },
  { title: '名称', dataIndex: 'entity_name', width: 170, ellipsis: true, tooltip: true },
  { title: '类型', dataIndex: 'entity_type', width: 80, slotName: 'entity_type' },
  { title: '模型类型', dataIndex: 'model_type', width: 130, slotName: 'model_type' },
  { title: '应用', dataIndex: 'app_name', width: 150, slotName: 'app' },
  { title: '云', dataIndex: 'cloud_name', width: 110, ellipsis: true, tooltip: true },
  { title: '菜单', dataIndex: 'menu_name', width: 170, slotName: 'menu' },
  { title: '主表', dataIndex: 'main_table', width: 180, ellipsis: true, tooltip: true },
  { title: '行数', dataIndex: 'row_count', width: 110, align: 'right' as const, render: ({ record }: { record: Record<string, unknown> }) => formatNumber(record.row_count) },
  { title: '空间大小', dataIndex: 'total_size_human', width: 100, render: ({ record }: { record: Record<string, unknown> }) => (record.total_size_human as string) || '--' },
  { title: '实体同步时间', dataIndex: 'entity_synced_at', width: 170, slotName: 'entity_synced_at' },
])
</script>

<template>
  <div class="entity-meta">
    <ListPage :aside-width="320" aside-resizable :aside-max-width="520">
      <!-- 标题条与下拉同一行：该区域在滚动区之外，树滚动时下拉不会跟着滚走 -->
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
              v-model="searchForm.keyword"
              placeholder="元数据编码 / 名称"
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
        <div class="entity-meta-info">
          <span>
            数据源：{{ treeRef?.envName || '--' }} ｜ 当前范围 {{ total.toLocaleString('en-US') }} 条 ／ 全部 {{ (treeRef?.totalEntities || 0).toLocaleString('en-US') }} 条
          </span>
          <a-tag v-if="scope.kind !== 'all'" size="small" color="arcoblue">
            已选：{{ scope.label }}
          </a-tag>
        </div>
        <div class="toolbar-spacer" />
      </template>

      <template #default="{ tableHeight }">
        <a-table
          :data="rows"
          :columns="columns"
          :loading="loading"
          :pagination="{
            current: pageNum,
            pageSize,
            total,
            showTotal: true,
            showPageSize: true,
          }"
          :scroll="{ y: tableHeight, x: 1450 }"
          row-key="id"
          size="small"
          @page-change="handlePageChange"
          @page-size-change="handlePageSizeChange"
        >
          <template #entity_type="{ record }">
            <a-tag v-if="record.entity_type" size="small">
              {{ record.entity_type }}
            </a-tag>
            <span v-else>--</span>
          </template>
          <template #model_type="{ record }">
            <a-tag v-if="record.model_type" size="small" color="arcoblue">
              {{ record.model_type }}
            </a-tag>
            <span v-else>--</span>
          </template>
          <template #app="{ record }">
            <span v-if="record.app_number">{{ record.app_number }} {{ record.app_name }}</span>
            <span v-else class="text-muted">未分类</span>
          </template>
          <template #menu="{ record }">
            <a-tooltip v-if="record.menu_name" :content="record.menu_path || record.menu_name">
              <span>{{ record.menu_name }}</span>
            </a-tooltip>
            <span v-else class="text-muted">未归类</span>
          </template>
          <template #entity_synced_at="{ record }">
            {{ formatTimeText(record.entity_synced_at) }}
          </template>
        </a-table>
      </template>
    </ListPage>
  </div>
</template>

<style scoped>
.entity-meta {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.entity-meta > :deep(.list-page) {
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

.entity-meta-info {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--color-text-3);
  font-size: 12px;
}

.toolbar-spacer {
  flex: 1;
}

.text-muted {
  color: var(--color-text-3);
}
</style>
