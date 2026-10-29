import type { WaiverFormInput } from './configCheckRules'
/**
 * 发版质量「配置检查」页状态：迭代 / 范围 / 页签、汇总与明细取数、
 * 手动检查、缺陷草稿生成、变更记录与加白。
 *
 * 与 D06 的 `useReleaseCoverage` 同构：筛选变化回到第 1 页，
 * 点规则 / 项目组行是「再点一次取消」的切换语义。
 */
import type {
  ConfigEvent,
  ConfigItem,
  ConfigItemListResponse,
  ConfigItemState,
  ConfigRuleDef,
  ConfigRuleFamily,
  ConfigRuleStat,
  ConfigScope,
  ConfigSeverity,
  ConfigSummaryResponse,
  ReleaseIteration,
} from '@/types/sechub-release'
import { Message } from '@arco-design/web-vue'
import { computed, reactive, ref } from 'vue'

import { toApiParam } from '@/hooks'
import {
  addWaiver,
  createConfigDefect,
  fetchConfigEvents,
  fetchConfigItems,
  fetchConfigSummary,
  runConfigCheck,
} from '../services/configCheckService'
import { fetchIterations } from '../services/releaseService'
import {
  configQueryOf,
  configSummaryQueryOf,
  ruleDefMapOf,
  validateWaiverReason,
  waiverRequestOf,
} from './configCheckRules'

export interface ConfigItemFilterState {
  /** 规则编号（点击规则表行设置） */
  ruleCode: string
  /** 项目组编码（点击项目组表行设置） */
  projectGroup: string
  state: ConfigItemState | 'all'
  severity: '' | ConfigSeverity
  keyword: string
  newOnly: boolean
}

function emptyFilters(): ConfigItemFilterState {
  return { ruleCode: '', projectGroup: '', state: 'open', severity: '', keyword: '', newOnly: false }
}

export function useConfigCheck() {
  const iterations = ref<ReleaseIteration[]>([])
  const iterationId = ref('')
  const scope = ref<ConfigScope>('domain')
  const family = ref<ConfigRuleFamily>('meta')
  const summary = ref<ConfigSummaryResponse | null>(null)
  const items = ref<ConfigItemListResponse | null>(null)
  const filters = reactive<ConfigItemFilterState>(emptyFilters())
  const pageNum = ref(1)
  const pageSize = ref(20)
  const summaryLoading = ref(false)
  const itemsLoading = ref(false)
  const running = ref(false)
  const defectLoading = ref(false)
  const defectCreated = ref(false)
  const events = ref<ConfigEvent[]>([])
  const eventsLoading = ref(false)

  const rules = computed<ConfigRuleDef[]>(() => summary.value?.rules ?? [])
  const ruleDefs = computed(() => ruleDefMapOf(rules.value))
  /** 规则表按当前页签过滤（后端 by_rule 是全量） */
  const ruleStats = computed<ConfigRuleStat[]>(() => (summary.value?.by_rule ?? [])
    .filter(row => ruleDefs.value[row.rule_code]?.family === family.value))
  const groupStats = computed(() => summary.value?.by_group ?? [])
  const totals = computed(() => summary.value?.totals ?? null)
  const lastScanAt = computed(() => summary.value?.last_scan?.[family.value] ?? null)
  const productDomains = computed(() => summary.value?.product_domains ?? [])
  const list = computed<ConfigItem[]>(() => items.value?.list ?? [])
  const total = computed(() => items.value?.total ?? 0)
  const pagination = computed(() => ({
    current: pageNum.value,
    pageSize: pageSize.value,
    total: total.value,
    showTotal: true,
    showPageSize: true,
  }))
  /** 同时选中规则与项目组才允许生成缺陷草稿（与后端入参一致） */
  const canCreateDefect = computed(() => Boolean(filters.ruleCode && filters.projectGroup))

  async function loadIterations() {
    const result = await fetchIterations()
    if (!result)
      return
    iterations.value = result.list
    const preferred = result.current_id || result.list[0]?.id || ''
    if (!result.list.some(row => row.id === iterationId.value))
      iterationId.value = preferred
  }

  async function loadSummary() {
    summaryLoading.value = true
    try {
      const result = await fetchConfigSummary(configSummaryQueryOf(iterationId.value, scope.value))
      if (result)
        summary.value = result
    }
    finally {
      summaryLoading.value = false
    }
  }

  async function loadItems() {
    itemsLoading.value = true
    try {
      const result = await fetchConfigItems(configQueryOf({ ...filters, scope: scope.value, iterationId: iterationId.value }, pageNum.value, pageSize.value))
      if (result)
        items.value = result
    }
    finally {
      itemsLoading.value = false
    }
  }

  async function reloadAll() {
    await Promise.all([loadSummary(), loadItems()])
  }

  async function init() {
    await loadIterations()
    await reloadAll()
  }

  function handleIterationChange() {
    pageNum.value = 1
    defectCreated.value = false
    void reloadAll()
  }

  function handleScopeChange() {
    pageNum.value = 1
    defectCreated.value = false
    void reloadAll()
  }

  /** 切页签：别的维度的规则过滤会变成空列表，先清掉再取数 */
  function handleFamilyChange() {
    const def = ruleDefs.value[filters.ruleCode]
    if (def && def.family !== family.value)
      filters.ruleCode = ''
    pageNum.value = 1
    defectCreated.value = false
    void loadItems()
  }

  function selectRule(ruleCode: string) {
    filters.ruleCode = filters.ruleCode === ruleCode ? '' : ruleCode
    pageNum.value = 1
    defectCreated.value = false
    void loadItems()
  }

  /** 未归属项目组的检查项编码为空，后端无法按空值过滤，点击忽略 */
  function selectGroup(projectGroupCode: string) {
    if (!projectGroupCode.trim())
      return
    filters.projectGroup = filters.projectGroup === projectGroupCode ? '' : projectGroupCode
    pageNum.value = 1
    defectCreated.value = false
    void loadItems()
  }

  function handleSearch() {
    pageNum.value = 1
    void loadItems()
  }

  function handleReset() {
    Object.assign(filters, emptyFilters())
    pageNum.value = 1
    defectCreated.value = false
    void loadItems()
  }

  function handlePageChange(page: number) {
    pageNum.value = page
    void loadItems()
  }

  function handlePageSizeChange(size: number) {
    pageSize.value = size
    pageNum.value = 1
    void loadItems()
  }

  /** 按当前页签发 family（meta / api）执行检查，后台跑，稍后刷新 */
  async function runCheck() {
    running.value = true
    try {
      const result = await runConfigCheck(family.value)
      if (result?.accepted)
        Message.success('已开始检查，稍后刷新')
    }
    finally {
      running.value = false
    }
  }

  async function createDefect(): Promise<boolean> {
    if (!canCreateDefect.value || !summary.value)
      return false
    defectLoading.value = true
    try {
      const result = await createConfigDefect({
        env_id: summary.value.env.id,
        project_group_code: filters.projectGroup.trim(),
        rule_code: filters.ruleCode.trim(),
      })
      if (!result)
        return false
      defectCreated.value = true
      Message.success(result.created
        ? `已生成缺陷草稿（${result.item_count} 项）`
        : `已更新缺陷草稿（${result.item_count} 项）`)
      return true
    }
    finally {
      defectLoading.value = false
    }
  }

  /** 白名单：立即生效，返回后刷新汇总与明细（部分检查项会转 waived） */
  async function submitWaiver(item: ConfigItem, form: WaiverFormInput): Promise<boolean> {
    const error = validateWaiverReason(form.reason)
    if (error) {
      Message.warning(error)
      return false
    }
    const expiresAt = toApiParam(form.expiresAt) ?? ''
    const result = await addWaiver(waiverRequestOf(item, { ...form, expiresAt }))
    if (!result)
      return false
    Message.success(`已加白名单（${result.affected} 项转为已加白）`)
    await reloadAll()
    return true
  }

  async function loadEvents(itemId: string) {
    eventsLoading.value = true
    events.value = []
    try {
      const result = await fetchConfigEvents(itemId)
      events.value = result?.list ?? []
    }
    finally {
      eventsLoading.value = false
    }
  }

  return {
    iterations,
    iterationId,
    scope,
    family,
    summaryLoading,
    itemsLoading,
    running,
    defectLoading,
    defectCreated,
    events,
    eventsLoading,
    filters,
    summary,
    rules,
    ruleDefs,
    ruleStats,
    groupStats,
    totals,
    lastScanAt,
    productDomains,
    list,
    total,
    pagination,
    canCreateDefect,
    init,
    loadSummary,
    loadItems,
    handleIterationChange,
    handleScopeChange,
    handleFamilyChange,
    selectRule,
    selectGroup,
    handleSearch,
    handleReset,
    handlePageChange,
    handlePageSizeChange,
    runCheck,
    createDefect,
    submitWaiver,
    loadEvents,
  }
}
