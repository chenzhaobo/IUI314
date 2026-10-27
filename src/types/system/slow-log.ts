import type { pageData, pageQueryParam } from '../base/apis'

export interface slowRequestLog {
  request_id: string
  trace_id: string
  request_method: string
  request_path: string
  normalized_path?: string | null
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
  request_id?: string
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

export interface slowPathStat {
  path: string
  count: number
  avg_elapsed_ms: number
  max_elapsed_ms: number
}

export interface slowRequestOverview {
  total_24h: number
  total_7d: number
  avg_elapsed_ms_24h: number
  max_elapsed_ms_24h: number
  top_paths: slowPathStat[]
}

export interface slowSqlHashStat {
  sql_hash: string
  sql_summary: string
  count: number
  avg_elapsed_ms: number
  max_elapsed_ms: number
  last_seen: string
}

export interface slowSqlOverview {
  total_24h: number
  total_7d: number
  distinct_sql_24h: number
  avg_elapsed_ms_24h: number
  max_elapsed_ms_24h: number
  top_sql: slowSqlHashStat[]
}

export interface slowSqlLogQueryParam extends pageQueryParam {
  slow_sql_id?: string
  trace_id?: string
  request_path?: string
  source?: string
  sql_hash?: string
  min_elapsed_ms?: number | string
}
