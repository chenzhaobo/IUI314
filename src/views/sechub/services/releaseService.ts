/**
 * 发版质量「接口覆盖」取数（View → Composable → Service → Api 的 service 层）。
 *
 * 查询失败统一返回 null / 空数组（拦截器已提示），由 composable 决定是否保留旧数据。
 */
import type {
  AgentRunResult,
  CoverageQuery,
  CoverageResponse,
  ReleaseIterationsResponse,
  ReleaseScopeTreeResponse,
  ReleaseSecEnv,
} from '@/types/sechub-release'
import { ApiSecRelease, ApiSecScan, ApiSecTestEnv } from '@/api/sechubApis'
import { getAction, postAction } from '@/hooks'

/** 安全测试环境列表的响应形状（只取下拉需要的字段） */
interface SecEnvListResponse {
  list: ReleaseSecEnv[]
}

/** 迭代下拉（最多 24 条，含 current_id）；失败返回 null */
export function fetchIterations(): Promise<ReleaseIterationsResponse | null> {
  return getAction<ReleaseIterationsResponse>(ApiSecRelease.iterations)
}

/** 覆盖看板（汇总 / 项目组 / 分页列表）；失败返回 null */
export function fetchCoverage(query: CoverageQuery): Promise<CoverageResponse | null> {
  return getAction<CoverageResponse>(ApiSecRelease.coverage, query)
}

/** 接口覆盖左树（维度由 query.mode 决定）；失败返回 null */
export function fetchCoverageScopeTree(
  query: Record<string, string | number | boolean>,
): Promise<ReleaseScopeTreeResponse | null> {
  return getAction<ReleaseScopeTreeResponse>(ApiSecRelease.coverageScopeTree, query)
}

/** 安全测试环境下拉；失败返回空数组 */
export async function fetchSecEnvs(): Promise<ReleaseSecEnv[]> {
  const data = await getAction<SecEnvListResponse>(ApiSecTestEnv.getList, { page_num: 1, page_size: 200 })
  return Array.isArray(data?.list) ? data.list : []
}

/**
 * 一键测试：一次调用只派发同一个项目组。
 * `run_id` 为空表示后端没有可派发接口，原因在 `message`。
 */
export function startAgentRun(
  secEnvId: string,
  projectGroupCode: string,
  apiPaths: string[],
): Promise<AgentRunResult | null> {
  return postAction<AgentRunResult>(ApiSecScan.apiAgentRun, {
    sec_env_id: secEnvId,
    dimension: 'project_group',
    code: projectGroupCode,
    api_paths: apiPaths,
    max_apis: apiPaths.length,
    include_internal: true,
  })
}
