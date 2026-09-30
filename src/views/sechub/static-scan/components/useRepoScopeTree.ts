/**
 * 运行页左侧「应用范围」树的全部数据与选中逻辑（组件 RepoScopeTree.vue 只做渲染）。
 *
 * 树结构与扫描看板（scan-dashboard.vue）同构：同样的三个组织维度、同样的节点 key
 * 语义（root / grp: / sub: / app:），"选中"的含义也一致 —— 只有点中 app 节点才算
 * 选中了某个仓库（看板据此过滤概览，运行页据此过滤运行记录、并放行「新建扫描」）。
 * 拆成组合式函数是为了让看板后续复用这套仓库树数据/选中状态时不依赖运行页组件。
 *
 * 为什么带持久化：本页被 keep-alive 以 route.fullPath 为 key，只要 URL 的 query
 * 变一下（例如从看板带 ?new_scan=1 跳来），实例就会重建、ref 全回初始值。页面原有
 * 的 useFilterPersistence 只暂存了筛选项，这里把树的范围（维度 + 选中 key）一并
 * 暂存，切走再回来看到的还是同一棵树、同一个范围。
 */
import type { ModuleWithRepository } from '@/types/static-scan'
import { computed, onMounted, ref, watch } from 'vue'
import { useFilterPersistence } from '@/hooks'
import { fetchScopeRepositories } from './service'

/** 组织维度（与看板一致） */
export type ScopeDimension = 'project_group' | 'business_area' | 'product_domain'

/** 根节点 key：选中 = 不限范围 */
export const ROOT_KEY = 'root'

/** 维度 → 仓库行上的字段名（与看板 dimFieldMap 一致） */
const DIM_FIELD: Record<ScopeDimension, keyof ModuleWithRepository> = {
  project_group: 'project_group_name',
  business_area: 'business_area',
  product_domain: 'product_domain',
}

export interface RepoScopeNode {
  key: string
  title: string
  level: 'root' | 'group' | 'sub' | 'app'
  repository_id?: string
  children?: RepoScopeNode[]
}

/** 当前选中的范围，由 change 事件交给调用方去筛列表 / 判断按钮可用性 */
export interface RepoScope {
  /** 选中的具体仓库 id（只有点中 app 节点才非空） */
  repositoryId: string
  /** 范围内仓库 id 列表；null = 全部（根节点）。分组/子分组节点靠它在本地筛运行行 */
  repositoryIds: string[] | null
  /** 范围名称（已去掉计数后缀），用于界面提示 */
  label: string
}

export function useRepoScopeTree() {
  const repositories = ref<ModuleWithRepository[]>([])
  const loading = ref(false)

  const dimension = ref<ScopeDimension>('project_group')
  const treeSearch = ref('')
  const showCode = ref(false)
  const selectedKey = ref(ROOT_KEY)
  const expandedKeys = ref<string[]>([])

  // ── 树数据（结构与看板一致：项目组维度两层，其余维度三层）──
  /** 维度取值：空归类到「未分类」，与看板口径一致 */
  function dimValueOf(repo: ModuleWithRepository): string {
    return String(repo[DIM_FIELD[dimension.value]] ?? '') || '未分类'
  }

  const treeData = computed<RepoScopeNode[]>(() => {
    const groups = new Map<string, ModuleWithRepository[]>()
    for (const repo of repositories.value) {
      const value = dimValueOf(repo)
      const bucket = groups.get(value)
      if (bucket)
        bucket.push(repo)
      else
        groups.set(value, [repo])
    }

    const buildAppNode = (app: ModuleWithRepository): RepoScopeNode => ({
      key: `app:${app.repository_id}`,
      // 反编译源码库没有业务模块名，后端用仓库名/编码兜底填了 module_name/module_code
      title: showCode.value ? `${app.module_name}（${app.module_code}）` : app.module_name,
      level: 'app',
      repository_id: app.repository_id,
    })
    const byModuleName = (a: ModuleWithRepository, b: ModuleWithRepository) => a.module_name.localeCompare(b.module_name, 'zh-CN')

    const sortedGroups = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], 'zh-CN'))
    let groupNodes: RepoScopeNode[]
    if (dimension.value === 'project_group') {
      groupNodes = sortedGroups.map(([name, apps]) => ({
        key: `grp:${name}`,
        title: `${name} (${apps.length})`,
        level: 'group' as const,
        children: [...apps].sort(byModuleName).map(buildAppNode),
      }))
    }
    else {
      groupNodes = sortedGroups.map(([name, apps]) => {
        const subGroups = new Map<string, ModuleWithRepository[]>()
        for (const app of apps) {
          const pg = app.project_group_name || '未分类'
          const bucket = subGroups.get(pg)
          if (bucket)
            bucket.push(app)
          else
            subGroups.set(pg, [app])
        }
        return {
          key: `grp:${name}`,
          title: `${name} (${apps.length})`,
          level: 'group' as const,
          children: [...subGroups.entries()]
            .sort((a, b) => a[0].localeCompare(b[0], 'zh-CN'))
            .map(([pgName, pgApps]) => ({
              key: `sub:${name}:${pgName}`,
              title: `${pgName} (${pgApps.length})`,
              level: 'sub' as const,
              children: [...pgApps].sort(byModuleName).map(buildAppNode),
            })),
        }
      })
    }

    if (groupNodes.length === 0)
      return []
    return [{ key: ROOT_KEY, title: `全部 (${repositories.value.length})`, level: 'root', children: groupNodes }]
  })

  function filterTree(nodes: RepoScopeNode[], kw: string): RepoScopeNode[] {
    return nodes
      .map((node) => {
        if (node.title.toLowerCase().includes(kw))
          return node
        const children = node.children ? filterTree(node.children, kw) : []
        if (children.length)
          return { ...node, children }
        return null
      })
      .filter((node): node is RepoScopeNode => node !== null)
  }

  const displayTree = computed(() => {
    const kw = treeSearch.value.toLowerCase()
    return kw ? filterTree(treeData.value, kw) : treeData.value
  })

  // ── 选中 → 范围 ──
  function findNode(nodes: RepoScopeNode[], key: string): RepoScopeNode | undefined {
    for (const node of nodes) {
      if (node.key === key)
        return node
      const hit = node.children ? findNode(node.children, key) : undefined
      if (hit)
        return hit
    }
    return undefined
  }

  /** 组 → 仓库 id 集合。key 里只存了显示名，这里按当前维度反查（与看板口径一致） */
  const scopeRepoIds = computed<string[] | null>(() => {
    const key = selectedKey.value
    if (!key || key === ROOT_KEY)
      return null
    if (key.startsWith('app:'))
      return [key.slice(4)]
    if (key.startsWith('grp:')) {
      const name = key.slice(4)
      return repositories.value.filter(repo => dimValueOf(repo) === name).map(repo => repo.repository_id)
    }
    if (key.startsWith('sub:')) {
      const rest = key.slice(4)
      // 分组名本身可能含 ':'，只按第一个分隔符切成「维度值 + 项目组名」
      const sep = rest.indexOf(':')
      const group = rest.slice(0, sep)
      const projectGroup = rest.slice(sep + 1)
      return repositories.value
        .filter(repo => dimValueOf(repo) === group && (repo.project_group_name || '未分类') === projectGroup)
        .map(repo => repo.repository_id)
    }
    return null
  })

  const selectedRepoId = computed(() => (selectedKey.value.startsWith('app:') ? selectedKey.value.slice(4) : ''))

  const scopeLabel = computed(() => {
    const key = selectedKey.value
    if (!key || key === ROOT_KEY)
      return '全部'
    const node = findNode(treeData.value, key)
    // 标题带「 (N)」计数，去掉计数作为范围名；仓库未出现在树里（如已解绑）时退回仓库 id
    return node ? node.title.replace(/\s*\(\d+\)$/, '') : selectedRepoId.value || key
  })

  const scope = computed<RepoScope>(() => ({
    repositoryId: selectedRepoId.value,
    repositoryIds: scopeRepoIds.value,
    label: scopeLabel.value,
  }))

  /**
   * 范围指纹：scope 是计算属性，无关依赖（如仓库列表加载完成）也会算出新对象身份，
   * 跨组件通知前先用它比对是否真的变了，避免对同一范围重复触发重载。
   */
  const scopeFingerprint = computed(() =>
    `${selectedRepoId.value}|${scopeRepoIds.value?.join(',') ?? '*'}|${scopeLabel.value}`,
  )

  // ── 交互 ──
  /** 默认展开根与第一层分组（Arco 的 default-expand-all 在受控 expandedKeys 下不生效） */
  function expandTopLevels() {
    const root = treeData.value[0]
    expandedKeys.value = root ? [root.key, ...(root.children ?? []).map(child => child.key)] : []
  }

  function onDimensionChange() {
    // 换维度后旧节点（按显示名编码）在新维度里没有意义，回到全部，与看板一致
    selectedKey.value = ROOT_KEY
    expandTopLevels()
  }

  function onTreeSelect(keys: (string | number)[]) {
    // 再次点击已选节点会被 Arco 取消选中（空数组），语义上等价于点「全部」
    selectedKey.value = keys.length ? String(keys[0]) : ROOT_KEY
  }

  /** 供运行页在路由预填（?repository_id=）时直接选中该仓库 */
  function selectRepo(repositoryId: string) {
    if (!repositoryId)
      return
    // 树可能还没加载完：先记下选中，数据到位后自然高亮（展开也在 load 完成时重算）
    selectedKey.value = `app:${repositoryId}`
    expandTopLevels()
  }

  // ── 加载与持久化 ──
  let requested = false
  async function load() {
    loading.value = true
    try {
      repositories.value = await fetchScopeRepositories() ?? []
      expandTopLevels()
    }
    finally {
      loading.value = false
    }
  }

  // 恢复暂存的选择 → 再拉列表（同一挂载周期内先后执行，数据到位时选中已就绪）
  useFilterPersistence('static-scan-runs-scope', { dimension, selectedKey })
  onMounted(() => {
    if (requested)
      return
    requested = true
    void load()
  })

  // 搜索时展开全部命中路径，否则深层命中的节点藏在折叠的分组里
  watch(treeSearch, (kw) => {
    if (!kw) {
      expandTopLevels()
      return
    }
    const keys: string[] = []
    const collect = (nodes: RepoScopeNode[]) => {
      for (const node of nodes) {
        keys.push(node.key)
        if (node.children)
          collect(node.children)
      }
    }
    collect(displayTree.value)
    expandedKeys.value = keys
  })

  return {
    repositories,
    loading,
    dimension,
    treeSearch,
    showCode,
    selectedKey,
    expandedKeys,
    treeData,
    displayTree,
    scope,
    scopeFingerprint,
    expandTopLevels,
    onDimensionChange,
    onTreeSelect,
    selectRepo,
  }
}
