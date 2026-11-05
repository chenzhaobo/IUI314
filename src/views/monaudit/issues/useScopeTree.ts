/**
 * 问题清单左树：维度切换、防抖重拉、展开态保持。
 *
 * 口径与后端 issue::tree 一致：树请求带右侧筛选但不带左树范围，
 * 所以点节点只收窄右侧列表，树本身不塌缩；筛选变化才重算计数。
 */
import type { Ref } from 'vue'
import type { IssueScope, ScopeMode, ScopeTreeNode } from './types'
import { onBeforeUnmount, ref, watch } from 'vue'
import { fetchIssueTree } from './service'

/** 筛选连续变化时只发最后一次 */
const RELOAD_DEBOUNCE_MS = 300

function indexNodes(node: ScopeTreeNode, parent: string, out: Map<string, { parent: string, node: ScopeTreeNode }>): void {
  out.set(node.key, { parent, node })
  for (const child of node.children ?? [])
    indexNodes(child, node.key, out)
}

export function useScopeTree(filters: Ref<object>, onScope: (scope: IssueScope) => void) {
  const mode = ref<ScopeMode>('project_group')
  const loading = ref(false)
  const tree = ref<ScopeTreeNode[]>([])
  const selectedKeys = ref<string[]>([])
  const expandedKeys = ref<string[]>([])
  let index = new Map<string, { parent: string, node: ScopeTreeNode }>()
  let seq = 0

  async function load(resetSelection = false) {
    const current = ++seq
    loading.value = true
    try {
      if (resetSelection) {
        selectedKeys.value = []
        onScope({})
      }
      const root = await fetchIssueTree({ ...filters.value, mode: mode.value })
      if (current !== seq)
        return
      tree.value = root?.key ? [root] : []
      index = new Map()
      if (root?.key)
        indexNodes(root, '', index)
      const kept = resetSelection || !expandedKeys.value.length
        ? [root?.key ?? '', ...(root?.children ?? []).map(c => c.key)].filter(Boolean)
        : expandedKeys.value.filter(k => index.has(k))
      const selected = selectedKeys.value[0]
      const ancestors: string[] = []
      let cursor = selected ? index.get(selected)?.parent : undefined
      while (cursor) {
        ancestors.push(cursor)
        cursor = index.get(cursor)?.parent
      }
      expandedKeys.value = [...new Set([...kept, ...ancestors])]
      if (selected && !index.has(selected))
        selectedKeys.value = []
    }
    finally {
      if (current === seq)
        loading.value = false
    }
  }

  /** 点节点：根节点 = 清空范围 */
  function select(keys: (string | number)[]) {
    const key = keys.length ? String(keys[0]) : ''
    const hit = key ? index.get(key) : undefined
    selectedKeys.value = key ? [key] : []
    onScope(!hit || hit.node.level === 'root' ? {} : { ...hit.node.scope })
  }

  let timer: ReturnType<typeof setTimeout> | undefined
  watch(() => JSON.stringify(filters.value), () => {
    if (timer)
      clearTimeout(timer)
    timer = setTimeout(() => void load(), RELOAD_DEBOUNCE_MS)
  })
  onBeforeUnmount(() => {
    if (timer)
      clearTimeout(timer)
  })

  return { mode, loading, tree, selectedKeys, expandedKeys, load, select }
}
