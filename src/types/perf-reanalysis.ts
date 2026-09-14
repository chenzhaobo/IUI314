/**
 * 问题台账「再次分析」（追加分析）的类型。
 *
 * 归因是一次性的 AI 判断，判错了原来没有回路。人工带着方向或质疑要求复核一次，
 * AI 重新读原始日志与报告后给出三种结论之一，见 {@link ReanalysisDecision}。
 */

/** 复核任务状态。running 期间前端轮询。 */
export type ReanalysisStatus = 'running' | 'succeeded' | 'failed'

/**
 * AI 复核结论。
 *
 * `reject` 是正当结论而不是失败 —— 原结论对的时候说它对，比编一个改动有价值。
 */
export type ReanalysisDecision = 'update' | 'create' | 'reject'

/** 一条追加分析记录（后端 `pattern/reanalysis/history` 的元素）。 */
export interface ReanalysisRecord {
  id: string
  /** 人工写的方向或质疑 */
  challenge: string
  /** 提交人显示名 */
  challenger_name?: string
  status: ReanalysisStatus | string
  decision?: ReanalysisDecision | string
  /** AI 给出的判断理由 */
  decision_reason?: string
  /** decision=create 时新拆出的台账 id */
  result_pattern_id?: string
  error_message?: string
  /** 送检的原始日志文件名 */
  input_log_files?: string[]
  /** 是否把报告全文一起送检 */
  input_report_md?: boolean
  created_at?: string
}

/** 结论在界面上的呈现（颜色 + 文案）。 */
export interface ReanalysisDecisionMeta {
  color: string
  text: string
}

/**
 * 定位一条台账的方式，二者给其一。
 *
 * 问题列表那边手里只有问题（issue）没有台账 id，后端用同一套键解析
 * （`resolve_pattern_key`：台账 id / pattern_no / issue_no / issue id），
 * 所以两个页面能共用同一个入口。
 */
export interface ReanalysisTarget {
  /** 台账行 id 或 pattern_no */
  patternId?: string
  /** 问题的 issue_no 或 id */
  issue?: string
}
