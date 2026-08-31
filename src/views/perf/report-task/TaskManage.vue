<template>
  <div class="container">
    <a-card title="周期报告任务" :bordered="false">
      <template #extra>
        <a-space>
          <a-input v-model="keyword" placeholder="任务名称" allow-clear style="width: 180px" @change="() => fetchTasks()" />
          <a-select v-model="filterDimType" placeholder="维度类型" allow-clear style="width: 140px" @change="() => fetchTasks()">
            <a-option value="product_domain">产品领域</a-option>
            <a-option value="business_area">业务领域</a-option>
            <a-option value="project_group">项目组</a-option>
          </a-select>
          <a-button type="primary" @click="openAddModal">新增任务</a-button>
        </a-space>
      </template>

      <a-table :data="taskList" :loading="loading" :pagination="false" row-key="id">
        <template #columns>
          <a-table-column title="任务名称" :width="180">
            <template #cell="{ record }">
              <span>{{ record.task_name }}</span>
              <a-tag v-if="!record.enabled" color="gray" size="small" style="margin-left: 6px">停用</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="维度" :width="170">
            <template #cell="{ record }">
              <a-tag :color="dimTypeColor(record.dimension_type)" size="small">{{ dimTypeText(record.dimension_type) }}</a-tag>
              <span style="margin-left: 4px">{{ record.dimension_value }}</span>
            </template>
          </a-table-column>
          <a-table-column title="产品线" :width="80">
            <template #cell="{ record }">
              <a-tag :color="record.product_line === '星空' ? 'purple' : 'blue'" size="small">{{ record.product_line || '星瀚' }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="量控" :width="200">
            <template #cell="{ record }">
              <a-tooltip :content="`超${record.threshold_ms || 3000}ms · 每组合≤${record.daily_limit_per_group || 100}条/天 · 覆盖超量${record.group_top_pct || 80}% · ≤${record.group_max || 200}组合`">
                <span>{{ record.threshold_ms || 3000 }}ms / {{ record.daily_limit_per_group || 100 }}条 / {{ record.group_top_pct || 80 }}% / {{ record.group_max || 200 }}组</span>
              </a-tooltip>
            </template>
          </a-table-column>
          <a-table-column title="执行时间" data-index="run_time" :width="90" />
          <a-table-column title="周期报告" :width="150">
            <template #cell="{ record }">
              <a-space size="mini">
                <a-tag v-if="record.weekly_enabled ?? true" color="arcoblue" size="small">
                  周报 {{ weekdayText(record.weekly_weekday ?? 2) }}
                </a-tag>
                <a-tag v-if="record.monthly_enabled ?? true" color="purple" size="small">
                  月报 {{ record.monthly_day ?? 2 }} 日
                </a-tag>
                <span
                  v-if="!(record.weekly_enabled ?? true) && !(record.monthly_enabled ?? true)"
                  style="color: #86909c"
                >未开启</span>
                <span v-else style="color: #86909c; font-size: 12px">
                  {{ record.period_run_time || '06:00' }}
                </span>
              </a-space>
            </template>
          </a-table-column>
          <a-table-column title="工作目录" data-index="work_dir" ellipsis tooltip :width="180" />
          <a-table-column title="最近运行" :width="150">
            <template #cell="{ record }">
              <template v-if="record.last_run_date">
                <a-tag :color="runStatusColor(record.last_run_status)" size="small">{{ runStatusText(record.last_run_status) }}</a-tag>
                <span style="margin-left: 4px; color: #666">{{ record.last_run_date }}</span>
              </template>
              <span v-else style="color: #999">未运行</span>
            </template>
          </a-table-column>
          <a-table-column title="启用" :width="70">
            <template #cell="{ record }">
              <a-switch :model-value="!!record.enabled" size="small" @change="(v: boolean | string | number) => toggleEnabled(record, !!v)" />
            </template>
          </a-table-column>
          <a-table-column title="操作" :width="200" fixed="right">
            <template #cell="{ record }">
              <a-space>
                <a-link @click="openEditModal(record)">编辑</a-link>
                <a-link @click="openRuns(record)">记录</a-link>
                <a-popconfirm content="确认删除该任务？" @ok="handleDelete(record)">
                  <a-link status="danger">删除</a-link>
                </a-popconfirm>
              </a-space>
            </template>
          </a-table-column>
        </template>
      </a-table>

      <a-alert style="margin-top: 12px" type="info">
        手动触发对全部<b>启用</b>任务执行一次（按数据日期逐阶段断点续跑）；每日定时由调度按「执行时间」自动触发。
      </a-alert>
      <a-button style="margin-top: 8px" status="success" @click="triggerVisible = true">
        <template #icon><icon-thunderbolt /></template>
        手动触发
      </a-button>
    </a-card>

    <!-- 新增/编辑弹框 -->
    <a-modal v-model:visible="modalVisible" :title="isEdit ? '编辑任务' : '新增任务'" :width="640" @ok="handleSave" :ok-loading="saving">
      <a-form :model="form" layout="vertical">
        <a-form-item label="任务名称" required>
          <a-input v-model="form.task_name" placeholder="如: 集团财务-按日慢请求" />
        </a-form-item>
        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item label="维度类型" required>
              <a-select v-model="form.dimension_type" @change="onDimTypeChange">
                <a-option value="product_domain">产品领域</a-option>
                <a-option value="business_area">业务领域</a-option>
                <a-option value="project_group">项目组</a-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="10">
            <a-form-item label="维度值" required>
              <a-select v-model="form.dimension_value" allow-search allow-create allow-clear placeholder="选择或输入维度值">
                <a-option v-for="o in dimValueOptions" :key="o.code" :value="o.code">{{ o.name === o.code ? o.name : `${o.name} (${o.code})` }}</a-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="产品线">
              <a-select v-model="form.product_line">
                <a-option value="星瀚">星瀚</a-option>
                <a-option value="星空">星空</a-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
        <a-divider orientation="left">量控（默认值与设计 §11.5 一致）</a-divider>
        <a-row :gutter="16">
          <a-col :span="6">
            <a-form-item label="超阈值(ms)">
              <a-input-number v-model="form.threshold_ms" :min="500" :max="60000" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="每组合限量/天">
              <a-input-number v-model="form.daily_limit_per_group" :min="1" :max="1000" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="覆盖超量(%)">
              <a-input-number v-model="form.group_top_pct" :min="10" :max="100" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="组合数上限">
              <a-input-number v-model="form.group_max" :min="1" :max="1000" style="width: 100%" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-divider orientation="left">调度与推送</a-divider>
        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item label="执行时间">
              <a-time-picker v-model="form.run_time" format="HH:mm" value-format="HH:mm" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="16">
            <a-form-item label="群组通知机器人">
              <a-input v-model="form.yzj_chat_id" allow-clear placeholder="群机器人 token 或完整 webhook 地址，留空则不推送日报" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="工作目录（技能目录隔离红线，如 性能分析产出/集团财务）">
          <a-input v-model="form.work_dir" allow-clear placeholder="下载产物/中间文件/报告均落在该目录子文件夹内" />
        </a-form-item>
        <a-form-item label="归因 Agent">
          <a-select v-model="form.agent_code" allow-clear placeholder="留空用 kiro-cli">
            <a-option v-for="a in agents" :key="a.id" :value="a.agent_code">
              {{ a.agent_name }}（{{ a.agent_code }}）
            </a-option>
          </a-select>
          <template #extra>
            <span>缺陷归因阶段调用的 AI Agent。kiro 因网络受限不可用时可切到 qoder 系列。</span>
          </template>
        </a-form-item>
        <a-form-item label="归因模型">
          <a-select
            v-model="form.model"
            allow-clear
            :disabled="!form.agent_code"
            :placeholder="form.agent_code ? '留空用该 Agent 默认模型' : '请先选择归因 Agent'"
          >
            <a-option v-for="name in modelOptions" :key="name" :value="name">{{ name }}</a-option>
          </a-select>
          <template #extra>
            <span>选项取自所选 Agent 的「支持的模型」，可在 AI 中心点「同步模型」从 CLI 刷新。</span>
          </template>
        </a-form-item>
        <a-form-item label="启用">
          <a-switch v-model="form.enabled" />
          <span style="margin-left: 8px; color: #86909c; font-size: 12px">停用后定时调度与手动触发均跳过该任务</span>
        </a-form-item>

        <a-divider orientation="left" style="margin: 8px 0">周期报告</a-divider>
        <a-form-item label="生成周报">
          <a-switch v-model="form.weekly_enabled" />
          <a-select
            v-model="form.weekly_weekday"
            :disabled="!form.weekly_enabled"
            style="width: 120px; margin-left: 12px"
          >
            <a-option :value="1">每周一</a-option>
            <a-option :value="2">每周二</a-option>
            <a-option :value="3">每周三</a-option>
            <a-option :value="4">每周四</a-option>
            <a-option :value="5">每周五</a-option>
            <a-option :value="6">每周六</a-option>
            <a-option :value="7">每周日</a-option>
          </a-select>
          <template #extra>
            <span>出的始终是「上一个完整 ISO 周」。默认周二 —— 周日的日报要到周一夜间才生成，周一出周报必然缺最后一天。</span>
          </template>
        </a-form-item>
        <a-form-item label="生成月报">
          <a-switch v-model="form.monthly_enabled" />
          <a-input-number
            v-model="form.monthly_day"
            :disabled="!form.monthly_enabled"
            :min="1"
            :max="28"
            style="width: 130px; margin-left: 12px"
          >
            <template #prepend>每月</template>
            <template #append>日</template>
          </a-input-number>
          <template #extra>
            <span>出的始终是「上一个完整自然月」。上限 28 日 —— 29~31 在短月永远不会触发。</span>
          </template>
        </a-form-item>
        <a-form-item label="生成时刻">
          <a-time-picker
            v-model="form.period_run_time"
            format="HH:mm"
            value-format="HH:mm"
            :disabled="!form.weekly_enabled && !form.monthly_enabled"
            style="width: 100%"
          />
          <template #extra>
            <span>到点后的第一次调度轮询（每 5 分钟一次）会生成；已存在则跳过，不会重复出。</span>
          </template>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 手动触发弹框 -->
    <a-modal v-model:visible="triggerVisible" title="手动触发（全部启用任务）" :width="440" @ok="handleTrigger" :ok-loading="triggering">
      <a-form layout="vertical" :model="layoutOnlyModel">
        <a-form-item label="数据日期（默认昨天）">
          <a-date-picker v-model="triggerDate" value-format="YYYY-MM-DD" style="width: 100%" />
        </a-form-item>
        <a-form-item label="只跑指定阶段（空=全流程）">
          <a-select v-model="triggerStage" allow-clear placeholder="全流程：下载→提取→分类→缺陷归因→报告→推送">
            <a-option value="preflight">preflight（预检，不调用 Ops）</a-option>
            <a-option value="download">download（下载）</a-option>
            <a-option value="extract">extract（结构化提取）</a-option>
            <a-option value="classify_hash">classify_hash（确定性分类）</a-option>
            <a-option value="defect_attribution">defect_attribution（逐问题缺陷报告）</a-option>
            <a-option value="analyze">analyze（兼容入口：提取+分类+归因）</a-option>
            <a-option value="report">report（日报与台账）</a-option>
            <a-option value="push">push（推送）</a-option>
          </a-select>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 运行记录抽屉 -->
    <a-drawer v-model:visible="drawerVisible" :title="`运行记录: ${currentTask?.task_name || ''}`" :width="1080" :footer="false">
      <a-table :data="runList" :loading="runLoading" :pagination="false" size="small" row-key="id">
        <template #columns>
          <a-table-column title="数据日期" data-index="run_date" :width="100" />
          <a-table-column title="阶段" :width="120">
            <template #cell="{ record }">
              <a-tag size="small">{{ stageText(record.stage) }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="状态" :width="82">
            <template #cell="{ record }">
              <a-tag :color="runStatusColor(record.status)" size="small">{{ runStatusText(record.status) }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="进度 / ETA" :width="190">
            <template #cell="{ record }">
              <a-progress :percent="Math.max(0, Math.min(1, (record.progress || 0) / 100))" size="small" />
              <div class="run-progress-detail">
                {{ record.done_items || 0 }}/{{ record.total_items || 0 }}
                <span v-if="record.failed_items"> · 失败 {{ record.failed_items }}</span>
                <span v-if="record.eta_seconds != null"> · ETA {{ fmtDuration(record.eta_seconds) }}</span>
              </div>
            </template>
          </a-table-column>
          <a-table-column title="心跳" :width="145">
            <template #cell="{ record }">{{ formatTime(record.heartbeat_at) }}</template>
          </a-table-column>
          <!-- ellipsis 只截断不提示，长错误会被挡住看不到真正原因（生产实测：
               「日期目录不存在: /data/app/report-work/...」这类路径全被吃掉）。
               配 tooltip 让悬停展开；再加原生 title 兜底，
               避免 tooltip 在某些容器里被 overflow 裁掉时完全看不到。 -->
          <a-table-column title="产物/错误" ellipsis tooltip>
            <template #cell="{ record }">
              <span
                v-if="record.error_message"
                style="color: #f53f3f; cursor: help"
                :title="record.error_message"
              >{{ record.error_message }}</span>
              <span
                v-else-if="record.artifact_path"
                style="color: #666"
                :title="record.artifact_path"
              >{{ record.artifact_path }}</span>
              <span v-else>-</span>
            </template>
          </a-table-column>
          <a-table-column title="开始" :width="140">
            <template #cell="{ record }">{{ formatTime(record.started_at) }}</template>
          </a-table-column>
          <a-table-column title="结束" :width="140">
            <template #cell="{ record }">{{ formatTime(record.finished_at) }}</template>
          </a-table-column>
          <a-table-column title="操作" :width="130" fixed="right">
            <template #cell="{ record }">
              <a-space>
                <!-- 归因是逐维度处理的长任务，阶段行只能看到总体进度；
                     维度明细才能看出卡在哪个表单、复用率多少 -->
                <a-link v-if="record.stage === 'defect_attribution'" @click="openDimensions(record)">维度进度</a-link>
                <a-popconfirm v-if="record.status === 'running'" content="在当前安全边界取消该阶段？已完成原子产物会保留。" @ok="cancelRun(record)">
                  <a-link status="danger">取消</a-link>
                </a-popconfirm>
              </a-space>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </a-drawer>

    <!-- 维度级归因进度：分析单位是「应用+表单+操作」，一个维度一轮 AI 处理 -->
    <a-drawer v-model:visible="dimVisible" :title="`维度归因进度: ${dimRunDate}`" :width="1100" :footer="false">
      <a-spin :loading="dimLoading" style="display: block">
        <a-alert v-if="dimSummary.remaining > 0" type="warning" style="margin-bottom: 12px">
          还有 {{ dimSummary.remaining }} 个维度未处理（共 {{ dimSummary.total }} 个）。
          <strong>日报会等到全部处理完才生成</strong> —— 否则出的是只统计了一半的报告。
        </a-alert>
        <a-alert v-else-if="dimSummary.total > 0" type="success" style="margin-bottom: 12px">
          全部 {{ dimSummary.total }} 个维度已处理完毕，日报可生成。
        </a-alert>

        <a-descriptions :column="4" size="small" bordered style="margin-bottom: 12px">
          <a-descriptions-item label="维度总数">{{ dimSummary.total }}</a-descriptions-item>
          <a-descriptions-item label="已完成">{{ dimSummary.done }}</a-descriptions-item>
          <a-descriptions-item label="处理中">{{ dimSummary.running }}</a-descriptions-item>
          <a-descriptions-item label="待处理">{{ dimSummary.pending }}</a-descriptions-item>
          <a-descriptions-item label="失败">{{ dimSummary.failed }}</a-descriptions-item>
          <a-descriptions-item label="根因总数">{{ dimSummary.defect_total }}</a-descriptions-item>
          <a-descriptions-item label="新增 / 复现">
            {{ dimSummary.new_defect_total }} / {{ dimSummary.recurring_total }}
          </a-descriptions-item>
          <!-- 复用率是判断「归因还要不要继续优化」的直接依据：
               越高说明每天真正要查源码的越少 -->
          <a-descriptions-item label="台账复用率">{{ dimSummary.reuse_rate }}%</a-descriptions-item>
        </a-descriptions>

        <a-alert v-if="dimSummary.detail_truncated" type="info" style="margin-bottom: 8px">
          维度较多，明细仅显示慢请求数最高的前 {{ dimSummary.detail_limit }} 条（共 {{ dimSummary.total }} 个）。
          上方汇总数字仍为全量口径。
        </a-alert>
        <a-table :data="dimList" :pagination="{ pageSize: 20, showTotal: true }" size="small" row-key="bucket">
          <template #columns>
            <a-table-column title="表单" data-index="form_id" :width="170" ellipsis tooltip />
            <a-table-column title="操作" data-index="operation" :width="90" ellipsis tooltip />
            <a-table-column title="慢请求" data-index="slow_count" :width="80" :sortable="{ sortDirections: ['descend'] }" />
            <a-table-column title="日志数" data-index="trace_count" :width="80" />
            <a-table-column title="状态" :width="90">
              <template #cell="{ record }">
                <a-tag :color="dimStatusColor(record.status)" size="small">{{ dimStatusText(record.status) }}</a-tag>
              </template>
            </a-table-column>
            <!-- 线索是正则给 AI 的参考，不是产出目标：同一条 trace 里的慢 SQL、异常、
                 循环往往是同一个根因的不同表现，所以根因数通常远小于线索数 -->
            <a-table-column title="线索 → 根因" :width="120">
              <template #cell="{ record }">
                {{ record.candidate_hint }} → <strong>{{ record.defect_count }}</strong>
              </template>
            </a-table-column>
            <a-table-column title="新增 / 复现" :width="100">
              <template #cell="{ record }">{{ record.new_defect_count }} / {{ record.recurring_count }}</template>
            </a-table-column>
            <a-table-column title="尝试" data-index="attempt" :width="60" />
            <a-table-column title="错误" ellipsis tooltip>
              <template #cell="{ record }">
                <span v-if="record.error_message" style="color: #f53f3f" :title="record.error_message">
                  {{ record.error_message }}
                </span>
                <span v-else>-</span>
              </template>
            </a-table-column>
          </template>
        </a-table>
      </a-spin>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onUnmounted } from 'vue'
import { Message } from '@arco-design/web-vue'
import { ApiPerfReportTask, ApiPerfCompliance } from '@/api/perfApis'
import { ApiAiAgent, type AiAgent, type AiListResult } from '@/api/aiApis'
import { formatTime, useGet, usePost } from '@/hooks'

defineOptions({ name: 'report-task-manage' })

// ── 任务列表 ──────────────────────────────────
const keyword = ref('')
const filterDimType = ref<string>()
const queryParams = computed(() => ({ keyword: keyword.value || undefined, dimension_type: filterDimType.value || undefined }))
const { isFetching: loading, data: rawData, execute: fetchTasks } = useGet<any>(ApiPerfReportTask.list, queryParams, { immediate: true })
const taskList = computed(() => rawData.value || [])

// ── 维度值选项（按维度类型级联，allow-create 保底手输） ──────────────────────
const dimValueOptions = ref<any[]>([])
const dimPayload = ref<any>({})
const { execute: fetchDimOptions } = useGet<any>(ApiPerfCompliance.dimensionOptions, dimPayload, {
  immediate: false,
  onSuccess(data: any) { dimValueOptions.value = data || [] },
})
const loadDimValues = () => {
  const level = form.dimension_type
  // 产品领域/业务领域/项目组：不传父级 = 全量列出
  dimPayload.value = { level, product_domain: '', business_area: '' }
  fetchDimOptions()
}
const onDimTypeChange = () => { form.dimension_value = undefined; loadDimValues() }

// ── 新增/编辑弹框 ──────────────────────────────
const modalVisible = ref(false)
const isEdit = ref(false)
const saving = ref(false)
const editId = ref('')
// 归因阶段的 Agent 与模型。
//
// 原先后端写死 kiro-cli + gpt-5.6-terra（defect_analysis.rs / report_attribution.rs），
// 生产上 kiro 因网络受限调不通时无法切到 qoder，整条日报链路停在归因阶段。
const { data: agentData } = useGet<AiListResult<AiAgent>>(
  ApiAiAgent.getList,
  { page_num: 1, page_size: 100 },
  { immediate: true },
)
const agents = computed(() => agentData.value?.list || [])

const form = reactive<any>({
  task_name: '', dimension_type: 'product_domain', dimension_value: undefined, product_line: '星瀚',
  threshold_ms: 3000, daily_limit_per_group: 100, group_top_pct: 80, group_max: 200,
  run_time: '02:00', yzj_chat_id: '', work_dir: '', agent_code: '', model: '', enabled: true,
  weekly_enabled: true, monthly_enabled: true, weekly_weekday: 2, monthly_day: 2, period_run_time: '06:00',
})

// 模型选项跟随所选 Agent 的 supported_models_json：各 Agent 支持的模型不同
// （kiro-cli 19 个、qoder 系列 15 个），且随 CLI 升级变化，硬编码追不上。
const modelOptions = computed<string[]>(() => {
  const agent = agents.value.find(item => item.agent_code === form.agent_code)
  if (!agent?.supported_models_json)
    return []
  try {
    const parsed = JSON.parse(agent.supported_models_json)
    return Array.isArray(parsed) ? parsed.filter((v: unknown): v is string => typeof v === 'string' && v.length > 0) : []
  }
  catch {
    return []
  }
})

// 换 Agent 后原模型可能不在新清单里，留着会提交出后端拒绝的值
watch(() => form.agent_code, () => {
  if (form.model && !modelOptions.value.includes(form.model))
    form.model = ''
})


const openAddModal = () => {
  isEdit.value = false; editId.value = ''
  Object.assign(form, { task_name: '', dimension_type: 'product_domain', dimension_value: undefined, product_line: '星瀚', threshold_ms: 3000, daily_limit_per_group: 100, group_top_pct: 80, group_max: 200, run_time: '02:00', yzj_chat_id: '', work_dir: '', enabled: true, weekly_enabled: true, monthly_enabled: true, weekly_weekday: 2, monthly_day: 2, period_run_time: '06:00' })
  loadDimValues()
  modalVisible.value = true
}

const openEditModal = (record: any) => {
  isEdit.value = true; editId.value = record.id
  Object.assign(form, {
    task_name: record.task_name, dimension_type: record.dimension_type, dimension_value: record.dimension_value,
    product_line: record.product_line || '星瀚',
    threshold_ms: record.threshold_ms ?? 3000, daily_limit_per_group: record.daily_limit_per_group ?? 100,
    group_top_pct: record.group_top_pct ?? 80, group_max: record.group_max ?? 200,
    run_time: record.run_time || '02:00', yzj_chat_id: record.yzj_chat_id || '', work_dir: record.work_dir || '',
    agent_code: record.agent_code || '', model: record.model || '',
    enabled: !!record.enabled,
    // 后端列有 NOT NULL 默认值，但老记录经接口回来可能是 undefined，
    // 这里给出与后端一致的兜底，避免开关显示成「关」而实际是开的
    weekly_enabled: record.weekly_enabled ?? true,
    monthly_enabled: record.monthly_enabled ?? true,
    weekly_weekday: record.weekly_weekday ?? 2,
    monthly_day: record.monthly_day ?? 2,
    period_run_time: record.period_run_time || '06:00',
  })
  loadDimValues()
  modalVisible.value = true
}

const savePayload = ref<any>({})
const { execute: doSave } = usePost<any>(ApiPerfReportTask.save, savePayload, { immediate: false })

const buildPayload = (base: any) => ({
  task_name: base.task_name, dimension_type: base.dimension_type, dimension_value: base.dimension_value,
  product_line: base.product_line,
  threshold_ms: base.threshold_ms, daily_limit_per_group: base.daily_limit_per_group,
  group_top_pct: base.group_top_pct, group_max: base.group_max,
  run_time: base.run_time || '02:00',
  weekly_enabled: base.weekly_enabled,
  monthly_enabled: base.monthly_enabled,
  weekly_weekday: base.weekly_weekday,
  monthly_day: base.monthly_day,
  period_run_time: base.period_run_time || '06:00',
  yzj_chat_id: base.yzj_chat_id || undefined, work_dir: base.work_dir || undefined,
    agent_code: base.agent_code || undefined, model: base.model || undefined,
  enabled: base.enabled,
})

const handleSave = async () => {
  if (!form.task_name) { Message.warning('请输入任务名称'); return }
  if (!form.dimension_value) { Message.warning('请选择或输入维度值'); return }
  saving.value = true
  try {
    savePayload.value = { id: editId.value || undefined, ...buildPayload(form) }
    await doSave()
    Message.success(isEdit.value ? '编辑成功' : '新增成功')
    modalVisible.value = false; fetchTasks()
  } finally { saving.value = false }
}

// ── 启用开关（内联切换即保存） ──────────────────────────────
const weekdayText = (n: number) => ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'][n] || `第${n}天`

const toggleEnabled = async (record: any, enabled: boolean) => {
  savePayload.value = { id: record.id, ...buildPayload({ ...record, yzj_chat_id: record.yzj_chat_id || '', work_dir: record.work_dir || '', enabled }) }
  await doSave()
  Message.success(enabled ? '已启用' : '已停用')
  fetchTasks()
}

// ── 删除 ──────────────────────────────────
const delPayload = ref<any>({})
const { execute: doDelete } = usePost<any>(ApiPerfReportTask.delete, delPayload, { immediate: false })
const handleDelete = async (record: any) => {
  delPayload.value = { id: record.id }
  await doDelete()
  Message.success('删除成功'); fetchTasks()
}

// ── 手动触发 ──────────────────────────────────
const triggerVisible = ref(false)
const triggering = ref(false)
const triggerDate = ref('')
const triggerStage = ref<string>()
const triggerPayload = ref<any>({})
const { data: triggerResult, error: triggerError, execute: doTrigger } = usePost<any>(ApiPerfReportTask.trigger, triggerPayload, {
  immediate: false,
})
const handleTrigger = async () => {
  triggering.value = true
  try {
    triggerPayload.value = { run_date: triggerDate.value || undefined, stage: triggerStage.value || undefined }
    await doTrigger()
    if (!triggerError.value) Message.success(String(triggerResult.value || '已触发'))
    triggerVisible.value = false
  } finally { triggering.value = false }
}

// ── 运行记录 ──────────────────────────────────
const drawerVisible = ref(false)
const currentTask = ref<any>(null)
const runList = ref<any[]>([])
const runLoading = ref(false)
const runPayload = ref<any>({})
const { execute: fetchRuns } = useGet<any>(ApiPerfReportTask.runs, runPayload, {
  immediate: false,
  onSuccess(data: any) { runList.value = data || [] },
})
const openRuns = (record: any) => {
  currentTask.value = record; drawerVisible.value = true; runLoading.value = true
  runPayload.value = { task_id: record.id }
  fetchRuns().finally(() => { runLoading.value = false })
}

// 抽屉打开且存在 running 记录时每 5 秒自动刷新

const cancelPayload = ref<any>({})
const { execute: doCancelRun } = usePost<any>(ApiPerfReportTask.cancel, cancelPayload, { immediate: false })
const cancelRun = async (record: any) => {
  cancelPayload.value = { task_id: record.task_id, run_date: record.run_date, stage: record.stage }
  await doCancelRun()
  Message.success('已提交取消请求，将在当前网络请求或处理项完成后停止')
  fetchRuns()
}
let runTimer: ReturnType<typeof setInterval> | null = null
const stopRunTimer = () => { if (runTimer) { clearInterval(runTimer); runTimer = null } }
watch([drawerVisible, runList], ([visible, list]) => {
  stopRunTimer()
  if (visible && list.some((r: any) => r.status === 'running')) {
    runTimer = setInterval(() => { fetchRuns() }, 5000)
  }
}, { deep: true })
onUnmounted(stopRunTimer)

// ── 格式化辅助 ──────────────────────────────────
const dimTypeText = (t: string) => ({ product_domain: '产品领域', business_area: '业务领域', project_group: '项目组' }[t] || t)
const dimTypeColor = (t: string) => ({ product_domain: 'arcoblue', business_area: 'green', project_group: 'orange' }[t] || 'gray')
// ── 维度归因进度 ──────────────────────────────
// 归因是逐维度处理的长任务（一个「应用+表单+操作」一轮 AI），阶段行只有总体进度，
// 看不出卡在哪个表单、复用率如何。这里下钻到维度账本。
const dimVisible = ref(false)
const dimLoading = ref(false)
const dimRunDate = ref('')
const dimList = ref<any[]>([])
const dimSummary = ref<any>({
  total: 0, pending: 0, running: 0, done: 0, failed: 0,
  remaining: 0, defect_total: 0, new_defect_total: 0, recurring_total: 0, reuse_rate: 0,
})

async function openDimensions(record: any) {
  dimRunDate.value = String(record.run_date || '').slice(0, 10)
  dimVisible.value = true
  dimLoading.value = true
  try {
    // 给泛型，否则 data 是 unknown、取 .list 编译不过
    const { data } = await useGet<any>(ApiPerfReportTask.dimensionProgress, {
      task_id: record.task_id,
      run_date: dimRunDate.value,
    })
    // useGet 返回的 data 是 shallowRef，要取 .value 才是响应体
    const payload: any = data.value ?? {}
    dimSummary.value = { ...dimSummary.value, ...payload }
    dimList.value = payload.list ?? []
  }
  finally {
    dimLoading.value = false
  }
}

const dimStatusText = (s: string) =>
  ({ pending: '待处理', running: '处理中', done: '已完成', failed: '失败', skipped: '跳过' }[s] || s)

const dimStatusColor = (s: string) =>
  ({ pending: 'gray', running: 'arcoblue', done: 'green', failed: 'red', skipped: 'orange' }[s] || 'gray')

const stageText = (s: string) => ({ preflight: '预检', download: '下载', extract: '结构提取', classify_hash: '问题分类', defect_attribution: '缺陷归因', report: '日报台账', push: '推送' }[s] || s)
const runStatusText = (s: string) => ({ running: '运行中', success: '成功', failed: '失败', skipped: '跳过', cancelled: '已取消', interrupted: '待恢复' }[s] || s || '-')
const runStatusColor = (s: string) => ({ running: 'blue', success: 'green', failed: 'red', skipped: 'gray', cancelled: 'orange', interrupted: 'orangered' }[s] || 'gray')
const fmtDuration = (seconds?: number) => {
  const value = Math.max(0, Number(seconds || 0))
  if (value < 60) return `${value}s`
  if (value < 3600) return `${Math.ceil(value / 60)}m`
  return `${Math.floor(value / 3600)}h${Math.ceil((value % 3600) / 60)}m`
}

// 这些 a-form 只用来做纵向布局，不做校验，但 arco 的 model 是必填 prop。
// 用一个模块级常量而不是在模板里写 :model="{}"，避免每次渲染都新建对象。
const layoutOnlyModel = {}

</script>

<style scoped>
.container {
  padding: 16px;
}
.run-progress-detail {
  margin-top: 2px;
  color: #86909c;
  font-size: 11px;
  white-space: nowrap;
}
</style>
