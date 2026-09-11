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
      </template>
      <template #empty>
        <a-empty description="暂无执行结果（该运行可能还没有 API 域结果）" />
      </template>
    </a-table>
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
</style>
