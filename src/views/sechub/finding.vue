<script lang="ts" setup>
import { computed, ref } from 'vue'
import { Message } from '@arco-design/web-vue'
import { ApiSecFinding } from '@/api/apis'
import { useGet, usePost, usePut } from '@/hooks'

defineOptions({ name: 'SecFinding' })

// ── 查询 ──────────────────────────────────────────
const queryParams = ref({
  page_num: 1,
  page_size: 10,
  keyword: '',
  severity: '',
  finding_status: '',
  tool_code: '',
})

const { isFetching: isLoading, data: rawListData, execute: getList } = useGet<any>(ApiSecFinding.getList, queryParams, { immediate: true })
const dataList = computed(() => rawListData.value?.list || [])
const total = computed(() => rawListData.value?.total || 0)

function handleSearch() {
  queryParams.value.page_num = 1
  getList()
}

// ── Triage ────────────────────────────────────────
const triageVisible = ref(false)
const triageForm = ref({ id: '', decision: 'confirmed', assignee_names: '' })
function openTriage(record: any) {
  triageForm.value = { id: record.id, decision: 'confirmed', assignee_names: '' }
  triageVisible.value = true
}
async function handleTriage() {
  const { execute, error } = usePut(ApiSecFinding.triage, triageForm)
  await execute()
  if (error.value) { Message.error('Triage失败'); return }
  Message.success('Triage完成')
  triageVisible.value = false
  getList()
}

// ── Reopen ────────────────────────────────────────
const reopenVisible = ref(false)
const reopenForm = ref({ id: '', run_id: '' })
function openReopen(record: any) {
  reopenForm.value = { id: record.id, run_id: '' }
  reopenVisible.value = true
}
async function handleReopen() {
  if (!reopenForm.value.run_id) { Message.warning('请输入关联Run ID'); return }
  const { execute, error } = usePut(ApiSecFinding.reopen, reopenForm)
  await execute()
  if (error.value) { Message.error('Reopen失败'); return }
  Message.success('已重新打开')
  reopenVisible.value = false
  getList()
}

// ── 手工新建 ──────────────────────────────────────
const manualVisible = ref(false)
const manualForm = ref<Record<string, any>>({})
function openManual() {
  manualForm.value = { tool_code: 'manual', severity: 'medium', title: '', vuln_type: '', description: '' }
  manualVisible.value = true
}
async function handleManual() {
  if (!manualForm.value.title) { Message.warning('请填写标题'); return }
  const { execute, error } = usePost(ApiSecFinding.manual, manualForm)
  await execute()
  if (error.value) { Message.error('创建失败'); return }
  Message.success('创建成功')
  manualVisible.value = false
  getList()
}

const severityOptions = [
  { label: '全部', value: '' },
  { label: '严重', value: 'critical' },
  { label: '高', value: 'high' },
  { label: '中', value: 'medium' },
  { label: '低', value: 'low' },
  { label: '信息', value: 'info' },
]
const statusOptions = [
  { label: '全部', value: '' },
  { label: '待处理', value: 'open' },
  { label: '分诊中', value: 'triaging' },
  { label: '已确认', value: 'confirmed' },
  { label: '已修复', value: 'fixed' },
  { label: '误报', value: 'false_positive' },
  { label: '已重开', value: 'reopened' },
]

const columns = [
  { title: '工具', dataIndex: 'tool_code', width: 80 },
  { title: '严重程度', dataIndex: 'severity', width: 80 },
  { title: '标题', dataIndex: 'title', width: 200, ellipsis: true, tooltip: true },
  { title: '漏洞类型', dataIndex: 'vuln_type', width: 120 },
  { title: '状态', dataIndex: 'finding_status', width: 80 },
  { title: '命中次数', dataIndex: 'hit_count', width: 80 },
  { title: '首次发现', dataIndex: 'first_seen_at', width: 160 },
  { title: '最近发现', dataIndex: 'last_seen_at', width: 160 },
  { title: '负责人', dataIndex: 'assignee_names', width: 100 },
  { title: '操作', slotName: 'operations', width: 200, fixed: 'right' as const },
]
</script>
<template>
  <div>
    <!-- 筛选 -->
    <a-card :bordered="false" class="m-b-8px">
      <a-row :gutter="16">
        <a-col :span="5">
          <a-input v-model="queryParams.keyword" placeholder="关键词搜索" allow-clear @press-enter="handleSearch" />
        </a-col>
        <a-col :span="4">
          <a-select v-model="queryParams.severity" :options="severityOptions" placeholder="严重程度" allow-clear @change="handleSearch" />
        </a-col>
        <a-col :span="4">
          <a-select v-model="queryParams.finding_status" :options="statusOptions" placeholder="状态" allow-clear @change="handleSearch" />
        </a-col>
        <a-col :span="4">
          <a-input v-model="queryParams.tool_code" placeholder="工具代码" allow-clear @press-enter="handleSearch" />
        </a-col>
        <a-col :span="4">
          <a-space>
            <a-button type="primary" @click="handleSearch">搜索</a-button>
            <a-button type="primary" status="success" @click="openManual">手工新建</a-button>
          </a-space>
        </a-col>
      </a-row>
    </a-card>
    <!-- 表格 -->
    <a-card :bordered="false">
      <a-table
        :loading="isLoading"
        :data="dataList"
        :columns="columns"
        :pagination="{ total, current: queryParams.page_num, pageSize: queryParams.page_size, showTotal: true }"
        row-key="id"
        @page-change="(p: number) => { queryParams.page_num = p; getList() }"
      >
        <template #operations="{ record }">
          <a-space>
            <a-button type="text" size="small" @click="openTriage(record)">Triage</a-button>
            <a-button type="text" size="small" status="warning" @click="openReopen(record)">Reopen</a-button>
          </a-space>
        </template>
      </a-table>
    </a-card>
    <!-- Triage 弹窗 -->
    <a-modal v-model:visible="triageVisible" title="Triage 人工判定" @ok="handleTriage">
      <a-form :model="triageForm" layout="vertical">
        <a-form-item label="判定结果">
          <a-select v-model="triageForm.decision">
            <a-option value="confirmed">确认</a-option>
            <a-option value="false_positive">误报</a-option>
            <a-option value="duplicated">重复</a-option>
            <a-option value="wontfix">不修复</a-option>
          </a-select>
        </a-form-item>
        <a-form-item label="负责人">
          <a-input v-model="triageForm.assignee_names" placeholder="负责人姓名" />
        </a-form-item>
      </a-form>
    </a-modal>
    <!-- Reopen 弹窗 -->
    <a-modal v-model:visible="reopenVisible" title="重新打开" @ok="handleReopen">
      <a-form :model="reopenForm" layout="vertical">
        <a-form-item label="关联Run ID" required>
          <a-input v-model="reopenForm.run_id" placeholder="请输入扫描Run ID" />
        </a-form-item>
      </a-form>
    </a-modal>
    <!-- 手工新建 弹窗 -->
    <a-modal v-model:visible="manualVisible" title="手工新建发现" :width="640" @ok="handleManual">
      <a-form :model="manualForm" layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12"><a-form-item label="工具代码"><a-input v-model="manualForm.tool_code" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="严重程度"><a-select v-model="manualForm.severity" :options="severityOptions.filter(o => o.value)" /></a-form-item></a-col>
          <a-col :span="24"><a-form-item label="标题" required><a-input v-model="manualForm.title" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="漏洞类型"><a-input v-model="manualForm.vuln_type" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="文件路径"><a-input v-model="manualForm.file_path" /></a-form-item></a-col>
          <a-col :span="24"><a-form-item label="描述"><a-textarea v-model="manualForm.description" :auto-size="{ minRows: 2, maxRows: 4 }" /></a-form-item></a-col>
        </a-row>
      </a-form>
    </a-modal>
  </div>
</template>
