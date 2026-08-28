/**
 * @description: AI 中心 API
 */

// ── Agent 管理 ──────────────────────────────────────
export enum ApiAiAgent {
  getList = '/ai/agent/list',
  getById = '/ai/agent/get_by_id',
  add = '/ai/agent/add',
  edit = '/ai/agent/edit',
  delete = '/ai/agent/delete',
  healthCheck = '/ai/agent/health_check',
  syncModels = '/ai/agent/sync_models',
}

// ── Skill 管理 ──────────────────────────────────────
export enum ApiAiSkill {
  getList = '/ai/skill/list',
  getById = '/ai/skill/get_by_id',
  add = '/ai/skill/add',
  edit = '/ai/skill/edit',
  delete = '/ai/skill/delete',
  test = '/ai/skill/test',
  fileUpload = '/ai/skill/file/upload',
  fileList = '/ai/skill/file/list',
  fileDelete = '/ai/skill/file/delete',
  deploy = '/ai/skill/deploy',
  deployStatus = '/ai/skill/deploy-status',
}

// ── Skill 部署状态 ──────────────────────────────────────
export interface AiSkillDeployStatus {
  skill_id: string
  skill_code: string
  state: 'deployed' | 'not_deployed' | 'stale'
  deployed_dir: string | null
  stale_files: string[]
}

// ── 执行记录 ──────────────────────────────────────
export enum ApiAiExecution {
  getList = '/ai/execution/list',
  getById = '/ai/execution/get_by_id',
  cancel = '/ai/execution/cancel',
  batchDelete = '/ai/execution/batch-delete',
  stats = '/ai/execution/stats',
}

// ── 统一调用 ──────────────────────────────────────
export enum ApiAiInvoke {
  invoke = '/ai/invoke',
  result = '/ai/invoke/result',
}

// ── 智能助手配置 ──────────────────────────────────
export enum ApiBotConfig {
  list = '/notification/bot/config/list',
  update = '/notification/bot/config/update',
  accessList = '/notification/bot/access/list',
  accessAdd = '/notification/bot/access/add',
  accessRemove = '/notification/bot/access/remove',
}

export interface BotConfigItem {
  id: string
  config_key: string
  config_value: string
  description: string | null
  updated_at: string | null
}

export interface BotUserAccess {
  id: string
  user_identifier: string
  user_name: string | null
  access_type: string
  remark: string | null
  created_at: string | null
}

// ── 类型定义 ──────────────────────────────────────
export interface AgentModelSyncResult {
  agent_id: string
  agent_code: string
  cli_kind: 'qoder' | 'kiro'
  models: string[]
  model_count: number
  default_model: string
  recommended_invoke_template: string
  invoke_template_updated: boolean
  config_updated_at: string
}

export interface AiAgent {
  id: string
  agent_code: string
  agent_name: string
  executable_path: string
  invoke_template: string
  supported_models_json: string | null
  default_model: string | null
  max_timeout_secs: number
  max_concurrent: number
  health_check_cmd: string | null
  skill_mount_path: string | null
  status: string
  remark: string | null
  created_at: string
  updated_at: string
}

export interface AiSkill {
  id: string
  skill_code: string
  skill_name: string
  description: string | null
  agent_id: string | null
  prompt_template: string
  work_dir_type: string
  work_dir_path: string | null
  required_env_json: string | null
  input_schema_json: string | null
  output_format: string
  output_path_pattern: string | null
  tags_json: string | null
  version: number
  status: string
  remark: string | null
  created_at: string
  updated_at: string
}

export interface AiExecution {
  id: string
  agent_id: string
  skill_id: string | null
  caller_module: string
  caller_id: string | null
  session_id: string | null
  parent_execution_id: string | null
  work_dir: string | null
  rendered_prompt: string | null
  raw_command: string | null
  input_json: string | null
  output_json: string | null
  output_files_json: string | null
  exit_code: number | null
  duration_ms: number | null
  status: string
  error_message: string | null
  created_by: string | null
  created_at: string
  started_at: string | null
  finished_at: string | null
}

export interface AiInvokeRequest {
  agent_code: string
  skill_code?: string | null
  prompt?: string | null
  caller_module: string
  caller_id?: string | null
  variables?: Record<string, unknown> | null
  session_id?: string | null
  work_dir_override?: string | null
  model_override?: string | null
  timeout_secs?: number | null
}

export interface AiInvokeResponse {
  execution_id: string
  status: string
  output_json: unknown
  output_files: { path: string, size_bytes: number }[]
  session_id: string | null
  duration_ms: number
  error_message: string | null
}

export interface AiExecutionStats {
  total: number
  succeeded: number
  failed: number
  running: number
  success_rate: number
  avg_duration_ms: number
}

export interface AiListResult<T> {
  list: T[]
  total: number
  total_pages: number
  page_num: number
}

export interface AiSkillFile {
  id: string
  skill_id: string
  file_name: string
  file_path: string
  file_size: number
  content_type: string | null
  uploaded_by: string | null
  created_at: string
}
