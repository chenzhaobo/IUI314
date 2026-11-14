import type { RoundDetail, RoundRow } from './types'
import { computed, onBeforeUnmount, ref } from 'vue'
import { fetchRoundDetail, fetchRounds } from './service'
import { caseDataReady, ROUND_POLL_MS } from './types'

/** 独立用例横比页：轮次选择、详情加载与刷新。 */
export function useCaseWorkspace() {
  const rounds = ref<RoundRow[]>([])
  const selectedRoundId = ref('')
  const detail = ref<RoundDetail | null>(null)
  const listLoading = ref(false)
  const detailLoading = ref(false)
  let seq = 0
  let timer: ReturnType<typeof setTimeout> | undefined

  const roundOptions = computed(() => rounds.value.map(round => ({
    value: round.id,
    label: `${round.round_no} · ${round.name}${round.case_sync_status !== 'running' && round.case_total > 0 ? ` · 已采集${round.case_total}` : ''}`,
  })))

  function stopPolling() {
    if (timer)
      clearTimeout(timer)
    timer = undefined
  }

  function schedulePolling() {
    stopPolling()
    if (detail.value && !detail.value.done)
      timer = setTimeout(() => void loadDetail(true), ROUND_POLL_MS)
  }

  async function loadDetail(silent = false) {
    stopPolling()
    if (!selectedRoundId.value) {
      detail.value = null
      return
    }
    const current = ++seq
    if (!silent)
      detailLoading.value = true
    try {
      const result = await fetchRoundDetail(selectedRoundId.value)
      if (current === seq)
        detail.value = result
    }
    finally {
      if (current === seq) {
        detailLoading.value = false
        schedulePolling()
      }
    }
  }

  async function loadRounds() {
    listLoading.value = true
    try {
      const page = await fetchRounds({ page_num: 1, page_size: 200 })
      rounds.value = page?.list ?? []
      if (!rounds.value.some(round => round.id === selectedRoundId.value))
        selectedRoundId.value = rounds.value.find(round => caseDataReady(round))?.id ?? rounds.value[0]?.id ?? ''
      if (selectedRoundId.value)
        await loadDetail()
    }
    finally {
      listLoading.value = false
    }
  }

  async function reload() {
    await loadRounds()
  }

  onBeforeUnmount(stopPolling)
  void loadRounds()

  return { rounds, selectedRoundId, detail, roundOptions, listLoading, detailLoading, loadRounds, loadDetail, reload }
}
