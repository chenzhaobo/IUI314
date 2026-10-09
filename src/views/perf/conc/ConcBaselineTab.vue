<script lang="ts" setup>
/**
 * 事务基线页「并发基线」页签：脚本并发 profile 列表 → 抽屉看逐事务基线明细。
 *
 * 口径：
 * - profile 是「脚本的固化执行条件」，一个脚本最多一条生效（部分唯一索引），
 *   列表带脚本名与基线事务数（后端 `ProfileRow` 拍平返回）；
 * - 删除是**软删**：历史基线与判定结果保留，只是该脚本不能再触发并发基准，
 *   所以确认文案要说清后果；
 * - 基线明细按 txn_code 升序返回（`baseline/list`）。
 */
import type { TableColumnData } from '@arco-design/web-vue'
import type { ConcBaselineRow, ConcProfileRow } from './types'
import { Message } from '@arco-design/web-vue'
import { nextTick, onMounted, ref } from 'vue'
import { formatTime, useTableAutoHeight, withTableDefaults } from '@/hooks'
import { deleteProfiles, fetchBaselines, fetchProfiles } from './service'
import { fmtCpuPerTps, fmtErrorPct, fmtMs, fmtTps, hwShort, idShort, profileSummary } from './types'

defineOptions({ name: 'ConcBaselineTab' })

// ── profile 列表（分页）──────────────────────────
const rows = ref<ConcProfileRow[]>([])
const loading = ref(false)
const total = ref(0)
const queryParams = ref({ page_num: 1, page_size: 10 })

const tableWrap = ref<HTMLElement>()
const { tableHeight, measure } = useTableAutoHeight(tableWrap)

async function fetchList() {
  loading.value = true
  const page = await fetchProfiles({ page_num: queryParams.value.page_num, page_size: queryParams.value.page_size })
  loading.value = false
  if (!page)
    return
  rows.value = page.list || []
  total.value = page.total || 0
  await nextTick()
  measure()
}

onMounted(fetchList)

function handlePageChange(page: number) {
  queryParams.value.page_num = page
  fetchList()
}

// 改每页条数必须同时回到第 1 页：原本停在第 3 页、条数改成 50 时往往已超出新的总页数，
// 后端返回空列表，看起来像"数据没了"。
function handlePageSizeChange(size: number) {
  queryParams.value.page_size = size
  queryParams.value.page_num = 1
  fetchList()
}

async function handleDelete(record: ConcProfileRow) {
  const res = await deleteProfiles([record.id])
  if (!res)
    return
  Message.success('已删除并发 profile（历史基线与判定结果保留）')
  if (rows.value.length === 1 && queryParams.value.page_num > 1)
    queryParams.value.page_num -= 1
  fetchList()
}

// ── 基线明细抽屉 ──────────────────────────────
const detailVisible = ref(false)
const detailLoading = ref(false)
const detailProfileId = ref('')
const detailSummary = ref('')
const detailRows = ref<ConcBaselineRow[]>([])

async function handleViewDetail(record: ConcProfileRow) {
  detailProfileId.value = record.id
  detailSummary.value = profileSummary(record)
  detailVisible.value = true
  detailLoading.value = true
  detailRows.value = []
  const list = await fetchBaselines(record.id)
  detailLoading.value = false
  if (!list)
    return
  detailRows.value = list
}

const columns: TableColumnData[] = withTableDefaults([
  { title: '脚本名', dataIndex: 'script_name', width: 220, fixed: 'left' as const },
  { title: '并发数', dataIndex: 'threads', width: 90, align: 'center' as const },
  { title: '爬坡/稳态', dataIndex: 'steady_sec', width: 170, slotName: 'window' },
  { title: '硬件签名', dataIndex: 'hw_signature', width: 110, slotName: 'hw' },
  { title: '来源 run', dataIndex: 'source_run_id', width: 110, slotName: 'source_run' },
  { title: '基线事务数', dataIndex: 'baseline_txn_count', width: 110, align: 'center' as const },
  { title: '操作', dataIndex: 'actions', width: 130, slotName: 'actions', fixed: 'right' as const },
])

const detailColumns: TableColumnData[] = withTableDefaults([
  { title: '事务', dataIndex: 'txn_code', width: 240, fixed: 'left' as const },
  { title: 'P95(ms)', dataIndex: 'p95_ms', width: 110, slotName: 'p95' },
  { title: '均值(ms)', dataIndex: 'avg_ms', width: 110, slotName: 'avg' },
  { title: 'TPS', dataIndex: 'tps', width: 100, slotName: 'tps' },
  { title: '错误率', dataIndex: 'error_pct', width: 100, slotName: 'error_pct' },
  { title: 'cpu/事务TPS', dataIndex: 'cpu_per_tps', width: 130, slotName: 'cpu' },
  { title: '来源 run', dataIndex: 'source_run_id', width: 110, slotName: 'source_run' },
  { title: '确认人', dataIndex: 'confirmed_by', width: 110, slotName: 'confirmed_by' },
  { title: '确认时间', dataIndex: 'confirmed_at', width: 160, slotName: 'confirmed_at' },
])
</script>

<template>
  <div class="conc-base">
    <div class="conc-base-bar">
      <span class="conc-base-tip">
        并发 profile 是脚本的固化执行条件（并发数、爬坡+稳态、硬件档位）；并发基准任务按它下发参数。
      </span>
      <a-button size="small" :loading="loading" @click="fetchList">
        刷新
      </a-button>
    </div>

    <div ref="tableWrap">
      <a-table
        :columns="columns"
        :data="rows"
        :loading="loading"
        row-key="id"
        :scroll="{ x: 1000, y: tableHeight }"
        :pagination="{
          total,
          current: queryParams.page_num,
          pageSize: queryParams.page_size,
          showTotal: true,
          showPageSize: true,
          pageSizeOptions: [10, 20, 50],
        }"
        @page-change="handlePageChange"
        @page-size-change="handlePageSizeChange"
      >
        <template #window="{ record }">
          爬坡 {{ record.rampup_sec }}s · 稳态 {{ record.steady_sec }}s
        </template>
        <template #hw="{ record }">
          <a-tooltip :content="record.hw_signature">
            <span>{{ hwShort(record.hw_signature) }}</span>
          </a-tooltip>
        </template>
        <template #source_run="{ record }">
          <a-tooltip :content="record.source_run_id">
            <span>{{ idShort(record.source_run_id) }}</span>
          </a-tooltip>
        </template>
        <template #actions="{ record }">
          <a-button type="text" size="small" @click="handleViewDetail(record)">
            明细
          </a-button>
          <a-popconfirm
            content="删除该脚本的并发 profile？历史基线与判定结果会保留，但该脚本将无法再触发并发基准。"
            @ok="handleDelete(record)"
          >
            <a-button type="text" size="small" status="danger">
              删除
            </a-button>
          </a-popconfirm>
        </template>
      </a-table>
    </div>

    <!-- 基线明细（baseline/list） -->
    <a-drawer
      v-model:visible="detailVisible"
      :width="900"
      :title="`并发基线明细 - ${idShort(detailProfileId)}`"
    >
      <div class="conc-base-sum">
        {{ detailSummary }}
      </div>
      <a-table
        :columns="detailColumns"
        :data="detailRows"
        :loading="detailLoading"
        :pagination="false"
        row-key="id"
        size="small"
        :scroll="{ x: 1100 }"
      >
        <template #p95="{ record }">
          {{ fmtMs(record.p95_ms) }}
        </template>
        <template #avg="{ record }">
          {{ fmtMs(record.avg_ms) }}
        </template>
        <template #tps="{ record }">
          {{ fmtTps(record.tps) }}
        </template>
        <template #error_pct="{ record }">
          {{ fmtErrorPct(record.error_pct) }}
        </template>
        <template #cpu="{ record }">
          {{ fmtCpuPerTps(record.cpu_per_tps) }}
        </template>
        <template #source_run="{ record }">
          <a-tooltip :content="record.source_run_id">
            <span>{{ idShort(record.source_run_id) }}</span>
          </a-tooltip>
        </template>
        <template #confirmed_by="{ record }">
          <a-tooltip :content="record.confirmed_by">
            <span>{{ idShort(record.confirmed_by) }}</span>
          </a-tooltip>
        </template>
        <template #confirmed_at="{ record }">
          {{ formatTime(record.confirmed_at) }}
        </template>
      </a-table>
    </a-drawer>
  </div>
</template>

<style scoped>
.conc-base-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.conc-base-tip {
  color: var(--color-text-3);
  font-size: 12px;
}

.conc-base-sum {
  margin-bottom: 12px;
  color: var(--color-text-2);
  font-size: 13px;
}
</style>
