<script setup lang="ts">
/**
 * API安全测试 → 运行反馈（API-Agent complete 回调提交的运行反馈）。
 *
 * Agent 每次 complete 时提交 problems/improvements/coverage_gaps；
 * 平台按 fingerprint 聚合、累计出现次数。本页用于按“出现次数×严重度”分诊，
 * 把高频问题转成技能/工具/平台/数据前置的改进项。
 */
import { Message } from '@arco-design/web-vue'
import { computed, onMounted, reactive, ref } from 'vue'
import { ApiSecScan, resolveStaticScanApi } from '@/api/sechubApis'
import { getAction, postAction } from '@/hooks'

// eslint-disable-next-line vue/component-definition-name-casing
defineOptions({ name: 'api-agent-feedback' })

const CATEGORY_OPTIONS = [
  { value: 'source_package_missing', label: '源码包缺失' },
  { value: 'api_contract_mismatch', label: '接口契约/方法不一致' },
  { value: 'env_credential', label: '环境/凭据' },
  { value: 'tool', label: '工具能力' },
  { value: 'execution', label: '平台执行' },
  { value: 'prompt_skill', label: '提示词/技能' },
  { value: 'data_prerequisite', label: '数据前置' },
  { value: 'false_positive', label: '误判' },
  { value: 'performance', label: '性能' },
  { value: 'agent_contract', label: 'Agent 契约' },
  { value: 'coverage_gap', label: '覆盖缺口' },
  { value: 'improvement', label: '改进建议' },
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
const CATEGORY_LABELS = Object.fromEntries(CATEGORY_OPTIONS.map(o => [o.value, o.label]))
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

const filters = reactive({ keyword: '', category: '', severity: '', status: '' })
const pageNum = ref(1)
const pageSize = ref(20)
const loading = ref(false)
const rows = ref<any[]>([])
const total = ref(0)

const queryParams = computed(() => ({
  page_num: pageNum.value,
  page_size: pageSize.value,
  keyword: filters.keyword || undefined,
  category: filters.category || undefined,
  severity: filters.severity || undefined,
  status: filters.status || undefined,
}))

async function load() {
  loading.value = true
  try {
    const data = await getAction<any>(ApiSecScan.apiAgentFeedback, queryParams.value)
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
  filters.category = ''
  filters.severity = ''
  filters.status = ''
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
function scopeText(row: any) {
  const s = row.scope_json || {}
  return [s.api_path, s.app_number, s.tool, s.area].filter(Boolean).join(' · ') || '--'
}

async function updateStatus(row: any, status: string) {
  const res = await postAction<string>(
    resolveStaticScanApi(ApiSecScan.apiAgentFeedbackStatus, { id: row.id }),
    { status },
  )
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
      API-Agent 每次 complete 会上报运行反馈；平台按问题指纹聚合、累计出现次数。
      优先处理「出现次数高 × 严重度高」的问题，把它们转成技能/工具/平台/数据前置的改进项。
      反馈是过程问题，不是漏洞结论。
    </a-alert>

    <a-card :bordered="false">
      <div class="filter-bar">
        <a-input v-model="filters.keyword" placeholder="问题/建议/类别" allow-clear style="width: 240px" @press-enter="search" @clear="search" />
        <a-select v-model="filters.category" placeholder="类别" allow-clear style="width: 190px" @change="search">
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
        <a-button type="primary" @click="search">
          查询
        </a-button>
        <a-button @click="reset">
          重置
        </a-button>
        <div class="spacer" />
        <a-tag color="arcoblue">
          共 {{ total }} 类问题
        </a-tag>
      </div>

      <a-table
        :data="rows"
        :loading="loading"
        row-key="id"
        :pagination="{ current: pageNum, pageSize, total, showTotal: true, showPageSize: true }"
        :scroll="{ minWidth: 1400, x: 1400 }"
        @page-change="pageChange"
        @page-size-change="pageSizeChange"
      >
        <template #columns>
          <a-table-column title="严重度" :width="90">
            <template #cell="{ record }">
              <a-tag :color="severityMeta(record.severity).color" size="small">
                {{ severityMeta(record.severity).label }}
              </a-tag>
            </template>
          </a-table-column>
          <a-table-column title="类别" :width="170">
            <template #cell="{ record }">
              {{ categoryLabel(record.category) }}
            </template>
          </a-table-column>
          <a-table-column title="问题 / 建议" :width="460">
            <template #cell="{ record }">
              <div class="detail">
                {{ record.detail }}
              </div>
              <div v-if="record.suggestion" class="suggestion">
                建议：{{ record.suggestion }}
              </div>
              <div v-if="record.evidence" class="evidence">
                证据：{{ record.evidence }}
              </div>
            </template>
          </a-table-column>
          <a-table-column title="作用域" :width="220" ellipsis tooltip>
            <template #cell="{ record }">
              {{ scopeText(record) }}
            </template>
          </a-table-column>
          <a-table-column title="出现" :width="80">
            <template #cell="{ record }">
              <a-tag :color="record.occurrences > 1 ? 'orange' : 'gray'" size="small">
                {{ record.occurrences }} 次
              </a-tag>
            </template>
          </a-table-column>
          <a-table-column title="最近出现" :width="160">
            <template #cell="{ record }">
              {{ record.last_seen_at || '--' }}
            </template>
          </a-table-column>
          <a-table-column title="状态" :width="100">
            <template #cell="{ record }">
              <a-tag :color="statusMeta(record.status).color" size="small">
                {{ statusMeta(record.status).label }}
              </a-tag>
            </template>
          </a-table-column>
          <a-table-column title="操作" :width="240" fixed="right">
            <template #cell="{ record }">
              <a-space>
                <a-link v-if="record.status === 'open'" @click="updateStatus(record, 'triaged')">
                  分诊
                </a-link>
                <a-link v-if="record.status !== 'accepted' && record.status !== 'fixed'" @click="updateStatus(record, 'accepted')">
                  采纳
                </a-link>
                <a-link v-if="record.status !== 'fixed'" @click="updateStatus(record, 'fixed')">
                  已修复
                </a-link>
                <a-link v-if="record.status !== 'rejected'" status="warning" @click="updateStatus(record, 'rejected')">
                  忽略
                </a-link>
              </a-space>
            </template>
          </a-table-column>
        </template>
        <template #empty>
          <a-empty description="暂无 Agent 反馈：下次 Agent 完成时会提交执行问题和改进建议" />
        </template>
      </a-table>
    </a-card>
  </div>
</template>

<style scoped>
.feedback-page { padding: 0; }
.filter-bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 12px; }
.spacer { flex: 1 1 auto; }
.detail { font-size: 13px; line-height: 1.5; word-break: break-all; }
.suggestion { margin-top: 4px; color: var(--color-text-2); font-size: 12px; line-height: 1.5; word-break: break-all; }
.evidence { margin-top: 2px; color: var(--color-text-3); font-size: 12px; line-height: 1.5; word-break: break-all; }
</style>
