/**
 * 「新建扫描」模块的 DTO 与状态类型（迁自 scan-dashboard.vue 的预扫描弹窗）。
 *
 * 分层：本文件只放类型，展示用纯函数/中文标签在 ./labels，接口调用在 ./service，
 * 状态机在 ./useNewScan 与 ./useAiConfirm（View → Composable → Service → Api）。
 */

/** 扫描范围：整仓 / 表单资产 / 微服务资产（过渡期旧轨的三条触发路径） */
export type ScanTargetType = 'repository' | 'form' | 'microservice'

/**
 * 扫描方式（006）：unified = 统一扫描（默认；整仓全量 + 自动选取全部在用表单/微服务资产，单 run）；
 * legacy = 过渡期旧轨（上面三种 ScanTargetType，验收通过后下线）。
 */
export type ScanMode = 'unified' | 'legacy'

/** 统一扫描触发请求体（POST /sechub/prescan/unified-trigger） */
export interface UnifiedTriggerRequest {
  repository_id: string
  rule_set_id?: string
  force: boolean
}

/** 统一扫描触发响应 */
export interface UnifiedTriggerResponse {
  run_id: string
  status: string
  idempotent: boolean
  /** 自动选中的资产数 */
  assets: { form: number, microservice: number }
}

/** 统一扫描预览（GET /sechub/prescan/unified-preview）：blocked_reason 非空时不可提交 */
export interface UnifiedPreview {
  form_assets: number
  microservice_assets: number
  form_sync_run_id?: string | null
  microservice_sync_run_id?: string | null
  blocked_reason?: string | null
}

/** 差量向导的扫描策略（原样透传给后端 requested_delta_kind） */
export type DeltaScanMode
  = | 'auto_delta'
    | 'code_delta'
    | 'rule_delta'
    | 'hybrid_delta'
    | 'full_baseline'
    | 'reconfirm'
    | 'hunk_quick'

/** 差量基准：自动选可信基线 / 指定基准 commit */
export type ScanScope = 'diff_last' | 'diff_commit'

/**
 * 差量粒度。
 *
 * **当前"设了不发"**：向导里的 `diffGranularity` 状态没有任何读取点 ——
 * 真正发给后端的 `diff_granularity` 由扫描策略推导（hunk_quick → hunk，其余 → file，
 * 见 DeltaPreviewRequest）。迁移时保持原样不动（请求载荷逐字段不变），
 * 待后续统一治理时再决定删状态还是接线。
 */
export type DiffGranularity = 'file' | 'hunk'

/** 估算区间（乐观..保守） */
export interface EstimateRange {
  lower: number
  upper: number
}

/** 冻结计划预览（POST /sechub/static-prescan/delta/preview 的响应） */
export interface DeltaPlanPreview {
  plan_id: string
  delta_kind: string
  /** 本次预览是否复用了已存在的相同规格未冻结计划（true 时没有新建 run/计划） */
  reused?: boolean
  base_commit?: string | null
  target_commit?: string | null
  added_files: number
  modified_files: number
  deleted_files: number
  renamed_files: number
  copied_files: number
  direct_file_count: number
  impacted_file_count: number
  call_graph_truncated: boolean
  /** 目标清单是否带资产维度（仓库级计划只有规则快照，资产计数恒 0） */
  has_asset_manifest: boolean
  affected_form_count: number
  affected_microservice_count: number
  added_rule_count: number
  modified_rule_count: number
  removed_rule_count: number
  deterministic_pair_count: EstimateRange
  candidate_count: EstimateRange
  cache_hit_count: EstimateRange
  cache_miss_count: EstimateRange
  cache_not_eligible_count: EstimateRange
  ai_call_count: EstimateRange
  token_count: EstimateRange
  estimate_basis: string[]
  may_auto_close: boolean
  auto_close_block_reasons: string[]
}

/** 预览面板的一行：指标 / 取值 / 口径说明 */
export interface DeltaPreviewRow {
  key: string
  label: string
  value: string
  hint?: string
}

/** 自动关闭资格提示（null = 有资格或还没有预览，无需提示） */
export interface AutoCloseAlert {
  type: 'info' | 'warning'
  title: string
  detail: string
}

/** 差量预览请求体（字段与迁移前逐字段一致；空值走 undefined，JSON 序列化时整键消失） */
export interface DeltaPreviewRequest {
  repository_id: string
  requested_delta_kind: DeltaScanMode
  rule_set_id?: string
  branch?: string
  commit_sha?: string
  scan_mode: 'full' | 'diff'
  base_commit?: string
  diff_granularity: DiffGranularity
  force: boolean
}

/** 整仓（含反编译源码库）全量扫描请求体 */
export interface FullTriggerRequest {
  repository_id: string
  scan_mode: 'full'
  rule_set_id?: string
  force: boolean
}

/** 领域资产（表单/微服务）扫描请求体 */
export interface DomainTriggerRequest {
  scope_type: 'form' | 'microservice'
  asset_ids: string[]
  include_ambiguous: boolean
}

/**
 * AI 确认请求体。
 * 比 `@/types/static-scan` 的 AiConfirmRequest 多 agent_code / skill_code
 * （Agent 自主模式与指定扫描技能），故此模块自带一份。
 */
export interface AiConfirmBody {
  run_id: string
  scope: 'all'
  mode: 'batch' | 'agent'
  model?: string
  agent_code?: string
  skill_code?: string
}

/** 打开新建扫描弹窗时的预填参数（运行页默认仓库 / 资产详情跳转的 query） */
export interface NewScanOpenOptions {
  /** 默认选中的仓库 id */
  repositoryId?: string
  /**
   * 锁定仓库：左侧应用范围树选中某个仓库后打开弹窗时带上，
   * 弹窗里的仓库下拉禁用、不允许改选（弹窗展示的就是左树选定的范围）。
   */
  lockRepository?: boolean
  /** 预置扫描范围（资产详情跳转时带表单/微服务） */
  scanTargetType?: ScanTargetType
  /** 预选资产 id（不在当前仓库可扫描范围内时会被忽略） */
  assetIds?: string[]
}

/** 仓库下拉选项（/sechub/module/repositories-with-module 的子集，含本地仓） */
export interface RepoOption {
  module_id: string
  relation_id: string
  module_name: string
  repository_id: string
  repository_name: string
  default_branch: string
  git_url: string
}

/** 资产多选项（禁用 = 与已选资产的同步批次不一致） */
export interface AssetOption {
  value: string
  label: string
  fileCount: number
  disabled: boolean
}
