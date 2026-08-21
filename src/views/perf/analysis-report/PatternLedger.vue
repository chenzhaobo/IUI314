<template>
  <div class="container">
    <a-card :bordered="false">
      <!-- 搜索栏 -->
      <a-row :gutter="16" style="margin-bottom: 16px">
        <a-col :span="3">
          <a-input v-model="searchForm.keyword" placeholder="标题/编号" allow-clear @press-enter="handleSearch" />
        </a-col>
        <a-col :span="3">
          <a-select v-model="searchForm.product_line" placeholder="产品线" allow-clear>
            <a-option value="星瀚">星瀚</a-option>
            <a-option value="苍穹">苍穹</a-option>
            <a-option value="s-HR">s-HR</a-option>
          </a-select>
        </a-col>
        <a-col :span="3">
          <a-select v-model="searchForm.dimension_type" placeholder="维度类型" allow-clear>
            <a-option value="product_domain">产品领域</a-option>
            <a-option value="business_area">业务领域</a-option>
            <a-option value="project_group">项目组</a-option>
          </a-select>
        </a-col>
        <a-col :span="3">
          <a-input v-model="searchForm.dimension_value" placeholder="维度值" allow-clear @press-enter="handleSearch" />
        </a-col>
        <a-col :span="3">
          <a-input v-model="searchForm.attribution_tag" placeholder="归因标签" allow-clear @press-enter="handleSearch" />
        </a-col>
        <a-col :span="3">
          <a-select v-model="searchForm.status" placeholder="状态" allow-clear>
            <a-option value="new">新发现</a-option>
            <a-option value="issued">已提单</a-option>
            <a-option value="scheduled">已排期</a-option>
            <a-option value="fixing">修复中</a-option>
            <a-option value="fixed">已修复</a-option>
            <a-option value="verified">已验证</a-option>
            <a-option value="recurrent">复发</a-option>
            <a-option value="closed">已关闭</a-option>
            <a-option value="exempted">已豁免</a-option>
          </a-select>
        </a-col>
        <a-col :span="6">
          <a-space>
            <a-button type="primary" @click="handleSearch">查询</a-button>
            <a-button @click="handleReset">重置</a-button>
            <a-button status="success" @click="handleExport">导出 Excel</a-button>
          </a-space>
        </a-col>
      </a-row>

      <div class="scope-layout">
        <aside class="scope-panel">
          <IssueScopeTree :key="scopeTreeKey" @change="handleScopeChange" />
        </aside>
        <div class="scope-content">
          <!-- 状态统计 -->
          <a-row v-if="statsData" :gutter="8" style="margin-bottom: 12px">
            <a-col v-for="(val, key) in statsData" :key="key">
              <a-tag :color="statusColor(String(key))">{{ statusText(String(key)) }}: {{ val }}</a-tag>
            </a-col>
          </a-row>

          <!-- 表格 -->
          <a-table :data="tableData" :loading="loading" :pagination="pagination" @page-change="handlePageChange" row-key="id" :scroll="{ x: 1600 }">
            <template #columns>
              <a-table-column title="编号" data-index="pattern_no" :width="100" />
              <a-table-column title="标题" data-index="title" :width="250" ellipsis />
              <a-table-column title="归因标签" data-index="attribution_tag" :width="150">
                <template #cell="{ record }">
                  <template v-if="record.attribution_tag">
                    <a-tag v-for="(tag, idx) in splitTag(record.attribution_tag)" :key="idx" :color="idx === 0 ? 'arcoblue' : 'cyan'" size="small" style="margin-right: 4px">{{ tag }}</a-tag>
                  </template>
                  <span v-else>--</span>
                </template>
              </a-table-column>
              <a-table-column title="维度" :width="150">
                <template #cell="{ record }">
                  <span>{{ dimensionTypeText(record.dimension_type) }} / {{ record.dimension_value }}</span>
                </template>
              </a-table-column>
              <a-table-column title="产品线" data-index="product_line" :width="80" />
              <a-table-column title="首次出现" data-index="first_found_week" :width="100" />
              <a-table-column title="最近出现" data-index="last_found_week" :width="100" />
              <a-table-column title="周趋势" :width="160">
                <template #cell="{ record }">
                  <span v-if="record.weekly_stats" class="weekly-bar">
                    <span v-for="(cnt, week) in recentWeeks(record.weekly_stats)" :key="week" :title="`${week}: ${cnt}次`" class="bar-item" :style="{ height: barHeight(cnt as number) + 'px' }" />
                  </span>
                  <span v-else>--</span>
                </template>
              </a-table-column>
              <a-table-column title="状态" data-index="status" :width="90">
                <template #cell="{ record }">
                  <a-tag :color="statusColor(record.status)">{{ statusText(record.status) }}</a-tag>
                </template>
              </a-table-column>
              <a-table-column title="二开" data-index="is_custom" :width="60">
                <template #cell="{ record }">
                  <a-tag v-if="record.is_custom" color="orange" size="small">是</a-tag>
                  <span v-else>--</span>
                </template>
              </a-table-column>
              <a-table-column title="豁免" data-index="is_exempted" :width="60">
                <template #cell="{ record }">
                  <a-tag v-if="record.is_exempted" color="red" size="small">是</a-tag>
                  <span v-else>--</span>
                </template>
              </a-table-column>
              <a-table-column title="操作" :width="200" fixed="right">
                <template #cell="{ record }">
                  <a-space>
                    <a-link @click="handleDetail(record)">详情</a-link>
                    <a-tooltip :content="createIssueTip(record)">
                      <a-link :disabled="!!record.issue_id || !getDefectReport(record)" status="success" @click="handleCreateIssue(record)">生成问题</a-link>
                    </a-tooltip>
                    <a-dropdown @select="(key: any) => handleMoreAction(String(key), record)">
                      <a-link>更多<icon-down /></a-link>
                      <template #content>
                        <a-doption v-if="record.issue_id" value="viewIssue">查看问题</a-doption>
                        <a-doption v-else value="linkIssue">关联已有问题</a-doption>
                        <a-doption value="logs">下载关联日志</a-doption>
                        <a-doption value="exportDetail">导出台账详情</a-doption>
                      </template>
                    </a-dropdown>
                  </a-space>
                </template>
              </a-table-column>
            </template>
          </a-table>
        </div>
      </div>
    </a-card>

    <!-- 详情抽屉 -->
    <a-drawer
      v-model:visible="drawerVisible"
      :width="'82vw'"
      :title="currentRecord?.title || '问题详情'"
      :body-style="{ maxHeight: 'calc(100vh - 120px)', overflow: 'auto' }"
    >
      <a-descriptions :column="2" bordered size="small" style="margin-bottom: 16px">
        <a-descriptions-item label="编号">{{ currentRecord?.pattern_no }}</a-descriptions-item>
        <a-descriptions-item label="状态">
          <a-tag :color="statusColor(currentRecord?.status)">{{ statusText(currentRecord?.status) }}</a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="归因标签" :span="2">
          <template v-if="currentRecord?.attribution_tag">
            <a-tag v-for="(tag, idx) in splitTag(currentRecord.attribution_tag)" :key="idx" :color="idx === 0 ? 'arcoblue' : 'cyan'" size="small" style="margin-right: 4px">{{ tag }}</a-tag>
          </template>
          <span v-else>--</span>
        </a-descriptions-item>
        <a-descriptions-item label="维度">{{ dimensionTypeText(currentRecord?.dimension_type) }} / {{ currentRecord?.dimension_value }}</a-descriptions-item>
        <a-descriptions-item label="产品线">{{ currentRecord?.product_line || '--' }}</a-descriptions-item>
        <a-descriptions-item label="首次出现">{{ currentRecord?.first_found_week || '--' }}</a-descriptions-item>
        <a-descriptions-item label="最近出现">{{ currentRecord?.last_found_week || '--' }}</a-descriptions-item>
        <a-descriptions-item label="是否二开">{{ currentRecord?.is_custom ? '是' : '否' }}</a-descriptions-item>
        <a-descriptions-item label="是否豁免">{{ currentRecord?.is_exempted ? '是' : '否' }}</a-descriptions-item>
        <a-descriptions-item v-if="currentRecord?.exempt_reason" label="豁免原因" :span="2">{{ currentRecord.exempt_reason }}</a-descriptions-item>
        <a-descriptions-item v-if="currentRecord?.issue_id" label="关联问题单" :span="2">
          <a-link @click="gotoIssue(currentRecord.issue_id)">{{ currentRecord.issue_id }}</a-link>
        </a-descriptions-item>
      </a-descriptions>

      <template v-if="getDefectReport(currentRecord)">
        <a-divider>完整缺陷报告</a-divider>
        <a-descriptions :column="2" bordered size="small">
          <a-descriptions-item label="问题 Hash" :span="2"><a-typography-text copyable>{{ getDefectReport(currentRecord).problem_hash }}</a-typography-text></a-descriptions-item>
          <a-descriptions-item label="报告状态">{{ defectStatusText(getDefectReport(currentRecord).report_status) }}</a-descriptions-item>
          <a-descriptions-item label="可生成问题">{{ getDefectReport(currentRecord).issue_ready ? '是' : '否（证据不足，需确认）' }}</a-descriptions-item>
          <a-descriptions-item label="表单/操作" :span="2">{{ getDefectReport(currentRecord).scope?.form_id }} / {{ getDefectReport(currentRecord).scope?.operation }}</a-descriptions-item>
          <a-descriptions-item label="影响客户" :span="2">{{ (getDefectReport(currentRecord).scope?.customers || []).join('、') }}</a-descriptions-item>
          <a-descriptions-item label="样本/请求">{{ getDefectReport(currentRecord).metrics?.selected_sample_count }} / {{ getDefectReport(currentRecord).metrics?.affected_request_count }}</a-descriptions-item>
          <a-descriptions-item label="最大耗时">{{ getDefectReport(currentRecord).metrics?.max_cost_ms }} ms</a-descriptions-item>
          <a-descriptions-item label="数据规模" :span="2">{{ getDefectReport(currentRecord).metrics?.data_volume }}</a-descriptions-item>
        </a-descriptions>

        <a-divider>精确位置</a-divider>
        <div class="content-block">
          <div v-for="(location, idx) in getDefectReport(currentRecord).locations || []" :key="idx" style="margin-bottom: 6px">
            <a-tag size="small">{{ location.kind }}</a-tag>
            <code>{{ location.method || location.sql_skeleton || location.endpoint || '未定位' }}</code>
          </div>
        </div>

        <a-divider>复现步骤</a-divider>
        <ol class="content-block">
          <li v-for="(step, idx) in getDefectReport(currentRecord).reproduction_steps || []" :key="idx">{{ step }}</li>
        </ol>
        <a-divider>期望 / 实际</a-divider>
        <div class="content-block"><strong>期望：</strong>{{ getDefectReport(currentRecord).expected_result }}<br><strong>实际：</strong>{{ getDefectReport(currentRecord).actual_result }}</div>
        <a-divider>根因</a-divider>
        <div class="content-block">{{ getDefectReport(currentRecord).root_cause }}</div>
        <a-divider>修复建议</a-divider>
        <ul class="content-block"><li v-for="(item, idx) in getDefectReport(currentRecord).fix_suggestions || []" :key="idx">{{ item }}</li></ul>
        <a-divider>验证建议</a-divider>
        <ul class="content-block"><li v-for="(item, idx) in getDefectReport(currentRecord).verification_suggestions || []" :key="idx">{{ item }}</li></ul>
        <a-divider v-if="(getDefectReport(currentRecord).missing_evidence || []).length">缺失证据</a-divider>
        <ul v-if="(getDefectReport(currentRecord).missing_evidence || []).length" class="content-block"><li v-for="(item, idx) in getDefectReport(currentRecord).missing_evidence" :key="idx">{{ item }}</li></ul>
      </template>

      <a-divider>AI 摘要</a-divider>
      <div class="content-block">{{ currentRecord?.ai_summary || '暂无' }}</div>

      <a-divider>修复建议 (suggestion)</a-divider>
      <div class="content-block">{{ currentRecord?.suggestion || '暂无' }}</div>

      <a-divider>涉及对象 (involved_object)</a-divider>
      <div class="content-block">{{ currentRecord?.involved_object || '暂无' }}</div>

      <a-divider>证据 (evidence)</a-divider>
      <div v-if="currentRecord?.evidence && typeof currentRecord.evidence === 'object'" class="content-block">
        <template v-for="(val, key) in currentRecord.evidence" :key="key">
          <div style="margin-bottom: 8px">
            <strong>{{ key }}：</strong>
            <pre style="white-space: pre-wrap; margin: 4px 0">{{ typeof val === 'string' ? val : JSON.stringify(val, null, 2) }}</pre>
          </div>
        </template>
      </div>
      <div v-else class="content-block">暂无</div>

      <a-divider>影响客户 (customer_names)</a-divider>
      <div v-if="currentRecord?.customer_names && Array.isArray(currentRecord.customer_names)" class="content-block">
        <a-tag v-for="(name, idx) in currentRecord.customer_names" :key="idx" style="margin: 2px">{{ name }}</a-tag>
      </div>
      <div v-else class="content-block">暂无</div>

      <a-divider>影响表单 (form_keys)</a-divider>
      <div v-if="currentRecord?.form_keys && Array.isArray(currentRecord.form_keys)" class="content-block">
        <a-tag v-for="(fk, idx) in currentRecord.form_keys" :key="idx" size="small" style="margin: 2px">{{ fk }}</a-tag>
      </div>
      <div v-else class="content-block">暂无</div>

      <a-divider>样本 Trace IDs</a-divider>
      <div v-if="currentRecord?.sample_trace_ids" class="content-block">
        <div v-for="tid in traceIdList(currentRecord.sample_trace_ids)" :key="tid" style="margin-bottom: 4px">
          <a-typography-paragraph copyable style="margin: 0">{{ tid }}</a-typography-paragraph>
        </div>
      </div>
      <div v-else class="content-block">暂无</div>

      <template #footer>
        <a-space>
          <a-button @click="drawerVisible = false">关闭</a-button>
          <a-button :loading="detailExporting" @click="handleDetailExport">导出台账详情</a-button>
          <a-button type="primary" status="success" :loading="logsDownloading" @click="handleLogsDownload">下载关联日志</a-button>
        </a-space>
      </template>
    </a-drawer>

    <a-modal v-model:visible="linkIssueVisible" title="关联已有问题跟踪" :width="520" @ok="handleLinkIssue">
      <a-alert type="warning" style="margin-bottom: 12px">请输入问题跟踪的内部 ID（不是标题）。后端会校验问题真实存在且未删除。</a-alert>
      <a-input v-model="linkIssueId" placeholder="perf_issue.id" allow-clear />
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { Message, Modal } from '@arco-design/web-vue'
import { ApiPerfPatternLedger } from '@/api/perfApis'
import { useDownload, useGet, usePost } from '@/hooks'
import IssueScopeTree from '@/views/perf/components/IssueScopeTree.vue'

defineOptions({ name: 'pattern-ledger' })

const router = useRouter()
const pageNum = ref(1)
const pageSize = ref(20)
const scopeTreeKey = ref(0)
const searchForm = reactive({
  keyword: '',
  product_line: '',
  dimension_type: '',
  dimension_value: '',
  attribution_tag: '',
  status: '',
  project_group_code: '',
  cloud_number: '',
  app_number: '',
  form_id: '',
})
const drawerVisible = ref(false)
const currentRecord = ref<any>(null)
const detailExporting = ref(false)
const logsDownloading = ref(false)

// ── 映射 ──────────────────────────────────────

const linkIssueVisible = ref(false)
const linkIssueId = ref('')
const linkPattern = ref<any>(null)

const getDefectReport = (record: any) => record?.evidence?.defect_report || null
const defectStatusText = (status: string) => ({ complete: '完整', evidence_insufficient: '证据不足', pending_retry: '待重试' }[status] || status || '--')
const statusMap: Record<string, string> = {
  new: '新发现', issued: '已提单', scheduled: '已排期', fixing: '修复中',
  fixed: '已修复', verified: '已验证', recurrent: '复发', closed: '已关闭', exempted: '已豁免',
}
const statusText = (s: string | undefined) => (s ? statusMap[s] || s : '--')
const statusColor = (s: string | undefined) => ({
  new: 'orange', issued: 'blue', scheduled: 'purple', fixing: 'purple',
  fixed: 'cyan', verified: 'green', recurrent: 'red', closed: 'gray', exempted: 'gray',
}[s || ''] || 'gray')
const dimensionTypeText = (t: string | undefined) => ({ product_domain: '产品领域', business_area: '业务领域', project_group: '项目组' }[t || ''] || t || '--')

// 归因标签拆分（一级-二级）
const splitTag = (tag: string): string[] => tag.includes('-') ? tag.split('-', 2) : [tag]

// 周趋势工具
const recentWeeks = (stats: Record<string, number>): Record<string, number> => {
  const keys = Object.keys(stats).sort()
  const recent = keys.slice(-8)
  const result: Record<string, number> = {}
  recent.forEach(k => { result[k] = stats[k] })
  return result
}
const barHeight = (cnt: number): number => Math.min(Math.max(cnt * 4, 2), 28)

// trace id 拆分
const traceIdList = (raw: string): string[] => raw.split(/[,;\s]+/).filter(Boolean)

// ── 数据请求 ──────────────────────────────────────
const queryParams = computed(() => ({ ...searchForm, page_num: pageNum.value, page_size: pageSize.value }))
const { isFetching: loading, data: rawData, execute: fetchData } = useGet<any>(ApiPerfPatternLedger.list, queryParams, { immediate: true })
const tableData = computed(() => rawData.value?.list || [])
const statsData = computed(() => rawData.value?.stats || null)

const { downloadWithTip } = useDownload()

const handleExport = async () => {
  const params = new URLSearchParams()
  Object.entries(searchForm).forEach(([key, value]) => { if (value) params.set(key, String(value)) })
  await downloadWithTip(`${ApiPerfPatternLedger.export}?${params.toString()}`, '问题台账.xlsx', '问题台账导出失败')
}

const handleDetailExport = async (target?: any) => {
  const record = target || currentRecord.value
  if (!record) return
  const exactKey = record.pattern_fingerprint || record.pattern_no
  const params = new URLSearchParams({ keyword: exactKey })
  detailExporting.value = true
  try {
    await downloadWithTip(`${ApiPerfPatternLedger.export}?${params.toString()}`, `${record.pattern_no || '问题台账'}-详情.xlsx`, '台账详情导出失败')
  } finally {
    detailExporting.value = false
  }
}

// 下载该问题命中的原始天梯（Ops）日志压缩包，供开发自查完整时间线。
const handleLogsDownload = async (target?: any) => {
  const record = target || currentRecord.value
  if (!record?.id) return
  logsDownloading.value = true
  try {
    await downloadWithTip(
      `${ApiPerfPatternLedger.logs}?id=${encodeURIComponent(record.id)}`,
      `${record.pattern_no || '问题台账'}-原始天梯日志.zip`,
      '原始日志打包失败：日志可能已过留存期被清理，或任务工作目录已变更',
    )
  } finally {
    logsDownloading.value = false
  }
}

// 生成问题按钮的禁用原因，直接写在 tooltip 里避免用户猜。
const createIssueTip = (record: any): string => {
  if (record?.issue_id) return `已生成问题 ${record.issue_id}，可从"更多"查看`
  if (!getDefectReport(record)) return '旧台账没有完整缺陷报告，不能自动提单'
  return '从完整缺陷报告生成问题跟踪'
}

// 操作列只保留 详情/生成问题/更多，其余动作收进下拉。
const handleMoreAction = (key: string, record: any) => {
  switch (key) {
    case 'viewIssue':
      if (record.issue_id) gotoIssue(record.issue_id)
      break
    case 'linkIssue':
      openLinkIssue(record)
      break
    case 'logs':
      void handleLogsDownload(record)
      break
    case 'exportDetail':
      void handleDetailExport(record)
      break
    default:
      break
  }
}
const pagination = computed(() => ({ current: pageNum.value, pageSize: pageSize.value, total: rawData.value?.total || 0 }))

// ── 操作 ──────────────────────────────────────
const handleScopeChange = (scope: Record<string, string>) => {
  Object.assign(searchForm, {
    project_group_code: '', cloud_number: '', app_number: '', form_id: '', ...scope,
  })
  pageNum.value = 1
  fetchData()
}
const handleSearch = () => { pageNum.value = 1; fetchData() }
const handleReset = () => {
  Object.assign(searchForm, {
    keyword: '', product_line: '', dimension_type: '', dimension_value: '', attribution_tag: '', status: '',
    project_group_code: '', cloud_number: '', app_number: '', form_id: '',
  })
  scopeTreeKey.value += 1
  handleSearch()
}
const handlePageChange = (page: number) => { pageNum.value = page; fetchData() }
const handleDetail = (record: any) => { currentRecord.value = record; drawerVisible.value = true }
const gotoIssue = (issueId: string) => {
  router.push({ path: '/perf/issue', query: { keyword: issueId } })
}

const createIssuePayload = ref<any>({})
const { data: createIssueResult, execute: doCreateIssue } = usePost<any>(ApiPerfPatternLedger.createIssue, createIssuePayload, { immediate: false })
const savePatternPayload = ref<any>({})
const { execute: doSavePattern } = usePost<any>(ApiPerfPatternLedger.save, savePatternPayload, { immediate: false })

const performCreateIssue = async (record: any, confirmEvidenceInsufficient: boolean) => {
  createIssuePayload.value = { id: record.id, confirm_evidence_insufficient: confirmEvidenceInsufficient }
  await doCreateIssue()
  const result = createIssueResult.value
  Message.success(result?.created === false ? `已关联问题 ${result?.issue_no || ''}` : `问题 ${result?.issue_no || ''} 创建成功`)
  await fetchData()
}

const handleCreateIssue = (record: any) => {
  const report = getDefectReport(record)
  if (!report) { Message.warning('该台账没有完整缺陷报告，不能自动生成问题'); return }
  const insufficient = !report.issue_ready
  Modal.confirm({
    title: insufficient ? '以待补证问题提单？' : '生成问题跟踪？',
    content: insufficient
      ? '当前缺陷报告明确标记为证据不足。继续后将创建真实问题单，并保留缺失证据与待补证说明。'
      : `将从问题 ${report.problem_hash} 的完整缺陷报告创建真实问题跟踪，并原子回填台账关联。`,
    okText: insufficient ? '确认待补证提单' : '确认生成',
    onOk: () => performCreateIssue(record, insufficient),
  })
}

const openLinkIssue = (record: any) => {
  linkPattern.value = record
  linkIssueId.value = ''
  linkIssueVisible.value = true
}

const handleLinkIssue = async () => {
  if (!linkIssueId.value.trim()) { Message.warning('请输入问题 ID'); return false }
  savePatternPayload.value = { id: linkPattern.value.id, issue_id: linkIssueId.value.trim(), status: 'issued' }
  await doSavePattern()
  Message.success('关联成功')
  linkIssueVisible.value = false
  await fetchData()
  return true
}
</script>

<style scoped>
.content-block {
  white-space: pre-wrap;
  background: var(--color-fill-1);
  padding: 12px;
  border-radius: 4px;
}
.weekly-bar {
  display: inline-flex;
  align-items: flex-end;
  gap: 2px;
  height: 30px;
}
.bar-item {
  width: 6px;
  background: rgb(var(--arcoblue-5));
  border-radius: 1px;
}
.scope-layout { display: flex; gap: 16px; min-height: 520px; }
.scope-panel { width: 280px; flex-shrink: 0; padding-right: 12px; border-right: 1px solid var(--color-border-2); }
.scope-content { flex: 1; min-width: 0; }
</style>
