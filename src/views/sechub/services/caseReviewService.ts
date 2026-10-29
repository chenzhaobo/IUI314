/**
 * 用例批量评审取数（View → Composable → Service → Api 的 service 层）。
 *
 * 失败返回 null（拦截器已提示），调用方据此决定是否保留弹窗。
 */
import type { CaseBatchReviewReq, CaseBatchReviewResult } from '@/types/sechub'
import { ApiSecScan } from '@/api/sechubApis'
import { postAction } from '@/hooks'

/** 批量通过 / 驳回；失败返回 null */
export function batchReviewCases(req: CaseBatchReviewReq): Promise<CaseBatchReviewResult | null> {
  return postAction<CaseBatchReviewResult>(ApiSecScan.caseBatchReview, req)
}
