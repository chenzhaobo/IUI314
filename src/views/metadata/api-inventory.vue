<script setup lang="ts">
/**
 * API 清单（基础配置 → 元数据管理）
 *
 * 数据来源：`/metadata/api-inventory/{tree,list,sync,sync-runs}`
 *   · 接口定义从所选「测试环境」的 OpenAPI 定义库同步到平台库 `meta_api_inventory`；
 *   · 同步语义：存在则更新、不存在则新增、源侧删除则标记删除；每次同步留一条同步记录；
 *   · 应用归属（应用/云）随同步解析；项目组/业务领域/产品领域**动态关联**
 *     （应用编码 ↔ 模块管理 perf_module.module_code → 项目组），只在左树过滤时使用，不进表格。
 *
 * 交互：左树按维度（应用/项目组/业务领域/产品领域）过滤右表；右表可再按版本/关键词过滤。
 */
import { Message } from '@arco-design/web-vue'
import { computed, onMounted, reactive, ref } from 'vue'

import { ApiMetadataInventory } from '@/api/metadataApis'
import { ApiPerfEnv } from '@/api/perfApis'
import ListPage from '@/components/common/ListPage.vue'
import { formatTime, getAction, postAction, useGet } from '@/hooks'

// 组件名必须与路由 name（= sys_menu.path）一致，keep-alive :include 按它对上缓存
// eslint-disable-next-line vue/component-definition-name-casing
defineOptions({ name: 'api-inventory' })

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
const UNCLASSIFIED_FILTER = '__unclassified__'

// ── 右表（查询条件 / 分页）────────────────────────
const filters = reactive({ keyword: '', version: '' })
const pageNum = ref(1)
const pageSize = ref(20)
/** 当前左树维度（树结构随它变化，表格过滤也按它取字段） */
const dimension = ref('app')
/** 已同步/选中的测试环境：同步后固定用它取数（缺省由后端挑「已有数据的环境」） */
const activeEnvId = ref('')
/** 选中的树节点：key 形如 all / g:<维度值> / a:<应用编码> */
const selectedKeys = ref<string[]>(['all'])

/** 树节点 → 查询参数（应用优先；「未分类」走哨兵值） */
const scopeParams = computed(() => {
  const key = selectedKeys.value[0] || 'all'
  if (key.startsWith('a:'))
    return { app_number: key.slice(2) }
  if (key.startsWith('g:')) {
    const value = key.slice(2)
    if (value === UNCLASSIFIED_FILTER) {
      if (dimension.value === 'project_group')
        return { project_group: UNCLASSIFIED_FILTER }
      if (dimension.value === 'business_area')
        return { business_area: UNCLASSIFIED_FILTER }
      if (dimension.value === 'product_domain')
        return { product_domain: UNCLASSIFIED_FILTER }
      return {}
    }
    if (dimension.value === 'project_group')
      return { project_group: value }
    if (dimension.value === 'business_area')
      return { business_area: value }
    if (dimension.value === 'product_domain')
      return { product_domain: value }
    return { cloud: value }
  }
  return {}
})

const queryParams = computed(() => ({
  ...scopeParams.value,
  env_id: activeEnvId.value || undefined,
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

// ── 左树（维度切换）───────────────────────────────
const treeLoading = ref(false)
const envName = ref('')
const groups = ref<any[]>([])
const unclassified = ref<any[]>([])
const totalApis = ref(0)

const treeData = computed(() => {
  const root: any = {
    key: 'all',
    title: `全部接口（${totalApis.value}）`,
    children: [] as any[],
  }
  for (const g of groups.value) {
    root.children.push({
      key: `g:${g.code}`,
      title: `${g.name || g.code}（${g.api_count}）`,
      children: (g.apps || []).map((a: any) => ({
        key: `a:${a.app_number}`,
        title: `${a.app_number} ${a.app_name}（${a.api_count}）`,
        isLeaf: true,
      })),
    })
  }
  if (unclassified.value.length) {
    const count = unclassified.value.reduce((s: number, u: any) => s + (u.api_count || 0), 0)
    root.children.push({
      key: `g:${UNCLASSIFIED_FILTER}`,
      title: `未分类（${count}）`,
      children: unclassified.value.map((a: any) => ({
        key: `a:${a.app_number}`,
        title: `${a.app_number} ${a.app_name}（${a.api_count}）`,
        isLeaf: true,
      })),
    })
  }
  return [root]
})

async function fetchTree() {
  treeLoading.value = true
  try {
    const res = await getAction<any>(ApiMetadataInventory.tree, {
      dimension: dimension.value,
      env_id: activeEnvId.value || undefined,
    })
    if (!res)
      return
    envName.value = res.env?.name || ''
    totalApis.value = res.total || 0
    groups.value = res.groups || []
    unclassified.value = res.unclassified || []
  }
  finally {
    treeLoading.value = false
  }
}

function handleTreeSelect(keys: any) {
  const list = Array.isArray(keys) ? keys : [keys]
  selectedKeys.value = list.length ? list : ['all']
  handleSearch()
}

function handleDimensionChange() {
  selectedKeys.value = ['all']
  pageNum.value = 1
  void fetchTree().then(() => fetchList())
}

// ── 同步（选测试环境 → 拉定义库 → 更新/新增/标记删除）────
const syncVisible = ref(false)
const syncEnvId = ref('')
const syncing = ref(false)
const envOptions = ref<any[]>([])

const { execute: fetchEnvs } = useGet<any>(ApiPerfEnv.getList, { page_num: 1, page_size: 100 }, { immediate: false })

async function openSync() {
  syncVisible.value = true
  const res: any = await fetchEnvs()
  const list = res?.list || []
  envOptions.value = list
  if (!syncEnvId.value && list.length)
    syncEnvId.value = list[0].id
}

async function handleSync() {
  if (!syncEnvId.value) {
    Message.warning('请选择要同步的测试环境')
    return
  }
  syncing.value = true
  try {
    const stats: any = await postAction(ApiMetadataInventory.sync, { env_id: syncEnvId.value })
    if (stats === null)
      return
    const dedupedText = stats.deduped ? `（合并重复 ${stats.deduped}）` : ''
    Message.success(`同步完成：新增 ${stats.inserted}，更新 ${stats.updated}，标记删除 ${stats.deleted}${dedupedText}`)
    activeEnvId.value = syncEnvId.value
    syncVisible.value = false
    await fetchTree()
    await fetchList()
  }
  finally {
    syncing.value = false
  }
}

// ── 同步记录（弹窗）───────────────────────────────
const recordsVisible = ref(false)
const recordsLoading = ref(false)
const records = ref<any[]>([])

async function openRecords() {
  recordsVisible.value = true
  recordsLoading.value = true
  try {
    const res = await getAction<any>(ApiMetadataInventory.syncRuns, {
      env_id: activeEnvId.value || undefined,
      page_num: 1,
      page_size: 50,
    })
    records.value = res?.list || []
  }
  finally {
    recordsLoading.value = false
  }
}

onMounted(async () => {
  await fetchTree()
  await fetchList()
})
</script>

<template>
  <ListPage aside-title="归属维度" :aside-width="320" aside-resizable :aside-max-width="520">
    <template #aside>
      <div class="dimension-bar">
        <a-select v-model="dimension" size="small" @change="handleDimensionChange">
          <a-option v-for="d in DIMENSION_OPTIONS" :key="d.value" :value="d.value">
            {{ d.label }}
          </a-option>
        </a-select>
      </div>
      <a-spin :loading="treeLoading" style="display: block">
        <a-tree
          :data="treeData"
          :selected-keys="selectedKeys"
          block-node
          @select="handleTreeSelect"
        />
        <a-empty v-if="!treeLoading && !groups.length && !unclassified.length" description="暂无数据，请先同步" />
      </a-spin>
    </template>

    <template #filter>
      <div class="filter-bar">
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
        <span>数据源：{{ envName || '--' }}（OpenAPI 定义库）｜ 当前范围 {{ total }} 条 ／ 全部 {{ totalApis }} 条</span>
        <a-space>
          <a-button size="small" @click="openRecords">
            同步记录
          </a-button>
          <a-button type="primary" size="small" @click="openSync">
            同步
          </a-button>
        </a-space>
      </div>
    </template>

    <template #default="{ tableHeight }">
      <a-table
        :data="rows"
        :loading="loading"
        :pagination="pagination"
        :scroll="{ x: 1698, y: tableHeight }"
        row-key="id"
        @page-change="handlePageChange"
        @page-size-change="handlePageSizeChange"
      >
        <template #columns>
          <a-table-column title="编号" data-index="number" :width="180" ellipsis tooltip />
          <a-table-column title="名称" data-index="name" :width="190" ellipsis tooltip />
          <a-table-column title="版本" data-index="api_version" :width="70" />
          <a-table-column title="方法" data-index="http_method" :width="80" />
          <a-table-column title="调用路径" data-index="call_path" :width="260" ellipsis tooltip />
          <a-table-column title="开发模式" :width="100" ellipsis tooltip>
            <template #cell="{ record }">
              <a-tooltip v-if="record.dev_mode" :content="`原始值：${record.dev_mode}`" mini>
                <span>{{ record.dev_mode_label || record.dev_mode }}</span>
              </a-tooltip>
              <span v-else>--</span>
            </template>
          </a-table-column>
          <a-table-column title="状态" :width="76">
            <template #cell="{ record }">
              <a-tooltip v-if="record.status" :content="`原始值：${record.status}`" mini>
                <a-tag :color="record.status === 'C' || record.status === 'enabled' ? 'green' : record.status === 'D' || record.status === 'disabled' ? 'gray' : 'blue'">
                  {{ record.status_label || record.status }}
                </a-tag>
              </a-tooltip>
              <span v-else>--</span>
            </template>
          </a-table-column>
          <a-table-column title="第三方应用授权" :width="120">
            <template #cell="{ record }">
              <a-tag :color="record.thirdapp_auth ? 'orange' : 'gray'">
                {{ record.thirdapp_auth ? '是' : '否' }}
              </a-tag>
            </template>
          </a-table-column>
          <a-table-column title="业务对象" :width="140" ellipsis tooltip>
            <template #cell="{ record }">
              {{ record.biz_object || '--' }}
            </template>
          </a-table-column>
          <a-table-column title="数据源" :width="150" ellipsis tooltip>
            <template #cell="{ record }">
              {{ record.env_name || '--' }}
            </template>
          </a-table-column>
          <a-table-column title="应用" :width="160" ellipsis tooltip>
            <template #cell="{ record }">
              {{ record.app_number ? `${record.app_number} ${record.app_name || ''}` : '未归属' }}
            </template>
          </a-table-column>
          <a-table-column title="云" :width="100" ellipsis tooltip>
            <template #cell="{ record }">
              {{ record.cloud_name || '--' }}
            </template>
          </a-table-column>
          <a-table-column title="创建时间" :width="156">
            <template #cell="{ record }">
              {{ formatTime(record.source_created_at) }}
            </template>
          </a-table-column>
          <a-table-column title="更新时间" :width="156">
            <template #cell="{ record }">
              {{ formatTime(record.source_updated_at) }}
            </template>
          </a-table-column>
        </template>
        <template #empty>
          <a-empty description="暂无数据：点右上角「同步」从测试环境拉取接口定义" />
        </template>
      </a-table>
    </template>
  </ListPage>

  <!-- 同步：选环境 → 拉取定义库（存在则更新/不存在新增/源侧删除则标记删除） -->
  <a-modal
    v-model:visible="syncVisible"
    title="同步 API 清单"
    :width="520"
    :ok-loading="syncing"
    ok-text="开始同步"
    @ok="handleSync"
  >
    <a-form :model="{ env_id: syncEnvId }" layout="vertical">
      <a-form-item label="测试环境（基础配置 → 测试环境）" required>
        <a-select v-model="syncEnvId" placeholder="选择要同步的环境" allow-search>
          <a-option v-for="e in envOptions" :key="e.id" :value="e.id">
            {{ e.env_name }}（{{ e.env_code }}）
          </a-option>
        </a-select>
      </a-form-item>
      <div class="sync-hint">
        同步语义：已存在则更新、不存在则新增、源侧已删除则标记删除。<br>
        数据来源：该环境的 OpenAPI 定义库；应用/云归属随同步刷新，项目组/领域在查看时动态关联。
      </div>
    </a-form>
  </a-modal>

  <!-- 同步记录：时间 / 环境 / 新增 / 更新 / 标记删除 -->
  <a-modal
    v-model:visible="recordsVisible"
    title="同步记录"
    :width="760"
    :footer="false"
  >
    <a-table
      :data="records"
      :loading="recordsLoading"
      :pagination="false"
      :scroll="{ y: 420 }"
      row-key="id"
      size="small"
    >
      <template #columns>
        <a-table-column title="同步时间" :width="170">
          <template #cell="{ record }">
            {{ formatTime(record.finished_at || record.started_at) }}
          </template>
        </a-table-column>
        <a-table-column title="测试环境" :width="170" ellipsis tooltip>
          <template #cell="{ record }">
            {{ record.env_name || record.env_id }}
          </template>
        </a-table-column>
        <a-table-column title="接口总数" data-index="total" :width="90" />
        <a-table-column title="新增" data-index="inserted" :width="76" />
        <a-table-column title="更新" data-index="updated" :width="76" />
        <a-table-column title="标记删除" data-index="deleted" :width="90" />
        <a-table-column title="合并重复" data-index="deduped" :width="90" />
      </template>
      <template #empty>
        <a-empty description="暂无同步记录" />
      </template>
    </a-table>
  </a-modal>
</template>

<style scoped>
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

.dimension-bar {
  margin-bottom: 8px;
}

.inventory-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  color: var(--color-text-3);
  font-size: 12px;
}

.sync-hint {
  color: var(--color-text-3);
  font-size: 12px;
}
</style>
