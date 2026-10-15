<script setup lang="ts">
import type { TableData } from '@arco-design/web-vue'
import type { SlowLogPeriodOption, SlowLogPeriodType } from '@/types/perf-slow-logs'
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTableAutoHeight } from '@/hooks'
import { fetchPeriodOptions } from '@/views/perf/compliance/slowLogService'
import { formatSize, operationLabel, useFormSlowLogs } from '@/views/perf/composables/useFormSlowLogs'

defineOptions({ name: 'ComplianceSlowLogs' })

const route = useRoute()
const router = useRouter()

const tableWrap = ref<HTMLElement>()
const { tableHeight } = useTableAutoHeight(tableWrap)

const { loading, zipping, result, filters, filteredFiles, dateOptions, controlOptions, allHaveRequestControl, tenantOptions, load, downloadFile, downloadZip } = useFormSlowLogs()

function queryText(key: string): string {
  const v = route.query[key]
  return typeof v === 'string' ? v : ''
}

// ── 查询条件：从看板带过来，也可以在本页直接改，不必回看板重新跳 ──────────────
const productLine = computed(() => queryText('product_line') || '星瀚')
const form = reactive({ formId: '', periodType: 'monthly' as SlowLogPeriodType, period: '' })
const periodOptions = ref<SlowLogPeriodOption[]>([])
/** 预选操作没命中时的说明（旧日志没有逐条按钮名） */
const controlHint = ref('')

async function loadPeriodOptions(keep: string) {
  periodOptions.value = await fetchPeriodOptions(productLine.value, form.periodType)
  form.period = periodOptions.value.some(p => p.period === keep) ? keep : (periodOptions.value[0]?.period ?? '')
}

async function onPeriodTypeChange() {
  await loadPeriodOptions('')
}

/** 查询 = 改 URL：刷新 / 分享链接时条件不丢，route watch 负责重载 */
function search() {
  const label = periodOptions.value.find(p => p.period === form.period)?.label ?? form.period
  const sameForm = form.formId.trim() === queryText('form_id')
  void router.replace({
    name: 'compliance-slow-logs',
    query: {
      product_line: productLine.value,
      period_type: form.periodType,
      period: form.period,
      period_label: label,
      form_id: form.formId.trim(),
      // 换了表单，看板带来的名称与操作就不再适用
      ...(sameForm && queryText('form_name') ? { form_name: queryText('form_name') } : {}),
      ...(sameForm && queryText('control_name') ? { control_name: queryText('control_name') } : {}),
    },
  })
}

function resetQuery() {
  form.formId = ''
  filters.date = ''
  filters.control = ''
  filters.tenant = ''
  filters.trace = ''
}

const formTitle = computed(() => (queryText('form_name') && queryText('form_id') === form.formId.trim() ? queryText('form_name') : ''))
const periodRangeText = computed(() => (result.value ? `${result.value.period_start} ~ ${result.value.period_end}` : ''))

const tipText = computed(() => {
  const r = result.value
  if (!queryText('form_id'))
    return '请输入表单编码（如 cfm_loanbill_b_l）后查询。'
  if (!r || loading.value)
    return ''
  if (r.root_count === 0)
    return `「${productLine.value}」下没有可访问的报告任务工作目录，暂无已下载的慢日志。`
  if (r.truncated)
    return `命中 ${r.total} 个日志，仅展示前 ${r.files.length} 个，请缩小周期或使用打包下载。`
  if (!r.files.length)
    return '该表单在本周期内没有报告任务下载的慢日志。采集任务按「覆盖超量」只下载慢请求最多的那部分表单与操作，零星的慢请求可能不在其中。'
  return ''
})

function costSorter(a: TableData, b: TableData, extra: { direction: 'ascend' | 'descend' }) {
  const av = typeof a.cost === 'number' ? a.cost : -1
  const bv = typeof b.cost === 'number' ? b.cost : -1
  return extra.direction === 'descend' ? bv - av : av - bv
}

async function reload() {
  form.formId = queryText('form_id')
  form.periodType = queryText('period_type') === 'weekly' ? 'weekly' : 'monthly'
  await loadPeriodOptions(queryText('period'))
  controlHint.value = ''
  if (!form.formId || !form.period) {
    result.value = null
    return
  }
  await load({ product_line: productLine.value, period_type: form.periodType, period: form.period, form_id: form.formId })
  // 从看板按钮级行进入时预选对应操作
  const control = queryText('control_name')
  if (!control)
    return
  if (controlOptions.value.some(o => o.value === control))
    filters.control = control
  else if (!allHaveRequestControl.value)
    controlHint.value = `部分日志是按「表单 + 事件」分组下载的，没有记录每条请求的具体按钮（「${control}」的请求可能归在「刷新」等同事件分组里），已显示该表单全部日志。`
  else
    controlHint.value = `本周期没有「${control}」的已下载日志，已显示该表单全部日志。`
}

function goBack() {
  router.push({ name: 'compliance-dashboard' })
}

// 同一路由换参数时组件复用，需按 query 重载；只响应本路由
watch(() => route.query, () => {
  if (route.name === 'compliance-slow-logs')
    void reload()
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
          <span v-if="formTitle" class="form-title">{{ formTitle }}</span>
          <span class="period-text">{{ periodRangeText }}</span>
          <a-tag size="small">
            {{ productLine }}
          </a-tag>
        </a-space>
      </div>

      <a-row :gutter="12" align="center" style="margin-bottom: 12px">
        <a-col :span="6">
          <a-input v-model="form.formId" placeholder="表单编码，如 cas_paybill" allow-clear @press-enter="search" />
        </a-col>
        <a-col :span="5">
          <a-radio-group v-model="form.periodType" type="button" @change="onPeriodTypeChange">
            <a-radio value="monthly">
              按月
            </a-radio>
            <a-radio value="weekly">
              按周
            </a-radio>
          </a-radio-group>
        </a-col>
        <a-col :span="6">
          <a-select v-model="form.period" placeholder="统计周期" allow-search>
            <a-option v-for="p in periodOptions" :key="p.period" :value="p.period">
              {{ p.label }}
            </a-option>
          </a-select>
        </a-col>
        <a-col :span="7">
          <a-space>
            <a-button type="primary" :disabled="!form.formId.trim() || !form.period" @click="search">
              查询
            </a-button>
            <a-button @click="resetQuery">
              清空
            </a-button>
          </a-space>
        </a-col>
      </a-row>

      <a-alert v-if="tipText" type="info" style="margin-bottom: 12px">
        {{ tipText }}
      </a-alert>
      <a-alert v-if="controlHint" type="warning" closable style="margin-bottom: 12px">
        {{ controlHint }}
      </a-alert>

      <a-row :gutter="12" align="center" style="margin-bottom: 12px">
        <a-col :span="4">
          <a-select v-model="filters.date" placeholder="日期" allow-clear allow-search>
            <a-option v-for="o in dateOptions" :key="o.value" :value="o.value">
              {{ o.label }}
            </a-option>
          </a-select>
        </a-col>
        <a-col :span="4">
          <a-select v-model="filters.control" placeholder="操作" allow-clear allow-search>
            <a-option v-for="o in controlOptions" :key="o.value" :value="o.value">
              {{ o.label }}
            </a-option>
          </a-select>
        </a-col>
        <a-col :span="5">
          <a-select v-model="filters.tenant" placeholder="客户" allow-clear allow-search>
            <a-option v-for="o in tenantOptions" :key="o.value" :value="o.value">
              {{ o.label }}
            </a-option>
          </a-select>
        </a-col>
        <a-col :span="5">
          <!-- 项目组从缺陷报告里抄 trace id 来定位日志；报告里的缩写（3eab…6028）也认 -->
          <a-input v-model="filters.trace" placeholder="trace id（支持缩写）" allow-clear />
        </a-col>
        <a-col :span="6" style="text-align: right">
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
            <a-table-column title="操作" :width="160" ellipsis tooltip>
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
            <a-table-column title="下载" :width="70" fixed="right">
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
