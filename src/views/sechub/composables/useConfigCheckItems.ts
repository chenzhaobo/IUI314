import type { ConfigItemFilterInput, ConfigSummaryCellKey } from './configCheckRules'
import type { useReleaseScope } from './useReleaseScope'
import type {
  ConfigFieldDef,
  ConfigItem,
  ConfigItemListResponse,
} from '@/types/sechub-release'
import { computed, reactive, ref } from 'vue'

import { fetchConfigFields, fetchConfigItems } from '../services/configCheckService'
import {
  activeSummaryCellOf,
  configFieldsMapOf,
  configItemsQueryOf,
  summaryCellPresetOf,
} from './configCheckRules'

export type ConfigItemFilters = ConfigItemFilterInput

function emptyFilters(): ConfigItemFilters {
  return { ruleCode: '', handling: 'open', severity: '', keyword: '', newOnly: false }
}

/**
 * 配置检查右栏明细：处理状态 / 级别 / 关键词 / 只看新增、左栏规则单选、分页与列头说明。
 *
 * 任一筛选变化都回到第 1 页；汇总条点击通过 `applySummaryPreset` 写入筛选。
 */
export function useConfigCheckItems(scope: ReturnType<typeof useReleaseScope>) {
  const filters = reactive<ConfigItemFilters>(emptyFilters())
  const pageNum = ref(1)
  const pageSize = ref(20)
  const items = ref<ConfigItemListResponse | null>(null)
  const loading = ref(false)
  const fieldDefs = ref<Record<string, ConfigFieldDef>>({})

  const list = computed<ConfigItem[]>(() => items.value?.list ?? [])
  const total = computed(() => items.value?.total ?? 0)
  const pagination = computed(() => ({
    current: pageNum.value,
    pageSize: pageSize.value,
    total: total.value,
    showTotal: true,
    showPageSize: true,
  }))
  const activeSummaryCell = computed(() => activeSummaryCellOf(filters))

  async function load() {
    loading.value = true
    try {
      const result = await fetchConfigItems(
        configItemsQueryOf(filters, scope.toQuery(), pageNum.value, pageSize.value),
      )
      if (result)
        items.value = result
    }
    finally {
      loading.value = false
    }
  }

  /** 列头说明来自后端常量表；失败时表格退回本地列名 */
  async function loadFields() {
    const result = await fetchConfigFields()
    if (result)
      fieldDefs.value = configFieldsMapOf(result.fields)
  }

  function reloadFromFirstPage() {
    pageNum.value = 1
    void load()
  }

  /** 左栏单选：点已选规则或「全部规则」都取消 */
  function selectRule(ruleCode: string) {
    const next = ruleCode.trim()
    filters.ruleCode = next && next !== filters.ruleCode ? next : ''
    reloadFromFirstPage()
  }

  /** 汇总条点击：写入明细筛选；传 null 回到默认「未关闭」 */
  function applySummaryPreset(key: ConfigSummaryCellKey | null) {
    const preset = key ? summaryCellPresetOf(key) : { handling: 'open' as const, newOnly: false }
    filters.handling = preset.handling
    filters.newOnly = preset.newOnly
    reloadFromFirstPage()
  }

  function handleSummarySelect(key: ConfigSummaryCellKey) {
    applySummaryPreset(activeSummaryCell.value === key ? null : key)
  }

  function handleSearch() {
    reloadFromFirstPage()
  }

  function handleReset() {
    Object.assign(filters, emptyFilters())
    reloadFromFirstPage()
  }

  function handlePageChange(page: number) {
    pageNum.value = page
    void load()
  }

  function handlePageSizeChange(size: number) {
    pageSize.value = size
    reloadFromFirstPage()
  }

  function resetPage() {
    pageNum.value = 1
  }

  return {
    filters,
    pageNum,
    pageSize,
    items,
    loading,
    fieldDefs,
    list,
    total,
    pagination,
    activeSummaryCell,
    load,
    loadFields,
    selectRule,
    applySummaryPreset,
    handleSummarySelect,
    handleSearch,
    handleReset,
    handlePageChange,
    handlePageSizeChange,
    resetPage,
  }
}
