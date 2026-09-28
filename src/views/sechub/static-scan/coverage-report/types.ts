/**
 * 覆盖自证报告的前端类型（后端 `sec_prescan_report.report_type='coverage'` 的 content）。
 *
 * 与后端 `service/src/sechub/static_prescan/coverage_report.rs` 的 serde 结构一一对应；
 * 版本由 `schema` 字段携带（当前 sec-prescan-coverage-report-v1）。后端对
 * `verdict_flips` / `verdict_flips_reason` 打了 `serde(default)`，旧版报告可能没有
 * 这两个键，所以标成可选而不是断言必有。
 */

/** ① 零命中清单的分母口径：本 run 实际加载/执行的规则集从哪来、覆盖多少条 */
export interface CoverageRuleScope {
  rule_set_id: string
  rule_set_key: string
  rule_set_version: number
  /** run 记录的 domains 过滤（已小写去重排序） */
  domains: string[]
  /** full（全规则）/ directed（DELTA-04 定向子集）/ unknown（规则集解析失败） */
  execution_scope: string
  /** 快照解析出的可执行规则数 */
  loaded_rule_count: number
  /** 本 run 实际纳入零命中统计的规则数（directed 时 = 定向子集大小） */
  executed_rule_count: number
  run_rule_snapshot_digest: string | null
  resolved_rule_snapshot_digest: string
  /** false = 规则集在 run 之后被改动过，快照已漂移 */
  snapshot_digest_matches: boolean
  /** 非空时零命中清单为空 —— 规则集不可解析，报告不猜 */
  unavailable_reason: string | null
  /** 差量类型（skip/rule_delta/hybrid_delta/...；全量 run 为空） */
  delta_kind: string | null
}

/** ① 本 run 扫过但零命中的规则 */
export interface ZeroHitRule {
  rule_key: string
  name: string
  version: number
  rule_version_id: string
}

/** ② 候选覆盖台账：判了多少、还剩多少没判 */
export interface CandidateLedger {
  total: number
  /** 候选主表 ai_status 分布（含表外取值，原样计数） */
  ai_status_counts: Record<string, number>
  /** 结论明细 adopted='1' 行的 verdict 分布（AI 结论口径，可与 ai_status 交叉对账） */
  verdict_counts: Record<string, number>
  /** 结论明细行总数（含被更替的历史轮次） */
  verdict_rows_total: number
  confirmed: number
  review_needed: number
  rejected: number
  error: number
  pending: number
  /** 未判定 = error + pending */
  undetermined: number
  /** 已判定 = total - 未判定 */
  determined: number
  undetermined_ratio: number
  /** 未判定非 0 即告警（设计口径：未判定必须非 0 告警） */
  undetermined_warning: boolean
}

/** ③ 单个驳回形态词的命中计数 */
export interface RejectionFormCount {
  form: string
  count: number
  /** 实际命中的线索词（去重排序） */
  matched_keywords: string[]
}

/** ③ 套路化驳回嫌疑（同文案成批出现） */
export interface StereotypeRejection {
  /** 归一化后的驳回文案 */
  rationale: string
  candidate_count: number
  stereotype_suspect: boolean
}

/** ③ 驳回理由聚类结果 */
export interface RejectionClustering {
  rejected_total: number
  /** 形态词命中数；一条 rationale 命中多个形态时各形态分别计数 */
  form_counts: RejectionFormCount[]
  /** rejected 但未命中任何形态词（理由未走套路化表述，需人工看） */
  unclassified: number
  /** rejected 但没有理由文案（连排除理由都没留） */
  missing_rationale: number
  /** 同文案 ≥3 条的套路化嫌疑 */
  stereotype_suspects: StereotypeRejection[]
}

/** ④ 一条结论翻转明细 */
export interface VerdictFlipItem {
  file_path: string
  start_line: number | null
  category: string
  prev_verdict: string
  cur_verdict: string
}

/** ④ 与上一条已产生采信结论的 run 对齐后的结论翻转 */
export interface VerdictFlips {
  /** 基线 run id（同仓库同 target_type 最近一条已确认的 succeeded run） */
  baseline_run_id: string
  /** 两端都已定论的对齐对数（翻转的样本空间） */
  aligned_pairs: number
  /** 结论发生变化的对数（全量，不受明细截断影响） */
  total: number
  /** 翻转方向计数，键形如 `confirmed→rejected`（计数降序、同数按键名升序） */
  by_pair: Record<string, number>
  /** 翻转明细（确认↔驳回翻转优先，后端截断到 50 条） */
  items: VerdictFlipItem[]
}

/** run 覆盖自证报告（schema = sec-prescan-coverage-report-v1） */
export interface CoverageReport {
  schema: string
  run_id: string
  repository_id: string
  generated_at: string
  rule_scope: CoverageRuleScope
  zero_hit_rules: ZeroHitRule[]
  ledger: CandidateLedger
  rejection_forms: RejectionClustering
  /** 无可比基线时为 null（原因见 verdict_flips_reason），旧版报告可能缺键 */
  verdict_flips?: VerdictFlips | null
  verdict_flips_reason?: string | null
  /** 告警：未判定非 0、形态外状态、套路化驳回、规则集不可解析、快照漂移 */
  warnings: string[]
}

/** 分布条的单个分段（由 counts 记录换算，供模板直接渲染） */
export interface DistributionSegment {
  key: string
  label: string
  count: number
  percent: number
  /** 条内色块颜色（CSS 颜色值） */
  color: string
  /** 图例 a-tag 的颜色名 */
  tagColor: string
}
