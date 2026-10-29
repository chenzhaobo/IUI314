/**
 * 「批量通过 / 批量驳回」弹窗的状态与提交（View → Composable → Service → Api 的 composable 层）。
 *
 * 页面只拿 `selectedIds` 交给工具条组件；组件内用本 composable 管状态与请求。
 * 进度提示与校验文案在这里收口，组件只负责渲染。
 */
import type { CaseBatchReviewResult, CaseBatchVerdict } from '@/types/sechub'
import { Message } from '@arco-design/web-vue'
import { ref } from 'vue'

import { batchReviewCases } from '../services/caseReviewService'
import { validateBatchReview } from './caseBatchReviewRules'

export function useCaseBatchReview() {
  const visible = ref(false)
  const verdict = ref<CaseBatchVerdict>('approved')
  const comment = ref('')
  const submitting = ref(false)
  /** 上一次提交结果：有 skipped 时保留，供弹窗展示跳过原因 */
  const lastResult = ref<CaseBatchReviewResult | null>(null)

  /** 打开弹窗并重置上一轮的输入与结果 */
  function open(next: CaseBatchVerdict) {
    verdict.value = next
    comment.value = ''
    lastResult.value = null
    visible.value = true
  }

  function close() {
    visible.value = false
  }

  /** 关闭弹窗后清理（组件在 close 事件里调用，避免残留上一轮的跳过列表） */
  function reset() {
    comment.value = ''
    lastResult.value = null
  }

  /** 提交；返回 false 时弹窗保持打开（校验没过或请求失败） */
  async function submit(caseIds: string[]): Promise<boolean> {
    const blocked = validateBatchReview(caseIds.length, verdict.value, comment.value)
    if (blocked) {
      Message.warning(blocked)
      return false
    }
    submitting.value = true
    try {
      const result = await batchReviewCases({
        case_ids: caseIds,
        verdict: verdict.value,
        comment: comment.value.trim() || undefined,
      })
      if (!result)
        return false
      lastResult.value = result
      Message.success(`已更新 ${result.updated} 条，跳过 ${result.skipped.length} 条`)
      return true
    }
    finally {
      submitting.value = false
    }
  }

  return { visible, verdict, comment, submitting, lastResult, open, close, reset, submit }
}
