/**
 * 发版左树状态：mode、加载、展开态、选中高亮与防抖重拉。
 *
 * 结构维度（产品领域 / 业务领域 / 项目组 / 应用 / 处理人 / 规则）变化不重拉树：
 * 点节点只把结构键写回列表，树本身保持稳定不塌缩；其余筛选变化才按 300ms 防抖重拉。
 */
import type { Ref } from 'vue'
import type {
  ReleaseScopeTreeNode,
  ReleaseScopeTreeResponse,
  ReleaseTreeLabels,
  ReleaseTreeScope,
} from '@/types/sechub-release'
import { computed, ref, watch } from 'vue'
import { useFilterPersistence } from '@/hooks'

import {
  ancestorKeys,
  defaultExpandedKeys,
  findNodeByScope,
  treeQueryOf,
} from './releaseScopeTreeRules'

export interface TreeModeOption {
  value: string
  label: string
}

export interface ReleaseScopeTreeOptions {
  fetcher: (query: Record<string, string | number | boolean>) => Promise<ReleaseScopeTreeResponse | null>
  /** 页面当前列表 query（结构键 / 分页键会在 treeQueryOf 里剔除） */
  query: Ref<object>
  /** 当前范围筛选（用于高亮；树内点选后由页面写回） */
  selectedScope: Ref<ReleaseTreeScope>
  modes: Ref<TreeModeOption[]>
  /** useFilterPersistence 的存储键（记住 mode） */
  persistKey: string
}

const RELOAD_DEBOUNCE_MS = 300
const DEFAULT_LABELS = { total: '总数', focus: '重点' }

function indexParents(node: ReleaseScopeTreeNode, parentKey: string, out: Map<string, string>): void {
  out.set(node.key, parentKey)
  for (const child of node.children ?? [])
    indexParents(child, node.key, out)
}

function indexNodes(node: ReleaseScopeTreeNode, out: Map<string, ReleaseScopeTreeNode>): void {
  out.set(node.key, node)
  for (const child of node.children ?? [])
    indexNodes(child, out)
}

/** 路径式 key（pg:a/app:b）上各级节点的显示名：项目组 / 应用 */
function pathLabelsOf(key: string, index: Map<string, ReleaseScopeTreeNode>): ReleaseTreeLabels {
  const labels: ReleaseTreeLabels = {}
  const segments = key.split('/')
  for (let i = 1; i <= segments.length; i++) {
    const node = index.get(segments.slice(0, i).join('/'))
    if (node?.level === 'project_group')
      labels.project_group = node.title
    else if (node?.level === 'app')
      labels.app_number = node.title
  }
  return labels
}

export function useReleaseScopeTree(options: ReleaseScopeTreeOptions) {
  const loading = ref(false)
  const root = ref<ReleaseScopeTreeNode | null>(null)
  const labels = ref(DEFAULT_LABELS)
  const expandedKeys = ref<string[]>([])
  const mode = ref(options.modes.value[0]?.value ?? 'project_group')

  useFilterPersistence(options.persistKey, { mode })

  const nodeIndex = computed(() => {
    const out = new Map<string, ReleaseScopeTreeNode>()
    if (root.value)
      indexNodes(root.value, out)
    return out
  })
  let initialized = false

  const selectedKey = computed(() =>
    findNodeByScope(root.value, options.selectedScope.value)?.key ?? '',
  )
  const selectedKeys = computed(() => selectedKey.value ? [selectedKey.value] : [])

  async function load(resetExpansion = false): Promise<void> {
    loading.value = true
    try {
      const data = await options.fetcher(treeQueryOf(options.query.value, mode.value))
      const nextRoot = data?.root ?? null
      root.value = nextRoot
      if (data?.labels)
        labels.value = data.labels
      const parents = new Map<string, string>()
      if (nextRoot)
        indexParents(nextRoot, '', parents)
      const kept = resetExpansion || !initialized
        ? defaultExpandedKeys(nextRoot)
        : expandedKeys.value.filter(key => parents.has(key))
      initialized = true
      expandedKeys.value = nextRoot
        ? [...new Set([...kept, ...ancestorKeys(nextRoot, selectedKey.value)])]
        : []
    }
    finally {
      loading.value = false
    }
  }

  /** 树请求签名：剔除结构键与分页键，点节点不会触发重拉 */
  const querySignature = computed(() => {
    const query = treeQueryOf(options.query.value ?? {}, mode.value)
    delete query.mode
    return JSON.stringify(query)
  })

  let debounceTimer: ReturnType<typeof setTimeout> | undefined
  watch(querySignature, () => {
    if (debounceTimer)
      clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => void load(), RELOAD_DEBOUNCE_MS)
  })

  // 选中节点的祖先链自动展开（页面通过筛选条改选时同样生效）
  watch(selectedKey, (key) => {
    if (!root.value || !key)
      return
    expandedKeys.value = [...new Set([...expandedKeys.value, ...ancestorKeys(root.value, key)])]
  })

  // 切维度：旧维度的选中 / 展开没有意义，回到默认展开
  watch(mode, () => void load(true))

  void load()

  /** 供页面在生成缺陷 / 加白后主动刷新 */
  function reload(): void {
    void load()
  }

  /** Arco select 的 keys → 节点 scope；空数组表示再次点击取消，回到根 */
  function resolveScope(keys: (string | number)[]): ReleaseTreeScope {
    if (!keys.length)
      return {}
    const key = String(keys[0])
    const node = nodeIndex.value.get(key)
    if (!node)
      return {}
    return { ...node.scope, labels: pathLabelsOf(key, nodeIndex.value) }
  }

  return {
    mode,
    loading,
    root,
    labels,
    expandedKeys,
    selectedKeys,
    resolveScope,
    reload,
  }
}
