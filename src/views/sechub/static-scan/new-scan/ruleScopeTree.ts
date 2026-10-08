/**
 * 「自选规则」树的纯逻辑（契约 C）：rule-set-tree 响应 → a-tree 数据、勾选联动、提交载荷。
 *
 * 选择状态只存「勾中的规则 id」一份：扫描点是否勾中由「其下规则是否全勾」推导，
 * 这样扫描点 / 单条规则两种粒度不会出现两份真相。提交时整选的扫描点走 scan_point_ids，
 * 其余零散规则走 rule_version_ids（后端：目录成员 ∩（扫描点下规则 ∪ 所选规则））。
 *
 * 域 / 分类节点只做分组（checkable=false）：契约只开放扫描点与规则两级可选。
 */
import type { RuleScopePayload, RuleSetTree, RuleSetTreeScanPoint } from './types'
import { categoryLabel, domainLabels } from '../labels'

/** a-tree 节点（只用到的字段） */
export interface RuleScopeNode {
  key: string
  title: string
  checkable?: boolean
  disableCheckbox?: boolean
  /** 右侧的计数说明（模板 #extra 插槽显示） */
  hint?: string
  children?: RuleScopeNode[]
}

/** 扫描点 ↔ 规则 的索引（勾选联动与载荷推导用） */
export interface RuleScopeIndex {
  rulesBySp: Map<string, string[]>
  spByRule: Map<string, string>
  totalRules: number
}

const SP_PREFIX = 'sp:'
const RULE_PREFIX = 'rv:'

export function spNodeKey(id: string): string {
  return `${SP_PREFIX}${id}`
}

export function ruleNodeKey(id: string): string {
  return `${RULE_PREFIX}${id}`
}

export function buildRuleScopeIndex(tree: RuleSetTree | null): RuleScopeIndex {
  const rulesBySp = new Map<string, string[]>()
  const spByRule = new Map<string, string>()
  for (const domain of tree?.domains ?? []) {
    for (const category of domain.categories) {
      for (const sp of category.scan_points) {
        rulesBySp.set(sp.scan_point_id, sp.rules.map(rule => rule.rule_version_id))
        sp.rules.forEach(rule => spByRule.set(rule.rule_version_id, sp.scan_point_id))
      }
    }
  }
  return { rulesBySp, spByRule, totalRules: spByRule.size }
}

function includesKeyword(keyword: string, ...values: (string | undefined)[]): boolean {
  return values.some(value => (value ?? '').toLowerCase().includes(keyword))
}

/** 扫描点节点；keyword 非空且扫描点本身不命中时只保留命中的规则 */
function scanPointNode(sp: RuleSetTreeScanPoint, keyword: string, keepAll: boolean): RuleScopeNode | null {
  const selfHit = keepAll || includesKeyword(keyword, sp.name, sp.scan_point_key)
  const rules = selfHit ? sp.rules : sp.rules.filter(rule => includesKeyword(keyword, rule.name, rule.rule_key))
  if (!selfHit && rules.length === 0)
    return null
  return {
    key: spNodeKey(sp.scan_point_id),
    title: sp.name || sp.scan_point_key || sp.scan_point_id,
    hint: `${sp.rules.length} 条规则`,
    // 没有规则的扫描点勾了也不会跑任何东西，禁用避免误导
    disableCheckbox: sp.rules.length === 0,
    children: rules.map(rule => ({
      key: ruleNodeKey(rule.rule_version_id),
      title: rule.name || rule.rule_key || rule.rule_version_id,
      hint: rule.rule_key,
    })),
  }
}

/** 规则树 → a-tree 数据；keyword 按 域/分类/扫描点/规则 的名称与 key 模糊过滤（命中上层则保留整枝） */
export function buildRuleScopeNodes(tree: RuleSetTree | null, rawKeyword: string): RuleScopeNode[] {
  const keyword = rawKeyword.trim().toLowerCase()
  const nodes: RuleScopeNode[] = []
  for (const domain of tree?.domains ?? []) {
    const domainTitle = domainLabels[domain.domain] ?? domain.domain
    const domainHit = !keyword || includesKeyword(keyword, domainTitle, domain.domain)
    const categories: RuleScopeNode[] = []
    let domainSp = 0
    let domainRules = 0
    for (const category of domain.categories) {
      const categoryTitle = category.name || categoryLabel(category.code)
      const keepAll = domainHit || includesKeyword(keyword, categoryTitle, category.code)
      const points = category.scan_points
        .map(sp => scanPointNode(sp, keyword, keepAll))
        .filter((node): node is RuleScopeNode => node !== null)
      const ruleCount = category.scan_points.reduce((sum, sp) => sum + sp.rules.length, 0)
      // 域的计数按全量统计（不随搜索变化），与分类/扫描点节点的口径一致
      domainSp += category.scan_points.length
      domainRules += ruleCount
      if (points.length === 0)
        continue
      categories.push({
        key: `cat:${domain.domain}:${category.code}`,
        title: categoryTitle,
        checkable: false,
        hint: `${category.scan_points.length} 个扫描点 · ${ruleCount} 条规则`,
        children: points,
      })
    }
    if (categories.length === 0)
      continue
    nodes.push({
      key: `dom:${domain.domain}`,
      title: domainTitle,
      checkable: false,
      hint: `${domainSp} 个扫描点 · ${domainRules} 条规则`,
      children: categories,
    })
  }
  return nodes
}

/** 展开的 key：无搜索时展开 域 + 分类；有搜索时连扫描点一起展开，命中的规则直接可见 */
export function ruleScopeExpandedKeys(nodes: RuleScopeNode[], searching: boolean): string[] {
  return nodes.flatMap(domain => [
    domain.key,
    ...(domain.children ?? []).flatMap(category => [
      category.key,
      ...(searching ? (category.children ?? []).map(sp => sp.key) : []),
    ]),
  ])
}

/** 勾选 / 取消某个节点 → 新的已选规则 id 列表（扫描点 = 其下全部规则） */
export function toggleRuleScopeKey(checkedRuleIds: string[], index: RuleScopeIndex, key: string, checked: boolean): string[] {
  let targets: string[] = []
  if (key.startsWith(SP_PREFIX))
    targets = index.rulesBySp.get(key.slice(SP_PREFIX.length)) ?? []
  else if (key.startsWith(RULE_PREFIX))
    targets = [key.slice(RULE_PREFIX.length)]
  const next = new Set(checkedRuleIds)
  targets.forEach(id => (checked ? next.add(id) : next.delete(id)))
  return [...next]
}

/** 已选规则 → a-tree 的 checked / half-checked key（扫描点按其下规则全选 / 部分选推导） */
export function ruleScopeTreeKeys(checkedRuleIds: string[], index: RuleScopeIndex): { checked: string[], half: string[] } {
  const selected = new Set(checkedRuleIds)
  const checked = checkedRuleIds.map(ruleNodeKey)
  const half: string[] = []
  for (const [spId, rules] of index.rulesBySp) {
    const hit = rules.filter(id => selected.has(id)).length
    if (hit > 0 && hit === rules.length)
      checked.push(spNodeKey(spId))
    else if (hit > 0)
      half.push(spNodeKey(spId))
  }
  return { checked, half }
}

/** 提交载荷：整选的扫描点 → scan_point_ids；其余零散规则 → rule_version_ids */
export function ruleScopePayload(checkedRuleIds: string[], index: RuleScopeIndex): RuleScopePayload {
  const selected = new Set(checkedRuleIds)
  const fullSps = new Set<string>()
  for (const [spId, rules] of index.rulesBySp) {
    if (rules.length > 0 && rules.every(id => selected.has(id)))
      fullSps.add(spId)
  }
  const looseRules = checkedRuleIds.filter(id => !fullSps.has(index.spByRule.get(id) ?? ''))
  return { scan_point_ids: [...fullSps], rule_version_ids: looseRules }
}
