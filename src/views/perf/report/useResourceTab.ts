/**
 * 「资源数据」页签的状态与取数（View → Composable → Service → Api）。
 *
 * 数据流：`run/metrics`（一次拿全指标行 + 事务级资源 + 快照摘要）
 * → 若 run 挂了快照再补一次 `snapshot/get`（副本 / 限额明细）。
 * 换 run 时先把旧视图清空，避免短暂看到上一个 run 的资源。
 */
import type { Ref } from 'vue'
import type { EnvSnapshotRow, HwProfileRow, PerfRunMetricRow, RunMetricsView, SnapshotView } from './types'
import { computed, ref, watch } from 'vue'
import { fetchRunMetrics, fetchSnapshot } from './service'
import { metricsStateColor, metricsStateText, targetGroupKey, TXN_RESOURCE_MIN_MS } from './types'

/** 表格行 = 指标行 + 分组首行标记（首行才渲染目标名，视觉上分组） */
export interface MetricTableRow extends PerfRunMetricRow {
  groupStart: boolean
  groupKey: string
}

export function useResourceTab(runId: Ref<string>) {
  const loading = ref(false)
  const view = ref<RunMetricsView | null>(null)
  const snapshotDetail = ref<SnapshotView | null>(null)
  /** 防竞态：快速切换 run 时，迟到的旧响应不得覆盖当前视图 */
  let seq = 0

  async function load() {
    const id = runId.value
    const cur = ++seq
    if (!id) {
      view.value = null
      snapshotDetail.value = null
      return
    }
    loading.value = true
    view.value = null
    snapshotDetail.value = null
    try {
      const data = await fetchRunMetrics(id)
      if (cur !== seq)
        return
      view.value = data
      const snapshotId = data?.env_snapshot_id
      if (snapshotId) {
        const detail = await fetchSnapshot(snapshotId)
        if (cur !== seq)
          return
        snapshotDetail.value = detail
      }
    }
    finally {
      if (cur === seq)
        loading.value = false
    }
  }

  watch(runId, () => {
    void load()
  }, { immediate: true })

  const metricsState = computed(() => view.value?.metrics_state ?? null)
  const stateText = computed(() => metricsStateText(metricsState.value))
  const stateColor = computed(() => metricsStateColor(metricsState.value))

  /** 采集失败原因（后端把原因写进快照 error 或指标行缺失，这里只展示快照 error） */
  const stateReason = computed(() => view.value?.snapshot?.error ?? '')

  const execWindow = computed(() => {
    const started = view.value?.exec_started_at
    const finished = view.value?.exec_finished_at
    if (!started && !finished)
      return null
    return { started: started ?? '', finished: finished ?? '' }
  })

  /** 指标行按目标分组排序：同目标的连续（后端按 id 升序返回，这里重排） */
  const metricRows = computed<MetricTableRow[]>(() => {
    const rows = [...(view.value?.metrics ?? [])]
    rows.sort((a, b) => {
      const ga = targetGroupKey(a)
      const gb = targetGroupKey(b)
      if (ga !== gb)
        return ga < gb ? -1 : 1
      return a.metric_key < b.metric_key ? -1 : (a.metric_key > b.metric_key ? 1 : 0)
    })
    let lastKey = ''
    return rows.map((row) => {
      const key = targetGroupKey(row)
      const groupStart = key !== lastKey
      lastKey = key
      return { ...row, groupStart, groupKey: key }
    })
  })

  /** 事务级资源：只保留耗时 ≥ 4s 的事务（spec R8.2） */
  const txnRows = computed(() => (view.value?.txn_resources ?? []).filter(r => r.txn_elapsed_ms >= TXN_RESOURCE_MIN_MS))

  const snapshotSummary = computed(() => view.value?.snapshot ?? null)
  const snapshotProfile = computed<HwProfileRow | null>(() => snapshotDetail.value?.profile ?? null)
  const snapshotFull = computed<EnvSnapshotRow | null>(() => snapshotDetail.value?.snapshot ?? null)
  const warnings = computed<string[]>(() => snapshotSummary.value?.warnings ?? [])
  const hasView = computed(() => view.value !== null)

  return {
    loading,
    view,
    hasView,
    metricsState,
    stateText,
    stateColor,
    stateReason,
    execWindow,
    metricRows,
    txnRows,
    snapshotSummary,
    snapshotProfile,
    snapshotFull,
    warnings,
    reload: load,
  }
}
