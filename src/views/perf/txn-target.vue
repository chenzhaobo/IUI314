<script lang="ts" setup>
import { ref, computed } from 'vue'
import { Message } from '@arco-design/web-vue'
import { useGet, usePut } from '@/hooks'
import { ApiPerfBenchmark } from '@/api/apis'

defineOptions({ name: 'txn-target' })

// ── 列表查询 ──────────────────────────────────
const queryParams = ref({
  page_num: 1,
  page_size: 20,
  cloud: '',
  app: '',
  domain: '',
  keyword: '',
})

const { isFetching: isLoading, data: rawListData, execute: getList } = useGet<any>(
  ApiPerfBenchmark.targetList,
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

// ── 下拉选项（从列表数据中提取去重值） ──────────────────────────────────
const allClouds = computed(() => {
  const set = new Set<string>()
  dataList.value.forEach((r: any) => { if (r.cloud) set.add(r.cloud) })
  return Array.from(set).map(v => ({ label: v, value: v }))
})
const allApps = computed(() => {
  const set = new Set<string>()
  dataList.value.forEach((r: any) => { if (r.app) set.add(r.app) })
  return Array.from(set).map(v => ({ label: v, value: v }))
})
const allDomains = computed(() => {
  const set = new Set<string>()
  dataList.value.forEach((r: any) => { if (r.domain) set.add(r.domain) })
  return Array.from(set).map(v => ({ label: v, value: v }))
})

// ── 编辑目标值 ──────────────────────────────────
const editVisible = ref(false)
const editForm = ref({ id: '', target_value_sec: 0 })
const { execute: doUpdate, isFetching: updating } = usePut(ApiPerfBenchmark.updateTarget, editForm)

async function handleSaveEdit() {
  if (!editForm.value.target_value_sec || editForm.value.target_value_sec <= 0) {
    Message.warning('请输入有效的目标值')
    return
  }
  // 前端秒 → 后端毫秒
  await doUpdate({
    id: editForm.value.id,
    target_value_ms: editForm.value.target_value_sec * 1000,
  })
  Message.success('目标值已更新')
  editVisible.value = false
  getList()
}

function handleEdit(record: any) {
  editForm.value = {
    id: record.id,
    target_value_sec: record.target_value_ms ? Number((record.target_value_ms / 1000).toFixed(1)) : 0,
  }
  editVisible.value = true
}

// ── 工具函数 ──────────────────────────────────
function fmtSec(ms?: number | null): string {
  if (ms === null || ms === undefined) return '-'
  return (ms / 1000).toFixed(1)
}

function fmtTime(time?: string | null): string {
  if (!time) return '-'
  return time.replace('T', ' ').substring(0, 19)
}

const columns = [
  { title: '事务编码', dataIndex: 'txn_code', width: 150, ellipsis: true, tooltip: true, fixed: 'left' as const },
  { title: '事务全称', dataIndex: 'txn_name', width: 250, ellipsis: true, tooltip: true },
  { title: '云', dataIndex: 'cloud', width: 100, ellipsis: true, tooltip: true },
  { title: '应用', dataIndex: 'app', width: 100, ellipsis: true, tooltip: true },
  { title: '领域', dataIndex: 'domain', width: 100, ellipsis: true, tooltip: true },
  { title: '菜单', dataIndex: 'menu', width: 120, ellipsis: true, tooltip: true },
  { title: '目标值(秒)', dataIndex: 'target_value_ms', width: 100, align: 'center' as const, slotName: 'target_value' },
  { title: '比对值(秒)', dataIndex: 'baseline_value_ms', width: 100, align: 'center' as const, slotName: 'baseline_value' },
  { title: '比对值更新迭代', dataIndex: 'baseline_iteration_name', width: 140, ellipsis: true, tooltip: true },
  { title: '比对值更新时间', dataIndex: 'baseline_updated_at', width: 160, slotName: 'baseline_updated_at' },
  { title: '来源', dataIndex: 'source', width: 80, align: 'center' as const },
  { title: '操作', key: 'action', width: 80, align: 'center' as const, slotName: 'action', fixed: 'right' as const },
]
</script>

<template>
  <div class="page-container">
    <!-- 搜索栏 -->
    <a-card :bordered="false" class="mb-12px">
      <a-row :gutter="12">
        <a-col :span="5">
          <a-select v-model="queryParams.cloud" :options="allClouds" placeholder="云" allow-search allow-clear />
        </a-col>
        <a-col :span="5">
          <a-select v-model="queryParams.app" :options="allApps" placeholder="应用" allow-search allow-clear />
        </a-col>
        <a-col :span="5">
          <a-select v-model="queryParams.domain" :options="allDomains" placeholder="领域" allow-search allow-clear />
        </a-col>
        <a-col :span="5">
          <a-input v-model="queryParams.keyword" placeholder="事务编码/名称" allow-clear @press-enter="handleSearch" />
        </a-col>
        <a-col :span="4">
          <a-space>
            <a-button type="primary" @click="handleSearch">查询</a-button>
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
        <template #target_value="{ record }">{{ fmtSec(record.target_value_ms) }}</template>
        <template #baseline_value="{ record }">{{ fmtSec(record.baseline_value_ms) }}</template>
        <template #baseline_updated_at="{ record }">{{ fmtTime(record.baseline_updated_at) }}</template>
        <template #action="{ record }">
          <a-button type="text" size="small" @click="handleEdit(record)">编辑</a-button>
        </template>
      </a-table>
    </a-card>

    <!-- 编辑目标值弹窗 -->
    <a-modal v-model:visible="editVisible" title="编辑目标值" @ok="handleSaveEdit" :ok-loading="updating">
      <a-form :model="editForm" layout="vertical">
        <a-form-item label="目标值（秒）" required>
          <a-input-number
            v-model="editForm.target_value_sec"
            :min="0"
            :step="0.1"
            :precision="1"
            placeholder="请输入目标值（秒）"
            style="width: 100%"
          />
        </a-form-item>
        <a-alert type="info">目标值表示事务的达标阈值，单位为秒。如 2.0 秒表示该事务平均耗时应在 2 秒以内。</a-alert>
      </a-form>
    </a-modal>
  </div>
</template>
