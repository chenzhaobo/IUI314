export type StaticScanDomain = 'security' | 'performance'
export type RequestedScopeType = 'repository' | 'modules' | 'files'
export type ScopeNodeType = 'repository' | 'module' | 'file'
export type EvaluationOutcome = 'pass' | 'fail' | 'not_applicable' | 'unknown'
export type ResultAuthority = 'authoritative' | 'non_authoritative'
export type RunTerminalStatus = 'succeeded' | 'failed' | 'cancelled'
export type RunStatus
  = | 'pending'
    | 'preparing'
    | 'planning'
    | 'pre_scanning'
    | 'agent_reviewing'
    | 'evaluating'
    | 'reconciling'
    | 'reporting'
    | 'retry_wait'
    | 'resuming'
    | RunTerminalStatus
export type ExecutionStatus
  = | 'pending'
    | 'running'
    | 'succeeded'
    | 'failed'
    | 'timed_out'
    | 'invalid_output'
    | 'unknown'
    | 'missing'
    | 'cancelled'
    | 'needs_human_review'
export type AssuranceMode
  = | 'deterministic_complete'
    | 'candidate_review'
    | 'rule_scope_review'
    | 'hybrid'
export type RuleReleaseStatus
  = | 'draft'
    | 'candidate_only'
    | 'reconstructed_pending_confirmation'
    | 'released'
    | 'retired'
export type VerificationOutcome = 'fixed' | 'still_present' | 'unverifiable'

export interface PageResult<T> {
  list: T[]
  total: number
}

export interface SelectOption {
  label: string
  value: string
}

export interface ModuleSummary {
  id: string
  code: string
  name: string
  module_code: string
  status: string
  scrum_team?: string
  project_group_id?: string
  product_group?: string
  owner?: string
  requirement_owner?: string
  offering_product?: string
  material_code?: string
  material_name?: string
  material_short_code?: string
  material_type?: string
  parent_cloud?: string
}

export interface RepositoryBindingView {
  relation_id: string
  module_id: string
  repository_id: string
  code: string
  name: string
  git_url: string
  credential_ref?: string | null
  default_branch: string
  root_path?: string | null
  default_scan_branch?: string | null
  scan_enabled: boolean
  is_primary: boolean
  status: string
}

export type RepositoryBinding = RepositoryBindingView

export interface RepositoryListResponse {
  list: RepositoryBindingView[]
  total: number
}

export interface RepositoryBindRequest {
  module_id: string
  code: string
  name: string
  git_url: string
  credential_ref?: string | null
  default_branch: string
  root_path?: string | null
  default_scan_branch?: string | null
  scan_enabled: boolean
  is_primary: boolean
  allow_local_test_repository: boolean
  idempotency_key: string
}

export interface MutationReceipt {
  id: string
  status: string
}

export interface WorkerJobReceipt {
  job_id: string
  status: string
  job_kind: string
}

export interface SourceJobStatus extends WorkerJobReceipt {
  attempt_count: number
  max_attempts: number
  output_snapshot_id?: string | null
  output_commit_sha?: string | null
  artifact_digest?: string | null
  error_class?: string | null
  error_message?: string | null
  finished_at?: string | null
}

export interface ReadySourceSnapshotView {
  snapshot_id: string
  repository_id: string
  source_job_id: string
  job_kind: 'clone' | 'update' | 'checkout'
  branch_name?: string | null
  ref_name?: string | null
  commit_sha: string
  artifact_digest: string
  created_at: string
}

export interface ReadySourceSnapshotListResponse {
  list: ReadySourceSnapshotView[]
  total: number
}

export interface StaticScanTaskOption {
  id: string
  name: string
  tool_code: string
  status: string
  create_by: string
  target_json?: {
    module_id?: string
    repository_id?: string
  } | null
}

export interface RepositoryBranch {
  name: string
  commit_sha: string
  is_default: boolean
}

export interface BranchesListResponse {
  relation_id: string
  snapshot_id?: string | null
  branches: RepositoryBranch[]
  stale: boolean
}

export type BranchesControlResponse
  = | { result: 'cached', data: BranchesListResponse }
    | { result: 'refresh_queued', job: WorkerJobReceipt }

export interface GitRevisionRequest {
  branch?: string
  tag?: string
  commit?: string
}

export interface SourceSnapshotRequest {
  module_id: string
  relation_id: string
  operation: 'clone' | 'update' | 'checkout'
  revision: GitRevisionRequest
  idempotency_key: string
}

export interface ScopePreviewRequest {
  repository_id: string
  snapshot_id: string
  scope_type: RequestedScopeType
  module_ids: string[]
  file_paths: string[]
  include_dependencies: boolean
}

export type ManifestOrigin = 'user_selected' | 'expanded' | 'supporting' | 'excluded'

export interface ScopeManifestItem {
  path: string
  module_id?: string | null
  size_bytes: number
  origin: ManifestOrigin
  reason?: string | null
}

export interface ScopeManifest {
  user_selected: ScopeManifestItem[]
  expanded: ScopeManifestItem[]
  supporting: ScopeManifestItem[]
  excluded: ScopeManifestItem[]
  stable_digest: string
}

export interface InventorySummary {
  user_selected_files: number
  expanded_files: number
  supporting_files: number
  excluded_files: number
  total_included_files: number
  total_included_bytes: number
}

export interface CapacityViolation {
  resource: string
  requested: number
  limit: number
}

export type ScopePreflightOutcome
  = | { decision: 'accepted', summary: InventorySummary }
    | {
      decision: 'rejected'
      code: string
      message: string
      summary: InventorySummary
      violations: CapacityViolation[]
      retry_with_smaller_request_required: boolean
    }

export interface ScopePreviewResponse {
  repository_id: string
  snapshot_id: string
  commit_sha: string
  scope_type: RequestedScopeType
  manifest: ScopeManifest
  preflight: ScopePreflightOutcome
}

export interface WorkCounts {
  source: number
  file: number
  batch: number
  rule: number
  agent: number
  evaluation: number
  reconcile: number
  report: number
}

/** Legacy scan-run list payload; static complete-scan control-plane uses WorkCounts. */
export interface ExpectedCountSet {
  source: number
  files: number
  batches: number
  rules: number
  agents: number
  evaluations: number
  reconcile: number
  reports: number
}

export interface CompleteScanRequest {
  task_id: string
  repository_id: string
  snapshot_id: string
  rule_set_id: string
  scope_type: RequestedScopeType
  module_ids: string[]
  file_paths: string[]
  include_dependencies: boolean
  branch_name?: string | null
  ref_name?: string | null
  commit_sha?: string | null
  domains: StaticScanDomain[]
  idempotency_key: string
}

export interface ContractViolation {
  code: string
  message: string
}

export interface PreflightDecision {
  accepted: boolean
  contract_digest: string
  commit_sha: string
  expected: WorkCounts
  violations: ContractViolation[]
}

export interface TriggerResult {
  run_id: string
  run_status: string
  frozen_contract_digest: string
  idempotent_replay: boolean
}

export interface ScanRun {
  id: string
  task_id?: string
  repository_id: string
  repository_name: string
  branch: string
  ref_name?: string
  commit_sha: string
  scope_type: RequestedScopeType
  domains: StaticScanDomain[]
  run_kind: 'complete_scan' | 'defect_verification'
  status: RunStatus
  authority: ResultAuthority
  execution_error?: string
  business_outcome?: 'pass' | 'fail' | 'unknown'
  finding_count: number
  expected_counts: ExpectedCountSet
  completed_counts: ExpectedCountSet
  coverage_complete: boolean
  started_at?: string
  finished_at?: string
  created_at: string
}

export interface RunStage {
  key: Exclude<RunStatus, RunTerminalStatus | 'retry_wait' | 'resuming'>
  label: string
  status: 'wait' | 'process' | 'finish' | 'error'
  expected: number
  completed: number
  error?: string
}

export interface RunProgress {
  run_id: string
  status: RunStatus
  authority: ResultAuthority
  business_outcome?: 'pass' | 'fail' | 'unknown'
  coverage_complete: boolean
  expected_counts: ExpectedCountSet
  completed_counts: ExpectedCountSet
  stages: RunStage[]
  execution_error?: string
}

export interface AgentReviewTask {
  id: string
  run_id: string
  frozen_contract_digest: string
  scope_id: string
  rule_version_id: string
  scan_point_id: string
  candidate_id?: string | null
  task_kind: string
  provider: string
  model: string
  profile: string
  context_digest: string
  required: boolean
  status: string
  verdict?: string | null
  attempt_count: number
  evidence: unknown
  error_code?: string | null
  error_message?: string | null
}

export interface AgentReviewPage {
  items: AgentReviewTask[]
  total: number
  page: number
  page_size: number
}

export interface RuleVersion {
  id: string
  rule_key: string
  scan_point_id: string
  scan_point_key: string
  scan_point_name: string
  scan_point_status?: string
  domain: StaticScanDomain
  category: string
  name: string
  version: string
  release_status: RuleReleaseStatus
  publication_status?: string
  assurance_mode: AssuranceMode
  agent_required_on_zero_hit: boolean
  context_completeness_predicate: string
  engine: string
  provider?: string
  profile?: string
  required_input_selectors: string[]
  matcher_json?: Record<string, any>
  evidence_schema_json?: Record<string, any>
  required_input_selectors_json?: string[]
  search_roots_json?: string[]
  provider_profile_json?: { provider?: string, profile?: string }
  sample_manifest_json?: { status?: string, dataset?: string }
  non_authoritative?: boolean
  enabled?: boolean
  implementation_status?: string
  updated_at: string
}

export interface ReadinessBlocker {
  code: string
  message: string
  rule_version_id?: string
  scan_point_id?: string
}

export interface RuleSet {
  id: string
  rule_set_key: string
  version: number
  name: string
  domains: StaticScanDomain[]
  publish_status: string
  release_status: string
  is_complete: boolean
  non_authoritative: boolean
  publish_block_reason?: string | null
  content_digest?: string | null
  published_at?: string | null
  created_at: string
  updated_at: string
  item_count: number
  required_item_count: number
  complete_scan_ready: boolean
  blockers: ReadinessBlocker[]
}

export interface Finding {
  id: string
  title: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  status: 'open' | 'triaging' | 'confirmed' | 'fixed' | 'false_positive' | 'reopened'
  scan_point_key: string
  rule_version_id: string
  repository_name: string
  module_name?: string
  file_path: string
  line_start?: number
  line_end?: number
  branch: string
  first_commit_sha: string
  latest_commit_sha: string
  occurrence_count: number
  closure_candidate: boolean
  authority: ResultAuthority
  latest_verification_outcome?: VerificationOutcome
  updated_at: string
}

export interface FindingOccurrence {
  id: string
  finding_id: string
  run_id: string
  scope_id: string
  fingerprint: string
  file_path?: string | null
  symbol_name?: string | null
  line_no?: number | null
  commit_sha: string
  evidence: unknown
  authoritative: boolean
  lifecycle_applied: boolean
  observed_at: string
}

export interface FindingEvent {
  id: string
  finding_id: string
  event_type: string
  from_value?: string | null
  to_value?: string | null
  related_run_id?: string | null
  comment?: string | null
  operator: string
  created_at?: string | null
}

export type VerificationStatus
  = | 'pending'
    | 'preparing'
    | 'pre_scanning'
    | 'agent_reviewing'
    | 'retry_wait'
    | 'running'
    | 'failed'
    | 'timed_out'
    | 'invalid_output'
    | 'fixed'
    | 'still_present'
    | 'unverifiable'
    | 'cancelled'

export interface DefectVerification {
  id: string
  finding_id: string
  original_run_id: string
  original_commit_sha: string
  new_snapshot_id: string
  new_commit_sha: string
  rule_version_id: string
  scan_point_id: string
  plan_digest: string
  status: VerificationStatus
  result?: VerificationOutcome | null
  closure_candidate: boolean
  attempt_count: number
  evidence: unknown
  error_code?: string | null
  error_message?: string | null
}

export interface VerificationPage {
  items: DefectVerification[]
  total: number
  page: number
  page_size: number
}

export interface VerifyFindingRequest {
  new_snapshot_id: string
  branch_name?: string | null
  ref_name?: string | null
  commit_sha?: string | null
  idempotency_key: string
}

export interface VerificationCommandRequest {
  idempotency_key: string
  reason?: string | null
}

export interface VerificationCommandReceipt {
  verification_id: string
  finding_id: string
  status: string
  attempt_id?: string | null
  attempt_no: number
  idempotent_replay: boolean
  plan_digest: string
}

// ── 预扫描相关类型 ──────────────────────────────────

export interface ModuleWithRepository {
  relation_id: string
  module_id: string
  module_name: string
  module_code: string
  repository_id: string
  repository_name: string
  repository_code: string
  git_url: string
  default_branch: string
  root_path: string
  scan_enabled: boolean
  status: string
  project_group_id: string
  project_group_name: string
  business_area: string
  product_domain: string
}

export interface ScanPointTreeNode {
  label: string
  value: string
  level: 'domain' | 'category' | 'scan_point'
  rule_count: number
  children: ScanPointTreeNode[]
}

export interface PrescanTriggerRequest {
  repository_id: string
  snapshot_id?: string | null
  rule_set_id?: string | null
  domains?: string | null
  branch?: string | null
  commit_sha?: string | null
  scan_mode?: string // 'full' | 'diff'
  base_commit?: string | null
  diff_granularity?: string | null // 'file' | 'hunk'
  force?: boolean
}

export interface PrescanTriggerResponse {
  run_id: string
  status: string
  idempotent: boolean
}

export interface PrescanStatusResponse {
  run_id: string
  repository_id: string
  status: string
  total_files: number
  total_loc: number
  total_candidates: number
  input_digest: string
  error_message?: string | null
  started_at?: string | null
  finished_at?: string | null
  created_at: string
}

export interface DashboardOverview {
  run_id: string
  status: string
  total_files: number
  total_loc: number
  total_candidates: number
  ai_confirmed: number
  ai_rejected: number
  ai_pending: number
  ai_error: number
  risk_high: number
  risk_medium: number
  risk_low: number
  risk_info: number
}

export interface AppRiskRow {
  repository_id: string
  repository_name: string
  module_name: string
  run_id: string
  confirmed: number
  risk_high: number
  risk_medium: number
  risk_low: number
  scanned_at: string
}

export interface DomainCount {
  domain: string
  confirmed: number
}

export interface GlobalOverview {
  total_apps: number
  scanned_apps: number
  total_confirmed: number
  total_risk_high: number
  total_risk_medium: number
  total_risk_low: number
  total_pending: number
  total_error: number
  top_apps: AppRiskRow[]
  all_apps: AppRiskRow[]
  domain_distribution: DomainCount[]
}

export interface ScanPointSummaryRow {
  scan_point_id: string
  domain: string
  category: string
  scan_point_name: string
  candidate_count: number
  file_count: number
  ai_confirmed: number
  ai_rejected: number
  risk_high: number
  risk_medium: number
  risk_low: number
}

export interface CandidateDetailRow {
  id: string
  rule_version_id: string
  scan_point_id: string
  domain: string
  category: string
  file_path: string
  start_line?: number | null
  matched_text?: string | null
  ai_status: string
  ai_risk_level?: string | null
  ai_rationale?: string | null
  ai_confidence?: number | null
  ai_mode?: string | null
  ai_model?: string | null
  ai_detail_report?: string | null
}

export interface CandidateDetailPage {
  list: CandidateDetailRow[]
  total: number
}

/** 规则维度聚合统计行（扫描结果详情左树） */
export interface RuleStatRow {
  rule_version_id: string
  rule_name: string
  scan_point_id: string
  scan_point_name: string
  domain: string
  category: string
  total: number
  confirmed: number
  rejected: number
  pending: number
  error: number
  review_needed: number
}

/** 缺陷规则维度聚合行（缺陷页左树） */
export interface IssueRuleStatRow {
  rule_version_id: string
  rule_name: string
  scan_point_id: string
  scan_point_name: string
  domain: string
  category: string
  total: number
  open: number
  fixing: number
  fixed: number
  wont_fix: number
}

/** 白名单规则维度聚合行（白名单页左树） */
export interface WaiverRuleStatRow {
  rule_version_id: string
  rule_name: string
  scan_point_id: string
  scan_point_name: string
  domain: string
  category: string
  total: number
  active: number
  pending: number
}

/** 扫描问题行（确认候选回写生成，缺陷页数据源） */
export interface ScanIssueRow {
  id: string
  fingerprint: string
  repository_id: string
  rule_version_id: string
  domain: string
  category: string
  title: string
  file_path: string
  start_line?: number | null
  branch?: string | null
  hit_count: number
  risk_level?: string | null
  status: string
  assignee?: string | null
  ai_detail_report?: string | null
  created_at: string
  updated_at: string
}

export interface ScanIssuePage {
  list: ScanIssueRow[]
  total: number
}

/** 问题状态变更历史行（流转记录） */
export interface ScanIssueEventRow {
  id: string
  issue_id: string
  event_type: string
  from_status?: string | null
  to_status?: string | null
  reason?: string | null
  operator?: string | null
  commit_sha?: string | null
  created_at: string
}

/** 问题验证结果（一键重新验证） */
export interface IssueVerifyResult {
  issue_id: string
  /** 验证后状态：fixed / verification_failed */
  new_status: string
  /** 是否仍命中该 fingerprint */
  still_hit: boolean
  branch?: string | null
  commit_sha?: string | null
  message: string
}

export interface CodeTreeNode {
  label: string
  path: string
  candidate_count: number
  children: CodeTreeNode[]
}

export interface AiConfirmRequest {
  run_id: string
  scope?: string
  /** AI 确认模式：batch（平台编排批量，默认）/ agent（Agent 自主审计） */
  mode?: string
  /** AI 模型标识（如 Qwen3.8-Max-Preview / GLM-5.2 / Kimi-K3），空则用 Agent 默认模型 */
  model?: string | null
}

export interface AiConfirmResponse {
  total_pending: number
  confirmed_now: number
  message: string
}

/** Agent 自主审计进度（/prescan/agent-status） */
export interface AgentRunProgress {
  run_id: string
  run_status: string
  total: number
  analyzed: number
  confirmed: number
  rejected: number
  review_needed: number
  error: number
  pending: number
}

/** 按模式聚合的对比统计 */
export interface ModeAgg {
  ai_mode: string
  total: number
  confirmed: number
  rejected: number
  review_needed: number
  error: number
  avg_confidence?: number | null
}

/** AI 确认效果对比（/prescan/confirm-compare） */
export interface RunCompare {
  run_id: string
  run_status: string
  by_mode: ModeAgg[]
  duration_ms?: number | null
}

/** 统一扫描运行行（预扫描 + 正式扫描合并展示） */
export interface UnifiedScanRunRow {
  id: string
  source: string
  repository_name: string
  branch?: string | null
  commit_sha?: string | null
  trigger_type?: string | null
  status: string
  candidate_count?: number | null
  confirmed_count?: number | null
  started_at?: string | null
}

/** 跨 Run 横评对比行（多模型 A/B 评测） */
export interface CrossRunAggRow {
  run_id: string
  repository_id: string
  repository_name: string
  branch?: string | null
  commit_sha?: string | null
  created_at: string
  status: string
  ai_model?: string | null
  ai_mode?: string | null
  total: number
  confirmed: number
  rejected: number
  error: number
  pending: number
  /** 兜底对账收敛来的「待人工复核」，与 pending/error 同属"没有有效 AI 结论"，可重跑 */
  review_needed: number
  risk_high: number
  risk_medium: number
  risk_low: number
  avg_confidence?: number | null
  confirm_rate?: number | null
}
