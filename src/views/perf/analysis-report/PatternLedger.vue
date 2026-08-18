<template>
  <div class="container">
    <a-card :bordered="false">
      <!-- 搜索栏 -->
      <a-row :gutter="16" style="margin-bottom: 16px">
        <a-col :span="3">
          <a-input v-model="searchForm.keyword" placeholder="标题/编号" allow-clear @press-enter="handleSearch" />
        </a-col>
        <a-col :span="3">
          <a-select v-model="searchForm.product_line" placeholder="产品线" allow-clear>
            <a-option value="星瀚">星瀚</a-option>
            <a-option value="苍穹">苍穹</a-option>
            <a-option value="s-HR">s-HR</a-option>
          </a-select>
        </a-col>
        <a-col :span="3">
          <a-select v-model="searchForm.dimension_type" placeholder="维度类型" allow-clear>
            <a-option value="product_domain">产品领域</a-option>
            <a-option value="business_area">业务领域</a-option>
            <a-option value="project_group">项目组</a-option>
          </a-select>
        </a-col>
        <a-col :span="3">
          <a-input v-model="searchForm.dimension_value" placeholder="维度值" allow-clear @press-enter="handleSearch" />
        </a-col>
        <a-col :span="3">
          <a-input v-model="searchForm.attribution_tag" placeholder="归因标签" allow-clear @press-enter="handleSearch" />
        </a-col>
        <a-col :span="3">
          <a-select v-model="searchForm.status" placeholder="状态" allow-clear>
            <a-option value="new">新发现</a-option>
            <a-option value="issued">已提单</a-option>
            <a-option value="scheduled">已排期</a-option>
            <a-option value="fixing">修复中</a-option>
            <a-option value="fixed">已修复</a-option>
            <a-option value="verified">已验证</a-option>
            <a-option value="recurrent">复发</a-option>
            <a-option value="closed">已关闭</a-option>
            <a-option value="exempted">已豁免</a-option>
          </a-select>
        </a-col>
        <a-col :span="6">
          <a-space>
            <a-button type="primary" @click="handleSearch">查询</a-button>
            <a-button @click="handleReset">重置</a-button>
          </a-space>
        </a-col>
      </a-row>

      <!-- 状态统计 -->
      <a-row v-if="statsData" :gutter="8" style="margin-bottom: 12px">
        <a-col v-for="(val, key) in statsData" :key="key">
          <a-tag :color="statusColor(String(key))">{{ statusText(String(key)) }}: {{ val }}</a-tag>
        </a-col>
      </a-row>

      <!-- 表格 -->
      <a-table :data="tableData" :loading="loading" :pagination="pagination" @page-change="handlePageChange" row-key="id" :scroll="{ x: 1600 }">
        <template #columns>
          <a-table-column title="编号" data-index="pattern_no" :width="100" />
          <a-table-column title="标题" data-index="title" :width="250" ellipsis />
          <a-table-column title="归因标签" data-index="attribution_tag" :width="150">
            <template #cell="{ record }">
              <template v-if="record.attribution_tag">
                <a-tag v-for="(tag, idx) in splitTag(record.attribution_tag)" :key="idx" :color="idx === 0 ? 'arcoblue' : 'cyan'" size="small" style="margin-right: 4px">{{ tag }}</a-tag>
              </template>
              <span v-else>--</span>
            </template>
          </a-table-column>
          <a-table-column title="维度" :width="150">
            <template #cell="{ record }">
              <span>{{ dimensionTypeText(record.dimension_type) }} / {{ record.dimension_value }}</span>
            </template>
          </a-table-column>
          <a-table-column title="产品线" data-index="product_line" :width="80" />
          <a-table-column title="首次出现" data-index="first_found_week" :width="100" />
          <a-table-column title="最近出现" data-index="last_found_week" :width="100" />
          <a-table-column title="周趋势" :width="160">
            <template #cell="{ record }">
              <span v-if="record.weekly_stats" class="weekly-bar">
                <span v-for="(cnt, week) in recentWeeks(record.weekly_stats)" :key="week" :title="`${week}: ${cnt}次`" class="bar-item" :style="{ height: barHeight(cnt as number) + 'px' }" />
              </span>
              <span v-else>--</span>
            </template>
          </a-table-column>
          <a-table-column title="状态" data-index="status" :width="90">
            <template #cell="{ record }">
              <a-tag :color="statusColor(record.status)">{{ statusText(record.status) }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="二开" data-index="is_custom" :width="60">
            <template #cell="{ record }">
              <a-tag v-if="record.is_custom" color="orange" size="small">是</a-tag>
              <span v-else>--</span>
            </template>
          </a-table-column>
          <a-table-column title="豁免" data-index="is_exempted" :width="60">
            <template #cell="{ record }">
              <a-tag v-if="record.is_exempted" color="red" size="small">是</a-tag>
              <span v-else>--</span>
            </template>
          </a-table-column>
          <a-table-column title="操作" :width="100" fixed="right">
            <template #cell="{ record }">
              <a-link @click="handleDetail(record)">详情</a-link>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </a-card>

    <!-- 详情抽屉 -->
    <a-drawer v-model:visible="drawerVisible" :width="700" :title="currentRecord?.title || '模式详情'">
      <a-descriptions :column="2" bordered size="small" style="margin-bottom: 16px">
        <a-descriptions-item label="编号">{{ currentRecord?.pattern_no }}</a-descriptions-item>
        <a-descriptions-item label="状态">
          <a-tag :color="statusColor(currentRecord?.status)">{{ statusText(currentRecord?.status) }}</a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="归因标签" :span="2">
          <template v-if="currentRecord?.attribution_tag">
            <a-tag v-for="(tag, idx) in splitTag(currentRecord.attribution_tag)" :key="idx" :color="idx === 0 ? 'arcoblue' : 'cyan'" size="small" style="margin-right: 4px">{{ tag }}</a-tag>
          </template>
          <span v-else>--</span>
        </a-descriptions-item>
        <a-descriptions-item label="维度">{{ dimensionTypeText(currentRecord?.dimension_type) }} / {{ currentRecord?.dimension_value }}</a-descriptions-item>
        <a-descriptions-item label="产品线">{{ currentRecord?.product_line || '--' }}</a-descriptions-item>
        <a-descriptions-item label="首次出现">{{ currentRecord?.first_found_week || '--' }}</a-descriptions-item>
        <a-descriptions-item label="最近出现">{{ currentRecord?.last_found_week || '--' }}</a-descriptions-item>
        <a-descriptions-item label="是否二开">{{ currentRecord?.is_custom ? '是' : '否' }}</a-descriptions-item>
        <a-descriptions-item label="是否豁免">{{ currentRecord?.is_exempted ? '是' : '否' }}</a-descriptions-item>
        <a-descriptions-item v-if="currentRecord?.exempt_reason" label="豁免原因" :span="2">{{ currentRecord.exempt_reason }}</a-descriptions-item>
        <a-descriptions-item v-if="currentRecord?.issue_id" label="关联问题单" :span="2">
          <a-link @click="gotoIssue(currentRecord.issue_id)">{{ currentRecord.issue_id }}</a-link>
        </a-descriptions-item>
      </a-descriptions>

      <a-divider>AI 摘要</a-divider>
      <div class="content-block">{{ currentRecord?.ai_summary || '暂无' }}</div>

      <a-divider>修复建议 (suggestion)</a-divider>
      <div class="content-block">{{ currentRecord?.suggestion || '暂无' }}</div>

      <a-divider>涉及对象 (involved_object)</a-divider>
      <div class="content-block">{{ currentRecord?.involved_object || '暂无' }}</div>

      <a-divider>证据 (evidence)</a-divider>
      <div v-if="currentRecord?.evidence && typeof currentRecord.evidence === 'object'" class="content-block">
        <template v-for="(val, key) in currentRecord.evidence" :key="key">
          <div style="margin-bottom: 8px">
            <strong>{{ key }}：</strong>
            <pre style="white-space: pre-wrap; margin: 4px 0">{{ typeof val === 'string' ? val : JSON.stringify(val, null, 2) }}</pre>
          </div>
        </template>
      </div>
      <div v-else class="content-block">暂无</div>

      <a-divider>影响客户 (customer_names)</a-divider>
      <div v-if="currentRecord?.customer_names && Array.isArray(currentRecord.customer_names)" class="content-block">
        <a-tag v-for="(name, idx) in currentRecord.customer_names" :key="idx" style="margin: 2px">{{ name }}</a-tag>
      </div>
      <div v-else class="content-block">暂无</div>

      <a-divider>影响表单 (form_keys)</a-divider>
      <div v-if="currentRecord?.form_keys && Array.isArray(currentRecord.form_keys)" class="content-block">
        <a-tag v-for="(fk, idx) in currentRecord.form_keys" :key="idx" size="small" style="margin: 2px">{{ fk }}</a-tag>
      </div>
      <div v-else class="content-block">暂无</div>

      <a-divider>样本 Trace IDs</a-divider>
      <div v-if="currentRecord?.sample_trace_ids" class="content-block">
        <div v-for="tid in traceIdList(currentRecord.sample_trace_ids)" :key="tid" style="margin-bottom: 4px">
          <a-typography-paragraph copyable style="margin: 0">{{ tid }}</a-typography-paragraph>
        </div>
      </div>
      <div v-else class="content-block">暂无</div>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ApiPerfPatternLedger } from '@/api/perfApis'
import { useGet } from '@/hooks'

defineOptions({ name: 'pattern-ledger' })

const router = useRouter()
const pageNum = ref(1)
const pageSize = ref(20)
const searchForm = reactive({
  keyword: '',
  product_line: '',
  dimension_type: '',
  dimension_value: '',
  attribution_tag: '',
  status: '',
})
const drawerVisible = ref(false)
const currentRecord = ref<any>(null)

// ── 映射 ──────────────────────────────────────
const statusMap: Record<string, string> = {
  new: '新发现', issued: '已提单', scheduled: '已排期', fixing: '修复中',
  fixed: '已修复', verified: '已验证', recurrent: '复发', closed: '已关闭', exempted: '已豁免',
}
const statusText = (s: string | undefined) => (s ? statusMap[s] || s : '--')
const statusColor = (s: string | undefined) => ({
  new: 'orange', issued: 'blue', scheduled: 'purple', fixing: 'purple',
  fixed: 'cyan', verified: 'green', recurrent: 'red', closed: 'gray', exempted: 'gray',
}[s || ''] || 'gray')
const dimensionTypeText = (t: string | undefined) => ({ product_domain: '产品领域', business_area: '业务领域', project_group: '项目组' }[t || ''] || t || '--')

// 归因标签拆分（一级-二级）
const splitTag = (tag: string): string[] => tag.includes('-') ? tag.split('-', 2) : [tag]

// 周趋势工具
const recentWeeks = (stats: Record<string, number>): Record<string, number> => {
  const keys = Object.keys(stats).sort()
  const recent = keys.slice(-8)
  const result: Record<string, number> = {}
  recent.forEach(k => { result[k] = stats[k] })
  return result
}
const barHeight = (cnt: number): number => Math.min(Math.max(cnt * 4, 2), 28)

// trace id 拆分
const traceIdList = (raw: string): string[] => raw.split(/[,;\s]+/).filter(Boolean)

// ── 数据请求 ──────────────────────────────────────
const queryParams = computed(() => ({ ...searchForm, page_num: pageNum.value, page_size: pageSize.value }))
const { isFetching: loading, data: rawData, execute: fetchData } = useGet<any>(ApiPerfPatternLedger.list, queryParams, { immediate: true })
const tableData = computed(() => rawData.value?.list || [])
const statsData = computed(() => rawData.value?.stats || null)
const pagination = computed(() => ({ current: pageNum.value, pageSize: pageSize.value, total: rawData.value?.total || 0 }))

// ── 操作 ──────────────────────────────────────
const handleSearch = () => { pageNum.value = 1; fetchData() }
const handleReset = () => {
  Object.assign(searchForm, { keyword: '', product_line: '', dimension_type: '', dimension_value: '', attribution_tag: '', status: '' })
  handleSearch()
}
const handlePageChange = (page: number) => { pageNum.value = page; fetchData() }
const handleDetail = (record: any) => { currentRecord.value = record; drawerVisible.value = true }
const gotoIssue = (issueId: string) => {
  router.push({ path: '/perf/issue', query: { keyword: issueId } })
}
</script>

<style scoped>
.content-block {
  white-space: pre-wrap;
  background: var(--color-fill-1);
  padding: 12px;
  border-radius: 4px;
}
.weekly-bar {
  display: inline-flex;
  align-items: flex-end;
  gap: 2px;
  height: 30px;
}
.bar-item {
  width: 6px;
  background: rgb(var(--arcoblue-5));
  border-radius: 1px;
}
</style>
