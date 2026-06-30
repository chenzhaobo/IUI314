/**
 * KD-SecHub 安全测试平台 — TypeScript 类型定义
 */
import type { operateInfo, pageQueryParam } from './base/apis'

// ── 通用查询参数 ────────────────────────────────────
export interface secQueryParam extends pageQueryParam {
  keyword?: string
}

// ── 扫描工具 ────────────────────────────────────────
export interface secScanTool extends operateInfo {
  id?: string
  code?: string
  name?: string
  category?: string
  automation_level?: string
  runner_type?: string
  runner_cmd?: string
  default_params?: string
  credential_code?: string
  docs_url?: string
  order_num?: number
  status?: string
  remark?: string
}

// ── 扫描运行 ────────────────────────────────────────
export interface secScanRun extends operateInfo {
  id?: string
  task_id?: string
  tool_code?: string
  project_group_id?: string
  release_window_id?: string
  run_status?: string
  trigger_type?: string
  trigger_by?: string
  started_at?: string
  finished_at?: string
  duration_sec?: number
  total_findings?: number
  new_findings?: number
  raw_output_url?: string
  error_msg?: string
}

// ── 安全发现 ────────────────────────────────────────
export interface secFinding extends operateInfo {
  id?: string
  first_run_id?: string
  last_run_id?: string
  hit_count?: number
  tool_code?: string
  project_group_id?: string
  release_window_id?: string
  org_id?: string
  severity?: string
  title?: string
  vuln_type?: string
  security_attribute?: string
  file_path?: string
  line_no?: string
  url?: string
  http_method?: string
  param_name?: string
  component?: string
  component_ver?: string
  finger_print?: string
  description?: string
  description_repro?: string
  description_expect?: string
  description_actual?: string
  description_suggestion?: string
  discoverer_names?: string
  assignee_names?: string
  triage_by_names?: string
  finding_status?: string
  false_positive_flag?: string
  first_seen_at?: string
  last_seen_at?: string
  fixed_at?: string
  tags?: string
  source_tools?: string
  ai_review_score?: number
  ai_review_label?: string
  raw_json?: string
}

// ── 缺陷 ────────────────────────────────────────────
export interface secDefect extends operateInfo {
  id?: string
  defect_code?: string
  defect_title?: string
  defect_status?: string
  defect_type?: string
  priority?: string
  project_group_id?: string
  project_group_name?: string
  module_path?: string
  cloud_name?: string
  app_name?: string
  assignee_names?: string
  discoverer_names?: string
  fixer_names?: string
  verifier_names?: string
  iteration_phase?: string
  release_window_id?: string
  release_window_code?: string
  discover_phase?: string
  discovered_at?: string
  fixed_at?: string
  verified_at?: string
  aging_days?: number
  defect_source?: string
  source_no?: string
  defect_tag?: string
  description?: string
  finding_id?: string
  is_security?: string
  security_attribute?: string
}

// ── 组织 ────────────────────────────────────────────
export interface secOrg extends operateInfo {
  id?: string
  pid?: string
  org_type?: string
  name?: string
  code?: string
  full_path?: string
  level_no?: number
  order_num?: number
  status?: string
  remark?: string
}

// ── 项目组 ──────────────────────────────────────────
export interface secProjectGroup extends operateInfo {
  id?: string
  name?: string
  code?: string
  product_group_name?: string
  scrum_team_name?: string
  cloud_name?: string
  business_area?: string
  security_se?: string
  yzj_group_id?: string
  contact_emails?: string
  order_num?: number
  status?: string
  remark?: string
}

// ── 发布窗口 ────────────────────────────────────────
export interface secReleaseWindow extends operateInfo {
  id?: string
  window_code?: string
  window_name?: string
  project_group_id?: string
  start_date?: string
  end_date?: string
  code_freeze_start?: string
  code_freeze_end?: string
  release_date?: string
  status?: string
  remark?: string
}

// ── 扫描任务 ────────────────────────────────────────
export interface secScanTask extends operateInfo {
  id?: string
  task_name?: string
  tool_code?: string
  project_group_id?: string
  release_window_id?: string
  test_env_id?: string
  cron_expr?: string
  params_json?: string
  enabled?: string
  last_run_id?: string
  last_run_at?: string
  remark?: string
}

// ── 测试环境 ────────────────────────────────────────
export interface secTestEnv extends operateInfo {
  id?: string
  env_name?: string
  env_type?: string
  project_group_id?: string
  base_url?: string
  api_prefix?: string
  db_conn_str?: string
  credential_code?: string
  status?: string
  remark?: string
}

// ── 用户故事 ────────────────────────────────────────
export interface secUserStory extends operateInfo {
  id?: string
  story_code?: string
  story_title?: string
  project_group_id?: string
  release_window_id?: string
  story_status?: string
  security_attribute?: string
  threat_model_id?: string
  pia_status?: string
  test_case_count?: number
  finding_count?: number
  defect_count?: number
  remark?: string
}

// ── 删除请求 ────────────────────────────────────────
export interface secDeleteReq {
  ids: string[]
}
