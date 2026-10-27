<script setup lang="ts">
import type { AgentRunListItem } from '@/types/api-agent'
/**
 * API安全测试 → Agent任务。
 *
 * 左树选范围（产品领域/项目组/业务领域/应用）→ 选环境/配额 → 预览待测 API → 一键派发。
 * 下方是派发历史：候选数、已回写用例、approved、试跑通过/失败、进度、失败原因；
 * 详情抽屉展示候选、用例评审状态与试跑结果。
 */
import { Message } from '@arco-design/web-vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ApiSecTestEnv } from '@/api/apis'
import { ApiSecScan, resolveStaticScanApi } from '@/api/sechubApis'
import { formatTime, getAction, postAction } from '@/hooks'
import ApiInventoryTree from '@/views/metadata/components/ApiInventoryTree.vue'
import ApiAgentRunDetailDrawer from './components/ApiAgentRunDetailDrawer.vue'
import { gateMeta, modeMeta, nextActionLabel, PIPELINE_MODE_OPTIONS, stageLabel, statusMeta } from './components/apiAgentShared'

// eslint-disable-next-line vue/component-definition-name-casing
defineOptions({ name: 'api-agent-tasks' })

const router = useRouter()
const DIMENSION_OPTIONS = [
  { value: 'product_domain', label: '按产品领域' },
  { value: 'project_group', label: '按项目组' },
  { value: 'business_area', label: '按业务领域' },
  { value: 'app', label: '按应用' },
]

const dimension = ref('product_domain')
const scope = ref<any>({ kind: 'all', code: '', label: '全部接口', appNumber: '' })
const envs = ref<any[]>([])
const activeEnvId = ref('')
const model = ref('')
const maxApis = ref(10)
const pipelineMode = ref('hybrid')
const requirementText = ref('')
const includeInternal = ref(false)
const previewing = ref(false)
const preview = ref<any>(null)
const running = ref(false)

const activeEnv = computed(() => envs.value.find(e => e.id === activeEnvId.value))
const scopeText = computed(() => {
  if (scope.value.kind === 'all')
    return '全部接口'
  if (scope.value.kind === 'api')
    return `API ${scope.value.code}`
  if (scope.value.kind === 'app')
    return `应用 ${scope.value.appNumber || scope.value.code}`
  return `${DIMENSION_OPTIONS.find(d => d.value === dimension.value)?.label || dimension.value} · ${scope.value.label || scope.value.code}`
})

function scopeParams(): { dimension: string, code: string } {
  const s = scope.value
  if (s.kind === 'all')
    return { dimension: 'all', code: '' }
  if (s.kind === 'app' || s.kind === 'api')
    return { dimension: 'app', code: s.appNumber || s.code }
  return { dimension: dimension.value, code: s.code }
}

async function loadEnvs() {
  const data = await getAction<any>(ApiSecTestEnv.getList, { page_num: 1, page_size: 200 })
  if (!data)
    return
  envs.value = Array.isArray(data.list) ? data.list : []
  if (!activeEnvId.value && envs.value.length)
    activeEnvId.value = envs.value[0].id
}

function handleTreeSelect(s: any) {
  scope.value = s
  preview.value = null
}

async function doPreview() {
  if (!activeEnvId.value) {
    Message.warning('请先选择安全测试环境')
    return
  }
  const { dimension: dim, code } = scopeParams()
  previewing.value = true
  try {
    const data = await getAction<any>(ApiSecScan.apiUntested, {
      // api-untested 按 meta 身份查清单；没有显式绑定就交给后端挑默认环境
      env_id: activeEnv.value?.meta_env_id || undefined,
      dimension: dim,
      code,
      only_untested: true,
      limit: 50,
      include_internal: includeInternal.value,
    })
    if (data)
      preview.value = data
  }
  finally {
    previewing.value = false
  }
}

async function startAgent() {
  if (!activeEnvId.value) {
    Message.warning('请先选择安全测试环境')
    return
  }
  const { dimension: dim, code } = scopeParams()
  running.value = true
  try {
    const res = await postAction<any>(ApiSecScan.apiAgentRun, {
      sec_env_id: activeEnvId.value,
      dimension: dim,
      code,
      model: model.value || undefined,
      max_apis: maxApis.value,
      pipeline_mode: pipelineMode.value,
      include_internal: includeInternal.value,
      requirement_text: requirementText.value.trim() || undefined,
    })
    if (res === null)
      return
    Message.success(res.message || '已派发给 Agent')
    await loadRuns()
    if (res.run_id)
      await openDetail(res.run_id)
  }
  finally {
    running.value = false
  }
}

// ── 派发历史 ─────────────────────────────────────────────
const runs = ref<AgentRunListItem[]>([])
const runsLoading = ref(false)
const total = ref(0)
const pageNum = ref(1)
const pageSize = ref(20)
const keyword = ref('')

async function loadRuns() {
  runsLoading.value = true
  try {
    const data = await getAction<any>(ApiSecScan.apiAgentRuns, {
      page_num: pageNum.value,
      page_size: pageSize.value,
      keyword: keyword.value || undefined,
    })
    if (!data)
      return
    runs.value = Array.isArray(data.list) ? data.list : []
    total.value = data.total || 0
  }
  finally {
    runsLoading.value = false
  }
}

// ── 详情 ───────────────────────────────────────────────
const drawerVisible = ref(false)
const detailRunId = ref('')

function openDetail(runId: string) {
  detailRunId.value = runId
  drawerVisible.value = true
}

async function retry(record: any) {
  const res = await postAction<any>(resolveStaticScanApi(ApiSecScan.apiAgentRetry, { run_id: record.run_id }))
  if (res === null)
    return
  Message.success('已重新派发')
  await loadRuns()
}

async function resumeRun(record: AgentRunListItem) {
  const res = await postAction<any>(resolveStaticScanApi(ApiSecScan.apiAgentResume, { run_id: record.run_id }))
  if (res === null)
    return
  Message.success(res.message || `已恢复主会话（${res.stage || '当前阶段'}）`)
  await loadRuns()
}

async function reviewRun(record: any) {
  const res = await postAction<any>(resolveStaticScanApi(ApiSecScan.apiAgentReview, { run_id: record.run_id }))
  if (res === null)
    return
  Message.success(res.message || '独立评审已启动')
  await loadRuns()
}

async function repairRun(record: any) {
  const res = await postAction<any>(resolveStaticScanApi(ApiSecScan.apiAgentRepair, { run_id: record.run_id }))
  if (res === null)
    return
  Message.success(res.message || `修复轮已启动（第 ${res.round || '?'} 轮）`)
  await loadRuns()
}

async function resultReviewRun(record: any) {
  const res = await postAction<any>(resolveStaticScanApi(ApiSecScan.apiAgentResultReview, { run_id: record.run_id }))
  if (res === null)
    return
  Message.success(res.message || `结果复核已启动（${res.results || 0} 条结果）`)
  await loadRuns()
}

async function auditRun(record: AgentRunListItem) {
  const res = await postAction<any>(resolveStaticScanApi(ApiSecScan.apiAgentAudit, { run_id: record.run_id }))
  if (res === null)
    return
  Message.success(res.message || `最终审计已启动（第 ${res.round || '?'} 轮）`)
  await loadRuns()
}

async function regression(record: AgentRunListItem) {
  const res = await postAction<any>(ApiSecScan.apiAgentRegression, {
    sec_env_id: record.sec_env_id,
    dimension: record.dimension,
    code: record.code,
  })
  if (res === null)
    return
  Message.success(res.message || '回归已启动')
}

// ── 每日配置 ────────────────────────────────────────────
const cfg = ref<any>({})
const cfgSaving = ref(false)
async function loadConfig() {
  const data = await getAction<any>(ApiSecScan.apiAgentConfig)
  if (data)
    cfg.value = data
}
async function saveConfig() {
  cfgSaving.value = true
  try {
    const res = await postAction<string>(ApiSecScan.apiAgentConfig, {
      daily_enabled: !!cfg.value.api_agent_daily_enabled,
      daily_discover: !!cfg.value.api_agent_daily_discover,
      daily_sec_env_id: cfg.value.api_agent_daily_sec_env_id || '',
      daily_max_apis: Number(cfg.value.api_agent_daily_max_apis || 10),
      pipeline_mode: cfg.value.api_agent_pipeline_mode || 'hybrid',
    })
    if (res === null)
      return
    Message.success('每日配置已保存')
    await loadConfig()
  }
  finally {
    cfgSaving.value = false
  }
}

let timer: any = null
onMounted(async () => {
  await Promise.all([loadEnvs(), loadRuns(), loadConfig()])
  timer = setInterval(() => {
    if (runs.value.some(r => r.status === 'queued' || r.status === 'running'))
      void loadRuns()
  }, 5000)
})
onUnmounted(() => {
  if (timer)
    clearInterval(timer)
})
</script>

<template>
  <div class="agent-tasks">
    <a-row :gutter="12">
      <a-col :span="8">
        <a-card title="选择范围" :bordered="false" class="scope-card">
          <div class="dimension-row">
            <span>维度</span>
            <a-select v-model="dimension" size="small" style="width: 150px">
              <a-option v-for="d in DIMENSION_OPTIONS" :key="d.value" :value="d.value">
                {{ d.label }}
              </a-option>
            </a-select>
          </div>
          <div class="tree-wrap">
            <ApiInventoryTree :dimension="dimension" :env-id="activeEnv?.meta_env_id || ''" @select="handleTreeSelect" />
          </div>
        </a-card>
      </a-col>
      <a-col :span="16">
        <a-card title="派发 Agent" :bordered="false">
          <a-form layout="vertical" :model="{}">
            <a-row :gutter="12">
              <a-col :span="12">
                <a-form-item label="安全测试环境" required>
                  <a-select v-model="activeEnvId" placeholder="选择环境">
                    <a-option v-for="e in envs" :key="e.id" :value="e.id">
                      {{ e.env_name || e.id }}（{{ e.env_type || '--' }}）
                    </a-option>
                  </a-select>
                  <template #extra>
                    <span v-if="!envs.length">还没有环境，请先到「环境与账号」新增。</span>
                    <span v-else>真实请求由平台执行，Agent 不接触账号密码。</span>
                  </template>
                </a-form-item>
              </a-col>
              <a-col :span="6">
                <a-form-item label="模型">
                  <a-input v-model="model" placeholder="留空用 Agent 默认模型" />
                </a-form-item>
              </a-col>
              <a-col :span="6">
                <a-form-item label="流水线模式">
                  <a-select v-model="pipelineMode">
                    <a-option v-for="m in PIPELINE_MODE_OPTIONS" :key="m.value" :value="m.value">
                      {{ m.label }}
                    </a-option>
                  </a-select>
                </a-form-item>
              </a-col>
              <a-col :span="6">
                <a-form-item label="单轮 API 上限">
                  <a-input-number v-model="maxApis" :min="1" :max="50" style="width: 100%" />
                </a-form-item>
              </a-col>
              <a-col :span="24">
                <a-form-item label="范围选项">
                  <a-checkbox v-model="includeInternal">
                    包含内测接口（status=A）
                  </a-checkbox>
                  <span class="tip">默认只取已发布 C/enabled；勾选后再纳入 A 档。</span>
                </a-form-item>
              </a-col>
              <a-col :span="24">
                <a-form-item label="需求文档 / 说明（可选）">
                  <a-textarea
                    v-model="requirementText"
                    placeholder="粘贴需求文档/接口说明。留空则 Agent 自主从源码和 meta 调研；填写后以文档为主、源码核对。梳理结果会回写到 API 资产背景需求。"
                    :auto-size="{ minRows: 2, maxRows: 8 }"
                  />
                </a-form-item>
              </a-col>
            </a-row>
            <a-space>
              <a-tag color="arcoblue">
                {{ scopeText }}
              </a-tag>
              <a-button :loading="previewing" @click="doPreview">
                预览待测 API
              </a-button>
              <a-button type="primary" :loading="running" @click="startAgent">
                开始 Agent 测试
              </a-button>
            </a-space>
            <a-alert v-if="preview" type="info" style="margin-top: 12px">
              范围内已发布 {{ preview.total }} 个，已通过 {{ preview.passed }} 个，待测 {{ preview.untested }} 个；
              本次最多派发 {{ Math.min(maxApis, preview.list?.length || 0) }} 个。
            </a-alert>
          </a-form>
        </a-card>

        <a-card title="每日任务" :bordered="false" style="margin-top: 12px">
          <a-space wrap>
            <span>总开关</span>
            <a-switch v-model="cfg.api_agent_daily_enabled" />
            <span>新增 API 发现</span>
            <a-switch v-model="cfg.api_agent_daily_discover" />
            <span>每日环境</span>
            <a-select v-model="cfg.api_agent_daily_sec_env_id" allow-clear placeholder="默认全部已有任务" style="width: 220px">
              <a-option v-for="e in envs" :key="e.id" :value="e.id">
                {{ e.env_name || e.id }}
              </a-option>
            </a-select>
            <span>流水线</span>
            <a-select v-model="cfg.api_agent_pipeline_mode" style="width: 150px">
              <a-option v-for="m in PIPELINE_MODE_OPTIONS" :key="m.value" :value="m.value">
                {{ m.label.split('（')[0] }}
              </a-option>
            </a-select>
            <span>单轮上限</span>
            <a-input-number v-model="cfg.api_agent_daily_max_apis" :min="1" :max="50" style="width: 100px" />
            <a-button type="primary" :loading="cfgSaving" @click="saveConfig">
              保存
            </a-button>
          </a-space>
          <div class="cfg-hint">
            总开关关闭时每日 scheduler 空跑；只做回归不开发现时，新 API 不会自动生成用例。
          </div>
        </a-card>
      </a-col>
    </a-row>

    <a-card title="Agent 任务" :bordered="false" style="margin-top: 12px">
      <template #extra>
        <a-space>
          <a-button @click="router.push('/sechub/api-test/api-agent-feedback')">
            Agent反馈
          </a-button>
          <a-input v-model="keyword" placeholder="范围/状态" allow-clear style="width: 180px" @press-enter="loadRuns" />
          <a-button @click="loadRuns">
            刷新
          </a-button>
        </a-space>
      </template>
      <a-table
        :data="runs"
        :loading="runsLoading"
        row-key="dispatch_id"
        :pagination="{ current: pageNum, pageSize, total, showTotal: true, showPageSize: true }"
        @page-change="(p: number) => { pageNum = p; loadRuns() }"
        @page-size-change="(s: number) => { pageSize = s; pageNum = 1; loadRuns() }"
      >
        <template #columns>
          <a-table-column title="创建时间" :width="160">
            <template #cell="{ record }">
              {{ formatTime(record.created_at) }}
            </template>
          </a-table-column>
          <a-table-column title="任务编码" :width="190" ellipsis tooltip>
            <template #cell="{ record }">
              {{ record.task_code || '--' }}
            </template>
          </a-table-column>
          <a-table-column title="任务名称" :width="240" ellipsis tooltip>
            <template #cell="{ record }">
              {{ record.task_name || '--' }}
            </template>
          </a-table-column>
          <a-table-column title="范围" :width="200" ellipsis tooltip>
            <template #cell="{ record }">
              {{ record.dimension }} / {{ record.code || 'all' }}
            </template>
          </a-table-column>
          <a-table-column title="状态" :width="100">
            <template #cell="{ record }">
              <a-tag :color="statusMeta(record.status).color">
                {{ statusMeta(record.status).label }}
              </a-tag>
            </template>
          </a-table-column>
          <a-table-column title="流水线" :width="120">
            <template #cell="{ record }">
              <a-tag :color="modeMeta(record.pipeline?.mode).color">
                {{ modeMeta(record.pipeline?.mode).label }}
              </a-tag>
              <div class="stage-hint">
                {{ stageLabel(record.pipeline?.stage) }}
              </div>
            </template>
          </a-table-column>
          <a-table-column title="进度" :width="180">
            <template #cell="{ record }">
              <a-progress :percent="record.progress || 0" size="small" />
            </template>
          </a-table-column>
          <a-table-column title="候选 / 用例 / approved" :width="180">
            <template #cell="{ record }">
              {{ record.candidate_total }} / {{ record.case_cnt }} / {{ record.approved_cnt }}
            </template>
          </a-table-column>
          <a-table-column title="试跑 PASS / FAIL" :width="140">
            <template #cell="{ record }">
              {{ record.trial_pass }} / {{ record.trial_fail }}
            </template>
          </a-table-column>
          <a-table-column title="门禁" :width="170">
            <template #cell="{ record }">
              <a-space :size="4" wrap>
                <a-tag :color="gateMeta(record.pipeline?.requirements_gate_status).color" size="small">
                  需
                </a-tag>
                <a-tag :color="gateMeta(record.pipeline?.cases_gate_status).color" size="small">
                  例{{ record.pipeline?.cases_gate_round ? `·R${record.pipeline.cases_gate_round}` : '' }}
                </a-tag>
                <a-tag :color="gateMeta(record.pipeline?.pre_trial_gate_status).color" size="small">
                  跑
                </a-tag>
                <a-tag :color="gateMeta(record.pipeline?.results_gate_status).color" size="small">
                  果{{ record.pipeline?.trial_round ? `·R${record.pipeline.trial_round}` : '' }}
                </a-tag>
              </a-space>
              <div class="stage-hint">
                {{ nextActionLabel(record.pipeline?.next_action) }}
              </div>
            </template>
          </a-table-column>
          <a-table-column title="Findings / 覆盖缺口" :width="150">
            <template #cell="{ record }">
              <a-tag :color="(record.finding_cnt || 0) > 0 ? 'orange' : 'gray'" size="small">
                F {{ record.finding_cnt || 0 }}
              </a-tag>
              <a-tag :color="(record.coverage_gap_cnt || 0) > 0 ? 'red' : 'gray'" size="small">
                C {{ record.coverage_gap_cnt || 0 }}
              </a-tag>
            </template>
          </a-table-column>
          <a-table-column title="审计 / 结果复核" :width="140">
            <template #cell="{ record }">
              <a-tag :color="gateMeta(record.pipeline?.final_audit_status).color" size="small">
                审{{ record.pipeline?.final_audit_round ? `·R${record.pipeline.final_audit_round}` : '' }}
              </a-tag>
              <br>
              <a-tag :color="gateMeta(record.result_review_status).color" size="small">
                {{ record.result_review_status }}
              </a-tag>
            </template>
          </a-table-column>
          <a-table-column title="失败原因" :width="220" ellipsis tooltip>
            <template #cell="{ record }">
              {{ record.failed_reason || '--' }}
            </template>
          </a-table-column>
          <a-table-column title="操作" :width="300" fixed="right">
            <template #cell="{ record }">
              <a-space>
                <a-link @click="openDetail(record.run_id)">
                  详情
                </a-link>
                <a-link
                  v-if="(record.status === 'failed' || record.status === 'timeout') && record.pipeline?.mode !== 'strict'"
                  @click="resumeRun(record)"
                >
                  继续
                </a-link>
                <a-link v-if="(record.status === 'failed' || record.status === 'timeout') && record.pipeline?.mode === 'strict'" @click="retry(record)">
                  重试
                </a-link>
                <a-link
                  v-if="record.pipeline?.mode === 'strict' && record.case_cnt > 0 && record.reviewer_status !== 'running'"
                  @click="reviewRun(record)"
                >
                  独立评审
                </a-link>
                <a-link
                  v-if="record.pipeline?.mode === 'strict' && record.reviewer_status === 'completed' && record.repair_status !== 'running' && (record.repair_round || 0) < 2"
                  @click="repairRun(record)"
                >
                  修复
                </a-link>
                <a-link
                  v-if="record.pipeline?.mode !== 'strict' && record.status !== 'completed' && record.pipeline?.final_audit_status !== 'running' && record.pipeline?.final_audit_status !== 'passed'"
                  @click="auditRun(record)"
                >
                  最终审计
                </a-link>
                <a-link v-if="record.trial_total > 0 && record.result_review_status !== 'running'" @click="resultReviewRun(record)">
                  结果复核
                </a-link>
                <a-link @click="regression(record)">
                  回归
                </a-link>
              </a-space>
            </template>
          </a-table-column>
        </template>
        <template #empty>
          <a-empty description="还没有 Agent 任务：选范围后点「开始 Agent 测试」" />
        </template>
      </a-table>
    </a-card>

    <ApiAgentRunDetailDrawer v-model:visible="drawerVisible" :run-id="detailRunId" />
  </div>
</template>

<style scoped>
.agent-tasks { padding: 0; }
.scope-card { height: 100%; }
.dimension-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; color: var(--color-text-2); }
.tree-wrap { height: 330px; overflow: auto; }
.cfg-hint { margin-top: 8px; color: var(--color-text-3); font-size: 12px; }
.stage-hint { margin-top: 2px; color: var(--color-text-3); font-size: 12px; }
</style>
