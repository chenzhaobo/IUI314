<script setup lang="ts">
/**
 * 安全扫描 — 执行记录
 *
 * 对应后端 `/sechub/scan/runs`（api/src/sechub/scan_task.rs + service/sec_run.rs + sec_report.rs）：
 *   - 列表：GET /sechub/scan/runs（page_num / page_size / keyword / filters / suite_id / env_id）
 *   - 详情：GET /sechub/scan/runs/{id}
 *   - 结果：GET /sechub/scan/runs/{id}/results（分页 + verdict/test_type/keyword 筛选，
 *     每条结果内嵌 `case` 用例信息。全量运行可达数万条，绝不能一次全取）
 *   - 摘要：GET /sechub/scan/runs/{id}/summary（按「用例类型×测试类型×判定」聚合，
 *     4 万条明细不可能靠翻；摘要可点击下钻回结果列表）
 *   - 导出：GET /sechub/scan/runs/{id}/export（CSV 下载，需带 Authorization 头）
 *   - 取消：POST /sechub/scan/runs/{id}/cancel
 *
 * 路由 query（E09 穿透，进入时读一次）：
 *   - run_id   直接打开该运行的结果抽屉
 *   - task_id  列表按任务过滤
 *   - suite_id 列表按回归套件下环境任务过滤（suite_name 仅用于提示）
 */
import { Message, Modal } from '@arco-design/web-vue'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { ApiSecScan, resolveStaticScanApi } from '@/api/sechubApis'
import ListPage from '@/components/common/ListPage.vue'
import { formatTime, getAction, postAction, useDownload, useGet } from '@/hooks'
import RunResultTable from './components/RunResultTable.vue'
import RunSummaryPanel from './components/RunSummaryPanel.vue'
import { firstQueryText, toTask } from './composables/secNavigation'
import {
  RESULT_TEST_TYPE_OPTIONS,
  useRunResults,
  VERDICT_OPTIONS,
} from './composables/useRunResults'

// 组件名必须与路由 name（= sys_menu.path）一致，keep-alive :include 按它对上缓存
// （见 components/layout/app-main.vue 的注释）。lint 的 PascalCase 提示只是警告，
// 改名却会让页签缓存失效，所以此处保持 kebab-case。
// eslint-disable-next-line vue/component-definition-name-casing
defineOptions({ name: 'scan-runs' })

// ── 运行状态 ──────────────────────────────────────
// 取值域与 sec_sec_run.status 一致（迁移脚本 sec_sec_run.sql 注释）
const RUN_STATUS_OPTIONS = [
  { value: 'pending', label: '待执行' },
  { value: 'running', label: '运行中' },
  { value: 'success', label: 'PASS' },
  { value: 'failed', label: 'FAIL' },
  { value: 'partial', label: '部分通过' },
  { value: 'cancelled', label: '已取消' },
]

const RUN_STATUS: Record<string, { label: string, color: string }> = {
  pending: { label: '待执行', color: 'gray' },
  running: { label: '运行中', color: 'blue' },
  success: { label: 'PASS', color: 'green' },
  failed: { label: 'FAIL', color: 'red' },
  partial: { label: '部分通过', color: 'orange' },
  cancelled: { label: '已取消', color: 'gray' },
}

/** 存在这些状态的运行时后端拒绝再次触发任务执行，也允许取消 */
const ACTIVE_STATUSES = ['pending', 'running']

function runStatusMeta(status?: string | null) {
  return RUN_STATUS[status || ''] ?? { label: status || '--', color: 'gray' }
}

interface SecRunRow {
  id: string
  run_name?: string | null
  status?: string | null
  task_id?: string | null
  iteration_phase?: string | null
  trigger_mode?: string | null
  started_at?: string | null
  finished_at?: string | null
  total_cases?: number | null
  pass_cnt?: number | null
  fail_cnt?: number | null
  review_cnt?: number | null
  block_cnt?: number | null
  error_cnt?: number | null
  new_forms_cnt?: number | null
  new_buttons_cnt?: number | null
  new_apis_cnt?: number | null
}

// ── 路由穿透（进入时读一次）───────────────────────
const route = useRoute()
const router = useRouter()
const initialRunId = firstQueryText(route.query.run_id)
const initialSuiteName = firstQueryText(route.query.suite_name)

// ── 筛选 ──────────────────────────────────────────
const searchForm = reactive({
  keyword: '',
  status: '',
  task_id: firstQueryText(route.query.task_id),
  suite_id: firstQueryText(route.query.suite_id),
})

const pageNum = ref(1)
const pageSize = ref(20)

/**
 * `filters` 是后端 dyn_filter 的通用筛选协议：JSON 数组字符串（{field, op, value}），
 * 字段名必须能在实体 Column 上解析出来，否则后端报错（db/src/common/dyn_filter.rs）。
 * suite_id 是 runs 接口的独立参数（service/sec_run.rs），不经 filters。
 */
const queryParams = computed(() => {
  const filters: Array<{ field: string, op: string, value: string }> = []
  if (searchForm.status)
    filters.push({ field: 'status', op: 'eq', value: searchForm.status })
  if (searchForm.task_id)
    filters.push({ field: 'task_id', op: 'eq', value: searchForm.task_id })
  return {
    page_num: pageNum.value,
    page_size: pageSize.value,
    keyword: searchForm.keyword,
    suite_id: searchForm.suite_id,
    filters: filters.length ? JSON.stringify(filters) : '',
  }
})

const {
  isFetching: loading,
  data: rawData,
  execute: fetchData,
} = useGet<any>(ApiSecScan.runList, queryParams, { immediate: true })

const tableData = computed(() => rawData.value?.list || [])
const pagination = computed(() => ({
  current: pageNum.value,
  pageSize: pageSize.value,
  total: rawData.value?.total || 0,
  showTotal: true,
  showPageSize: true,
}))

// ── 任务名称：运行记录只存 task_id，拉一次任务列表建映射 ──────────
const { data: taskRes } = useGet<any>(ApiSecScan.taskList, { page_num: 1, page_size: 200 }, { immediate: true })
const taskNameMap = computed(() => {
  const map: Record<string, string> = {}
  const list = taskRes.value?.list
  if (Array.isArray(list)) {
    for (const t of list)
      map[t.id] = t.name
  }
  return map
})
function taskName(taskId?: string | null) {
  return taskId ? taskNameMap.value[taskId] || taskId : '--'
}

const suiteFilterLabel = computed(() => initialSuiteName || searchForm.suite_id)

function clearTaskFilter() {
  searchForm.task_id = ''
  handleSearch()
}

function clearSuiteFilter() {
  searchForm.suite_id = ''
  handleSearch()
}

// ── 查看结果 ──────────────────────────────────────
const drawerVisible = ref(false)
const drawerLoading = ref(false)
const currentRun = ref<SecRunRow | null>(null)

// 执行摘要（OPT-2）：整体判定分布 + 按「用例类型×测试类型」分组
const summaryLoading = ref(false)
const summary = ref<any>(null)
const exporting = ref(false)
const { downloadWithTip } = useDownload()

// 结果分页 + 筛选 + 摘要下钻（4 万+ 条结果，必须服务端分页）
const {
  resultsLoading,
  results,
  resultTotal,
  resultFilter,
  resultPagination,
  loadForRun,
  handleSearch: handleResultSearch,
  handleReset: handleResultReset,
  handlePageChange: handleResultPageChange,
  handlePageSizeChange: handleResultPageSizeChange,
  drillGroup,
} = useRunResults()

async function openResults(record: SecRunRow) {
  currentRun.value = record
  summary.value = null
  drawerVisible.value = true

  drawerLoading.value = true
  try {
    // 详情单独拉一次：列表字段与详情同构，但执行中统计会不断变化。
    // 摘要与结果页并行请求：三个接口互不依赖，串行会让抽屉白屏更久。
    const [detail] = await Promise.all([
      getAction<SecRunRow>(resolveStaticScanApi(ApiSecScan.runGetById, { id: record.id })),
      fetchSummary(record.id),
      loadForRun(record.id),
    ])
    if (detail)
      currentRun.value = detail
  }
  finally {
    drawerLoading.value = false
  }
}

// ── 执行摘要（OPT-2）─────────────────────────────
async function fetchSummary(runId?: string | null) {
  const id = runId || currentRun.value?.id
  if (!id)
    return
  summaryLoading.value = true
  try {
    summary.value = await getAction<any>(resolveStaticScanApi(ApiSecScan.runSummary, { id }))
  }
  finally {
    summaryLoading.value = false
  }
}

/** 导出当前筛选下的结果 CSV（文件名与后端一致：运行 id 前 8 位 + 导出时间） */
async function handleExport() {
  const id = currentRun.value?.id
  if (!id || exporting.value)
    return
  exporting.value = true
  try {
    const params = new URLSearchParams({ format: 'csv' })
    if (resultFilter.verdict)
      params.set('verdict', resultFilter.verdict)
    if (resultFilter.test_type)
      params.set('test_type', resultFilter.test_type)
    if (resultFilter.keyword)
      params.set('keyword', resultFilter.keyword)
    const url = `${resolveStaticScanApi(ApiSecScan.runExport, { id })}?${params.toString()}`
    // 必须走带 token 的下载 hook：window.open / a[href] 不带 Authorization 头
    await downloadWithTip(url, exportFileName(id), '导出报告失败')
  }
  finally {
    exporting.value = false
  }
}

function exportFileName(id: string) {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  return `sec-run-${String(id).slice(0, 8)}-${stamp}.csv`
}

// ── 取消运行 ──────────────────────────────────────
function handleCancel(record: SecRunRow) {
  Modal.confirm({
    title: '取消运行',
    content: `确认取消「${record.run_name}」？已产生的用例结果会保留。`,
    okText: '取消运行',
    cancelText: '返回',
    onOk: async () => {
      const res = await postAction<string>(resolveStaticScanApi(ApiSecScan.runCancel, { id: record.id }))
      if (res === null)
        return
      Message.success('已取消')
      await fetchData()
      // 抽屉里正看着这条运行时同步刷新状态
      const watching = currentRun.value
      if (watching && watching.id === record.id)
        await openResults(watching)
    },
  })
}

// ── 分页 / 查询 ───────────────────────────────────
function handleSearch() {
  pageNum.value = 1
  fetchData()
}

function handleReset() {
  searchForm.keyword = ''
  searchForm.status = ''
  searchForm.task_id = ''
  searchForm.suite_id = ''
  handleSearch()
}

function handlePageChange(page: number) {
  pageNum.value = page
  fetchData()
}

// 改每页条数必须同时回到第 1 页（否则新页可能已超出总页数，看起来像"数据没了"）
function handlePageSizeChange(size: number) {
  pageSize.value = size
  pageNum.value = 1
  fetchData()
}

onMounted(() => {
  if (initialRunId)
    void openResults({ id: initialRunId })
})
</script>

<template>
  <div>
    <ListPage>
      <!-- 筛选区：控件外层必须是原生 div，Arco Input/Select 的 inheritAttrs: false 会吞掉 class -->
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
              <a-option v-for="s in RUN_STATUS_OPTIONS" :key="s.value" :value="s.value">
                {{ s.label }}
              </a-option>
            </a-select>
          </div>
          <a-button type="primary" @click="handleSearch">
            查询
          </a-button>
          <a-button @click="handleReset">
            重置
          </a-button>
          <a-tag v-if="searchForm.task_id" closable color="arcoblue" @close="clearTaskFilter">
            任务：{{ taskName(searchForm.task_id) }}
          </a-tag>
          <a-tag v-if="searchForm.suite_id" closable color="arcoblue" @close="clearSuiteFilter">
            套件：{{ suiteFilterLabel }}
          </a-tag>
        </div>
      </template>

      <template #default="{ tableHeight }">
        <a-table
          :data="tableData"
          :loading="loading"
          :pagination="pagination"
          :scroll="{ minWidth: 1140, y: tableHeight }"
          row-key="id"
          @page-change="handlePageChange"
          @page-size-change="handlePageSizeChange"
        >
          <template #columns>
            <a-table-column title="运行名称" data-index="run_name" :width="240" ellipsis tooltip />
            <a-table-column title="任务" data-index="task_id" :width="200" ellipsis tooltip>
              <template #cell="{ record }">
                <a-link v-if="record.task_id" @click="router.push(toTask(record.task_id))">
                  {{ taskName(record.task_id) }}
                </a-link>
                <span v-else>--</span>
              </template>
            </a-table-column>
            <a-table-column title="迭代阶段" data-index="iteration_phase" :width="130" ellipsis tooltip>
              <template #cell="{ record }">
                {{ record.iteration_phase || '--' }}
              </template>
            </a-table-column>
            <a-table-column title="状态" data-index="status" :width="90">
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
            <a-table-column title="开始时间" data-index="started_at" :width="160">
              <template #cell="{ record }">
                {{ formatTime(record.started_at) }}
              </template>
            </a-table-column>
            <a-table-column title="操作" :width="160" fixed="right">
              <template #cell="{ record }">
                <a-space>
                  <a-link @click="openResults(record)">
                    查看结果
                  </a-link>
                  <a-link
                    v-if="ACTIVE_STATUSES.includes(record.status)"
                    status="warning"
                    @click="handleCancel(record)"
                  >
                    取消
                  </a-link>
                </a-space>
              </template>
            </a-table-column>
          </template>
        </a-table>
      </template>
    </ListPage>

    <!-- 执行详情 + 结果清单 -->
    <a-drawer
      v-model:visible="drawerVisible"
      width="80vw"
      :title="`执行详情 · ${currentRun?.run_name || ''}`"
      :body-style="{ maxHeight: 'calc(100vh - 120px)', overflow: 'auto' }"
    >
      <a-spin :loading="drawerLoading" style="display: block; min-height: 80px">
        <a-descriptions :column="2" bordered size="small">
          <a-descriptions-item label="运行名称">
            {{ currentRun?.run_name || '--' }}
          </a-descriptions-item>
          <a-descriptions-item label="状态">
            <a-tag :color="runStatusMeta(currentRun?.status).color">
              {{ runStatusMeta(currentRun?.status).label }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="所属任务">
            <a-link v-if="currentRun?.task_id" @click="router.push(toTask(currentRun.task_id))">
              {{ taskName(currentRun.task_id) }}
            </a-link>
            <span v-else>--</span>
          </a-descriptions-item>
          <a-descriptions-item label="迭代阶段">
            {{ currentRun?.iteration_phase || '--' }}
          </a-descriptions-item>
          <a-descriptions-item label="触发方式">
            {{ currentRun?.trigger_mode === 'scheduled' ? '定时' : '手动' }}
          </a-descriptions-item>
          <a-descriptions-item label="开始时间">
            {{ formatTime(currentRun?.started_at) }}
          </a-descriptions-item>
          <a-descriptions-item label="结束时间">
            {{ formatTime(currentRun?.finished_at) }}
          </a-descriptions-item>
          <a-descriptions-item label="用例统计">
            总 {{ currentRun?.total_cases ?? 0 }}
            ｜ 通过 {{ currentRun?.pass_cnt ?? 0 }}
            ｜ 失败 {{ currentRun?.fail_cnt ?? 0 }}
            ｜ 复核 {{ currentRun?.review_cnt ?? 0 }}
            ｜ 阻塞 {{ currentRun?.block_cnt ?? 0 }}
            ｜ 错误 {{ currentRun?.error_cnt ?? 0 }}
          </a-descriptions-item>
          <a-descriptions-item label="新增资产" :span="2">
            表单 {{ currentRun?.new_forms_cnt ?? 0 }}
            ｜ 按钮 {{ currentRun?.new_buttons_cnt ?? 0 }}
            ｜ 接口 {{ currentRun?.new_apis_cnt ?? 0 }}
          </a-descriptions-item>
        </a-descriptions>
      </a-spin>

      <!-- 执行摘要（OPT-2）：4 万条明细翻不动，先给聚合视图；点分组卡片下钻到明细 -->
      <RunSummaryPanel
        :summary="summary"
        :loading="summaryLoading"
        :exporting="exporting"
        @drill="drillGroup"
        @export="handleExport"
      />

      <a-divider>用例结果（{{ resultTotal }} 条）</a-divider>
      <div class="filter-bar result-filter-bar">
        <div class="f-wide">
          <a-input
            v-model="resultFilter.keyword"
            placeholder="表单 / API / 用例ID / 名称"
            allow-clear
            @press-enter="handleResultSearch"
            @clear="handleResultSearch"
          />
        </div>
        <div class="f-mid">
          <a-select v-model="resultFilter.verdict" placeholder="结果" allow-clear @change="handleResultSearch">
            <a-option v-for="v in VERDICT_OPTIONS" :key="v" :value="v">
              {{ v }}
            </a-option>
          </a-select>
        </div>
        <div class="f-mid">
          <a-select v-model="resultFilter.test_type" placeholder="测试类型" allow-clear @change="handleResultSearch">
            <a-option v-for="t in RESULT_TEST_TYPE_OPTIONS" :key="t.value" :value="t.value">
              {{ t.label }}
            </a-option>
          </a-select>
        </div>
        <a-button type="primary" @click="handleResultSearch">
          查询
        </a-button>
        <a-button @click="handleResultReset">
          重置
        </a-button>
      </div>
      <RunResultTable
        :results="results"
        :loading="resultsLoading"
        :pagination="resultPagination"
        @page-change="handleResultPageChange"
        @page-size-change="handleResultPageSizeChange"
      />
    </a-drawer>
  </div>
</template>

<style scoped>
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

/* 结果筛选栏在抽屉里，与上方描述区拉开间距 */
.result-filter-bar {
  margin-bottom: 12px;
}
</style>
