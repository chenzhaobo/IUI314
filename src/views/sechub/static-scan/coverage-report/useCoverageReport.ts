/**
 * 「覆盖自证」tab 的状态与取数（View → Composable → Service → Api）。
 *
 * 报告是只读快照：后端在预扫描收口与 AI 确认完成后各刷新一次，本组件只在
 * run 切换时拉一次、不轮询；用户想看最新状态点「刷新」重拉即可。
 */
import type { CoverageReport } from './types'
import { ref } from 'vue'
import { fetchCoverageReport } from './service'

export function useCoverageReport() {
  const loading = ref(false)
  const report = ref<CoverageReport | null>(null)
  /** 该 run 尚无报告（404）：正常的空态，不是错误 */
  const absent = ref(false)
  /** 请求失败（拦截器已弹提示）；与 absent 分开，空态文案不同 */
  const failed = ref(false)
  /** 统一扫描 run 判定未定稿（run_not_finalized）：报告在定稿后才开放，属正常生命周期 */
  const notFinalized = ref(false)
  /** 防竞态：快速切换轮次时，旧 run 的响应不得覆盖新 run 的状态 */
  let seq = 0

  async function load(runId: string) {
    const current = ++seq
    loading.value = true
    try {
      const result = await fetchCoverageReport(runId)
      if (current !== seq)
        return
      if (result.status === 'ok') {
        report.value = result.report
        absent.value = false
        failed.value = false
        notFinalized.value = false
      }
      else {
        report.value = null
        absent.value = result.status === 'absent'
        failed.value = result.status === 'failed'
        notFinalized.value = result.status === 'not_finalized'
      }
    }
    finally {
      if (current === seq)
        loading.value = false
    }
  }

  /** 离开页面 / 组件卸载时调用：作废在途请求并清状态 */
  function reset() {
    seq += 1
    loading.value = false
    report.value = null
    absent.value = false
    failed.value = false
    notFinalized.value = false
  }

  return { loading, report, absent, failed, notFinalized, load, reset }
}
