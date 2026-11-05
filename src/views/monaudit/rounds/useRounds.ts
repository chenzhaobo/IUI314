/**
 * 自动化轮次列表：分页、新建、同步、结算（失败批次时可确认强制结算）、补抓日志。
 */
import type { LabelValue } from '../shared/types'
import type { RoundCreateForm, RoundListFilter, RoundRow, SettleStats } from './types'
import { Message, Modal } from '@arco-design/web-vue'
import { ref } from 'vue'
import { usePagedQuery } from '@/hooks'
import { fetchIssueOptions } from '../shared/service'
import { createRound, fetchRoundLogs, fetchRounds, settleRound, syncRound } from './service'
import { emptyRoundCreateForm, SETTLE_LABELS } from './types'

function statsText(stats: SettleStats): string {
  return SETTLE_LABELS.map(item => `${item.label} ${stats[item.key] ?? 0}`).join('，')
}

export function useRounds() {
  const dataList = ref<RoundRow[]>([])
  const loading = ref(false)
  const sourceOptions = ref<LabelValue[]>([])
  let seq = 0

  const { query, total, pagination, onPageChange, onPageSizeChange, search }
    = usePagedQuery<RoundListFilter>({ keyword: '', status: '' }, () => void loadList())

  async function loadList() {
    const current = ++seq
    loading.value = true
    try {
      const page = await fetchRounds(query.value)
      if (current !== seq)
        return
      dataList.value = page?.list ?? []
      total.value = page?.total ?? 0
    }
    finally {
      if (current === seq)
        loading.value = false
    }
  }

  async function loadSources() {
    const options = await fetchIssueOptions()
    sourceOptions.value = options?.sources ?? []
  }

  // ── 新建 ──────────────────────────────────────────
  const createVisible = ref(false)
  const createForm = ref<RoundCreateForm>(emptyRoundCreateForm())
  const submitting = ref(false)

  function openCreate() {
    createForm.value = emptyRoundCreateForm()
    createVisible.value = true
  }

  async function submitCreate(): Promise<boolean> {
    submitting.value = true
    try {
      const id = await createRound(createForm.value)
      if (id === null)
        return false
      Message.success('轮次已创建')
      void loadList()
      return true
    }
    finally {
      submitting.value = false
    }
  }

  // ── 同步 ──────────────────────────────────────────
  const syncVisible = ref(false)
  const syncRoundRow = ref<RoundRow | null>(null)
  const syncSources = ref<string[]>([])

  function openSync(row: RoundRow) {
    syncRoundRow.value = row
    syncSources.value = []
    syncVisible.value = true
    if (!sourceOptions.value.length)
      void loadSources()
  }

  async function submitSync(): Promise<boolean> {
    const row = syncRoundRow.value
    if (!row)
      return true
    submitting.value = true
    try {
      const ids = await syncRound(row.id, syncSources.value)
      if (ids === null)
        return false
      Message.success(ids.length ? `已开始同步 ${ids.length} 个批次` : '所选同步源均已在同步中')
      void loadList()
      return true
    }
    finally {
      submitting.value = false
    }
  }

  // ── 结算 ──────────────────────────────────────────
  const actingId = ref('')

  async function doSettle(row: RoundRow, force: boolean) {
    actingId.value = row.id
    try {
      const { data, error } = await settleRound(row.id, force)
      if (data) {
        Message.success(`结算完成：${statsText(data)}`)
        void loadList()
        return
      }
      // 有失败批次：拦截器已弹原因，这里再给一次强制结算的机会
      if (!force && error.includes('失败')) {
        Modal.warning({
          title: '强制结算',
          content: `${error}。确认强制结算？失败数据中心的问题会被判为未复现。`,
          hideCancel: false,
          okText: '强制结算',
          onOk: () => doSettle(row, true),
        })
      }
    }
    finally {
      actingId.value = ''
    }
  }

  function settle(row: RoundRow) {
    void doSettle(row, false)
  }

  async function fetchLogs(row: RoundRow) {
    actingId.value = row.id
    try {
      if (await fetchRoundLogs(row.id))
        Message.success('日志补抓完成')
    }
    finally {
      actingId.value = ''
    }
  }

  return {
    query,
    dataList,
    loading,
    pagination,
    onPageChange,
    onPageSizeChange,
    search,
    loadList,
    sourceOptions,
    createVisible,
    createForm,
    submitting,
    openCreate,
    submitCreate,
    syncVisible,
    syncRoundRow,
    syncSources,
    openSync,
    submitSync,
    actingId,
    settle,
    fetchLogs,
  }
}
