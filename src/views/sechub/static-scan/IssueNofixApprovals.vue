<script setup lang="ts">
/**
 * 缺陷「不处理」审批：领域架构师/总监单步审批。
 * 缺陷状态只有在同意后才变为 wont_fix；驳回/撤回保持待修复。
 */
import { Message } from '@arco-design/web-vue'
import { computed, ref } from 'vue'
import { ApiSecApproval, ApiSecGovernance } from '@/api/sechubApis'
import { ApiSysDictData } from '@/api/sysApis'
import { MdPreview } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'
import { formatTime, getAction, postAction, useGet } from '@/hooks'
import { useUserStore } from '@/stores'

const userStore = useUserStore()
const myUserId = computed(() => userStore.user?.uid ?? '')

interface ApprovalRow {
  id: string
  issue_id: string
  defect_code?: string | null
  issue_title: string
  requester_id: string
  requester_name: string
  project_group_name?: string | null
  product_domain?: string | null
  reason_code?: string | null
  reason: string
  impact_note?: string | null
  evidence?: string | null
  status: string
  approver_name?: string | null
  approver_role?: string | null
  decision_comment?: string | null
  created_at: string
  decided_at?: string | null
}

const { data: capabilityData, isFetching: capabilityLoading } = useGet<any>(ApiSecGovernance.me, {}, { immediate: true })
const capability = computed(() => capabilityData.value ?? {})
const { data: reasonDict } = useGet<any>(ApiSysDictData.getByType, { dict_type: 'static_scan_wont_fix_reason' }, { immediate: true })
const reasonLabelMap = computed(() => {
  const map: Record<string, string> = {}
  for (const item of (Array.isArray(reasonDict.value) ? reasonDict.value : []))
    map[item.dict_value] = item.dict_label
  return map
})
const capabilityDataLoaded = computed(() => !capabilityLoading.value && capabilityData.value != null)
const canApprove = computed(() => Boolean(capability.value.can_approve_issue_nofix))

const approverConfig = ref<{ approvers_configured?: boolean, director_configured?: boolean, domains_with_architect?: string[] }>({})
void getAction<any>(ApiSecApproval.issueApproverConfig).then((data) => {
  approverConfig.value = data ?? {}
})

const queryParams = ref({
  scope: 'mine',
  status: 'pending',
  product_domain: '',
  page_num: 1,
  page_size: 10,
})
const { data: rawData, execute: refresh, isFetching: loading } = useGet<any>(ApiSecApproval.issueList, queryParams, { immediate: true })
const dataList = computed<ApprovalRow[]>(() => rawData.value?.list ?? [])
const total = computed(() => rawData.value?.total ?? 0)

const statusOptions = [
  { label: '待审批', value: 'pending' },
  { label: '已通过', value: 'approved' },
  { label: '已驳回', value: 'rejected' },
  { label: '已撤回/失效', value: 'withdrawn' },
]
const statusLabels: Record<string, { label: string, color: string }> = {
  pending: { label: '待审批', color: 'gold' },
  approved: { label: '已通过', color: 'green' },
  rejected: { label: '已驳回', color: 'red' },
  withdrawn: { label: '已撤回', color: 'gray' },
}

function onSearch() {
  queryParams.value.page_num = 1
  refresh()
}

// ── 审批 ──────────────────────────────────────────
const selectedIds = ref<string[]>([])
const decideVisible = ref(false)
const decideLoading = ref(false)
const decideTargets = ref<ApprovalRow[]>([])
const decideReport = ref('')
const decideForm = ref({ decision: 'approved', comment: '' })

async function openDecide(rows: ApprovalRow[], decision = 'approved') {
  if (!rows.length) {
    Message.warning('请先勾选待审批记录')
    return
  }
  const pending = rows.filter(row => row.status === 'pending')
  if (!pending.length) {
    Message.warning('所选记录中没有待审批项')
    return
  }
  decideTargets.value = pending
  decideForm.value = { decision, comment: '' }
  decideReport.value = ''
  decideVisible.value = true
  if (pending.length === 1) {
    const detail = await getAction<any>(ApiSecApproval.issueGetById, { id: pending[0].id })
    if (detail?.ai_detail_report)
      decideReport.value = detail.ai_detail_report
  }
}

async function submitDecide() {
  if (!decideForm.value.comment.trim()) {
    Message.warning('审批意见必填')
    return
  }
  decideLoading.value = true
  try {
    if (decideTargets.value.length === 1) {
      const res = await postAction(ApiSecApproval.issueDecide, {
        id: decideTargets.value[0].id,
        decision: decideForm.value.decision,
        comment: decideForm.value.comment || null,
      })
      if (res === null)
        return
      Message.success(decideForm.value.decision === 'approved' ? '已通过，不处理申请生效' : '已驳回，缺陷保持待修复')
    }
    else {
      const res = await postAction<any>(ApiSecApproval.issueDecideBatch, {
        ids: decideTargets.value.map(row => row.id),
        decision: decideForm.value.decision,
        comment: decideForm.value.comment || null,
      })
      if (res === null)
        return
      Message.success(res.message || '批量审批完成')
      if (Array.isArray(res.errors) && res.errors.length)
        Message.warning(res.errors.slice(0, 3).join('；'))
    }
    decideVisible.value = false
    selectedIds.value = []
    refresh()
  }
  catch (error: any) {
    Message.error(error?.message || '审批失败')
  }
  finally {
    decideLoading.value = false
  }
}

const decisionText = computed(() => (decideForm.value.decision === 'approved' ? '同意' : '驳回'))
</script>

<template>
  <div>
    <a-alert v-if="approverConfig && approverConfig.approvers_configured === false" type="warning" class="mb-3">
      当前未配置任何不处理审批人（领域架构师或总监）。申请会保持待审批，请联系管理员在「项目组 → 项目组人员」中配置。
    </a-alert>

    <a-alert v-if="capabilityDataLoaded && !canApprove" type="info" class="mb-3">
      当前账号没有不处理审批权限。请在「项目组 → 项目组人员」中把自己配成领域架构师（覆盖对应产品领域）或总监；
      下方仍可查看全部待审批记录，但操作会被服务端拒绝。
    </a-alert>
    <div class="mb-3 flex flex-wrap items-center gap-2">
      <a-radio-group v-model="queryParams.scope" type="button" size="small" @change="onSearch">
        <a-radio value="mine">待我审批</a-radio>
        <a-radio value="">全部待审批</a-radio>
      </a-radio-group>
      <a-select v-model="queryParams.status" :options="statusOptions" placeholder="审批状态" allow-clear style="width: 140px" @change="onSearch" />
      <a-input v-model="queryParams.product_domain" placeholder="产品领域" allow-clear style="width: 160px" @press-enter="onSearch" />
      <a-button type="primary" size="small" @click="onSearch">
        查询
      </a-button>
      <a-divider direction="vertical" />
      <a-button size="small" :disabled="!canApprove || !selectedIds.length" @click="openDecide(dataList.filter(row => selectedIds.includes(row.id)), 'approved')">
        批量同意
      </a-button>
      <a-button size="small" status="danger" :disabled="!canApprove || !selectedIds.length" @click="openDecide(dataList.filter(row => selectedIds.includes(row.id)), 'rejected')">
        批量驳回
      </a-button>
      <span class="text-muted">
        {{ capability.is_director ? '总监：可审批所有产品领域' : `领域架构师：${(capability.domain_architect_product_domains || []).join('、') || '未覆盖任何产品领域'}` }}
      </span>
    </div>

    <a-table
      v-model:selected-keys="selectedIds"
      :data="dataList"
      :loading="loading"
      :row-selection="{ type: 'checkbox', showCheckedAll: false }"
      :pagination="{ total, current: queryParams.page_num, pageSize: queryParams.page_size }"
      row-key="id"
      size="small"
      :scroll="{ x: 1180 }"
      @page-change="(page: number) => { queryParams.page_num = page; refresh() }"
    >
      <a-table-column title="缺陷编号" data-index="defect_code" :width="180" ellipsis tooltip />
      <template #columns>
      <a-table-column title="缺陷标题" data-index="issue_title" :width="220" ellipsis tooltip />
      <a-table-column title="项目组" data-index="project_group_name" :width="140" ellipsis tooltip />
      <a-table-column title="产品领域" data-index="product_domain" :width="120" ellipsis tooltip />
      <a-table-column title="申请人" data-index="requester_name" :width="90" />
      <a-table-column title="原因" data-index="reason" ellipsis tooltip />
      <a-table-column title="申请时间" :width="150">
        <template #cell="{ record }">{{ formatTime(record.created_at) }}</template>
      </a-table-column>
      <a-table-column title="状态" :width="90">
        <template #cell="{ record }">
          <a-tag :color="statusLabels[record.status]?.color ?? 'gray'" size="small">
            {{ statusLabels[record.status]?.label ?? record.status }}
          </a-tag>
        </template>
      </a-table-column>
      <a-table-column title="审批人" :width="130">
        <template #cell="{ record }">
          <span v-if="record.approver_name">{{ record.approver_name }}</span>
          <span v-else class="text-muted">-</span>
        </template>
      </a-table-column>
      <a-table-column title="审批意见" :width="160" ellipsis tooltip>
        <template #cell="{ record }">
          <span v-if="record.decision_comment">{{ record.decision_comment }}</span>
          <span v-else class="text-muted">-</span>
        </template>
      </a-table-column>
      <a-table-column title="操作" :width="120" fixed="right">
        <template #cell="{ record }">
          <a-space v-if="record.status === 'pending'">
            <a-button size="mini" type="primary" :disabled="!canApprove" @click="openDecide([record], 'approved')">
              同意
            </a-button>
            <a-button size="mini" status="danger" :disabled="!canApprove" @click="openDecide([record], 'rejected')">
              驳回
            </a-button>
          </a-space>
          <span v-else class="text-muted">-</span>
        </template>
      </a-table-column>
      </template>
    </a-table>

    <a-modal
      v-model:visible="decideVisible"
      :title="`${decisionText}不处理申请（${decideTargets.length} 条）`"
      fullscreen
      :footer="false"
      :body-style="{ padding: '12px', flex: '1 1 auto', minHeight: 0, overflow: 'hidden' }"
      @ok="submitDecide"
    >
      <div style="display: flex; gap: 16px; height: 100%; min-height: 0">
        <div v-if="decideTargets.length === 1" style="flex: 1 1 55%; min-width: 0; height: 100%; overflow-y: auto; overflow-x: hidden; border-right: 1px solid var(--color-border-2); padding-right: 12px">
          <div style="font-weight: 600; margin-bottom: 8px; position: sticky; top: 0; background: var(--color-bg-2); z-index: 1">缺陷报告（可滚动）</div>
          <MdPreview v-if="decideReport" :model-value="decideReport" />
          <a-empty v-else description="该缺陷没有 AI 报告" />
        </div>
        <div style="flex: 1 1 45%; min-width: 0; height: 100%; overflow-y: auto; overflow-x: hidden; display: flex; flex-direction: column">
          <div v-if="decideTargets.length === 1" class="approval-detail">
            <div><b>{{ decideTargets[0].defect_code || '-' }} · {{ decideTargets[0].issue_title }}</b></div>
            <div class="text-muted">
              {{ decideTargets[0].project_group_name || '-' }} / {{ decideTargets[0].product_domain || '-' }} ·
              申请人 {{ decideTargets[0].requester_name }} ·
              {{ formatTime(decideTargets[0].created_at) }}
            </div>
            <div style="margin-top: 8px">
              <b>原因分类：</b>{{ decideTargets[0].reason_code ? (reasonLabelMap[decideTargets[0].reason_code] ?? decideTargets[0].reason_code) : '未指定' }}
            </div>
            <div class="nofix-long-text">
              <b>不处理原因：</b>{{ decideTargets[0].reason }}
            </div>
            <div v-if="decideTargets[0].impact_note" class="nofix-long-text">
              <b>影响说明：</b>{{ decideTargets[0].impact_note }}
            </div>
            <div v-if="decideTargets[0].evidence" class="nofix-long-text">
              <b>补充证据：</b>{{ decideTargets[0].evidence }}
            </div>
          </div>
          <div v-else class="text-muted" style="margin-bottom: 12px">
            本次将批量处理 {{ decideTargets.length }} 条不处理申请，请确认审批决定。
          </div>
          <a-form :model="decideForm" layout="vertical">
            <a-form-item label="审批决定" required>
              <a-radio-group v-model="decideForm.decision">
                <a-radio value="approved">
                  同意（置为不处理并写白名单）
                </a-radio>
                <a-radio value="rejected">
                  驳回（保持待修复）
                </a-radio>
              </a-radio-group>
            </a-form-item>
            <a-form-item label="审批意见（必填）">
              <a-textarea v-model="decideForm.comment" :auto-size="{ minRows: 4, maxRows: 10 }" :max-length="500" show-word-limit />
            </a-form-item>
            <div v-if="decideTargets.some(row => row.requester_id === myUserId)" class="text-muted">
              其中包含本人提交的申请（自审），允许直接审批。
            </div>
            <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 4px">
              <a-button @click="decideVisible = false">
                取消
              </a-button>
              <a-button status="danger" :loading="decideLoading" @click="decideForm.decision = 'rejected'; submitDecide()">
                驳回
              </a-button>
              <a-button type="primary" :loading="decideLoading" @click="decideForm.decision = 'approved'; submitDecide()">
                同意
              </a-button>
            </div>
          </a-form>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<style scoped>
/* 2000 字不处理原因：必须换行，不能把右栏撑穿到左栏 */
.nofix-long-text {
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
  max-height: 28vh;
  overflow-y: auto;
  overflow-x: hidden;
  margin-top: 4px;
}
</style>
