<script setup lang="ts">
import type { AiAgentFeedback, AiListResult } from '@/api/aiApis'
/**
 * AI中心 → Agent反馈（通用复盘反馈）。
 *
 * 执行记录页手动发起复盘；复盘 Agent 输出 problems/improvements，
 * 平台按 fingerprint 聚合、累计出现次数。本页负责分诊。
 */
import { Message } from '@arco-design/web-vue'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ApiAiFeedback } from '@/api/aiApis'
import { formatTime, getAction, postAction } from '@/hooks'

defineOptions({ name: 'AgentFeedback' })

const route = useRoute()
const router = useRouter()
const CATEGORY_OPTIONS = [
  { value: 'tool', label: '工具能力' },
  { value: 'prompt_skill', label: '提示词/技能' },
  { value: 'data', label: '数据/造数' },
  { value: 'environment', label: '环境/凭据' },
  { value: 'false_positive', label: '误判' },
  { value: 'performance', label: '性能/耗时' },
  { value: 'execution', label: '平台执行' },
  { value: 'agent_contract', label: 'Agent 契约' },
  { value: 'improvement', label: '改进建议' },
  { value: 'other', label: '其他' },
]
const DOMAIN_OPTIONS = [
  { value: 'apitest', label: 'API 安全测试' },
  { value: 'static_scan', label: '静态扫描' },
  { value: 'perf', label: '性能测试' },
  { value: 'bot', label: '智能助手' },
  { value: 'other', label: '其他' },
]
const SEVERITY_OPTIONS = [
  { value: 'blocker', label: '阻塞' },
  { value: 'high', label: '高' },
  { value: 'medium', label: '中' },
  { value: 'low', label: '低' },
]
const STATUS_OPTIONS = [
  { value: 'open', label: '待处理' },
  { value: 'triaged', label: '已分诊' },
  { value: 'accepted', label: '已采纳' },
  { value: 'rejected', label: '不处理' },
  { value: 'fixed', label: '已修复' },
]
const SEVERITY_META: Record<string, { label: string, color: string }> = {
  blocker: { label: '阻塞', color: 'red' },
  high: { label: '高', color: 'orangered' },
  medium: { label: '中', color: 'orange' },
  low: { label: '低', color: 'gray' },
}
const STATUS_META: Record<string, { label: string, color: string }> = {
  open: { label: '待处理', color: 'blue' },
  triaged: { label: '已分诊', color: 'arcoblue' },
  accepted: { label: '已采纳', color: 'green' },
  rejected: { label: '不处理', color: 'gray' },
  fixed: { label: '已修复', color: 'green' },
}
const CATEGORY_LABELS = Object.fromEntries(CATEGORY_OPTIONS.map(o => [o.value, o.label]))
const DOMAIN_LABELS = Object.fromEntries(DOMAIN_OPTIONS.map(o => [o.value, o.label]))

const filters = reactive({
  keyword: '',
  domain: '',
  caller_module: '',
  category: '',
  severity: '',
  status: '',
  execution_id: typeof route.query.execution_id === 'string' ? route.query.execution_id : '',
})
const pageNum = ref(1)
const pageSize = ref(20)
const loading = ref(false)
const rows = ref<AiAgentFeedback[]>([])
const total = ref(0)

const queryParams = computed(() => ({
  page_num: pageNum.value,
  page_size: pageSize.value,
  keyword: filters.keyword || undefined,
  domain: filters.domain || undefined,
  caller_module: filters.caller_module || undefined,
  category: filters.category || undefined,
  severity: filters.severity || undefined,
  status: filters.status || undefined,
  execution_id: filters.execution_id || undefined,
}))

async function load() {
  loading.value = true
  try {
    const data = await getAction<AiListResult<AiAgentFeedback>>(ApiAiFeedback.list, queryParams.value)
    if (!data)
      return
    rows.value = Array.isArray(data.list) ? data.list : []
    total.value = data.total || 0
  }
  finally {
    loading.value = false
  }
}

function search() {
  pageNum.value = 1
  void load()
}

function reset() {
  filters.keyword = ''
  filters.domain = ''
  filters.caller_module = ''
  filters.category = ''
  filters.severity = ''
  filters.status = ''
  filters.execution_id = ''
  search()
}

function pageChange(page: number) {
  pageNum.value = page
  void load()
}

function pageSizeChange(size: number) {
  pageSize.value = size
  pageNum.value = 1
  void load()
}

function severityMeta(v: string) {
  return SEVERITY_META[v] || { label: v || '--', color: 'gray' }
}
function statusMeta(v: string) {
  return STATUS_META[v] || { label: v || '--', color: 'gray' }
}
function categoryLabel(v: string) {
  return CATEGORY_LABELS[v] || v || '--'
}
function domainLabel(v: string) {
  return DOMAIN_LABELS[v] || v || '--'
}
function openExecution(id?: string | null) {
  if (!id)
    return
  void router.push({ path: '/ai/execution-log', query: { execution_id: id } })
}

async function updateStatus(row: AiAgentFeedback, status: string) {
  const res = await postAction<string>(ApiAiFeedback.status, { id: row.id, status })
  if (res === null)
    return
  Message.success(`已标记为「${STATUS_META[status]?.label || status}」`)
  await load()
}

onMounted(load)
</script>

<template>
  <div class="feedback-page">
    <a-alert type="info" style="margin-bottom: 12px">
      Agent 执行结束后由执行记录页手动发起复盘；平台按 fingerprint 聚合问题与改进建议。
      反馈是过程改进，不是漏洞结论。优先处理「出现次数高 × 严重度高」的条目。
    </a-alert>

    <a-card :bordered="false">
      <div class="filter-bar">
        <a-input v-model="filters.keyword" placeholder="问题/建议/模块" allow-clear style="width: 220px" @press-enter="search" @clear="search" />
        <a-select v-model="filters.domain" placeholder="领域" allow-clear style="width: 150px" @change="search">
          <a-option v-for="o in DOMAIN_OPTIONS" :key="o.value" :value="o.value">
            {{ o.label }}
          </a-option>
        </a-select>
        <a-input v-model="filters.caller_module" placeholder="caller_module" allow-clear style="width: 180px" @press-enter="search" />
        <a-select v-model="filters.category" placeholder="类别" allow-clear style="width: 170px" @change="search">
          <a-option v-for="o in CATEGORY_OPTIONS" :key="o.value" :value="o.value">
            {{ o.label }}
          </a-option>
        </a-select>
        <a-select v-model="filters.severity" placeholder="严重度" allow-clear style="width: 120px" @change="search">
          <a-option v-for="o in SEVERITY_OPTIONS" :key="o.value" :value="o.value">
            {{ o.label }}
          </a-option>
        </a-select>
        <a-select v-model="filters.status" placeholder="状态" allow-clear style="width: 120px" @change="search">
          <a-option v-for="o in STATUS_OPTIONS" :key="o.value" :value="o.value">
            {{ o.label }}
          </a-option>
        </a-select>
        <a-input v-model="filters.execution_id" placeholder="执行 ID" allow-clear style="width: 190px" @press-enter="search" />
        <a-button type="primary" @click="search">
          查询
        </a-button>
        <a-button @click="reset">
          重置
        </a-button>
        <div class="spacer" />
        <a-tag color="arcoblue">
          共 {{ total }} 条
        </a-tag>
      </div>

      <a-table
        :data="rows"
        :loading="loading"
        row-key="id"
        :pagination="{
          current: pageNum,
          pageSize,
          total,
          showTotal: true,
          showPageSize: true,
        }"
        :scroll="{ minWidth: 1280 }"
        @page-change="pageChange"
        @page-size-change="pageSizeChange"
      >
        <template #columns>
          <a-table-column title="领域" :width="120">
            <template #cell="{ record }">
              <a-tag color="arcoblue">
                {{ domainLabel(record.domain) }}
              </a-tag>
            </template>
          </a-table-column>
          <a-table-column title="调用模块 / Agent" :width="230" ellipsis tooltip>
            <template #cell="{ record }">
              <div>{{ record.caller_module }}</div>
              <div class="sub">
                {{ record.agent_code || '--' }}<template v-if="record.model">
                  / {{ record.model }}
                </template>
              </div>
            </template>
          </a-table-column>
          <a-table-column title="类别 / 严重度" :width="150">
            <template #cell="{ record }">
              <a-tag :color="severityMeta(record.severity).color">
                {{ severityMeta(record.severity).label }}
              </a-tag>
              <div class="sub">
                {{ categoryLabel(record.category) }}
              </div>
            </template>
          </a-table-column>
          <a-table-column title="问题 / 建议" ellipsis tooltip>
            <template #cell="{ record }">
              <div class="title">
                {{ record.title }}
              </div>
              <div class="sub">
                {{ record.detail }}
              </div>
              <div v-if="record.suggestion" class="sub suggestion">
                建议：{{ record.suggestion }}
              </div>
            </template>
          </a-table-column>
          <a-table-column title="出现次数" data-index="occurrences" :width="90" />
          <a-table-column title="执行 ID" :width="190" ellipsis tooltip>
            <template #cell="{ record }">
              <a-link @click="openExecution(record.last_execution_id || record.execution_id)">
                {{ record.last_execution_id || record.execution_id }}
              </a-link>
            </template>
          </a-table-column>
          <a-table-column title="最后出现" :width="160">
            <template #cell="{ record }">
              {{ formatTime(record.last_seen_at) }}
            </template>
          </a-table-column>
          <a-table-column title="状态" :width="90">
            <template #cell="{ record }">
              <a-tag :color="statusMeta(record.status).color">
                {{ statusMeta(record.status).label }}
              </a-tag>
            </template>
          </a-table-column>
          <a-table-column title="处理" :width="220" fixed="right">
            <template #cell="{ record }">
              <a-space>
                <a-link v-if="record.status === 'open'" @click="updateStatus(record, 'triaged')">
                  分诊
                </a-link>
                <a-link v-if="record.status === 'open' || record.status === 'triaged'" @click="updateStatus(record, 'accepted')">
                  采纳
                </a-link>
                <a-link v-if="record.status !== 'fixed'" @click="updateStatus(record, 'fixed')">
                  已修复
                </a-link>
                <a-link v-if="record.status !== 'rejected'" @click="updateStatus(record, 'rejected')">
                  忽略
                </a-link>
              </a-space>
            </template>
          </a-table-column>
        </template>
        <template #empty>
          <a-empty description="暂无复盘反馈。到 AI中心 → 执行记录，对已完成执行点击「复盘」。" />
        </template>
      </a-table>
    </a-card>
  </div>
</template>

<style scoped>
.feedback-page { padding: 0; }
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
}
.spacer { flex: 1; }
.title { color: var(--color-text-1); font-weight: 600; }
.sub { color: var(--color-text-3); font-size: 12px; }
.suggestion { color: var(--color-text-2); }
</style>
