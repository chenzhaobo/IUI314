<script setup lang="ts">
import type { TableData } from '@arco-design/web-vue'
import type { SlowLogPeriodType } from '@/types/perf-slow-logs'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTableAutoHeight } from '@/hooks'
import { formatSize, operationLabel, useFormSlowLogs } from '@/views/perf/composables/useFormSlowLogs'

defineOptions({ name: 'ComplianceSlowLogs' })

const route = useRoute()
const router = useRouter()

const tableWrap = ref<HTMLElement>()
const { tableHeight } = useTableAutoHeight(tableWrap)

const { loading, zipping, result, filters, filteredFiles, dateOptions, controlOptions, tenantOptions, load, downloadFile, downloadZip } = useFormSlowLogs()

function queryText(key: string): string {
  const v = route.query[key]
  return typeof v === 'string' ? v : ''
}

const productLine = computed(() => queryText('product_line') || '星瀚')
const periodType = computed<SlowLogPeriodType>(() => (queryText('period_type') === 'weekly' ? 'weekly' : 'monthly'))
const period = computed(() => queryText('period'))
const formId = computed(() => queryText('form_id'))
const formName = computed(() => queryText('form_name'))

const periodTypeText = computed(() => (periodType.value === 'weekly' ? '按周' : '按月'))
const periodText = computed(() => {
  const label = queryText('period_label') || period.value
  const r = result.value
  return r ? `${label}（${r.period_start} ~ ${r.period_end}）` : label
})

const tipText = computed(() => {
  const r = result.value
  if (!r || loading.value)
    return ''
  if (r.root_count === 0)
    return `「${productLine.value}」下没有可访问的报告任务工作目录，暂无已下载的慢日志。`
  if (r.truncated)
    return `命中 ${r.total} 个日志，仅展示前 ${r.files.length} 个，请缩小周期或使用打包下载。`
  if (!r.files.length)
    return '该表单在本周期内没有报告任务下载的慢日志（报告任务只下载所负责维度、超阈值的慢请求日志，且按每日限量选样）。'
  return ''
})

function costSorter(a: TableData, b: TableData, extra: { direction: 'ascend' | 'descend' }) {
  const av = typeof a.cost === 'number' ? a.cost : -1
  const bv = typeof b.cost === 'number' ? b.cost : -1
  return extra.direction === 'descend' ? bv - av : av - bv
}

function reload() {
  if (!formId.value)
    return
  void load({ product_line: productLine.value, period_type: periodType.value, period: period.value, form_id: formId.value }).then(() => {
    // 从看板按钮级行进入时预选对应操作
    const control = queryText('control_name')
    if (control && controlOptions.value.some(o => o.value === control))
      filters.control = control
  })
}

function goBack() {
  router.push({ name: 'compliance-dashboard' })
}

// 页面不缓存，但同一路由换参数（从看板点另一个表单）时组件会复用，需按 query 重载；
// 离开本页时 route 也会变化，只响应本路由
watch(() => route.query, () => {
  if (route.name === 'compliance-slow-logs')
    reload()
}, { immediate: true })
</script>

<template>
  <div class="page-container">
    <a-card :bordered="false" :body-style="{ padding: '16px' }">
      <div class="slow-log-header">
        <a-space :size="12" wrap>
          <a-link @click="goBack">
            <template #icon>
              <icon-left />
            </template>
            返回看板
          </a-link>
          <span class="form-title">{{ formName || formId || '未指定表单' }}</span>
          <a-tag v-if="formName && formId" size="small">
            {{ formId }}
          </a-tag>
          <a-tag color="arcoblue" size="small">
            {{ periodTypeText }}
          </a-tag>
          <span class="period-text">{{ periodText }}</span>
          <a-tag size="small">
            {{ productLine }}
          </a-tag>
        </a-space>
      </div>

      <a-alert v-if="tipText" type="info" style="margin-bottom: 12px">
        {{ tipText }}
      </a-alert>

      <a-row :gutter="12" align="center" style="margin-bottom: 12px">
        <a-col :span="5">
          <a-select v-model="filters.date" placeholder="日期" allow-clear allow-search>
            <a-option v-for="o in dateOptions" :key="o.value" :value="o.value">
              {{ o.label }}
            </a-option>
          </a-select>
        </a-col>
        <a-col :span="5">
          <a-select v-model="filters.control" placeholder="操作" allow-clear allow-search>
            <a-option v-for="o in controlOptions" :key="o.value" :value="o.value">
              {{ o.label }}
            </a-option>
          </a-select>
        </a-col>
        <a-col :span="6">
          <a-select v-model="filters.tenant" placeholder="客户" allow-clear allow-search>
            <a-option v-for="o in tenantOptions" :key="o.value" :value="o.value">
              {{ o.label }}
            </a-option>
          </a-select>
        </a-col>
        <a-col :span="8" style="text-align: right">
          <a-space>
            <span class="count-text">共 {{ filteredFiles.length }} 个日志</span>
            <a-button size="small" @click="reload">
              刷新
            </a-button>
            <a-tooltip content="按当前筛选打包下载（单次最多 500 个文件 / 300MB）" mini>
              <a-button type="primary" size="small" :loading="zipping" :disabled="!filteredFiles.length" @click="downloadZip">
                打包下载
              </a-button>
            </a-tooltip>
          </a-space>
        </a-col>
      </a-row>

      <div ref="tableWrap">
        <a-table
          :data="filteredFiles"
          :loading="loading"
          :pagination="{ showTotal: true, showPageSize: true, defaultPageSize: 50 }"
          size="small"
          row-key="path"
          :scroll="{ y: tableHeight }"
        >
          <template #columns>
            <a-table-column title="日期" data-index="date" :width="110" />
            <a-table-column title="操作" :width="140" ellipsis tooltip>
              <template #cell="{ record }">
                {{ operationLabel(record) }}
              </template>
            </a-table-column>
            <a-table-column title="客户" :width="200" ellipsis tooltip>
              <template #cell="{ record }">
                {{ record.customer_name || record.tenant_key || '—' }}
              </template>
            </a-table-column>
            <a-table-column title="Trace ID" data-index="trace_id" :width="220" ellipsis tooltip />
            <a-table-column title="耗时(秒)" :width="90" align="right" :sortable="{ sortDirections: ['descend', 'ascend'], sorter: costSorter }">
              <template #cell="{ record }">
                {{ record.cost == null ? '--' : (record.cost / 1000).toFixed(3) }}
              </template>
            </a-table-column>
            <a-table-column title="文件" data-index="file_name" ellipsis tooltip />
            <a-table-column title="大小" :width="90" align="right">
              <template #cell="{ record }">
                {{ formatSize(record.size) }}
              </template>
            </a-table-column>
            <a-table-column title="操作" :width="80" fixed="right">
              <template #cell="{ record }">
                <a-link @click="downloadFile(record)">
                  下载
                </a-link>
              </template>
            </a-table-column>
          </template>
        </a-table>
      </div>
    </a-card>
  </div>
</template>

<style scoped>
.slow-log-header { margin-bottom: 12px; }
.form-title { font-size: 16px; font-weight: 600; color: var(--color-text-1); }
.period-text { color: var(--color-text-2); }
.count-text { color: var(--color-text-3); font-size: 12px; }
</style>
