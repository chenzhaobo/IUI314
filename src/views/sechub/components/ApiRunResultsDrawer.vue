<script setup lang="ts">
/**
 * 运行结果明细（API测试结果页的抽屉）
 *
 * GET /sechub/scan/runs/{id}/results?page_num&page_size&verdict&test_type&keyword
 *   · 分页服务端做（一次全量运行可达数万条，绝不能再全取到前端筛）；
 *   · 每条结果内嵌 `case`（用例信息），列表列用它展示 用例ID / 类型；
 *   · keyword 匹配用例的 entity_number / api_path / entity_name / id —— 左树选了 API 时
 *     就把它作为初始 keyword（前缀子串匹配即可命中该接口）。
 */
import { computed, reactive, ref, watch } from 'vue'

import { ApiSecScan, resolveStaticScanApi } from '@/api/sechubApis'
import { formatTime, getAction } from '@/hooks'
import { CASE_TYPE_LABELS, TEST_TYPE_LABELS, VERDICT_OPTIONS, verdictColor } from './apiTestShared'

const props = defineProps<{
  /** 当前运行记录（列表行已含运行名称/统计，不再查详情） */
  run?: Record<string, any> | null
  /** 左树选中的 API：作为结果过滤的初始关键词 */
  presetKeyword?: string
}>()

const visible = defineModel<boolean>('visible', { default: false })

const loading = ref(false)
const rows = ref<any[]>([])
const total = ref(0)
const pageNum = ref(1)
const pageSize = ref(20)

// 请求/响应证据
const evidenceVisible = ref(false)
const selectedResult = ref<any>(null)
const selectedEvidence = computed(() => parseEvidence(selectedResult.value))
const scriptCases = computed<any[]>(() => selectedEvidence.value?.script_evidence?.cases || [])
const requestView = computed<any>(() => selectedEvidence.value?.request || {})

function parseEvidence(record: any) {
  const raw = record?.evidence
  if (!raw)
    return {}
  if (typeof raw === 'object')
    return raw
  try {
    return JSON.parse(raw)
  }
  catch {
    return {}
  }
}

function pretty(value: any) {
  if (value === null || value === undefined || value === '')
    return '--'
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2)
    }
    catch {
      return value
    }
  }
  try {
    return JSON.stringify(value, null, 2)
  }
  catch {
    return String(value)
  }
}

function openEvidence(record: any) {
  selectedResult.value = record
  evidenceVisible.value = true
}

function responseText(record: any) {
  return record?.response_body_preview || selectedEvidence.value?.response_preview || ''
}

function requestBody(record: any) {
  return requestView.value?.body ?? record?.case?.request_body
}

const filter = reactive({ verdict: '', test_type: '', keyword: '' })

const pagination = computed(() => ({
  current: pageNum.value,
  pageSize: pageSize.value,
  total: total.value,
  showTotal: true,
  showPageSize: true,
  pageSizeOptions: [20, 50, 100],
}))

async function fetchResults() {
  const id = props.run?.id
  if (!id)
    return
  loading.value = true
  try {
    const res = await getAction<any>(resolveStaticScanApi(ApiSecScan.runResults, { id }), {
      page_num: pageNum.value,
      page_size: pageSize.value,
      verdict: filter.verdict,
      test_type: filter.test_type,
      keyword: filter.keyword,
    })
    rows.value = res?.list || []
    total.value = res?.total || 0
  }
  finally {
    loading.value = false
  }
}

function handleSearch() {
  pageNum.value = 1
  fetchResults()
}

function handleReset() {
  filter.verdict = ''
  filter.test_type = ''
  filter.keyword = ''
  handleSearch()
}

function handlePageChange(page: number) {
  pageNum.value = page
  fetchResults()
}

function handlePageSizeChange(size: number) {
  pageSize.value = size
  pageNum.value = 1
  fetchResults()
}

/** 结果行展示的用例ID / 类型（结果内嵌 case） */
function caseIdOf(record: any) {
  const c = record?.case
  if (!c)
    return record?.case_id || '--'
  return c.case_code || (c.id ? String(c.id).slice(-8) : c.id || '--')
}
function caseTypeOf(record: any) {
  const c = record?.case
  if (!c)
    return '--'
  if (c.test_type)
    return TEST_TYPE_LABELS[c.test_type] || c.test_type
  return c.case_type ? CASE_TYPE_LABELS[c.case_type] || c.case_type : '--'
}

watch(visible, (v) => {
  if (!v)
    return
  filter.verdict = ''
  filter.test_type = ''
  filter.keyword = props.presetKeyword || ''
  pageNum.value = 1
  void fetchResults()
})
</script>

<template>
  <a-drawer
    v-model:visible="visible"
    :width="900"
    :title="`运行结果 · ${run?.run_name || ''}`"
    :body-style="{ maxHeight: 'calc(100vh - 120px)', overflow: 'auto' }"
  >
    <a-descriptions :column="3" bordered size="small" style="margin-bottom: 12px">
      <a-descriptions-item label="用例统计">
        总 {{ run?.total_cases ?? 0 }}｜PASS {{ run?.pass_cnt ?? 0 }}｜FAIL {{ run?.fail_cnt ?? 0 }}
      </a-descriptions-item>
      <a-descriptions-item label="迭代阶段">
        {{ run?.iteration_phase || '--' }}
      </a-descriptions-item>
      <a-descriptions-item label="开始时间">
        {{ formatTime(run?.started_at) }}
      </a-descriptions-item>
    </a-descriptions>

    <div class="filter-bar">
      <div class="f-wide">
        <a-input
          v-model="filter.keyword"
          placeholder="表单 / API / 用例ID"
          allow-clear
          @press-enter="handleSearch"
          @clear="handleSearch"
        />
      </div>
      <div class="f-mid">
        <a-select v-model="filter.verdict" placeholder="结果" allow-clear @change="handleSearch">
          <a-option v-for="v in VERDICT_OPTIONS" :key="v" :value="v">
            {{ v }}
          </a-option>
        </a-select>
      </div>
      <div class="f-mid">
        <a-select v-model="filter.test_type" placeholder="测试类型" allow-clear @change="handleSearch">
          <a-option v-for="(label, code) in TEST_TYPE_LABELS" :key="code" :value="code">
            {{ label }}
          </a-option>
        </a-select>
      </div>
      <a-button type="primary" @click="handleSearch">
        查询
      </a-button>
      <a-button @click="handleReset">
        重置
      </a-button>
    </div>

    <a-table
      :data="rows"
      :loading="loading"
      :pagination="pagination"
      :scroll="{ minWidth: 990 }"
      row-key="id"
      size="small"
      @page-change="handlePageChange"
      @page-size-change="handlePageSizeChange"
    >
      <template #columns>
        <a-table-column title="表单 / API" :width="220" ellipsis tooltip>
          <template #cell="{ record }">
            {{ record.case?.entity_number || record.case?.api_path || '--' }}
          </template>
        </a-table-column>
        <a-table-column title="用例ID" :width="140" ellipsis tooltip>
          <template #cell="{ record }">
            {{ caseIdOf(record) }}
          </template>
        </a-table-column>
        <a-table-column title="类型" :width="110">
          <template #cell="{ record }">
            {{ caseTypeOf(record) }}
          </template>
        </a-table-column>
        <a-table-column title="结果" :width="90">
          <template #cell="{ record }">
            <a-tooltip v-if="record.detail || record.error_message" :content="record.error_message || record.detail" mini>
              <a-tag :color="verdictColor(record.verdict)">
                {{ record.verdict }}
              </a-tag>
            </a-tooltip>
            <a-tag v-else :color="verdictColor(record.verdict)">
              {{ record.verdict }}
            </a-tag>
          </template>
        </a-table-column>
        <a-table-column title="HTTP 状态" :width="100">
          <template #cell="{ record }">
            {{ record.http_status_code ?? '--' }}
          </template>
        </a-table-column>
        <a-table-column title="耗时" :width="90">
          <template #cell="{ record }">
            {{ record.response_time_ms != null ? `${record.response_time_ms} ms` : '--' }}
          </template>
        </a-table-column>
        <a-table-column title="判定说明" :width="240" ellipsis tooltip>
          <template #cell="{ record }">
            {{ record.detail || record.error_message || '--' }}
          </template>
        </a-table-column>
        <a-table-column title="证据" :width="100" fixed="right">
          <template #cell="{ record }">
            <a-link @click="openEvidence(record)">
              请求/响应
            </a-link>
          </template>
        </a-table-column>
      </template>
      <template #empty>
        <a-empty description="暂无执行结果（该运行可能还没有 API 域结果）" />
      </template>
    </a-table>

    <a-modal
      v-model:visible="evidenceVisible"
      title="请求 / 响应证据"
      :width="1040"
      :footer="false"
      unmount-on-close
    >
      <template v-if="selectedResult">
        <a-descriptions :column="3" bordered size="small">
          <a-descriptions-item label="用例">
            {{ selectedResult.case?.case_code || selectedResult.case_id || '--' }}
          </a-descriptions-item>
          <a-descriptions-item label="接口" :span="2">
            {{ selectedResult.case?.api_path || '--' }}
          </a-descriptions-item>
          <a-descriptions-item label="结果">
            <a-tag :color="verdictColor(selectedResult.verdict)">
              {{ selectedResult.verdict }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="HTTP / 耗时">
            {{ selectedResult.http_status_code ?? selectedEvidence.http_status ?? '--' }}
            /
            {{ selectedResult.response_time_ms ?? selectedEvidence.elapsed_ms ?? '--' }} ms
          </a-descriptions-item>
          <a-descriptions-item label="用例类型">
            {{ caseTypeOf(selectedResult) }}
          </a-descriptions-item>
          <a-descriptions-item label="判定说明" :span="3">
            {{ selectedResult.detail || selectedResult.error_message || '--' }}
          </a-descriptions-item>
        </a-descriptions>

        <template v-if="scriptCases.length">
          <a-divider orientation="left">
            脚本逐 case 调用
          </a-divider>
          <a-collapse :bordered="false">
            <a-collapse-item
              v-for="(item, idx) in scriptCases"
              :key="item.id || idx"
              :header="`${item.id || 'case'} · ${item.verdict || '--'} · ${item.desc || ''}`"
            >
              <div class="case-detail">
                {{ item.detail || '--' }}
              </div>
              <div v-if="(item.http_calls || []).length" class="calls">
                <div v-for="(call, ci) in item.http_calls" :key="ci" class="call-block">
                  <div class="call-title">
                    {{ call.method }} {{ call.path }} · 角色 {{ call.role || '--' }} ·
                    HTTP {{ call.status_code ?? '--' }} · {{ call.elapsed_ms ?? '--' }} ms
                    <a-tag v-if="call.timeout" color="orange" size="small">
                      超时
                    </a-tag>
                    <a-tag v-if="call.sse" color="arcoblue" size="small">
                      SSE
                    </a-tag>
                  </div>
                  <a-row :gutter="12">
                    <a-col :span="12">
                      <div class="evidence-label">
                        请求
                      </div>
                      <pre class="evidence-pre">{{ pretty(call.request_body ?? call.params) }}</pre>
                    </a-col>
                    <a-col :span="12">
                      <div class="evidence-label">
                        响应
                      </div>
                      <pre class="evidence-pre">{{ pretty(call.response_preview) }}</pre>
                    </a-col>
                  </a-row>
                </div>
              </div>
              <a-empty v-else description="该 case 未记录 HTTP 调用（可能是 SSE/直接 requests 或旧脚本）" />
              <details v-if="item.evidence && Object.keys(item.evidence).length" class="raw-evidence">
                <summary>case evidence</summary>
                <pre class="evidence-pre">{{ pretty(item.evidence) }}</pre>
              </details>
            </a-collapse-item>
          </a-collapse>
        </template>

        <template v-else>
          <a-divider orientation="left">
            请求
          </a-divider>
          <div class="request-meta">
            {{ requestView.method || selectedResult.case?.http_method || '--' }}
            {{ requestView.path || selectedResult.case?.api_path || '--' }}
            · 角色 {{ requestView.role || selectedResult.case?.test_role || '--' }}
          </div>
          <div class="evidence-label">
            请求体
          </div>
          <pre class="evidence-pre">{{ pretty(requestBody(selectedResult)) }}</pre>
          <template v-if="requestView.headers && Object.keys(requestView.headers).length">
            <div class="evidence-label">
              请求头
            </div>
            <pre class="evidence-pre">{{ pretty(requestView.headers) }}</pre>
          </template>

          <a-divider orientation="left">
            响应
          </a-divider>
          <div class="request-meta">
            HTTP {{ selectedResult.http_status_code ?? selectedEvidence.http_status ?? '--' }}
            · {{ selectedResult.response_time_ms ?? selectedEvidence.elapsed_ms ?? '--' }} ms
          </div>
          <pre class="evidence-pre response-pre">{{ pretty(responseText(selectedResult)) }}</pre>
          <a-empty v-if="!responseText(selectedResult)" description="该结果未保存响应预览" />
        </template>

        <a-collapse v-if="selectedEvidence.stdout || selectedEvidence.stderr" class="io-collapse">
          <a-collapse-item header="脚本 stdout / stderr">
            <div class="evidence-label">
              stdout
            </div>
            <pre class="evidence-pre">{{ selectedEvidence.stdout || '--' }}</pre>
            <div class="evidence-label">
              stderr
            </div>
            <pre class="evidence-pre">{{ selectedEvidence.stderr || '--' }}</pre>
          </a-collapse-item>
        </a-collapse>
        <a-collapse class="io-collapse">
          <a-collapse-item header="完整证据 JSON">
            <pre class="evidence-pre">{{ pretty(selectedEvidence) }}</pre>
          </a-collapse-item>
        </a-collapse>
      </template>
    </a-modal>
  </a-drawer>
</template>

<style scoped>
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
}

.f-wide {
  width: 240px;
}
.f-mid {
  width: 150px;
}

.filter-bar > div :deep(.arco-select),
.filter-bar > div :deep(.arco-input-wrapper) {
  width: 100%;
}

.request-meta,
.case-detail {
  color: var(--color-text-2);
  font-size: 12px;
  margin-bottom: 6px;
}

.evidence-label {
  color: var(--color-text-3);
  font-size: 12px;
  margin: 6px 0 2px;
}

.evidence-pre {
  max-height: 260px;
  overflow: auto;
  padding: 8px;
  margin: 0 0 10px;
  color: var(--color-text-1);
  background: var(--color-fill-1);
  border-radius: 4px;
  font-family: inherit;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.response-pre {
  max-height: 360px;
}

.call-block {
  padding: 10px;
  margin-bottom: 10px;
  border: 1px solid var(--color-border-2);
  border-radius: 4px;
}

.call-title {
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 600;
}

.raw-evidence {
  margin-top: 8px;
}

.io-collapse {
  margin-top: 12px;
}
</style>
