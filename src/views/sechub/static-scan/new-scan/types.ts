/**
 * 「新建扫描」模块的 DTO 与状态类型。
 *
 * 分层：本文件只放类型，展示用纯函数/中文标签在 ./labels，规则树的纯逻辑在 ./ruleScopeTree，
 * 接口调用在 ./service，状态机在 ./useNewScan 与 ./useAiConfirm（View → Composable → Service → Api）。
 *
 * 20261008：过渡期旧轨（整仓差量向导 / 表单资产 / 微服务资产）已从弹窗移除（后端端点保留），
 * 只剩统一扫描（全量 / 增量 + 可选部分规则）与反编译源码库的整仓全量。
 */

/** 统一扫描的扫描方式（契约 D：只两种；没有可用基线时不能选 incremental） */
export type ScanStrategy = 'full' | 'incremental'

/** 规则范围：全部规则 = 整个目录；自选 = 部分扫描（scan_scope=partial） */
export type RuleScopeMode = 'all' | 'custom'

/** 统一扫描触发请求体（POST /sechub/prescan/unified-trigger）；可选字段为空时不出现在请求里 */
export interface UnifiedTriggerRequest {
  repository_id: string
  rule_set_id?: string
  force: boolean
  strategy: ScanStrategy
  branch?: string
  target_commit?: string
  /** 所选扫描点（其下全部目录内规则） */
  scan_point_ids?: string[]
  /** 单独选中的规则版本（所在扫描点未整选时） */
  rule_version_ids?: string[]
}

/** 统一扫描触发响应 */
export interface UnifiedTriggerResponse {
  run_id: string
  status: string
  idempotent: boolean
  /** 自动选中的资产数 */
  assets: { form: number, microservice: number }
  /** full / partial / incremental（旧后端不返回） */
  scan_scope?: string
  /** 本次实际执行的规则数（旧后端不返回） */
  rule_count?: number
}

/** 增量基线（按 仓库+分支 自动取最近一次 已定稿 的全量统一 run） */
export interface UnifiedBaseline {
  run_id: string
  commit_sha: string
  branch: string
  finished_at: string
  confirmed: number
  issue_count: number
}

/** 统一扫描预览（GET /sechub/prescan/unified-preview）：blocked_reason 非空时不可提交 */
export interface UnifiedPreview {
  form_assets: number
  microservice_assets: number
  form_sync_run_id?: string | null
  microservice_sync_run_id?: string | null
  blocked_reason?: string | null
  /** 无基线时为 null（旧后端不返回该键） */
  baseline?: UnifiedBaseline | null
  /** 没有可用基线的原因；有基线时为 null */
  baseline_unavailable_reason?: string | null
  /** 该分支最新 commit（目标 commit 留空时用它） */
  target_commit?: string | null
  /** 规则目录相对基线新增/变更的规则数（增量时这些规则额外跑全部文件） */
  rule_changes_since_baseline?: number | null
}

/** 规则树：规则（GET /sechub/prescan/rule-set-tree） */
export interface RuleSetTreeRule {
  rule_version_id: string
  rule_key: string
  name: string
}

/** 规则树：扫描点 */
export interface RuleSetTreeScanPoint {
  scan_point_id: string
  scan_point_key: string
  name: string
  rules: RuleSetTreeRule[]
}

/** 规则树：分类（未归类扫描点进 code='unclassified'） */
export interface RuleSetTreeCategory {
  code: string
  name: string
  scan_points: RuleSetTreeScanPoint[]
}

/** 规则树：领域 */
export interface RuleSetTreeDomain {
  domain: string
  categories: RuleSetTreeCategory[]
}

/** 规则树响应 */
export interface RuleSetTree {
  rule_set_id: string
  rule_set_name: string
  is_default: boolean
  domains: RuleSetTreeDomain[]
}

/** 部分扫描的提交载荷（两者都空 = 全目录，所以「自选」时至少要有一项） */
export interface RuleScopePayload {
  scan_point_ids: string[]
  rule_version_ids: string[]
}

/** 整仓（含反编译源码库）全量扫描请求体 */
export interface FullTriggerRequest {
  repository_id: string
  scan_mode: 'full'
  rule_set_id?: string
  force: boolean
}

/**
 * AI 确认请求体。
 * 比 `@/types/static-scan` 的 AiConfirmRequest 多 agent_code / skill_code
 * （Agent 自主模式与指定扫描技能），故此模块自带一份。
 */
export interface AiConfirmBody {
  run_id: string
  /** 'all' = 全部待确认；否则为某个 scan_point_id（后端 AiConfirmRequest.scope 同口径） */
  scope: string
  mode: 'batch' | 'agent'
  model?: string
  agent_code?: string
  skill_code?: string
}

/** AI 确认「范围」下拉的一项（value = 'all' 或 scan_point_id） */
export interface AiConfirmScopeOption {
  value: string
  label: string
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
