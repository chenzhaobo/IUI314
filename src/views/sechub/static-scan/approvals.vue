<script lang="ts" setup>
/**
 * 非修复审批管理 — 领域架构师/总监审批
 */
import { computed, ref } from 'vue'
import { Message } from '@arco-design/web-vue'
import { useGet, usePost } from '@/hooks'
import { ErrorFlag } from '@/api/apis'
import { ApiSecApproval } from '@/api/sechubApis'

defineOptions({ name: 'StaticScanApprovals' })

// ── 查询 ──────────────────────────────────────────
const queryParams = ref<Record<string, any>>({
  page_num: 1,
  page_size: 10,
  status: '',
  finding_id: '',
})

const { isFetching: loading, data: rawData, execute: refresh } = useGet<any>(ApiSecApproval.getList, queryParams, { immediate: true })

const dataList = computed(() => rawData.value?.list || [])
const total = computed(() => rawData.value?.total || 0)

const statusOptions = [
  { label: '待领域审批', value: 'pending_domain_approval' },
  { label: '已批准', value: 'approved' },
  { label: '已拒绝', value: 'rejected' },
  { label: '已升级', value: 'escalated' },
  { label: '待总监审批', value: 'pending_director_approval' },
  { label: '总监批准', value: 'director_approved' },
  { label: '总监拒绝', value: 'director_rejected' },
]

const statusColorMap: Record<string, string> = {
  pending_domain_approval: 'gold',
  approved: 'green',
  rejected: 'red',
  escalated: 'orange',
  pending_director_approval: 'purple',
  director_approved: 'green',
  director_rejected: 'red',
}

// ── 审批操作 ──────────────────────────────────────
const decideVisible = ref(false)
const decideLoading = ref(false)
const decideType = ref<'domain' | 'director'>('domain')
const currentRow = ref<any>(null)
const decideForm = ref({ decision: 'approved', comment: '', escalate_reason: '' })

function openDomainDecide(row: any) {
  decideType.value = 'domain'
  currentRow.value = row
  decideForm.value = { decision: 'approved', comment: '', escalate_reason: '' }
  decideVisible.value = true
}

function openDirectorDecide(row: any) {
  decideType.value = 'director'
  currentRow.value = row
  decideForm.value = { decision: 'approved', comment: '', escalate_reason: '' }
  decideVisible.value = true
}

async function postAction(url: string, payload: Record<string, any>) {
  const request = usePost(url, payload, { immediate: false })
  await request.execute()
  // 业务错误(code≠200)时 error.value 不会被设置，但 data 会被置为 ErrorFlag，需一并检查，避免错误被吞掉后误报“审批完成”
  if (request.error.value || request.data.value === ErrorFlag)
    throw new Error(String(request.error.value || '审批请求失败'))
  return request.data.value
}

async function submitDecide() {
  decideLoading.value = true
  try {
    if (decideType.value === 'domain') {
      await postAction(ApiSecApproval.domainDecide, {
        id: currentRow.value.id,
        decision: decideForm.value.decision,
        comment: decideForm.value.comment,
        escalate_reason: decideForm.value.escalate_reason,
      })
    }
    else {
      await postAction(ApiSecApproval.directorDecide, {
        id: currentRow.value.id,
        decision: decideForm.value.decision,
        comment: decideForm.value.comment,
      })
    }
    Message.success('审批完成')
    decideVisible.value = false
    refresh()
  }
  catch (e: any) {
    Message.error(e?.message || '审批失败')
  }
  finally {
    decideLoading.value = false
  }
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
    <a-card title="非修复审批">
      <!-- 筛选栏 -->
      <div class="mb-4 flex flex-wrap gap-3">
        <a-input v-model="queryParams.finding_id" placeholder="Finding ID" allow-clear style="width: 200px" @press-enter="onSearch" />
        <a-select v-model="queryParams.status" placeholder="审批状态" allow-clear style="width: 160px" :options="statusOptions" @change="onSearch" />
        <a-button type="primary" size="small" @click="onSearch">
          查询
        </a-button>
      </div>

      <!-- 表格 -->
      <a-table :data="dataList" :loading="loading" :pagination="{ total, current: queryParams.page_num, pageSize: queryParams.page_size }" row-key="id" @page-change="onPageChange">
        <template #columns>
          <a-table-column title="Finding ID" data-index="finding_id" :width="140" ellipsis />
          <a-table-column title="申请人" data-index="requester_id" :width="120" ellipsis />
          <a-table-column title="状态" data-index="status" :width="130">
            <template #cell="{ record }">
              <a-tag :color="statusColorMap[record.status] || 'gray'">
                {{ statusOptions.find(s => s.value === record.status)?.label || record.status }}
              </a-tag>
            </template>
          </a-table-column>
          <a-table-column title="风险等级" data-index="risk_level" :width="90" />
          <a-table-column title="领域审批人" data-index="domain_approver_id" :width="120" ellipsis />
          <a-table-column title="总监审批人" data-index="director_approver_id" :width="120" ellipsis />
          <a-table-column title="申请时间" data-index="created_at" :width="160" />
          <a-table-column title="操作" :width="180" fixed="right">
            <template #cell="{ record }">
              <a-space>
                <a-button v-if="record.status === 'pending_domain_approval'" size="mini" type="primary" data-testid="btn-domain-decide" @click="openDomainDecide(record)">
                  领域审批
                </a-button>
                <a-button v-if="record.status === 'pending_director_approval'" size="mini" type="primary" status="warning" data-testid="btn-director-decide" @click="openDirectorDecide(record)">
                  总监审批
                </a-button>
              </a-space>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </a-card>

    <!-- 审批弹窗 -->
    <a-modal v-model:visible="decideVisible" :title="decideType === 'domain' ? '领域架构师审批' : '总监审批'" :ok-loading="decideLoading" @ok="submitDecide">
      <a-form :model="decideForm" layout="vertical">
        <a-form-item label="审批决定" required>
          <a-radio-group v-model="decideForm.decision" data-testid="decide-radio">
            <a-radio value="approved">
              批准
            </a-radio>
            <a-radio value="rejected">
              拒绝
            </a-radio>
            <a-radio v-if="decideType === 'domain'" value="escalated">
              升级总监
            </a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item v-if="decideType === 'domain' && decideForm.decision === 'escalated'" label="升级原因">
          <a-textarea v-model="decideForm.escalate_reason" placeholder="说明升级原因" />
        </a-form-item>
        <a-form-item label="审批意见">
          <a-textarea v-model="decideForm.comment" placeholder="可选" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>
