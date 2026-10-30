/**
 * 发版质量「缺陷草稿」取数与操作（View → Composable → Service → Api 的 service 层）。
 *
 * 查询 / 操作失败统一返回 null（拦截器已提示），由 composable 决定是否保留旧数据。
 */
import type {
  ConfirmDefectPayload,
  ConfirmDefectResult,
  DefectListResponse,
  DefectQuery,
  DefectStatusPayload,
  DefectStatusResult,
  ReleaseDefectDetail,
} from '@/types/sechub-release'
import { ApiSecRelease, resolveStaticScanApi } from '@/api/sechubApis'
import { getAction, postAction } from '@/hooks'

/** 缺陷列表（分页 + 筛选）；失败返回 null */
export function fetchDefects(query: DefectQuery): Promise<DefectListResponse | null> {
  return getAction<DefectListResponse>(ApiSecRelease.defects, query)
}

/** 缺陷详情（列表字段 + 请求证据 / 完整地址 / curl）；失败返回 null */
export function fetchDefectDetail(id: string): Promise<ReleaseDefectDetail | null> {
  return getAction<ReleaseDefectDetail>(resolveStaticScanApi(ApiSecRelease.defectDetail, { id }))
}

/** 一键验证脚本下载路径（鉴权下载，返回 Python 文件） */
export function verifyScriptPath(id: string): string {
  return resolveStaticScanApi(ApiSecRelease.defectVerifyScript, { id })
}

/** 状态流转（标记已提交 / 已修复 / 退回草稿 / 关闭）；失败返回 null */
export function updateDefectStatus(id: string, payload: DefectStatusPayload): Promise<DefectStatusResult | null> {
  return postAction<DefectStatusResult>(resolveStaticScanApi(ApiSecRelease.defectStatus, { id }), payload)
}

/** 运行结果确认缺陷：复核置 true_positive 并生成 / 更新草稿；失败返回 null */
export function confirmDefect(resultId: string, comment?: string): Promise<ConfirmDefectResult | null> {
  const body: ConfirmDefectPayload = {}
  const trimmed = comment?.trim()
  if (trimmed)
    body.comment = trimmed
  return postAction<ConfirmDefectResult>(resolveStaticScanApi(ApiSecRelease.confirmDefect, { result_id: resultId }), body)
}
