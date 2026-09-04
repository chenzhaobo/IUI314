<script lang="ts" setup>
import type { ColumnFilterState } from '@/hooks'
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Message } from '@arco-design/web-vue'
import { deleteAction, emptyFilter, formatTime, isFilterActive, postAction, toServerFilters, useFilterPersistence, useGet, useTableAutoHeight, withTableDefaults } from '@/hooks'
import ColumnFilterPanel from '@/components/common/ColumnFilterPanel.vue'
import { ApiPerfBaseline, ApiPerfRun, ApiPerfScript } from '@/api/apis'

const router = useRouter()

defineOptions({ name: 'baseline' })

// ── 基线列表 ──────────────────────────────────
const queryParams = ref<Record<string, any>>({ page_num: 1, page_size: 10, keyword: '', script_id: '' })
const { isFetching: isLoading, data: rawListData, execute: getList } = useGet<any>(ApiPerfBaseline.getList, queryParams, { immediate: true })
const dataList = computed(() => rawListData.value?.list || [])
const total = computed(() => rawListData.value?.total || 0)

function handleSearch() { queryParams.value.page_num = 1; getList() }
function handlePageChange(page: number) { queryParams.value.page_num = page; getList() }
// 改每页条数必须同时回到第 1 页：原本停在第 5 页、条数从 10 改成 50 时，
// 第 5 页往往已超出新的总页数，后端返回空列表，看起来像"数据没了"。
function handlePageSizeChange(size: number) { queryParams.value.page_size = size; queryParams.value.page_num = 1; getList() }

// ── 列筛选（服务端分页，走 toServerFilters 交后端） ──────────────
const FILTERABLE_COLUMNS = ['name', 'version_label'] as const
const columnFilters = ref<Record<string, ColumnFilterState>>(
  Object.fromEntries(FILTERABLE_COLUMNS.map(k => [k, emptyFilter('text')])),
)
function filterableOf(key: string) {
  return {
    slotName: `filter-${key}`,
    filteredValue: isFilterActive(columnFilters.value[key]) ? ['1'] : [],
    filter: () => true,
    hideButton: true,
  }
}
function onColumnFilterChange() {
  queryParams.value.page_num = 1
  queryParams.value.filters = toServerFilters(columnFilters.value)
  getList()
}

// 表格高度自适应 + 筛选暂存
const tableWrap = ref<HTMLElement>()
const { tableHeight } = useTableAutoHeight(tableWrap)
useFilterPersistence('perf-baseline', {
  pageSize: computed({ get: () => queryParams.value.page_size, set: v => (queryParams.value.page_size = v) }),
  columnFilters,
})

// 页内往返恢复列筛选后按恢复的条件重查（注册在持久化之后，故在其恢复之后执行）
onMounted(() => {
  if (FILTERABLE_COLUMNS.some(k => isFilterActive(columnFilters.value[k]))) {
    queryParams.value.page_num = 1
    queryParams.value.filters = toServerFilters(columnFilters.value)
    getList()
  }
})

// 脚本列表
const { data: scriptData } = useGet<any>(ApiPerfScript.getList, { page_num: 1, page_size: 100 }, { immediate: true })
const scriptOptions = computed(() => (scriptData.value?.list || []).map((s: any) => ({ label: s.name, value: s.id })))

// 执行列表
const { data: runData } = useGet<any>(ApiPerfRun.getList, { page_num: 1, page_size: 100 }, { immediate: true })
const scriptMap = computed(() => {
  const m: Record<string, string> = {}
  for (const s of (scriptData.value?.list || [])) m[s.id] = s.name
  return m
})
const runMap = computed(() => {
  const m: Record<string, any> = {}
  for (const r of (runData.value?.list || [])) m[r.id] = r
  return m
})


const runOptions = computed(() =>
  (runData.value?.list || [])
    .filter((r: any) => r.run_status === 'success')
    .map((r: any) => ({ label: `${formatTime(r.started_at)} | ${scriptMap.value[r.script_id] || r.script_id.slice(0, 8)}`, value: r.id }))
)

const columns = computed(() => withTableDefaults([
  { title: '基线名称', dataIndex: 'name', width: 160, filterable: filterableOf('name') },
  { title: '版本标签', dataIndex: 'version_label', width: 120, filterable: filterableOf('version_label') },
  { title: '类型', dataIndex: 'baseline_type', width: 80 },
  { title: '脚本名称', dataIndex: 'script_id', width: 140, slotName: 'script_name' },
  { title: '执行记录', dataIndex: 'run_id', width: 140, slotName: 'run_info' },
  { title: '状态', dataIndex: 'status', width: 60, slotName: 'status' },
  { title: '创建时间', dataIndex: 'created_at', width: 160, slotName: 'created_at' },
  { title: '操作', dataIndex: 'operations', slotName: 'operations', width: 200, fixed: 'right' as const },
]))

// ── 新增基线弹窗 ──────────────────────────────────
const addVisible = ref(false)
const addForm = ref({ name: '', script_id: '', run_id: '', baseline_type: 'release', version_label: '', remark: '', status: '1', id: '', project_group_id: '', summary_json: null, create_by: '', created_at: null, updated_at: null, deleted_at: null })

function handleAddClick() {
  addForm.value = { name: '', script_id: '', run_id: '', baseline_type: 'release', version_label: '', remark: '', status: '1', id: '', project_group_id: '', summary_json: null, create_by: '', created_at: null, updated_at: null, deleted_at: null }
  addVisible.value = true
}

async function handleAddSubmit() {
  if (!addForm.value.name) { Message.warning('请输入基线名称'); return }
  if (!addForm.value.run_id) { Message.warning('请选择执行记录'); return }
  const res = await postAction(ApiPerfBaseline.add, addForm.value)
  if (!res) return
  Message.success('添加成功')
  addVisible.value = false
  getList()
}

// ── 删除 ──────────────────────────────────
async function handleDelete(record: any) {
  const res = await deleteAction(ApiPerfBaseline.delete, { ids: [record.id] })
  if (!res) return
  Message.success('删除成功')
  getList()
}

// ── 版本对比 ──────────────────────────────────
const compareVisible = ref(false)
const compareForm = ref({ baseline_run_id: '', current_run_id: '' })
const compareResult = ref<any>(null)
const comparing = ref(false)

const compareColumns = [
  { title: 'Label', dataIndex: 'label', width: 200, ellipsis: true, tooltip: true, fixed: 'left' as const },
  { title: '基线Avg(ms)', dataIndex: 'baseline_avg', width: 110 },
  { title: '当前Avg(ms)', dataIndex: 'current_avg', width: 110 },
  { title: 'Avg变化', dataIndex: 'delta_avg', width: 100, slotName: 'delta_avg' },
  { title: '基线P95(ms)', dataIndex: 'baseline_p95', width: 110 },
  { title: '当前P95(ms)', dataIndex: 'current_p95', width: 110 },
  { title: 'P95变化', dataIndex: 'delta_p95', width: 100, slotName: 'delta_p95' },
  { title: '基线Throughput', dataIndex: 'baseline_throughput', width: 120 },
  { title: '当前Throughput', dataIndex: 'current_throughput', width: 120 },
  { title: 'TPS变化', dataIndex: 'delta_throughput', width: 100, slotName: 'delta_throughput' },
  { title: '基线Error%', dataIndex: 'baseline_error_pct', width: 100 },
  { title: '当前Error%', dataIndex: 'current_error_pct', width: 100 },
  { title: 'Error变化', dataIndex: 'delta_error_pct', width: 100, slotName: 'delta_error_pct' },
]

function handleCompareClick() {
  compareForm.value = { baseline_run_id: '', current_run_id: '' }
  compareResult.value = null
  compareVisible.value = true
}

// 从基线记录发起比对，自动填充 baseline_run_id
function handleCompareWithBaseline(record: any) {
  compareForm.value = { baseline_run_id: record.run_id, current_run_id: '' }
  compareResult.value = null
  compareVisible.value = true
}

// 跳转到聚合报告查看明细
function handleViewDetail(record: any) {
  router.push({ path: '/perf/report-group/report', query: { run_id: record.run_id } })
}

async function handleCompareSubmit() {
  if (!compareForm.value.baseline_run_id) { Message.warning('请选择基线Run'); return }
  if (!compareForm.value.current_run_id) { Message.warning('请选择当前Run'); return }
  comparing.value = true
  try {
    const res = await postAction<any>(ApiPerfBaseline.compare, compareForm.value)
    if (!res) return
    compareResult.value = res
  } finally {
    comparing.value = false
  }
}

function fmt(n: number | undefined, digits = 2): string {
  if (n === undefined || n === null) return '-'
  return Number(n).toFixed(digits)
}

function deltaColor(delta: number, higherIsBad = true): string {
  if (delta > 0) return higherIsBad ? 'red' : 'green'
  if (delta < 0) return higherIsBad ? 'green' : 'red'
  return 'inherit'
}

function deltaText(delta: number, digits = 2): string {
  const sign = delta > 0 ? '+' : ''
  return `${sign}${fmt(delta, digits)}`
}
</script>

<template>
  <div class="perf-baseline">
    <a-card :bordered="false" class="m-b-8px">
      <a-row :gutter="16">
        <a-col :span="6">
          <a-input v-model="queryParams.keyword" placeholder="搜索基线名称/版本标签" allow-clear @press-enter="handleSearch" />
        </a-col>
        <a-col :span="6">
          <a-select v-model="queryParams.script_id" :options="scriptOptions" placeholder="选择脚本" allow-clear @change="handleSearch" />
        </a-col>
        <a-col :span="6">
          <a-space>
            <a-button type="primary" @click="handleSearch">搜索</a-button>
            <a-button type="primary" status="success" @click="handleAddClick">新增基线</a-button>
            <a-button @click="handleCompareClick">版本对比</a-button>
          </a-space>
        </a-col>
      </a-row>
    </a-card>

    <div ref="tableWrap">
    <a-card :bordered="false">
      <a-table column-resizable :loading="isLoading" :data="dataList" :columns="columns"
        :pagination="{ total, current: queryParams.page_num, pageSize: queryParams.page_size, showTotal: true, showPageSize: true }"
        row-key="id" :scroll="{ y: tableHeight }" @page-change="handlePageChange"
 @page-size-change="handlePageSizeChange">
        <template v-for="key in FILTERABLE_COLUMNS" #[`filter-${key}`] :key="key">
          <ColumnFilterPanel v-model="columnFilters[key]" @change="onColumnFilterChange" />
        </template>
        <template #created_at="{ record }">{{ formatTime(record.created_at) }}</template>
        <template #script_name="{ record }">
          {{ scriptMap[record.script_id] || record.script_id?.substring(0, 8) || '-' }}
        </template>
        <template #run_info="{ record }">
          {{ runMap[record.run_id]?.started_at ? formatTime(runMap[record.run_id].started_at) : (record.run_id?.substring(0, 8) || '-') }}
        </template>
        <template #status="{ record }">
          <a-tag :color="record.status === '1' ? 'green' : 'red'">{{ record.status === '1' ? '启用' : '禁用' }}</a-tag>
        </template>
        <template #operations="{ record }">
          <a-button type="text" size="small" @click="handleCompareWithBaseline(record)">比对</a-button>
          <a-button type="text" size="small" @click="handleViewDetail(record)">明细</a-button>
          <a-popconfirm content="确认删除？" @ok="handleDelete(record)">
            <a-button type="text" size="small" status="danger">删除</a-button>
          </a-popconfirm>
        </template>
      </a-table>
    </a-card>
    </div>

    <!-- 新增基线弹窗 -->
    <a-modal v-model:visible="addVisible" title="新增性能基线" :width="520" @ok="handleAddSubmit">
      <a-form :model="addForm" layout="vertical">
        <a-form-item label="基线名称" required>
          <a-input v-model="addForm.name" placeholder="如：V1.0性能基线" />
        </a-form-item>
        <a-form-item label="执行记录" required>
          <a-select v-model="addForm.run_id" :options="runOptions" placeholder="选择成功的执行记录" allow-search />
        </a-form-item>
        <a-form-item label="脚本">
          <a-select v-model="addForm.script_id" :options="scriptOptions" placeholder="选择脚本" />
        </a-form-item>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="基线类型">
              <a-select v-model="addForm.baseline_type">
                <a-option value="release">release</a-option>
                <a-option value="iteration">iteration</a-option>
                <a-option value="hotfix">hotfix</a-option>
                <a-option value="baseline">baseline</a-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="版本标签">
              <a-input v-model="addForm.version_label" placeholder="如：2026Q2基线" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="备注">
          <a-textarea v-model="addForm.remark" :auto-size="{ minRows: 2, maxRows: 4 }" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 版本对比弹窗 -->
    <a-modal v-model:visible="compareVisible" title="版本对比" :width="1400" @ok="handleCompareSubmit" :ok-loading="comparing" ok-text="对比">
      <a-row :gutter="16" class="m-b-8px">
        <a-col :span="10">
          <a-select v-model="compareForm.baseline_run_id" :options="runOptions" placeholder="选择基线Run" allow-search />
        </a-col>
        <a-col :span="10">
          <a-select v-model="compareForm.current_run_id" :options="runOptions" placeholder="选择当前Run" allow-search />
        </a-col>
        <a-col :span="4">
          <a-button type="primary" :loading="comparing" @click="handleCompareSubmit">对比</a-button>
        </a-col>
      </a-row>

      <a-table column-resizable v-if="compareResult" :data="compareResult.rows" :columns="compareColumns" row-key="label" :scroll="{ minWidth: 1600 }" :pagination="false">
        <template #delta_avg="{ record }">
          <span :style="{ color: deltaColor(record.delta_avg) }">{{ deltaText(record.delta_avg) }}</span>
        </template>
        <template #delta_p95="{ record }">
          <span :style="{ color: deltaColor(record.delta_p95) }">{{ deltaText(record.delta_p95) }}</span>
        </template>
        <template #delta_throughput="{ record }">
          <span :style="{ color: deltaColor(record.delta_throughput, false) }">{{ deltaText(record.delta_throughput) }}</span>
        </template>
        <template #delta_error_pct="{ record }">
          <span :style="{ color: deltaColor(record.delta_error_pct) }">{{ deltaText(record.delta_error_pct) }}</span>
        </template>
      </a-table>
    </a-modal>
  </div>
</template>

<style scoped>
.perf-baseline { padding: 0; }
</style>
