/**
 * 监控审计各页共用的 DTO、枚举文案与纯函数（后端 app_service::monaudit 的前端镜像）。
 *
 * 只放类型、常量与纯函数；取数在 ./service。
 */

/** 后端 LabelValue */
export interface LabelValue {
  label: string
  value: string
}

/** 后端 ListData<T> */
export interface ListData<T> {
  list: T[]
  total: number
  total_pages?: number
  page_num?: number
}

/** 后端 IssueOptions：问题页 / 轮次页 / 映射页共用的下拉选项 */
export interface IssueOptions {
  audit_types: LabelValue[]
  rounds: LabelValue[]
  sources: LabelValue[]
  /** 当前用户可见的项目组 */
  project_groups: LabelValue[]
  /** 持有 monaudit/scope/all：可见全部项目组与「未归类」 */
  scope_all: boolean
}

export function emptyIssueOptions(): IssueOptions {
  return { audit_types: [], rounds: [], sources: [], project_groups: [], scope_all: false }
}

/** 批量动作结果（后端 BatchResult） */
export interface BatchResult {
  done: number
  skipped: number
  messages: string[]
}

/** 带颜色的枚举文案 */
export interface TagMeta {
  label: string
  color: string
}

/** 取枚举文案；未知值原样显示为灰色 */
export function tagMeta(table: Record<string, TagMeta>, value: string | null | undefined): TagMeta {
  if (!value)
    return { label: '-', color: 'gray' }
  return table[value] ?? { label: value, color: 'gray' }
}

/** 对象表 → 下拉选项 */
export function tagOptions(table: Record<string, TagMeta>): LabelValue[] {
  return Object.entries(table).map(([value, meta]) => ({ value, label: meta.label }))
}

/** 问题状态（人工） */
export const ISSUE_STATUS: Record<string, TagMeta> = {
  pending: { label: '待处理', color: 'orangered' },
  fixing: { label: '处理中', color: 'arcoblue' },
  fixed: { label: '已修复', color: 'cyan' },
  closed: { label: '已关闭', color: 'green' },
  wont_fix: { label: '不处理', color: 'gray' },
  false_positive: { label: '误报', color: 'purple' },
}

/** 复现状态（结算写入） */
export const REPRO_STATE: Record<string, TagMeta> = {
  new: { label: '新增', color: 'arcoblue' },
  reproduced: { label: '重现', color: 'orange' },
  not_reproduced: { label: '未复现', color: 'green' },
  reopened: { label: '复发', color: 'red' },
}

/** 优先级（源端 level） */
export const ISSUE_LEVEL: Record<string, TagMeta> = {
  1: { label: '紧急', color: 'red' },
  2: { label: '高', color: 'orangered' },
  3: { label: '中', color: 'orange' },
  4: { label: '低', color: 'gray' },
}

/** 轮次状态 */
export const ROUND_STATUS: Record<string, TagMeta> = {
  created: { label: '已创建', color: 'gray' },
  syncing: { label: '同步中', color: 'arcoblue' },
  synced: { label: '已同步', color: 'cyan' },
  partial: { label: '部分失败', color: 'orangered' },
  settled: { label: '已结算', color: 'green' },
}

/** 批次状态 */
export const BATCH_STATUS: Record<string, TagMeta> = {
  pending: { label: '排队中', color: 'gray' },
  running: { label: '执行中', color: 'arcoblue' },
  success: { label: '成功', color: 'green' },
  failed: { label: '失败', color: 'red' },
}

/** 映射匹配方式 */
export const MATCH_TYPE: Record<string, TagMeta> = {
  domain_exact: { label: '领域精确', color: 'arcoblue' },
  domain_prefix: { label: '领域前缀', color: 'cyan' },
  class_prefix: { label: '调用类包前缀', color: 'purple' },
}

/** 启用状态 '1' / '0' */
export function enabledMeta(status: string | null | undefined): TagMeta {
  return status === '1' ? { label: '启用', color: 'green' } : { label: '停用', color: 'gray' }
}

/** 批量结果 → 提示文案（主句 + 明细） */
export function batchResultText(result: BatchResult): { summary: string, details: string[] } {
  return {
    summary: `成功 ${result.done} 条，跳过 ${result.skipped} 条`,
    details: result.messages ?? [],
  }
}

/** 剔除空值：「不过滤」表达成「这个键不出现」 */
export function compactQuery(query: object): Record<string, string | number> {
  const out: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(query)) {
    if (value === '' || value === null || value === undefined)
      continue
    if (Array.isArray(value)) {
      if (value.length)
        out[key] = value.join(',')
      continue
    }
    if (typeof value === 'string' || typeof value === 'number')
      out[key] = value
    else if (typeof value === 'boolean')
      out[key] = value ? '1' : '0'
  }
  return out
}

/** 空串 → null（后端 Option 字段） */
export function nullable(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim()
  return trimmed || null
}
