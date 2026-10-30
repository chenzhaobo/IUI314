/**
 * 「配置检查 / 白名单」页纯规则：页签过滤、查询构造、白名单入参与展示映射。
 *
 * 独立成模块（同 `defectDraftRules.ts`）以便脱离 Vue / 请求层单测；
 * 状态 / 级别 / 事件文案与 `config_check::rules`、`view::classify_events`、
 * `waiver_service` 的取值保持一致。
 */
import type {
  ConfigFieldDef,
  ConfigGroupStat,
  ConfigHandling,
  ConfigHandlingFilter,
  ConfigItem,
  ConfigItemQuery,
  ConfigItemState,
  ConfigLastScan,
  ConfigRuleDef,
  ConfigRuleFamily,
  ConfigRuleStat,
  ConfigSeverity,
  ConfigSummaryQuery,
  ReleaseScopeQuery,
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

/** 规则分组标题（左栏规则列表） */
export const CONFIG_RULE_GROUP_LABELS: Record<ConfigRuleFamily, string> = {
  meta: '元数据规则（M）',
  api: '清单规则（C）',
}

/** 手动检查范围（顶部「重新检查」下拉） */
export const CONFIG_RUN_OPTIONS: Array<{ value: ConfigRuleFamily | 'all', label: string }> = [
  { value: 'meta', label: '元数据检查' },
  { value: 'api', label: '清单检查' },
  { value: 'all', label: '全部' },
]

/** 明细处理状态筛选（默认「未关闭」= 待处理 + 已提缺陷） */
export const CONFIG_HANDLING_OPTIONS: Array<{ value: ConfigHandlingFilter, label: string }> = [
  { value: 'open', label: '未关闭（待处理 + 已提缺陷）' },
  { value: 'pending', label: '待处理' },
  { value: 'defect_filed', label: '已提缺陷' },
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

const HANDLING_META: Record<ConfigHandling, ConfigStateMeta> = {
  pending: { label: '待处理', color: 'orange' },
  defect_filed: { label: '已提缺陷', color: 'arcoblue' },
  waived: { label: '已加白', color: 'gray' },
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

/** 规则编号 → 定义（提示文案用） */
export function ruleDefMapOf(rules: ConfigRuleDef[]): Record<string, ConfigRuleDef> {
  const map: Record<string, ConfigRuleDef> = {}
  for (const def of rules)
    map[def.code] = def
  return map
}

/** 左栏规则行：规则定义 + 范围口径下的统计 */
export interface ConfigRuleRow {
  code: string
  family: ConfigRuleFamily
  title: string
  severity: ConfigSeverity
  description: string
  fix_hint: string
  open: number
  waived: number
  resolved: number
  pending: number
  defect_filed: number
  new_open: number
  fixed_in_iteration: number
}

/** 左栏规则分组 */
export interface ConfigRuleGroupRow {
  family: ConfigRuleFamily
  label: string
  rows: ConfigRuleRow[]
}

/**
 * 按规则定义顺序合并 `by_rule` 统计：未命中的规则也保留（计数为 0），
 * 标题 / 说明 / 级别以规则定义为准。
 */
export function ruleRowsOf(rules: ConfigRuleDef[], stats: ConfigRuleStat[]): ConfigRuleRow[] {
  const statsByCode = new Map(stats.map(stat => [stat.rule_code, stat]))
  return rules.map((def) => {
    const stat = statsByCode.get(def.code)
    return {
      code: def.code,
      family: def.family,
      title: def.title,
      severity: def.severity,
      description: def.description,
      fix_hint: def.fix_hint,
      open: stat?.open ?? 0,
      waived: stat?.waived ?? 0,
      resolved: stat?.resolved ?? 0,
      pending: stat?.pending ?? 0,
      defect_filed: stat?.defect_filed ?? 0,
      new_open: stat?.new_open ?? 0,
      fixed_in_iteration: stat?.fixed_in_iteration ?? 0,
    }
  })
}

/** 按 family 分组（元数据在前），保持规则定义顺序 */
export function configRuleGroupsOf(rows: ConfigRuleRow[]): ConfigRuleGroupRow[] {
  const families: ConfigRuleFamily[] = ['meta', 'api']
  return families
    .map(family => ({
      family,
      label: CONFIG_RULE_GROUP_LABELS[family],
      rows: rows.filter(row => row.family === family),
    }))
    .filter(group => group.rows.length > 0)
}

/** 项目组分布条的一行 */
export interface ConfigGroupDistRow {
  code: string
  name: string
  open: number
  high_open: number
  new_open: number
  /** 未归属项目组的检查项后端无法按组筛选 */
  selectable: boolean
}

/** 项目组分布：只保留有待处理的小组；未归属项目组置为不可点 */
export function groupDistributionOf(groups: ConfigGroupStat[]): ConfigGroupDistRow[] {
  return groups
    .filter(group => group.open > 0)
    .map(group => ({
      code: group.project_group_code.trim(),
      name: group.project_group_name.trim() || group.project_group_code.trim() || '未分类',
      open: group.open,
      high_open: group.high_open,
      new_open: group.new_open,
      selectable: Boolean(group.project_group_code.trim()),
    }))
}

/** 明细查询：范围 + 处理状态 + 级别 / 关键词 / 只看新增；空值不下发 */
export function configItemsQueryOf(
  filters: ConfigItemFilterInput,
  scope: ReleaseScopeQuery,
  pageNum: number,
  pageSize: number,
): ConfigItemQuery {
  const query: ConfigItemQuery = {
    ...scope,
    handling: filters.handling,
    page_num: pageNum,
    page_size: pageSize,
  }
  const ruleCode = filters.ruleCode.trim()
  if (ruleCode)
    query.rule_code = ruleCode
  if (filters.severity)
    query.severity = filters.severity
  const keyword = filters.keyword.trim()
  if (keyword)
    query.keyword = keyword
  if (filters.newOnly)
    query.new_only = true
  return query
}

/** 汇总查询：只带范围（domain 口径），列表筛选不参与统计 */
export function configSummaryQueryOf(scope: ReleaseScopeQuery): ConfigSummaryQuery {
  return { ...scope, scope: 'domain' }
}

/** 汇总条的五项（点击联动明细处理状态） */
export type ConfigSummaryCellKey = 'pending' | 'defect_filed' | 'waived' | 'new_open' | 'fixed_in_iteration'

/** 汇总项 → 明细筛选预设 */
export function summaryCellPresetOf(key: ConfigSummaryCellKey): Pick<ConfigItemFilterInput, 'handling' | 'newOnly'> {
  switch (key) {
    case 'pending':
      return { handling: 'pending', newOnly: false }
    case 'defect_filed':
      return { handling: 'defect_filed', newOnly: false }
    case 'waived':
      return { handling: 'waived', newOnly: false }
    case 'new_open':
      return { handling: 'open', newOnly: true }
    case 'fixed_in_iteration':
      return { handling: 'resolved', newOnly: false }
  }
}

/** 当前筛选对应的汇总高亮项；不匹配任何预设时为空 */
export function activeSummaryCellOf(filters: Pick<ConfigItemFilterInput, 'handling' | 'newOnly'>): ConfigSummaryCellKey | '' {
  switch (filters.handling) {
    case 'open':
      return filters.newOnly ? 'new_open' : ''
    case 'pending':
    case 'defect_filed':
    case 'waived':
      return filters.handling
    case 'resolved':
      return filters.newOnly ? '' : 'fixed_in_iteration'
    default:
      return ''
  }
}

/** 缺陷编号跳缺陷草稿页（带当前产品线） */
export function configDefectLink(defectCode: string, productLine: string): string {
  const params = [`keyword=${encodeURIComponent(defectCode.trim())}`]
  if (productLine.trim())
    params.push(`product_line=${encodeURIComponent(productLine.trim())}`)
  return `/sechub/release/release-defects?${params.join('&')}`
}

/** 最近检查时间：两个维度取较晚的一个 */
export function latestScanAt(lastScan: ConfigLastScan | null): string | null {
  const stamps = [lastScan?.meta, lastScan?.api].filter((value): value is string => Boolean(value))
  if (!stamps.length)
    return null
  return stamps.reduce((latest, current) => (Date.parse(current) > Date.parse(latest) ? current : latest))
}

/** 明细表字段说明按 key 建索引 */
export function configFieldsMapOf(fields: ConfigFieldDef[]): Record<string, ConfigFieldDef> {
  const map: Record<string, ConfigFieldDef> = {}
  for (const field of fields)
    map[field.key] = field
  return map
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

/** 处理状态文案与颜色（未知状态原样显示） */
export function configHandlingMeta(handling: string): ConfigStateMeta {
  return HANDLING_META[handling as ConfigHandling] ?? { label: handling, color: 'gray' }
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

export interface ConfigItemFilterInput {
  /** 左栏选中的规则（空 = 全部规则） */
  ruleCode: string
  handling: ConfigHandlingFilter
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
