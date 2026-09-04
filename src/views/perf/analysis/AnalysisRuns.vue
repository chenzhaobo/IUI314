<script setup lang="ts">
import { Message, Modal } from '@arco-design/web-vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ApiPerfAnalysisJob, ApiPerfAnalysisTask } from '@/api/perfApis'
import { useGet, usePost, useTableAutoHeight } from '@/hooks'

defineOptions({ name: 'AnalysisRuns' })
const route = useRoute()
const router = useRouter()
const query = ref<any>({ job_id: route.query.job_id, task_type: 'analysis_workflow', page_num: 1, page_size: 20 })
const { data, isFetching: loading, execute: fetchRuns } = useGet<any>(ApiPerfAnalysisTask.getList, query, { immediate: true })
const runs = computed(() => data.value?.list || [])
const pagination = computed(() => ({ current: data.value?.page_num || 1, total: data.value?.total || 0, pageSize: 20, showTotal: true }))
function changePage(page: number) {
  query.value = { ...query.value, page_num: page }
  fetchRuns()
}

// 表格高度自适应：滚动条落在表格内，表头固定。容器必须是原生 div。
const tableWrap = ref<HTMLElement>()
const { tableHeight } = useTableAutoHeight(tableWrap)

const detailVisible = ref(false)
const selected = ref<any>()
function showDetail(record: any) {
  selected.value = record
  detailVisible.value = true
}
// 用路由名而不是硬编码全路径跳转：菜单树由后端 sys_menu 下发，
// 父级 path 改过就会让写死的全路径 404（'智能分析' 在迁移里是 analysis-report，
// 开发库被手改成 analysis，同一份代码在生产就 404 了）。叶子 path 全局唯一，
// 后端下发的 name 即叶子 path，按名跳转不受父级影响。
const viewReport = (record: any) => router.push({ name: 'report-list', query: { id: record.report_id } })

function parseParams(value: string) {
  try {
    return JSON.parse(value || '{}')
  }
  catch {
    return {}
  }
}
function pretty(value: any) {
  if (!value)
    return '—'
  try {
    return JSON.stringify(typeof value === 'string' ? JSON.parse(value) : value, null, 2)
  }
  catch {
    return String(value)
  }
}
const statusText = (status: string) => ({ pending: '等待中', running: '运行中', success: '成功', failed: '失败', cancelled: '已取消' } as Record<string, string>)[status] || status
const statusColor = (status: string) => ({ pending: 'gray', running: 'orangered', success: 'green', failed: 'red', cancelled: 'gray' } as Record<string, string>)[status] || 'gray'
const stageText = (stage?: string) => ({ collect_traces: '收集慢请求', download_logs: '下载日志', ai_analysis: 'AI 分析', report: '生成报告', completed: '已完成', failed: '失败' } as Record<string, string>)[stage || ''] || '等待开始'

const reanalyzePayload = ref<any>({})
const reanalyzingId = ref('')
const { execute: doReanalyze } = usePost<string>(ApiPerfAnalysisJob.reanalyze, reanalyzePayload, { immediate: false })
const canReanalyze = (record: any) => ['download_logs', 'ai_analysis', 'report', 'completed', 'failed'].includes(record.workflow_stage)
function reanalysisSourceRunId(record: any) {
  return parseParams(record.params).reanalyze_source_run_id || record.id
}
function reanalyze(record: any) {
  Modal.confirm({
    title: '重新分析已下载日志？',
    content: '将复用该运行已经下载的日志，重新读取反编译源码并生成一份新报告；不会重新下载，也不会创建真实问题。',
    okText: '开始重新分析',
    onOk: async () => {
      reanalyzingId.value = record.id
      try {
        reanalyzePayload.value = { run_id: reanalysisSourceRunId(record), generate_issues: false }
        await doReanalyze()
        Message.success('重分析任务已创建')
        await fetchRuns()
      }
      finally {
        reanalyzingId.value = ''
      }
    },
  })
}

let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  timer = setInterval(async () => {
    await fetchRuns()
    if (!runs.value.some((item: any) => ['pending', 'running'].includes(item.status))) {
      if (timer)
        clearInterval(timer)
      timer = undefined
    }
  }, 5000)
})
onUnmounted(() => {
  if (timer)
    clearInterval(timer)
})
</script>

<template>
  <div class="container">
    <a-card :bordered="false" title="分析任务运行">
      <template #extra>
        <a-space>
          <a-button @click="router.back()">
            返回任务列表
          </a-button><a-button @click="fetchRuns()">
            刷新
          </a-button>
        </a-space>
      </template>
      <a-alert style="margin-bottom: 16px">
        运行流程：收集慢请求 → 下载 Ops 日志 → AI 根因分析 → 生成问题与报告。“重新分析日志”会复用已下载文件，默认只生成新报告，不创建真实问题。
      </a-alert>
      <div ref="tableWrap">
      <a-table :data="runs" :loading="loading" :pagination="pagination" row-key="id" column-resizable :scroll="{ y: tableHeight }" @page-change="changePage">
        <template #columns>
          <a-table-column title="运行ID" data-index="id" :width="190" ellipsis tooltip />
          <a-table-column title="状态" :width="90">
            <template #cell="{ record }">
              <a-tag :color="statusColor(record.status)">
                {{ statusText(record.status) }}
              </a-tag>
            </template>
          </a-table-column>
          <a-table-column title="当前阶段" :width="130">
            <template #cell="{ record }">
              {{ stageText(record.workflow_stage) }}
            </template>
          </a-table-column>
          <a-table-column title="进度" :width="150">
            <template #cell="{ record }">
              <a-progress :percent="record.progress / 100" size="small" />
            </template>
          </a-table-column>
          <a-table-column title="模型/模式" :width="170">
            <template #cell="{ record }">
              {{ parseParams(record.params).model_override || '—' }} / {{ record.ai_mode || 'batch' }}
            </template>
          </a-table-column>
          <a-table-column title="结果摘要" data-index="result_summary" ellipsis tooltip />
          <a-table-column title="开始时间" data-index="started_at" :width="170" ellipsis tooltip />
          <a-table-column title="完成时间" data-index="finished_at" :width="170" ellipsis tooltip />
          <a-table-column title="操作" :width="230" fixed="right">
            <template #cell="{ record }">
              <a-space>
                <a-link @click="showDetail(record)">
                  详情
                </a-link>
                <a-link v-if="record.report_id" @click="viewReport(record)">
                  报告
                </a-link>
                <a-link v-if="canReanalyze(record)" :loading="reanalyzingId === record.id" @click="reanalyze(record)">
                  重新分析日志
                </a-link>
              </a-space>
            </template>
          </a-table-column>
        </template>
      </a-table>
      </div>
    </a-card>

    <a-drawer v-model:visible="detailVisible" title="运行详情" :width="720" :footer="false">
      <a-descriptions v-if="selected" :column="1" bordered>
        <a-descriptions-item label="运行ID">
          {{ selected.id }}
        </a-descriptions-item>
        <a-descriptions-item label="状态">
          {{ statusText(selected.status) }}
        </a-descriptions-item>
        <a-descriptions-item label="当前阶段">
          {{ stageText(selected.workflow_stage) }}
        </a-descriptions-item>
        <a-descriptions-item label="参数">
          <pre>{{ pretty(selected.params) }}</pre>
        </a-descriptions-item>
        <a-descriptions-item label="执行详情">
          <pre>{{ pretty(selected.result_detail) }}</pre>
        </a-descriptions-item>
        <a-descriptions-item label="结果摘要">
          {{ selected.result_summary || '—' }}
        </a-descriptions-item>
        <a-descriptions-item label="错误信息">
          <a-typography-text :type="selected.error_msg ? 'danger' : undefined">
            {{ selected.error_msg || '—' }}
          </a-typography-text>
        </a-descriptions-item>
      </a-descriptions>
    </a-drawer>
  </div>
</template>

<style scoped>
pre { margin: 0; max-height: 360px; overflow: auto; white-space: pre-wrap; word-break: break-all; }
</style>
