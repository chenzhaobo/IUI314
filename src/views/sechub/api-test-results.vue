<script setup lang="ts">
/**
 * API测试结果（安全测试 → API测试 → API测试结果）
 *
 * 两个 Tab：
 *   · 按接口：GET /sechub/test-results/apis（接口级汇总 + 各测试类型最新判定），
 *     左树按 project_group / business_area / product_domain / app 过滤；
 *   · 执行记录：原运行列表（GET /sechub/scan/runs）+ 运行结果抽屉。
 * 路由 query 支持 E09 穿透：`api_path` / `http_method` / `env_id` 直接开详情，
 * `tab=runs` 切到执行记录。
 */
import { onMounted } from 'vue'

import ListPage from '@/components/common/ListPage.vue'
import ApiInventoryTree from '@/views/metadata/components/ApiInventoryTree.vue'
import ApiResultDetailDrawer from './components/ApiResultDetailDrawer.vue'
import ApiResultTable from './components/ApiResultTable.vue'
import ApiRunListPanel from './components/ApiRunListPanel.vue'
import { RESULT_VERDICT_OPTIONS, TEST_STATUS_META } from './composables/testResultsRules'
import { useApiTestResults } from './composables/useApiTestResults'

// 组件名必须与路由 name（= sys_menu.path）一致，keep-alive :include 按它对上缓存
// eslint-disable-next-line vue/component-definition-name-casing
defineOptions({ name: 'api-test-results' })

const DIMENSION_OPTIONS = [
  { value: 'app', label: '按应用' },
  { value: 'project_group', label: '按项目组' },
  { value: 'business_area', label: '按业务领域' },
  { value: 'product_domain', label: '按产品领域' },
]

const RUN_STATUS_OPTIONS = [
  { value: 'pending', label: '待执行' },
  { value: 'running', label: '运行中' },
  { value: 'success', label: 'PASS' },
  { value: 'failed', label: 'FAIL' },
  { value: 'partial', label: '部分通过' },
  { value: 'cancelled', label: '已取消' },
]

const {
  activeTab,
  dimension,
  scope,
  filters,
  loading,
  rows,
  summaryCardList,
  typeOptions,
  pagination,
  handleTreeSelect,
  handleSearch,
  handleReset,
  handlePageChange,
  handlePageSizeChange,
  applyStatusCard,
  runSearchForm,
  runQuery,
  applyRunSearch,
  resetRunSearch,
  detailVisible,
  detailTarget,
  openDetail,
  openSeedDetail,
} = useApiTestResults()

onMounted(() => {
  openSeedDetail()
})
</script>

<template>
  <div class="api-test-results">
    <ListPage :aside-width="300" aside-resizable :aside-max-width="520">
      <template #aside-title>
        <div class="aside-title-row">
          <span>归属维度</span>
          <a-select v-model="dimension" size="small" class="dimension-select">
            <a-option v-for="d in DIMENSION_OPTIONS" :key="d.value" :value="d.value">
              {{ d.label }}
            </a-option>
          </a-select>
        </div>
      </template>
      <template #aside>
        <ApiInventoryTree :dimension="dimension" depth="api" source="results" @select="handleTreeSelect" />
      </template>

      <template #filter>
        <div class="filter-bar">
          <a-radio-group v-model="activeTab" type="button" size="small">
            <a-radio value="apis">
              按接口
            </a-radio>
            <a-radio value="runs">
              执行记录
            </a-radio>
          </a-radio-group>

          <template v-if="activeTab === 'apis'">
            <div class="f-sm">
              <a-select v-model="filters.test_status" placeholder="测试状态" allow-clear @change="handleSearch">
                <a-option v-for="(meta, value) in TEST_STATUS_META" :key="value" :value="value">
                  {{ meta.label }}
                </a-option>
              </a-select>
            </div>
            <div class="f-mid">
              <a-select v-model="filters.test_type" placeholder="测试类型" allow-clear @change="handleSearch">
                <a-option v-for="option in typeOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
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
                placeholder="接口路径 / 应用"
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
            <div class="f-wide">
              <a-input
                v-model="runSearchForm.keyword"
                placeholder="运行名称 / 迭代阶段"
                allow-clear
                @press-enter="applyRunSearch"
                @clear="applyRunSearch"
              />
            </div>
            <div class="f-mid">
              <a-select v-model="runSearchForm.status" placeholder="状态" allow-clear @change="applyRunSearch">
                <a-option v-for="option in RUN_STATUS_OPTIONS" :key="option.value" :value="option.value">
                  {{ option.label }}
                </a-option>
              </a-select>
            </div>
            <a-button type="primary" @click="applyRunSearch">
              查询
            </a-button>
            <a-button @click="resetRunSearch">
              重置
            </a-button>
          </template>
        </div>
      </template>

      <template #toolbar>
        <template v-if="activeTab === 'apis'">
          <div class="summary-bar">
            <div
              v-for="card in summaryCardList"
              :key="card.key"
              class="summary-card"
              :class="{ active: filters.test_status === card.filter }"
              @click="applyStatusCard(card.key)"
            >
              <span class="summary-label">{{ card.label }}</span>
              <span class="summary-value" :style="{ color: `rgb(var(--${card.color}-6))` }">{{ card.value }}</span>
            </div>
          </div>
        </template>
        <template v-else>
          <a-tag v-if="scope?.kind === 'api'" color="arcoblue">
            已选 API：{{ scope.code }}（打开运行结果时按此过滤）
          </a-tag>
          <span v-else class="hint">从左侧选择 API 可只看该接口的结果</span>
        </template>
        <div class="toolbar-spacer" />
      </template>

      <template #default="{ tableHeight }">
        <ApiRunListPanel
          v-if="activeTab === 'runs'"
          :query="runQuery"
          :preset-keyword="scope?.kind === 'api' ? scope.code : ''"
          :table-height="tableHeight"
        />
        <ApiResultTable
          v-else
          :rows="rows"
          :loading="loading"
          :pagination="pagination"
          :table-height="tableHeight"
          @detail="openDetail"
          @page-change="handlePageChange"
          @page-size-change="handlePageSizeChange"
        />
      </template>
    </ListPage>

    <ApiResultDetailDrawer v-model:visible="detailVisible" :target="detailTarget" />
  </div>
</template>

<style scoped>
.api-test-results {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.api-test-results > :deep(.list-page) {
  flex: 1 1 auto;
  min-height: 0;
}

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.f-wide { width: 240px; }
.f-mid { width: 150px; }
.f-sm { width: 130px; }

.filter-bar > div :deep(.arco-select),
.filter-bar > div :deep(.arco-input-wrapper) {
  width: 100%;
}

.aside-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.dimension-select { width: 128px; font-weight: 400; }

.summary-bar {
  display: flex;
  gap: 8px;
  align-items: center;
}

.summary-card {
  display: flex;
  flex-direction: column;
  min-width: 88px;
  padding: 4px 10px;
  cursor: pointer;
  background: var(--color-fill-1);
  border: 1px solid transparent;
  border-radius: 4px;
}

.summary-card.active {
  background: var(--color-fill-2);
  border-color: rgb(var(--primary-5));
}

.summary-label { color: var(--color-text-3); font-size: 12px; }
.summary-value { font-weight: 600; font-size: 16px; }

.toolbar-spacer { flex: 1; }

.hint { color: var(--color-text-3); font-size: 12px; }
</style>
