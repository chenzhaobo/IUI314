/**
 * 问题清单工具栏的批量动作：批量填写 / 分派 / 归类到项目组。
 *
 * 分派的处理人候选来自所选问题的项目组成员，所以要求所选问题属于同一项目组。
 */
import type { Ref } from 'vue'
import type { LabelValue } from '../shared/types'
import type { ClassifyForm, HandleForm, IssueRow } from './types'
import { Message } from '@arco-design/web-vue'
import { ref } from 'vue'
import { fetchHandlerCandidates, showBatchResult } from '../shared/service'
import { assignIssues, batchEditIssues, classifyIssues } from './service'
import { emptyHandleForm, singleGroupOf } from './types'

export function useIssueBatch(selectedRows: Ref<IssueRow[]>, onDone: () => void) {
  const submitting = ref(false)

  function ids(): string[] {
    return selectedRows.value.map(r => r.id)
  }

  function ensureSelected(): boolean {
    if (selectedRows.value.length)
      return true
    Message.warning('请先选择问题')
    return false
  }

  async function withSubmitting(task: () => Promise<boolean>): Promise<boolean> {
    submitting.value = true
    try {
      return await task()
    }
    finally {
      submitting.value = false
    }
  }

  // ── 批量填写 ──────────────────────────────────────
  const editVisible = ref(false)
  const editForm = ref<HandleForm>(emptyHandleForm())

  function openEdit() {
    if (!ensureSelected())
      return
    editForm.value = emptyHandleForm()
    editVisible.value = true
  }

  function submitEdit(): Promise<boolean> {
    const form = editForm.value
    if (!form.plan_finish_date && !form.story_no.trim() && !form.defect_code.trim() && !form.handle_note.trim()) {
      Message.warning('请至少填写一项')
      return Promise.resolve(false)
    }
    return withSubmitting(async () => {
      const result = await batchEditIssues(ids(), form)
      if (!result)
        return false
      showBatchResult(result)
      onDone()
      return true
    })
  }

  // ── 分派 ──────────────────────────────────────────
  const assignVisible = ref(false)
  const assignHandler = ref('')
  const handlerOptions = ref<LabelValue[]>([])
  const handlerLoading = ref(false)

  async function openAssign() {
    if (!ensureSelected())
      return
    const group = singleGroupOf(selectedRows.value)
    if (!group) {
      Message.warning('分派需选择同一项目组的问题（未归类问题请先归类）')
      return
    }
    assignHandler.value = ''
    handlerOptions.value = []
    assignVisible.value = true
    handlerLoading.value = true
    try {
      handlerOptions.value = await fetchHandlerCandidates(group)
    }
    finally {
      handlerLoading.value = false
    }
  }

  function submitAssign(): Promise<boolean> {
    return withSubmitting(async () => {
      const result = await assignIssues(ids(), assignHandler.value)
      if (!result)
        return false
      showBatchResult(result)
      onDone()
      return true
    })
  }

  // ── 归类到项目组（全部范围用户） ───────────────────
  const classifyVisible = ref(false)
  const classifyForm = ref<ClassifyForm>({ project_group_id: '', create_mapping: false })

  function openClassify() {
    if (!ensureSelected())
      return
    classifyForm.value = { project_group_id: '', create_mapping: false }
    classifyVisible.value = true
  }

  function submitClassify(): Promise<boolean> {
    if (!classifyForm.value.project_group_id) {
      Message.warning('请选择项目组')
      return Promise.resolve(false)
    }
    return withSubmitting(async () => {
      const result = await classifyIssues(ids(), classifyForm.value)
      if (!result)
        return false
      showBatchResult(result)
      onDone()
      return true
    })
  }

  return {
    submitting,
    editVisible,
    editForm,
    openEdit,
    submitEdit,
    assignVisible,
    assignHandler,
    handlerOptions,
    handlerLoading,
    openAssign,
    submitAssign,
    classifyVisible,
    classifyForm,
    openClassify,
    submitClassify,
  }
}
