<template>
  <div class="container">
    <a-card :bordered="false" title="分析中心">
      <!-- 筛选栏 -->
      <a-row :gutter="16" style="margin-bottom: 12px" align="center">
        <a-col :span="5">
          <a-select v-model="filters.app_number" placeholder="应用（可细分）" allow-search allow-clear>
            <a-option v-for="a in appOptions" :key="a.code" :value="a.code">{{ a.name }}（{{ a.code }}）</a-option>
          </a-select>
        </a-col>
        <a-col :span="4">
          <a-input v-model="filters.form_id" placeholder="表单（可选）" allow-clear />
        </a-col>
        <a-col :span="4">
          <a-input v-model="filters.control_name" placeholder="控件（可选）" allow-clear />
        </a-col>
        <a-col :span="6">
          <a-range-picker v-model="dateRange" style="width: 100%" />
        </a-col>
        <a-col :span="3">
          <a-input-number v-model="filters.cost_threshold" placeholder="阈值(ms)" :min="0" :step="500" style="width: 100%" />
        </a-col>
        <a-col :span="2">
          <a-button type="primary" :loading="collecting" @click="handleCollect">收集慢请求</a-button>
        </a-col>
      </a-row>
      <a-row style="margin-bottom: 16px">
        <a-space>
          <a-button type="outline" status="success" @click="openTriggerModal">触发 AI 分析</a-button>
          <a-button @click="refreshAll">刷新</a-button>
          <span style="font-size: 12px; color: #86909c">收集最近 7 天慢请求 TraceID，触发后异步调用 AI 根因分析并自动产出问题与报告</span>
        </a-space>
      </a-row>

      <a-tabs v-model:active-key="activeTab">
        <!-- 慢请求列表 -->
        <a-tab-pane key="traces" title="慢请求列表">
          <a-table :data="traces" :loading="tracesLoading" :pagination="{ pageSize: 15, showTotal: true }" size="small" row-key="id">
            <template #columns>
              <a-table-column title="TraceID" data-index="trace_id" ellipsis />
              <a-table-column title="耗时(ms)" data-index="cost" :width="90" />
              <a-table-column title="应用" data-index="app_number" :width="120" ellipsis />
              <a-table-column title="表单" data-index="form_id" :width="140" ellipsis />
              <a-table-column title="租户" data-index="tenant_code" :width="120" ellipsis />
              <a-table-column title="客户" data-index="customer_name" :width="140" ellipsis />
              <a-table-column title="状态" data-index="status" :width="100">
                <template #cell="{ record }">
                  <a-tag :color="traceStatusColor(record.status)">{{ record.status }}</a-tag>
                </template>
              </a-table-column>
              <a-table-column title="分析模式" data-index="ai_mode" :width="90">
                <template #cell="{ record }">
                  <a-tag v-if="record.ai_mode === 'agent'" color="purple">Agent</a-tag>
                  <a-tag v-else-if="record.ai_mode === 'batch'" color="blue">批量</a-tag>
                  <span v-else style="color: #c9cdd4">—</span>
                </template>
              </a-table-column>
            </template>
          </a-table>
        </a-tab-pane>

        <!-- 分析任务 -->
        <a-tab-pane key="tasks" title="分析任务">
          <a-table :data="tasks" :loading="tasksLoading" :pagination="{ pageSize: 15, showTotal: true }" size="small" row-key="id">
            <template #columns>
              <a-table-column title="任务ID" data-index="id" :width="170" ellipsis />
              <a-table-column title="状态" data-index="status" :width="90">
                <template #cell="{ record }">
                  <a-tag :color="taskStatusColor(record.status)">{{ record.status }}</a-tag>
                </template>
              </a-table-column>
              <a-table-column title="模式" data-index="ai_mode" :width="80">
                <template #cell="{ record }">
                  <a-tag v-if="record.ai_mode === 'agent'" color="purple">Agent</a-tag>
                  <a-tag v-else-if="record.ai_mode === 'batch'" color="blue">批量</a-tag>
                  <span v-else>—</span>
                </template>
              </a-table-column>
              <a-table-column title="进度" :width="90">
                <template #cell="{ record }">{{ record.progress }}%</template>
              </a-table-column>
              <a-table-column title="结果摘要" data-index="result_summary" ellipsis />
              <a-table-column title="错误信息" data-index="error_msg" ellipsis />
              <a-table-column title="创建时间" data-index="created_at" :width="170" />
              <a-table-column title="操作" :width="90">
                <template #cell="{ record }">
                  <a-link v-if="record.report_id" @click="viewReport(record)">查看报告</a-link>
                </template>
              </a-table-column>
            </template>
          </a-table>
        </a-tab-pane>
      </a-tabs>
    </a-card>

    <!-- 触发分析弹框 -->
    <a-modal v-model:visible="triggerVisible" title="触发 AI 分析" :ok-loading="triggering" @ok="handleTrigger">
      <a-form :model="triggerForm" layout="vertical">
        <a-form-item label="分析模式">
          <a-radio-group v-model="triggerForm.mode" type="button">
            <a-radio value="batch">平台编排（批量）</a-radio>
            <a-radio value="agent">Agent 自主</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item label="AI 模型">
          <a-select v-model="triggerForm.model_override" placeholder="默认模型(auto)" allow-clear>
            <a-option value="Qwen3.8-Max-Preview">Qwen3.8-Max-Preview</a-option>
            <a-option value="GLM-5.2">GLM-5.2</a-option>
            <a-option value="Kimi-K3">Kimi-K3</a-option>
          </a-select>
        </a-form-item>
        <!-- batch 模式参数 -->
        <template v-if="triggerForm.mode === 'batch'">
          <a-form-item label="分析条数上限">
            <a-input-number v-model="triggerForm.max_traces" :min="1" :max="100" style="width: 100%" />
          </a-form-item>
          <a-form-item label="是否生成测试场景">
            <a-switch v-model="triggerForm.analyze_scenario" />
          </a-form-item>
          <a-form-item label="是否进行源码分析">
            <a-switch v-model="triggerForm.source_code_analysis" />
          </a-form-item>
        </template>
        <!-- agent 模式参数 -->
        <template v-else>
          <a-form-item label="分片数（按 app×form 拆分并行）">
            <a-input-number v-model="triggerForm.shard_count" :min="1" :max="5" style="width: 100%" />
          </a-form-item>
          <a-form-item label="超时(秒)">
            <a-input-number v-model="triggerForm.timeout_secs" :min="600" :max="7200" :step="600" style="width: 100%" />
          </a-form-item>
        </template>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { Message } from '@arco-design/web-vue'
import { ApiPerfOps, ApiPerfAnalysisTask, ApiPerfCompliance } from '@/api/perfApis'
import { useGet, usePost } from '@/hooks'

defineOptions({ name: 'analysis-center' })

const router = useRouter()
const activeTab = ref('traces')

// ── 筛选条件 ──────────────────────────────────
const filters = ref<any>({ app_number: undefined, form_id: '', control_name: '', cost_threshold: 3000 })

const fmtDate = (d: Date) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
const today = new Date()
const weekAgo = new Date(today.getTime() - 6 * 24 * 3600 * 1000)
const dateRange = ref<string[]>([fmtDate(weekAgo), fmtDate(today)])

const buildParams = () => ({
  product_line: '星瀚',
  app_number: filters.value.app_number || undefined,
  form_id: filters.value.form_id || undefined,
  control_name: filters.value.control_name || undefined,
  period_start: dateRange.value?.[0],
  period_end: dateRange.value?.[1],
  cost_threshold: filters.value.cost_threshold,
})

// ── 应用选项（dimension-options）──────────────────────────
const appOptions = ref<any[]>([])
const appOptPayload = ref<any>({ level: 'app', product_line: '星瀚' })
useGet<any>(ApiPerfCompliance.dimensionOptions, appOptPayload, {
  immediate: true,
  onSuccess(data: any) {
    appOptions.value = Array.isArray(data) ? data : []
  },
})

// ── 慢请求列表（collected-traces）──────────────────────────
const tracesPayload = ref<any>({ limit: 200 })
const { isFetching: tracesLoading, data: tracesData, execute: fetchTraces } = useGet<any>(ApiPerfOps.collectedTraces, tracesPayload, { immediate: true })
const traces = computed(() => (Array.isArray(tracesData.value) ? tracesData.value : []))

// 收集慢请求
const collectPayload = ref<any>({})
const { execute: doCollect, isFetching: collecting } = usePost<any>(ApiPerfOps.collectTraces, collectPayload, { immediate: false })
const handleCollect = async () => {
  collectPayload.value = buildParams()
  const res = await doCollect()
  if (res.data.value !== undefined && res.data.value !== null) {
    Message.success(`已收集 ${res.data.value} 条慢请求`)
    tracesPayload.value = { ...buildParams(), limit: 200 }
    fetchTraces()
  }
}

// ── 分析任务列表 ──────────────────────────────────
const tasksPayload = ref<any>({ task_type: 'ai_analysis', page_num: 1, page_size: 50 })
const { isFetching: tasksLoading, data: tasksData, execute: fetchTasks } = useGet<any>(ApiPerfAnalysisTask.getList, tasksPayload, { immediate: true })
const tasks = computed(() => tasksData.value?.list || [])

// 触发分析弹框
const triggerVisible = ref(false)
const triggerForm = ref({ mode: 'batch', model_override: undefined as string | undefined, max_traces: 20, analyze_scenario: false, source_code_analysis: false, shard_count: 3, timeout_secs: 3600 })
const openTriggerModal = () => {
  triggerForm.value = { mode: 'batch', model_override: undefined, max_traces: 20, analyze_scenario: false, source_code_analysis: false, shard_count: 3, timeout_secs: 3600 }
  triggerVisible.value = true
}

const triggerPayload = ref<any>({})
const { execute: doTrigger, isFetching: triggering } = usePost<any>(ApiPerfOps.triggerAnalysis, triggerPayload, { immediate: false })
const handleTrigger = async () => {
  triggerPayload.value = { ...buildParams(), ...triggerForm.value }
  const res = await doTrigger()
  if (res.data.value) {
    Message.success('分析任务已创建，后台执行中')
    triggerVisible.value = false
    activeTab.value = 'tasks'
    await fetchTasks()
    startPolling()
  }
}

// 任务轮询：存在 running/pending 时每 5 秒刷新
let pollTimer: any = null
const startPolling = () => {
  if (pollTimer) return
  pollTimer = setInterval(async () => {
    await fetchTasks()
    const hasRunning = tasks.value.some((t: any) => t.status === 'running' || t.status === 'pending')
    if (!hasRunning) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }, 5000)
}

const refreshAll = () => {
  tracesPayload.value = { ...buildParams(), limit: 200 }
  fetchTraces()
  fetchTasks()
}

const viewReport = (record: any) => {
  router.push({ path: '/cloud-perf/analysis/report-list', query: { id: record.report_id } })
}

// ── 状态颜色 ──────────────────────────────────
const traceStatusColor = (status: string) => {
  const map: Record<string, string> = { collected: 'blue', analyzing: 'orangered', succeeded: 'green', pending: 'gray', failed: 'red' }
  return map[status] || 'gray'
}
const taskStatusColor = (status: string) => {
  const map: Record<string, string> = { pending: 'gray', running: 'orangered', success: 'green', failed: 'red' }
  return map[status] || 'gray'
}

onMounted(() => {
  if (tasks.value.some((t: any) => t.status === 'running' || t.status === 'pending')) startPolling()
})
onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
})
</script>
