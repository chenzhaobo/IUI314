<script setup lang="ts">
/**
 * API 清单 / API 概览（同一张表两个菜单）
 *
 * - mode='inventory'（元数据管理 → API清单）：现状不变 —— 左树按维度过滤、同步、背景需求录入；
 * - mode='overview'（API测试 → API概览）：同一张表**追加 4 列**（用例数 / 成功数 / 执行时间 / 状态），
 *   回答「这个接口测过没有、最近一轮结果如何」（统计列由后端 list 接口补充）。
 *
 * 数据来源：`/metadata/api-inventory/{tree,list,sync,sync-runs,context}`
 *   · 接口定义从所选「测试环境」的 OpenAPI 定义库同步到平台库 `meta_api_inventory`；
 *   · 同步语义：存在则更新、不存在则新增、源侧删除则标记删除；每次同步留一条同步记录；
 *   · 应用归属（应用/云）随同步解析；项目组/业务领域/产品领域**动态关联**，只在左树过滤时使用。
 */
import { computed, reactive, ref } from 'vue'

import { ApiSysDictData } from '@/api/apis'
import { ApiMetadataInventory } from '@/api/metadataApis'
import ListPage from '@/components/common/ListPage.vue'
import { useGet } from '@/hooks'
import ApiContextDrawer from './ApiContextDrawer.vue'
import ApiInventorySyncModals from './ApiInventorySyncModals.vue'
import ApiInventoryTable from './ApiInventoryTable.vue'
import ApiInventoryTree from './ApiInventoryTree.vue'

const props = withDefaults(defineProps<{
  /** inventory=API清单（元数据管理）/ overview=API概览（API测试） */
  mode?: 'inventory' | 'overview'
}>(), { mode: 'inventory' })

const isOverview = computed(() => props.mode === 'overview')

/** 「未分类」哨兵：与后端 `UNCLASSIFIED_FILTER` 一致（左树未分类组的 group code） */
const UNCLASSIFIED_FILTER = '__unclassified__'

/** 产品线（星瀚 / 星空）：与菜单目录/实体元数据一致，用字典 perf_product_line */
const productLine = ref('')
const { data: productLineDict } = useGet<any>(ApiSysDictData.getByType, { dict_type: 'perf_product_line' }, { immediate: true })
const productLineOptions = computed(() => (Array.isArray(productLineDict.value) ? productLineDict.value : [])
  .map((d: any) => ({ label: d.dict_label, value: d.dict_value })))

const VERSION_OPTIONS = [
  { value: 'v1', label: 'v1（旧版）' },
  { value: 'v2', label: 'v2' },
  { value: 'v3', label: 'v3（RESTful）' },
]

/** 左树维度：应用（云→应用）/ 项目组 / 业务领域 / 产品领域 */
const DIMENSION_OPTIONS = [
  { value: 'app', label: '按应用' },
  { value: 'project_group', label: '按项目组' },
  { value: 'business_area', label: '按业务领域' },
  { value: 'product_domain', label: '按产品领域' },
]

// ── 右表（查询条件 / 分页）────────────────────────
const filters = reactive({ keyword: '', version: '' })
const pageNum = ref(1)
const pageSize = ref(20)
/** 当前左树维度（树结构随它变化，表格过滤也按它取字段） */
const dimension = ref('app')
/** 已同步/选中的测试环境：同步后固定用它取数（缺省由后端挑「已有数据的环境」） */
const activeEnvId = ref('')
/** 左树选中节点（规范化描述，见 ApiInventoryTree 的 TreeScope） */
const scope = ref<any>({ kind: 'all', code: '', appNumber: '' })
const treeRef = ref<InstanceType<typeof ApiInventoryTree>>()

/** 树节点 → 查询参数（应用优先；「未分类」走哨兵值） */
const scopeParams = computed(() => {
  const s = scope.value
  if (s.kind === 'app')
    return { app_number: s.code }
  if (s.kind === 'api' && s.appNumber)
    return { app_number: s.appNumber }
  if (s.kind === 'group') {
    if (s.code === UNCLASSIFIED_FILTER) {
      if (dimension.value === 'project_group')
        return { project_group: UNCLASSIFIED_FILTER }
      if (dimension.value === 'business_area')
        return { business_area: UNCLASSIFIED_FILTER }
      if (dimension.value === 'product_domain')
        return { product_domain: UNCLASSIFIED_FILTER }
      return {}
    }
    if (dimension.value === 'project_group')
      return { project_group: s.code }
    if (dimension.value === 'business_area')
      return { business_area: s.code }
    if (dimension.value === 'product_domain')
      return { product_domain: s.code }
    return { cloud: s.code }
  }
  return {}
})

const queryParams = computed(() => ({
  ...scopeParams.value,
  env_id: activeEnvId.value || undefined,
  product_line: productLine.value || undefined,
  page_num: pageNum.value,
  page_size: pageSize.value,
  version: filters.version,
  keyword: filters.keyword,
}))

const { isFetching: loading, data: rawData, execute: fetchList } = useGet<any>(
  ApiMetadataInventory.list,
  queryParams,
  { immediate: false },
)

const rows = computed(() => rawData.value?.list || [])
const total = computed(() => rawData.value?.total || 0)
const pagination = computed(() => ({
  current: pageNum.value,
  pageSize: pageSize.value,
  total: total.value,
  showTotal: true,
  showPageSize: true,
}))

function handleSearch() {
  pageNum.value = 1
  fetchList()
}

function handleReset() {
  filters.keyword = ''
  filters.version = ''
  handleSearch()
}

function handlePageChange(page: number) {
  pageNum.value = page
  fetchList()
}

// 改每页条数回到第 1 页（否则新页可能超出总页数）
function handlePageSizeChange(size: number) {
  pageSize.value = size
  pageNum.value = 1
  fetchList()
}

// ── 左树（维度切换 / 选中过滤）─────────────────────
function handleTreeSelect(s: any) {
  scope.value = s
  handleSearch()
}

// ── 同步（弹窗内完成，完成后刷新树与表）────────────
const syncModalsRef = ref<InstanceType<typeof ApiInventorySyncModals>>()

function handleSynced(envId: string) {
  activeEnvId.value = envId
  // 树重新拉取后会在内部 emit select('all')，由 handleTreeSelect 刷新列表
  void treeRef.value?.reload()
}

// ── 背景需求（人工录入的业务上下文）────────────────
const contextVisible = ref(false)
const contextRecord = ref<any>(null)

function openContext(record: any) {
  contextRecord.value = record
  contextVisible.value = true
}

function handleContextSaved() {
  // 保存后刷新：列表里的 has_context 标记要立刻反映「已录入」
  fetchList()
}

// 初始加载：树的 watch（immediate）拉到树后会 emit select('all')，
// 由 handleTreeSelect 触发列表查询 —— 保证列表与树用同一个 scope，不重复发请求。
// 注意：产品线/维度变化同理（树重新拉取 → emit → 刷新表），页面不再单独监听。
</script>

<template>
  <div class="api-inventory">
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
        <ApiInventoryTree
          ref="treeRef"
          :dimension="dimension"
          :env-id="activeEnvId"
          :product-line="productLine"
          @select="handleTreeSelect"
        />
      </template>

      <template #filter>
        <div class="filter-bar">
          <div class="f-mid">
            <a-select v-model="productLine" placeholder="产品线">
              <a-option v-for="p in productLineOptions" :key="p.value" :value="p.value">
                {{ p.label }}
              </a-option>
            </a-select>
          </div>
          <div class="f-wide">
            <a-input
              v-model="filters.keyword"
              placeholder="接口编号 / 名称 / 路径"
              allow-clear
              @press-enter="handleSearch"
              @clear="handleSearch"
            />
          </div>
          <div class="f-mid">
            <a-select v-model="filters.version" placeholder="版本" allow-clear @change="handleSearch">
              <a-option v-for="v in VERSION_OPTIONS" :key="v.value" :value="v.value">
                {{ v.label }}
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
        <div class="inventory-meta">
          <span>
            数据源：{{ treeRef?.envName || '--' }}（OpenAPI 定义库）｜ 当前范围 {{ total }} 条 ／ 全部 {{ treeRef?.totalApis || 0 }} 条
            <template v-if="isOverview">｜ 用例数/成功数/执行时间为最近一轮执行口径</template>
          </span>
          <a-space>
            <a-button size="small" @click="syncModalsRef?.openRecords()">
              同步记录
            </a-button>
            <a-button type="primary" size="small" @click="syncModalsRef?.openSync()">
              同步
            </a-button>
          </a-space>
        </div>
      </template>

      <template #default="{ tableHeight }">
        <ApiInventoryTable
          :rows="rows"
          :loading="loading"
          :pagination="pagination"
          :mode="mode"
          :table-height="tableHeight"
          @page-change="handlePageChange"
          @page-size-change="handlePageSizeChange"
          @context="openContext"
        />
      </template>
    </ListPage>

    <!-- 同步 / 同步记录（弹窗都在子组件里，这里只保留调用入口） -->
    <ApiInventorySyncModals
      ref="syncModalsRef"
      :env-id="activeEnvId"
      :product-line="productLine"
      @synced="handleSynced"
    />

    <!-- 背景需求：业务说明 / 后台表单 / 表单之间的联系 / 备注 -->
    <ApiContextDrawer
      v-model:visible="contextVisible"
      :api-key="contextRecord?.call_path || ''"
      :api-label="contextRecord?.number || contextRecord?.name || ''"
      @saved="handleContextSaved"
    />
  </div>
</template>

<style scoped>
/* 根 div 承接布局的 app-main-content（flex:1 + min-height:0），
   这里做纵向 flex 容器让 ListPage 撑满，内部自己滚 */
.api-inventory {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

/* 子组件根节点会带上父级 scope，可直接命中 */
.api-inventory > .list-page {
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

/* 标题不许折行（左栏 320px 里「归属维度」+ 下拉要同一行） */
.aside-title-row > span {
  white-space: nowrap;
}

.dimension-select {
  width: 140px;
  font-weight: 400;
}

.inventory-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  color: var(--color-text-3);
  font-size: 12px;
}
</style>
