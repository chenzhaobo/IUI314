/**
 * 问题详情弹窗：加载详情、编辑处理信息（version 乐观锁）、状态流转、日志查看与重新抓取。
 */
import type { Ref } from 'vue'
import type { LabelValue } from '../shared/types'
import type { HandleForm, IssueDetail, TraceLogLine, TraceLogRow, TransitionMeta } from './types'
import { Message } from '@arco-design/web-vue'
import { computed, ref, watch } from 'vue'
import { ApiMonauditIssue } from '@/api/monauditApis'
import { useDownload } from '@/hooks'
import { fetchHandlerCandidates, showBatchResult } from '../shared/service'
import { assignIssues, editIssue, fetchIssueDetail, fetchTraceLog, refetchIssueLog } from './service'
import { emptyHandleForm, handleFormOf, TRANSITIONS } from './types'
import { useIssueTransition } from './useIssueTransition'

/** 后端乐观锁冲突的提示片段 */
const CONFLICT_HINT = '已被他人修改'

export function useIssueDetail(visible: Ref<boolean>, issueId: Ref<string>, onChanged: () => void) {
  const detail = ref<IssueDetail | null>(null)
  const loading = ref(false)
  const form = ref<HandleForm>(emptyHandleForm())
  const saving = ref(false)
  const refetching = ref(false)
  const handlerId = ref('')
  const handlerOptions = ref<LabelValue[]>([])
  const handlerLoading = ref(false)
  const assigning = ref(false)

  async function loadHandlerOptions(groupId: string | null | undefined) {
    handlerOptions.value = []
    if (!groupId)
      return
    handlerLoading.value = true
    try {
      handlerOptions.value = await fetchHandlerCandidates(groupId)
    }
    finally {
      handlerLoading.value = false
    }
  }

  async function load() {
    if (!issueId.value)
      return
    loading.value = true
    try {
      const res = await fetchIssueDetail(issueId.value)
      detail.value = res
      form.value = res ? handleFormOf(res.issue) : emptyHandleForm()
      handlerId.value = res?.issue.handler_id ?? ''
      await loadHandlerOptions(res?.issue.project_group_id)
      const currentHandler = res?.issue.handler_name
      if (handlerId.value && currentHandler && !handlerOptions.value.some(option => option.value === handlerId.value))
        handlerOptions.value.unshift({ value: handlerId.value, label: currentHandler })
    }
    finally {
      loading.value = false
    }
  }

  async function saveHandler() {
    const current = detail.value
    if (!current)
      return
    assigning.value = true
    try {
      const result = await assignIssues([current.issue.id], handlerId.value)
      if (!result)
        return
      showBatchResult(result)
      if (result.done === 0)
        return
      await load()
      onChanged()
    }
    finally {
      assigning.value = false
    }
  }

  watch([visible, issueId], ([open]) => {
    if (open)
      void load()
  })

  async function save() {
    const current = detail.value
    if (!current)
      return
    saving.value = true
    try {
      const { data, error } = await editIssue(current.issue.id, current.issue.version, form.value)
      if (data === null) {
        // 拦截器已弹原因；乐观锁冲突时拉最新版本，避免用户在旧数据上反复提交
        if (error.includes(CONFLICT_HINT))
          await load()
        return
      }
      Message.success('已保存')
      await load()
      onChanged()
    }
    finally {
      saving.value = false
    }
  }

  const transition = useIssueTransition(
    () => (detail.value ? [detail.value.issue.id] : []),
    () => {
      void load()
      onChanged()
    },
  )

  /** 详情里可用的流转动作：无处理权限时全部隐藏，不处理 / 误报另需 can_suppress */
  const actions = computed<TransitionMeta[]>(() => {
    const current = detail.value
    if (!current?.can_handle)
      return []
    return TRANSITIONS.filter(t => !t.suppress || current.can_suppress)
  })

  async function refetchLog() {
    const current = detail.value
    if (!current)
      return
    refetching.value = true
    try {
      if (await refetchIssueLog(current.issue.id)) {
        Message.success('日志抓取完成')
        await load()
      }
    }
    finally {
      refetching.value = false
    }
  }

  // ── 日志查看 ──────────────────────────────────────
  const logVisible = ref(false)
  const logLoading = ref(false)
  const logLines = ref<TraceLogLine[]>([])
  const logTitle = ref('')
  const downloadingLogId = ref('')
  const { downloadWithTip } = useDownload()

  async function downloadLog(row: TraceLogRow) {
    downloadingLogId.value = row.id
    try {
      const filename = `monitor-log-${row.trace_id.replace(/[^\w-]/g, '_')}.csv`
      await downloadWithTip(`${ApiMonauditIssue.traceLogDownload}?id=${encodeURIComponent(row.id)}`, filename, '日志下载失败')
    }
    finally {
      downloadingLogId.value = ''
    }
  }

  async function openLog(row: TraceLogRow) {
    logTitle.value = `日志 · ${row.trace_id}`
    logLines.value = []
    logVisible.value = true
    logLoading.value = true
    try {
      logLines.value = (await fetchTraceLog(row.id)) ?? []
    }
    finally {
      logLoading.value = false
    }
  }

  return {
    detail,
    loading,
    form,
    saving,
    save,
    load,
    actions,
    transition,
    handlerId,
    handlerOptions,
    handlerLoading,
    assigning,
    saveHandler,
    refetching,
    refetchLog,
    logVisible,
    logLoading,
    logLines,
    logTitle,
    downloadingLogId,
    openLog,
    downloadLog,
  }
}
