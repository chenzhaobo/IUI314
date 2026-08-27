/**
 * 预扫描定时任务相关类型定义
 */

/** 预扫描任务行（列表/详情响应体） */
export interface PrescanTaskRow {
  id: string
  name: string
  repository_ids: string[]
  repository_names: string[]
  domains?: string | null
  /** 扫描策略：full（全量）| diff（增量） */
  scan_mode: string
  cron_expression?: string | null
  /** 调度启用：'0' 关闭 | '1' 开启 */
  schedule_enabled: string
  concurrency: number
  /** 自动 AI 确认：'0' 关闭 | '1' 开启 */
  auto_confirm: string
  /** AI 模式：batch（平台编排）| agent（自主审计） */
  ai_mode: string
  ai_model?: string | null
  ai_agent_code?: string | null
  /** 任务状态：'0' 停用 | '1' 启用 */
  status: string
  last_scheduled_at?: string | null
  next_run_at?: string | null
  created_at: string
}

/** 预扫描任务执行记录行 */
export interface PrescanTaskRecordRow {
  id: string
  task_id: string
  repository_id: string
  repository_name?: string | null
  prescan_run_id?: string | null
  branch?: string | null
  commit_sha?: string | null
  status: string
  candidate_count: number
  confirmed_count: number
  ai_status?: string | null
  /** 幂等跳过标记：'1' 表示代码未变更已跳过 */
  idempotent: string
  error_message?: string | null
  started_at?: string | null
  finished_at?: string | null
  created_at: string
}

/** 新增/编辑任务的提交体 */
export interface PrescanTaskSavePayload {
  id?: string
  name: string
  repository_ids: string[]
  domains?: string | null
  scan_mode: string
  cron_expression?: string | null
  schedule_enabled: string
  concurrency: number
  auto_confirm: string
  ai_mode: string
  ai_model?: string | null
  ai_agent_code?: string | null
  status: string
}

/** 删除/触发提交体 */
export interface PrescanTaskIdPayload {
  id: string
}

/**
 * 触发响应体：后端 `POST /sechub/prescan/task-trigger` 返回本次成功触发的
 * 预扫描 run_id 数组（每个仓库一个），数组长度即触发的仓库数。
 */
export type PrescanTaskTriggerResponse = string[]
