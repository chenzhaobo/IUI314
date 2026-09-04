<template>
  <div class="container">
    <a-card :bordered="false" title="性能诊断分析">
      <!-- 筛选栏 -->
      <a-row :gutter="16" style="margin-bottom: 12px" align="center">
        <a-col :span="3">
          <a-select v-model="filters.product_line" placeholder="产品线">
            <a-option value="星瀚">星瀚</a-option>
            <a-option value="星空">星空</a-option>
          </a-select>
        </a-col>
        <a-col :span="3">
          <a-select v-model="filters.scope" placeholder="分析范围">
            <a-option value="domain">领域</a-option>
            <a-option value="app">应用</a-option>
          </a-select>
        </a-col>
        <a-col :span="4" v-if="filters.scope === 'domain'">
          <a-select v-model="filters.business_area" placeholder="业务领域" allow-search>
            <a-option value="司库">司库</a-option>
            <a-option value="共享">共享</a-option>
            <a-option value="预算">预算</a-option>
            <a-option value="企业绩效">企业绩效</a-option>
          </a-select>
        </a-col>
        <a-col :span="4" v-if="filters.scope === 'app'">
          <a-input v-model="filters.app_number" placeholder="应用编码（如 ssc）" allow-clear />
        </a-col>
        <a-col :span="3">
          <a-input-number v-model="filters.target_rate" placeholder="目标%" :min="90" :max="100" :step="0.5" style="width: 100%" />
        </a-col>
        <a-col :span="4">
          <a-select v-model="filters.period_type" placeholder="周期类型">
            <a-option value="monthly">按月</a-option>
            <a-option value="weekly">按周</a-option>
          </a-select>
        </a-col>
        <a-col :span="3">
          <a-select v-model="filters.custom_filter" placeholder="二开过滤">
            <a-option value="">全部</a-option>
            <a-option value="standard_only">仅标品</a-option>
            <a-option value="custom_only">仅二开</a-option>
          </a-select>
        </a-col>
        <a-col :span="3">
          <a-button type="primary" :loading="loading" @click="handleDiagnose">开始诊断</a-button>
        </a-col>
      </a-row>

      <!-- 领域诊断结果 -->
      <template v-if="filters.scope === 'domain' && domainData">
        <a-row :gutter="16" style="margin-bottom: 16px">
          <a-col :span="6">
            <a-statistic title="实际达标率" :value="domainData.actual_rate" :precision="2" suffix="%"
              :value-style="{ color: domainData.actual_rate >= domainData.target_rate ? '#00b42a' : '#f53f3f' }" />
          </a-col>
          <a-col :span="6">
            <a-statistic title="目标达标率" :value="domainData.target_rate" :precision="0" suffix="%" />
          </a-col>
          <a-col :span="6">
            <a-statistic title="差距" :value="domainData.gap" :precision="2" suffix="%"
              :value-style="{ color: domainData.gap > 0 ? '#f53f3f' : '#00b42a' }" />
          </a-col>
          <a-col :span="6">
            <a-statistic title="未达标应用" :value="domainData.failing_apps" suffix="/">
              <template #suffix><span style="font-size: 14px">/ {{ domainData.total_apps }}</span></template>
            </a-statistic>
          </a-col>
        </a-row>

        <!-- 操作栏 -->
        <a-space style="margin-bottom: 12px">
          <a-button type="outline" status="success" size="small" @click="handleGenReport('domain')">生成诊断报告</a-button>
          <a-button type="outline" size="small" @click="fetchGuide">获取分析指导</a-button>
          <a-button type="outline" status="warning" size="small" :loading="syncLoading" @click="handleSyncIssues">同步到问题跟踪</a-button>
        </a-space>

        <!-- 应用优先级表格 -->
        <a-table :data="domainData.apps" :pagination="{ pageSize: 20, showTotal: true }" size="small" row-key="app_number"
          :expandable="{ expandedRowKeys: expandedApps }"
          @expanded-change="(keys: (string | number)[]) => expandedApps = keys.map(String)">
          <template #columns>
            <a-table-column title="优先级" data-index="priority" :width="70" align="center" />
            <a-table-column title="应用" :width="180">
              <template #cell="{ record }">{{ record.app_name }}（{{ record.app_number }}）</template>
            </a-table-column>
            <a-table-column title="达标率" :width="100" align="right">
              <template #cell="{ record }">
                <span :style="{ color: record.is_pass ? '#00b42a' : '#f53f3f' }">{{ record.compliance_rate }}%</span>
              </template>
            </a-table-column>
            <a-table-column title="差距" data-index="gap_to_target" :width="80" align="right">
              <template #cell="{ record }">{{ record.gap_to_target }}%</template>
            </a-table-column>
            <a-table-column title="超3秒数" data-index="over_3s_count" :width="90" align="right" />
            <a-table-column title="总请求数" data-index="total_count" :width="90" align="right" />
            <a-table-column title="状态" :width="80" align="center">
              <template #cell="{ record }">
                <a-tag :color="record.is_pass ? 'green' : 'red'" size="small">{{ record.is_pass ? '达标' : '未达标' }}</a-tag>
              </template>
            </a-table-column>
            <a-table-column title="操作" :width="120">
              <template #cell="{ record }">
                <a-link @click="drillApp(record.app_number)">诊断</a-link>
              </template>
            </a-table-column>
          </template>
          <template #expand-row="{ record }">
            <div style="padding: 8px 0">
              <b>Top 问题表单：</b>
              <a-table :data="record.top_forms" size="mini" :pagination="false" row-key="form_id" style="margin-top: 4px">
                <template #columns>
                  <a-table-column title="表单" data-index="form_id" :width="200" ellipsis />
                  <a-table-column title="名称" data-index="form_name" :width="150" ellipsis />
                  <a-table-column title="达标率" :width="90" align="right">
                    <template #cell="{ record: f }">{{ f.compliance_rate }}%</template>
                  </a-table-column>
                  <a-table-column title="超3秒" data-index="over_3s_count" :width="80" align="right" />
                  <a-table-column title="平均耗时" :width="100" align="right">
                    <template #cell="{ record: f }">{{ f.avg_cost }}ms</template>
                  </a-table-column>
                </template>
              </a-table>
            </div>
          </template>
        </a-table>

        <!-- 分析指导面板 -->
        <a-card v-if="guideData" title="分析指导" size="small" style="margin-top: 16px">
          <a-alert type="info" style="margin-bottom: 12px">{{ guideData.summary }}</a-alert>
          <a-timeline>
            <a-timeline-item v-for="item in guideData.action_plan" :key="item.priority" :label="`P${item.priority}`">
              <b>{{ item.app_name }}（{{ item.app }}）</b>：{{ item.issue }}<br />
              <span style="color: #86909c">行动：{{ item.action }}</span><br />
              <span style="color: #00b42a">{{ item.expected_improvement }}</span>
            </a-timeline-item>
          </a-timeline>
          <a-divider orientation="left">下一步</a-divider>
          <a-space direction="vertical">
            <span v-for="(step, i) in guideData.next_steps" :key="i">{{ Number(i) + 1 }}. {{ step }}</span>
          </a-space>
        </a-card>
      </template>

      <!-- 应用诊断结果 -->
      <template v-if="filters.scope === 'app' && appData">
        <a-row :gutter="16" style="margin-bottom: 16px">
          <a-col :span="6">
            <a-statistic title="应用" :value="appData.app_name || appData.app_number" />
          </a-col>
          <a-col :span="6">
            <a-statistic title="实际达标率" :value="appData.compliance_rate" :precision="2" suffix="%"
              :value-style="{ color: appData.compliance_rate >= appData.target_rate ? '#00b42a' : '#f53f3f' }" />
          </a-col>
          <a-col :span="6">
            <a-statistic title="超3秒请求" :value="appData.over_3s_count" />
          </a-col>
          <a-col :span="6">
            <a-statistic title="总请求数" :value="appData.total_count" />
          </a-col>
        </a-row>

        <a-space style="margin-bottom: 12px">
          <a-button type="outline" status="success" size="small" @click="handleGenReport('app')">生成诊断报告</a-button>
          <a-button type="outline" status="warning" size="small" :loading="syncLoading" @click="handleSyncIssues">同步到问题跟踪</a-button>
        </a-space>

        <!-- 表单级问题 -->
        <a-table :data="appData.forms.filter((f: any) => f.over_3s_count > 0)" :pagination="{ pageSize: 20, showTotal: true }"
          size="small" row-key="form_id">
          <template #columns>
            <a-table-column title="表单" data-index="form_id" :width="200" ellipsis />
            <a-table-column title="名称" data-index="form_name" :width="150" ellipsis />
            <a-table-column title="达标率" :width="90" align="right">
              <template #cell="{ record }">
                <span :style="{ color: record.compliance_rate >= (filters.target_rate || 99) ? '#00b42a' : '#f53f3f' }">{{ record.compliance_rate }}%</span>
              </template>
            </a-table-column>
            <a-table-column title="超3秒" data-index="over_3s_count" :width="80" align="right" />
            <a-table-column title="平均耗时" :width="100" align="right">
              <template #cell="{ record }">{{ record.avg_cost }}ms</template>
            </a-table-column>
            <a-table-column title="最大耗时" :width="100" align="right">
              <template #cell="{ record }">{{ record.max_cost || '-' }}ms</template>
            </a-table-column>
            <a-table-column title="慢请求" :width="80" align="center">
              <template #cell="{ record }">
                <a-tag :color="record.has_traces ? 'green' : 'gray'" size="small">{{ record.has_traces ? '有' : '无' }}</a-tag>
              </template>
            </a-table-column>
            <a-table-column title="操作级问题" ellipsis>
              <template #cell="{ record }">
                <span v-if="record.operations && record.operations.length">
                  <a-tag v-for="op in record.operations.slice(0, 3)" :key="op.control_name" size="small" color="orangered" style="margin-right: 4px">
                    {{ op.control_name }}({{ op.trace_count }})
                  </a-tag>
                </span>
                <span v-else style="color: #c9cdd4">-</span>
              </template>
            </a-table-column>
          </template>
        </a-table>
      </template>
    </a-card>

    <!-- 诊断报告预览弹窗（富文本渲染） -->
    <a-modal v-model:visible="reportPreviewVisible" title="诊断报告预览" :width="1000" :footer="false" :body-style="{ padding: '0', height: '75vh', overflow: 'auto' }">
      <a-spin v-if="reportPreviewLoading" style="display: block; text-align: center; padding-top: 200px" />
      <MdPreview v-else-if="reportPreviewContent" :modelValue="reportPreviewContent" style="height: 75vh" />
      <a-empty v-else description="暂无内容" style="padding-top: 200px" />
    </a-modal>

    <!-- 同步结果弹窗 -->
    <a-modal v-model:visible="syncResultVisible" title="问题同步结果" :width="420" :footer="false">
      <a-result v-if="syncResult" status="success" title="同步完成">
        <template #subtitle>
          <a-space direction="vertical" style="width: 100%; text-align: left">
            <span>输入不达标项：<b>{{ syncResult.total_input }}</b> 个</span>
            <span>新建问题：<b style="color: #00b42a">{{ syncResult.created }}</b> 个</span>
            <span>更新已有问题：<b style="color: #165dff">{{ syncResult.updated }}</b> 个</span>
            <span>关联历史问题：<b style="color: #ff7d00">{{ syncResult.linked_history }}</b> 个</span>
          </a-space>
        </template>
      </a-result>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Message } from '@arco-design/web-vue'
import { MdPreview } from 'md-editor-v3'
import 'md-editor-v3/lib/preview.css'
import { ApiPerfDiagnosis, ApiPerfReportV2, ApiPerfIssue } from '@/api/perfApis'
import { useGet, usePost } from '@/hooks'

defineOptions({ name: 'diagnosis' })

// ── 筛选条件 ──────────────────────────────────
const filters = ref<any>({
  product_line: '星瀚',
  scope: 'domain',
  business_area: '司库',
  app_number: '',
  target_rate: 99,
  period_type: 'monthly',
  period: undefined,
  custom_filter: '',
})

// ── 领域诊断 ──────────────────────────────────
const domainParams = ref<any>({})
const { isFetching: loading, data: domainRaw, execute: fetchDomain } = useGet<any>(ApiPerfDiagnosis.domain, domainParams, { immediate: false })
const domainData = ref<any>(null)

// ── 应用诊断 ──────────────────────────────────
const appParams = ref<any>({})
const { data: appRaw, execute: fetchApp } = useGet<any>(ApiPerfDiagnosis.app, appParams, { immediate: false })
const appData = ref<any>(null)

// ── 分析指导 ──────────────────────────────────
const guideParams = ref<any>({})
const { data: guideRaw, execute: fetchGuideApi } = useGet<any>(ApiPerfDiagnosis.guide, guideParams, { immediate: false })
const guideData = ref<any>(null)

// ── 生成报告 ──────────────────────────────────
const reportPayload = ref<any>({})
const { execute: genReport } = usePost<any>(ApiPerfDiagnosis.report, reportPayload, { immediate: false })

const expandedApps = ref<string[]>([])

const handleDiagnose = async () => {
  domainData.value = null
  appData.value = null
  guideData.value = null
  expandedApps.value = []

  if (filters.value.scope === 'domain') {
    domainParams.value = {
      product_line: filters.value.product_line,
      business_area: filters.value.business_area,
      target_rate: filters.value.target_rate,
      period_type: filters.value.period_type,
      period: filters.value.period,
      custom_filter: filters.value.custom_filter || undefined,
    }
    await fetchDomain()
    if (domainRaw.value) domainData.value = domainRaw.value
  } else {
    if (!filters.value.app_number) {
      Message.warning('请输入应用编码')
      return
    }
    appParams.value = {
      product_line: filters.value.product_line,
      app_number: filters.value.app_number,
      target_rate: filters.value.target_rate,
      period_type: filters.value.period_type,
      period: filters.value.period,
      custom_filter: filters.value.custom_filter || undefined,
    }
    await fetchApp()
    if (appRaw.value) appData.value = appRaw.value
  }
}

const drillApp = async (appNumber: string) => {
  filters.value.scope = 'app'
  filters.value.app_number = appNumber
  appParams.value = {
    product_line: filters.value.product_line,
    app_number: appNumber,
    target_rate: filters.value.target_rate,
    period_type: filters.value.period_type,
    period: filters.value.period,
    custom_filter: filters.value.custom_filter || undefined,
  }
  await fetchApp()
  if (appRaw.value) appData.value = appRaw.value
}

const fetchGuide = async () => {
  guideParams.value = {
    product_line: filters.value.product_line,
    business_area: filters.value.business_area,
    target_rate: filters.value.target_rate,
    period_type: filters.value.period_type,
    period: filters.value.period,
    custom_filter: filters.value.custom_filter || undefined,
  }
  await fetchGuideApi()
  if (guideRaw.value) guideData.value = guideRaw.value
}

const handleGenReport = async (scope: string) => {
  reportPayload.value = {
    product_line: filters.value.product_line,
    scope,
    business_area: filters.value.business_area,
    app_number: filters.value.app_number || undefined,
    target_rate: filters.value.target_rate,
    period_type: filters.value.period_type,
    period: filters.value.period,
    custom_filter: filters.value.custom_filter || undefined,
  }
  const res = await genReport()
  if (res.data.value) {
    Message.success('诊断报告已生成，正在加载预览...')
    openReportPreview(res.data.value)
  }
}

// ── 报告预览（富文本渲染） ────────────────────────────
const reportPreviewVisible = ref(false)
const reportPreviewLoading = ref(false)
const reportPreviewContent = ref('')

async function openReportPreview(reportId: string) {
  reportPreviewVisible.value = true
  reportPreviewLoading.value = true
  reportPreviewContent.value = ''
  const { data, execute } = useGet<any>(ApiPerfReportV2.getById, { id: reportId }, { immediate: false })
  await execute()
  reportPreviewLoading.value = false
  reportPreviewContent.value = data.value?.content || ''
}

// ── 同步到问题跟踪 ────────────────────────────
const syncLoading = ref(false)
const syncResultVisible = ref(false)
const syncResult = ref<any>(null)
const syncPayload = ref<any>({})
const { execute: doSync } = usePost<any>(ApiPerfIssue.syncFromDiagnosis, syncPayload, { immediate: false })

const handleSyncIssues = async () => {
  const items: any[] = []
  if (filters.value.scope === 'domain' && domainData.value) {
    for (const app of domainData.value.apps || []) {
      if (app.is_pass) continue
      if (app.top_forms && app.top_forms.length) {
        for (const f of app.top_forms) {
          items.push({ app_number: app.app_number, app_name: app.app_name, form_id: f.form_id, form_name: f.form_name, control_name: null, total_count: f.total_count || 0, over_3s_count: f.over_3s_count || 0, compliance_rate: f.compliance_rate || 0, avg_cost: f.avg_cost })
        }
      } else {
        items.push({ app_number: app.app_number, app_name: app.app_name, form_id: null, form_name: null, control_name: null, total_count: app.total_count || 0, over_3s_count: app.over_3s_count || 0, compliance_rate: app.compliance_rate || 0, avg_cost: null })
      }
    }
  } else if (filters.value.scope === 'app' && appData.value) {
    for (const f of appData.value.forms || []) {
      if (f.over_3s_count <= 0) continue
      items.push({ app_number: appData.value.app_number, app_name: appData.value.app_name, form_id: f.form_id, form_name: f.form_name, control_name: null, total_count: f.total_count || 0, over_3s_count: f.over_3s_count || 0, compliance_rate: f.compliance_rate || 0, avg_cost: f.avg_cost })
    }
  }
  if (!items.length) {
    Message.info('当前诊断结果无不达标项')
    return
  }
  syncLoading.value = true
  syncPayload.value = {
    product_line: filters.value.product_line,
    business_area: filters.value.scope === 'domain' ? filters.value.business_area : undefined,
    items,
  }
  try {
    const res = await doSync()
    if (res.data.value) {
      syncResult.value = res.data.value
      syncResultVisible.value = true
    }
  } finally {
    syncLoading.value = false
  }
}
</script>
