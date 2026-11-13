import type { RoundDetail, RoundRow } from './types'
import { computed, ref } from 'vue'
import { fetchRoundDetail, fetchRounds } from './service'

/** 独立用例横比页：轮次选择、详情加载与刷新。 */
export function useCaseWorkspace() {
  const rounds = ref<RoundRow[]>([])
  const selectedRoundId = ref('')
  const detail = ref<RoundDetail | null>(null)
  const listLoading = ref(false)
  const detailLoading = ref(false)
  let seq = 0

  const roundOptions = computed(() => rounds.value.map(round => ({
    value: round.id,
    label: `${round.round_no} · ${round.name}${round.case_sync_status === 'success' ? ` · 已采集${round.case_total}` : ''}`,
  })))

  async function loadDetail() {
    if (!selectedRoundId.value) {
      detail.value = null
      return
    }
    const current = ++seq
    detailLoading.value = true
    try {
      const result = await fetchRoundDetail(selectedRoundId.value)
      if (current === seq)
        detail.value = result
    }
    finally {
      if (current === seq)
        detailLoading.value = false
    }
  }

  async function loadRounds() {
    listLoading.value = true
    try {
      const page = await fetchRounds({ page_num: 1, page_size: 200 })
      rounds.value = page?.list ?? []
      if (!rounds.value.some(round => round.id === selectedRoundId.value))
        selectedRoundId.value = rounds.value.find(round => round.case_sync_status === 'success')?.id ?? rounds.value[0]?.id ?? ''
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

  void loadRounds()

  return { rounds, selectedRoundId, detail, roundOptions, listLoading, detailLoading, loadRounds, loadDetail, reload }
}
