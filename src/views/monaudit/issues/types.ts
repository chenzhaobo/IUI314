/**
 * 问题清单页 DTO 与筛选口径（后端 issue.rs / issue_action.rs 的前端镜像）。
 */

/** 后端 IssueVo */
export interface IssueRow {
  id: string
  fingerprint: string
  audit_type: string
  audit_type_label: string
  domain?: string | null
  invoke_class?: string | null
  op_anchor?: string | null
  title: string
  threshold?: number | null
  max_act_value?: number | null
  last_act_value?: number | null
  level?: string | null
  project_group_id?: string | null
  project_group_name?: string | null
  business_area?: string | null
  /** auto（映射）| manual（人工归类） */
  assign_source: string
  handler_id?: string | null
  handler_name?: string | null
  status: string
  repro_state: string
  coverage_state: string
  first_seen_at?: string | null
  last_seen_at?: string | null
  hit_rounds: number
  miss_rounds: number
  plan_finish_date?: string | null
  story_no?: string | null
  defect_code?: string | null
  handle_note?: string | null
  close_reason?: string | null
  overdue: boolean
  version: number
  updated_at?: string | null
}

/** 样例 traceId（后端 SampleTrace） */
export interface SampleTrace {
  trace_id: string
  act_value?: number | null
  src_created_at?: string | null
}

/** 后端 OccurrenceVo */
export interface OccurrenceRow {
  round_id: string
  round_no: string
  source_id: string
  source_name: string
  raw_count: number
  max_act_value?: number | null
  samples: SampleTrace[]
  last_src_created_at?: string | null
}

/** 后端 RawSampleVo */
export interface RawSampleRow {
  id: string
  source_name: string
  src_number?: string | null
  src_identity?: string | null
  act_value?: number | null
  threshold?: number | null
  trace_id?: string | null
  invoke_param?: string | null
  audit_log?: string | null
  src_created_at?: string | null
}

/** 后端 mon_issue_event::Model */
export interface IssueEventRow {
  id: string
  issue_id: string
  round_id?: string | null
  event_type: string
  from_value?: string | null
  to_value?: string | null
  detail?: string | null
  operator: string
  operator_name?: string | null
  created_at?: string | null
}

/** 后端 TraceLogVo（status: pending|ok|empty|failed|expired） */
export interface TraceLogRow {
  id: string
  source_id: string
  trace_id: string
  status: string
  line_count: number
  window_start?: string | null
  window_end?: string | null
  error?: string | null
  fetched_at?: string | null
}

/** 后端 IssueDetail */
export interface IssueDetail {
  issue: IssueRow
  fp_anchor?: string | null
  can_handle: boolean
  can_suppress: boolean
  occurrences: OccurrenceRow[]
  raw_samples: RawSampleRow[]
  events: IssueEventRow[]
  trace_logs: TraceLogRow[]
}

/** Monitor 日志行：原样 JSON，常见字段见 LOG_COLUMNS */
export type TraceLogLine = Record<string, unknown>

/** 左树节点计数 */
export interface ScopeCounts {
  total: number
  focus: number
}

/** 左树节点写回列表的范围；`__none__` 表示未归类 / 空值 */
export interface IssueScope {
  product_domain?: string
  business_area?: string
  project_group?: string
  app_number?: string
  handler?: string
  rule_code?: string
}

/** 后端 ScopeTreeNode */
export interface ScopeTreeNode {
  key: string
  title: string
  level: string
  counts: ScopeCounts
  scope: IssueScope
  children: ScopeTreeNode[]
}

export type ScopeMode = 'project_group' | 'business_area' | 'product_domain' | 'handler' | 'rule'

export const SCOPE_MODES: { value: ScopeMode, label: string }[] = [
  { value: 'project_group', label: '项目组' },
  { value: 'business_area', label: '业务领域' },
  { value: 'product_domain', label: '产品领域' },
  { value: 'handler', label: '处理人' },
  { value: 'rule', label: '审计类型' },
]

/** 右侧筛选（不含左树范围与分页） */
export interface IssueFilter {
  round_id: string
  source_id: string
  audit_type: string[]
  status: string[]
  repro_state: string
  level: string
  /** '1' = 仅超期 */
  overdue: string
  keyword: string
}

export function emptyIssueFilter(): IssueFilter {
  return { round_id: '', source_id: '', audit_type: [], status: [], repro_state: '', level: '', overdue: '', keyword: '' }
}

export const ISSUE_PAGE_SIZE = 20

/** 状态流转动作 */
export type TransitionAction = 'start' | 'fix' | 'close' | 'wont_fix' | 'false_positive' | 'reopen'

export interface TransitionMeta {
  value: TransitionAction
  label: string
  /** 需填写原因 */
  needReason: boolean
  /** 需架构师 / 总监权限（can_suppress） */
  suppress: boolean
}

export const TRANSITIONS: TransitionMeta[] = [
  { value: 'start', label: '开始处理', needReason: false, suppress: false },
  { value: 'fix', label: '标记已修复', needReason: false, suppress: false },
  { value: 'close', label: '关闭', needReason: true, suppress: false },
  { value: 'wont_fix', label: '不处理', needReason: true, suppress: true },
  { value: 'false_positive', label: '误报', needReason: true, suppress: true },
  { value: 'reopen', label: '重开', needReason: false, suppress: false },
]

export function transitionMeta(action: TransitionAction): TransitionMeta {
  return TRANSITIONS.find(t => t.value === action) ?? TRANSITIONS[0]
}

/** 处理信息表单（单条编辑 / 批量填写共用） */
export interface HandleForm {
  plan_finish_date: string
  story_no: string
  defect_code: string
  handle_note: string
}

export function emptyHandleForm(): HandleForm {
  return { plan_finish_date: '', story_no: '', defect_code: '', handle_note: '' }
}

export function handleFormOf(issue: IssueRow): HandleForm {
  return {
    plan_finish_date: issue.plan_finish_date ?? '',
    story_no: issue.story_no ?? '',
    defect_code: issue.defect_code ?? '',
    handle_note: issue.handle_note ?? '',
  }
}

/** 归类表单 */
export interface ClassifyForm {
  project_group_id: string
  create_mapping: boolean
}

/** 日志弹窗列：Monitor 日志字段 → 表头 */
export const LOG_COLUMNS: { key: string, title: string, width?: number }[] = [
  { key: 'time', title: '时间', width: 190 },
  { key: 'level', title: '级别', width: 70 },
  { key: 'appName', title: '应用', width: 120 },
  { key: 'className', title: '类', width: 220 },
  { key: 'methodName', title: '方法', width: 140 },
  { key: 'message', title: '内容' },
]

/** 日志字段取值：time 兼容 @timestamp；对象字段转 JSON */
export function logField(line: TraceLogLine, key: string): string {
  const raw = key === 'time' ? (line.time ?? line['@timestamp']) : line[key]
  if (raw === null || raw === undefined)
    return ''
  return typeof raw === 'object' ? JSON.stringify(raw) : String(raw)
}

/** 日志抓取状态 */
export const TRACE_LOG_STATUS: Record<string, { label: string, color: string }> = {
  pending: { label: '待抓取', color: 'gray' },
  ok: { label: '已抓取', color: 'green' },
  empty: { label: '无日志', color: 'orange' },
  failed: { label: '失败', color: 'red' },
  expired: { label: '已过期', color: 'gray' },
}

/** 事件类型 */
export const EVENT_TYPE: Record<string, string> = {
  created: '首次发现',
  rehit: '再次出现',
  reopened: '复发重开',
  not_reproduced: '未复现',
  status: '状态变更',
  assign: '分派',
  classify: '归类',
  edit: '编辑',
}

/** 选中行的唯一项目组；跨组 / 未归类返回 null */
export function singleGroupOf(rows: IssueRow[]): string | null {
  const groups = new Set(rows.map(r => r.project_group_id ?? ''))
  if (groups.size !== 1)
    return null
  const [only] = [...groups]
  return only || null
}
