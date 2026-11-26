/**
 * 状态流转：关闭 / 不处理 / 误报需先填原因（弹窗），其余动作直接提交。
 *
 * 列表工具栏（批量）与详情弹窗（单条）共用。
 */
import type { TransitionAction } from './types'
import { Message } from '@arco-design/web-vue'
import { ref } from 'vue'
import { showBatchResult } from '../shared/service'
import { transitionIssues } from './service'
import { transitionMeta } from './types'

export function useIssueTransition(getIds: () => string[], onDone: () => void) {
  const reasonVisible = ref(false)
  const reasonTitle = ref('')
  const reason = ref('')
  const submitting = ref(false)
  let pending: TransitionAction | null = null

  async function submit(action: TransitionAction, why: string): Promise<boolean> {
    const ids = getIds()
    if (!ids.length) {
      Message.warning('请先选择问题')
      return false
    }
    submitting.value = true
    try {
      const result = await transitionIssues(ids, action, why)
      if (!result)
        return false
      showBatchResult(result)
      onDone()
      return true
    }
    finally {
      submitting.value = false
    }
  }

  /** 选择动作：需要原因的先弹窗 */
  function run(action: TransitionAction) {
    const meta = transitionMeta(action)
    if (!meta.needReason) {
      void submit(action, '')
      return
    }
    if (!getIds().length) {
      Message.warning('请先选择问题')
      return
    }
    pending = action
    reason.value = ''
    reasonTitle.value = `${meta.label}：填写原因`
    reasonVisible.value = true
  }

  /** 原因弹窗确定：返回 false 阻止关闭 */
  async function confirmReason(): Promise<boolean> {
    if (!pending)
      return true
    if (!reason.value.trim()) {
      Message.warning('请填写原因')
      return false
    }
    const ok = await submit(pending, reason.value)
    if (ok)
      pending = null
    return ok
  }

  return { reasonVisible, reasonTitle, reason, submitting, run, confirmReason }
}
