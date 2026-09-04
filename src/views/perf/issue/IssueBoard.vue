<template>
  <div class="page-container">
    <a-card :bordered="false">
      <!-- 筛选栏 -->
      <a-row :gutter="16" style="margin-bottom: 16px">
        <a-col :span="4">
          <a-select v-model="filterProductLine" placeholder="产品线" allow-clear @change="fetchData">
            <a-option value="星瀚">星瀚</a-option>
            <a-option value="星空">星空</a-option>
          </a-select>
        </a-col>
        <a-col :span="4">
          <a-select v-model="filterSeverity" placeholder="严重程度" allow-clear @change="fetchData">
            <a-option value="critical">严重</a-option>
            <a-option value="major">主要</a-option>
            <a-option value="minor">次要</a-option>
          </a-select>
        </a-col>
        <a-col :span="4">
          <a-select v-model="filterProjectGroup" placeholder="项目组" allow-clear @change="fetchData">
            <a-option v-for="pg in projectGroups" :key="pg" :value="pg">{{ pg }}</a-option>
          </a-select>
        </a-col>
        <a-col :span="6">
          <a-space>
            <a-button type="primary" @click="fetchData">刷新</a-button>
            <a-button @click="handleReset">重置</a-button>
          </a-space>
        </a-col>
      </a-row>

      <!-- 统计卡片 -->
      <a-row :gutter="16" style="margin-bottom: 16px">
        <a-col :span="4">
          <a-statistic title="总问题数" :value="stats.total" />
        </a-col>
        <a-col :span="4">
          <a-statistic title="待确认" :value="stats.by_status?.pending || 0" :value-style="{ color: '#ff7d00' }" />
        </a-col>
        <a-col :span="4">
          <a-statistic title="修复中" :value="(stats.by_status?.fixing || 0) + (stats.by_status?.confirmed || 0)" :value-style="{ color: '#165dff' }" />
        </a-col>
        <a-col :span="4">
          <a-statistic title="已修复" :value="stats.by_status?.fixed || 0" :value-style="{ color: '#00b42a' }" />
        </a-col>
        <a-col :span="4">
          <a-statistic title="已验证" :value="(stats.by_status?.verified || 0) + (stats.by_status?.closed || 0)" :value-style="{ color: '#86909c' }" />
        </a-col>
        <a-col :span="4">
          <a-statistic title="不修复" :value="stats.by_status?.wontfix || 0" :value-style="{ color: '#86909c' }" />
        </a-col>
      </a-row>

      <!-- 看板列 -->
      <div class="board-container">
        <div v-for="col in boardColumns" :key="col.status" class="board-column">
          <div class="column-header" :style="{ borderTopColor: col.color }">
            <span>{{ col.label }}</span>
            <a-tag size="small" :color="col.color">{{ getColumnIssues(col.status).length }}</a-tag>
          </div>
          <div class="column-body">
            <div
              v-for="issue in getColumnIssues(col.status)"
              :key="issue.id"
              class="issue-card"
              @click="handleDetail(issue)"
            >
              <div class="issue-title">{{ issue.title }}</div>
              <div class="issue-meta">
                <a-tag size="small" :color="severityColor(issue.severity ?? '')">{{ severityText(issue.severity ?? '') }}</a-tag>
                <span class="issue-no">{{ issue.issue_no }}</span>
              </div>
              <div class="issue-footer">
                <span v-if="issue.app_name" class="issue-app">{{ issue.app_name }}</span>
                <span v-if="issue.project_group_name" class="issue-pg">{{ issue.project_group_name }}</span>
              </div>
            </div>
            <a-empty v-if="getColumnIssues(col.status).length === 0" description="暂无" />
          </div>
        </div>
      </div>
    </a-card>

    <!-- 详情抽屉 -->
    <a-drawer v-model:visible="drawerVisible" :width="600" :title="currentIssue?.title">
      <a-descriptions :column="2" bordered size="small">
        <a-descriptions-item label="编号">{{ currentIssue?.issue_no }}</a-descriptions-item>
        <a-descriptions-item label="状态">
          <a-tag :color="statusColor(currentIssue?.status)">{{ statusText(currentIssue?.status) }}</a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="严重程度">
          <a-tag :color="severityColor(currentIssue?.severity)">{{ severityText(currentIssue?.severity) }}</a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="类型">{{ currentIssue?.issue_type }}</a-descriptions-item>
        <a-descriptions-item label="应用">{{ currentIssue?.app_name }}</a-descriptions-item>
        <a-descriptions-item label="表单">{{ currentIssue?.form_name }}</a-descriptions-item>
        <a-descriptions-item label="项目组">{{ currentIssue?.project_group_name }}</a-descriptions-item>
        <a-descriptions-item label="客户">{{ currentIssue?.customer_name }}</a-descriptions-item>
        <a-descriptions-item label="平均耗时">{{ currentIssue?.avg_cost }}ms</a-descriptions-item>
        <a-descriptions-item label="最大耗时">{{ currentIssue?.max_cost }}ms</a-descriptions-item>
        <a-descriptions-item label="创建时间" :span="2">{{ currentIssue?.created_at }}</a-descriptions-item>
        <a-descriptions-item label="描述" :span="2">{{ currentIssue?.description || '暂无' }}</a-descriptions-item>
      </a-descriptions>

      <!-- 状态流转操作 -->
      <a-divider>状态流转</a-divider>
      <a-space>
        <a-button
          v-for="action in getAvailableActions(currentIssue?.status)"
          :key="action.target"
          :type="action.type"
          :status="action.status"
          size="small"
          @click="handleChangeStatus(currentIssue, action.target)"
        >
          {{ action.label }}
        </a-button>
      </a-space>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Message } from '@arco-design/web-vue'
import { ApiPerfIssue } from '@/api/perfApis'
import { useGet, usePut } from '@/hooks'

defineOptions({ name: 'issue-board' })

const filterProductLine = ref('')
const filterSeverity = ref('')
const filterProjectGroup = ref('')
const drawerVisible = ref(false)
const currentIssue = ref<any>(null)

const boardColumns = [
  { status: 'pending', label: '待确认', color: '#ff7d00' },
  { status: 'confirmed', label: '已确认', color: '#165dff' },
  { status: 'fixing', label: '修复中', color: '#722ed1' },
  { status: 'fixed', label: '已修复', color: '#00b42a' },
  { status: 'verified', label: '已验证', color: '#86909c' },
]

const severityText = (s: string) => ({ critical: '严重', major: '主要', minor: '次要' }[s] || s)
const severityColor = (s: string) => ({ critical: 'red', major: 'orange', minor: 'blue' }[s] || 'gray')
const statusText = (s: string) => ({ pending: '待确认', confirmed: '已确认', fixing: '修复中', fixed: '已修复', verified: '已验证', closed: '已关闭', wontfix: '不修复' }[s] || s)
const statusColor = (s: string) => ({ pending: 'orange', confirmed: 'blue', fixing: 'purple', fixed: 'green', verified: 'gray', closed: 'gray', wontfix: 'red' }[s] || 'gray')

// 查询参数
const listParams = computed(() => ({ product_line: filterProductLine.value, severity: filterSeverity.value, project_group_code: filterProjectGroup.value, page_size: 200 }))
const statsParams = computed(() => ({ product_line: filterProductLine.value, project_group_code: filterProjectGroup.value }))

// 问题列表
// 只声明本页用到的字段：看板按 status 分列，卡片渲染需要这些属性
interface IssueRow {
  id: string
  status: string
  severity?: string
  project_group_name?: string
  app_name?: string
  title?: string
  issue_no?: string
}
const { data: listData, execute: fetchList } = useGet<{ list?: IssueRow[] }>(ApiPerfIssue.getList, listParams, { immediate: true })
const issues = computed(() => listData.value?.list || [])

// 统计
const { data: statsData, execute: fetchStats } = useGet<any>(ApiPerfIssue.stats, statsParams, { immediate: true })
const stats = computed(() => statsData.value || {})

// 项目组列表
const projectGroups = computed(() => {
  const pgs = new Set<string>()
  issues.value.forEach((i: { project_group_name?: string }) => i.project_group_name && pgs.add(i.project_group_name))
  return Array.from(pgs)
})

const getColumnIssues = (status: string) => issues.value.filter((i) => i.status === status)

const getAvailableActions = (status: string) => {
  const actions: { target: string; label: string; type: 'primary' | 'secondary'; status?: 'success' | 'warning' | 'danger' }[] = []
  switch (status) {
    case 'pending':
      actions.push({ target: 'confirmed', label: '确认', type: 'primary' })
      actions.push({ target: 'wontfix', label: '不修复', type: 'primary', status: 'danger' })
      break
    case 'confirmed':
      actions.push({ target: 'fixing', label: '开始修复', type: 'primary' })
      actions.push({ target: 'wontfix', label: '不修复', type: 'primary', status: 'danger' })
      break
    case 'fixing':
      actions.push({ target: 'fixed', label: '标记已修复', type: 'primary', status: 'success' })
      break
    case 'fixed':
      actions.push({ target: 'verified', label: '验证通过', type: 'primary', status: 'success' })
      actions.push({ target: 'fixing', label: '重新修复', type: 'primary', status: 'warning' })
      break
    case 'verified':
      actions.push({ target: 'closed', label: '关闭', type: 'secondary' })
      break
    case 'wontfix':
      actions.push({ target: 'pending', label: '重新打开', type: 'primary', status: 'warning' })
      break
  }
  return actions
}

const fetchData = () => { fetchList(); fetchStats() }
const handleReset = () => {
  filterProductLine.value = ''
  filterSeverity.value = ''
  filterProjectGroup.value = ''
  fetchData()
}

const handleDetail = (issue: any) => {
  currentIssue.value = issue
  drawerVisible.value = true
}

// 状态变更
const statusPayload = ref<any>({})
const { execute: doChangeStatus } = usePut<any>(ApiPerfIssue.changeStatus, statusPayload, { immediate: false })
const handleChangeStatus = async (issue: any, targetStatus: string) => {
  statusPayload.value = { id: issue.id, status: targetStatus }
  await doChangeStatus()
  Message.success('状态已更新')
  drawerVisible.value = false
  fetchData()
}
</script>

<style scoped>
.board-container {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 8px;
}
.board-column {
  min-width: 240px;
  flex: 1;
  background: var(--color-fill-1);
  border-radius: 6px;
  border-top: 3px solid transparent;
}
.column-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  font-weight: 500;
  border-top: 3px solid;
  border-radius: 6px 6px 0 0;
}
.column-body {
  padding: 8px;
  max-height: 500px;
  overflow-y: auto;
}
.issue-card {
  background: var(--color-bg-2);
  border-radius: 4px;
  padding: 10px;
  margin-bottom: 8px;
  cursor: pointer;
  border: 1px solid var(--color-border-2);
  transition: box-shadow 0.2s;
}
.issue-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
.issue-title {
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.issue-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.issue-no {
  font-size: 11px;
  color: var(--color-text-3);
}
.issue-footer {
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: var(--color-text-3);
}
</style>
