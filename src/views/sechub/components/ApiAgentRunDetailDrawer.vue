<script setup lang="ts">
import type { AgentAudit, AgentRunDetail } from '@/types/api-agent'
import { computed, onUnmounted, ref, watch } from 'vue'
import { ApiSecScan, resolveStaticScanApi } from '@/api/sechubApis'
import { formatTime, getAction } from '@/hooks'
import { gateMeta, modeMeta, nextActionLabel, resultVerdictMeta, stageLabel, statusMeta } from './apiAgentShared'

const props = defineProps<{
  visible: boolean
  runId: string
}>()
const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const detail = ref<AgentRunDetail | null>(null)
const loading = ref(false)
let timer: ReturnType<typeof setInterval> | null = null

const dispatch = computed(() => detail.value?.dispatch)
const pipeline = computed(() => detail.value?.pipeline)
const audits = computed<AgentAudit[]>(() => detail.value?.audit_history || [])
const latestAudit = computed(() => pipeline.value?.audit || audits.value[0])
const gateItems = computed(() => {
  const gates = pipeline.value?.gates
  if (!gates)
    return []
  return [
    { key: 'requirements', label: '需求', value: gates.requirements },
    { key: 'cases', label: '用例', value: gates.cases },
    { key: 'pre_trial', label: '执行前', value: gates.pre_trial },
    { key: 'results', label: '结果', value: gates.results },
    { key: 'final_audit', label: '审计', value: gates.final_audit },
  ]
})

async function load() {
  if (!props.runId)
    return
  loading.value = true
  try {
    const data = await getAction<AgentRunDetail>(resolveStaticScanApi(ApiSecScan.apiAgentRunDetail, { run_id: props.runId }))
    if (data)
      detail.value = data
  }
  finally {
    loading.value = false
  }
}

function stopTimer() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

function ensureTimer() {
  stopTimer()
  timer = setInterval(() => {
    const d = dispatch.value
    const auditing = d?.final_audit_status === 'running'
    if (props.visible && (d?.status === 'queued' || d?.status === 'running' || auditing))
      void load()
  }, 5000)
}

function close() {
  emit('update:visible', false)
}

watch(() => [props.visible, props.runId] as const, ([visible]) => {
  if (visible) {
    detail.value = null
    void load()
    ensureTimer()
  }
  else {
    stopTimer()
  }
}, { immediate: true })

onUnmounted(stopTimer)
</script>

<template>
  <a-drawer :visible="visible" :width="980" title="Agent 任务详情" unmount-on-close @cancel="close">
    <a-spin :loading="loading" style="display: block">
      <template v-if="detail">
        <a-descriptions :column="3" bordered size="small">
          <a-descriptions-item label="任务编码">
            {{ dispatch?.task_code || '--' }}
          </a-descriptions-item>
          <a-descriptions-item label="任务名称" :span="2">
            {{ dispatch?.task_name || '--' }}
          </a-descriptions-item>
          <a-descriptions-item label="状态">
            <a-tag :color="statusMeta(dispatch?.status).color">
              {{ statusMeta(dispatch?.status).label }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="流水线">
            <a-tag :color="modeMeta(dispatch?.pipeline_mode).color">
              {{ modeMeta(dispatch?.pipeline_mode).label }}
            </a-tag>
            <span class="hint">{{ stageLabel(pipeline?.stage) }} / {{ pipeline?.stage_status }}</span>
          </a-descriptions-item>
          <a-descriptions-item label="下一步">
            {{ nextActionLabel(pipeline?.next_action) }}
          </a-descriptions-item>
          <a-descriptions-item label="候选 / 用例 / approved">
            {{ dispatch?.candidate_total }} / {{ dispatch?.case_cnt }} / {{ dispatch?.approved_cnt }}
          </a-descriptions-item>
          <a-descriptions-item label="试跑轮次">
            {{ dispatch?.trial_round || 0 }}
          </a-descriptions-item>
          <a-descriptions-item label="Findings / 覆盖缺口">
            {{ dispatch?.finding_cnt || 0 }} / {{ dispatch?.coverage_gap_cnt || 0 }}
          </a-descriptions-item>
          <a-descriptions-item label="失败原因" :span="3">
            {{ dispatch?.failed_reason || '--' }}
          </a-descriptions-item>
        </a-descriptions>

        <a-divider orientation="left">
          阶段与门禁
        </a-divider>
        <a-steps v-if="pipeline?.steps?.length" size="small" class="steps">
          <a-step v-for="step in pipeline.steps" :key="step.key" :title="step.label" :status="step.status" />
        </a-steps>
        <a-space wrap>
          <a-tag v-for="gate in gateItems" :key="gate.key" :color="gateMeta(gate.value?.status).color">
            {{ gate.label }}：{{ gateMeta(gate.value?.status).label }}
            <template v-if="gate.value?.round">
              R{{ gate.value.round }}
            </template>
          </a-tag>
        </a-space>

        <a-divider orientation="left">
          最终审计
        </a-divider>
        <a-descriptions v-if="latestAudit" :column="3" size="small" bordered>
          <a-descriptions-item label="轮次">
            {{ latestAudit.round }}
          </a-descriptions-item>
          <a-descriptions-item label="结论">
            <a-tag :color="latestAudit.verdict === 'passed' ? 'green' : 'red'">
              {{ latestAudit.verdict }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="审计人">
            {{ latestAudit.agent || '--' }}
          </a-descriptions-item>
          <a-descriptions-item label="摘要" :span="3">
            {{ latestAudit.summary || '--' }}
          </a-descriptions-item>
        </a-descriptions>
        <a-empty v-else description="尚未产生最终审计" />
        <pre v-if="latestAudit?.report_md" class="report">{{ latestAudit.report_md }}</pre>

        <a-divider orientation="left">
          工作日志
        </a-divider>
        <a-table :data="pipeline?.journal || []" :pagination="false" row-key="id" size="small" :scroll="{ y: 220 }">
          <template #columns>
            <a-table-column title="时间" :width="150">
              <template #cell="{ record }">
                {{ formatTime(record.created_at) }}
              </template>
            </a-table-column>
            <a-table-column title="阶段" :width="110">
              <template #cell="{ record }">
                {{ stageLabel(record.stage) }}
              </template>
            </a-table-column>
            <a-table-column title="来源" data-index="source" :width="90" />
            <a-table-column title="事件" data-index="event" :width="150" ellipsis tooltip />
            <a-table-column title="摘要" data-index="summary" ellipsis tooltip />
          </template>
        </a-table>

        <a-divider orientation="left">
          候选 API
        </a-divider>
        <a-table :data="detail.candidates || []" :pagination="false" row-key="api_path" size="small">
          <template #columns>
            <a-table-column title="API" data-index="api_path" ellipsis tooltip />
            <a-table-column title="方法" data-index="http_method" :width="80" />
            <a-table-column title="dev_mode" data-index="dev_mode" :width="90" />
            <a-table-column title="thirdapp" data-index="thirdapp_auth" :width="90" />
            <a-table-column title="应用" data-index="app_number" :width="100" />
          </template>
        </a-table>

        <a-divider orientation="left">
          评审 Findings
        </a-divider>
        <a-table :data="detail.findings || []" :pagination="false" row-key="id" size="small">
          <template #columns>
            <a-table-column title="类型" data-index="kind" :width="120" />
            <a-table-column title="级别" data-index="severity" :width="80" />
            <a-table-column title="状态" data-index="status" :width="90" />
            <a-table-column title="API" data-index="api_path" ellipsis tooltip />
            <a-table-column title="标题" data-index="title" ellipsis tooltip />
            <a-table-column title="建议" data-index="suggestion" ellipsis tooltip />
          </template>
        </a-table>

        <a-divider orientation="left">
          覆盖缺口
        </a-divider>
        <a-table :data="detail.coverage_gaps || []" :pagination="false" size="small">
          <template #columns>
            <a-table-column title="API" data-index="api_path" ellipsis tooltip />
            <a-table-column title="风险" data-index="risk" :width="150" />
            <a-table-column title="级别" data-index="level" :width="80" />
            <a-table-column title="期望用例" :width="200">
              <template #cell="{ record }">
                {{ (record.expected_tests || []).join(' / ') }}
              </template>
            </a-table-column>
            <a-table-column title="原因" data-index="reason" ellipsis tooltip />
          </template>
        </a-table>

        <a-divider orientation="left">
          回写用例
        </a-divider>
        <a-table :data="detail.cases || []" :pagination="false" row-key="id" size="small" :scroll="{ y: 260 }">
          <template #columns>
            <a-table-column title="用例" :width="160" ellipsis tooltip>
              <template #cell="{ record }">
                {{ record.case_code || record.id?.slice(-8) }}
              </template>
            </a-table-column>
            <a-table-column title="标题" data-index="title" ellipsis tooltip />
            <a-table-column title="角色" data-index="test_role" :width="80" />
            <a-table-column title="类型" data-index="test_type" :width="100" />
            <a-table-column title="评审" :width="100">
              <template #cell="{ record }">
                <a-tag :color="record.review_status === 'approved' ? 'green' : record.review_status === 'rejected' ? 'red' : 'gray'">
                  {{ record.review_status }}
                </a-tag>
              </template>
            </a-table-column>
            <a-table-column title="断言" data-index="assertion" :width="130" />
          </template>
        </a-table>

        <a-divider orientation="left">
          试跑
        </a-divider>
        <a-table :data="detail.trial_runs || []" :pagination="false" row-key="run_id" size="small">
          <template #columns>
            <a-table-column title="运行" data-index="run_name" ellipsis tooltip />
            <a-table-column title="状态" data-index="status" :width="100" />
            <a-table-column title="PASS" data-index="pass" :width="80" />
            <a-table-column title="FAIL" data-index="fail" :width="80" />
            <a-table-column title="REVIEW" data-index="review" :width="90" />
            <a-table-column title="BLOCKED" data-index="block" :width="90" />
            <a-table-column title="ERROR" data-index="error" :width="90" />
          </template>
        </a-table>

        <a-divider orientation="left">
          结果复核
        </a-divider>
        <a-table :data="detail.results || []" :pagination="false" row-key="result_id" size="small" :scroll="{ y: 260 }">
          <template #columns>
            <a-table-column title="用例" :width="180" ellipsis tooltip>
              <template #cell="{ record }">
                {{ record.case_code || record.case_id }}
              </template>
            </a-table-column>
            <a-table-column title="API" data-index="api_path" ellipsis tooltip />
            <a-table-column title="执行结论" data-index="verdict" :width="100" />
            <a-table-column title="复核结论" :width="120">
              <template #cell="{ record }">
                <a-tag :color="resultVerdictMeta(record.review_verdict).color">
                  {{ resultVerdictMeta(record.review_verdict).label }}
                </a-tag>
              </template>
            </a-table-column>
            <a-table-column title="HTTP" data-index="http_status" :width="80" />
            <a-table-column title="复核意见" data-index="review_comment" ellipsis tooltip />
          </template>
        </a-table>

        <a-divider orientation="left">
          报告
        </a-divider>
        <pre v-if="detail.report_md" class="report">{{ detail.report_md }}</pre>
        <a-empty v-else description="尚未提交报告" />
      </template>
      <a-empty v-else-if="!loading" description="暂无详情" />
      <div v-if="loading && !detail" class="hint">
        加载中…
      </div>
    </a-spin>
  </a-drawer>
</template>

<style scoped>
.hint { margin-left: 8px; color: var(--color-text-3); font-size: 12px; }
.steps { margin-bottom: 12px; }
.report {
  max-height: 320px;
  overflow: auto;
  padding: 12px;
  white-space: pre-wrap;
  background: var(--color-fill-1);
  border-radius: 4px;
  font-family: inherit;
  font-size: 12px;
}
</style>
