/**
 * 规则分布左树的统一层级：域 → 分类（中文）→ 扫描点 → 规则（与规则版本页同口径）。
 *
 * 纯函数、不碰接口：结果页（候选按规则聚合的 RuleStatRow）与缺陷页（后端 issue-scope-tree
 * 的 dom → sp → rule 树）各有一个入口，分类都按「扫描点树」映射取（缺映射时退回行上自带的分类）。
 *
 * 分类节点不可选中（selectable=false）：候选/缺陷列表接口都没有 category 过滤参数，
 * 让它可点只会把列表范围和节点计数对不上；它只是分组，展开即可下钻到扫描点。
 */
import type { ScanPointCategoryMap } from './useScanPointCategories'
import type { IssueScopeCounts, IssueScopeNode, RuleStatRow } from '@/types/static-scan'
import { categoryLabel, domainLabels } from '../labels'

/** 分类缺失时的占位 key（映射与行字段都拿不到分类） */
const UNCATEGORIZED = '未分类'

/** 结果页左树节点（Arco a-tree 数据；stats = 该节点子树的 确认/待确认/已排除/总数 合计） */
export interface RuleStatTreeNode {
  key: string
  title: string
  selectable?: boolean
  stats?: { confirmed: number, pending: number, rejected: number, total: number }
  rule?: RuleStatRow
  children?: RuleStatTreeNode[]
}

/** 分类节点 key：带域前缀，避免不同域下同名分类撞 key */
function categoryKey(domain: string, category: string): string {
  return `cat:${domain}:${category}`
}

/** 按 key 分组并保留首次出现顺序 */
function groupBy<T>(items: T[], keyOf: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const key = keyOf(item)
    const bucket = groups.get(key)
    if (bucket)
      bucket.push(item)
    else
      groups.set(key, [item])
  }
  return groups
}

function sumStats(rules: RuleStatRow[]): NonNullable<RuleStatTreeNode['stats']> {
  return {
    confirmed: rules.reduce((sum, r) => sum + r.confirmed, 0),
    pending: rules.reduce((sum, r) => sum + r.pending + r.error + r.review_needed, 0),
    rejected: rules.reduce((sum, r) => sum + r.rejected, 0),
    total: rules.reduce((sum, r) => sum + r.total, 0),
  }
}

/** 扫描点的分类：映射优先（与规则版本页同源），缺映射退回候选行自带的分类 */
function categoryOfRow(row: RuleStatRow, categories: ScanPointCategoryMap): string {
  return categories.get(row.scan_point_id)?.category || row.category || UNCATEGORIZED
}

/** 结果页：RuleStatRow（按规则聚合）→ 全部 → 域 → 分类 → 扫描点 → 规则 */
export function buildRuleStatTree(rows: RuleStatRow[], categories: ScanPointCategoryMap): RuleStatTreeNode[] {
  const domainNodes = [...groupBy(rows, r => r.domain || UNCATEGORIZED)].map(([domain, domainRows]) => ({
    key: `domain:${domain}`,
    title: domainLabels[domain] ?? domain,
    stats: sumStats(domainRows),
    children: [...groupBy(domainRows, r => categoryOfRow(r, categories))].map(([category, categoryRows]) => ({
      key: categoryKey(domain, category),
      title: categoryLabel(category),
      selectable: false,
      stats: sumStats(categoryRows),
      children: [...groupBy(categoryRows, r => r.scan_point_id || 'unknown')].map(([spId, spRules]) => ({
        key: `sp:${spId}`,
        title: spRules[0]?.scan_point_name || spId,
        stats: sumStats(spRules),
        children: spRules.map(r => ({ key: r.rule_version_id, title: r.rule_name, rule: r })),
      })),
    })),
  }))
  return [{ key: 'all', title: '全部', children: domainNodes }]
}

/** 默认展开：根 + 域 + 分类（扫描点层折叠，避免规则多时整棵树过长） */
export function defaultRuleTreeExpandedKeys(tree: RuleStatTreeNode[]): string[] {
  return tree.flatMap(root => [
    root.key,
    ...(root.children ?? []).flatMap(domain => [domain.key, ...(domain.children ?? []).map(category => category.key)]),
  ])
}

function addCounts(target: IssueScopeCounts, source: IssueScopeCounts): void {
  target.total += source.total
  target.pending += source.pending
  target.in_progress += source.in_progress
  target.handled += source.handled
  target.wont_fix += source.wont_fix
}

/** 缺陷页树节点 + 分类层的可选标记 */
export type IssueScopeTreeNode = IssueScopeNode & { selectable?: boolean, children: IssueScopeTreeNode[] }

/**
 * 缺陷页「规则分布」：后端 dom → sp → rule 之间插入分类层（计数为子扫描点合计）。
 * 只处理 `dom:` 节点；其他维度（项目组/业务领域/产品领域）原样返回。
 */
export function insertIssueCategoryLevel(root: IssueScopeNode, categories: ScanPointCategoryMap): IssueScopeTreeNode {
  const withCategories = (node: IssueScopeNode): IssueScopeTreeNode => {
    if (!node.key.startsWith('dom:'))
      return { ...node, children: node.children.map(withCategories) }
    const domain = node.key.slice(4)
    const groups = groupBy(node.children, (sp) => {
      const spId = sp.key.startsWith('sp:') ? sp.key.slice(3) : ''
      return categories.get(spId)?.category || UNCATEGORIZED
    })
    const children = [...groups].map(([category, points]): IssueScopeTreeNode => {
      const counts: IssueScopeCounts = { total: 0, pending: 0, in_progress: 0, handled: 0, wont_fix: 0 }
      points.forEach(point => addCounts(counts, point.counts))
      return {
        key: categoryKey(domain, category),
        title: categoryLabel(category),
        level: 'category',
        selectable: false,
        counts,
        children: points.map(point => ({ ...point, children: point.children.map(withCategories) })),
      }
    })
    return { ...node, children }
  }
  return withCategories(root)
}
