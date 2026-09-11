<script lang="ts" setup>
/**
 * 表单测试结果（安全测试 → 表单测试）
 *
 * 定位：**一条条的原始测试结果**（sec_sec_result join 用例 + 运行），
 * 与 API 域的「API测试结果」（运行列表 + 抽屉）不同 —— 这里直接按结果维度筛选与分页。
 *
 * 数据：GET /sechub/form-test/results
 *   域内类型固定：form_perm / form_inject / meta_perm_check / meta_log_check / meta_anon_check
 */
import { computed, reactive, ref } from 'vue'
import { type TableColumnData } from '@arco-design/web-vue'

import { ApiSecFormTest } from '@/api/sechubApis'
import ListPage from '@/components/common/ListPage.vue'
import { useGet, withTableDefaults } from '@/hooks'

// 组件名必须与路由 name（= sys_menu.path）一致，keep-alive :include 按它对上缓存
// eslint-disable-next-line vue/component-definition-name-casing
defineOptions({ name: 'form-results' })

const CASE_TYPE_OPTIONS = [
  { label: '表单权限', value: 'form_perm' },
  { label: '表单注入', value: 'form_inject' },
  { label: '静态权限检查', value: 'meta_perm_check' },
  { label: '静态日志检查', value: 'meta_log_check' },
  { label: '静态匿名访问', value: 'meta_anon_check' },
]

const VERDICT_OPTIONS = ['PASS', 'FAIL', 'REVIEW', 'BLOCKED', 'ERROR']
const VERDICT_COLOR: Record<string, string> = {
  PASS: 'green',
  FAIL: 'red',
  REVIEW: 'orange',
  BLOCKED: 'gray',
  ERROR: 'orangered',
}

const searchForm = reactive({ form_number: '', case_type: '', test_type: '', verdict: '', keyword: '' })
const pageNum = ref(1)
const pageSize = ref(20)

const { isFetching: loading, data: rawData, execute: fetchList } = useGet<Record<string, unknown>>(
  ApiSecFormTest.results,
  computed(() => ({
    page_num: pageNum.value,
    page_size: pageSize.value,
    form_number: searchForm.form_number || undefined,
    case_type: searchForm.case_type || undefined,
    test_type: searchForm.test_type || undefined,
    verdict: searchForm.verdict || undefined,
    keyword: searchForm.keyword || undefined,
  })),
  { immediate: true },
)

const rows = computed<Array<Record<string, unknown>>>(() => (rawData.value?.list as Array<Record<string, unknown>>) || [])
const total = computed(() => Number(rawData.value?.total || 0))

function handleSearch() {
  pageNum.value = 1
  fetchList()
}

function handleReset() {
  searchForm.form_number = ''
  searchForm.case_type = ''
  searchForm.test_type = ''
  searchForm.verdict = ''
  searchForm.keyword = ''
  handleSearch()
}

function handlePageChange(page: number) {
  pageNum.value = page
  fetchList()
}

function handlePageSizeChange(size: number) {
  pageSize.value = size
  pageNum.value = 1
  fetchList()
}

function formatTimeText(val: unknown): string {
  if (!val)
    return '--'
  const d = new Date(String(val))
  return Number.isNaN(d.getTime()) ? String(val) : d.toLocaleString('zh-CN', { hour12: false })
}

const columns: TableColumnData[] = withTableDefaults([
  { title: '表单', dataIndex: 'form_number', width: 180, ellipsis: true, tooltip: true },
  { title: '表单名称', dataIndex: 'entity_name', width: 160, ellipsis: true, tooltip: true },
  { title: '用例类型', dataIndex: 'case_type', width: 130, slotName: 'case_type' },
  { title: '测试类型', dataIndex: 'test_type', width: 110 },
  { title: '判定', dataIndex: 'verdict', width: 90, slotName: 'verdict' },
  { title: '判定说明', dataIndex: 'detail', ellipsis: true, tooltip: true },
  { title: 'HTTP', dataIndex: 'http_status_code', width: 70 },
  { title: '耗时(ms)', dataIndex: 'response_time_ms', width: 90 },
  { title: '运行', dataIndex: 'run_name', width: 220, ellipsis: true, tooltip: true },
  { title: '执行时间', dataIndex: 'tested_at', width: 170, slotName: 'tested_at' },
])
</script>

<template>
  <div class="form-results">
    <ListPage>
      <template #filter>
        <div class="filter-bar">
          <div class="f-mid">
            <a-input v-model="searchForm.form_number" placeholder="表单编码" allow-clear @press-enter="handleSearch" @clear="handleSearch" />
          </div>
          <div class="f-mid">
            <a-select v-model="searchForm.case_type" placeholder="用例类型" allow-clear @change="handleSearch">
              <a-option v-for="t in CASE_TYPE_OPTIONS" :key="t.value" :value="t.value">
                {{ t.label }}
              </a-option>
            </a-select>
          </div>
          <div class="f-sm">
            <a-select v-model="searchForm.verdict" placeholder="判定" allow-clear @change="handleSearch">
              <a-option v-for="v in VERDICT_OPTIONS" :key="v" :value="v">
                {{ v }}
              </a-option>
            </a-select>
          </div>
          <div class="f-wide">
            <a-input v-model="searchForm.keyword" placeholder="表单 / 用例ID / 标题 / 接口路径" allow-clear @press-enter="handleSearch" @clear="handleSearch" />
          </div>
          <a-button type="primary" @click="handleSearch">
            查询
          </a-button>
          <a-button @click="handleReset">
            重置
          </a-button>
        </div>
      </template>

      <template #toolbar>
        <div class="form-results-info">
          <span>共 {{ total.toLocaleString('en-US') }} 条原始结果（按执行时间倒序）</span>
        </div>
        <div class="toolbar-spacer" />
      </template>

      <template #default="{ tableHeight }">
        <a-table
          :data="rows"
          :columns="columns"
          :loading="loading"
          :pagination="{
            current: pageNum,
            pageSize,
            total,
            showTotal: true,
            showPageSize: true,
          }"
          :scroll="{ y: tableHeight, x: 1500 }"
          row-key="id"
          size="small"
          @page-change="handlePageChange"
          @page-size-change="handlePageSizeChange"
        >
          <template #case_type="{ record }">
            <a-tag v-if="record.case_type" size="small">
              {{ CASE_TYPE_OPTIONS.find(t => t.value === record.case_type)?.label || record.case_type }}
            </a-tag>
          </template>
          <template #verdict="{ record }">
            <a-tag :color="VERDICT_COLOR[String(record.verdict)] || 'gray'" size="small">
              {{ record.verdict }}
            </a-tag>
          </template>
          <template #tested_at="{ record }">
            {{ formatTimeText(record.tested_at) }}
          </template>
        </a-table>
      </template>
    </ListPage>
  </div>
</template>

<style scoped>
.form-results {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.form-results > :deep(.list-page) {
  flex: 1 1 auto;
  min-height: 0;
}

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.f-wide {
  width: 280px;
}

.f-mid {
  width: 160px;
}

.f-sm {
  width: 110px;
}

.filter-bar > div :deep(.arco-select),
.filter-bar > div :deep(.arco-input-wrapper) {
  width: 100%;
}

.form-results-info {
  color: var(--color-text-3);
  font-size: 12px;
}

.toolbar-spacer {
  flex: 1;
}
</style>
