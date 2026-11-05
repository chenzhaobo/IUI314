/**
 * 自动化轮次页 DTO（后端 round.rs / settle.rs 的前端镜像）。
 */

/** mon_audit_round 列 */
export interface RoundModel {
  id: string
  round_no: string
  name: string
  /** created|syncing|synced|partial|settled */
  status: string
  /** manual|pipeline */
  trigger_type: string
  data_since?: string | null
  started_at?: string | null
  synced_at?: string | null
  settled_at?: string | null
  settled_by?: string | null
  stats_json?: string | null
  remark?: string | null
  create_by: string
  created_at?: string | null
  updated_at?: string | null
}

/** 后端 RoundVo（flatten 轮次列 + 批次计数） */
export interface RoundRow extends RoundModel {
  batch_total: number
  batch_success: number
  batch_failed: number
  batch_running: number
}

/** 后端 BatchVo（flatten mon_sync_batch 列 + 同步源信息） */
export interface BatchRow {
  id: string
  round_id: string
  source_id: string
  /** pending|running|success|failed */
  status: string
  /** login|waiting_quiet|fetching|merging|logs|done */
  phase?: string | null
  fetched_count: number
  raw_count: number
  issue_count: number
  new_issue_count: number
  log_total: number
  log_done: number
  error?: string | null
  started_at?: string | null
  finished_at?: string | null
  create_by: string
  created_at?: string | null
  source_code: string
  source_name: string
  env_name: string
  datacenter_name: string
}

/** 后端 RoundDetail */
export interface RoundDetail {
  round: RoundModel
  batches: BatchRow[]
  /** 全部批次已结束 */
  done: boolean
}

/** 后端 SettleStats */
export interface SettleStats {
  hit: number
  new_issues: number
  reproduced: number
  reopened: number
  not_reproduced: number
  failed_batches: number
}

export const SETTLE_LABELS: { key: keyof SettleStats, label: string }[] = [
  { key: 'hit', label: '本轮出现' },
  { key: 'new_issues', label: '新增' },
  { key: 'reproduced', label: '重现' },
  { key: 'reopened', label: '复发重开' },
  { key: 'not_reproduced', label: '未复现' },
  { key: 'failed_batches', label: '失败批次' },
]

/** stats_json → SettleStats；解析失败返回 null */
export function parseSettleStats(raw: string | null | undefined): SettleStats | null {
  if (!raw)
    return null
  try {
    const value: unknown = JSON.parse(raw)
    return value && typeof value === 'object' ? (value as SettleStats) : null
  }
  catch {
    return null
  }
}

export const BATCH_PHASE: Record<string, string> = {
  login: '登录',
  waiting_quiet: '等待静默',
  fetching: '拉取中',
  merging: '归并中',
  logs: '抓日志',
  done: '完成',
}

export const TRIGGER_TYPE: Record<string, string> = {
  manual: '手动',
  pipeline: '流水线',
}

export interface RoundListFilter {
  keyword: string
  status: string
}

export interface RoundCreateForm {
  round_no: string
  name: string
  data_since: string
  remark: string
}

export function emptyRoundCreateForm(): RoundCreateForm {
  return { round_no: '', name: '', data_since: '', remark: '' }
}

/** 详情抽屉自动刷新间隔 */
export const ROUND_POLL_MS = 5000

/** 流水线调用示例（设计文档第 8 节） */
export const PIPELINE_CURL = `# 1. 触发（按 round_no 幂等，重复调用不会重复建批次）
curl -H "Authorization: Bearer ttp_pat_xxx" -H 'Content-Type: application/json' \\
  -d '{"round_no":"2026-11"}' https://<平台>/api/monaudit/round/trigger

# 2. 轮询直到 data.done=true，再还原自动化环境数据库
curl -H "Authorization: Bearer ttp_pat_xxx" \\
  'https://<平台>/api/monaudit/round/status?id=<round_id>'`
