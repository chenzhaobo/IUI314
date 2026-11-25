<script setup lang="ts">
import type { CustomApiScanItem } from '@/types/sechub-test-results'
import { MdPreview } from 'md-editor-v3'
import { computed, ref } from 'vue'
import { formatTime } from '@/hooks'
import { buildCustomApiReportIndex, reportSectionsForItem } from '../composables/customApiScanReport'
import { useCustomApiScanResults } from '../composables/useCustomApiScanResults'

const props = defineProps<{ tableHeight?: number }>()

const VERDICT_LABELS: Record<string, { text: string, color: string }> = {
  not_found: { text: '未找到API', color: 'gray' },
  excluded: { text: '已排除', color: 'green' },
  confirmed: { text: '确认问题', color: 'red' },
}
const SEVERITY_LABELS: Record<string, { text: string, color: string }> = {
  high: { text: '高', color: 'red' },
  medium: { text: '中', color: 'orangered' },
  low: { text: '低', color: 'gold' },
  none: { text: '无', color: 'gray' },
}
const ROLE_LABELS: Record<string, string> = {
  api_plugin: 'API 插件',
  controller: '自定义API类',
  op_plugin: '操作插件',
  service_impl: '服务实现',
}

const {
  tasks,
  selectedTaskId,
  selectedTask,
  detail,
  tasksLoading,
  loading,
  keyword,
  verdict,
  filteredItems,
  confirmedCount,
  pagination,
  selectTask,
  handlePageChange,
  handlePageSizeChange,
  resetFilters,
} = useCustomApiScanResults()

const detailVisible = ref(false)
const detailTab = ref('findings')
const selectedItem = ref<CustomApiScanItem | null>(null)
const tableScrollY = computed(() => Math.max((props.tableHeight ?? 420) - 142, 220))
const reportIndex = computed(() => buildCustomApiReportIndex(detail.value?.task.report_md))
const selectedReport = computed(() => selectedItem.value ? reportSectionsForItem(reportIndex.value, selectedItem.value) : null)

function openDetail(item: CustomApiScanItem) {
  selectedItem.value = item
  detailTab.value = 'findings'
  detailVisible.value = true
}

function roleText(role: string): string {
  return ROLE_LABELS[role] || role
}
</script>

<template>
  <div class="custom-scan-results">
    <div class="scan-filter">
      <a-select
        v-model="selectedTaskId"
        :loading="tasksLoading"
        class="task-select"
        placeholder="选择自定义扫描任务"
        show-search
        @change="selectTask(selectedTaskId)"
      >
        <a-option
          v-for="task in tasks"
          :key="task.id"
          :value="task.id"
          :label="`${task.name}（${task.api_count} 个API）`"
        >
          {{ task.name }}（{{ task.api_count }} 个API）
        </a-option>
      </a-select>
      <a-select v-model="verdict" class="verdict-select" placeholder="扫描结论" allow-clear>
        <a-option v-for="(meta, value) in VERDICT_LABELS" :key="value" :value="value">
          {{ meta.text }}
        </a-option>
      </a-select>
      <a-input v-model="keyword" class="keyword-input" placeholder="接口路径 / 名称 / 应用" allow-clear />
      <a-button @click="resetFilters">
        重置
      </a-button>
    </div>

    <div v-if="selectedTask" class="task-summary">
      <span>{{ selectedTask.name }}</span>
      <a-tag size="small" color="red">
        确认问题 {{ confirmedCount }}
      </a-tag>
      <span class="muted">完成于 {{ formatTime(selectedTask.finished_at) || '--' }}</span>
    </div>

    <a-spin :loading="loading || tasksLoading" style="display: block">
      <a-table
        :data="filteredItems"
        :loading="loading"
        :pagination="pagination"
        :scroll="{ minWidth: 1180, y: tableScrollY }"
        row-key="id"
        size="small"
        @page-change="handlePageChange"
        @page-size-change="handlePageSizeChange"
      >
        <template #columns>
          <a-table-column title="接口" :width="320">
            <template #cell="{ record }">
              <div class="mono">
                <a-tag v-if="record.http_method" size="small" color="arcoblue">
                  {{ record.http_method }}
                </a-tag>
                {{ record.call_path }}
              </div>
              <div class="muted">
                {{ record.api_name || record.api_number || '--' }}
              </div>
            </template>
          </a-table-column>
          <a-table-column title="应用" :width="160">
            <template #cell="{ record }">
              {{ record.app_name || record.app_number || '未归属应用' }}
            </template>
          </a-table-column>
          <a-table-column title="结论" :width="100">
            <template #cell="{ record }">
              <a-tag v-if="record.verdict" :color="VERDICT_LABELS[record.verdict]?.color || 'gray'" size="small">
                {{ VERDICT_LABELS[record.verdict]?.text || record.verdict }}
              </a-tag>
              <a-tag v-else color="orangered" size="small">
                未判定
              </a-tag>
            </template>
          </a-table-column>
          <a-table-column title="风险" :width="70">
            <template #cell="{ record }">
              <a-tag v-if="record.severity" :color="SEVERITY_LABELS[record.severity]?.color || 'gray'" size="small">
                {{ SEVERITY_LABELS[record.severity]?.text || record.severity }}
              </a-tag>
              <span v-else class="muted">--</span>
            </template>
          </a-table-column>
          <a-table-column title="问题说明" :min-width="280" ellipsis tooltip>
            <template #cell="{ record }">
              {{ record.ai_summary || record.locate_note || '--' }}
            </template>
          </a-table-column>
          <a-table-column title="操作" :width="70" fixed="right">
            <template #cell="{ record }">
              <a-link @click="openDetail(record)">
                详情
              </a-link>
            </template>
          </a-table-column>
        </template>
        <template #empty>
          <a-empty description="该任务没有符合筛选条件的接口扫描结果" />
        </template>
      </a-table>
    </a-spin>
  </div>

  <a-drawer v-model:visible="detailVisible" :width="960" :footer="false" title="自定义 API 扫描详情" unmount-on-close>
    <template v-if="selectedItem">
      <a-descriptions :column="2" bordered size="small">
        <a-descriptions-item label="接口" :span="2">
          <a-tag v-if="selectedItem.http_method" size="small" color="arcoblue">
            {{ selectedItem.http_method }}
          </a-tag>
          <span class="mono">{{ selectedItem.call_path }}</span>
        </a-descriptions-item>
        <a-descriptions-item label="应用" :span="2">
          {{ selectedItem.app_name || selectedItem.app_number || '未归属应用' }}
        </a-descriptions-item>
        <a-descriptions-item label="扫描结论">
          <a-tag v-if="selectedItem.verdict" :color="VERDICT_LABELS[selectedItem.verdict]?.color || 'gray'">
            {{ VERDICT_LABELS[selectedItem.verdict]?.text || selectedItem.verdict }}
          </a-tag>
          <span v-else>未判定</span>
        </a-descriptions-item>
        <a-descriptions-item label="风险级别">
          {{ SEVERITY_LABELS[selectedItem.severity || '']?.text || selectedItem.severity || '--' }}
        </a-descriptions-item>
      </a-descriptions>

      <div class="section-title">
        扫描问题说明
      </div>
      <div class="summary-text">
        {{ selectedItem.ai_summary || selectedItem.locate_note || '暂无说明' }}
      </div>

      <a-tabs v-model:active-key="detailTab" class="detail-tabs">
        <a-tab-pane key="findings" title="发现的问题与证据">
          <MdPreview
            v-if="selectedReport?.findings"
            :editor-id="`custom-findings-${selectedItem.id}`"
            :model-value="selectedReport.findings"
          />
          <a-empty v-else description="原报告中没有该接口的问题与证据小节" />
        </a-tab-pane>
        <a-tab-pane key="callChain" title="调用链">
          <MdPreview
            v-if="selectedReport?.callChain"
            :editor-id="`custom-call-chain-${selectedItem.id}`"
            :model-value="selectedReport.callChain"
          />
          <a-empty v-else description="原报告中没有该接口的调用链小节" />
        </a-tab-pane>
        <a-tab-pane key="fixSuggestions" title="修复建议">
          <MdPreview
            v-if="selectedReport?.fixSuggestions"
            :editor-id="`custom-fix-${selectedItem.id}`"
            :model-value="selectedReport.fixSuggestions"
          />
          <a-empty v-else description="原报告中没有该接口的修复建议小节" />
        </a-tab-pane>
        <a-tab-pane key="locations" :title="`代码定位（${selectedItem.impl_json?.length || 0}）`">
          <a-table :data="selectedItem.impl_json || []" :pagination="false" size="small">
            <template #columns>
              <a-table-column title="角色" :width="120">
                <template #cell="{ record }">
                  {{ roleText(record.role) }}
                </template>
              </a-table-column>
              <a-table-column title="类 / 方法" :min-width="240">
                <template #cell="{ record }">
                  <div class="mono">
                    {{ record.class_name }}
                  </div>
                  <div class="muted">
                    {{ record.method || record.operation || '--' }}
                  </div>
                </template>
              </a-table-column>
              <a-table-column title="文件" data-index="file" :min-width="260" ellipsis tooltip />
            </template>
            <template #empty>
              <a-empty description="没有定位到实现代码" />
            </template>
          </a-table>
        </a-tab-pane>
      </a-tabs>
    </template>
  </a-drawer>
</template>

<style scoped>
.custom-scan-results {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  min-height: 0;
}

.scan-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.task-select { width: min(440px, 100%); }
.verdict-select { width: 140px; }
.keyword-input { width: 260px; }

.task-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.mono { word-break: break-all; }
.muted { color: var(--color-text-3); font-size: 12px; }
.section-title { margin: 16px 0 8px; font-weight: 600; }
.summary-text { white-space: pre-wrap; word-break: break-word; line-height: 1.7; }
.detail-tabs { margin-top: 16px; }
</style>
