<template>
  <div class="container">
    <a-card :bordered="false" :loading="loading">
      <template #title>
        <a-space>
          <a-button size="small" @click="goBack">
            <template #icon><icon-left /></template>
            返回
          </a-button>
          <span>{{ report?.title }}</span>
          <a-tag :color="statusColor(report?.status)">{{ statusText(report?.status) }}</a-tag>
        </a-space>
      </template>
      <template #extra>
        <a-space v-if="report?.status === 'draft'">
          <a-button type="primary" size="small" @click="handleEdit">编辑</a-button>
          <a-popconfirm content="确定发布此报告？发布后不可编辑" @ok="handlePublish">
            <a-button type="primary" status="success" size="small">发布</a-button>
          </a-popconfirm>
        </a-space>
      </template>

      <!-- 基本信息 -->
      <a-descriptions :column="3" bordered size="small" style="margin-bottom: 24px">
        <a-descriptions-item label="报告类型">{{ typeText(report?.analysis_type) }}</a-descriptions-item>
        <a-descriptions-item label="产品线">{{ report?.product_line || '-' }}</a-descriptions-item>
        <a-descriptions-item label="统计周期">{{ report?.period_start }} ~ {{ report?.period_end }}</a-descriptions-item>
        <a-descriptions-item label="问题数">{{ report?.issue_count }}</a-descriptions-item>
        <a-descriptions-item label="涉及应用数">{{ report?.app_count }}</a-descriptions-item>
        <a-descriptions-item label="创建时间">{{ report?.created_at }}</a-descriptions-item>
      </a-descriptions>

      <!-- 摘要 -->
      <a-card title="摘要" size="small" style="margin-bottom: 16px">
        <div class="content-block">{{ report?.summary || '暂无摘要' }}</div>
      </a-card>

      <!-- 报告正文 -->
      <a-card title="报告内容" size="small" style="margin-bottom: 16px">
        <MdPreview v-if="report?.content" :modelValue="report.content" />
        <div v-else class="content-block" style="color: var(--color-text-3)">暂无内容</div>
      </a-card>

      <!-- 结论 -->
      <a-card title="结论与建议" size="small" style="margin-bottom: 16px">
        <div class="content-block">{{ report?.conclusion || '暂无结论' }}</div>
      </a-card>

      <!-- 关联问题列表 -->
      <a-card title="关联问题" size="small" v-if="relatedIssues.length > 0">
        <a-table :data="relatedIssues" :pagination="false" size="small">
          <template #columns>
            <a-table-column title="编号" data-index="issue_no" :width="140" />
            <a-table-column title="标题" data-index="title" ellipsis />
            <a-table-column title="严重程度" data-index="severity" :width="90">
              <template #cell="{ record }">
                <a-tag size="small" :color="severityColor(record.severity)">{{ severityText(record.severity) }}</a-tag>
              </template>
            </a-table-column>
            <a-table-column title="状态" data-index="status" :width="90">
              <template #cell="{ record }">
                <a-tag size="small" :color="issueStatusColor(record.status)">{{ issueStatusText(record.status) }}</a-tag>
              </template>
            </a-table-column>
            <a-table-column title="项目组" data-index="project_group_name" :width="120" />
          </template>
        </a-table>
      </a-card>
    </a-card>

    <!-- 编辑弹窗 -->
    <a-modal v-model:visible="editVisible" title="编辑报告" :width="700" @ok="handleSaveEdit">
      <a-form :model="editForm" layout="vertical">
        <a-form-item label="标题" required>
          <a-input v-model="editForm.title" />
        </a-form-item>
        <a-form-item label="摘要">
          <a-textarea v-model="editForm.summary" :auto-size="{ minRows: 2 }" />
        </a-form-item>
        <a-form-item label="内容">
          <MdEditor v-model="editForm.content" :style="{ height: '300px' }" />
        </a-form-item>
        <a-form-item label="结论">
          <a-textarea v-model="editForm.conclusion" :auto-size="{ minRows: 2 }" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Message } from '@arco-design/web-vue'
import { IconLeft } from '@arco-design/web-vue/es/icon'
import { MdEditor, MdPreview } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'
import { ApiPerfReportV2, ApiPerfIssue } from '@/api/perfApis'
import { useGet, usePut } from '@/hooks'

defineOptions({ name: 'report-detail' })

const route = useRoute()
const router = useRouter()
const editVisible = ref(false)
const editForm = reactive<any>({ title: '', summary: '', content: '', conclusion: '' })

const typeText = (t: string) => ({ monthly: '月度分析', weekly: '周度分析', adhoc: '专项分析' }[t] || t)
const statusText = (s: string) => ({ draft: '草稿', published: '已发布', archived: '已归档' }[s] || s)
const statusColor = (s: string) => ({ draft: 'gray', published: 'green', archived: 'blue' }[s] || 'gray')
const severityText = (s: string) => ({ critical: '严重', major: '主要', minor: '次要' }[s] || s)
const severityColor = (s: string) => ({ critical: 'red', major: 'orange', minor: 'blue' }[s] || 'gray')
const issueStatusText = (s: string) => ({ pending: '待确认', confirmed: '已确认', fixing: '修复中', fixed: '已修复', verified: '已验证', closed: '已关闭', wontfix: '不修复' }[s] || s)
const issueStatusColor = (s: string) => ({ pending: 'orange', confirmed: 'blue', fixing: 'purple', fixed: 'green', verified: 'gray', closed: 'gray', wontfix: 'red' }[s] || 'gray')

// 获取报告详情
const reportId = computed(() => route.query.id as string)
const reportParams = computed(() => ({ id: reportId.value }))
const { isFetching: loading, data: report, execute: fetchReport } = useGet<any>(ApiPerfReportV2.getById, reportParams, { immediate: true })

// 获取关联问题
const issueParams = computed(() => ({ product_line: report.value?.product_line, page_size: 50 }))
const { data: issueData, execute: fetchIssues } = useGet<any>(ApiPerfIssue.getList, issueParams, { immediate: false })
const relatedIssues = computed(() => issueData.value?.list || [])

// 监听报告加载完成后获取关联问题
watch(report, (val) => {
  if (val?.product_line) fetchIssues()
})

const goBack = () => router.back()

const handleEdit = () => {
  Object.assign(editForm, {
    title: report.value?.title,
    summary: report.value?.summary,
    content: report.value?.content,
    conclusion: report.value?.conclusion,
  })
  editVisible.value = true
}

// 保存编辑
const editPayload = ref<any>({})
const { execute: doEdit } = usePut<any>(ApiPerfReportV2.edit, editPayload, { immediate: false })
const handleSaveEdit = async () => {
  if (!editForm.title) { Message.warning('标题不能为空'); return }
  editPayload.value = { ...report.value, ...editForm }
  await doEdit()
  Message.success('保存成功')
  editVisible.value = false
  fetchReport()
}

// 发布
const publishPayload = ref<any>({})
const { execute: doPublish } = usePut<any>(ApiPerfReportV2.publish, publishPayload, { immediate: false })
const handlePublish = async () => {
  publishPayload.value = { id: report.value.id }
  await doPublish()
  Message.success('发布成功')
  fetchReport()
}
</script>

<style scoped>
.content-block {
  white-space: pre-wrap;
  line-height: 1.8;
  padding: 8px 0;
}
.markdown-body h2, .markdown-body h3, .markdown-body h4 {
  margin: 12px 0 8px;
}
.markdown-body li {
  margin-left: 16px;
  list-style: disc;
}
</style>
