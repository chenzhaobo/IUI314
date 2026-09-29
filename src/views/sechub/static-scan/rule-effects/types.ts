/**
 * 规则效果页的 DTO 与展示口径（后端 `list_rule_effects` 的 RuleEffectRow 前端镜像）。
 *
 * 契约（003 plan）：GET /sechub/prescan/rule-effects，字段 snake_case，比率为 0~1 小数或 null。
 * 分层：本文件只放类型、常量与纯展示换算；取数在 ./service，页面状态在 ./useRuleEffects。
 */
import type { TableColumnData } from '@arco-design/web-vue'
import { domainLabels } from '../labels'

/**
 * 一条规则效果行 = 规则版本 × 扫描点 × 仓库 × 模型。
 * 计数一律为非负整数；比率分母为 0 时后端给 null（不臆造 0）。
 */
export interface RuleEffectRow {
  rule_version_id: string
  rule_key: string
  rule_name: string
  scan_point_id: string
  scan_point_name: string
  domain: string
  repository_id: string
  /** 空串 = 该 run 未记录模型（后端 COALESCE(ai_model,'')，如 agent 自主确认不上报模型） */
  ai_model: string
  /** 计入本行的快照数（run_scope=all 时是求和口径下的 run 数） */
  runs: number
  candidates: number
  ai_confirmed: number
  ai_rejected: number
  ai_review_needed: number
  ai_error: number
  ai_pending: number
  /** confirmed ÷ (confirmed + rejected + review_needed)；分母 0 → null */
  ai_adoption_rate: number | null
  dev_open: number
  dev_false_positive: number
  dev_fixed: number
  dev_verified: number
  dev_verification_failed: number
  dev_wont_fix_other: number
  dev_waived: number
  /** 1 − 开发误报 ÷ 已处置确认数；分母 0 → null */
  dev_acceptance_rate: number | null
}

/** run 口径：latest = 每仓每规则取最近一次快照（契约默认）；all = 全部快照求和 */
export type RuleEffectRunScope = 'latest' | 'all'

/** 排序键（只表达键，方向随键的语义固定：比率升序 / 计数降序 = 最差在前） */
export type RuleEffectSort = 'adoption_rate' | 'dev_fp_rate' | 'candidates'

/** 除分页外的查询条件；空串 = 不过滤，发送前由 service 层剔除（后端 Option<T> 收到空串会 400） */
export interface RuleEffectFilter {
  repository_id: string
  domain: string
  /** 精确匹配 ai_model；模型取值无字典，用自由文本 */
  ai_model: string
  run_scope: RuleEffectRunScope
  keyword: string
  sort: RuleEffectSort
}

/** 完整请求参数：筛选 + 服务端分页 */
export interface RuleEffectQuery extends RuleEffectFilter {
  page_num: number
  page_size: number
}

/** 响应 `Res<ListData<RuleEffectRow>>` 的前端视图（total_pages/page_num 本页不用） */
export interface RuleEffectPage {
  list: RuleEffectRow[]
  total: number
}

/**
 * 表格行 = 契约字段 + 物化的行键。
 * Arco 的 row-key 只接受字段名（不接受函数），而一行由规则版本 × 扫描点 × 仓库 × 模型共同确定，
 * 单拿 rule_version_id 会与同规则的其他扫描点/仓库撞键。
 */
export interface RuleEffectTableRow extends RuleEffectRow {
  row_key: string
}

/** 行键：四个维度拼接（模型空串也留着分隔符，保证同规则不同模型不撞） */
export function ruleEffectRowKey(row: RuleEffectRow): string {
  return [row.rule_version_id, row.scan_point_id, row.repository_id, row.ai_model].join('::')
}

export const RULE_EFFECT_DEFAULT_FILTER: RuleEffectFilter = {
  repository_id: '',
  domain: '',
  ai_model: '',
  run_scope: 'latest',
  keyword: '',
  // 默认按 AI 采信率升序：先看最差的规则（契约示例同样是该键）
  sort: 'adoption_rate',
}

export const RULE_EFFECT_RUN_SCOPE_OPTIONS: { label: string, value: RuleEffectRunScope }[] = [
  { label: '最近快照（每仓每规则取最近一次）', value: 'latest' },
  { label: '全部快照求和', value: 'all' },
]

export const RULE_EFFECT_SORT_OPTIONS: { label: string, value: RuleEffectSort }[] = [
  { label: 'AI 采信率升序（最差在前）', value: 'adoption_rate' },
  { label: '开发误报率降序（最差在前）', value: 'dev_fp_rate' },
  { label: '检出数降序（最多在前）', value: 'candidates' },
]

export const RULE_EFFECT_DOMAIN_OPTIONS: { label: string, value: string }[] = [
  { label: '安全', value: 'security' },
  { label: '性能', value: 'performance' },
]

/** 服务端分页档位；默认 50 与契约示例一致（一行一个规则×扫描点×仓库×模型，20 条一页看不完） */
export const RULE_EFFECT_PAGE_SIZE = 50
export const RULE_EFFECT_PAGE_SIZES = [20, 50, 100]

/**
 * 比率展示：null（分母为 0，比率不可计算）显示「—」，否则百分比 1 位小数。
 * 传 undefined 也按「—」处理：响应缺字段时不能当 0% 渲染。
 */
export function formatRate(rate: number | null | undefined): string {
  return typeof rate === 'number' ? `${(rate * 100).toFixed(1)}%` : '—'
}

/** 文本单元格：空串/非字符串显示「—」（后端给的是名称，为空说明数据缺失） */
function textCell(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value : '—'
}

/**
 * 计数单元格：非数字（响应缺字段）显示「—」而不是 0。
 * 与比率的「—」同形不同义：这里表示该字段不可用，别把它读成统计结果。
 */
function countCell(record: Record<string, unknown>, key: keyof RuleEffectRow): string {
  const value = record[key]
  return typeof value === 'number' ? String(value) : '—'
}

/** 比率单元格：先判是否为数字，再按 formatRate 统一口径 */
function rateCell(record: Record<string, unknown>, key: keyof RuleEffectRow): string {
  const value = record[key]
  return formatRate(typeof value === 'number' ? value : undefined)
}

/** 域：中文标签，表外取值原样显示 */
function domainCell(record: Record<string, unknown>): string {
  const domain = typeof record.domain === 'string' ? record.domain : ''
  return domainLabels[domain] ?? (domain || '—')
}

/** 扫描点：优先名称，名称为空退回 id（存量数据可能只有 id） */
function scanPointCell(record: Record<string, unknown>): string {
  const name = textCell(record.scan_point_name)
  return name === '—' ? textCell(record.scan_point_id) : name
}

/** 模型：空串 = 未记录模型（与扫描结果页的措辞一致） */
function modelCell(record: Record<string, unknown>): string {
  const model = typeof record.ai_model === 'string' ? record.ai_model.trim() : ''
  return model || '未记录模型'
}

function countColumn(title: string, key: keyof RuleEffectRow, width = 76): TableColumnData {
  return { title, dataIndex: key, width, align: 'center', render: ({ record }) => countCell(record, key) }
}

function rateColumn(title: string, key: keyof RuleEffectRow, width = 100): TableColumnData {
  return { title, dataIndex: key, width, align: 'center', render: ({ record }) => rateCell(record, key) }
}

/**
 * 表格列：规则（key+名称）/ 扫描点 / 域 / 仓库 / 模型 / run 数 / 检出 /
 * AI 判定（确认、排除、复核、错误、待确认）/ AI 采信率 /
 * 开发判定（误报、修复、复测通过、不处理、豁免）/ 开发认可率。
 * 「待确认」随 plan 的 RuleEffectRow 一起给出，列上补它是为了让「检出 = 五态之和」能当场对平。
 */
export const RULE_EFFECT_COLUMNS: TableColumnData[] = [
  // 规则与仓库两列用具名插槽：需要两行文本 / 名称解析，列级 render 在 types 里产出的 VNode 拿不到页面 scoped 样式
  { title: '规则', dataIndex: 'rule_key', slotName: 'rule', width: 220, fixed: 'left', ellipsis: true, tooltip: true },
  { title: '扫描点', dataIndex: 'scan_point_name', width: 150, ellipsis: true, tooltip: true, render: ({ record }) => scanPointCell(record) },
  { title: '域', dataIndex: 'domain', width: 70, align: 'center', render: ({ record }) => domainCell(record) },
  { title: '仓库', dataIndex: 'repository_id', slotName: 'repository', width: 180, ellipsis: true, tooltip: true },
  { title: '模型', dataIndex: 'ai_model', width: 150, ellipsis: true, tooltip: true, render: ({ record }) => modelCell(record) },
  countColumn('run 数', 'runs'),
  countColumn('检出', 'candidates'),
  {
    title: 'AI 判定',
    dataIndex: 'ai_group',
    children: [
      countColumn('确认', 'ai_confirmed'),
      countColumn('排除', 'ai_rejected'),
      countColumn('复核', 'ai_review_needed'),
      countColumn('错误', 'ai_error'),
      countColumn('待确认', 'ai_pending'),
    ],
  },
  rateColumn('AI 采信率', 'ai_adoption_rate'),
  {
    title: '开发判定',
    dataIndex: 'dev_group',
    children: [
      countColumn('误报', 'dev_false_positive'),
      countColumn('修复', 'dev_fixed'),
      countColumn('复测通过', 'dev_verified', 84),
      countColumn('不处理', 'dev_wont_fix_other'),
      countColumn('豁免', 'dev_waived'),
    ],
  },
  rateColumn('开发认可率', 'dev_acceptance_rate', 110),
]

/** 表格横向最小宽度：各列宽之和（含分组子列），随列定义自动同步，避免手写常量漂移 */
export const RULE_EFFECT_TABLE_MIN_WIDTH = sumColumnWidth(RULE_EFFECT_COLUMNS)

function sumColumnWidth(columns: TableColumnData[]): number {
  return columns.reduce((sum, column) => {
    if (column.children?.length)
      return sum + sumColumnWidth(column.children)
    return sum + (column.width ?? 120)
  }, 0)
}
