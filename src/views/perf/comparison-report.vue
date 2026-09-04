<script lang="ts" setup>
import { ref, computed } from 'vue'
import { Message } from '@arco-design/web-vue'
import { useRouter } from 'vue-router'
import { deleteAction, formatTime, useGet } from '@/hooks'
import { ApiPerfComparison, ApiSysDictData, ApiPerfModule } from '@/api/apis'

defineOptions({ name: 'comparison-report' })

const router = useRouter()

// ── 产品线字典 ──────────────────────────────────
const { data: domainDictRaw } = useGet<any>(ApiSysDictData.getByType, { dict_type: 'sec_pg_product_domain' }, { immediate: true })
const domainOptions = computed(() => (Array.isArray(domainDictRaw.value) ? domainDictRaw.value : []).map((d: any) => ({ label: d.dict_label, value: d.dict_value })))

// ── 业务领域字典 ──────────────────────────────────
const { data: bizDomainDictRaw } = useGet<any>(ApiSysDictData.getByType, { dict_type: 'sec_pg_business_area' }, { immediate: true })
const bizDomainOptions = computed(() => (Array.isArray(bizDomainDictRaw.value) ? bizDomainDictRaw.value : []).map((d: any) => ({ label: d.dict_label, value: d.dict_value })))

// ── 云选项 ──────────────────────────────────
const { data: cloudRaw } = useGet<string[]>(ApiPerfModule.cloudOptions, {}, { immediate: true })
const cloudOptions = computed(() => (Array.isArray(cloudRaw.value) ? cloudRaw.value : []).map((c: string) => ({ label: c, value: c })))

// ── 列表查询 ──────────────────────────────────
const queryParams = ref({
  page_num: 1,
  page_size: 20,
  domain_code: '',
  business_domain: '',
  cloud: '',
  app_code: '',
  project_group_id: '',
})

const { isFetching: isLoading, data: rawListData, execute: getList } = useGet<any>(
  ApiPerfComparison.getList,
  queryParams,
  { immediate: true },
)
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

// ── 新增比对 ──────────────────────────────────
function handleCreate() {
  router.push({ path: '/perf/report-group/comparison-report/create' })
}

// ── 查看详情 ──────────────────────────────────
function handleDetail(id: string) {
  router.push({ path: '/perf/report-group/comparison-report/detail', query: { id: id?.trim() || '' } })
}

// ── 删除比对记录 ──────────────────────────────
async function handleDelete(record: any) {
  const deleteId = record.id?.trim()
  if (!deleteId) {
    Message.error('记录ID为空，无法删除')
    return
  }
  const res = await deleteAction<any>(ApiPerfComparison.delete, { ids: [deleteId] })
  if (!res) return
  Message.success('删除成功')
  getList()
}

// ── 状态映射 ──────────────────────────────────
const overallStatusMap: Record<string, { color: string; text: string }> = {
  pass: { color: 'green', text: '通过' },
  warn: { color: 'red', text: '有劣化' },
}

const columns = [
  { title: '产品领域', dataIndex: 'domain_code', width: 100, ellipsis: true, tooltip: true },
  { title: '业务领域', dataIndex: 'business_domain', width: 100, ellipsis: true, tooltip: true },
  { title: '云', dataIndex: 'cloud', width: 80, ellipsis: true, tooltip: true },
  { title: '基线迭代', dataIndex: 'baseline_iteration_name', width: 160, ellipsis: true, tooltip: true },
  { title: '当前迭代', dataIndex: 'current_iteration_name', width: 160, ellipsis: true, tooltip: true },
  { title: '劣化', dataIndex: 'txn_regression_count', width: 70, align: 'center' as const },
  { title: '改善', dataIndex: 'txn_improvement_count', width: 70, align: 'center' as const },
  { title: '持平', dataIndex: 'txn_unchanged_count', width: 70, align: 'center' as const },
  { title: '新增', dataIndex: 'txn_new_count', width: 70, align: 'center' as const },
  { title: '移除', dataIndex: 'txn_removed_count', width: 70, align: 'center' as const },
  { title: '总体状态', dataIndex: 'overall_status', width: 100, align: 'center' as const, slotName: 'overall_status' },
  { title: '创建时间', dataIndex: 'created_at', width: 160, slotName: 'created_at' },
  { title: '操作', key: 'action', width: 140, align: 'center' as const, slotName: 'action', fixed: 'right' as const },
]
</script>

<template>
  <div class="page-container">
    <!-- 搜索栏 -->
    <a-card :bordered="false" class="mb-12px">
      <a-row :gutter="12" align="center">
        <a-col :span="4">
          <a-select v-model="queryParams.domain_code" :options="domainOptions" placeholder="产品领域" allow-search allow-clear />
        </a-col>
        <a-col :span="4">
          <a-select v-model="queryParams.business_domain" :options="bizDomainOptions" placeholder="业务领域" allow-search allow-clear />
        </a-col>
        <a-col :span="4">
          <a-select v-model="queryParams.cloud" :options="cloudOptions" placeholder="云" allow-search allow-clear />
        </a-col>
        <a-col :span="8">
          <a-space>
            <a-button type="primary" @click="handleSearch">查询</a-button>
            <a-button type="primary" status="success" @click="handleCreate">新增比对</a-button>
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
        :scroll="{ x: 1500 }"
        @page-change="handlePageChange"
      >
        <template #overall_status="{ record }">
          <a-tag :color="(overallStatusMap[record.overall_status]?.color) || 'gray'">
            {{ overallStatusMap[record.overall_status]?.text || record.overall_status || '-' }}
          </a-tag>
        </template>
        <template #created_at="{ record }">{{ formatTime(record.created_at) }}</template>
        <template #action="{ record }">
          <a-space>
            <a-button type="text" size="small" @click="handleDetail(record.id)">详情</a-button>
            <a-popconfirm content="确认删除？删除后不可恢复" @ok="handleDelete(record)">
              <a-button type="text" size="small" status="danger">删除</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </a-table>
    </a-card>
  </div>
</template>
