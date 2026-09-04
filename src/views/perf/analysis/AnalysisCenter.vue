<template>
  <div class="page-container">
    <a-card :bordered="false" title="分析任务">
      <template #extra>
        <a-space>
          <a-input-search v-model="query.keyword" placeholder="任务名 / 应用 / 表单" allow-clear style="width: 260px" @search="fetchJobs()" />
          <a-button @click="fetchJobs()">刷新</a-button>
          <a-button type="primary" @click="openCreate">新增分析任务</a-button>
        </a-space>
      </template>

      <a-alert style="margin-bottom: 16px">
        每次执行按“收集慢请求 → 下载 Ops 日志 → AI 分析 → 生成报告”顺序运行；结果与阶段进度请进入任务运行页查看。
      </a-alert>

      <div ref="tableWrap">
      <a-table :data="jobs" :loading="loading" :pagination="pagination" row-key="id" column-resizable :scroll="{ y: tableHeight }" @page-change="changePage">
        <template #columns>
          <a-table-column title="任务名称" data-index="task_name" :width="190" ellipsis tooltip />
          <a-table-column title="分析范围" :width="230">
            <template #cell="{ record }">
              <div>{{ record.product_line }} / {{ record.app_number || '全部应用' }}</div>
              <div class="muted">{{ record.form_id || '全部表单' }}{{ record.control_name ? ` / ${record.control_name}` : '' }}</div>
            </template>
          </a-table-column>
          <a-table-column title="时间范围" :width="150">
            <template #cell="{ record }">
              <span v-if="record.period_type === 'fixed'">{{ record.period_start }} ~ {{ record.period_end }}</span>
              <span v-else>最近 {{ record.recent_days }} 天</span>
            </template>
          </a-table-column>
          <a-table-column title="阈值 / 条数" :width="130">
            <template #cell="{ record }">{{ record.cost_threshold }}ms / {{ record.max_traces }}条</template>
          </a-table-column>
          <a-table-column title="Agent" :width="150">
            <template #cell="{ record }">{{ agentDisplayName(record.agent_code) }}</template>
          </a-table-column>
          <a-table-column title="模型" data-index="model" :width="160" ellipsis tooltip />
          <a-table-column title="流程" :width="210">
            <template #cell>
              <a-space size="mini">
                <a-tag color="blue">下载日志</a-tag><span>→</span><a-tag color="purple">AI分析</a-tag><span>→</span><a-tag color="green">报告</a-tag>
              </a-space>
            </template>
          </a-table-column>
          <a-table-column title="状态" :width="80">
            <template #cell="{ record }"><a-tag :color="record.enabled ? 'green' : 'gray'">{{ record.enabled ? '启用' : '停用' }}</a-tag></template>
          </a-table-column>
          <a-table-column title="更新时间" data-index="updated_at" :width="170" ellipsis tooltip />
          <a-table-column title="操作" :width="250" fixed="right">
            <template #cell="{ record }">
              <a-space>
                <a-link :disabled="!record.enabled" @click="runJob(record)">执行</a-link>
                <a-link @click="viewRuns(record)">运行记录</a-link>
                <a-link @click="openEdit(record)">编辑</a-link>
                <a-link status="danger" @click="removeJob(record)">删除</a-link>
              </a-space>
            </template>
          </a-table-column>
        </template>
      </a-table>
      </div>
    </a-card>

    <a-modal v-model:visible="editorVisible" :title="form.id ? '编辑分析任务' : '新增分析任务'" :ok-loading="saving" width="720px" @ok="saveJob">
      <a-form :model="form" layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12"><a-form-item label="任务名称" required><a-input v-model="form.task_name" placeholder="例如：集团财务近7天慢请求分析" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="产品线"><a-select v-model="form.product_line"><a-option value="星瀚">星瀚</a-option><a-option value="星空">星空</a-option></a-select></a-form-item></a-col>
          <a-col :span="12">
            <a-form-item label="应用（可选）">
              <a-select v-model="form.app_number" allow-search allow-clear placeholder="全部应用">
                <a-option v-for="item in appOptions" :key="item.code" :value="item.code">{{ item.name }}（{{ item.code }}）</a-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="6"><a-form-item label="表单（可选）"><a-input v-model="form.form_id" allow-clear /></a-form-item></a-col>
          <a-col :span="6"><a-form-item label="控件（可选）"><a-input v-model="form.control_name" allow-clear /></a-form-item></a-col>
          <a-col :span="8"><a-form-item label="时间模式"><a-radio-group v-model="form.period_type"><a-radio value="recent_days">最近天数</a-radio><a-radio value="fixed">固定日期</a-radio></a-radio-group></a-form-item></a-col>
          <a-col v-if="form.period_type === 'recent_days'" :span="8"><a-form-item label="最近天数"><a-input-number v-model="form.recent_days" :min="1" :max="90" style="width: 100%" /></a-form-item></a-col>
          <a-col v-else :span="16"><a-form-item label="固定日期"><a-range-picker v-model="fixedRange" value-format="YYYY-MM-DD" style="width: 100%" /></a-form-item></a-col>
          <a-col :span="8"><a-form-item label="慢请求阈值(ms)"><a-input-number v-model="form.cost_threshold" :min="0" :step="500" style="width: 100%" /></a-form-item></a-col>
          <a-col :span="8"><a-form-item label="分析条数"><a-input-number v-model="form.max_traces" :min="1" :max="100" style="width: 100%" /></a-form-item></a-col>
          <a-col :span="8">
            <a-form-item label="执行 Agent" required>
              <a-select v-model="form.agent_code" :loading="agentLoading" placeholder="请选择 AI 中心 Agent">
                <a-option v-for="agent in agents" :key="agent.id" :value="agent.agent_code">
                  {{ agent.agent_name }}（{{ agent.agent_code }}）
                </a-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="AI 模型" required>
              <a-select
                v-model="form.model"
                :placeholder="form.agent_code ? '请选择模型' : '请先选择执行 Agent'"
                :disabled="!form.agent_code"
              >
                <a-option v-for="name in modelOptions" :key="name" :value="name">{{ name }}</a-option>
              </a-select>
              <template #extra>
                <span>选项取自所选 Agent 的「支持的模型」，可在 AI 中心点「同步模型」从 CLI 刷新。</span>
              </template>
            </a-form-item>
          </a-col>
          <a-col :span="8"><a-form-item label="源码分析"><a-switch v-model="form.source_code_analysis" /></a-form-item></a-col>
          <a-col :span="8"><a-form-item label="生成测试场景"><a-switch v-model="form.analyze_scenario" /></a-form-item></a-col>
          <a-col :span="8"><a-form-item label="启用"><a-switch v-model="form.enabled" /></a-form-item></a-col>
        </a-row>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Message, Modal } from '@arco-design/web-vue'
import { ApiAiAgent, type AiAgent, type AiListResult } from '@/api/aiApis'
import { ApiPerfAnalysisJob, ApiPerfCompliance } from '@/api/perfApis'
import { useGet, usePost, useTableAutoHeight } from '@/hooks'

defineOptions({ name: 'analysis-center' })

const router = useRouter()
const query = ref<any>({ keyword: '', page_num: 1, page_size: 20 })
const { data, isFetching: loading, execute: fetchJobs } = useGet<any>(ApiPerfAnalysisJob.getList, query, { immediate: true })
const jobs = computed(() => data.value?.list || [])
const pagination = computed(() => ({ current: data.value?.page_num || 1, total: data.value?.total || 0, pageSize: 20, showTotal: true }))
const changePage = (page: number) => { query.value = { ...query.value, page_num: page }; fetchJobs() }

// 表格高度自适应：滚动条落在表格内，表头固定。容器必须是原生 div（组件 ref 是实例，没有 getBoundingClientRect）
const tableWrap = ref<HTMLElement>()
const { tableHeight } = useTableAutoHeight(tableWrap)

const appOptions = ref<any[]>([])
const appPayload = ref<any>({ level: 'app', product_line: '星瀚' })
useGet<any>(ApiPerfCompliance.dimensionOptions, appPayload, { immediate: true, onSuccess(value: any) { appOptions.value = Array.isArray(value) ? value : [] } })

const { data: agentData, isFetching: agentLoading } = useGet<AiListResult<AiAgent>>(
  ApiAiAgent.getList,
  { status: 'active', page_num: 1, page_size: 100 },
  { immediate: true },
)
const agents = computed(() => agentData.value?.list || [])
const defaultAgentCode = () => agents.value.find(agent => agent.agent_code === 'kiro-cli')?.agent_code || agents.value[0]?.agent_code || 'kiro-cli'
const agentDisplayName = (agentCode?: string) => {
  if (!agentCode) return '-'
  const agent = agents.value.find(item => item.agent_code === agentCode)
  return agent ? `${agent.agent_name}（${agent.agent_code}）` : agentCode
}

const defaultForm = () => ({
  id: undefined as string | undefined,
  task_name: '', product_line: '星瀚', app_number: undefined as string | undefined,
  form_id: '', control_name: '', period_type: 'recent_days', recent_days: 7,
  cost_threshold: 3000, max_traces: 20, source_code_analysis: false,
  analyze_scenario: false, mode: 'batch', agent_code: defaultAgentCode(), model: 'gpt-5.6-terra', enabled: true,
})
const editorVisible = ref(false)
const form = ref<any>(defaultForm())

// 模型选项跟随所选 Agent 的 supported_models_json。
//
// 原先前端写死 4 个 gpt/claude 模型、后端 ALLOWED_MODELS 也是同一份硬编码，
// 于是选了 qoder-cli 仍只能选 kiro 的模型，选完还会被后端拒。各 Agent 支持的模型
// 本来就不同（kiro-cli 19 个、qoder 系列 15 个），且随 CLI 升级变化
// （GLM-5.2 → GLM-5.3 就是这么过期的），只能以库里的清单为准。
const modelOptions = computed<string[]>(() => {
  const agent = agents.value.find(item => item.agent_code === form.value.agent_code)
  if (!agent?.supported_models_json)
    return []
  try {
    const parsed = JSON.parse(agent.supported_models_json)
    return Array.isArray(parsed) ? parsed.filter((v: unknown): v is string => typeof v === 'string' && v.length > 0) : []
  }
  catch {
    // 库里存的不是合法 JSON 时不要让下拉炸掉，留空并靠 placeholder 提示
    return []
  }
})

// 切换 Agent 后原模型可能不在新 Agent 的清单里，留着会提交出后端拒绝的值。
// 优先回落到该 Agent 的默认模型，其次取清单第一项。
watch(() => form.value.agent_code, (code) => {
  if (!code)
    return
  const options = modelOptions.value
  if (form.value.model && options.includes(form.value.model))
    return
  const agent = agents.value.find(item => item.agent_code === code)
  form.value.model = (agent?.default_model && options.includes(agent.default_model))
    ? agent.default_model
    : (options[0] ?? '')
})

const fixedRange = ref<string[]>([])
const openCreate = () => { form.value = defaultForm(); fixedRange.value = []; editorVisible.value = true }
const openEdit = (record: any) => {
  form.value = { ...defaultForm(), ...record }
  fixedRange.value = record.period_start && record.period_end ? [record.period_start, record.period_end] : []
  editorVisible.value = true
}

const savePayload = ref<any>({})
const { execute: doSave, isFetching: saving } = usePost<any>(ApiPerfAnalysisJob.save, savePayload, { immediate: false })
const saveJob = async () => {
  if (!form.value.task_name?.trim()) { Message.warning('请输入任务名称'); return }
  if (!form.value.agent_code?.trim()) { Message.warning('请选择执行 Agent'); return }
  if (form.value.period_type === 'fixed' && fixedRange.value.length !== 2) { Message.warning('请选择固定日期范围'); return }
  savePayload.value = {
    ...form.value,
    period_start: form.value.period_type === 'fixed' ? fixedRange.value[0] : undefined,
    period_end: form.value.period_type === 'fixed' ? fixedRange.value[1] : undefined,
  }
  const result = await doSave()
  if (result.data.value) { Message.success('分析任务已保存'); editorVisible.value = false; fetchJobs() }
}

const runPayload = ref<any>({})
const { execute: doRun } = usePost<any>(ApiPerfAnalysisJob.run, runPayload, { immediate: false })
const runJob = async (record: any) => {
  runPayload.value = { id: record.id }
  const result = await doRun()
  if (result.data.value) {
    Message.success('任务已开始：正在收集并下载日志')
    router.push({ name: 'analysis-runs', query: { job_id: record.id, run_id: result.data.value } })
  }
}
// 用路由名而不是硬编码全路径跳转：菜单树由后端 sys_menu 下发，
// 父级 path 改过就会让写死的全路径 404（'智能分析' 在迁移里是 analysis-report，
// 开发库被手改成 analysis，同一份代码在生产就 404 了）。叶子 path 全局唯一，
// 后端下发的 name 即叶子 path，按名跳转不受父级影响。
const viewRuns = (record: any) => router.push({ name: 'analysis-runs', query: { job_id: record.id } })

const deletePayload = ref<any>({})
const { execute: doDelete } = usePost<any>(ApiPerfAnalysisJob.delete, deletePayload, { immediate: false })
const removeJob = (record: any) => {
  Modal.warning({
    title: '删除分析任务',
    content: `确认删除“${record.task_name}”？历史运行记录不会删除。`,
    hideCancel: false,
    onOk: async () => {
      deletePayload.value = { id: record.id }
      const result = await doDelete()
      if (result.data.value) { Message.success('已删除'); fetchJobs() }
    },
  })
}
</script>

<style scoped>
.muted { color: var(--color-text-3); font-size: 12px; margin-top: 3px; }
</style>
