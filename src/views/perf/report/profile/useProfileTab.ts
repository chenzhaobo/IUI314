/**
 * 「性能剖析」页签的状态与取数（View → Composable → Service → Api）。
 *
 * 火焰图台账按 run 拉取；「方法占比」「差分」都是按需的二次查询，只服务当前选中。
 * HTML Blob URL 的释放在本文件统一收口：换图 / 关弹窗 / 组件卸载都必须 revoke，
 * 否则 blob 常驻内存。
 */
import type { Ref } from 'vue'
import type { FlameDiffRow, FlameRow, FlameTopRow } from './types'
import { Message } from '@arco-design/web-vue'
import { computed, onUnmounted, ref, watch } from 'vue'
import { fetchFlameDiff, fetchFlameHtmlBlob, fetchFlameList, fetchFlameTop, startEvidenceRun } from './service'
import { diffDisabledReason, flameEventText, pickDiffPair, sortDiffRows } from './types'

export function useProfileTab(runId: Ref<string>) {
  const loading = ref(false)
  const flames = ref<FlameRow[]>([])
  const selectedIds = ref<string[]>([])
  const evidenceEvent = ref('wall')
  const evidenceSubmitting = ref(false)
  const evidenceRunId = ref('')
  const topLoading = ref(false)
  const topRows = ref<FlameTopRow[]>([])
  const topTitle = ref('')
  const diffLoading = ref(false)
  const diffRows = ref<FlameDiffRow[]>([])
  const diffTitle = ref('')
  const htmlVisible = ref(false)
  const htmlLoading = ref(false)
  const htmlUrl = ref('')
  const htmlTitle = ref('')
  /** 防竞态：快速切 run / 连点查看时，迟到的旧响应不得覆盖当前视图 */
  let seq = 0
  let htmlSeq = 0

  async function load() {
    const id = runId.value
    const cur = ++seq
    if (!id) {
      flames.value = []
      selectedIds.value = []
      return
    }
    loading.value = true
    try {
      const rows = await fetchFlameList(id)
      if (cur !== seq)
        return
      flames.value = rows ?? []
      selectedIds.value = []
      clearTop()
      clearDiff()
    }
    finally {
      if (cur === seq)
        loading.value = false
    }
  }

  watch(runId, () => {
    void load()
  }, { immediate: true })

  // ── 差分选择 ────────────────────────────────────
  const selectedRows = computed(() => flames.value.filter(r => selectedIds.value.includes(r.id)))
  const diffPair = computed(() => pickDiffPair(selectedRows.value))
  /** 空串=可点；否则作为置灰原因展示（collapsed 不可用等） */
  const diffBlockedReason = computed(() => diffDisabledReason(selectedRows.value))

  // ── 取证跑 ──────────────────────────────────────
  async function submitEvidence() {
    const id = runId.value
    if (!id) {
      Message.warning('请先在「报告列表」点击查看明细，再发起取证跑')
      return
    }
    evidenceSubmitting.value = true
    try {
      const newRunId = await startEvidenceRun(id, evidenceEvent.value)
      if (newRunId === null)
        return
      evidenceRunId.value = newRunId
      Message.success('取证跑已开始，数值不参与基线比对')
      await load()
    }
    finally {
      evidenceSubmitting.value = false
    }
  }

  // ── 方法占比 Top 20 ─────────────────────────────
  async function loadTop(row: FlameRow) {
    topLoading.value = true
    try {
      const rows = await fetchFlameTop(row.id)
      if (rows === null)
        return
      topRows.value = rows
      topTitle.value = `${flameEventText(row.event)} · ${row.app_name} / ${row.instance_ip}`
    }
    finally {
      topLoading.value = false
    }
  }

  function clearTop() {
    topRows.value = []
    topTitle.value = ''
  }

  // ── 差分 Top 30 ─────────────────────────────────
  async function runDiff() {
    const pair = diffPair.value
    if (!pair) {
      Message.warning(diffBlockedReason.value || '请先勾选两张火焰图')
      return
    }
    diffLoading.value = true
    try {
      const rows = await fetchFlameDiff(pair.base.id, pair.cur.id)
      if (rows === null)
        return
      diffRows.value = sortDiffRows(rows)
      diffTitle.value = `基准 ${pair.base.app_name}/${pair.base.instance_ip} → 对比 ${pair.cur.app_name}/${pair.cur.instance_ip}`
    }
    finally {
      diffLoading.value = false
    }
  }

  function clearDiff() {
    diffRows.value = []
    diffTitle.value = ''
  }

  // ── 火焰图查看（Blob URL 生命周期）─────────────────
  function revokeHtml() {
    if (htmlUrl.value) {
      URL.revokeObjectURL(htmlUrl.value)
      htmlUrl.value = ''
    }
  }

  async function viewFlame(row: FlameRow) {
    revokeHtml()
    const cur = ++htmlSeq
    htmlVisible.value = true
    htmlLoading.value = true
    htmlTitle.value = `${row.app_name} / ${row.instance_ip} · ${flameEventText(row.event)}`
    try {
      const blob = await fetchFlameHtmlBlob(row.id)
      if (cur === htmlSeq)
        htmlUrl.value = URL.createObjectURL(blob)
    }
    catch (e) {
      if (cur === htmlSeq) {
        Message.error(e instanceof Error ? e.message : '火焰图读取失败')
        htmlVisible.value = false
      }
    }
    finally {
      if (cur === htmlSeq)
        htmlLoading.value = false
    }
  }

  function closeHtml() {
    htmlVisible.value = false
    revokeHtml()
  }

  onUnmounted(() => {
    htmlSeq += 1
    revokeHtml()
  })

  return {
    loading,
    flames,
    selectedIds,
    evidenceEvent,
    evidenceSubmitting,
    evidenceRunId,
    topLoading,
    topRows,
    topTitle,
    diffLoading,
    diffRows,
    diffTitle,
    diffBlockedReason,
    htmlVisible,
    htmlLoading,
    htmlUrl,
    htmlTitle,
    load,
    submitEvidence,
    loadTop,
    clearTop,
    runDiff,
    clearDiff,
    viewFlame,
    closeHtml,
  }
}
