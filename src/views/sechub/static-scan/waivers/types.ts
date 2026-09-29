/**
 * 白名单页的 DTO、枚举与展示口径（后端 `sec_static_waiver` / `WaiverCreateReq` 的前端镜像）。
 *
 * 分层与 coverage-report/、rule-effects/ 同构：本文件只放类型、常量与纯函数，
 * 取数在 ./service，页面状态在 ./useWaivers。
 */
import type { SelectOption, WaiverRuleStatRow } from '@/types/static-scan'

/** 白名单状态（后端 WaiverStatus 的四态） */
export type WaiverStatus = 'pending' | 'active' | 'expired' | 'revoked'

export const WAIVER_STATUS_OPTIONS: SelectOption[] = [
  { label: '待审批', value: 'pending' },
  { label: '生效', value: 'active' },
  { label: '过期', value: 'expired' },
  { label: '撤销', value: 'revoked' },
]

/** 状态 → a-tag 颜色；表外取值灰色兜底 */
export const WAIVER_STATUS_COLORS: Record<string, string> = {
  pending: 'gold',
  active: 'green',
  expired: 'gray',
  revoked: 'red',
}

/** 状态中文标签：表外取值原样显示（别把英文串直接抛给用户，但也别猜） */
export function waiverStatusLabel(status: string): string {
  return WAIVER_STATUS_OPTIONS.find(option => option.value === status)?.label ?? status
}

/**
 * 白名单类型（004 三层白名单契约）。
 * 空串 = 不发送不传该字段，后端按字段推断类型（与改造前的请求体逐字一致）。
 */
export type WaiverType = 'issue_exempt' | 'rule_exempt' | 'path_pattern' | 'scope_exclude' | 'rule_scope_exempt'

export const WAIVER_TYPE_OPTIONS: { label: string, value: WaiverType }[] = [
  // 前两项是 004 新增的两层：范围排除在检出前生效，规则×范围豁免在 AI 确认前生效
  { label: '范围排除（检出前）', value: 'scope_exclude' },
  { label: '规则×范围豁免（AI 确认前）', value: 'rule_scope_exempt' },
  { label: '单问题误报（问题级）', value: 'issue_exempt' },
  { label: '规则豁免（整条规则）', value: 'rule_exempt' },
  { label: '路径模式（历史口径）', value: 'path_pattern' },
]

export const WAIVER_TYPE_LABELS: Record<string, string> = {
  scope_exclude: '范围排除',
  rule_scope_exempt: '规则×范围豁免',
  issue_exempt: '单问题误报',
  rule_exempt: '规则豁免',
  path_pattern: '路径模式',
}

/** 豁免范围维度（scope_kind） */
export type WaiverScopeKind = 'path_glob' | 'code_role' | 'entry_kind'

export const WAIVER_SCOPE_KIND_OPTIONS: { label: string, value: WaiverScopeKind }[] = [
  { label: '路径 glob', value: 'path_glob' },
  { label: '代码角色', value: 'code_role' },
  { label: '资产入口类型', value: 'entry_kind' },
]

export const WAIVER_SCOPE_KIND_LABELS: Record<string, string> = {
  path_glob: '路径 glob',
  code_role: '代码角色',
  entry_kind: '资产入口类型',
}

/** scope_kind=code_role 的可选值（与后端代码角色分类器的角色名逐字一致） */
export const WAIVER_CODE_ROLE_OPTIONS: SelectOption[] = [
  { label: '升级插件', value: 'upgrade_plugin' },
  { label: '测试代码', value: 'test' },
  { label: '生成代码', value: 'generated' },
  { label: 'Mock 代码', value: 'mock' },
]

/** scope_kind=entry_kind 的可选值（微服务资产入口类型） */
export const WAIVER_ENTRY_KIND_OPTIONS: SelectOption[] = [
  { label: '业务 RPC', value: 'biz_rpc' },
  { label: '升级服务', value: 'upgrade' },
]

/** 契约枚举的取值集合（发送前校验用；表单声明成 string，脏值不许进请求） */
const WAIVER_TYPE_VALUES = new Set<string>(WAIVER_TYPE_OPTIONS.map(option => option.value))
const WAIVER_SCOPE_KIND_VALUES = new Set<string>(WAIVER_SCOPE_KIND_OPTIONS.map(option => option.value))

/**
 * 范围值候选项：随 scope_kind 联动。
 * 空数组 = 该维度是自由输入（path_glob 走输入框），模板据此切换控件而不是猜。
 */
export function waiverScopeValueOptions(scopeKind: string): SelectOption[] {
  if (scopeKind === 'code_role')
    return WAIVER_CODE_ROLE_OPTIONS
  if (scopeKind === 'entry_kind')
    return WAIVER_ENTRY_KIND_OPTIONS
  return []
}

/** 路径 glob 的输入提示（与后端通配语义一致：`**` 跨目录、`*` 单段） */
export const WAIVER_PATH_GLOB_PLACEHOLDER = '如: src/legacy/**'

/** 白名单列表行（后端 SecStaticWaiverModel 的前端镜像，只列本页用到的字段） */
export interface WaiverRow {
  id: string
  rule_version_id: string
  rule_code?: string | null
  project_group_id?: string | null
  module_repository_id?: string | null
  path_pattern?: string | null
  reason: string
  impact?: string | null
  status: string
  requester_id: string
  approver_id?: string | null
  approval_comment?: string | null
  effective_from?: string | null
  effective_to?: string | null
  version?: number
  /** 白名单类型：issue_exempt / rule_exempt / path_pattern / scope_exclude / rule_scope_exempt；历史行可能为空 */
  waiver_type?: string | null
  /** 豁免范围维度：path_glob / code_role / entry_kind（004 新增，历史行为 null） */
  scope_kind?: string | null
  scope_value?: string | null
  /** 问题级豁免关联的问题哈希 */
  fingerprint?: string | null
  created_at?: string | null
  updated_at?: string | null
}

/** 列表响应（后端 ListData<T> 的前端视图） */
export interface WaiverListPage {
  list: WaiverRow[]
  total: number
}

/** 列表筛选条件（空串 = 不过滤，发送前由 service 层剔除） */
export interface WaiverListFilter {
  status: string
  project_group_id: string
  rule_version_id: string
  scan_point_id: string
  domain: string
}

/** 完整请求参数：筛选 + 服务端分页 */
export interface WaiverListQuery extends WaiverListFilter {
  page_num: number
  page_size: number
}

export const WAIVER_LIST_DEFAULT_FILTER: WaiverListFilter = {
  status: '',
  project_group_id: '',
  rule_version_id: '',
  scan_point_id: '',
  domain: '',
}

/** 与改造前一致：每页 10 条 */
export const WAIVER_PAGE_SIZE = 10

/** 左树节点：全部（根）→ 领域 → 扫描点 → 规则版本节点 */
export interface WaiverRuleTreeNode {
  key: string
  title: string
  children?: WaiverRuleTreeNode[]
  /** 规则版本节点：带原始统计行（模板按它显示 生效/待审批/总数） */
  rule?: WaiverRuleStatRow
  /** 领域 / 扫描点节点：子节点的计数合计 */
  spStats?: { active: number, pending: number, total: number }
}

/** 领域 → 中文（与 labels.ts 的 domainLabels 同口径，左树分组名用） */
export function waiverDomainLabel(domain: string): string {
  const labels: Record<string, string> = { security: '安全', performance: '性能' }
  return labels[domain] ?? domain
}

/**
 * 规则版本节点标题：规则名为空退回 id；两者都空（范围排除这类全规则白名单）给中文占位，
 * 否则左树会出现一个没有名字的空白节点。
 */
export function waiverRuleTitle(row: WaiverRuleStatRow): string {
  if (row.rule_name)
    return row.rule_name
  return row.rule_version_id || '全规则 / 未关联规则版本'
}

/** 列表「类型/范围」列：类型 + 范围维度/值；历史行退回 path_pattern；都没有给「—」 */
export function waiverScopeText(row: WaiverRow): string {
  const parts: string[] = []
  if (row.waiver_type)
    parts.push(WAIVER_TYPE_LABELS[row.waiver_type] ?? row.waiver_type)
  if (row.scope_kind) {
    const kind = WAIVER_SCOPE_KIND_LABELS[row.scope_kind] ?? row.scope_kind
    parts.push(row.scope_value ? `${kind}：${row.scope_value}` : kind)
  }
  else if (row.path_pattern) {
    parts.push(`路径：${row.path_pattern}`)
  }
  return parts.length ? parts.join(' · ') : '—'
}

/**
 * 新建申请表单：新字段为空 = 请求里不带它们（见 buildWaiverPayload）。
 * 三个新字段声明成 string 而不是字面量联合：Arco 下拉清空会置成 undefined，
 * 发请求前再按契约枚举校验（脏值不进请求），比在表单上写窄类型更贴合实际取值。
 */
export interface WaiverForm {
  rule_version_id: string
  rule_code: string
  project_group_id: string
  module_repository_id: string
  path_pattern: string
  reason: string
  impact: string
  effective_to: string
  /** 白名单类型：waiver_type 契约枚举之一；空 = 不发送（后端按字段推断） */
  waiver_type: string
  /** 豁免范围维度：path_glob / code_role / entry_kind；空 = 不发送 */
  scope_kind: string
  /** 范围值：path_glob 自由输入 / code_role、entry_kind 下拉枚举 */
  scope_value: string
}

/** 空白表单（打开弹窗时用；每次新建都换新对象，避免残留上一次的输入） */
export function emptyWaiverForm(): WaiverForm {
  return {
    rule_version_id: '',
    rule_code: '',
    project_group_id: '',
    module_repository_id: '',
    path_pattern: '',
    reason: '',
    impact: '',
    effective_to: '',
    waiver_type: '',
    scope_kind: '',
    scope_value: '',
  }
}

/**
 * 表单 → 创建请求体。
 *
 * 旧字段逐字保留（含空串——改造前就是这样发的，后端已按空串容忍）；
 * 004 新增的三个字段**为空时不出现**在请求里：老后端收到与改造前逐字一致的 body，
 * 新后端才能按「字段缺失」区分「没填」与「填了空值」。
 */
export function buildWaiverPayload(form: WaiverForm): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    rule_version_id: form.rule_version_id,
    rule_code: form.rule_code,
    project_group_id: form.project_group_id,
    module_repository_id: form.module_repository_id,
    path_pattern: form.path_pattern,
    reason: form.reason,
    impact: form.impact,
    effective_to: form.effective_to,
  }
  if (WAIVER_TYPE_VALUES.has(form.waiver_type))
    payload.waiver_type = form.waiver_type
  if (WAIVER_SCOPE_KIND_VALUES.has(form.scope_kind))
    payload.scope_kind = form.scope_kind
  const scopeValue = form.scope_value.trim()
  if (scopeValue)
    payload.scope_value = scopeValue
  return payload
}
