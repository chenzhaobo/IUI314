/**
 * 发版质量「质量看板 / 发版检查 / 发版报告」取数（View → Composable → Service → Api 的 service 层）。
 *
 * 查询失败统一返回 null（拦截器已提示），由 composable 决定是否保留旧数据。
 * 复核接口按 D20b 实际出参对接：GET 从未复核时返回 `{status:"none"}`，这里归一成 null。
 */
import type {
  ReleaseCheckPlanQuery,
  ReleaseCheckPlanResponse,
  ReleaseCheckQuery,
  ReleaseCheckRunResult,
  ReleaseCheckStatusResponse,
  ReleaseDashboardData,
  ReleaseDashboardQuery,
  ReleaseRunReview,
  ReleaseRunReviewStartResult,
  ReleaseSnapshotDetail,
  ReleaseSnapshotFinalizeResult,
  ReleaseSnapshotGenerateReq,
  ReleaseSnapshotGenerateResult,
  ReleaseSnapshotListResponse,
  ReleaseSnapshotQuery,
  ReleaseTrendQuery,
  ReleaseTrendResponse,
} from '@/types/sechub-release'
import { ApiSecRelease, resolveStaticScanApi } from '@/api/sechubApis'
import { getAction, postAction } from '@/hooks'

/** 看板（实时计算，只读） */
export function fetchReleaseDashboard(query: ReleaseDashboardQuery): Promise<ReleaseDashboardData | null> {
  return getAction<ReleaseDashboardData>(ApiSecRelease.dashboard, query)
}

/** 近 6 个迭代的趋势点 */
export function fetchReleaseTrend(query: ReleaseTrendQuery): Promise<ReleaseTrendResponse | null> {
  return getAction<ReleaseTrendResponse>(ApiSecRelease.trend, query)
}

/** 生成快照与发版报告（后端会先重算派生检查） */
export function generateReleaseSnapshot(payload: ReleaseSnapshotGenerateReq): Promise<ReleaseSnapshotGenerateResult | null> {
  return postAction<ReleaseSnapshotGenerateResult>(ApiSecRelease.snapshots, payload)
}

/** 快照列表（服务端分页，按生成时间倒序） */
export function fetchReleaseSnapshots(query: ReleaseSnapshotQuery): Promise<ReleaseSnapshotListResponse | null> {
  return getAction<ReleaseSnapshotListResponse>(ApiSecRelease.snapshots, query)
}

/** 快照详情（含 report_md） */
export function fetchReleaseSnapshotDetail(id: string): Promise<ReleaseSnapshotDetail | null> {
  return getAction<ReleaseSnapshotDetail>(resolveStaticScanApi(ApiSecRelease.snapshotDetail, { id }))
}

/** 定稿 */
export function finalizeReleaseSnapshot(id: string): Promise<ReleaseSnapshotFinalizeResult | null> {
  return postAction<ReleaseSnapshotFinalizeResult>(resolveStaticScanApi(ApiSecRelease.snapshotFinalize, { id }))
}

/** 撤销定稿（reason 必填） */
export function unfinalizeReleaseSnapshot(id: string, reason: string): Promise<ReleaseSnapshotFinalizeResult | null> {
  return postAction<ReleaseSnapshotFinalizeResult>(resolveStaticScanApi(ApiSecRelease.snapshotUnfinalize, { id }), { reason })
}

/** 发版报告 Markdown 的下载路径（鉴权下载走 useDownload） */
export function snapshotReportPath(id: string): string {
  return resolveStaticScanApi(ApiSecRelease.snapshotReport, { id })
}

/** 发版检查状态：套件 / 最近 5 次运行 / 最近快照 / 复核 */
export function fetchReleaseCheckStatus(query: ReleaseCheckQuery): Promise<ReleaseCheckStatusResponse | null> {
  return getAction<ReleaseCheckStatusResponse>(ApiSecRelease.checkStatus, query)
}

/** 一键发版检查（触发回归套件 + 后台清单配置规则） */
export function runReleaseCheck(payload: ReleaseCheckQuery): Promise<ReleaseCheckRunResult | null> {
  return postAction<ReleaseCheckRunResult>(ApiSecRelease.checkRun, payload)
}

/** 检查计划（只读）：一键检查会跑哪些测试项 */
export function fetchReleaseCheckPlan(query: ReleaseCheckPlanQuery): Promise<ReleaseCheckPlanResponse | null> {
  return getAction<ReleaseCheckPlanResponse>(ApiSecRelease.checkPlan, query)
}

/** 触发某次运行的回归后 AI 复核 */
export function startRunReview(runId: string): Promise<ReleaseRunReviewStartResult | null> {
  return postAction<ReleaseRunReviewStartResult>(resolveStaticScanApi(ApiSecRelease.runReview, { run_id: runId }))
}

/** 复核状态；从未复核时后端返回 `{status:"none"}`，这里统一成 null */
export async function fetchRunReview(runId: string): Promise<ReleaseRunReview | null> {
  const data = await getAction<ReleaseRunReview | null>(resolveStaticScanApi(ApiSecRelease.runReview, { run_id: runId }))
  if (!data || typeof data.status !== 'string' || data.status === 'none')
    return null
  return data
}
