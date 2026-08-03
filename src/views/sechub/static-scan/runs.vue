<script setup lang="ts">
import type { CrossRunAggRow, ModuleWithRepository } from '@/types/static-scan'
import { computed, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Message } from '@arco-design/web-vue'
import { ApiSecModuleRepository, ApiSecPrescan } from '@/api/sechubApis'
import { ErrorFlag } from '@/api/apis'
import { useGet, usePost } from '@/hooks'

defineOptions({ name: 'StaticScanRuns' })

const router = useRouter()

// ===== 应用列表 =====
const { data: repoList } = useGet<ModuleWithRepository[]>(ApiSecModuleRepository.listWithModule, {}, { immediate: true })
const repositories = computed(() => repoList.value ?? [])
const selectedRepoId = ref('')

async function fetchJson<T>(url: string): Promise<T | null> {
  const { data, execute } = useGet<T>(url, {}, { immediate: false })
  await execute()
  return data.value ?? null
}

// ===== POST 通用封装（业务错误时 hook 已弹 Message，返回 null 表示失败）=====
async function postAction<T = unknown>(url: string, payload: Record<string, any>): Promise<T | null> {
  const request = usePost<T>(url, payload, { immediate: false })
  await request.execute()
  if (request.error.value || request.data.value === ErrorFlag)
    return null
  return request.data.value
}

// ===== 模型结果总览（跨 Run 横评：每行 = 一个 模型×模式 轮次）=====
const crossRows = ref<CrossRunAggRow[]>([])
const crossLoading = ref(false)

async function loadCrossRows(silent = false) {
  if (!silent)
    crossLoading.value = true
  try {
    const params = new URLSearchParams()
    if (selectedRepoId.value)
      params.set('repository_id', selectedRepoId.value)
    crossRows.value = await fetchJson<CrossRunAggRow[]>(`${ApiSecPrescan.crossRunCompare}?${params.toString()}`) ?? []
  }
  finally {
    if (!silent)
      crossLoading.value = false
  }
  schedulePollIfNeeded()
}

// ===== AI 确认轮询：任一任务存在待确认候选时每 5 秒静默刷新，确认进度列实时回显 =====
const pollTimer = ref<ReturnType<typeof setTimeout> | null>(null)
function schedulePollIfNeeded() {
  if (pollTimer.value) {
    clearTimeout(pollTimer.value)
    pollTimer.value = null
  }
  if (crossRows.value.some(r => (r.pending ?? 0) > 0))
    pollTimer.value = setTimeout(() => void loadCrossRows(true), 5000)
}
onUnmounted(() => {
  if (pollTimer.value)
    clearTimeout(pollTimer.value)
})

// 默认加载全部数据
loadCrossRows()

function onSearch() {
  void loadCrossRows()
}

// ===== 查看明细 → 跳转扫描结果详情 =====
function viewDetail(row: CrossRunAggRow) {
  router.push({
    path: '/static-scan/scan/results',
    query: {
      run_id: row.run_id,
      repository_id: row.repository_id,
      ai_model: row.ai_model ?? '',
      ai_mode: row.ai_mode ?? '',
    },
  })
}

function modelLabel(row: CrossRunAggRow): string {
  if (row.ai_model?.trim())
    return row.ai_model.trim()
  // 模型与模式均为空：预扫描候选尚未经过 AI 确认（pending 分组），区别于真正的“默认模型”轮次
  if (!row.ai_mode?.trim())
    return '待AI确认'
  return '默认模型'
}

// ===== AI 确认进度：按 run 聚合，同一扫描任务的多个「模型×模式」行共享整体进度 =====
const runProgressMap = computed(() => {
  const map = new Map<string, { total: number, pending: number }>()
  for (const row of crossRows.value) {
    const agg = map.get(row.run_id) ?? { total: 0, pending: 0 }
    agg.total += row.total ?? 0
    agg.pending += row.pending ?? 0
    map.set(row.run_id, agg)
  }
  return map
})

function progressLabel(row: CrossRunAggRow): string {
  const agg = runProgressMap.value.get(row.run_id)
  if (!agg || agg.total === 0)
    return '-'
  const done = agg.total - agg.pending
  return `${Math.round((done / agg.total) * 100)}%`
}

// ===== 一键重扫错误候选（整个轮次）=====
const retryingRunId = ref('')
async function retryErrors(row: CrossRunAggRow) {
  retryingRunId.value = row.run_id
  try {
    const payload: Record<string, any> = { run_id: row.run_id }
    if (row.ai_model?.trim())
      payload.model = row.ai_model.trim()
    const resp = await postAction<{ message?: string }>(ApiSecPrescan.retryErrors, payload)
    if (resp) {
      Message.success(resp.message || '已提交重扫，正在后台重新确认')
      // 稍后刷新表格，让错误/待确认计数回显
      setTimeout(() => void loadCrossRows(), 1500)
    }
  }
  finally {
    retryingRunId.value = ''
  }
}

// ===== 标签映射 =====
const modeLabels: Record<string, { label: string, color: string }> = {
  batch: { label: '平台编排', color: 'blue' },
  agent: { label: 'Agent', color: 'purple' },
}

// ===== 表格列 =====
const crossColumns = [
  { title: '应用', dataIndex: 'repository_name', width: 180, ellipsis: true, tooltip: true },
  { title: '模型', dataIndex: 'ai_model', slotName: 'crModel', width: 170 },
  { title: '模式', dataIndex: 'ai_mode', slotName: 'crMode', width: 100 },
  { title: '总数', dataIndex: 'total', width: 70 },
  { title: '确认进度', dataIndex: 'progress', slotName: 'crProgress', width: 90 },
  { title: '确认问题', dataIndex: 'confirmed', width: 85 },
  { title: '已排除', dataIndex: 'rejected', width: 80 },
  { title: '错误', dataIndex: 'error', width: 70 },
  { title: '待确认', dataIndex: 'pending', width: 80 },
  { title: '高风险', dataIndex: 'risk_high', width: 75 },
  { title: '中风险', dataIndex: 'risk_medium', width: 75 },
  { title: '低风险', dataIndex: 'risk_low', width: 75 },
  { title: '确认率', dataIndex: 'confirm_rate', slotName: 'crRate', width: 85 },
  { title: '平均置信度', dataIndex: 'avg_confidence', slotName: 'crConf', width: 95 },
  { title: '时间', dataIndex: 'created_at', width: 130 },
  { title: '操作', slotName: 'crOps', width: 170, fixed: 'right' as const },
]
</script>

<template>
  <div class="static-scan-runs">
    <!-- 应用选择 -->
    <a-card :bordered="false" class="m-b-12px">
      <a-space>
        <span class="selector-label">应用</span>
        <a-select
          v-model="selectedRepoId"
          allow-search
          allow-clear
          placeholder="全部应用"
          style="width: 420px"
        >
          <a-option v-for="repo in repositories" :key="repo.repository_id" :value="repo.repository_id">
            {{ repo.module_name }}（{{ repo.repository_name }}）
          </a-option>
        </a-select>
        <a-button type="primary" @click="onSearch">
          查询
        </a-button>
      </a-space>
    </a-card>

    <!-- 模型结果总览 -->
    <a-card :bordered="false">
      <template #title>
        模型结果总览
        <small class="card-sub">每行 = 一个「模型 × 模式」轮次，点击「查看明细」跳转扫描结果详情</small>
      </template>
      <a-table
        :loading="crossLoading"
        :data="crossRows"
        :columns="crossColumns"
        :pagination="false"
        :row-key="(r: CrossRunAggRow) => `${r.run_id}_${r.ai_model}_${r.ai_mode}`"
        size="small"
        :scroll="{ x: 1340 }"
      >
        <template #crModel="{ record }">
          <span class="model-name">{{ modelLabel(record) }}</span>
        </template>
        <template #crProgress="{ record }">
          <span :class="{ 'progress-done': progressLabel(record) === '100%' }">{{ progressLabel(record) }}</span>
        </template>
        <template #crMode="{ record }">
          <a-tag :color="modeLabels[record.ai_mode]?.color ?? 'gray'" size="small">
            {{ modeLabels[record.ai_mode]?.label ?? (record.ai_mode?.trim() ? record.ai_mode : '待确认') }}
          </a-tag>
        </template>
        <template #crRate="{ record }">
          {{ record.confirm_rate != null ? `${(record.confirm_rate * 100).toFixed(1)}%` : '-' }}
        </template>
        <template #crConf="{ record }">
          {{ record.avg_confidence != null ? Number(record.avg_confidence).toFixed(2) : '-' }}
        </template>
        <template #crOps="{ record }">
          <a-button type="text" size="small" @click="viewDetail(record)">
            查看明细
          </a-button>
          <a-button
            type="text"
            size="small"
            status="warning"
            :disabled="!record.error"
            :loading="retryingRunId === record.run_id"
            @click="retryErrors(record)"
          >
            重扫错误{{ record.error ? `(${record.error})` : '' }}
          </a-button>
        </template>
      </a-table>
    </a-card>
  </div>
</template>

<style scoped>
.static-scan-runs { padding: 0; }
.selector-label { color: var(--color-text-2); }
.card-sub { margin-left: 12px; color: var(--color-text-3); font-weight: normal; font-size: 12px; }
.model-name { font-weight: 500; }
.progress-done { color: rgb(var(--green-6)); font-weight: 500; }
</style>
