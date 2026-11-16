/**
 * 问题清单工具栏的批量动作：批量填写 / 分派 / 归类到项目组。
 *
 * 分派处理人来自系统人员表，不限制所选问题是否属于同一项目组。
 */
import type { Ref } from 'vue'
import type { LabelValue } from '../shared/types'
import type { ClassifyForm, HandleForm, IssueRow } from './types'
import { Message } from '@arco-design/web-vue'
import { ref } from 'vue'
import { fetchAllHandlerOptions, showBatchResult } from '../shared/service'
import { assignIssues, batchEditIssues, classifyIssues } from './service'
import { emptyHandleForm } from './types'

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
    assignHandler.value = ''
    handlerOptions.value = []
    assignVisible.value = true
    handlerLoading.value = true
    try {
      handlerOptions.value = await fetchAllHandlerOptions()
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
