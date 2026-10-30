<script setup lang="ts">
/**
 * 表单测试结果（安全测试 → 表单测试）
 *
 * 两个 Tab：
 *   · 按表单（默认）：GET /sechub/test-results/forms —— 一行一个表单编码，
 *     带各用例类型（含 F4 form_url）的最新判定；
 *   · 结果流水：原先的原始结果列表（GET /sechub/form-test/results）。
 * 路由 query `form_number` 存在时直接打开该表单的详情抽屉。
 */
import type { TableColumnData } from '@arco-design/web-vue'
import { onMounted } from 'vue'

import ListPage from '@/components/common/ListPage.vue'
import { formatTime } from '@/hooks'
import FormResultDetailDrawer from './components/FormResultDetailDrawer.vue'
import FormResultFlowPanel from './components/FormResultFlowPanel.vue'
import {
  CASE_TYPE_OPTIONS,
  caseTypeLabel,
  RESULT_VERDICT_OPTIONS,
  verdictColor,
} from './composables/testResultsRules'
import { useFormTestResults } from './composables/useFormTestResults'

// 组件名必须与路由 name（= sys_menu.path）一致，keep-alive :include 按它对上缓存
// eslint-disable-next-line vue/component-definition-name-casing
defineOptions({ name: 'form-results' })

const {
  activeTab,
  filters,
  loading,
  rows,
  total,
  pagination,
  load,
  handleSearch,
  handleReset,
  handlePageChange,
  handlePageSizeChange,
  flowSearchForm,
  flowQuery,
  applyFlowSearch,
  resetFlowSearch,
  detailVisible,
  detailFormNumber,
  openDetail,
  openSeedDetail,
} = useFormTestResults()

const columns: TableColumnData[] = [
  { title: '表单编码', slotName: 'formNumber', width: 240 },
  { title: '各用例类型判定', slotName: 'byType', minWidth: 320 },
  { title: '用例数', dataIndex: 'case_total', width: 100 },
  { title: '最近测试时间', slotName: 'testedAt', width: 170 },
  { title: '最近失败说明', dataIndex: 'last_fail_detail', minWidth: 220, ellipsis: true, tooltip: true },
  { title: '操作', slotName: 'actions', width: 80, fixed: 'right' },
]

onMounted(() => {
  void load()
  openSeedDetail()
})
</script>

<template>
  <div class="form-results">
    <ListPage>
      <template #filter>
        <div class="filter-bar">
          <a-radio-group v-model="activeTab" type="button" size="small">
            <a-radio value="forms">
              按表单
            </a-radio>
            <a-radio value="flow">
              结果流水
            </a-radio>
          </a-radio-group>

          <template v-if="activeTab === 'forms'">
            <div class="f-mid">
              <a-select v-model="filters.case_type" placeholder="用例类型" allow-clear @change="handleSearch">
                <a-option v-for="t in CASE_TYPE_OPTIONS" :key="t.value" :value="t.value">
                  {{ t.label }}
                </a-option>
              </a-select>
            </div>
            <div class="f-sm">
              <a-select v-model="filters.verdict" placeholder="判定" allow-clear @change="handleSearch">
                <a-option v-for="v in RESULT_VERDICT_OPTIONS" :key="v" :value="v">
                  {{ v }}
                </a-option>
              </a-select>
            </div>
            <div class="f-wide">
              <a-input
                v-model="filters.keyword"
                placeholder="表单编码 / 名称 / 用例标题"
                allow-clear
                @press-enter="handleSearch"
                @clear="handleSearch"
              />
            </div>
            <a-button type="primary" @click="handleSearch">
              查询
            </a-button>
            <a-button @click="handleReset">
              重置
            </a-button>
          </template>

          <template v-else>
            <div class="f-mid">
              <a-input
                v-model="flowSearchForm.form_number"
                placeholder="表单编码"
                allow-clear
                @press-enter="applyFlowSearch"
                @clear="applyFlowSearch"
              />
            </div>
            <div class="f-mid">
              <a-select v-model="flowSearchForm.case_type" placeholder="用例类型" allow-clear @change="applyFlowSearch">
                <a-option v-for="t in CASE_TYPE_OPTIONS" :key="t.value" :value="t.value">
                  {{ t.label }}
                </a-option>
              </a-select>
            </div>
            <div class="f-sm">
              <a-select v-model="flowSearchForm.verdict" placeholder="判定" allow-clear @change="applyFlowSearch">
                <a-option v-for="v in RESULT_VERDICT_OPTIONS" :key="v" :value="v">
                  {{ v }}
                </a-option>
              </a-select>
            </div>
            <div class="f-wide">
              <a-input
                v-model="flowSearchForm.keyword"
                placeholder="表单 / 用例ID / 标题 / 接口路径"
                allow-clear
                @press-enter="applyFlowSearch"
                @clear="applyFlowSearch"
              />
            </div>
            <a-button type="primary" @click="applyFlowSearch">
              查询
            </a-button>
            <a-button @click="resetFlowSearch">
              重置
            </a-button>
          </template>
        </div>
      </template>

      <template #toolbar>
        <span class="form-results-info">
          <template v-if="activeTab === 'forms'">
            共 {{ total.toLocaleString('en-US') }} 个表单（按表单编码汇总用例最新判定）
          </template>
          <template v-else>
            原始结果流水按执行时间倒序，可继续按判定 / 用例类型筛选
          </template>
        </span>
        <div class="toolbar-spacer" />
      </template>

      <template #default="{ tableHeight }">
        <FormResultFlowPanel
          v-if="activeTab === 'flow'"
          :query="flowQuery"
          :table-height="tableHeight"
        />
        <a-table
          v-else
          :data="rows"
          :columns="columns"
          :loading="loading"
          :pagination="pagination"
          :scroll="{ minWidth: 1100, y: tableHeight }"
          row-key="form_number"
          size="small"
          @page-change="handlePageChange"
          @page-size-change="handlePageSizeChange"
        >
          <template #formNumber="{ record }">
            <div class="form-number">
              {{ record.form_number }}
            </div>
            <div v-if="record.form_name" class="form-name">
              {{ record.form_name }}
            </div>
          </template>
          <template #byType="{ record }">
            <a-tag
              v-for="item in record.by_type"
              :key="item.case_type"
              :color="item.verdict ? verdictColor(item.verdict) : 'gray'"
              size="small"
              class="type-tag"
            >
              {{ caseTypeLabel(item.case_type) }}：{{ item.verdict || '未测' }}
            </a-tag>
            <span v-if="!record.by_type.length" class="hint">--</span>
          </template>
          <template #testedAt="{ record }">
            {{ formatTime(record.last_tested_at) }}
          </template>
          <template #actions="{ record }">
            <a-link @click="openDetail(record)">
              详情
            </a-link>
          </template>
          <template #empty>
            <a-empty description="暂无表单测试用例：先在「表单测试用例」里生成并评审通过" />
          </template>
        </a-table>
      </template>
    </ListPage>

    <FormResultDetailDrawer v-model:visible="detailVisible" :form-number="detailFormNumber" />
  </div>
</template>

<style scoped>
.form-results {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.form-results > :deep(.list-page) {
  flex: 1 1 auto;
  min-height: 0;
}

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.f-wide { width: 280px; }
.f-mid { width: 160px; }
.f-sm { width: 110px; }

.filter-bar > div :deep(.arco-select),
.filter-bar > div :deep(.arco-input-wrapper) {
  width: 100%;
}

.form-results-info {
  color: var(--color-text-3);
  font-size: 12px;
}

.toolbar-spacer { flex: 1; }

.form-number { word-break: break-all; }
.form-name { color: var(--color-text-3); font-size: 12px; }
.hint { color: var(--color-text-3); font-size: 12px; }
.type-tag { margin: 2px 4px 2px 0; }
</style>
