import type { Ref } from 'vue'
import type { AutomationReport, AutomationSourceOption, CaseCompareVo } from './caseTypes'
import type { RoundModel } from './types'
import { Message } from '@arco-design/web-vue'
import { computed, ref, watch } from 'vue'
import { fetchAutomationExecutions, fetchAutomationOptions, fetchCaseComparison, syncSuccessCases } from './service'
import { caseDataReady } from './types'

export function useCaseComparison(round: Ref<RoundModel>, onRefresh: () => void) {
  const sources = ref<AutomationSourceOption[]>([])
  const executions = ref<AutomationReport[]>([])
  const selectedSourceId = ref('')
  const selectedExecuteId = ref('')
  const sourceLoading = ref(false)
  const executionLoading = ref(false)
  const syncing = ref(false)
  const compare = ref<CaseCompareVo | null>(null)
  const compareLoading = ref(false)
  const baselineId = ref('')
  const keyword = ref('')
  const verdict = ref('')
  const pageNum = ref(1)
  const pageSize = ref(20)
  let executionSeq = 0
  let compareSeq = 0

  async function loadSources() {
    sourceLoading.value = true
    try {
      sources.value = await fetchAutomationOptions() ?? []
      if (!selectedSourceId.value)
        selectedSourceId.value = round.value.automation_source_id || sources.value.find(source => source.status === '1')?.id || ''
    }
    finally {
      sourceLoading.value = false
    }
  }

  async function loadExecutions() {
    const source = sources.value.find(item => item.id === selectedSourceId.value)
    if (!selectedSourceId.value || (source && source.status !== '1')) {
      executions.value = []
      return
    }
    const current = ++executionSeq
    executionLoading.value = true
    try {
      const rows = await fetchAutomationExecutions(selectedSourceId.value)
      if (current === executionSeq)
        executions.value = rows ?? []
    }
    finally {
      if (current === executionSeq)
        executionLoading.value = false
    }
  }

  async function startSync(force = false) {
    const source = sources.value.find(item => item.id === selectedSourceId.value)
    if (source?.status !== '1') {
      Message.warning(source?.remark || '自动化源未启用，不能采集')
      return
    }
    if (!selectedSourceId.value || !selectedExecuteId.value) {
      Message.warning('请选择自动化源和主执行批次')
      return
    }
    syncing.value = true
    try {
      const message = await syncSuccessCases(round.value.id, selectedSourceId.value, selectedExecuteId.value, force)
      if (message === null)
        return
      Message.success(message || '已开始采集')
      compare.value = null
      onRefresh()
    }
    finally {
      syncing.value = false
    }
  }

  async function loadCompare() {
    if (!caseDataReady(round.value)) {
      compare.value = null
      return
    }
    const current = ++compareSeq
    compareLoading.value = true
    try {
      const result = await fetchCaseComparison(round.value.id, {
        baseline_round_id: baselineId.value || undefined,
        keyword: keyword.value.trim() || undefined,
        verdict: verdict.value || undefined,
        page_num: pageNum.value,
        page_size: pageSize.value,
      })
      if (current !== compareSeq)
        return
      compare.value = result
      if (!baselineId.value)
        baselineId.value = result?.baseline_round?.round_id || ''
    }
    finally {
      if (current === compareSeq)
        compareLoading.value = false
    }
  }

  watch(selectedSourceId, () => {
    selectedExecuteId.value = ''
    void loadExecutions()
  })

  watch(
    () => [round.value.id, round.value.case_sync_status, round.value.automation_source_id, round.value.automation_execute_id],
    () => {
      selectedSourceId.value = round.value.automation_source_id || selectedSourceId.value
      selectedExecuteId.value = round.value.automation_execute_id || selectedExecuteId.value
      baselineId.value = ''
      pageNum.value = 1
      void loadCompare()
    },
    { immediate: true },
  )

  const pagination = computed(() => ({
    total: compare.value?.total ?? 0,
    current: pageNum.value,
    pageSize: pageSize.value,
    showTotal: true,
    showPageSize: true,
  }))

  function onPageChange(page: number) {
    pageNum.value = page
    void loadCompare()
  }

  function onPageSizeChange(size: number) {
    pageSize.value = size
    pageNum.value = 1
    void loadCompare()
  }

  function search() {
    pageNum.value = 1
    void loadCompare()
  }

  void loadSources()

  return {
    sources,
    executions,
    selectedSourceId,
    selectedExecuteId,
    sourceLoading,
    executionLoading,
    syncing,
    compare,
    compareLoading,
    baselineId,
    keyword,
    verdict,
    pagination,
    loadExecutions,
    startSync,
    loadCompare,
    onPageChange,
    onPageSizeChange,
    search,
  }
}
