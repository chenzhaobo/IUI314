/**
 * 发版检查「计划」状态：按产品线取只读检查计划，切产品线时丢弃旧计划。
 *
 * 与 `useReleaseCheck` 分工：后者管套件状态 / 运行轮询，本 composable 只负责计划。
 * 产品线切换由页面上的 scopeVersion 驱动刷新；这里用递增序号丢弃过期响应。
 */
import type { Ref } from 'vue'
import type { ReleaseCheckPlanResponse } from '@/types/sechub-release'
import { ref } from 'vue'

import { fetchReleaseCheckPlan } from '../services/releaseDashboardService'
import { buildReleasePlanQuery } from './releaseCheckPlanRules'

export function useReleaseCheckPlan(productLine: Ref<string>) {
  const plan = ref<ReleaseCheckPlanResponse | null>(null)
  const loading = ref(false)
  let sequence = 0

  async function load() {
    const current = ++sequence
    loading.value = true
    try {
      const result = await fetchReleaseCheckPlan(buildReleasePlanQuery(productLine.value))
      if (current === sequence && result)
        plan.value = result
    }
    finally {
      if (current === sequence)
        loading.value = false
    }
  }

  /** 产品线切换：旧产品线的计划不再可信 */
  function clear() {
    sequence += 1
    plan.value = null
    loading.value = false
  }

  return { plan, loading, load, clear }
}
