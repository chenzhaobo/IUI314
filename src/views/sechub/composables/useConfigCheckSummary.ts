import type { ConfigGroupDistRow, ConfigRuleRow } from './configCheckRules'
import type { useReleaseScope } from './useReleaseScope'
import type { ConfigSummaryResponse } from '@/types/sechub-release'
import { computed, ref } from 'vue'

import { fetchConfigSummary } from '../services/configCheckService'
import {
  configSummaryQueryOf,
  groupDistributionOf,
  latestScanAt,
  ruleRowsOf,
} from './configCheckRules'

function ruleRowMapOf(rows: ConfigRuleRow[]): Record<string, ConfigRuleRow> {
  const map: Record<string, ConfigRuleRow> = {}
  for (const row of rows)
    map[row.code] = row
  return map
}

/**
 * 配置检查汇总条 / 规则选项 / 项目组分布取数。
 *
 * 全部统计只跟范围（产品线 / 迭代 / 领域 / 业务领域 / 项目组 / 应用 / 处理人 / 只看我的）有关，
 * 不叠加明细的处理状态 / 级别 / 关键词筛选。
 */
export function useConfigCheckSummary(scope: ReturnType<typeof useReleaseScope>) {
  const summary = ref<ConfigSummaryResponse | null>(null)
  const loading = ref(false)

  const totals = computed(() => summary.value?.totals ?? null)
  const ruleRows = computed(() => ruleRowsOf(summary.value?.rules ?? [], summary.value?.by_rule ?? []))
  const ruleRowByCode = computed(() => ruleRowMapOf(ruleRows.value))
  const groupDistribution = computed<ConfigGroupDistRow[]>(() => groupDistributionOf(summary.value?.by_group ?? []))
  const lastScanAt = computed(() => latestScanAt(summary.value?.last_scan ?? null))

  async function load() {
    loading.value = true
    try {
      const query = configSummaryQueryOf(scope.toQuery())
      const result = await fetchConfigSummary(query)
      if (!result)
        return
      summary.value = result
      // 全部领域口径下后端仍回传配置的默认领域，回显出来会误导成「只看默认领域」
      scope.syncEffectiveDomains(query.scope === 'all' ? [] : result.product_domains)
    }
    finally {
      loading.value = false
    }
  }

  return {
    summary,
    loading,
    totals,
    ruleRows,
    ruleRowByCode,
    groupDistribution,
    lastScanAt,
    load,
  }
}
