/**
 * 问题台账与缺陷的流转记录（后端 `pattern/flow`）。
 *
 * 台账事件（source=pattern）与缺陷流转记录（source=issue）合成一条时间线，新的在前。
 * 参照静态扫描缺陷的流转记录：每条都有谁、何时、从什么到什么、为什么。
 */

/** 时间线上的一条 */
export interface FlowItem {
  /** pattern = 台账事件；issue = 缺陷流转 */
  source: 'pattern' | 'issue'
  id: string
  /**
   * 台账：created / triage / restored / issued / linked / discarded / attribution_edited /
   * duplicate / duplicate_cancel / regression / status_change
   * 缺陷：created / process / status_change / recheck / regression / note
   */
  event_type: string
  /** 台账状态，或缺陷的内部处理进度 */
  from_status?: string | null
  to_status?: string | null
  /** 缺陷的生产侧状态（recurring / observing / resolved / excluded） */
  from_issue_status?: string | null
  to_issue_status?: string | null
  from_owner?: string | null
  to_owner?: string | null
  from_project_group?: string | null
  to_project_group?: string | null
  wontfix_type?: string | null
  reason?: string | null
  operator?: string | null
  issue_id?: string | null
  meta?: Record<string, unknown> | null
  created_at: string
}

/** 定位：台账 id/编号 或 缺陷 issue_no/id，给其一 */
export interface FlowTarget {
  patternId?: string
  issue?: string
}
