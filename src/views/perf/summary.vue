<script lang="ts" setup>
import { ref, computed } from 'vue'
import { Message, type TableColumnData } from '@arco-design/web-vue'
import { useGet, usePost } from '@/hooks'
import { ApiPerfSummary, ApiPerfIteration } from '@/api/apis'

defineOptions({ name: 'summary' })

// ── 迭代列表（下拉用） ──────────────────────────────────
const { data: iterData } = useGet<any>(ApiPerfIteration.getList, { page_num: 1, page_size: 100 }, { immediate: true })
const iterOptions = computed(() => iterData.value?.list?.map((i: any) => ({ label: i.name, value: i.id })) || [])

// ── 汇总列表 ──────────────────────────────────
const queryParams = ref({
  page_num: 1,
  page_size: 10,
  iteration_id: '',
  domain_code: '',
})
const { isFetching: isLoading, data: rawListData, execute: getList } = useGet<any>(ApiPerfSummary.getList, queryParams, { immediate: true })
const dataList = computed(() => rawListData.value?.list || [])
const total = computed(() => rawListData.value?.total || 0)

function handleSearch() {
  queryParams.value.page_num = 1
  getList()
}
function handlePageChange(page: number) {
  queryParams.value.page_num = page
  getList()
}

// ── 生成汇总弹窗 ──────────────────────────────────
const genVisible = ref(false)
const genForm = ref({ iteration_id: '', domain_code: '' })
const { execute: doGenerate, isFetching: genLoading } = usePost(ApiPerfSummary.generate, genForm)

async function handleGenerate() {
  if (!genForm.value.iteration_id) {
    Message.warning('请选择迭代')
    return
  }
  await doGenerate()
  Message.success('汇总生成成功')
  genVisible.value = false
  getList()
}

// ── 查看详情 ──────────────────────────────────
const detailVisible = ref(false)
const detailData = ref<any>(null)
const txnList = computed(() => detailData.value?.key_txn_json || [])
const detailQuery = ref({ id: '' })
const { data: detailRaw, execute: fetchDetail } = useGet<any>(ApiPerfSummary.getById, detailQuery, { immediate: false })

async function handleDetail(id: string) {
  detailQuery.value.id = id
  await fetchDetail()
  detailData.value = detailRaw.value ?? null
  detailVisible.value = true
}

const statusMap: Record<string, { color: string; text: string }> = {
  pass: { color: 'green', text: '通过' },
  fail: { color: 'red', text: '失败' },
}

const columns: TableColumnData[] = [
  { title: '迭代', dataIndex: 'iteration_name', width: 160, ellipsis: true, tooltip: true },
  { title: '领域', dataIndex: 'domain_name', width: 120, ellipsis: true, tooltip: true },
  { title: '脚本总数', dataIndex: 'total_scripts', width: 90, align: 'center' },
  { title: '成功', dataIndex: 'success_count', width: 70, align: 'center' },
  { title: '失败', dataIndex: 'failed_count', width: 70, align: 'center' },
  { title: '关键事务数', dataIndex: 'key_txn_count', width: 100, align: 'center' },
  { title: '通过/失败', width: 100, align: 'center', slotName: 'txn' },
  { title: '平均响应(ms)', dataIndex: 'avg_response_ms', width: 120, align: 'right', render: ({ record }: any) => record.avg_response_ms?.toFixed(1) || '-' },
  { title: 'P95(ms)', dataIndex: 'avg_p95_ms', width: 100, align: 'right', render: ({ record }: any) => record.avg_p95_ms?.toFixed(1) || '-' },
  { title: '错误率(%)', dataIndex: 'avg_error_pct', width: 100, align: 'right', render: ({ record }: any) => record.avg_error_pct?.toFixed(2) || '-' },
  { title: '吞吐量', dataIndex: 'avg_throughput', width: 100, align: 'right', render: ({ record }: any) => record.avg_throughput?.toFixed(2) || '-' },
  { title: '操作', width: 80, align: 'center', slotName: 'action' },
]

const txnColumns: TableColumnData[] = [
  { title: '事务编码', dataIndex: 'txn_code', width: 180, ellipsis: true, tooltip: true },
  { title: '事务名称', dataIndex: 'txn_name', width: 240, ellipsis: true, tooltip: true },
  { title: '平均(ms)', dataIndex: 'avg_ms', width: 100, align: 'right', render: ({ record }: any) => record.avg_ms?.toFixed(1) },
  { title: 'P95(ms)', dataIndex: 'p95_ms', width: 100, align: 'right', render: ({ record }: any) => record.p95_ms?.toFixed(1) },
  { title: '错误率(%)', dataIndex: 'error_pct', width: 100, align: 'right', render: ({ record }: any) => record.error_pct?.toFixed(2) },
  { title: '吞吐量', dataIndex: 'throughput', width: 100, align: 'right', render: ({ record }: any) => record.throughput?.toFixed(2) },
  { title: '状态', width: 80, align: 'center', slotName: 'success' },
]
</script>

<template>
  <div class="page-container">
    <!-- 搜索栏 -->
    <a-card :bordered="false" class="mb-12px">
      <a-row :gutter="12">
        <a-col :span="6">
          <a-select v-model="queryParams.iteration_id" placeholder="选择迭代" allow-clear @change="handleSearch">
            <a-option v-for="opt in iterOptions" :key="opt.value" :value="opt.value" :label="opt.label" />
          </a-select>
        </a-col>
        <a-col :span="6">
          <a-input v-model="queryParams.domain_code" placeholder="领域编码" allow-clear @press-enter="handleSearch" />
        </a-col>
        <a-col :span="12">
          <a-space>
            <a-button type="primary" @click="handleSearch">查询</a-button>
            <a-button type="primary" status="success" @click="genVisible = true">生成汇总</a-button>
          </a-space>
        </a-col>
      </a-row>
    </a-card>

    <!-- 列表 -->
    <a-card :bordered="false">
<a-table
  column-resizable
        :columns="columns"
        :data="dataList"
        :loading="isLoading"
        :pagination="{
          total,
          current: queryParams.page_num,
          pageSize: queryParams.page_size,
          showTotal: true,
        }"
        row-key="id"
        @page-change="handlePageChange"
      >
        <template #txn="{ record }">
          <a-space>
            <a-tag color="green">{{ record.key_txn_pass }}</a-tag>
            <a-tag color="red">{{ record.key_txn_fail }}</a-tag>
          </a-space>
        </template>
        <template #action="{ record }">
          <a-button type="text" size="small" @click="handleDetail(record.id)">详情</a-button>
        </template>
      </a-table>
    </a-card>

    <!-- 生成汇总弹窗 -->
    <a-modal v-model:visible="genVisible" title="生成迭代汇总" @ok="handleGenerate" :ok-loading="genLoading">
      <a-form :model="genForm" layout="vertical">
        <a-form-item label="选择迭代" required>
          <a-select v-model="genForm.iteration_id" placeholder="请选择迭代">
            <a-option v-for="opt in iterOptions" :key="opt.value" :value="opt.value" :label="opt.label" />
          </a-select>
        </a-form-item>
        <a-form-item label="领域编码（可选）">
          <a-input v-model="genForm.domain_code" placeholder="留空则汇总所有领域" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 详情弹窗 -->
    <a-modal v-model:visible="detailVisible" title="汇总详情 - 关键事务" width="900px" :footer="false">
      <a-descriptions :column="4" bordered size="small" class="mb-12px">
        <a-descriptions-item label="脚本总数">{{ detailData?.total_scripts }}</a-descriptions-item>
        <a-descriptions-item label="成功数">{{ detailData?.success_count }}</a-descriptions-item>
        <a-descriptions-item label="失败数">{{ detailData?.failed_count }}</a-descriptions-item>
        <a-descriptions-item label="关键事务">{{ detailData?.key_txn_count }}</a-descriptions-item>
        <a-descriptions-item label="平均响应(ms)">{{ detailData?.avg_response_ms?.toFixed(1) }}</a-descriptions-item>
        <a-descriptions-item label="P95(ms)">{{ detailData?.avg_p95_ms?.toFixed(1) }}</a-descriptions-item>
        <a-descriptions-item label="错误率(%)">{{ detailData?.avg_error_pct?.toFixed(2) }}</a-descriptions-item>
        <a-descriptions-item label="吞吐量">{{ detailData?.avg_throughput?.toFixed(2) }}</a-descriptions-item>
      </a-descriptions>
      <a-table column-resizable :columns="txnColumns" :data="txnList" row-key="txn_code" :pagination="{ pageSize: 10 }" size="small">
        <template #success="{ record }">
          <a-tag :color="record.success ? 'green' : 'red'">{{ record.success ? '通过' : '失败' }}</a-tag>
        </template>
      </a-table>
    </a-modal>
  </div>
</template>
