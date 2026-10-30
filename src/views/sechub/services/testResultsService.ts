/**
 * 「API / 表单测试结果」取数（View → Composable → Service → Api 的 service 层）。
 *
 * 查询失败统一返回 null（拦截器已提示），由 composable 决定是否保留旧数据。
 */
import type {
  ApiResultDetailQuery,
  ApiResultDetailResponse,
  ApiResultListResponse,
  ApiResultQuery,
  FormResultDetailResponse,
  FormResultListResponse,
  FormResultQuery,
} from '@/types/sechub-test-results'
import { ApiSecTestResults } from '@/api/sechubApis'
import { getAction } from '@/hooks'

/** 接口维度列表（含五分格 summary）；失败返回 null */
export function fetchApiResults(query: ApiResultQuery): Promise<ApiResultListResponse | null> {
  return getAction<ApiResultListResponse>(ApiSecTestResults.apis, query)
}

/** 单接口明细（用例 + 最近结果 + 未关闭缺陷）；失败返回 null */
export function fetchApiResultDetail(query: ApiResultDetailQuery): Promise<ApiResultDetailResponse | null> {
  return getAction<ApiResultDetailResponse>(ApiSecTestResults.apiDetail, query)
}

/** 表单维度列表（按表单编码分组）；失败返回 null */
export function fetchFormResults(query: FormResultQuery): Promise<FormResultListResponse | null> {
  return getAction<FormResultListResponse>(ApiSecTestResults.forms, query)
}

/** 单表单明细（与接口明细同结构）；失败返回 null */
export function fetchFormResultDetail(formNumber: string): Promise<FormResultDetailResponse | null> {
  return getAction<FormResultDetailResponse>(ApiSecTestResults.formDetail, { form_number: formNumber })
}
