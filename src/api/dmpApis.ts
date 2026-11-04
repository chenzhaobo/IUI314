/**
 * @description: DMP 数据爬取 API
 */

// ── DMP Token / 爬取 / 任务 ──────────────────────────────────────
export enum ApiDmp {
  tokenStatus = '/dmp/token/status',
  tokenSave = '/dmp/token/save',
  crawlStart = '/dmp/crawl/start',
  crawlBatches = '/dmp/crawl/batches',
  crawlStatus = '/dmp/crawl/status',
  crawlData = '/dmp/crawl/data',
  taskList = '/dmp/task/list',
  taskEdit = '/dmp/task/edit',
  taskTrigger = '/dmp/task/trigger',
  taskAdd = '/dmp/task/add',
  taskDelete = '/dmp/task/delete',
}

// ── 类型定义 ──────────────────────────────────────

/** 分页返回结构 */
export interface DmpListResult<T> {
  list: T[]
  total: number
  total_pages: number
  page_num: number
}

/** Token 状态 */
export interface DmpTokenStatus {
  configured: boolean
  status: string | null
  updated_at: string | null
  masked_token: string | null
}

/** 爬取任务配置 */
export interface DmpCrawlTask {
  id: string
  target_key: string
  name: string
  cloud: string
  app: string
  menu1: string
  menu2: string
  sync_mode: string
  schedule_enabled: string
  schedule_type: string | null
  schedule_cron: string | null
  last_scheduled_at: string | null
  is_preset: string
  description: string | null
  status: string
  sort_order: number
  target_table: string | null
  field_mapping: Record<string, string> | null
  upsert_key: string | null
  etl_enabled: string
  sync_type: string
  filter_config: Record<string, unknown> | null
  retention_days: number | null
  /** 单次爬取最多写入行数（源端更多时会被截断） */
  max_rows: number
  /** 翻页大小 */
  page_size: number
}

/** 爬取批次 */
export interface DmpCrawlBatch {
  id: string
  task_id: string | null
  menu_path: string | null
  status: string
  total_count: number
  /** 源端报告的总行数；大于 total_count 说明本次写入被截断 */
  source_total: number | null
  error_msg: string | null
  create_by: string
  created_at: string | null
  finished_at: string | null
}

/** 批次状态简要（轮询用） */
export interface DmpBatchBrief {
  id: string
  status: string
  total_count: number
  source_total: number | null
  error_msg: string | null
}

/** 爬取数据行 */
export interface DmpCrawlData {
  id: string
  batch_id: string
  raw_json: Record<string, unknown>
  created_at: string | null
}
