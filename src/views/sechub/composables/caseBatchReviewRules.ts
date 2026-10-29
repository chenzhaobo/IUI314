/**
 * 用例批量评审的入参校验规则。
 *
 * 纯函数、不依赖 Vue / 请求层：单测可直接 import（仓库无 vitest，
 * 走 node:test + tsc，见 `src/utils/__tests__/perfFormat.spec.ts`）。
 * 口径与后端 `service/src/sechub/sec_case_batch.rs` 一致：1–500 条，
 * 驳回必须带意见；通过时意见选填。
 */
import type { CaseBatchVerdict } from '@/types/sechub'

/** 单次批量评审的用例上限（与后端 BATCH_REVIEW_MAX 一致） */
export const BATCH_REVIEW_MAX = 500

/** 返回给用户的拦截提示；null 表示可以提交 */
export function validateBatchReview(
  count: number,
  verdict: CaseBatchVerdict,
  comment: string,
): string | null {
  if (count <= 0)
    return '请先勾选用例'
  if (count > BATCH_REVIEW_MAX)
    return `一次最多处理 ${BATCH_REVIEW_MAX} 条用例，请分批操作`
  if (verdict === 'rejected' && !comment.trim())
    return '驳回必须填写意见'
  return null
}
