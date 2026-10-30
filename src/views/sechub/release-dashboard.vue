<script setup lang="ts">
/**
 * 发版质量 → 质量看板（菜单 sys_menu.component = 'sechub/release-dashboard'）。
 *
 * 页面只做组装：范围筛选 + 结论 / KPI / 新增未覆盖 / 项目组矩阵 / 趋势 / 问题分布 /
 * 未覆盖 Top 20 与阻塞原因 / AI 投入。取数在 `useReleaseDashboard`。
 */
import { Modal } from '@arco-design/web-vue'
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

import { formatTime } from '@/hooks'
import AiEfficiencyPanel from './components/release/dashboard/AiEfficiencyPanel.vue'
import ConclusionCard from './components/release/dashboard/ConclusionCard.vue'
import GroupMatrixTable from './components/release/dashboard/GroupMatrixTable.vue'
import IssueDistribution from './components/release/dashboard/IssueDistribution.vue'
import KpiCards from './components/release/dashboard/KpiCards.vue'
import TrendPanel from './components/release/dashboard/TrendPanel.vue'
import UncoveredTopPanel from './components/release/dashboard/UncoveredTopPanel.vue'
import ReleaseScopeBar from './components/release/ReleaseScopeBar.vue'
import { conclusionMeta } from './composables/releaseDashboardRules'
import { useReleaseDashboard } from './composables/useReleaseDashboard'

// 组件名必须与路由 name（= sys_menu.path）一致，keep-alive :include 按它对上缓存
// eslint-disable-next-line vue/component-definition-name-casing
defineOptions({ name: 'release-dashboard' })

const router = useRouter()
const {
  loading,
  trendLoading,
  generating,
  scopeLoading,
  scopeOptions,
  productLine,
  iterationId,
  productDomain,
  businessArea,
  projectGroup,
  effectiveDomains,
  summaryText,
  envUnavailable,
  newUncovered,
  data,
  trend,
  init,
  refresh,
  handleScopeChange,
  selectGroup,
  generateReport,
} = useReleaseDashboard()

/** 跳转其他发版页面时带上当前产品线与迭代 */
const scopeQuery = computed(() => {
  const query: Record<string, string> = {}
  if (productLine.value)
    query.product_line = productLine.value
  if (iterationId.value)
    query.iteration_id = iterationId.value
  return query
})

async function handleGenerate() {
  const result = await generateReport()
  if (!result)
    return
  Modal.success({
    title: '发版报告已生成',
    content: `快照 ${result.id}，结论：${conclusionMeta(result.conclusion).label}。`,
    okText: '去发版报告',
    cancelText: '留在本页',
    onOk: () => {
      void router.push({ path: '/sechub/release/release-reports', query: scopeQuery.value })
    },
  })
}

function goUncovered() {
  void router.push({
    path: '/sechub/release/release-coverage',
    query: { ...scopeQuery.value, tag: 'new', status: 'not_covered' },
  })
}

onMounted(() => {
  void init()
})
</script>

<template>
  <div class="release-dashboard">
    <ReleaseScopeBar
      :business-area="businessArea"
      :effective-domains="effectiveDomains"
      :iteration-id="iterationId"
      :loading="scopeLoading"
      :options="scopeOptions"
      :product-domain="productDomain"
      :product-line="productLine"
      :project-group="projectGroup"
      :summary-text="summaryText"
      @change="handleScopeChange"
    />

    <a-card v-if="envUnavailable" :bordered="false">
      <a-empty description="该产品线暂无测试环境，暂无发版数据" />
    </a-card>

    <template v-else>
      <a-card :bordered="false">
        <div class="toolbar">
          <span class="hint">看板按当前范围实时计算；生成报告会先重算派生检查。</span>
          <a-space>
            <a-button :loading="loading" @click="refresh">
              刷新
            </a-button>
            <a-button type="primary" :loading="generating" @click="handleGenerate">
              生成报告
            </a-button>
          </a-space>
        </div>
      </a-card>

      <a-spin :loading="loading" style="width: 100%">
        <div v-if="data" class="content">
          <ConclusionCard
            :conclusion="data.conclusion"
            :iteration="data.iteration"
            :triggers="data.triggers"
          />
          <KpiCards
            :coverage="data.coverage"
            :execution="data.execution"
            :issues="data.issues"
            :targets="data.targets"
          />

          <a-card :bordered="false">
            <div class="new-uncovered">
              <div>
                <div class="section-title">
                  本迭代新增未覆盖
                </div>
                <div class="new-uncovered-value">
                  {{ newUncovered }}
                </div>
                <div class="hint">
                  新增接口 {{ data.scope.new_total }}，新增已覆盖 {{ data.coverage.new_covered }}，新增免测 {{ data.coverage.new_exempt }}
                </div>
              </div>
              <a-button type="outline" @click="goUncovered">
                去接口覆盖一键测试
              </a-button>
            </div>
          </a-card>

          <a-card :bordered="false">
            <div class="section-title">
              项目组矩阵（点击项目组名按组筛选，右侧「看接口」跳覆盖页）
            </div>
            <GroupMatrixTable
              :iteration-id="iterationId"
              :product-line="productLine"
              :rows="data.groups"
              @select-group="selectGroup"
            />
          </a-card>

          <a-card :bordered="false">
            <div class="section-title">
              趋势（近 6 个迭代）
            </div>
            <TrendPanel :trend="trend" :loading="trendLoading" />
          </a-card>

          <IssueDistribution :issues="data.issues" />

          <UncoveredTopPanel :apis="data.uncovered_top" :block-reasons="data.execution.block_reasons" />

          <AiEfficiencyPanel :ai="data.ai" />
        </div>
        <a-empty v-else description="暂无看板数据" />
      </a-spin>

      <div v-if="data" class="generated">
        看板生成时间：{{ formatTime(data.generated_at) }}
      </div>
    </template>
  </div>
</template>

<style scoped>
.release-dashboard {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.section-title {
  margin-bottom: 8px;
  color: var(--color-text-1);
  font-size: 14px;
  font-weight: 600;
}
.new-uncovered {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.new-uncovered-value {
  color: var(--color-text-1);
  font-size: 28px;
  font-weight: 700;
  line-height: 1.2;
}
.hint {
  margin-top: 4px;
  color: var(--color-text-3);
  font-size: 12px;
}
.generated {
  color: var(--color-text-3);
  font-size: 12px;
  text-align: right;
}
</style>
