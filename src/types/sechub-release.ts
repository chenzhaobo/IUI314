/**
 * 发版质量「接口覆盖」页：`GET /sechub/release/iterations` 与
 * `GET /sechub/release/coverage` 的响应形状。
 *
 * 以 `axum_admin/service/src/sechub/release/{coverage_view,loader}.rs` 的实际出参为准：
 * `CoverageStatus` 为 snake_case；`CoverageCounts` 没有 changed_total。
 */

/** 用例覆盖状态（后端 CoverageStatus 的 serde 名） */
export type CoverageStatus = 'uncovered'
  | 'pending_review'
  | 'exempt'
  | 'not_run'
  | 'partial'
  | 'passed'
  | 'failed'
  | 'review'
  | 'blocked'

/** 状态筛选额外支持的两个聚合口径（后端 status_matches） */
export type CoverageStatusFilter = CoverageStatus | 'covered' | 'not_covered'

/** 标签筛选（后端 tag_matches） */
export type CoverageTagFilter = 'new' | 'changed'

/** 迭代下拉项 */
export interface ReleaseIteration {
  id: string
  code: string
  name: string
  start_date: string
  end_date: string
  is_current: boolean
}

/** `GET /sechub/release/iterations` */
export interface ReleaseIterationsResponse {
  /** 当前进行中的迭代；没有则为 null */
  current_id: string | null
  list: ReleaseIteration[]
}

/** 看板头部的迭代信息 */
export interface ReleaseIterationScope {
  id: string
  code: string
  name: string
  start_date: string
  end_date: string
  /** 距结束天数，由后端按业务日期计算 */
  days_left: number
}

/** 看板头部的环境信息 */
export interface ReleaseEnv {
  id: string
  name: string
}

/** 接口标签 */
export interface ReleaseApiTags {
  is_new: boolean
  is_changed: boolean
  is_removed: boolean
}

/** 覆盖统计（summary 与每个项目组行共用） */
export interface CoverageCounts {
  total: number
  covered: number
  uncovered: number
  pending_review: number
  exempt: number
  not_run: number
  partial: number
  passed: number
  failed: number
  review: number
  blocked: number
  new_total: number
  new_covered: number
}

/** 单个接口的覆盖事实 */
export interface ReleaseApi {
  api_path: string
  http_method: string | null
  api_version: string
  name: string | null
  app_number: string
  app_name: string | null
  project_group_code: string
  project_group_name: string
  product_domain: string
  status: string | null
  dev_mode: string | null
  allow_guest: string
  thirdapp_auth: string
  /** RFC3339 */
  source_created_at: string | null
  /** RFC3339 */
  first_seen_at: string | null
  tags: ReleaseApiTags
  coverage: CoverageStatus
  valid_case_cnt: number
  pending_case_cnt: number
  test_types: string[]
  /** RFC3339 */
  last_tested_at: string | null
}

/** 项目组统计行：项目组字段 + 平铺的计数 */
export interface CoverageGroupRow extends CoverageCounts {
  project_group_code: string
  project_group_name: string
}

/** `GET /sechub/release/coverage` */
export interface CoverageResponse {
  iteration: ReleaseIterationScope
  env: ReleaseEnv
  product_domains: string[]
  summary: CoverageCounts
  /** 本迭代下线的接口数 */
  removed_total: number
  groups: CoverageGroupRow[]
  total: number
  page_num: number
  page_size: number
  list: ReleaseApi[]
}

/** 覆盖看板查询参数（空值不下发） */
export interface CoverageQuery {
  iteration_id?: string
  env_id?: string
  project_group?: string
  status?: CoverageStatusFilter
  tag?: CoverageTagFilter
  keyword?: string
  page_num?: number
  page_size?: number
}

/** 安全测试环境下拉项（sec_test_env） */
export interface ReleaseSecEnv {
  id: string
  env_name: string | null
  env_type: string | null
}

/** `POST /sechub/scan/api-agent/run` 的派发结果（只取页面需要的两个字段） */
export interface AgentRunResult {
  /** 没有可派发接口时为 null，原因见 message */
  run_id: string | null
  message: string
}
