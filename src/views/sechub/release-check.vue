<script setup lang="ts">
/**
 * 发版质量 → 发版检查（菜单 sys_menu.component = 'sechub/release-check'）。
 *
 * 检查计划 + 一键检查；套件信息 / 最近运行 / 最近快照折叠保留。
 * 取数与轮询在 `useReleaseCheck`，本页只做组装、确认框与提示。
 */
import type { ReleaseSuiteRun } from '@/types/sechub-release'
import { Message, Modal } from '@arco-design/web-vue'
import { h } from 'vue'
import { useRouter } from 'vue-router'

import CheckPlanPanel from './components/release/check/CheckPlanPanel.vue'
import CheckRunsTable from './components/release/check/CheckRunsTable.vue'
import CheckSnapshotPanel from './components/release/check/CheckSnapshotPanel.vue'
import CheckSuitePanel from './components/release/check/CheckSuitePanel.vue'
import { confirmLines } from './composables/releaseCheckPlanRules'
import { conclusionMeta } from './composables/releaseDashboardRules'
import { toRunResults } from './composables/secNavigation'
import { useReleaseCheck } from './composables/useReleaseCheck'

// 组件名必须与路由 name（= sys_menu.path）一致，keep-alive :include 按它对上缓存
// eslint-disable-next-line vue/component-definition-name-casing
defineOptions({ name: 'release-check' })

const router = useRouter()
const {
  loading,
  scopeLoading,
  checking,
  generating,
  checkPlan,
  planLoading,
  suite,
  suiteCode,
  runs,
  latestSnapshot,
  reviews,
  reviewStarting,
  isRunning,
  productLine,
  productLineOptions,
  handleProductLineChange,
  refresh,
  triggerCheck,
  triggerReview,
  generateReport,
} = useReleaseCheck()

async function handleTrigger() {
  const result = await triggerCheck()
  if (!result)
    return
  if (result.triggered > 0) {
    const configHint = result.config_check_started ? '，清单配置规则已开始执行' : ''
    Message.success(`已触发 ${result.triggered} 个环境的发版回归${configHint}`)
    return
  }
  const reasons = result.skipped_envs.map(item => item.reason).join('；')
  if (result.skipped > 0)
    Message.warning(`没有触发新的运行：${reasons || '环境已有进行中的运行'}`)
  else
    Message.info('没有可执行的发版回归环境')
}

/** 执行前把「会执行的项目 + 用例数 + 预计耗时」再列一遍 */
function handleExecute() {
  const current = checkPlan.value
  if (!current)
    return
  Modal.confirm({
    title: '确认执行发版检查',
    content: () => h(
      'div',
      { style: 'white-space: pre-line; line-height: 1.8;' },
      confirmLines(current).join('\n'),
    ),
    okText: '执行',
    cancelText: '取消',
    titleAlign: 'start',
    onOk: () => {
      void handleTrigger()
    },
  })
}

async function handleReview(run: ReleaseSuiteRun) {
  const result = await triggerReview(run)
  if (!result)
    return
  if (result.status === 'running' && !result.message) {
    const scope = result.candidates ? `（${result.candidates} 条结果）` : ''
    Message.success(`AI 复核已启动${scope}`)
    return
  }
  Message.info(result.message || '没有待复核的 FAIL / REVIEW 结果')
}

async function handleGenerate() {
  const result = await generateReport()
  if (!result)
    return
  Message.success(`已生成发版报告（结论：${conclusionMeta(result.conclusion).label}）`)
}

/** 「查看结果」直接打开该运行的结果抽屉（执行记录页读 run_id） */
function openScanRuns(run: ReleaseSuiteRun) {
  router.push(toRunResults(run.id))
}
</script>

<template>
  <div class="release-check">
    <a-card :bordered="false">
      <div class="toolbar">
        <div>
          <div class="section-title">
            发版检查
          </div>
          <span class="hint">先确认本次检查计划，再执行一键检查。</span>
        </div>
        <a-space>
          <a-select
            :loading="scopeLoading"
            :model-value="productLine"
            :options="productLineOptions"
            placeholder="产品线"
            style="width: 150px"
            @change="handleProductLineChange"
          />
          <a-button :loading="loading" @click="refresh">
            刷新
          </a-button>
        </a-space>
      </div>
    </a-card>

    <a-card :bordered="false">
      <CheckPlanPanel
        :checking="checking"
        :loading="planLoading"
        :plan="checkPlan"
        :running="isRunning"
        @execute="handleExecute"
      />
    </a-card>

    <a-card :bordered="false">
      <a-collapse :bordered="false" :default-active-key="['suite', 'runs']">
        <a-collapse-item key="suite" header="套件信息">
          <CheckSuitePanel
            :running="isRunning"
            :suite="suite"
            :suite-code="suiteCode"
          />
        </a-collapse-item>
        <a-collapse-item key="runs" header="最近 5 次运行">
          <CheckRunsTable
            :loading="loading"
            :review-starting="reviewStarting"
            :reviews="reviews"
            :runs="runs"
            @review="handleReview"
            @view="openScanRuns"
          />
        </a-collapse-item>
        <a-collapse-item key="snapshot" header="最近快照">
          <CheckSnapshotPanel
            :generating="generating"
            :snapshot="latestSnapshot"
            @generate="handleGenerate"
          />
        </a-collapse-item>
      </a-collapse>
    </a-card>
  </div>
</template>

<style scoped>
.release-check {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.section-title {
  margin-bottom: 4px;
  color: var(--color-text-1);
  font-size: 14px;
  font-weight: 600;
}
.hint {
  color: var(--color-text-3);
  font-size: 12px;
}
</style>
