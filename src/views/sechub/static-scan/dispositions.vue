<script lang="ts" setup>
/**
 * 问题处置管理 — Disposition CRUD + 状态转换 + 修复提交
 */
import { computed, ref } from 'vue'
import { Message } from '@arco-design/web-vue'
import { useGet, usePost } from '@/hooks'
import { ApiSecDisposition, ApiSecFix } from '@/api/sechubApis'

defineOptions({ name: 'StaticScanDispositions' })

// ── 查询 ──────────────────────────────────────────
const queryParams = ref<Record<string, any>>({
  page_num: 1,
  page_size: 10,
  finding_id: '',
  campaign_id: '',
  status: '',
  kind: '',
})

const { isFetching: loading, data: rawData, execute: refresh } = useGet<any>(ApiSecDisposition.getList, queryParams, { immediate: true })

const dataList = computed(() => rawData.value?.list || [])
const total = computed(() => rawData.value?.total || 0)

const kindOptions = [
  { label: '必须修复', value: 'must_fix' },
  { label: '不处理申请', value: 'no_fix_requested' },
  { label: '重复申请', value: 'duplicate_requested' },
  { label: '延期申请', value: 'deferred_requested' },
]

const statusOptions = [
  { label: '新建', value: 'new' },
  { label: '必须修复', value: 'must_fix' },
  { label: '已指派', value: 'assigned' },
  { label: '修复中', value: 'fixing' },
  { label: '已提交修复', value: 'fix_submitted' },
  { label: '验证中', value: 'verifying' },
  { label: '验证已修复', value: 'verified_fixed' },
  { label: '已关闭', value: 'closed' },
  { label: '待领域审批', value: 'pending_domain_approval' },
  { label: '批准不处理', value: 'approved_no_fix' },
  { label: '拒绝转修复', value: 'rejected_to_fix' },
]

const statusColorMap: Record<string, string> = {
  new: 'gray',
  must_fix: 'red',
  assigned: 'blue',
  fixing: 'orangered',
  fix_submitted: 'orange',
  verifying: 'purple',
  verified_fixed: 'cyan',
  closed: 'green',
  pending_domain_approval: 'gold',
  approved_no_fix: 'lime',
  rejected_to_fix: 'magenta',
}

// ── 创建处置 ──────────────────────────────────────
const formVisible = ref(false)
const formLoading = ref(false)
const formData = ref<Record<string, any>>({
  finding_id: '',
  kind: 'must_fix',
  reason_code: '',
  reason: '',
  impact: '',
  campaign_id: '',
  assignee_id: '',
  severity_confirmed: '',
})

function openCreate() {
  formData.value = { finding_id: '', kind: 'must_fix', reason_code: '', reason: '', impact: '', campaign_id: '', assignee_id: '', severity_confirmed: '' }
  formVisible.value = true
}

const { execute: doAdd } = usePost(ApiSecDisposition.add, formData, { immediate: false })

async function submitForm() {
  formLoading.value = true
  try {
    await doAdd()
    Message.success('创建成功')
    formVisible.value = false
    refresh()
  }
  catch (e: any) {
    Message.error(e?.message || '创建失败')
  }
  finally {
    formLoading.value = false
  }
}

// ── 状态操作 ──────────────────────────────────────
async function postAction(url: string, payload: Record<string, any>) {
  const request = usePost(url, payload, { immediate: false })
  await request.execute()
  if (request.error.value)
    throw new Error(String(request.error.value))
  return request.data.value
}

async function handleAction(action: string, row: any) {
  try {
    if (action === 'assign') {
      await postAction(ApiSecDisposition.assign, { id: row.id, assignee_id: row.assignee_id || '', due_at: row.due_at, version: row.version })
    }
    else if (action === 'start_fix') {
      await postAction(ApiSecDisposition.startFix, { id: row.id })
    }
    else if (action === 'close') {
      await postAction(ApiSecDisposition.close, { id: row.id })
    }
    else if (action === 'reopen') {
      await postAction(ApiSecDisposition.reopen, { id: row.id })
    }
    Message.success('操作成功')
    refresh()
  }
  catch (e: any) {
    Message.error(e?.message || '操作失败')
  }
}

// ── 修复提交子表 ──────────────────────────────────
const fixVisible = ref(false)
const fixList = ref<any[]>([])
const currentFindingId = ref('')

async function showFixes(row: any) {
  currentFindingId.value = row.finding_id
  const request = useGet<any>(ApiSecFix.submissions, { finding_id: row.finding_id }, { immediate: false })
  await request.execute()
  const res = request.data.value
  fixList.value = Array.isArray(res) ? res : []
  fixVisible.value = true
}

// ── 分页 ──────────────────────────────────────────
function onPageChange(page: number) {
  queryParams.value.page_num = page
  refresh()
}

function onSearch() {
  queryParams.value.page_num = 1
  refresh()
}
</script>

<template>
  <div class="p-4">
    <a-card title="问题处置">
      <template #extra>
        <a-button type="primary" size="small" data-testid="btn-create-disposition" @click="openCreate">
          新建处置
        </a-button>
      </template>

      <!-- 筛选栏 -->
      <div class="mb-4 flex flex-wrap gap-3">
        <a-input v-model="queryParams.finding_id" placeholder="Finding ID" allow-clear style="width: 200px" @press-enter="onSearch" />
        <a-input v-model="queryParams.campaign_id" placeholder="Campaign ID" allow-clear style="width: 200px" @press-enter="onSearch" />
        <a-select v-model="queryParams.kind" placeholder="处置类型" allow-clear style="width: 150px" :options="kindOptions" @change="onSearch" />
        <a-select v-model="queryParams.status" placeholder="状态" allow-clear style="width: 150px" :options="statusOptions" @change="onSearch" />
        <a-button type="primary" size="small" @click="onSearch">
          查询
        </a-button>
      </div>

      <!-- 表格 -->
      <a-table :data="dataList" :loading="loading" :pagination="{ total, current: queryParams.page_num, pageSize: queryParams.page_size }" row-key="id" @page-change="onPageChange">
        <template #columns>
          <a-table-column title="Finding ID" data-index="finding_id" :width="140" ellipsis />
          <a-table-column title="类型" data-index="kind" :width="110">
            <template #cell="{ record }">
              {{ kindOptions.find(k => k.value === record.kind)?.label || record.kind }}
            </template>
          </a-table-column>
          <a-table-column title="状态" data-index="status" :width="120">
            <template #cell="{ record }">
              <a-tag :color="statusColorMap[record.status] || 'gray'">
                {{ statusOptions.find(s => s.value === record.status)?.label || record.status }}
              </a-tag>
            </template>
          </a-table-column>
          <a-table-column title="责任人" data-index="assignee_id" :width="120" ellipsis />
          <a-table-column title="期限" data-index="due_at" :width="160" />
          <a-table-column title="操作" :width="260" fixed="right">
            <template #cell="{ record }">
              <a-space>
                <a-button v-if="record.status === 'must_fix' || record.status === 'reopened' || record.status === 'rejected_to_fix'" size="mini" type="primary" data-testid="btn-assign" @click="handleAction('assign', record)">
                  指派
                </a-button>
                <a-button v-if="record.status === 'assigned'" size="mini" data-testid="btn-start-fix" @click="handleAction('start_fix', record)">
                  开始修复
                </a-button>
                <a-button v-if="record.status === 'verified_fixed' || record.status === 'closure_candidate'" size="mini" status="success" data-testid="btn-close" @click="handleAction('close', record)">
                  关闭
                </a-button>
                <a-button v-if="record.status === 'verification_failed'" size="mini" status="warning" data-testid="btn-reopen" @click="handleAction('reopen', record)">
                  重新打开
                </a-button>
                <a-button size="mini" type="outline" @click="showFixes(record)">
                  修复记录
                </a-button>
              </a-space>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </a-card>

    <!-- 创建处置弹窗 -->
    <a-modal v-model:visible="formVisible" title="新建处置决定" :ok-loading="formLoading" @ok="submitForm">
      <a-form :model="formData" layout="vertical">
        <a-form-item label="Finding ID" required>
          <a-input v-model="formData.finding_id" placeholder="关联的 Finding ID" data-testid="form-finding-id" />
        </a-form-item>
        <a-form-item label="处置类型" required>
          <a-select v-model="formData.kind" :options="kindOptions" data-testid="form-kind" />
        </a-form-item>
        <a-form-item label="原因代码">
          <a-input v-model="formData.reason_code" placeholder="如: false_positive" />
        </a-form-item>
        <a-form-item label="原因说明">
          <a-textarea v-model="formData.reason" placeholder="详细说明" />
        </a-form-item>
        <a-form-item label="影响说明">
          <a-textarea v-model="formData.impact" placeholder="不处理的影响（非修复必填）" />
        </a-form-item>
        <a-form-item label="责任人ID">
          <a-input v-model="formData.assignee_id" placeholder="修复责任人（must_fix 必填）" />
        </a-form-item>
        <a-form-item label="确认严重度">
          <a-input v-model="formData.severity_confirmed" placeholder="如: high/medium/low" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 修复记录弹窗 -->
    <a-modal v-model:visible="fixVisible" title="修复提交记录" :footer="false" width="700px">
      <a-table :data="fixList" :pagination="false" row-key="id" size="small">
        <template #columns>
          <a-table-column title="Commit SHA" data-index="commit_sha" :width="120" ellipsis />
          <a-table-column title="修复说明" data-index="fix_message" ellipsis />
          <a-table-column title="验证状态" data-index="verification_status" :width="100">
            <template #cell="{ record }">
              <a-tag :color="record.verification_status === 'fixed' ? 'green' : record.verification_status === 'still_present' ? 'red' : 'gray'">
                {{ record.verification_status }}
              </a-tag>
            </template>
          </a-table-column>
          <a-table-column title="提交时间" data-index="created_at" :width="160" />
        </template>
      </a-table>
    </a-modal>
  </div>
</template>
