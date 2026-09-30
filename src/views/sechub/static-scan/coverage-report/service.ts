/**
 * 覆盖自证报告取数（View → Composable → Service → Api 分层里的 service 层）。
 *
 * 与页面里直接用 useGet 的唯一区别，也是最关键的一处：**404 是正常状态**。
 * 报告在预扫描收口与 AI 确认完成后才生成，run 还没有报告时后端返回 404 ——
 * 这不是加载失败，调用方要拿它渲染「暂无报告」空态。而 useRequest 的失败拦截
 * 会把所有非 2xx 都落成 ErrorFlag 哨兵（HTTP 状态只留在 statusCode 里），
 * 所以必须先判 404 再判哨兵，否则「尚无报告」会被误报成错误。
 */
import type { CoverageReport } from './types'
import { ApiSecPrescan, resolveStaticScanApi } from '@/api/sechubApis'
import { BizError, isRequestFailed, useGet } from '@/hooks'

/**
 * 报告获取结果：ok=拿到报告；absent=该 run 尚无报告（HTTP 404）；
 * not_finalized=统一扫描 run 判定未定稿（006a 报告闸门业务错误 `run_not_finalized`）；
 * failed=请求失败（拦截器已弹提示）
 */
export type CoverageReportFetchResult
  = | { status: 'ok', report: CoverageReport }
    | { status: 'absent' }
    | { status: 'not_finalized' }
    | { status: 'failed' }

/** 006a 报告闸门的业务错误码（后端 bail 文案以它开头，经 Res::with_err 落成 code=500 业务错误） */
const RUN_NOT_FINALIZED = 'run_not_finalized'

/** 按 run 拉取覆盖自证报告。 */
export async function fetchCoverageReport(runId: string): Promise<CoverageReportFetchResult> {
  const { data, error, statusCode, execute } = useGet<CoverageReport>(
    resolveStaticScanApi(ApiSecPrescan.coverageReport, { run_id: runId }),
    {},
    { immediate: false },
  )
  await execute()
  // 先判 404：非 2xx 时 data 也是失败哨兵，只看 isRequestFailed 会把「尚无报告」误判成失败
  if (statusCode.value === 404)
    return { status: 'absent' }
  // 未定稿闸门：是正常的生命周期状态（判定中），不是故障
  if (error.value instanceof BizError && error.value.message.includes(RUN_NOT_FINALIZED))
    return { status: 'not_finalized' }
  if (isRequestFailed(data.value) || data.value === null)
    return { status: 'failed' }
  return { status: 'ok', report: data.value }
}
