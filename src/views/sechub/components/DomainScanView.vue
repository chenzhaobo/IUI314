<script setup lang="ts">
/**
 * 测试域视图（「表单安全遍历」/「OpenAPI测试」两个菜单共用）
 *
 * 数据来源：GET /sechub/scan/domain/cases（api/src/sechub/scan_task.rs + service/sec_case.rs）
 *   - 该域用例列表（分页 + 关键词/测试类型筛选）
 *   - 每条用例附最近一次执行结果 last_result（判定/时间/所属运行/证据）
 *   - summary：用例数、最近一次含该域结果的运行、该运行的判定分布
 *
 * 域与用例类型的映射见后端 sec_case::domain_case_types：
 *   form    → form_perm / form_inject
 *   openapi → openapi_perm / openapi_inject
 */
import { computed, ref, watch } from 'vue'

import { ApiSecScan } from '@/api/sechubApis'
import ListPage from '@/components/common/ListPage.vue'
import { formatTime, getAction } from '@/hooks'

const props = defineProps<{
  domain: 'form' | 'openapi'
}>()

const DOMAIN_META = {
  form: {
    entityLabel: '表单',
    emptyHint: '暂无表单用例：在「扫描任务」配置表单范围并执行后自动生成',
  },
  openapi: {
    entityLabel: 'API',
    emptyHint: '暂无 OpenAPI 用例：任务的测试类型勾选「OpenAPI测试」并执行后自动生成',
  },
} as const

const meta = computed(() => DOMAIN_META[props.domain])

const CASE_TYPE_LABELS: Record<string, string> = {
  form_perm: '表单权限',
  form_inject: '表单注入',
  openapi_perm: 'OpenAPI权限',
  openapi_inject: 'OpenAPI注入',
}

const TEST_TYPE_LABELS: Record<string, string> = {
  perm: '权限(越权)',
  anon: '未鉴权访问',
  idor: '越权(IDOR)',
  xss: 'XSS注入',
  sqli: 'SQL注入',
  java_reflect: 'Java反射',
  base: '正向基线',
}

const VERDICT: Record<string, { color: string }> = {
  PASS: { color: 'green' },
  FAIL: { color: 'red' },
  REVIEW: { color: 'orange' },
  BLOCKED: { color: 'gray' },
  ERROR: { color: 'orangered' },
}
const verdictColor = (v?: string | null) => VERDICT[v || '']?.color ?? 'gray'

const RUN_STATUS: Record<string, { label: string, color: string }> = {
  pending: { label: '待执行', color: 'gray' },
  running: { label: '运行中', color: 'blue' },
  success: { label: 'PASS', color: 'green' },
  failed: { label: 'FAIL', color: 'red' },
  partial: { label: '部分通过', color: 'orange' },
  cancelled: { label: '已取消', color: 'gray' },
}

// ── 列表 ──────────────────────────────────────────
const pageNum = ref(1)
const pageSize = ref(20)
const keyword = ref('')
const testType = ref('')
const loading = ref(false)
const rows = ref<any[]>([])
const total = ref(0)
const summary = ref<any>(null)

const pagination = computed(() => ({
  current: pageNum.value,
  pageSize: pageSize.value,
  total: total.value,
  showTotal: true,
  showPageSize: true,
}))

const verdictStats = computed(() => {
  const counts = summary.value?.verdict_counts || {}
  return ['PASS', 'FAIL', 'REVIEW', 'BLOCKED', 'ERROR']
    .map(v => ({ label: v, value: counts[v] || 0, color: verdictColor(v) }))
    .filter(x => x.value > 0)
})

async function fetchData() {
  loading.value = true
  try {
    const res = await getAction<any>(ApiSecScan.domainCases, {
      domain: props.domain,
      page_num: pageNum.value,
      page_size: pageSize.value,
      keyword: keyword.value,
      test_type: testType.value,
    })
    rows.value = res?.list || []
    total.value = res?.total || 0
    summary.value = res?.summary || null
  }
  finally {
    loading.value = false
  }
}

function handleSearch() {
  pageNum.value = 1
  fetchData()
}

function handleReset() {
  keyword.value = ''
  testType.value = ''
  handleSearch()
}

function handlePageChange(page: number) {
  pageNum.value = page
  fetchData()
}

function handlePageSizeChange(size: number) {
  pageSize.value = size
  pageNum.value = 1
  fetchData()
}

// ── 结果详情 ──────────────────────────────────────
const detailVisible = ref(false)
const detailCase = ref<any>(null)

function openDetail(record: any) {
  detailCase.value = record
  detailVisible.value = true
}

function entityText(record: any) {
  return record.entity_number || record.api_path || '--'
}
function testTypeText(record: any) {
  if (!record.test_type)
    return CASE_TYPE_LABELS[record.case_type] || record.case_type || '--'
  return TEST_TYPE_LABELS[record.test_type] || record.test_type
}

watch(() => props.domain, () => {
  pageNum.value = 1
  keyword.value = ''
  testType.value = ''
  fetchData()
}, { immediate: true })
</script>

<template>
  <div>
    <ListPage>
      <template #filter>
        <div class="filter-bar">
          <div class="f-wide">
            <a-input
              v-model="keyword"
              :placeholder="`${meta.entityLabel} / 路径 / 名称`"
              allow-clear
              @press-enter="handleSearch"
              @clear="handleSearch"
            />
          </div>
          <div class="f-mid">
            <a-select v-model="testType" placeholder="测试类型" allow-clear @change="handleSearch">
              <a-option value="perm">
                权限(越权)
              </a-option>
              <a-option v-if="domain === 'openapi'" value="anon">
                未鉴权访问
              </a-option>
              <a-option value="xss">
                XSS注入
              </a-option>
              <a-option value="sqli">
                SQL注入
              </a-option>
              <a-option value="java_reflect">
                Java反射
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
      </template>

      <template #default="{ tableHeight }">
        <!-- 域摘要 -->
        <div class="domain-summary">
          <div class="summary-item">
            <span class="summary-label">用例总数</span>
            <span class="summary-value">{{ summary?.case_total ?? 0 }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">最近执行</span>
            <template v-if="summary?.last_run">
              <a-tag :color="RUN_STATUS[summary.last_run.status]?.color || 'gray'">
                {{ RUN_STATUS[summary.last_run.status]?.label || summary.last_run.status }}
              </a-tag>
              <span class="summary-value">{{ summary.last_run.run_name }}</span>
              <span class="summary-sub">{{ formatTime(summary.last_run.finished_at || summary.last_run.started_at) }}</span>
            </template>
            <span v-else class="summary-sub">暂无执行记录</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">判定分布</span>
            <template v-if="verdictStats.length">
              <a-tag v-for="s in verdictStats" :key="s.label" :color="s.color">
                {{ s.label }}: {{ s.value }}
              </a-tag>
            </template>
            <span v-else class="summary-sub">--</span>
          </div>
        </div>

        <a-table
          :data="rows"
          :loading="loading"
          :pagination="pagination"
          :scroll="{ minWidth: 1060, y: tableHeight }"
          row-key="id"
          @page-change="handlePageChange"
          @page-size-change="handlePageSizeChange"
        >
          <template #columns>
            <a-table-column :title="meta.entityLabel" :width="230" ellipsis tooltip>
              <template #cell="{ record }">
                {{ entityText(record) }}
              </template>
            </a-table-column>
            <a-table-column title="用例名称" data-index="entity_name" :width="200" ellipsis tooltip />
            <a-table-column title="用例类型" :width="110">
              <template #cell="{ record }">
                {{ CASE_TYPE_LABELS[record.case_type] || record.case_type }}
              </template>
            </a-table-column>
            <a-table-column title="测试类型" :width="110">
              <template #cell="{ record }">
                {{ testTypeText(record) }}
              </template>
            </a-table-column>
            <a-table-column title="版本" data-index="api_version" :width="70">
              <template #cell="{ record }">
                {{ record.api_version || '--' }}
              </template>
            </a-table-column>
            <a-table-column title="最近结果" :width="170">
              <template #cell="{ record }">
                <template v-if="record.last_result">
                  <a-tag :color="verdictColor(record.last_result.verdict)">
                    {{ record.last_result.verdict }}
                  </a-tag>
                  <span class="summary-sub">{{ formatTime(record.last_result.tested_at) }}</span>
                </template>
                <span v-else class="summary-sub">未执行</span>
              </template>
            </a-table-column>
            <a-table-column title="操作" :width="100" fixed="right">
              <template #cell="{ record }">
                <a-link @click="openDetail(record)">
                  查看详情
                </a-link>
              </template>
            </a-table-column>
          </template>
          <template #empty>
            <a-empty :description="meta.emptyHint" />
          </template>
        </a-table>
      </template>
    </ListPage>

    <!-- 用例详情：最近一次结果（含证据） -->
    <a-modal
      v-model:visible="detailVisible"
      :title="`用例详情 · ${detailCase?.entity_name || detailCase?.entity_number || ''}`"
      width="720px"
      :footer="false"
    >
      <a-descriptions :column="2" bordered size="small">
        <a-descriptions-item :label="meta.entityLabel">
          {{ detailCase ? entityText(detailCase) : '--' }}
        </a-descriptions-item>
        <a-descriptions-item label="用例类型">
          {{ CASE_TYPE_LABELS[detailCase?.case_type] || detailCase?.case_type || '--' }}
        </a-descriptions-item>
        <a-descriptions-item label="测试类型">
          {{ detailCase ? testTypeText(detailCase) : '--' }}
        </a-descriptions-item>
        <a-descriptions-item label="HTTP 方法 / 版本">
          {{ detailCase?.http_method || '--' }} / {{ detailCase?.api_version || '--' }}
        </a-descriptions-item>
        <a-descriptions-item v-if="detailCase?.api_path" label="调用路径" :span="2">
          {{ detailCase.api_path }}
        </a-descriptions-item>
        <a-descriptions-item label="用例来源" :span="2">
          {{ detailCase?.case_source || '--' }}
        </a-descriptions-item>
      </a-descriptions>

      <a-divider>最近一次结果</a-divider>
      <template v-if="detailCase?.last_result">
        <a-descriptions :column="2" bordered size="small">
          <a-descriptions-item label="判定">
            <a-tag :color="verdictColor(detailCase.last_result.verdict)">
              {{ detailCase.last_result.verdict }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="执行时间">
            {{ formatTime(detailCase.last_result.tested_at) }}
          </a-descriptions-item>
          <a-descriptions-item label="所属运行" :span="2">
            {{ detailCase.last_result.run_name || detailCase.last_result.run_id || '--' }}
          </a-descriptions-item>
          <a-descriptions-item label="HTTP 状态">
            {{ detailCase.last_result.http_status_code ?? '--' }}
          </a-descriptions-item>
          <a-descriptions-item label="耗时">
            {{ detailCase.last_result.response_time_ms != null ? `${detailCase.last_result.response_time_ms} ms` : '--' }}
          </a-descriptions-item>
          <a-descriptions-item label="判定说明" :span="2">
            {{ detailCase.last_result.detail || '--' }}
          </a-descriptions-item>
          <a-descriptions-item v-if="detailCase.last_result.response_body_preview" label="响应预览" :span="2">
            <pre class="body-preview">{{ detailCase.last_result.response_body_preview }}</pre>
          </a-descriptions-item>
        </a-descriptions>
      </template>
      <a-empty v-else description="该用例尚未执行" />
    </a-modal>
  </div>
</template>

<style scoped>
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
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

.domain-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  align-items: center;
  padding: 12px 16px;
  margin-bottom: 12px;
  background: var(--color-fill-1);
  border-radius: 4px;
}

.summary-item {
  display: flex;
  gap: 8px;
  align-items: center;
}

.summary-label {
  color: var(--color-text-3);
}

.summary-value {
  font-weight: 600;
}

.summary-sub {
  color: var(--color-text-3);
  font-size: 12px;
}

.body-preview {
  max-height: 240px;
  margin: 0;
  overflow: auto;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
