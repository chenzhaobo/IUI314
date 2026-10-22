export interface AgentPipelineStep {
  key: string
  label: string
  status: 'wait' | 'process' | 'finish' | 'error'
}

export interface AgentPipelineGate {
  status: string
  round?: number
  trial_round?: number
  agent?: string | null
  started_at?: string | null
  finished_at?: string | null
}

export interface AgentAudit {
  id?: string
  round: number
  verdict: string
  summary?: string | null
  report_md?: string | null
  metrics?: Record<string, unknown>
  agent?: string | null
  created_at?: string | null
}

export interface AgentJournalItem {
  id: string
  stage: string
  event: string
  status: string
  summary?: string | null
  detail?: Record<string, unknown>
  source: string
  created_at?: string | null
}

export interface AgentPipelineView {
  run_id: string
  pipeline_mode: string
  stage: string
  stage_status: string
  next_action: string
  steps: AgentPipelineStep[]
  gates: Record<string, AgentPipelineGate>
  counts: Record<string, number>
  audit?: AgentAudit | null
  journal: AgentJournalItem[]
}

export interface AgentCandidate {
  api_path: string
  http_method?: string
  dev_mode?: number | string
  thirdapp_auth?: string
  app_number?: string
}

export interface AgentCase {
  id: string
  case_code?: string | null
  title?: string | null
  api_path?: string | null
  http_method?: string | null
  test_type?: string | null
  test_role?: string | null
  assertion?: string | null
  exec_mode?: string | null
  review_status: string
  review_comment?: string | null
  review_round?: number
  reviewer_agent?: string | null
  enabled?: string
}

export interface AgentFinding {
  id: string
  api_path: string
  kind: string
  severity: string
  status: string
  source?: string
  title?: string
  detail?: string | null
  suggestion?: string | null
  target_case_id?: string | null
}

export interface AgentCoverageGap {
  api_path: string
  risk: string
  level: string
  expected_tests?: string[]
  reason?: string
}

export interface AgentTrialRun {
  run_id: string
  run_name: string
  status: string
  total: number
  pass: number
  fail: number
  review: number
  block: number
  error: number
}

export interface AgentResult {
  result_id: string
  case_id: string
  case_code?: string | null
  api_path?: string | null
  verdict: string
  detail?: string | null
  actual_hint?: string | null
  http_status?: number | null
  elapsed_ms?: number | null
  review_verdict?: string | null
  review_comment?: string | null
  review_evidence?: Record<string, unknown>
  review_round?: number
}

export interface AgentDispatch {
  id: string
  run_id: string
  task_id: string
  task_code?: string | null
  task_name?: string | null
  env_id: string
  sec_env_id: string
  dimension: string
  code: string
  candidate_total: number
  case_cnt: number
  approved_cnt: number
  status: string
  failed_reason?: string | null
  pipeline_mode: string
  stage: string
  stage_status: string
  requirements_gate_status: string
  cases_gate_status: string
  cases_gate_round: number
  pre_trial_gate_status: string
  results_gate_status: string
  trial_round: number
  result_review_status: string
  final_audit_status: string
  final_audit_round: number
  finding_cnt: number
  coverage_gap_cnt: number
  report_md?: string | null
}

export interface AgentRunDetail {
  dispatch: AgentDispatch
  candidates: AgentCandidate[]
  cases: AgentCase[]
  findings: AgentFinding[]
  coverage_gaps: AgentCoverageGap[]
  trial_runs: AgentTrialRun[]
  results: AgentResult[]
  pipeline?: AgentPipelineView | null
  audit_history: AgentAudit[]
  report_md?: string | null
}

export interface AgentRunListItem {
  dispatch_id: string
  run_id: string
  task_code?: string | null
  task_name?: string | null
  sec_env_id: string
  dimension: string
  code: string
  status: string
  progress: number
  candidate_total: number
  case_cnt: number
  approved_cnt: number
  trial_pass: number
  trial_fail: number
  finding_cnt: number
  coverage_gap_cnt: number
  pipeline: {
    mode: string
    stage: string
    stage_status: string
    next_action: string
    requirements_gate_status: string
    cases_gate_status: string
    cases_gate_round: number
    pre_trial_gate_status: string
    results_gate_status: string
    trial_round: number
    final_audit_status: string
    final_audit_round: number
  }
  reviewer_status: string
  repair_status: string
  repair_round: number
  result_review_status: string
  failed_reason?: string | null
  created_at?: string | null
}
