/**
 * 批次观测抽屉的状态与取数（View → Composable → Service → Api）。
 *
 * 打开抽屉时并行取 `task/resource`（排行 + 曲线 + 窗口）与 `task/rerun`（observe_state
 * + 各脚本裁决）。两者互不依赖，任何一个失败都不影响另一个页签。
 */
import type { Ref } from 'vue'
import type { RunRankRow, TaskRerunView, TaskResourceView } from './types'
import { Message } from '@arco-design/web-vue'
import { computed, ref, watch } from 'vue'
import { createEvidenceRun, fetchTaskRerun, fetchTaskResource, resumeTaskRerun } from './service'
import { groupSeries, mainWorkload, observeStateColor, toMs } from './types'

export function useTaskObserve(taskId: Ref<string>, visible: Ref<boolean>) {
  const loading = ref(false)
  const resource = ref<TaskResourceView | null>(null)
  const rerun = ref<TaskRerunView | null>(null)
  const resuming = ref(false)
  /** 防竞态：快速切换批次时，迟到的旧响应不得覆盖当前数据 */
  let seq = 0

  async function load() {
    const id = taskId.value
    const cur = ++seq
    if (!id)
      return
    loading.value = true
    resource.value = null
    rerun.value = null
    try {
      const [res, rer] = await Promise.all([fetchTaskResource(id), fetchTaskRerun(id)])
      if (cur !== seq)
        return
      resource.value = res
      rerun.value = rer
    }
    finally {
      if (cur === seq)
        loading.value = false
    }
  }

  watch([visible, taskId], ([show]) => {
    if (show)
      void load()
  })

  // ── 环境异常横幅 ─────────────────────────────────
  const observeState = computed(() => rerun.value?.observe_state ?? null)
  const stateColor = computed(() => observeStateColor(observeState.value))
  const envSuspectReason = computed(() => rerun.value?.env_suspect_reason ?? '')
  const isEnvSuspect = computed(() => observeState.value === 'env_suspect')

  async function resume() {
    resuming.value = true
    try {
      const res = await resumeTaskRerun(taskId.value)
      if (res === null)
        return
      Message.success(res || '已恢复复跑')
      await load()
    }
    finally {
      resuming.value = false
    }
  }

  // ── 资源视角：排行 ───────────────────────────────
  const keyword = ref('')
  const confidenceFilter = ref('')
  const selectedRunIds = ref<string[]>([])

  const rankRows = computed<RunRankRow[]>(() => {
    const kw = keyword.value.trim().toLowerCase()
    return (resource.value?.runs ?? []).filter((row) => {
      if (kw) {
        const name = (row.script_name ?? row.script_id).toLowerCase()
        if (!name.includes(kw))
          return false
      }
      if (confidenceFilter.value) {
        const w = mainWorkload(row)
        if ((w?.confidence ?? '') !== confidenceFilter.value)
          return false
      }
      return true
    })
  })

  // ── 资源视角：曲线与窗口标区 ─────────────────────
  const seriesGroups = computed(() => groupSeries(resource.value?.series ?? []))

  const scriptNameOf = computed(() => {
    const map: Record<string, string> = {}
    for (const row of resource.value?.runs ?? []) map[row.run_id] = row.script_name ?? row.script_id
    return map
  })

  /** 每个 run 的执行窗口 = 曲线上的一块标区（点击排行行时高亮） */
  const markAreas = computed(() => (resource.value?.windows ?? []).map(w => ({
    name: scriptNameOf.value[w.run_id] ?? w.run_id,
    start_ms: toMs(w.exec_started_at),
    end_ms: toMs(w.exec_finished_at),
  })))

  const activeMarkArea = ref('')

  function highlightRow(row: RunRankRow) {
    const name = row.script_name ?? row.script_id
    activeMarkArea.value = activeMarkArea.value === name ? '' : name
  }

  function onRowClick(record: RunRankRow) {
    highlightRow(record)
  }

  // ── 取证跑（101h，待后端落地核对）───────────────
  const evidenceEvent = ref('wall')
  const evidenceSubmitting = ref(false)

  async function submitEvidence() {
    const ids = selectedRunIds.value
    if (!ids.length) {
      Message.warning('请先勾选脚本')
      return
    }
    evidenceSubmitting.value = true
    try {
      let ok = 0
      let failed = 0
      for (const runId of ids) {
        const res = await createEvidenceRun({ run_id: runId, event: evidenceEvent.value })
        if (res === null)
          failed += 1
        else ok += 1
      }
      if (ok > 0)
        Message.success(`已发起 ${ok} 个取证跑（数值不参与基线比对）`)
      if (failed > 0)
        Message.error(`${failed} 个取证跑发起失败`)
      selectedRunIds.value = []
    }
    finally {
      evidenceSubmitting.value = false
    }
  }

  return {
    loading,
    resource,
    rerun,
    reload: load,
    observeState,
    stateColor,
    envSuspectReason,
    isEnvSuspect,
    resuming,
    resume,
    keyword,
    confidenceFilter,
    selectedRunIds,
    rankRows,
    seriesGroups,
    markAreas,
    activeMarkArea,
    onRowClick,
    evidenceEvent,
    evidenceSubmitting,
    submitEvidence,
  }
}
