<script setup lang="ts">
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
const requirementText = ref('')
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
const runs = ref<any[]>([])
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

const STATUS_META: Record<string, { label: string, color: string }> = {
  queued: { label: '排队中', color: 'gray' },
  running: { label: '执行中', color: 'blue' },
  completed: { label: '已完成', color: 'green' },
  failed: { label: '失败', color: 'red' },
  timeout: { label: '超时', color: 'orangered' },
}
const REVIEWER_STATUS_META: Record<string, { label: string, color: string }> = {
  none: { label: '未评审', color: 'gray' },
  running: { label: '评审中', color: 'blue' },
  completed: { label: '已评审', color: 'green' },
  failed: { label: '评审失败', color: 'red' },
}
function statusMeta(s?: string) {
  return STATUS_META[s || ''] || { label: s || '--', color: 'gray' }
}
function reviewerMeta(s?: string) {
  return REVIEWER_STATUS_META[s || ''] || { label: s || '--', color: 'gray' }
}

// ── 详情 ───────────────────────────────────────────────
const drawerVisible = ref(false)
const detail = ref<any>(null)
const detailLoading = ref(false)

async function openDetail(runId: string) {
  drawerVisible.value = true
  detailLoading.value = true
  detail.value = null
  try {
    const data = await getAction<any>(resolveStaticScanApi(ApiSecScan.apiAgentRunDetail, { run_id: runId }))
    if (data)
      detail.value = data
  }
  finally {
    detailLoading.value = false
  }
}

const detailCases = computed(() => detail.value?.cases || [])

async function retry(record: any) {
  const res = await postAction<any>(resolveStaticScanApi(ApiSecScan.apiAgentRetry, { run_id: record.run_id }))
  if (res === null)
    return
  Message.success('已重新派发')
  await loadRuns()
}

async function reviewRun(record: any) {
  const res = await postAction<any>(resolveStaticScanApi(ApiSecScan.apiAgentReview, { run_id: record.run_id }))
  if (res === null)
    return
  Message.success(res.message || '独立评审已启动')
  await loadRuns()
}

async function regression(record: any) {
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
                <a-form-item label="单轮 API 上限">
                  <a-input-number v-model="maxApis" :min="1" :max="50" style="width: 100%" />
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
          <a-table-column title="独立评审" :width="100">
            <template #cell="{ record }">
              <a-tag :color="reviewerMeta(record.reviewer_status).color">
                {{ reviewerMeta(record.reviewer_status).label }}
              </a-tag>
            </template>
          </a-table-column>
          <a-table-column title="失败原因" :width="220" ellipsis tooltip>
            <template #cell="{ record }">
              {{ record.failed_reason || '--' }}
            </template>
          </a-table-column>
          <a-table-column title="操作" :width="220" fixed="right">
            <template #cell="{ record }">
              <a-space>
                <a-link @click="openDetail(record.run_id)">
                  详情
                </a-link>
                <a-link v-if="record.status === 'failed' || record.status === 'timeout'" @click="retry(record)">
                  重试
                </a-link>
                <a-link v-if="record.case_cnt > 0 && record.reviewer_status !== 'running'" @click="reviewRun(record)">
                  独立评审
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

    <a-drawer v-model:visible="drawerVisible" :width="860" title="Agent 任务详情" unmount-on-close>
      <a-spin :loading="detailLoading" style="display: block">
        <template v-if="detail">
          <a-descriptions :column="3" bordered size="small">
            <a-descriptions-item label="任务编码">
              {{ detail.dispatch?.task_code || '--' }}
            </a-descriptions-item>
            <a-descriptions-item label="任务名称" :span="2">
              {{ detail.dispatch?.task_name || '--' }}
            </a-descriptions-item>
            <a-descriptions-item label="状态">
              <a-tag :color="statusMeta(detail.dispatch?.status).color">
                {{ statusMeta(detail.dispatch?.status).label }}
              </a-tag>
            </a-descriptions-item>
            <a-descriptions-item label="候选">
              {{ detail.dispatch?.candidate_total }}
            </a-descriptions-item>
            <a-descriptions-item label="用例 / approved">
              {{ detail.dispatch?.case_cnt }} / {{ detail.dispatch?.approved_cnt }}
            </a-descriptions-item>
            <a-descriptions-item label="独立评审">
              <a-tag :color="reviewerMeta(detail.dispatch?.reviewer_status).color">
                {{ reviewerMeta(detail.dispatch?.reviewer_status).label }}
              </a-tag>
              <span v-if="detail.dispatch?.reviewer_agent" class="reviewer-agent">{{ detail.dispatch.reviewer_agent }}</span>
            </a-descriptions-item>
            <a-descriptions-item label="失败原因" :span="2">
              {{ detail.dispatch?.failed_reason || '--' }}
            </a-descriptions-item>
          </a-descriptions>

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
            回写用例
          </a-divider>
          <a-table :data="detailCases" :pagination="false" row-key="id" size="small">
            <template #columns>
              <a-table-column title="用例" :width="150" ellipsis tooltip>
                <template #cell="{ record }">
                  {{ record.case_code || record.id?.slice(-8) }}
                </template>
              </a-table-column>
              <a-table-column title="标题" data-index="title" ellipsis tooltip />
              <a-table-column title="角色" data-index="test_role" :width="80" />
              <a-table-column title="类型" data-index="test_type" :width="100" />
              <a-table-column title="评审" data-index="review_status" :width="100" />
              <a-table-column title="断言" data-index="assertion" :width="120" />
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
        </template>
      </a-spin>
    </a-drawer>
  </div>
</template>

<style scoped>
.agent-tasks { padding: 0; }
.scope-card { height: 100%; }
.dimension-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; color: var(--color-text-2); }
.tree-wrap { height: 330px; overflow: auto; }
.cfg-hint { margin-top: 8px; color: var(--color-text-3); font-size: 12px; }
.reviewer-agent { margin-left: 8px; color: var(--color-text-3); font-size: 12px; }
</style>
