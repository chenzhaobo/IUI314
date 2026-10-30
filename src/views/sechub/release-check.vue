<script setup lang="ts">
/**
 * 发版质量 → 发版检查（菜单 sys_menu.component = 'sechub/release-check'）。
 *
 * 套件信息 + 最近 5 次运行 + 一键检查 + 回归后 AI 复核 + 最近快照。
 * 取数与轮询在 `useReleaseCheck`，本页只做组装与提示。
 */
import type { ReleaseSuiteRun } from '@/types/sechub-release'
import { Message } from '@arco-design/web-vue'
import { useRouter } from 'vue-router'

import CheckRunsTable from './components/release/check/CheckRunsTable.vue'
import CheckSnapshotPanel from './components/release/check/CheckSnapshotPanel.vue'
import CheckSuitePanel from './components/release/check/CheckSuitePanel.vue'
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
            发版回归套件
          </div>
          <span class="hint">一键检查 = 触发回归套件 + 后台执行清单配置规则。</span>
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
          <a-button
            :disabled="isRunning"
            :loading="checking"
            type="primary"
            @click="handleTrigger"
          >
            {{ isRunning ? '检查执行中…' : '立即执行发版检查' }}
          </a-button>
        </a-space>
      </div>
      <CheckSuitePanel
        :running="isRunning"
        :suite="suite"
        :suite-code="suiteCode"
      />
    </a-card>

    <a-card :bordered="false">
      <div class="section-title">
        最近 5 次运行
      </div>
      <CheckRunsTable
        :loading="loading"
        :review-starting="reviewStarting"
        :reviews="reviews"
        :runs="runs"
        @review="handleReview"
        @view="openScanRuns"
      />
    </a-card>

    <a-card :bordered="false">
      <div class="section-title">
        最近快照
      </div>
      <CheckSnapshotPanel
        :generating="generating"
        :snapshot="latestSnapshot"
        @generate="handleGenerate"
      />
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
  margin-bottom: 12px;
}
.section-title {
  margin-bottom: 8px;
  color: var(--color-text-1);
  font-size: 14px;
  font-weight: 600;
}
.toolbar .section-title {
  margin-bottom: 4px;
}
.hint {
  color: var(--color-text-3);
  font-size: 12px;
}
</style>
