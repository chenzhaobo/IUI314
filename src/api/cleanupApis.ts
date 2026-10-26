export enum ApiCleanup {
  policies = '/system/cleanup/policies',
  policy = '/system/cleanup/policies/{id}',
  preview = '/system/cleanup/preview',
  run = '/system/cleanup/run',
  runs = '/system/cleanup/runs',
}

export function resolveCleanupApi(path: string, params: Readonly<Record<string, string>>): string {
  return Object.entries(params).reduce(
    (resolved, [key, value]) => resolved.replace(`{${key}}`, encodeURIComponent(value)),
    path,
  )
}

export interface CleanupPolicy {
  id: string
  category: string
  domain: string
  label: string
  retention_days: number
  keep_latest: number
  batch_size: number
  max_items_per_run: number
  enabled: string
  dry_run: string
  description?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export interface CleanupRun {
  id: string
  policy_id?: string | null
  category: string
  trigger_mode: string
  dry_run: string
  status: string
  scanned_count: number
  deleted_count: number
  skipped_count: number
  freed_bytes: number
  error_message?: string | null
  started_at?: string | null
  finished_at?: string | null
  created_at?: string | null
}

export interface CleanupPreview {
  category: string
  scanned: number
  deleted: number
  skipped: number
  freed_bytes: number
  dry_run: boolean
}
