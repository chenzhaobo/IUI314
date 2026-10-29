/**
 * 发版检查页状态：套件与最近 5 次运行、一键触发、回归后 AI 复核（D20b）轮询。
 *
 * 复核状态按 run_id 缓存；running 时每 10 秒拉一次，套件运行中时状态页也定时刷新，
 * 离开页面（unmount / keep-alive deactivate）全部停表，避免后台空转。
 */
import type {
  ReleaseCheckRunResult,
  ReleaseCheckStatusResponse,
  ReleaseRunReview,
  ReleaseRunReviewStartResult,
  ReleaseSnapshotGenerateResult,
  ReleaseSuiteRun,
} from '@/types/sechub-release'
import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref } from 'vue'

import {
  fetchReleaseCheckStatus,
  fetchRunReview,
  generateReleaseSnapshot,
  runReleaseCheck,
  startRunReview,
} from '../services/releaseDashboardService'

/** 发版检查按产品线隔离；页面暂不提供切换，默认星瀚（与后端缺省一致） */
const PRODUCT_LINE = '星瀚'
const POLL_INTERVAL_MS = 10_000

const RUNNING_STATUSES = new Set(['pending', 'running'])

export function useReleaseCheck() {
  const loading = ref(false)
  const checking = ref(false)
  const generating = ref(false)
  const data = ref<ReleaseCheckStatusResponse | null>(null)
  /** run_id → 复核状态；null 表示从未复核 */
  const reviews = ref<Record<string, ReleaseRunReview | null>>({})
  /** 正在触发复核的 run_id（按钮 loading） */
  const reviewStarting = ref('')
  const timers = new Map<string, ReturnType<typeof setInterval>>()

  const suite = computed(() => data.value?.suite ?? null)
  const suiteCode = computed(() => suite.value?.suite_code ?? data.value?.suite_code ?? '')
  const runs = computed<ReleaseSuiteRun[]>(() => data.value?.latest_runs ?? [])
  const latestSnapshot = computed(() => data.value?.latest_snapshot ?? null)
  /** 任一运行未结束：禁用「立即执行发版检查」 */
  const isRunning = computed(() => runs.value.some(run => RUNNING_STATUSES.has(run.status)))

  function stopTimer(key: string) {
    const timer = timers.get(key)
    if (timer !== undefined) {
      clearInterval(timer)
      timers.delete(key)
    }
  }

  function stopAllTimers() {
    for (const key of [...timers.keys()])
      stopTimer(key)
  }

  /** 复核 running 时挂轮询；其他状态停表 */
  function ensureReviewPolling(runId: string) {
    if (timers.has(`review:${runId}`))
      return
    const timer = setInterval(() => {
      void loadReview(runId)
    }, POLL_INTERVAL_MS)
    timers.set(`review:${runId}`, timer)
  }

  async function loadReview(runId: string): Promise<ReleaseRunReview | null> {
    const review = await fetchRunReview(runId)
    reviews.value = { ...reviews.value, [runId]: review }
    if (review?.status === 'running')
      ensureReviewPolling(runId)
    else
      stopTimer(`review:${runId}`)
    return review
  }

  async function loadStatus() {
    loading.value = true
    try {
      const result = await fetchReleaseCheckStatus({ product_line: PRODUCT_LINE })
      if (result)
        data.value = result
    }
    finally {
      loading.value = false
    }
  }

  /** 套件运行中时定时刷新状态页，结束后自动停表 */
  function syncStatusPolling() {
    if (!isRunning.value) {
      stopTimer('status')
      return
    }
    if (timers.has('status'))
      return
    const timer = setInterval(() => {
      void refresh()
    }, POLL_INTERVAL_MS)
    timers.set('status', timer)
  }

  async function refresh() {
    await loadStatus()
    syncStatusPolling()
    for (const run of runs.value) {
      if (!(run.id in reviews.value))
        void loadReview(run.id)
    }
  }

  /** keep-alive 切回页面时恢复复核轮询（停表期间落下的 running 状态重新挂上） */
  function resumeReviewPolling() {
    for (const run of runs.value) {
      if (reviews.value[run.id]?.status === 'running')
        ensureReviewPolling(run.id)
    }
  }

  async function triggerCheck(): Promise<ReleaseCheckRunResult | null> {
    if (checking.value || isRunning.value)
      return null
    checking.value = true
    try {
      const result = await runReleaseCheck({ product_line: PRODUCT_LINE })
      if (result)
        await refresh()
      return result
    }
    finally {
      checking.value = false
    }
  }

  async function triggerReview(run: ReleaseSuiteRun): Promise<ReleaseRunReviewStartResult | null> {
    if (reviewStarting.value)
      return null
    reviewStarting.value = run.id
    try {
      const result = await startRunReview(run.id)
      if (result?.status === 'running') {
        reviews.value = { ...reviews.value, [run.id]: { status: 'running' } }
        ensureReviewPolling(run.id)
      }
      else {
        await loadReview(run.id)
      }
      return result
    }
    finally {
      reviewStarting.value = ''
    }
  }

  async function generateReport(): Promise<ReleaseSnapshotGenerateResult | null> {
    if (generating.value)
      return null
    generating.value = true
    try {
      const result = await generateReleaseSnapshot({})
      if (result)
        await loadStatus()
      return result
    }
    finally {
      generating.value = false
    }
  }

  /** 首次取数完成前不响应 onActivated，避免 keep-alive 首次挂载时重复请求 */
  let initialized = false

  onMounted(() => {
    void refresh().then(() => {
      initialized = true
      resumeReviewPolling()
    })
  })
  onActivated(() => {
    if (initialized)
      void refresh().then(resumeReviewPolling)
  })
  onDeactivated(stopAllTimers)
  onBeforeUnmount(stopAllTimers)

  return {
    loading,
    checking,
    generating,
    data,
    suite,
    suiteCode,
    runs,
    latestSnapshot,
    reviews,
    reviewStarting,
    isRunning,
    productLine: PRODUCT_LINE,
    refresh,
    triggerCheck,
    triggerReview,
    generateReport,
  }
}
