<script setup lang="ts">
/**
 * API测试结果（安全测试 → API测试 → API测试结果）
 *
 * 运行视图：运行记录列表（GET /sechub/scan/runs）→ 点某条运行在抽屉里看该运行的
 * API 结果明细（GET /sechub/scan/runs/{id}/results，分页 + 判定/类型/关键词筛选）。
 *
 * 左树：GET /metadata/api-inventory/tree?depth=api&source=results（计数=该 API 的结果数），
 * 点 API 叶子后把它作为结果查询的 keyword（结果接口按用例的 api_path 做子串匹配）。
 * 顶部摘要来自域名视图 GET /sechub/scan/domain/cases?domain=openapi（用例数/最近执行/判定分布）。
 */
import { computed, reactive, ref } from 'vue'

import { ApiSecScan } from '@/api/sechubApis'
import ListPage from '@/components/common/ListPage.vue'
import { formatTime, useGet } from '@/hooks'
import ApiInventoryTree from '@/views/metadata/components/ApiInventoryTree.vue'
import ApiDomainSummary from './components/ApiDomainSummary.vue'
import ApiRunResultsDrawer from './components/ApiRunResultsDrawer.vue'

// 组件名必须与路由 name（= sys_menu.path）一致，keep-alive :include 按它对上缓存
// eslint-disable-next-line vue/component-definition-name-casing
defineOptions({ name: 'api-test-results' })

const DIMENSION_OPTIONS = [
  { value: 'app', label: '按应用' },
  { value: 'project_group', label: '按项目组' },
  { value: 'business_area', label: '按业务领域' },
  { value: 'product_domain', label: '按产品领域' },
]

const RUN_STATUS: Record<string, { label: string, color: string }> = {
  pending: { label: '待执行', color: 'gray' },
  running: { label: '运行中', color: 'blue' },
  success: { label: 'PASS', color: 'green' },
  failed: { label: 'FAIL', color: 'red' },
  partial: { label: '部分通过', color: 'orange' },
  cancelled: { label: '已取消', color: 'gray' },
}
function runStatusMeta(status?: string | null) {
  return RUN_STATUS[status || ''] ?? { label: status || '--', color: 'gray' }
}

const dimension = ref('app')
/** 左树选中的 API：查看运行结果时作为初始过滤关键词 */
const selectedApiPath = ref('')

// ── 域摘要（API 域用例数 / 最近执行 / 判定分布）────────
// 用域视图顺带取一次 summary；列表只取 1 条（本页不用它的用例列表）
const { data: domainRes } = useGet<any>(
  ApiSecScan.domainCases,
  { domain: 'openapi', page_num: 1, page_size: 1 },
  { immediate: true },
)
const summary = computed(() => domainRes.value?.summary || null)

// ── 运行列表 ──────────────────────────────────────
const searchForm = reactive({ keyword: '', status: '' })
const pageNum = ref(1)
const pageSize = ref(20)

const queryParams = computed(() => ({
  page_num: pageNum.value,
  page_size: pageSize.value,
  keyword: searchForm.keyword,
  filters: searchForm.status
    ? JSON.stringify([{ field: 'status', op: 'eq', value: searchForm.status }])
    : '',
}))

const { isFetching: loading, data: rawData, execute: fetchList } = useGet<any>(
  ApiSecScan.runList,
  queryParams,
  { immediate: true },
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
  searchForm.status = ''
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

// 左树选中：只有 API 叶子对结果有意义，其它层级仅用于浏览
function handleTreeSelect(s: any) {
  selectedApiPath.value = s.kind === 'api' ? s.code : ''
}

// ── 运行结果抽屉 ──────────────────────────────────
const drawerVisible = ref(false)
const currentRun = ref<any>(null)

function openResults(record: any) {
  currentRun.value = record
  drawerVisible.value = true
}
</script>

<template>
  <div class="api-test-results">
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
        <ApiInventoryTree :dimension="dimension" depth="api" source="results" @select="handleTreeSelect" />
      </template>

      <template #filter>
        <div class="filter-bar">
          <div class="f-wide">
            <a-input
              v-model="searchForm.keyword"
              placeholder="运行名称 / 迭代阶段"
              allow-clear
              @press-enter="handleSearch"
              @clear="handleSearch"
            />
          </div>
          <div class="f-mid">
            <a-select v-model="searchForm.status" placeholder="状态" allow-clear @change="handleSearch">
              <a-option v-for="(meta, value) in RUN_STATUS" :key="value" :value="value">
                {{ meta.label }}
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
          已选 API：{{ selectedApiPath }}（打开运行结果时按此过滤）
        </a-tag>
        <span v-else class="scope-hint">从左侧选择 API 可只看该接口的结果</span>
        <div class="toolbar-spacer" />
      </template>

      <template #default="{ tableHeight }">
        <!-- 域摘要：API 用例总数 / 最近执行 / 判定分布 -->
        <ApiDomainSummary :summary="summary" />

        <a-table
          :data="rows"
          :loading="loading"
          :pagination="pagination"
          :scroll="{ minWidth: 1000, y: tableHeight }"
          row-key="id"
          @page-change="handlePageChange"
          @page-size-change="handlePageSizeChange"
        >
          <template #columns>
            <a-table-column title="运行名称" data-index="run_name" :width="260" ellipsis tooltip />
            <a-table-column title="迭代阶段" :width="130" ellipsis tooltip>
              <template #cell="{ record }">
                {{ record.iteration_phase || '--' }}
              </template>
            </a-table-column>
            <a-table-column title="状态" :width="100">
              <template #cell="{ record }">
                <a-tag :color="runStatusMeta(record.status).color">
                  {{ runStatusMeta(record.status).label }}
                </a-tag>
              </template>
            </a-table-column>
            <a-table-column title="用例统计" :width="150">
              <template #cell="{ record }">
                <a-tooltip content="总用例 / 通过 / 失败" mini>
                  <span>{{ record.total_cases }} / {{ record.pass_cnt }} / {{ record.fail_cnt }}</span>
                </a-tooltip>
              </template>
            </a-table-column>
            <a-table-column title="开始时间" :width="160">
              <template #cell="{ record }">
                {{ formatTime(record.started_at) }}
              </template>
            </a-table-column>
            <a-table-column title="操作" :width="110" fixed="right">
              <template #cell="{ record }">
                <a-link @click="openResults(record)">
                  查看结果
                </a-link>
              </template>
            </a-table-column>
          </template>
          <template #empty>
            <a-empty description="暂无运行记录：在「扫描任务」里执行包含 OpenAPI 测试的任务" />
          </template>
        </a-table>
      </template>
    </ListPage>

    <!-- 运行结果明细（分页 + 判定/类型/关键词筛选） -->
    <ApiRunResultsDrawer
      v-model:visible="drawerVisible"
      :run="currentRun"
      :preset-keyword="selectedApiPath"
    />
  </div>
</template>

<style scoped>
.api-test-results {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.api-test-results > .list-page {
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
