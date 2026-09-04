<script lang="ts" setup>
import { computed, ref } from 'vue'
import { Message } from '@arco-design/web-vue'
import { ApiSecDefect } from '@/api/apis'
import { ApiSecApproval, ApiSecDisposition } from '@/api/sechubApis'
import { useGet, postAction, putAction, deleteAction, getAction } from '@/hooks'
import { useUserStore } from '@/stores'

defineOptions({ name: 'defect' })

const userStore = useUserStore()
// 负责人写入的是展示名，优先用昵称（扫码登录用户的账号是 kd_<金蝶uid>）
const currentUser = computed(() => userStore.user.nickname || userStore.user.name || userStore.user.uid || 'admin')

const queryParams = ref({ page_num: 1, page_size: 10, keyword: '', project_group_id: '' })
const { isFetching: isLoading, data: rawListData, execute: getList } = useGet<any>(ApiSecDefect.getList, queryParams, { immediate: true })
const dataList = computed(() => rawListData.value?.list || [])
const total = computed(() => rawListData.value?.total || 0)

// ── 新增/编辑 ──────────────────────────────────────
const modalVisible = ref(false)
const modalTitle = ref('')
const formData = ref<Record<string, any>>({})
const isEdit = ref(false)

function handleAdd() {
  isEdit.value = false
  modalTitle.value = '新增缺陷'
  formData.value = { defect_code: '', defect_title: '', defect_status: 'open', is_security: '1', priority: 'medium' }
  modalVisible.value = true
}
function handleEdit(record: any) {
  isEdit.value = true
  modalTitle.value = '编辑缺陷'
  formData.value = { ...record }
  modalVisible.value = true
}
async function handleSubmit() {
  if (!formData.value.defect_title) { Message.warning('请填写缺陷标题'); return }
  if (isEdit.value) {
    const res = await putAction(ApiSecDefect.edit, formData.value)
    if (!res) return
    Message.success('编辑成功')
  } else {
    const res = await postAction(ApiSecDefect.add, formData.value)
    if (!res) return
    Message.success('新增成功')
  }
  modalVisible.value = false
  getList()
}

// ── 从 Finding 创建 ────────────────────────────────
const fromFindingVisible = ref(false)
const findingId = ref('')
async function handleFromFinding() {
  if (!findingId.value) { Message.warning('请输入Finding ID'); return }
  const res = await postAction(ApiSecDefect.fromFinding, { finding_id: findingId.value })
  if (!res) return
  Message.success('从Finding创建缺陷成功')
  fromFindingVisible.value = false
  findingId.value = ''
  getList()
}

// ── 删除 ──────────────────────────────────────────
async function handleDelete(record: any) {
  const res = await deleteAction(ApiSecDefect.delete, { ids: [record.id] })
  if (!res) return
  Message.success('删除成功')
  getList()
}

// ── 详情（五要素） ────────────────────────────────
const detailVisible = ref(false)
const detailLoading = ref(false)
const detailData = ref<Record<string, any>>({})
async function handleDetail(record: any) {
  detailVisible.value = true
  detailLoading.value = true
  detailData.value = { ...record }
  const detail = await getAction<any>(ApiSecDefect.getById, { id: record.id })
  if (detail && typeof detail === 'object') detailData.value = detail
  detailLoading.value = false
}

// ── 认领 ──────────────────────────────────────────
async function handleClaim(record: any) {
  const payload = { ...record, assignee_names: currentUser.value, defect_status: 'processing' }
  const res = await putAction(ApiSecDefect.edit, payload)
  if (!res) return
  Message.success(`已认领，负责人：${currentUser.value}`)
  getList()
}

// ── 标记不处理（三类型+原因）→ 创建处置+审批 ─────────────
const nofixVisible = ref(false)
const nofixLoading = ref(false)
const nofixTarget = ref<any>(null)
const nofixForm = ref({ type: 'false_positive', reason: '' })
const nofixTypeOptions = [
  { label: '误报（false_positive）', value: 'false_positive' },
  { label: '现有最优方案（best_practice）', value: 'best_practice' },
  { label: '是问题但没必要改（not_necessary）', value: 'not_necessary' },
]
function openNofix(record: any) {
  nofixTarget.value = record
  nofixForm.value = { type: 'false_positive', reason: '' }
  nofixVisible.value = true
}
async function submitNofix() {
  const record = nofixTarget.value
  if (!record) return
  if (!nofixForm.value.reason) { Message.warning('请填写不处理原因'); return }
  if (!record.finding_id) { Message.error('该缺陷无关联 Finding，无法发起不处理审批'); return }
  nofixLoading.value = true
  try {
    const dispositionId = await postAction<string>(ApiSecDisposition.add, {
      finding_id: record.finding_id,
      kind: 'no_fix_requested',
      reason_code: nofixForm.value.type,
      reason: nofixForm.value.reason,
      assignee_id: record.assignee_names || currentUser.value,
    })
    if (!dispositionId) return
    const approval = await postAction(ApiSecApproval.create, {
      finding_id: record.finding_id,
      disposition_id: dispositionId,
      risk_level: record.priority || 'medium',
      evidence: nofixForm.value.reason,
    })
    if (!approval) return
    const updated = await putAction(ApiSecDefect.edit, { ...record, defect_status: 'wont_fix' })
    if (!updated) return
    Message.success('已标记不处理并发起审批，等待架构师审批')
    nofixVisible.value = false
    getList()
  }
  finally {
    nofixLoading.value = false
  }
}

const columns = [
  { title: '缺陷代码', dataIndex: 'defect_code', width: 120 },
  { title: '缺陷标题', dataIndex: 'defect_title', width: 200, ellipsis: true, tooltip: true },
  { title: '状态', dataIndex: 'defect_status', width: 80 },
  { title: '优先级', dataIndex: 'priority', width: 80 },
  { title: '项目组', dataIndex: 'project_group_name', width: 120 },
  { title: '模块路径', dataIndex: 'module_path', width: 160, ellipsis: true, tooltip: true },
  { title: '负责人', dataIndex: 'assignee_names', width: 100 },
  { title: '发现人', dataIndex: 'discoverer_names', width: 100 },
  { title: '安全缺陷', dataIndex: 'is_security', width: 80 },
  { title: '操作', slotName: 'operations', width: 240, fixed: 'right' as const },
]
</script>
<template>
  <div>
    <a-card :bordered="false" class="m-b-8px">
      <a-row :gutter="16">
        <a-col :span="6"><a-input v-model="queryParams.keyword" placeholder="搜索缺陷代码/标题" allow-clear @press-enter="() => { queryParams.page_num = 1; getList() }" /></a-col>
        <a-col :span="4"><a-input v-model="queryParams.project_group_id" placeholder="项目组ID" allow-clear @press-enter="() => { queryParams.page_num = 1; getList() }" /></a-col>
        <a-col :span="6">
          <a-space>
            <a-button type="primary" @click="() => { queryParams.page_num = 1; getList() }">搜索</a-button>
            <a-button type="primary" status="success" @click="handleAdd">新增缺陷</a-button>
            <a-button @click="fromFindingVisible = true">从Finding创建</a-button>
          </a-space>
        </a-col>
      </a-row>
    </a-card>
    <a-card :bordered="false">
      <a-table column-resizable :loading="isLoading" :data="dataList" :columns="columns" :pagination="{ total, current: queryParams.page_num, pageSize: queryParams.page_size, showTotal: true }" row-key="id" @page-change="(p: number) => { queryParams.page_num = p; getList() }">
        <template #operations="{ record }">
          <a-space>
            <a-button type="text" size="small" @click="handleDetail(record)">详情</a-button>
            <a-button v-if="!record.assignee_names" type="text" size="small" status="success" @click="handleClaim(record)">认领</a-button>
            <a-button type="text" size="small" status="warning" @click="openNofix(record)">不处理</a-button>
            <a-button type="text" size="small" @click="handleEdit(record)">编辑</a-button>
            <a-popconfirm content="确认删除？" @ok="handleDelete(record)">
              <a-button type="text" size="small" status="danger">删除</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </a-table>
    </a-card>
    <!-- 新增/编辑弹窗 -->
    <a-modal v-model:visible="modalVisible" :title="modalTitle" :width="640" @ok="handleSubmit">
      <a-form :model="formData" layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12"><a-form-item label="缺陷代码"><a-input v-model="formData.defect_code" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="缺陷状态"><a-select v-model="formData.defect_status"><a-option value="open">打开</a-option><a-option value="processing">处理中</a-option><a-option value="fixed">已修复</a-option><a-option value="verified">已验证</a-option><a-option value="wont_fix">不处理</a-option><a-option value="closed">已关闭</a-option></a-select></a-form-item></a-col>
          <a-col :span="24"><a-form-item label="缺陷标题" required><a-input v-model="formData.defect_title" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="优先级"><a-select v-model="formData.priority"><a-option value="critical">严重</a-option><a-option value="high">高</a-option><a-option value="medium">中</a-option><a-option value="low">低</a-option></a-select></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="安全缺陷"><a-select v-model="formData.is_security"><a-option value="1">是</a-option><a-option value="0">否</a-option></a-select></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="项目组ID"><a-input v-model="formData.project_group_id" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="发布窗口ID"><a-input v-model="formData.release_window_id" /></a-form-item></a-col>
          <a-col :span="24"><a-form-item label="模块路径"><a-input v-model="formData.module_path" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="负责人"><a-input v-model="formData.assignee_names" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="发现人"><a-input v-model="formData.discoverer_names" /></a-form-item></a-col>
          <a-col :span="24"><a-form-item label="描述"><a-textarea v-model="formData.description" :auto-size="{ minRows: 2, maxRows: 4 }" /></a-form-item></a-col>
        </a-row>
      </a-form>
    </a-modal>
    <!-- 从Finding创建弹窗 -->
    <a-modal v-model:visible="fromFindingVisible" title="从Finding创建缺陷" @ok="handleFromFinding">
      <a-form :model="{ findingId }" layout="vertical">
        <a-form-item label="Finding ID" required>
          <a-input v-model="findingId" placeholder="请输入已确认的Finding ID" />
        </a-form-item>
      </a-form>
    </a-modal>
    <!-- 缺陷详情弹窗（五要素） -->
    <a-modal v-model:visible="detailVisible" title="缺陷详情" :width="760" :footer="false">
      <a-spin :loading="detailLoading" style="width:100%">
        <a-descriptions :column="2" bordered size="small" class="m-b-12px">
          <a-descriptions-item label="缺陷代码">{{ detailData.defect_code }}</a-descriptions-item>
          <a-descriptions-item label="状态">{{ detailData.defect_status }}</a-descriptions-item>
          <a-descriptions-item label="优先级">{{ detailData.priority }}</a-descriptions-item>
          <a-descriptions-item label="负责人">{{ detailData.assignee_names || '未认领' }}</a-descriptions-item>
          <a-descriptions-item label="模块路径" :span="2">{{ detailData.module_path }}</a-descriptions-item>
        </a-descriptions>
        <a-typography-title :heading="6">缺陷标题</a-typography-title>
        <a-typography-paragraph>{{ detailData.defect_title }}</a-typography-paragraph>
        <a-divider style="margin:8px 0" />
        <a-typography-title :heading="6">① 描述</a-typography-title>
        <a-typography-paragraph>{{ detailData.description || '暂无' }}</a-typography-paragraph>
        <a-typography-title :heading="6">② 复现步骤</a-typography-title>
        <a-typography-paragraph>{{ detailData.description_repro || '暂无' }}</a-typography-paragraph>
        <a-typography-title :heading="6">③ 预期结果</a-typography-title>
        <a-typography-paragraph>{{ detailData.description_expect || '暂无' }}</a-typography-paragraph>
        <a-typography-title :heading="6">④ 根因</a-typography-title>
        <a-typography-paragraph>{{ detailData.description_root_cause || '暂无' }}</a-typography-paragraph>
        <a-typography-title :heading="6">⑤ 修复建议</a-typography-title>
        <a-typography-paragraph>{{ detailData.description_suggestion || '暂无' }}</a-typography-paragraph>
      </a-spin>
    </a-modal>
    <!-- 标记不处理弹窗 -->
    <a-modal v-model:visible="nofixVisible" title="标记不处理" :ok-loading="nofixLoading" @ok="submitNofix">
      <a-alert type="warning" class="m-b-12px">提交后将创建「不处理申请」并自动发起架构师审批，审批同意后问题将加入白名单。</a-alert>
      <a-form :model="nofixForm" layout="vertical">
        <a-form-item label="不处理类型" required>
          <a-select v-model="nofixForm.type" :options="nofixTypeOptions" />
        </a-form-item>
        <a-form-item label="原因说明" required>
          <a-textarea v-model="nofixForm.reason" :auto-size="{ minRows: 3, maxRows: 6 }" placeholder="请详细说明不处理的理由（将作为审批依据）" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>
