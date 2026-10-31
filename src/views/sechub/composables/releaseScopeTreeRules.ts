/**
 * 发版左树纯规则：查询参数裁剪、范围匹配、节点查找、展开 / 过滤 / 计数文案。
 *
 * 独立成模块（同 `releaseScopeRules.ts`）是为了脱离 Vue / 请求层单测。
 */
import type {
  ReleaseScopeTreeNode,
  ReleaseTreeCounts,
  ReleaseTreeScope,
} from '@/types/sechub-release'

/** 树自身聚合用的结构维度：它们变化只收窄列表，不能回流进树请求 */
export const TREE_STRUCTURE_KEYS = [
  'product_domains',
  'business_area',
  'project_group',
  'app_number',
  'handler',
  'rule_code',
] as const

const STRUCTURE_KEY_SET = new Set<string>(TREE_STRUCTURE_KEYS)
const PAGING_KEYS = new Set(['page_num', 'page_size'])
/** 参与筛选与比较的字段（labels 只用于显示，不在其中） */
const SCOPE_FIELDS: Array<Exclude<keyof ReleaseTreeScope, 'labels'>> = [
  'product_domain',
  'business_area',
  'project_group',
  'app_number',
  'handler',
  'rule_code',
]

function queryValue(value: unknown): string | number | boolean | undefined {
  if (typeof value === 'string')
    return value === '' ? undefined : value
  if (typeof value === 'number')
    return Number.isFinite(value) ? value : undefined
  if (typeof value === 'boolean')
    return value
  return undefined
}

/** 树请求参数：去掉结构键、分页键与空值，追加 mode */
export function treeQueryOf<Q extends object>(
  query: Q,
  mode: string,
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {}
  for (const [key, raw] of Object.entries(query as Record<string, unknown>)) {
    if (STRUCTURE_KEY_SET.has(key) || PAGING_KEYS.has(key))
      continue
    const value = queryValue(raw)
    if (value !== undefined)
      out[key] = value
  }
  out.mode = mode
  return out
}

function scopeValue(value: string | undefined): string {
  return value?.trim() ?? ''
}

function hasScope(scope: ReleaseTreeScope): boolean {
  return SCOPE_FIELDS.some(field => scopeValue(scope[field]) !== '')
}

/** 两个范围是否指向同一节点（忽略空值） */
export function sameScope(a: ReleaseTreeScope, b: ReleaseTreeScope): boolean {
  return SCOPE_FIELDS.every(field => scopeValue(a[field]) === scopeValue(b[field]))
}

/** 深度优先找 scope 完全相等的最深节点；空 scope 返回根 */
export function findNodeByScope(
  root: ReleaseScopeTreeNode | null | undefined,
  scope: ReleaseTreeScope,
): ReleaseScopeTreeNode | null {
  if (!root)
    return null
  if (!hasScope(scope))
    return root

  let best: ReleaseScopeTreeNode | null = null
  let bestDepth = -1
  function walk(node: ReleaseScopeTreeNode, depth: number): void {
    if (sameScope(node.scope, scope)) {
      best = node
      bestDepth = depth
    }
    for (const child of node.children ?? [])
      walk(child, depth + 1)
  }
  walk(root, 0)
  return bestDepth >= 0 ? best : null
}

function indexParents(
  node: ReleaseScopeTreeNode,
  parentKey: string,
  out: Map<string, string>,
): void {
  out.set(node.key, parentKey)
  for (const child of node.children ?? [])
    indexParents(child, node.key, out)
}

/** 祖先 key（不含自身，由近到远） */
export function ancestorKeys(root: ReleaseScopeTreeNode | null | undefined, key: string): string[] {
  if (!root)
    return []
  const parents = new Map<string, string>()
  indexParents(root, '', parents)
  const out: string[] = []
  let current = key ? parents.get(key) : undefined
  while (current) {
    out.push(current)
    current = parents.get(current)
  }
  return out
}

/** 默认展开：根 + 第一层 */
export function defaultExpandedKeys(root: ReleaseScopeTreeNode | null | undefined): string[] {
  if (!root)
    return []
  return [root.key, ...(root.children ?? []).map(child => child.key)]
}

function filterNode(node: ReleaseScopeTreeNode, keyword: string): ReleaseScopeTreeNode | null {
  const children = (node.children ?? [])
    .map(child => filterNode(child, keyword))
    .filter((child): child is ReleaseScopeTreeNode => child !== null)
  const matched = node.title.toLowerCase().includes(keyword)
  if (!matched && children.length === 0)
    return null
  return { ...node, children }
}

/** 保留 title 命中关键词的节点及其祖先；关键词为空时原样返回 */
export function filterTreeByKeyword(
  root: ReleaseScopeTreeNode | null | undefined,
  keyword: string,
): ReleaseScopeTreeNode | null {
  if (!root)
    return null
  const normalized = keyword.trim().toLowerCase()
  if (!normalized)
    return root
  return filterNode(root, normalized)
}

/** 节点悬浮提示文案，labels 由后端下发 */
export function countsText(
  counts: ReleaseTreeCounts,
  labels: { total: string, focus: string },
): string {
  return `${labels.focus} ${counts.focus} / ${labels.total} ${counts.total}`
}
