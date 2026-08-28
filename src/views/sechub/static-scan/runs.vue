<script setup lang="ts">
import type { CrossRunAggRow, ModuleWithRepository } from '@/types/static-scan'
import { Message } from '@arco-design/web-vue'
import { computed, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ErrorFlag } from '@/api/apis'
import { ApiSecModuleRepository, ApiSecPrescan } from '@/api/sechubApis'
import { useGet, usePost } from '@/hooks'
import { pendingSubLabel, pendingTooltip, runStatusLabels } from './labels'

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

// ===== 模型结果总览（跨 Run 横评：后端已改为每个 run_id 只返回一行汇总）=====
const crossRows = ref<CrossRunAggRow[]>([])
// 行 key 直接用 run_id（后端保证每个 run_id 只有一行，不再需要拼 ai_model/ai_mode）
const crossTableRows = computed(() => crossRows.value.map(row => ({
  ...row,
  key: row.run_id,
})))
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

// ===== AI 确认轮询：任一任务存在待确认候选时每 5 秒静默刷新 =====
const pollTimer = ref<ReturnType<typeof setTimeout> | null>(null)
function schedulePollIfNeeded() {
  if (pollTimer.value) {
    clearTimeout(pollTimer.value)
    pollTimer.value = null
  }
  // 除了「还有待确认候选」，只要有批次在排队或执行中也要继续轮询，
  // 否则「排队中 → 执行中 → 完成」的阶段变化不会自动回显。
  const active = crossRows.value.some(r =>
    (r.pending ?? 0) > 0 || (r.ai_exec_pending ?? 0) > 0 || (r.ai_exec_running ?? 0) > 0,
  )
  if (active)
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
// 注意：ai_model 现在可能是逗号聚合值（如 "modelA,modelB"），无法作为单一筛选条件传给
// 结果页的 ai_model 过滤参数（后端只接受精确值）。这里故意不传 ai_model/ai_mode，
// 跳转后由用户在结果页自行筛选，避免错误过滤导致看不到任何数据。
function viewDetail(row: CrossRunAggRow) {
  router.push({
    path: '/static-scan/scan/results',
    query: {
      run_id: row.run_id,
      repository_id: row.repository_id,
    },
  })
}

// ===== 查看错误 → 跳转扫描结果详情并预置 ai_status=error 筛选 =====
function viewErrors(row: CrossRunAggRow) {
  router.push({
    path: '/static-scan/scan/results',
    query: {
      run_id: row.run_id,
      repository_id: row.repository_id,
      ai_status: 'error',
    },
  })
}

/**
 * 模型列文案：
 * - ai_model 非空直接展示（可能是逗号分隔的多模型聚合值）
 * - 为空时展示"待AI确认"（该 run 尚未经 AI 处理）
 */
function modelLabel(row: CrossRunAggRow): string {
  return row.ai_model?.trim() || '待AI确认'
}

/**
 * 确认进度标签：直接用行自身字段（后端已按 run 汇总，不再需要跨行聚合）。
 * 只有 pending/error/review_needed 全为 0 时才算 100%。
 */
function progressLabel(row: CrossRunAggRow): string {
  const total = row.total ?? 0
  if (total === 0)
    return '-'
  const pending = row.pending ?? 0
  const error = row.error ?? 0
  const reviewNeeded = row.review_needed ?? 0
  const done = total - pending - error - reviewNeeded
  return `${Math.round((done / total) * 100)}%`
}

/** 确认进度是否已全部完成（pending/error/review_needed 全为 0） */
function progressDone(row: CrossRunAggRow): boolean {
  return (row.pending ?? 0) === 0 && (row.error ?? 0) === 0 && (row.review_needed ?? 0) === 0
}

/** 确认状态列的 tag 颜色：error 优先红色，review_needed 橙色，pending 蓝色，全完成绿色 */
function pendingTagColor(row: CrossRunAggRow): string {
  if ((row.error ?? 0) > 0)
    return 'red'
  if ((row.review_needed ?? 0) > 0)
    return 'orangered'
  if ((row.pending ?? 0) > 0)
    return 'blue'
  // 全部完成时参考 run 本身状态
  return runStatusLabels[row.status]?.color ?? 'green'
}

/**
 * 该 run 是否已经触发过 AI 确认。
 *
 * 两个依据取其一即可：
 * - 有关联的 AI 执行记录（本次改动起 batch/agent 的 caller_id 都是 run_id）
 * - 或候选里已经出现过任何 AI 结论（历史 run 的执行记录挂在 rule_version_id 上，查不到）
 */
function confirmTriggered(row: CrossRunAggRow): boolean {
  if ((row.ai_exec_total ?? 0) > 0)
    return true
  return (row.confirmed ?? 0) > 0 || (row.rejected ?? 0) > 0
    || (row.error ?? 0) > 0 || (row.review_needed ?? 0) > 0
}

/**
 * 确认状态文案。优先表达「进行到哪一步」，其次才是结果分布——
 * 因为候选在 AI 写回结果前始终是 pending，只看数字无法区分
 * 「从未触发」「已触发在排队」「正在跑」。
 */
function confirmStateLabel(row: CrossRunAggRow): string {
  const running = row.ai_exec_running ?? 0
  const queued = row.ai_exec_pending ?? 0
  if (running > 0)
    return queued > 0 ? `执行中 ${running}，排队 ${queued}` : `执行中 ${running}`
  if (queued > 0)
    return `排队中 ${queued}`
  if (!confirmTriggered(row))
    return '未触发 AI 确认'
  return pendingSubLabel(row.status, row.pending ?? 0, row.error ?? 0, row.review_needed ?? 0)
}

/** 确认状态颜色：执行中蓝、排队中黄、未触发灰，其余沿用候选结果配色 */
function confirmStateColor(row: CrossRunAggRow): string {
  if ((row.ai_exec_running ?? 0) > 0)
    return 'blue'
  if ((row.ai_exec_pending ?? 0) > 0)
    return 'gold'
  if (!confirmTriggered(row))
    return 'gray'
  return pendingTagColor(row)
}

/** 确认状态 tooltip：把执行阶段与候选分布一起说清楚 */
function confirmStateTooltip(row: CrossRunAggRow): string {
  const lines: string[] = []
  const running = row.ai_exec_running ?? 0
  const queued = row.ai_exec_pending ?? 0
  if (!confirmTriggered(row)) {
    lines.push('尚未触发 AI 确认。可在扫描看板选中该运行后点「AI 确认」。')
  }
  else {
    if (queued > 0)
      lines.push(`${queued} 个批次在排队（等后端 AI 并发槽位，全局上限 5）`)
    if (running > 0)
      lines.push(`${running} 个批次正在执行（单批超时见平台配置，默认 600 秒）`)
    if (queued === 0 && running === 0)
      lines.push('没有正在进行的 AI 批次')
  }
  lines.push(pendingTooltip(row.pending ?? 0, row.error ?? 0, row.review_needed ?? 0))
  return lines.join('\n')
}

// ===== 一键重扫错误候选（整个轮次）=====
const retryingRunId = ref('')
// 可重跑数量 = error + 未确认 + 待人工复核
// 后端 retry-errors 实际重置就是这三种状态（RETRYABLE_AI_STATUSES）
function retryableCount(row: CrossRunAggRow) {
  return (row.error || 0) + (row.pending || 0) + (row.review_needed || 0)
}

async function retryErrors(row: CrossRunAggRow) {
  retryingRunId.value = row.run_id
  try {
    // 后端 retry-errors 的 model 是「重跑时用哪个模型」的覆盖项，不是筛选条件：
    // 不传就退回 Agent 默认模型。所以这里只在该轮次确实只用过一个模型时透传，
    // 保持「按原模型重跑」；聚合出多个模型时无法确定用哪个，交给后端默认值。
    const payload: Record<string, any> = { run_id: row.run_id }
    const models = (row.ai_model ?? '').split(',').map(m => m.trim()).filter(Boolean)
    if (models.length === 1)
      payload.model = models[0]
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

/**
 * 提取 commit 短 sha（前 8 位）。
 * commit_sha 可能为 null/undefined，返回空字符串时模板展示占位符。
 */
function shortSha(sha: string | null | undefined): string {
  return sha?.slice(0, 8) ?? ''
}

/**
 * commit 列 tooltip 文案：完整 sha + commit_time（如有）。
 */
function commitTooltip(row: CrossRunAggRow): string {
  const parts: string[] = []
  if (row.commit_sha)
    parts.push(`完整 SHA：${row.commit_sha}`)
  if (row.commit_time)
    parts.push(`提交时间：${row.commit_time}`)
  return parts.join('\n') || ''
}

// ===== 表格列 =====
// 新增分支、commit 列；操作列收窄（改为下拉）；总列宽控制在 ~1400 以内
const crossColumns = [
  { title: '应用', dataIndex: 'repository_name', width: 160, ellipsis: true, tooltip: true },
  { title: '分支', dataIndex: 'branch', slotName: 'crBranch', width: 120, ellipsis: true },
  { title: 'Commit', dataIndex: 'commit_sha', slotName: 'crCommit', width: 110 },
  { title: '模型', dataIndex: 'ai_model', slotName: 'crModel', width: 150, ellipsis: true },
  { title: '模式', dataIndex: 'ai_mode', slotName: 'crMode', width: 95 },
  { title: '总数', dataIndex: 'total', width: 65 },
  { title: '确认进度', dataIndex: 'progress', slotName: 'crProgress', width: 85 },
  { title: '确认问题', dataIndex: 'confirmed', width: 80 },
  { title: '已排除', dataIndex: 'rejected', width: 75 },
  { title: '错误', dataIndex: 'error', width: 60 },
  { title: '待确认', dataIndex: 'pending', slotName: 'crPending', width: 150 },
  { title: '高风险', dataIndex: 'risk_high', width: 70 },
  { title: '中风险', dataIndex: 'risk_medium', width: 70 },
  { title: '低风险', dataIndex: 'risk_low', width: 70 },
  { title: '确认率', dataIndex: 'confirm_rate', slotName: 'crRate', width: 80 },
  { title: '平均置信度', dataIndex: 'avg_confidence', slotName: 'crConf', width: 90 },
  { title: '时间', dataIndex: 'created_at', width: 120 },
  { title: '操作', slotName: 'crOps', width: 160, fixed: 'right' as const },
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
        <small class="card-sub">每行 = 一个扫描任务（run），点击操作查看明细或重扫</small>
      </template>
      <a-table
        :loading="crossLoading"
        :data="crossTableRows"
        :columns="crossColumns"
        :pagination="false"
        row-key="key"
        size="small"
        :scroll="{ x: 1400 }"
      >
        <!-- 分支列：null 时展示占位符 -->
        <template #crBranch="{ record }">
          <span class="branch-name">{{ record.branch ?? '-' }}</span>
        </template>

        <!-- Commit 列：短 sha，tooltip 展示完整 sha + 提交时间 -->
        <template #crCommit="{ record }">
          <a-tooltip v-if="record.commit_sha" :content="commitTooltip(record)" position="top">
            <span class="commit-sha">{{ shortSha(record.commit_sha) }}</span>
          </a-tooltip>
          <span v-else class="text-placeholder">-</span>
        </template>

        <!-- 模型列：ai_model 非空直接展示（可能是逗号聚合的多模型）；为空展示"待AI确认" -->
        <template #crModel="{ record }">
          <a-tooltip v-if="record.ai_model?.trim()" :content="record.ai_model" position="top">
            <span class="model-name">{{ modelLabel(record) }}</span>
          </a-tooltip>
          <span v-else class="text-placeholder">{{ modelLabel(record) }}</span>
        </template>

        <!-- 确认进度列 -->
        <template #crProgress="{ record }">
          <span :class="{ 'progress-done': progressDone(record) }">{{ progressLabel(record) }}</span>
        </template>

        <!-- 模式列 -->
        <template #crMode="{ record }">
          <a-tag
            v-if="record.ai_mode?.trim()"
            :color="modeLabels[record.ai_mode]?.color ?? 'gray'"
            size="small"
          >
            {{ modeLabels[record.ai_mode]?.label ?? record.ai_mode }}
          </a-tag>
          <span v-else class="text-placeholder">-</span>
        </template>

        <!-- 确认率列 -->
        <template #crRate="{ record }">
          {{ record.confirm_rate != null ? `${(record.confirm_rate * 100).toFixed(1)}%` : '-' }}
        </template>

        <!-- 平均置信度列 -->
        <template #crConf="{ record }">
          {{ record.avg_confidence != null ? Number(record.avg_confidence).toFixed(2) : '-' }}
        </template>

        <!-- 待确认列：先表达 AI 确认的「是否触发 / 排队中 / 执行中」，再表达候选结果分布 -->
        <template #crPending="{ record }">
          <a-tooltip :content="confirmStateTooltip(record)" position="top">
            <a-tag :color="confirmStateColor(record)" size="small">
              {{ confirmStateLabel(record) }}
            </a-tag>
          </a-tooltip>
        </template>

        <!-- 操作列：最常用"查看明细"在外，其余收入"更多"下拉 -->
        <template #crOps="{ record }">
          <a-space :size="4">
            <!-- 主操作：查看明细 -->
            <a-button type="text" size="small" @click="viewDetail(record)">
              查看明细
            </a-button>
            <!-- 更多操作下拉 -->
            <a-dropdown trigger="click">
              <a-button type="text" size="small">
                更多<icon-down />
              </a-button>
              <template #content>
                <!-- 查看错误：仅在有 error 时启用 -->
                <a-doption
                  :disabled="!record.error"
                  @click="() => record.error && viewErrors(record)"
                >
                  查看错误{{ record.error ? `(${record.error})` : '' }}
                </a-doption>
                <!-- 重扫未完成：可重跑数量为 0 时禁用 -->
                <a-doption
                  :disabled="retryableCount(record) === 0 || retryingRunId === record.run_id"
                  @click="() => retryableCount(record) > 0 && retryErrors(record)"
                >
                  <a-spin v-if="retryingRunId === record.run_id" :size="12" />
                  重扫未完成{{ retryableCount(record) ? `(${retryableCount(record)})` : '' }}
                </a-doption>
              </template>
            </a-dropdown>
          </a-space>
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
.branch-name { font-family: var(--font-mono, monospace); font-size: 12px; color: var(--color-text-2); }
.commit-sha { font-family: var(--font-mono, monospace); font-size: 12px; cursor: default; }
.text-placeholder { color: var(--color-text-4); }
</style>
