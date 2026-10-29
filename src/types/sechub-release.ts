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

/** 发版缺陷状态（sec_defect.defect_status） */
export type DefectStatus = 'draft' | 'submitted' | 'fixed' | 'closed'

/** 发版缺陷来源（defect_draft.rs 的 SOURCE_API / SOURCE_CONFIG） */
export type DefectSource = 'release_api' | 'release_config'

/** `GET /sechub/release/defects` 的列表项（defect_view 出参） */
export interface ReleaseDefect {
  id: string
  defect_code: string
  title: string
  status: DefectStatus
  priority: string | null
  project_group_name: string | null
  app_name: string | null
  source: DefectSource | null
  iteration_code: string | null
  /** RFC3339 */
  discovered_at: string | null
  /** RFC3339 */
  updated_at: string | null
  external_no: string | null
  /** Markdown 原文 */
  content: string | null
}

/** 缺陷列表 / 导出查询参数（空值不下发） */
export interface DefectQuery {
  iteration_id?: string
  project_group?: string
  status?: DefectStatus
  source?: DefectSource
  keyword?: string
  page_num?: number
  page_size?: number
}

/** 页面筛选状态（空串表示不过滤） */
export interface DefectFilters {
  /** 查询用迭代 id；页面把它单独放在 v-model 上，因此可选 */
  iterationId?: string
  projectGroup: string
  status: '' | DefectStatus
  source: '' | DefectSource
  keyword: string
}

/** `GET /sechub/release/defects` */
export interface DefectListResponse {
  list: ReleaseDefect[]
  total: number
  page_num: number
  page_size: number
}

/** `POST /sechub/release/defects/{id}/status` 请求体 */
export interface DefectStatusPayload {
  status: DefectStatus
  external_no?: string
}

/** `POST /sechub/release/defects/{id}/status` 响应 */
export interface DefectStatusResult {
  id: string
  status: DefectStatus
  external_no: string | null
}

/** `POST /sechub/release/results/{result_id}/confirm-defect` 请求体 */
export interface ConfirmDefectPayload {
  comment?: string
}

/** `POST /sechub/release/results/{result_id}/confirm-defect` 响应 */
export interface ConfirmDefectResult {
  id: string
  created: boolean
  review_verdict: 'true_positive'
}

// ── 配置检查（D11 查询 / 执行 / 白名单接口） ─────────────
// 以 `service/src/sechub/release/config_check/{view,rules,waiver_service}.rs` 的
// 实际出参为准：规则表来自 `rules::RULES`，统计字段全部 snake_case。

/** 规则维度（rules::RuleFamily 的 serde 名） */
export type ConfigRuleFamily = 'meta' | 'api'

/** 规则默认级别 / 检查项级别（high / medium / low / info） */
export type ConfigSeverity = 'high' | 'medium' | 'low' | 'info'

/** 检查项状态（sec_config_check_item.state） */
export type ConfigItemState = 'open' | 'waived' | 'resolved'

/** 范围口径：domain = 按产品领域过滤；all = 全部 */
export type ConfigScope = 'domain' | 'all'

/** 规则表的一行定义（`rules::RuleDef`） */
export interface ConfigRuleDef {
  code: string
  family: ConfigRuleFamily
  /** form / form_op / api / api_path / app */
  object_type: string
  title: string
  severity: ConfigSeverity
  description: string
  fix_hint: string
  /** 是否参与发版结论（info 级为 false） */
  in_conclusion: boolean
}

/** 按规则统计（`by_rule`） */
export interface ConfigRuleStat {
  rule_code: string
  title: string
  severity: ConfigSeverity
  open: number
  waived: number
  resolved: number
  new_open: number
  fixed_in_iteration: number
}

/** 按项目组统计（`by_group`） */
export interface ConfigGroupStat {
  project_group_code: string
  project_group_name: string
  open: number
  waived: number
  high_open: number
  new_open: number
}

/** 范围汇总（`totals`） */
export interface ConfigTotals {
  open: number
  waived: number
  high_open: number
  new_open: number
  fixed_in_iteration: number
}

/** 最近一次检查时间（按维度，RFC3339；从未检查为 null） */
export interface ConfigLastScan {
  meta: string | null
  api: string | null
}

/** `GET /sechub/release/config-check/summary` */
export interface ConfigSummaryResponse {
  iteration: ReleaseIterationScope
  env: ReleaseEnv
  product_domains: string[]
  rules: ConfigRuleDef[]
  by_rule: ConfigRuleStat[]
  by_group: ConfigGroupStat[]
  totals: ConfigTotals
  last_scan: ConfigLastScan
}

/** 检查项列表行：实体全字段 + 后端补的 is_new / rule_title */
export interface ConfigItem {
  id: string
  env_id: string
  product_line: string
  rule_code: string
  /** form / form_op / api / api_path / app */
  object_type: string
  object_key: string
  object_name: string | null
  app_number: string | null
  app_name: string | null
  project_group_code: string | null
  project_group_name: string | null
  product_domain: string | null
  state: string
  severity: string
  /** 规则命中的原始证据（形状随规则变化，页面不渲染） */
  evidence_json: unknown
  evidence_digest: string
  /** RFC3339 */
  first_seen_at: string
  /** RFC3339 */
  last_seen_at: string
  /** RFC3339 */
  resolved_at: string | null
  last_run_id: string | null
  /** RFC3339 */
  created_at: string | null
  /** RFC3339 */
  updated_at: string | null
  /** 本迭代新增 / 重现 */
  is_new: boolean
  /** 规则中文名；未知规则为 null */
  rule_title: string | null
}

/** 检查项列表查询（只带非空条件） */
export interface ConfigItemQuery {
  iteration_id?: string
  scope?: ConfigScope
  rule_code?: string
  project_group?: string
  state?: ConfigItemState | 'all'
  severity?: ConfigSeverity
  keyword?: string
  new_only?: boolean
  page_num?: number
  page_size?: number
}

/** 汇总查询（summary 只吃范围，不吃列表筛选） */
export interface ConfigSummaryQuery {
  iteration_id?: string
  scope?: ConfigScope
}

/** `GET /sechub/release/config-check/items` */
export interface ConfigItemListResponse {
  total: number
  page_num: number
  page_size: number
  list: ConfigItem[]
}

/** 检查项变更记录（sec_config_check_event） */
export interface ConfigEvent {
  id: string
  item_id: string
  env_id: string
  rule_code: string
  object_key: string
  project_group_code: string | null
  product_domain: string | null
  run_id: string | null
  /** opened / resolved / reopened / waived / unwaived / evidence_changed */
  event: string
  old_state: string | null
  new_state: string
  evidence_digest: string
  /** 扫描为 'scan'，人工操作为用户 id */
  actor: string | null
  /** RFC3339 */
  created_at: string | null
}

/** `GET /sechub/release/config-check/items/{id}/events` */
export interface ConfigEventsResponse {
  item_id: string
  list: ConfigEvent[]
}

/** 手动检查范围（按当前页签发） */
export type ConfigRunFamily = 'meta' | 'api' | 'all'

/** `POST /sechub/release/config-check/run` */
export interface ConfigRunResult {
  accepted: boolean
  env_id: string
  family: string
}

/** `POST /sechub/release/config-check/defect` 请求体 */
export interface ConfigDefectReq {
  env_id?: string
  project_group_code: string
  rule_code: string
}

/** `POST /sechub/release/config-check/defect` 响应 */
export interface ConfigDefectResult {
  id: string
  /** false = 已存在同指纹的未关闭缺陷，本次只做更新 */
  created: boolean
  item_count: number
  project_group_id: string | null
}

/** 白名单匹配方式：exact 精确匹配 object_key；app 按应用编码整体加白 */
export type WaiverMatchType = 'exact' | 'app'

/** 白名单行（`waiver_service::list_waivers` 出参） */
export interface ReleaseWaiver {
  id: string
  /** 为空 = 所有环境 */
  env_id: string | null
  /** 规则编号；API_EXEMPT 表示接口免测 */
  rule_code: string
  match_type: string
  object_key: string
  reason: string
  /** RFC3339 */
  expires_at: string | null
  created_by: string
  /** RFC3339 */
  created_at: string | null
  revoked_by: string | null
  /** RFC3339 */
  revoked_at: string | null
  revoke_reason: string | null
  /** 未撤销且未过期 */
  active: boolean
}

/** `GET /sechub/release/waivers` */
export interface WaiverListResponse {
  total: number
  page_num: number
  page_size: number
  list: ReleaseWaiver[]
}

/** 白名单列表查询（active_only 不传 = 后端默认只看有效） */
export interface WaiverQuery {
  rule_code?: string
  active_only?: boolean
  keyword?: string
  page_num?: number
  page_size?: number
}

/** `POST /sechub/release/waivers` 请求体 */
export interface WaiverAddReq {
  /** 为空 = 所有环境 */
  env_id?: string
  rule_code: string
  match_type?: WaiverMatchType
  object_key: string
  /** trim 后至少 4 个字符 */
  reason: string
  /** RFC3339，可空；必须晚于当前时间 */
  expires_at?: string
}

/** `POST /sechub/release/waivers` 响应 */
export interface WaiverAddResult {
  id: string
  /** 因本条白名单立即转为 waived 的检查项数 */
  affected: number
}

/** `POST /sechub/release/waivers/{id}/revoke` 请求体 */
export interface WaiverRevokeReq {
  reason: string
}

/** `POST /sechub/release/waivers/{id}/revoke` 响应 */
export interface WaiverRevokeResult {
  /** 退回 open 的检查项数 */
  affected: number
}
