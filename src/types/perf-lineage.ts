/**
 * 问题台账谱系的类型（后端 `pattern/lineage`、`pattern/report-md` 的 versions）。
 *
 * 每日归因反复命中同一批问题时，平台按「能否被同一个修复关掉」决定原地更新还是新建：
 * 原地更新留变更记录（含变更前快照与旧报告路径），新建则记与原台账的关系。
 */

/** 与关联台账的关系：同族 / 修复后残留 / 拆分 / 重复 */
export type PatternRelationType = 'sibling' | 'derived' | 'split' | 'duplicate'

/** 关联台账的摘要 */
export interface LineageBrief {
  id: string
  pattern_no: string
  title: string
  status: string
  form_id: string
  relation_type?: PatternRelationType | string | null
  relation_label?: string | null
  issue_id?: string | null
}

/** 一条结论变更记录（新的在前） */
export interface PatternChangeEntry {
  /** refine / supersede / recheck / reanalysis / merged / derived / split / duplicate / trend / regression */
  kind: string
  at: string
  /** attribution:<日期> / reanalysis:<id> / manual:<操作人> */
  source: string
  note?: string
  related_pattern_no?: string
  // 变更前快照（只有改写结论的记录才有）
  title?: string
  ai_summary?: string
  attribution_tag?: string
  involved_object?: string
  /** 变更前的报告路径数组 */
  evidence?: unknown
}

export interface PatternLineage {
  pattern_no: string
  relation_type?: PatternRelationType | string | null
  relation_label?: string | null
  /** 本台账指向的上游台账 */
  related?: LineageBrief | null
  /** 指向本台账的下游台账（派生 / 拆分 / 重复 / 同族） */
  children: LineageBrief[]
  /** 同维度同指纹（标签+对象相同）的其他台账数 */
  family_count: number
  change_log: PatternChangeEntry[]
}

/** 报告版本（`pattern/report-md` 返回体的 versions 元素） */
export interface PatternReportVersion {
  file: string
  current: boolean
  replaced_at?: string
  kind?: string
  note?: string
}

/** 定位一条台账：台账 id/编号 或 问题 issue_no/id，给其一 */
export interface LineageTarget {
  patternId?: string
  issue?: string
}
