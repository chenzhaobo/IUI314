<template>
  <div class="container">
    <a-card :bordered="false">
      <a-row :gutter="16" style="margin-bottom: 16px">
        <a-col :span="4">
          <a-input v-model="searchForm.keyword" placeholder="报告标题" allow-clear @press-enter="handleSearch" />
        </a-col>
        <a-col :span="4">
          <a-select v-model="searchForm.analysis_type" placeholder="类型" allow-clear>
            <a-option value="daily_report">日报</a-option>
            <a-option value="weekly_report">周报</a-option>
            <a-option value="monthly_report">月报</a-option>
            <a-option value="monthly">月度</a-option>
            <a-option value="weekly">周度</a-option>
            <a-option value="adhoc">专项</a-option>
            <a-option value="domain_diagnosis">领域诊断</a-option>
            <a-option value="app_diagnosis">应用诊断</a-option>
            <a-option value="root_cause">根因分析</a-option>
          </a-select>
        </a-col>
        <a-col :span="3">
          <a-select v-model="searchForm.dimension_type" placeholder="维度" allow-clear>
            <a-option value="product_domain">产品领域</a-option>
            <a-option value="business_area">业务领域</a-option>
            <a-option value="project_group">项目组</a-option>
          </a-select>
        </a-col>
        <a-col :span="4">
          <a-input v-model="searchForm.dimension_value" placeholder="维度值（如 集团财务）" allow-clear @press-enter="handleSearch" />
        </a-col>
        <a-col :span="3">
          <a-select v-model="searchForm.status" placeholder="状态" allow-clear>
            <a-option value="draft">草稿</a-option>
            <a-option value="published">已发布</a-option>
            <a-option value="archived">已归档</a-option>
          </a-select>
        </a-col>
        <a-col :span="6">
          <a-space>
            <a-button type="primary" @click="handleSearch">查询</a-button>
            <a-button @click="handleReset">重置</a-button>
            <a-button type="primary" status="success" @click="handleAdd">新增</a-button>
          </a-space>
        </a-col>
      </a-row>

      <a-table :data="tableData" :loading="loading" :pagination="pagination" @page-change="handlePageChange">
        <template #columns>
          <a-table-column title="标题" data-index="title" :width="250" ellipsis />
          <a-table-column title="类型" data-index="analysis_type" :width="80">
            <template #cell="{ record }">{{ typeText(record.analysis_type) }}</template>
          </a-table-column>
          <a-table-column title="维度" :width="120">
            <template #cell="{ record }">
              <span v-if="record.dimension_type">{{ dimensionTypeText(record.dimension_type) }} / {{ record.dimension_value }}</span>
              <span v-else>--</span>
            </template>
          </a-table-column>
          <a-table-column title="周期" :width="180">
            <template #cell="{ record }">{{ record.period_start }} ~ {{ record.period_end }}</template>
          </a-table-column>
          <a-table-column title="问题数" data-index="issue_count" :width="80" />
          <a-table-column title="应用数" data-index="app_count" :width="80" />
          <a-table-column title="状态" data-index="status" :width="90">
            <template #cell="{ record }">
              <a-tag :color="statusColor(record.status)">{{ statusText(record.status) }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="创建时间" data-index="created_at" :width="180" />
          <a-table-column title="操作" :width="250" fixed="right">
            <template #cell="{ record }">
              <a-space>
                <a-link @click="handleDetail(record)">详情</a-link>
                <a-link @click="handleHtmlPreview(record)">HTML预览</a-link>
                <a-link v-if="record.analysis_type === 'daily_report'" status="success" @click="handleDailyExport(record)">导出 Excel</a-link>
                <a-link v-if="record.status === 'draft'" @click="handleEdit(record)">编辑</a-link>
                <a-popconfirm v-if="record.status === 'draft'" content="确定发布？" @ok="handlePublish(record)">
                  <a-link status="success">发布</a-link>
                </a-popconfirm>
                <a-popconfirm content="确定删除？" @ok="handleDelete(record)">
                  <a-link status="danger">删除</a-link>
                </a-popconfirm>
              </a-space>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </a-card>

    <!-- 详情抽屉 -->
    <a-drawer
      v-model:visible="drawerVisible"
      :width="'88vw'"
      :title="currentRecord?.title"
      :body-style="{ maxHeight: 'calc(100vh - 120px)', overflow: 'auto' }"
    >
      <a-spin :loading="detailLoading" style="display: block">
        <a-descriptions :column="2" bordered size="small" style="margin-bottom: 16px">
          <a-descriptions-item label="类型">{{ typeText(currentRecord?.analysis_type) }}</a-descriptions-item>
          <a-descriptions-item label="状态">{{ statusText(currentRecord?.status) }}</a-descriptions-item>
          <a-descriptions-item label="周期">{{ currentRecord?.period_start }} ~ {{ currentRecord?.period_end }}</a-descriptions-item>
          <a-descriptions-item label="问题数">{{ currentRecord?.issue_count }}</a-descriptions-item>
        </a-descriptions>
        <a-divider>摘要</a-divider>
        <div class="content">{{ currentRecord?.summary || '暂无' }}</div>
        <a-divider>报告内容</a-divider>
        <div class="content markdown">{{ currentRecord?.content || '暂无' }}</div>
        <a-divider>结论</a-divider>
        <div class="content">{{ currentRecord?.conclusion || '暂无' }}</div>
      </a-spin>
      <template #footer>
        <a-space>
          <a-button @click="drawerVisible = false">关闭</a-button>
          <a-button
            v-if="currentRecord?.analysis_type === 'daily_report'"
            type="primary"
            status="success"
            @click="handleDailyExport(currentRecord)"
          >下载关联 Excel</a-button>
        </a-space>
      </template>
    </a-drawer>

    <!-- 报告预览弹窗（富文本渲染） -->
    <a-modal v-model:visible="previewVisible" :title="`报告预览 — ${previewTitle}`" :width="'92vw'" :footer="false" :body-style="{ padding: '0', height: '82vh', overflow: 'auto' }">
      <a-spin v-if="previewLoading" style="display: block; text-align: center; padding-top: 200px" />
      <MdPreview v-else-if="previewContent" :modelValue="previewContent" style="min-height: 82vh" />
      <a-empty v-else description="暂无内容" style="padding-top: 200px" />
    </a-modal>

    <!-- 新增弹窗 -->
    <a-modal v-model:visible="modalVisible" title="新增报告" :width="700" @ok="handleSubmit">
      <a-form :model="formData" layout="vertical">
        <a-form-item label="标题" required>
          <a-input v-model="formData.title" />
        </a-form-item>
        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item label="类型">
              <a-select v-model="formData.analysis_type">
                <a-option value="monthly">月度</a-option>
                <a-option value="weekly">周度</a-option>
                <a-option value="adhoc">专项</a-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="开始日期">
              <a-date-picker v-model="formData.period_start" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="结束日期">
              <a-date-picker v-model="formData.period_end" style="width: 100%" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="摘要">
          <a-textarea v-model="formData.summary" :auto-size="{ minRows: 2 }" />
        </a-form-item>
        <a-form-item label="内容">
          <MdEditor v-model="formData.content" :style="{ height: '300px' }" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { Message } from '@arco-design/web-vue'
import { MdEditor, MdPreview } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'
import { ApiPerfReportV2 } from '@/api/perfApis'
import { useDelete, useDownload, useGet, usePost, usePut } from '@/hooks'

defineOptions({ name: 'report-list' })

const pageNum = ref(1)
const pageSize = ref(20)
const searchForm = reactive({ keyword: '', analysis_type: '', status: '', dimension_type: '', dimension_value: '' })
const drawerVisible = ref(false)
const detailLoading = ref(false)
const modalVisible = ref(false)
const currentRecord = ref<any>(null)
const formData = reactive<any>({ title: '', analysis_type: 'monthly', period_start: '', period_end: '', summary: '', content: '' })

const typeText = (t: string) => ({ daily_report: '日报', weekly_report: '周报', monthly_report: '月报', monthly: '月度', weekly: '周度', adhoc: '专项', domain_diagnosis: '领域诊断', app_diagnosis: '应用诊断', root_cause: '根因分析' }[t] || t)
const dimensionTypeText = (t: string) => ({ product_domain: '产品领域', business_area: '业务领域', project_group: '项目组' }[t] || t)
const statusText = (s: string) => ({ draft: '草稿', published: '已发布', archived: '已归档' }[s] || s)
const statusColor = (s: string) => ({ draft: 'gray', published: 'green', archived: 'blue' }[s] || 'gray')

const queryParams = computed(() => ({ ...searchForm, page_num: pageNum.value, page_size: pageSize.value }))
const { isFetching: loading, data: rawData, execute: fetchData } = useGet<any>(ApiPerfReportV2.getList, queryParams, { immediate: true })
const tableData = computed(() => rawData.value?.list || [])
const pagination = computed(() => ({ current: pageNum.value, pageSize: pageSize.value, total: rawData.value?.total || 0 }))

const handleSearch = () => { pageNum.value = 1; fetchData() }
const handleReset = () => { Object.assign(searchForm, { keyword: '', analysis_type: '', status: '', dimension_type: '', dimension_value: '' }); handleSearch() }
const handlePageChange = (page: number) => { pageNum.value = page; fetchData() }

async function fetchReportDetail(id: string) {
  const { data, execute } = useGet<any>(ApiPerfReportV2.getById, { id }, { immediate: false })
  await execute()
  return data.value || null
}

async function handleDetail(record: any) {
  currentRecord.value = record
  drawerVisible.value = true
  detailLoading.value = true
  try {
    currentRecord.value = await fetchReportDetail(record.id) || record
  }
  finally {
    detailLoading.value = false
  }
}
async function handleEdit(record: any) {
  const detail = await fetchReportDetail(record.id) || record
  Object.assign(formData, detail)
  modalVisible.value = true
}
const handleAdd = () => { Object.assign(formData, { title: '', analysis_type: 'monthly', period_start: '', period_end: '', summary: '', content: '' }); modalVisible.value = true }

// 新增
const addPayload = ref<any>({})
const { execute: doAdd } = usePost<any>(ApiPerfReportV2.add, addPayload, { immediate: false })
const handleSubmit = async () => {
  if (!formData.title) { Message.warning('请填写标题'); return }
  addPayload.value = { ...formData }
  await doAdd()
  Message.success('新增成功')
  modalVisible.value = false
  fetchData()
}

// 发布
const publishPayload = ref<any>({})
const { execute: doPublish } = usePut<any>(ApiPerfReportV2.publish, publishPayload, { immediate: false })
const handlePublish = async (record: any) => {
  publishPayload.value = { id: record.id }
  await doPublish()
  Message.success('发布成功')
  fetchData()
}

// 报告预览（富文本渲染）
const previewVisible = ref(false)
const previewLoading = ref(false)
const previewContent = ref('')
const previewTitle = ref('')

async function handleHtmlPreview(record: any) {
  previewTitle.value = record.title || ''
  previewVisible.value = true
  previewLoading.value = true
  previewContent.value = ''
  const detail = await fetchReportDetail(record.id)
  previewLoading.value = false
  previewContent.value = detail?.content || ''
}

// 支持 ?id= 直达报告预览（云之家日报推送卡片链接，T2.5）
const route = useRoute()
onMounted(async () => {
  const id = route.query.id as string
  if (!id) return
  await handleHtmlPreview({ id })
})

// 删除
const deletePayload = ref<any>({})
const { execute: doDelete } = useDelete<any>(ApiPerfReportV2.delete, deletePayload, { immediate: false })
const handleDelete = async (record: any) => {
  deletePayload.value = { ids: [record.id] }
  await doDelete()
  Message.success('删除成功')
  fetchData()
}

async function handleDailyExport(record: any) {
  const { downloadWithTip } = useDownload()
  await downloadWithTip(
    `${ApiPerfReportV2.dailyExport}?report_id=${encodeURIComponent(record.id)}`,
    `${record.title || '性能日报'}.xlsx`,
    '日报导出失败',
  )
}
</script>

<style scoped>
.content { white-space: pre-wrap; background: var(--color-fill-1); padding: 12px; border-radius: 4px; }
.markdown { font-family: monospace; }
</style>
