/**
 * 「配置检查 / 白名单」页纯规则：页签过滤、查询构造、白名单入参与展示映射。
 *
 * 独立成模块（同 `defectDraftRules.ts`）以便脱离 Vue / 请求层单测；
 * 状态 / 级别 / 事件文案与 `config_check::rules`、`view::classify_events`、
 * `waiver_service` 的取值保持一致。
 */
import type {
  ConfigItem,
  ConfigItemQuery,
  ConfigItemState,
  ConfigRuleDef,
  ConfigRuleFamily,
  ConfigScope,
  ConfigSeverity,
  ConfigSummaryQuery,
  ReleaseWaiver,
  WaiverAddReq,
  WaiverMatchType,
} from '@/types/sechub-release'

/** 接口免测规则编号（后端 `waiver_service::EXEMPT_RULE`） */
export const API_EXEMPT_RULE = 'API_EXEMPT'

/** 单条白名单原因的最小长度（后端按 trim 后的字符数判断） */
export const WAIVER_REASON_MIN = 4

/** 接口免测允许的方法（弹窗下拉） */
export const HTTP_METHOD_OPTIONS: Array<{ value: string, label: string }> = [
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
  { value: 'PUT', label: 'PUT' },
  { value: 'DELETE', label: 'DELETE' },
]

/** 两个分类页签（按当前页签发 meta / api） */
export const CONFIG_FAMILY_TABS: Array<{ value: ConfigRuleFamily, label: string }> = [
  { value: 'meta', label: '表单元数据检查（M01–M05）' },
  { value: 'api', label: 'API 配置检查（C01–C07）' },
]

/** 范围切换：domain 走后端配置的产品领域（默认「集团财务」），all 不设限 */
export const CONFIG_SCOPE_OPTIONS: Array<{ value: ConfigScope, label: string }> = [
  { value: 'domain', label: '集团财务' },
  { value: 'all', label: '全部' },
]

/** 明细状态筛选（含「全部」） */
export const CONFIG_STATE_OPTIONS: Array<{ value: ConfigItemState | 'all', label: string }> = [
  { value: 'open', label: '待处理' },
  { value: 'waived', label: '已加白' },
  { value: 'resolved', label: '已修复' },
  { value: 'all', label: '全部' },
]

/** 级别筛选（空值 = 不过滤，由页面 allow-clear 控制） */
export const CONFIG_SEVERITY_OPTIONS: Array<{ value: ConfigSeverity, label: string }> = [
  { value: 'high', label: '高' },
  { value: 'medium', label: '中' },
  { value: 'low', label: '低' },
  { value: 'info', label: '提示' },
]

/** 加白弹窗的匹配方式（API_EXEMPT 只允许 exact，见后端 validate_add） */
export const WAIVER_MATCH_OPTIONS: Array<{ value: WaiverMatchType, label: string }> = [
  { value: 'exact', label: '精确匹配' },
  { value: 'app', label: '应用整体加白' },
]

const SEVERITY_META: Record<ConfigSeverity, ConfigStateMeta> = {
  high: { label: '高', color: 'red' },
  medium: { label: '中', color: 'orange' },
  low: { label: '低', color: 'blue' },
  info: { label: '提示', color: 'gray' },
}

const STATE_META: Record<ConfigItemState, ConfigStateMeta> = {
  open: { label: '待处理', color: 'red' },
  waived: { label: '已加白', color: 'orange' },
  resolved: { label: '已修复', color: 'green' },
}

const EVENT_LABEL: Record<string, string> = {
  opened: '首次发现',
  reopened: '重新出现',
  resolved: '已修复',
  waived: '已加白',
  unwaived: '撤销加白',
  evidence_changed: '证据变化',
}

/** 按维度过滤规则表，保持后端规则表顺序 */
export function rulesOfFamily(rules: ConfigRuleDef[], family: ConfigRuleFamily): ConfigRuleDef[] {
  return rules.filter(def => def.family === family)
}

/** 规则编号 → 定义（提示文案用） */
export function ruleDefMapOf(rules: ConfigRuleDef[]): Record<string, ConfigRuleDef> {
  const map: Record<string, ConfigRuleDef> = {}
  for (const def of rules)
    map[def.code] = def
  return map
}

/** 列表查询：空值不下发；状态与范围总是下发（后端 state 缺省为 open） */
export function configQueryOf(filters: ConfigFilterInput, pageNum: number, pageSize: number): ConfigItemQuery {
  const query: ConfigItemQuery = {
    scope: filters.scope,
    state: filters.state,
    page_num: pageNum,
    page_size: pageSize,
  }
  if (filters.iterationId)
    query.iteration_id = filters.iterationId
  const ruleCode = filters.ruleCode.trim()
  if (ruleCode)
    query.rule_code = ruleCode
  const projectGroup = filters.projectGroup.trim()
  if (projectGroup)
    query.project_group = projectGroup
  if (filters.severity)
    query.severity = filters.severity
  const keyword = filters.keyword.trim()
  if (keyword)
    query.keyword = keyword
  if (filters.newOnly)
    query.new_only = true
  return query
}

/** 汇总查询：只带范围，列表筛选不参与统计口径 */
export function configSummaryQueryOf(iterationId: string, scope: ConfigScope): ConfigSummaryQuery {
  const query: ConfigSummaryQuery = { scope }
  if (iterationId)
    query.iteration_id = iterationId
  return query
}

/** 原因最小长度校验；合法返回 null */
export function validateWaiverReason(reason: string): string | null {
  if (Array.from(reason.trim()).length < WAIVER_REASON_MIN)
    return `白名单原因至少 ${WAIVER_REASON_MIN} 个字符`
  return null
}

/** 加白入参：环境取检查项所属环境，对象与规则 trim */
export function waiverRequestOf(
  item: Pick<ConfigItem, 'env_id' | 'rule_code' | 'object_key'>,
  form: WaiverFormInput,
): WaiverAddReq {
  const req: WaiverAddReq = {
    env_id: item.env_id.trim(),
    rule_code: item.rule_code.trim(),
    match_type: form.matchType,
    object_key: item.object_key.trim(),
    reason: form.reason.trim(),
  }
  const expiresAt = form.expiresAt.trim()
  if (expiresAt)
    req.expires_at = expiresAt
  return req
}

/** 接口免测 key：`PATH|METHOD`，方法 trim 后大写（同后端 normalize_exempt_key） */
export function exemptKeyOf(path: string, method: string): string {
  return `${path.trim()}|${method.trim().toUpperCase()}`
}

/** 接口免测表单校验；合法返回 null */
export function validateExemptForm(form: ExemptFormInput): string | null {
  if (!form.path.trim())
    return '接口路径不能为空'
  const method = form.method.trim().toUpperCase()
  if (!HTTP_METHOD_OPTIONS.some(option => option.value === method))
    return `不支持的 HTTP 方法：${form.method.trim()}`
  if (Array.from(form.reason.trim()).length < WAIVER_REASON_MIN)
    return `接口免测原因至少 ${WAIVER_REASON_MIN} 个字符`
  return null
}

/** 接口免测入参：固定 API_EXEMPT + exact，不带 env（所有环境生效） */
export function exemptRequestOf(form: ExemptFormInput): WaiverAddReq {
  const req: WaiverAddReq = {
    rule_code: API_EXEMPT_RULE,
    match_type: 'exact',
    object_key: exemptKeyOf(form.path, form.method),
    reason: form.reason.trim(),
  }
  const expiresAt = form.expiresAt.trim()
  if (expiresAt)
    req.expires_at = expiresAt
  return req
}

/** 检查项状态文案与颜色（未知状态原样显示） */
export function configStateMeta(state: string): ConfigStateMeta {
  return STATE_META[state as ConfigItemState] ?? { label: state, color: 'gray' }
}

/** 级别文案与颜色（未知级别原样显示） */
export function configSeverityMeta(severity: string): ConfigStateMeta {
  return SEVERITY_META[severity as ConfigSeverity] ?? { label: severity, color: 'gray' }
}

/** 变更事件文案（未知事件原样显示） */
export function configEventLabel(event: string): string {
  return EVENT_LABEL[event] ?? event
}

/** 白名单状态：撤销优先，其次是有效 / 已过期 */
export function waiverStatusMeta(waiver: Pick<ReleaseWaiver, 'active' | 'revoked_at'>): ConfigStateMeta {
  if (waiver.revoked_at)
    return { label: '已撤销', color: 'gray' }
  if (waiver.active)
    return { label: '有效', color: 'green' }
  return { label: '已过期', color: 'orange' }
}

/** 规则提示：一句话说明 + 修复建议 */
export function ruleTooltipText(def: Pick<ConfigRuleDef, 'description' | 'fix_hint'>): string {
  return `${def.description}\n修复建议：${def.fix_hint}`
}

/** 匹配方式文案 */
export function matchTypeLabel(type: string): string {
  if (type === 'exact')
    return '精确匹配'
  if (type === 'app')
    return '应用整体加白'
  return type
}

export interface ConfigFilterInput {
  iterationId: string
  scope: ConfigScope
  ruleCode: string
  projectGroup: string
  state: ConfigItemState | 'all'
  severity: '' | ConfigSeverity
  keyword: string
  newOnly: boolean
}

export interface WaiverFormInput {
  matchType: WaiverMatchType
  reason: string
  /** 已转成 RFC3339 的到期时间，空串 = 不过期 */
  expiresAt: string
}

export interface ExemptFormInput {
  path: string
  method: string
  reason: string
  /** 已转成 RFC3339 的到期时间，空串 = 不过期 */
  expiresAt: string
}

export interface ConfigStateMeta {
  label: string
  color: string
}
