/**
 * 「发版范围筛选」纯规则：下拉级联、联动重置、范围 query 与范围说明。
 *
 * 独立成模块（同 `releaseCoverageRules.ts`）是为了能脱离 Vue / 请求层单测；
 * 后续其他发版页面复用同一套规则。
 */
import type {
  ReleaseScopeGroup,
  ReleaseScopeOptions,
  ReleaseScopeQuery,
} from '@/types/sechub-release'

/** 范围筛选项（产品线 / 迭代 / 产品领域 / 业务领域 / 项目组） */
export interface ScopeOptionItem {
  value: string
  label: string
}

/** 范围筛选当前选择 */
export interface ReleaseScopeSelection {
  productLine: string
  iterationId: string
  productDomain: string
  businessArea: string
  projectGroup: string
}

/** 可被用户切换的范围字段 */
export type ReleaseScopeField = keyof ReleaseScopeSelection

/** 按项目组反查到的上级范围 */
export interface LocatedProjectGroup {
  productDomain: string
  businessArea: string
  group: ReleaseScopeGroup
}

export function productLineOptionsOf(options: ReleaseScopeOptions | null): ScopeOptionItem[] {
  return (options?.product_lines ?? []).map(item => ({ value: item.value, label: item.label }))
}

export function iterationOptionsOf(options: ReleaseScopeOptions | null): ScopeOptionItem[] {
  return (options?.iterations ?? []).map(item => ({
    value: item.id,
    label: `${item.name}（${item.code}）`,
  }))
}

export function domainOptionsOf(options: ReleaseScopeOptions | null): ScopeOptionItem[] {
  return (options?.domains ?? []).map(item => ({ value: item.name, label: item.name }))
}

export function businessAreaOptionsOf(
  options: ReleaseScopeOptions | null,
  productDomain: string,
): ScopeOptionItem[] {
  const domain = options?.domains.find(item => item.name === productDomain)
  return (domain?.business_areas ?? []).map(item => ({ value: item.value, label: item.label }))
}

export function projectGroupOptionsOf(
  options: ReleaseScopeOptions | null,
  productDomain: string,
  businessArea: string,
): ScopeOptionItem[] {
  const domain = options?.domains.find(item => item.name === productDomain)
  const area = domain?.business_areas.find(item => item.value === businessArea)
  return (area?.project_groups ?? []).map(item => ({ value: item.code, label: item.name }))
}

/** 缺省迭代：当前进行中，没有则首项 */
export function defaultIterationIdOf(options: ReleaseScopeOptions | null): string {
  return options?.current_id ?? options?.iterations[0]?.id ?? ''
}

/** 从两级树之外反查项目组所属的产品领域 / 业务领域 */
export function locateProjectGroup(
  options: ReleaseScopeOptions | null,
  code: string,
): LocatedProjectGroup | null {
  for (const domain of options?.domains ?? []) {
    for (const area of domain.business_areas) {
      const group = area.project_groups.find(item => item.code === code)
      if (group)
        return { productDomain: domain.name, businessArea: area.value, group }
    }
  }
  return null
}

/**
 * 切换上级后需要清空的下级字段。
 *
 * - 产品线：迭代重置为新产品线的 current_id，领域 / 业务领域 / 项目组清空；
 * - 产品领域：业务领域 / 项目组清空；
 * - 业务领域：项目组清空；
 * - 迭代 / 项目组：不改动其他字段。
 */
export function resetOnFieldChange(
  field: ReleaseScopeField,
  options: ReleaseScopeOptions | null,
): Partial<ReleaseScopeSelection> {
  if (field === 'productLine') {
    return {
      iterationId: defaultIterationIdOf(options),
      productDomain: '',
      businessArea: '',
      projectGroup: '',
    }
  }
  if (field === 'productDomain')
    return { businessArea: '', projectGroup: '' }
  if (field === 'businessArea')
    return { projectGroup: '' }
  return {}
}

/**
 * 校正来自路由 query 的选择：项目组先反查补齐上级，再校验领域 / 业务领域 / 项目组
 * 是否仍在选项树里，无效值清空；迭代无效或为空时回退 current_id。
 */
export function normalizeScopeSelection(
  selection: ReleaseScopeSelection,
  options: ReleaseScopeOptions | null,
): ReleaseScopeSelection {
  let { iterationId, productDomain, businessArea, projectGroup } = selection

  const domains = options?.domains ?? []
  if (productDomain && !domains.some(item => item.name === productDomain)) {
    productDomain = ''
    businessArea = ''
  }
  if (projectGroup) {
    const located = locateProjectGroup(options, projectGroup)
    if (!located) {
      projectGroup = ''
    }
    else {
      if (!productDomain)
        productDomain = located.productDomain
      if (!businessArea)
        businessArea = located.businessArea
    }
  }
  if (businessArea && !businessAreaOptionsOf(options, productDomain).some(item => item.value === businessArea)) {
    businessArea = ''
    projectGroup = ''
  }
  if (projectGroup && !projectGroupOptionsOf(options, productDomain, businessArea).some(item => item.value === projectGroup))
    projectGroup = ''

  const iterationExists = (options?.iterations ?? []).some(item => item.id === iterationId)
  if (!iterationId || !iterationExists)
    iterationId = defaultIterationIdOf(options)

  return { productLine: selection.productLine, iterationId, productDomain, businessArea, projectGroup }
}

/** 范围 query（空值不下发） */
export function buildScopeQuery(selection: ReleaseScopeSelection): ReleaseScopeQuery {
  const query: ReleaseScopeQuery = {}
  if (selection.productLine)
    query.product_line = selection.productLine
  if (selection.iterationId)
    query.iteration_id = selection.iterationId
  if (selection.productDomain)
    query.product_domains = selection.productDomain
  if (selection.businessArea)
    query.business_area = selection.businessArea
  if (selection.projectGroup)
    query.project_group = selection.projectGroup
  return query
}

/**
 * 当前范围文字说明。
 *
 * 产品领域未显式选择时回显后端生效领域（coverage 的 `scope.product_domains`），
 * 即后端配置的默认领域，避免下拉空白时看不出实际过滤范围。
 */
export function scopeSummaryText(
  selection: ReleaseScopeSelection,
  options: ReleaseScopeOptions | null,
  effectiveDomains: string[],
): string {
  const parts: string[] = []
  const line = productLineOptionsOf(options).find(item => item.value === selection.productLine)
  if (line)
    parts.push(`产品线：${line.label}`)

  const iteration = (options?.iterations ?? []).find(item => item.id === selection.iterationId)
  if (iteration)
    parts.push(`迭代：${iteration.name}（${iteration.code}）`)

  const domainText = selection.productDomain
    || (effectiveDomains.length ? `${effectiveDomains.join('、')}（默认）` : '')
  if (domainText)
    parts.push(`产品领域：${domainText}`)

  if (selection.businessArea) {
    const area = (options?.domains ?? [])
      .flatMap(domain => domain.business_areas)
      .find(item => item.value === selection.businessArea)
    parts.push(`业务领域：${area?.label ?? selection.businessArea}`)
  }

  if (selection.projectGroup) {
    const located = locateProjectGroup(options, selection.projectGroup)
    parts.push(`项目组：${located?.group.name ?? selection.projectGroup}`)
  }

  return parts.length ? parts.join(' · ') : '全部范围'
}
