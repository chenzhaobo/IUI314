/**
 * 发版质量「白名单」页状态：列表筛选分页、接口免测新增、撤销。
 *
 * 白名单新增 / 撤销都立即生效（后端会同步把检查项 open ↔ waived），
 * 因此每次成功后重载列表；规则下拉取自配置检查的静态规则表。
 */
import type { ExemptFormInput } from './configCheckRules'
import type { ReleaseWaiver, WaiverListResponse, WaiverQuery } from '@/types/sechub-release'
import { Message } from '@arco-design/web-vue'
import { computed, reactive, ref } from 'vue'

import { toApiParam } from '@/hooks'
import { addWaiver, fetchConfigSummary, fetchWaivers, revokeWaiver } from '../services/configCheckService'
import { API_EXEMPT_RULE, exemptRequestOf, validateExemptForm } from './configCheckRules'

export interface WaiverFilterState {
  ruleCode: string
  /** 只看有效（未撤销未过期），后端默认开启 */
  activeOnly: boolean
  keyword: string
}

export interface WaiverRuleOption {
  value: string
  label: string
}

const EXEMPT_OPTION: WaiverRuleOption = { value: API_EXEMPT_RULE, label: '接口免测（API_EXEMPT）' }

export function useWaivers() {
  const loading = ref(false)
  const submitting = ref(false)
  const revoking = ref(false)
  const data = ref<WaiverListResponse | null>(null)
  const filters = reactive<WaiverFilterState>({ ruleCode: '', activeOnly: true, keyword: '' })
  const pageNum = ref(1)
  const pageSize = ref(20)
  const ruleOptions = ref<WaiverRuleOption[]>([EXEMPT_OPTION])

  const list = computed<ReleaseWaiver[]>(() => data.value?.list ?? [])
  const total = computed(() => data.value?.total ?? 0)
  const pagination = computed(() => ({
    current: pageNum.value,
    pageSize: pageSize.value,
    total: total.value,
    showTotal: true,
    showPageSize: true,
  }))

  function buildQuery(): WaiverQuery {
    const query: WaiverQuery = {
      active_only: filters.activeOnly,
      page_num: pageNum.value,
      page_size: pageSize.value,
    }
    if (filters.ruleCode)
      query.rule_code = filters.ruleCode
    const keyword = filters.keyword.trim()
    if (keyword)
      query.keyword = keyword
    return query
  }

  async function loadWaivers() {
    loading.value = true
    try {
      const result = await fetchWaivers(buildQuery())
      if (result)
        data.value = result
    }
    finally {
      loading.value = false
    }
  }

  /** 规则下拉：静态规则表 + API_EXEMPT；summary 失败时保底只留免测 */
  async function loadRuleOptions() {
    const summary = await fetchConfigSummary({ scope: 'all' })
    if (!summary)
      return
    ruleOptions.value = [
      ...summary.rules.map(def => ({ value: def.code, label: `${def.code} ${def.title}` })),
      EXEMPT_OPTION,
    ]
  }

  async function init() {
    await Promise.all([loadRuleOptions(), loadWaivers()])
  }

  function handleSearch() {
    pageNum.value = 1
    void loadWaivers()
  }

  function handleReset() {
    filters.ruleCode = ''
    filters.activeOnly = true
    filters.keyword = ''
    handleSearch()
  }

  function handlePageChange(page: number) {
    pageNum.value = page
    void loadWaivers()
  }

  function handlePageSizeChange(size: number) {
    pageSize.value = size
    pageNum.value = 1
    void loadWaivers()
  }

  /** 新增接口免测：rule_code = API_EXEMPT、match_type = exact、object_key = PATH|METHOD */
  async function addApiExempt(form: ExemptFormInput): Promise<boolean> {
    const error = validateExemptForm(form)
    if (error) {
      Message.warning(error)
      return false
    }
    submitting.value = true
    try {
      const expiresAt = toApiParam(form.expiresAt) ?? ''
      const result = await addWaiver(exemptRequestOf({ ...form, expiresAt }))
      if (!result)
        return false
      Message.success('接口免测已生效')
      await loadWaivers()
      return true
    }
    finally {
      submitting.value = false
    }
  }

  async function revoke(waiver: ReleaseWaiver, reason: string): Promise<boolean> {
    const trimmed = reason.trim()
    if (!trimmed) {
      Message.warning('撤销原因不能为空')
      return false
    }
    revoking.value = true
    try {
      const result = await revokeWaiver(waiver.id, { reason: trimmed })
      if (!result)
        return false
      Message.success(`已撤销（${result.affected} 项退回待处理）`)
      await loadWaivers()
      return true
    }
    finally {
      revoking.value = false
    }
  }

  return {
    loading,
    submitting,
    revoking,
    filters,
    ruleOptions,
    list,
    total,
    pagination,
    init,
    loadWaivers,
    handleSearch,
    handleReset,
    handlePageChange,
    handlePageSizeChange,
    addApiExempt,
    revoke,
  }
}
