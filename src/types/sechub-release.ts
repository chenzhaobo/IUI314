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

/** 有效用例最新有效判定计数（loader::VerdictCounts） */
export interface ReleaseVerdictCounts {
  pass: number
  fail: number
  review: number
  blocked: number
  error: number
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
  /** 本迭代执行过的有效用例数 */
  executed_cnt: number
  verdicts: ReleaseVerdictCounts
  /** 有效判定 FAIL 且未复核的用例数 */
  unreviewed_fail_cnt: number
  /** 每个 BLOCKED 有效用例的阻塞归类（去重排序） */
  block_reasons: string[]
  ai_case_cnt: number
  manual_case_cnt: number
  /** 有效用例的 test_type 是否同时覆盖 base / perm / idor */
  has_minimal_set: boolean
  /** 游客可访问或高风险开发模式 */
  high_risk: boolean
  /** 写类接口 */
  write_like: boolean
  /** 有效用例最新结果 HTTP 状态为 404 / 405 */
  contract_mismatch: boolean
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
  /** 环境所属产品线（字典 perf_product_line） */
  product_line: string
  /** 实际生效的产品领域（未指定时为后端配置的默认领域） */
  product_domains: string[]
  /** 实际生效的范围条件（loader::ReleaseScope） */
  scope: {
    product_domains: string[]
    business_areas: string[]
    project_groups: string[]
  }
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
  product_line?: string
  iteration_id?: string
  env_id?: string
  /** 产品领域，逗号分隔 */
  product_domains?: string
  /** 业务领域，逗号分隔；`__none__` 表示未分业务领域 */
  business_area?: string
  /** 项目组编码，逗号分隔（范围条件） */
  project_group?: string
  status?: CoverageStatusFilter
  tag?: CoverageTagFilter
  keyword?: string
  page_num?: number
  page_size?: number
}

// ── 发版范围筛选（scope-options，供各发版页面复用） ─────────

/** 产品线字典项（perf_product_line） */
export interface ReleaseScopeProductLine {
  value: string
  label: string
  is_default: boolean
}

/** 产品线下的测试环境 */
export interface ReleaseScopeEnv {
  id: string
  name: string
  /** 该环境未删除的清单接口数 */
  api_total: number
}

/** 范围树中的项目组 */
export interface ReleaseScopeGroup {
  code: string
  name: string
}

/** 范围树中的业务领域（value = `__none__` 表示未分业务领域） */
export interface ReleaseScopeBusinessArea {
  value: string
  label: string
  project_groups: ReleaseScopeGroup[]
}

/** 范围树中的产品领域 */
export interface ReleaseScopeDomain {
  name: string
  business_areas: ReleaseScopeBusinessArea[]
}

/** `GET /sechub/release/scope-options` */
export interface ReleaseScopeOptions {
  product_lines: ReleaseScopeProductLine[]
  /** 解析后的产品线（缺省为字典 is_default 项） */
  product_line: string
  envs: ReleaseScopeEnv[]
  /** 产品线没有测试环境时为 null */
  env_id: string | null
  /** 环境缺失原因；有测试环境时为 null */
  env_error: string | null
  iterations: ReleaseIteration[]
  /** 当前进行中的迭代；没有则为 null */
  current_id: string | null
  domains: ReleaseScopeDomain[]
}

/** 范围筛选查询参数（空值不下发） */
export interface ReleaseScopeQuery {
  product_line?: string
  iteration_id?: string
  /** 产品领域，逗号分隔 */
  product_domains?: string
  /** 业务领域，逗号分隔 */
  business_area?: string
  /** 项目组编码，逗号分隔 */
  project_group?: string
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

// ── 质量看板 / 发版检查 / 发版报告（D18） ─────────────
// 以 `service/src/sechub/release/{dashboard,metrics,snapshot,check}.rs` 与
// `api/src/sechub/release.rs` 的实际出参为准：比率均为 0~1 的小数（4 位），
// 分母为 0 时为 null；计数类字段没有 null。

/** 发版结论（metrics::Conclusion 的 serde 名） */
export type ReleaseConclusion = 'blocked' | 'risky' | 'passed'

/** 结论触发项（Blocked 在前，最多 10 条） */
export interface ReleaseTrigger {
  level: ReleaseConclusion
  code: string
  text: string
}

/** 范围指标（metrics::ScopeMetrics） */
export interface ReleaseScopeMetrics {
  accessible: number
  new_total: number
  changed_total: number
  removed_total: number
  /** test_type → 接口数 */
  test_type_dist: Record<string, number>
}

/** 覆盖指标（metrics::CoverageMetrics） */
export interface ReleaseCoverageMetrics {
  covered: number
  coverage_rate: number | null
  new_covered: number
  new_coverage_rate: number | null
  high_risk_total: number
  high_risk_covered: number
  high_risk_rate: number | null
  minimal_complete: number
  minimal_rate: number | null
  new_minimal_complete: number
  new_minimal_rate: number | null
  pending_review: number
  exempt: number
  /** 新增接口中的免测数（新增覆盖率分母扣除） */
  new_exempt: number
}

/** 执行指标（metrics::ExecutionMetrics） */
export interface ReleaseExecutionMetrics {
  valid_cases: number
  executed: number
  exec_rate: number | null
  verdicts: ReleaseVerdictCounts
  pass_rate: number | null
  block_rate: number | null
  pending_review: number
  api_executed: number
  api_passed: number
  api_pass_rate: number | null
  /** 阻塞归类 → 阻塞接口数 */
  block_reasons: Record<string, number>
}

/** 问题输入（metrics::IssueInputs） */
export interface ReleaseIssueInputs {
  open_defects: number
  open_high_defects: number
  new_defects: number
  legacy_defects: number
  new_high_config_open: number
  legacy_high_config_open: number
  config_open: number
  config_waived: number
  config_new: number
  config_fixed: number
}

/** 目标线比较项（metrics::TargetCheck） */
export type ReleaseTargetKey
  = | 'new_coverage'
    | 'open_high_defects'
    | 'new_high_config'
    | 'exec_rate'
    | 'new_minimal'
    | 'block_rate'

export interface ReleaseTargetCheck {
  key: ReleaseTargetKey
  label: string
  actual: number | null
  target: number | null
  /** null = 未设目标线或实际值为 null（不判达标） */
  met: boolean | null
}

/** 项目组矩阵行（metrics::GroupRow） */
export interface ReleaseGroupRow {
  project_group_code: string
  project_group_name: string
  scope: ReleaseScopeMetrics
  coverage: ReleaseCoverageMetrics
  execution: ReleaseExecutionMetrics
  issues: ReleaseIssueInputs
  conclusion: ReleaseConclusion
}

/** AI 投入与效率（dashboard::AiMetrics） */
export interface ReleaseAiMetrics {
  dispatches: number
  ai_cases_created: number
  ai_cases_approved: number
  ai_approve_rate: number | null
  ai_valid_cases: number
  manual_valid_cases: number
  agent_duration_ms: number
}

/** `GET /sechub/release/dashboard` */
export interface ReleaseDashboardData {
  iteration: ReleaseIterationScope
  env: ReleaseEnv
  product_domains: string[]
  conclusion: ReleaseConclusion
  triggers: ReleaseTrigger[]
  scope: ReleaseScopeMetrics
  coverage: ReleaseCoverageMetrics
  execution: ReleaseExecutionMetrics
  issues: ReleaseIssueInputs
  targets: ReleaseTargetCheck[]
  groups: ReleaseGroupRow[]
  /** 未覆盖 / 待评审，已按新增 > 高风险 > 变更 > 路径排序，最多 20 条 */
  uncovered_top: ReleaseApi[]
  ai: ReleaseAiMetrics
  /** RFC3339 */
  generated_at: string
}

/** 看板查询（空值不下发） */
export interface ReleaseDashboardQuery {
  iteration_id?: string
  env_id?: string
  product_domains?: string
}

/** 趋势点（snapshot::trend 的 list 项） */
export interface ReleaseTrendPoint {
  iteration_id: string
  iteration_name: string
  is_final: boolean
  conclusion: string | null
  coverage_rate: number | null
  new_coverage_rate: number | null
  pass_rate: number | null
  new_defects: number
  high_config_open: number
}

/** `GET /sechub/release/trend` */
export interface ReleaseTrendResponse {
  env_id: string
  product_line: string
  /** 按迭代开始日期升序：当前迭代 + 最多 6 个更早迭代 */
  list: ReleaseTrendPoint[]
}

/** 趋势查询 */
export interface ReleaseTrendQuery {
  iteration_id?: string
  env_id?: string
}

/** 快照列表行（snapshot::SnapshotListRow，不含 metrics_json / report_md） */
export interface ReleaseSnapshotRow {
  id: string
  iteration_id: string
  iteration_code: string | null
  iteration_name: string | null
  product_line: string
  env_id: string
  product_domains: string
  /** blocked / risky / passed */
  conclusion: string
  /** '1' 已定稿 / '0' 未定稿 */
  is_final: string
  finalized_by: string | null
  /** RFC3339 */
  finalized_at: string | null
  generated_by: string | null
  /** RFC3339 */
  created_at: string | null
}

/** `GET /sechub/release/snapshots` */
export interface ReleaseSnapshotListResponse {
  total: number
  page_num: number
  page_size: number
  list: ReleaseSnapshotRow[]
}

/** 快照列表查询 */
export interface ReleaseSnapshotQuery {
  iteration_id?: string
  page_num?: number
  page_size?: number
}

/** `POST /sechub/release/snapshots` 请求体 */
export interface ReleaseSnapshotGenerateReq {
  iteration_id?: string
  env_id?: string
}

/** `POST /sechub/release/snapshots` 响应 */
export interface ReleaseSnapshotGenerateResult {
  id: string
  conclusion: string
}

/** `GET /sechub/release/snapshots/{id}`：整行（含 metrics_json / report_md） */
export interface ReleaseSnapshotDetail extends ReleaseSnapshotRow {
  /** 生成时的 DashboardData（页面不渲染） */
  metrics_json: unknown
  report_md: string | null
  unfinalize_reason: string | null
  /** RFC3339 */
  updated_at: string | null
}

/** 定稿 / 撤销定稿响应（`{ id, is_final }`） */
export interface ReleaseSnapshotFinalizeResult {
  id: string
  is_final: string
}

/** `POST /sechub/release/snapshots/{id}/unfinalize` 请求体 */
export interface ReleaseSnapshotUnfinalizeReq {
  reason: string
}

/** 发版回归套件摘要（check::status 的 suite） */
export interface ReleaseSuiteSummary {
  id: string
  suite_code: string
  name: string
  schedule_cron: string | null
  /** '1' 启用 / '0' 停用 */
  schedule_enabled: string
}

/** 套件运行（sec_sec_run 实体全字段 + task_name） */
export interface ReleaseSuiteRun {
  id: string
  task_id: string
  env_id: string | null
  run_name: string
  iteration_phase: string | null
  status: string
  /** RFC3339 */
  started_at: string | null
  /** RFC3339 */
  finished_at: string | null
  total_cases: number
  pass_cnt: number
  fail_cnt: number
  review_cnt: number
  block_cnt: number
  error_cnt: number
  new_forms_cnt: number
  new_buttons_cnt: number
  new_apis_cnt: number
  account_overrides: string | null
  triggered_by: string | null
  trigger_mode: string
  create_by: string
  /** RFC3339 */
  created_at: string | null
  task_name: string | null
}

/** 回归后 AI 复核状态（GET runs/{run_id}/review；从未复核时后端返回 status=none） */
export interface ReleaseRunReview {
  /** running / succeeded / failed / timeout；none 表示从未复核 */
  status: string
  started_at?: string
  finished_at?: string
  error_message?: string | null
}

/** `POST /sechub/release/runs/{run_id}/review` 响应（受理 running / 无需复核 skipped / 已在跑 message） */
export interface ReleaseRunReviewStartResult {
  status?: string
  /** 本次交给 AI 的结果条数 */
  candidates?: number
  skipped?: boolean
  message?: string
}

/** `GET /sechub/release/check/status` */
export interface ReleaseCheckStatusResponse {
  product_line: string
  /** 仅在尚未创建套件时返回（无套件时 suite 为 null） */
  suite_code?: string
  suite: ReleaseSuiteSummary | null
  latest_runs: ReleaseSuiteRun[]
  latest_snapshot: ReleaseSnapshotRow | null
  /** 汇总复核状态；当前后端固定为 null */
  review: ReleaseRunReview | null
}

/** 发版检查查询 / 触发请求体（产品线，缺省星瀚） */
export interface ReleaseCheckQuery {
  product_line?: string
}

/** `POST /sechub/release/check/run` 响应（回归套件触发结果 + 配置检查受理标记） */
export interface ReleaseCheckRunResult {
  suite_id: string
  triggered: number
  skipped: number
  runs: Array<{ env_id: string, task_id: string, task_created: boolean, run_id: string }>
  skipped_envs: Array<{ env_id: string, reason: string }>
  config_check_started: boolean
}
