<template>
  <div class="container">
    <a-card :bordered="false" title="分析任务运行">
      <template #extra>
        <a-space><a-button @click="router.back()">返回任务列表</a-button><a-button @click="fetchRuns()">刷新</a-button></a-space>
      </template>
      <a-alert style="margin-bottom: 16px">运行流程：收集慢请求 → 下载 Ops 日志 → AI 根因分析 → 生成问题与报告。运行失败时请根据阶段和错误信息处理后重新执行任务。</a-alert>
      <a-table :data="runs" :loading="loading" :pagination="pagination" row-key="id" @page-change="changePage">
        <template #columns>
          <a-table-column title="运行ID" data-index="id" :width="190" ellipsis />
          <a-table-column title="状态" :width="90"><template #cell="{ record }"><a-tag :color="statusColor(record.status)">{{ statusText(record.status) }}</a-tag></template></a-table-column>
          <a-table-column title="当前阶段" :width="130"><template #cell="{ record }">{{ stageText(record.workflow_stage) }}</template></a-table-column>
          <a-table-column title="进度" :width="150"><template #cell="{ record }"><a-progress :percent="record.progress / 100" size="small" /></template></a-table-column>
          <a-table-column title="模型/模式" :width="170"><template #cell="{ record }">{{ parseParams(record.params).model_override || '—' }} / {{ record.ai_mode || 'batch' }}</template></a-table-column>
          <a-table-column title="结果摘要" data-index="result_summary" ellipsis />
          <a-table-column title="开始时间" data-index="started_at" :width="170" />
          <a-table-column title="完成时间" data-index="finished_at" :width="170" />
          <a-table-column title="操作" :width="150" fixed="right">
            <template #cell="{ record }">
              <a-space><a-link @click="showDetail(record)">详情</a-link><a-link v-if="record.report_id" @click="viewReport(record)">报告</a-link></a-space>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </a-card>

    <a-drawer v-model:visible="detailVisible" title="运行详情" :width="720" :footer="false">
      <a-descriptions v-if="selected" :column="1" bordered>
        <a-descriptions-item label="运行ID">{{ selected.id }}</a-descriptions-item>
        <a-descriptions-item label="状态">{{ statusText(selected.status) }}</a-descriptions-item>
        <a-descriptions-item label="当前阶段">{{ stageText(selected.workflow_stage) }}</a-descriptions-item>
        <a-descriptions-item label="参数"><pre>{{ pretty(selected.params) }}</pre></a-descriptions-item>
        <a-descriptions-item label="执行详情"><pre>{{ pretty(selected.result_detail) }}</pre></a-descriptions-item>
        <a-descriptions-item label="结果摘要">{{ selected.result_summary || '—' }}</a-descriptions-item>
        <a-descriptions-item label="错误信息"><a-typography-text :type="selected.error_msg ? 'danger' : undefined">{{ selected.error_msg || '—' }}</a-typography-text></a-descriptions-item>
      </a-descriptions>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ApiPerfAnalysisTask } from '@/api/perfApis'
import { useGet } from '@/hooks'

defineOptions({ name: 'analysis-runs' })
const route = useRoute()
const router = useRouter()
const query = ref<any>({ job_id: route.query.job_id, task_type: 'analysis_workflow', page_num: 1, page_size: 20 })
const { data, isFetching: loading, execute: fetchRuns } = useGet<any>(ApiPerfAnalysisTask.getList, query, { immediate: true })
const runs = computed(() => data.value?.list || [])
const pagination = computed(() => ({ current: data.value?.page_num || 1, total: data.value?.total || 0, pageSize: 20, showTotal: true }))
const changePage = (page: number) => { query.value = { ...query.value, page_num: page }; fetchRuns() }

const detailVisible = ref(false)
const selected = ref<any>()
const showDetail = (record: any) => { selected.value = record; detailVisible.value = true }
const viewReport = (record: any) => router.push({ path: '/cloud-perf/analysis/report-list', query: { id: record.report_id } })

const parseParams = (value: string) => { try { return JSON.parse(value || '{}') } catch { return {} } }
const pretty = (value: any) => {
  if (!value) return '—'
  try { return JSON.stringify(typeof value === 'string' ? JSON.parse(value) : value, null, 2) } catch { return String(value) }
}
const statusText = (status: string) => ({ pending: '等待中', running: '运行中', success: '成功', failed: '失败', cancelled: '已取消' } as Record<string, string>)[status] || status
const statusColor = (status: string) => ({ pending: 'gray', running: 'orangered', success: 'green', failed: 'red', cancelled: 'gray' } as Record<string, string>)[status] || 'gray'
const stageText = (stage?: string) => ({ collect_traces: '收集慢请求', download_logs: '下载日志', ai_analysis: 'AI 分析', report: '生成报告', completed: '已完成', failed: '失败' } as Record<string, string>)[stage || ''] || '等待开始'

let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  timer = setInterval(async () => {
    await fetchRuns()
    if (!runs.value.some((item: any) => ['pending', 'running'].includes(item.status))) {
      if (timer) clearInterval(timer)
      timer = undefined
    }
  }, 5000)
})
onUnmounted(() => { if (timer) clearInterval(timer) })
</script>

<style scoped>
pre { margin: 0; max-height: 360px; overflow: auto; white-space: pre-wrap; word-break: break-all; }
</style>
