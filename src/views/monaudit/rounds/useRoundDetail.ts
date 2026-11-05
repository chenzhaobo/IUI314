/**
 * 轮次详情抽屉：批次进度（未结束时每 5 秒刷新）、失败批次重试、结算统计。
 */
import type { Ref } from 'vue'
import type { RoundDetail, SettleStats } from './types'
import { Message } from '@arco-design/web-vue'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { fetchRoundDetail, retryBatch } from './service'
import { parseSettleStats, ROUND_POLL_MS } from './types'

export function useRoundDetail(visible: Ref<boolean>, roundId: Ref<string>, onChanged: () => void) {
  const detail = ref<RoundDetail | null>(null)
  const loading = ref(false)
  const retryingId = ref('')
  let timer: ReturnType<typeof setTimeout> | undefined

  function stopPolling() {
    if (timer)
      clearTimeout(timer)
    timer = undefined
  }

  async function load(silent = false) {
    if (!roundId.value)
      return
    stopPolling()
    if (!silent)
      loading.value = true
    try {
      const res = await fetchRoundDetail(roundId.value)
      const wasRunning = detail.value ? !detail.value.done : false
      detail.value = res
      // 进行中 → 结束：列表上的批次计数 / 轮次状态也变了
      if (res?.done && wasRunning)
        onChanged()
    }
    finally {
      loading.value = false
    }
    if (visible.value && detail.value && !detail.value.done)
      timer = setTimeout(() => void load(true), ROUND_POLL_MS)
  }

  watch([visible, roundId], ([open]) => {
    if (open) {
      detail.value = null
      void load()
    }
    else {
      stopPolling()
    }
  })

  onBeforeUnmount(stopPolling)

  async function retry(batchId: string) {
    retryingId.value = batchId
    try {
      if (await retryBatch(batchId)) {
        Message.success('已重新开始')
        onChanged()
        await load(true)
      }
    }
    finally {
      retryingId.value = ''
    }
  }

  const stats = computed<SettleStats | null>(() => parseSettleStats(detail.value?.round.stats_json))

  return { detail, loading, retryingId, retry, stats, reload: () => load() }
}
