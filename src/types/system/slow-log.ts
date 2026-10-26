import type { pageData, pageQueryParam } from '../base/apis'

export interface slowRequestLog {
  request_id: string
  trace_id: string
  request_method: string
  request_path: string
  http_status: number
  elapsed_ms: number
  threshold_ms: number
  user_id?: string | null
  user_name?: string | null
  created_at: string
}

export interface slowRequestLogList extends pageData {
  list: slowRequestLog[]
}

export interface slowRequestLogQueryParam extends pageQueryParam {
  trace_id?: string
  request_method?: string
  request_path?: string
  http_status?: number
  user_name?: string
  min_elapsed_ms?: number | string
}

export interface slowSqlLog {
  slow_sql_id: string
  trace_id?: string | null
  request_path?: string | null
  source: string
  sql_hash: string
  sql_summary: string
  elapsed_ms: number
  threshold_ms: number
  rows_affected: number
  rows_returned: number
  created_at: string
}

export interface slowSqlLogDetail extends slowSqlLog {
  sql_text: string
}

export interface slowSqlLogList extends pageData {
  list: slowSqlLog[]
}

export interface slowSqlLogQueryParam extends pageQueryParam {
  slow_sql_id?: string
  trace_id?: string
  request_path?: string
  source?: string
  sql_hash?: string
  min_elapsed_ms?: number | string
}
