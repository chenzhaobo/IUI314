<script lang="ts" setup>
import { IconCloudDownload, IconFile, IconRefresh, IconRobot, IconSync, IconThunderbolt } from '@arco-design/web-vue/es/icon'
import { computed, onMounted, ref } from 'vue'
import { ErrorFlag } from '@/api/apis'
import { ApiStockAmazon, ApiStockAnalysis } from '@/api/stockApis'
import RightToolBar from '@/components/common/right-tool-bar.vue'
import { useGet, usePost, useToken } from '@/hooks'
import { systemMenus } from '@/router'
import type { amazonReport, stockDiff, stockDiffSearchReq } from '@/types/stock/stock'
import { DIFF_TYPE_MAP } from '@/types/stock/stock'
import StockAnalysisQuery from '@/views/stock/pages/stock-analysis-query.vue'
import StockAnalysisSyncModal from '@/views/stock/pages/stock-analysis-sync-modal.vue'
import StockAnalysisTable from '@/views/stock/pages/stock-analysis-table.vue'
import StockAnalysisUploadModal from '@/views/stock/pages/stock-analysis-upload-modal.vue'

defineOptions({
  name: systemMenus.stockAnalysis.path,
})

const { token } = useToken()

const showSearch = ref(true)
const loading = ref(false)
const tableData = ref<stockDiff[]>([])
const total = ref(0)

const queryParams = ref<stockDiffSearchReq>({
  page_num: 1,
  page_size: 10,
})

const reportOptions = ref<amazonReport[]>([])
const selectedReportId = ref('')
const selectedDiffType = ref('')

const syncModalVisible = ref(false)
const uploadModalVisible = ref(false)

// 根据选择的报告联动查询参数
const searchParams = computed<stockDiffSearchReq>(() => ({
  ...queryParams.value,
  report_id: selectedReportId.value || undefined,
  diff_type: selectedDiffType.value || undefined,
}))

async function getReportList() {
  const { data, execute } = useGet<{ list: amazonReport[] }>(ApiStockAmazon.getReportList, {
    page_num: 1,
    page_size: 100,
  })
  await execute()
  reportOptions.value = data.value?.list || []
}

async function getList() {
  loading.value = true
  const { data, execute } = useGet<{ list: stockDiff[], total: number }>(
    ApiStockAnalysis.getResult,
    searchParams,
  )
  await execute()
  loading.value = false
  if (data.value === ErrorFlag)
    return
  tableData.value = data.value?.list || []
  total.value = data.value?.total || 0
}

async function handleUploadSuccess(reportId: string) {
  await getReportList()
  if (reportId) {
    selectedReportId.value = reportId
  }
  await getList()
}

async function handleAutoFetch() {
  const { data, execute } = usePost<string>(ApiStockAmazon.autoFetch, {})
  await execute()
  if (data.value === ErrorFlag)
    return
  await getReportList()
}

async function handleRunAnalysis() {
  if (!selectedReportId.value) {
    return
  }
  const { data, execute } = usePost<string>(ApiStockAnalysis.run, { report_id: selectedReportId.value })
  await execute()
  if (data.value === ErrorFlag)
    return
  await getList()
}

async function handleExport() {
  if (!selectedReportId.value || !selectedDiffType.value) {
    return
  }
  const url = `${ApiStockAnalysis.export}?report_id=${encodeURIComponent(selectedReportId.value)}&diff_type=${encodeURIComponent(selectedDiffType.value)}`
  const res = await fetch(url, {
    headers: { Authorization: token.value },
  })
  if (!res.ok) {
    return
  }
  const blob = await res.blob()
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `stock_diff_${selectedDiffType.value}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(link.href)
}

function handlePageChange() {
  getList()
}

onMounted(() => {
  getReportList()
  getList()
})
</script>

<template>
  <div>
    <!-- 操作区域 -->
    <a-card class="m-b-8px" :bordered="false">
      <a-row :gutter="10" align="center">
        <a-col :span="5">
          <a-select
            v-model="selectedReportId"
            placeholder="选择 Amazon 报告"
            allow-clear
            allow-search
            :style="{ width: '100%' }"
          >
            <a-option
              v-for="item in reportOptions"
              :key="item.report_id"
              :value="item.report_id"
            >
              {{ item.file_name }} ({{ item.total_count }})
            </a-option>
          </a-select>
        </a-col>
        <a-col :span="3">
          <a-select
            v-model="selectedDiffType"
            placeholder="差异类型"
            allow-clear
            :style="{ width: '100%' }"
          >
            <a-option
              v-for="(label, key) in DIFF_TYPE_MAP"
              :key="key"
              :value="key"
            >
              {{ label }}
            </a-option>
          </a-select>
        </a-col>
        <a-col :span="16">
          <a-space wrap>
            <a-button type="primary" @click="syncModalVisible = true">
              <template #icon>
                <IconSync />
              </template>
              同步 Giga
            </a-button>
            <a-button @click="uploadModalVisible = true">
              <template #icon>
                <IconFile />
              </template>
              上传报表
            </a-button>
            <a-button @click="handleAutoFetch">
              <template #icon>
                <IconRobot />
              </template>
              自动拉取
            </a-button>
            <a-button type="primary" status="success" :disabled="!selectedReportId" @click="handleRunAnalysis">
              <template #icon>
                <IconThunderbolt />
              </template>
              运行分析
            </a-button>
            <a-button type="primary" status="warning" :disabled="!selectedReportId || !selectedDiffType" @click="handleExport">
              <template #icon>
                <IconCloudDownload />
              </template>
              导出 CSV
            </a-button>
            <a-button @click="getList">
              <template #icon>
                <IconRefresh />
              </template>
              刷新
            </a-button>
          </a-space>
        </a-col>
      </a-row>
    </a-card>

    <!-- 查询区域 -->
    <StockAnalysisQuery
      v-model:query-params="queryParams"
      v-model:show-search="showSearch"
      @get-list="getList"
    />

    <!-- 表格区域 -->
    <a-row :gutter="10" class="m-b-8px">
      <a-col flex="auto" />
      <RightToolBar v-model:showSearch="showSearch" @query-table="getList" />
    </a-row>
    <StockAnalysisTable
      :is-loading="loading"
      :table-data="tableData"
      :total="total"
      @pagination="handlePageChange"
    />

    <!-- Cookie 同步弹窗 -->
    <StockAnalysisSyncModal
      v-model:visible="syncModalVisible"
      @success="getReportList"
    />

    <!-- 上传报表弹窗 -->
    <StockAnalysisUploadModal
      v-model:visible="uploadModalVisible"
      @success="handleUploadSuccess"
    />
  </div>
</template>
