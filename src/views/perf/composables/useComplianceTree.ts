/**
 * 达标率左树的加载 / 懒加载 / 选中节点 → 请求参数。
 *
 * 客户与版本维度里，同一个应用会挂在多个客户分支下；后端为 app 节点附带
 * `context_key/context_value`，本 composable 负责在展开表单、穿透明细时
 * 把这层上下文一起带上，避免不同客户分支的数据串在一起。
 */
import { computed, ref, type Ref } from 'vue'
import { ApiPerfCompliance, type ComplianceDrillItem, type ComplianceTreeNode } from '@/api/perfApis'
import { useGet } from '@/hooks'

/** 维度层级 → 请求参数名 */
export const DIMENSION_PARAM: Record<string, string> = {
  project_group: 'project_group_code',
  business_area: 'business_area',
  product_domain: 'product_domain',
  customer: 'customer',
  product_version: 'product_version',
  cosmic_version: 'cosmic_version',
}

/** 维度切换下拉选项（看板与趋势共用） */
export const DIMENSION_OPTIONS = [
  { label: '菜单', value: 'menu' },
  { label: '项目组', value: 'project_group' },
  { label: '业务领域', value: 'business_area' },
  { label: '产品领域', value: 'product_domain' },
  { label: '客户', value: 'customer' },
  { label: '产品版本', value: 'product_version' },
  { label: '苍穹版本', value: 'cosmic_version' },
] as const

/** 客户/版本树节点上下文列 → 请求参数名 */
const CONTEXT_PARAM: Record<string, string> = {
  customer_name: 'customer',
  customer_product_version: 'product_version',
  customer_cosmic_version: 'cosmic_version',
}

/** 维度顶层节点 → 其下 app 节点应携带的上下文列 */
const DIMENSION_CONTEXT: Record<string, string> = {
  customer: 'customer_name',
  product_version: 'customer_product_version',
  cosmic_version: 'customer_cosmic_version',
}

/** 把树节点的上下文列翻译成请求参数；无上下文返回空对象 */
export function contextParams(node: { context_key?: string; context_value?: string }): Record<string, string> {
  const param = node.context_key ? CONTEXT_PARAM[node.context_key] : ''
  return param && node.context_value ? { [param]: node.context_value } : {}
}

export interface ComplianceTreeOptions {
  productLine: Ref<string>
  periodType: Ref<string>
  selectedPeriod: Ref<string>
  dimension: Ref<string>
  complianceFilter?: Ref<string>
  customFilter: Ref<string>
  dimFilterParams: () => Record<string, string>
}

export function useComplianceTree(options: ComplianceTreeOptions) {
  const { productLine, periodType, selectedPeriod, dimension, complianceFilter, customFilter, dimFilterParams } = options

  const treeData = ref<ComplianceTreeNode[]>([])
  const treeLoading = ref(false)
  const treeSearch = ref('')
  const selectedKeys = ref<string[]>([])
  const showCode = ref(false)

  const treePayload = ref<Record<string, unknown>>({})
  const { execute: fetchTree } = useGet<ComplianceTreeNode[]>(ApiPerfCompliance.tree, treePayload, {
    immediate: false,
    onSuccess(data) {
      treeData.value = Array.isArray(data) ? data : []
    },
  })

  const baseParams = (): Record<string, unknown> => {
    const params: Record<string, unknown> = {
      period_type: periodType.value,
      period: selectedPeriod.value,
      product_line: productLine.value,
      ...dimFilterParams(),
    }
    if (complianceFilter?.value) params.compliance_filter = complianceFilter.value
    if (customFilter.value) params.custom_filter = customFilter.value
    return params
  }

  const reloadTree = () => {
    if (!selectedPeriod.value) return
    treePayload.value = { ...baseParams(), dimension: dimension.value }
    treeLoading.value = true
    fetchTree().finally(() => {
      treeLoading.value = false
    })
  }

  /** 包装「全部」根节点（聚合顶层节点统计量），便于总览全局并逐层穿透 */
  const wrappedTree = computed<ComplianceTreeNode[]>(() => {
    if (!treeData.value.length) return []
    const totalCount = treeData.value.reduce((sum, node) => sum + (node.total_count || 0), 0)
    const over3sCount = treeData.value.reduce((sum, node) => sum + (node.over_3s_count || 0), 0)
    return [{
      key: 'root:all',
      code: 'all',
      title: '全部',
      level: 'root',
      total_count: totalCount,
      over_3s_count: over3sCount,
      compliance_rate: totalCount > 0 ? ((totalCount - over3sCount) / totalCount) * 100 : 100,
      is_leaf: false,
      children: treeData.value,
    }]
  })

  const displayTitle = (node: ComplianceTreeNode) => {
    if (!showCode.value) return node.title
    return node.title && node.title !== node.code ? `${node.title} (${node.code})` : node.code
  }

  const findTreeNode = (nodes: ComplianceTreeNode[], key: string): ComplianceTreeNode | null => {
    for (const node of nodes) {
      if (node.key === key) return node
      if (node.children?.length) {
        const found = findTreeNode(node.children, key)
        if (found) return found
      }
    }
    return null
  }

  const findTreePath = (nodes: ComplianceTreeNode[], key: string, trail: ComplianceTreeNode[] = []): ComplianceTreeNode[] => {
    for (const node of nodes) {
      const path = [...trail, node]
      if (node.key === key) return path
      if (node.children?.length) {
        const found = findTreePath(node.children, key, path)
        if (found.length) return found
      }
    }
    return []
  }

  const dimensionNodeFilter = (level: string, code: string): Record<string, string> => {
    const param = DIMENSION_PARAM[level]
    return param ? { [param]: code } : {}
  }

  const dimensionNodeContext = (level: string, code: string): { context_key?: string; context_value?: string } => {
    const contextKey = DIMENSION_CONTEXT[level]
    return contextKey ? { context_key: contextKey, context_value: code } : {}
  }

  const mapDrillItems = (items: ComplianceDrillItem[], parent: ComplianceTreeNode): ComplianceTreeNode[] => {
    const inheritedContext = parent.context_key && parent.context_value
      ? { context_key: parent.context_key, context_value: parent.context_value }
      : dimensionNodeContext(parent.level, parent.code)
    // 表单编码可能被多个应用复用（实测 im/sm/vmi 都有 im_saloutbill），
    // 展开按钮时必须带上所属应用，否则会把其他应用的同名表单算进来。
    const appNumber = parent.level === 'app' ? parent.code : parent.app_number
    return items
      .map(item => ({
        key: dimension.value === 'menu' ? `${item.level}:${item.code}` : `${parent.key}/${item.level}:${item.code}`,
        code: item.code,
        title: item.name,
        level: item.level,
        total_count: item.total_count,
        over_3s_count: item.over_3s_count,
        compliance_rate: item.compliance_rate,
        is_leaf: item.level === 'button',
        ...inheritedContext,
        ...(appNumber ? { app_number: appNumber } : {}),
        children: [] as ComplianceTreeNode[],
      }))
      .sort((a, b) => b.total_count - a.total_count)
  }

  const lazyDrillPayload = ref<Record<string, unknown>>({})
  const lazyDrill = useGet<ComplianceDrillItem[]>(ApiPerfCompliance.drill, lazyDrillPayload, { immediate: false })

  /** 展开非叶子节点时懒加载子节点 */
  const onLoadMore = async (node: ComplianceTreeNode) => {
    const params = baseParams()
    if (node.level === 'app') {
      params.level = 'form'
      params.app_number = node.code
      Object.assign(params, contextParams(node))
    } else if (node.level === 'form') {
      params.level = 'button'
      params.form_id = node.code
      if (node.app_number) params.app_number = node.app_number
      Object.assign(params, contextParams(node))
    } else if (DIMENSION_PARAM[node.level]) {
      params.level = 'app'
      Object.assign(params, dimensionNodeFilter(node.level, node.code))
    } else {
      return
    }
    lazyDrillPayload.value = params
    await lazyDrill.execute()
    const items = Array.isArray(lazyDrill.data.value) ? lazyDrill.data.value : []
    const children = mapDrillItems(items, node)
    node.children = children
    if (!children.length) node.is_leaf = true
    // 搜索过滤模式下 node 为拷贝对象，需把子节点同步回原始树
    const origin = findTreeNode(treeData.value, node.key)
    if (origin && origin !== node) {
      origin.children = children
      if (!children.length) origin.is_leaf = true
    }
  }

  const onTreeSelect = (keys: (string | number)[]) => {
    selectedKeys.value = keys.map(String)
  }

  /** 搜索过滤树（仅影响渲染视图，treeData 始终保持完整树，懒加载子节点可正常回写） */
  const displayTree = computed<ComplianceTreeNode[]>(() => {
    if (!treeSearch.value) return wrappedTree.value
    const keyword = treeSearch.value.toLowerCase()
    const filterNodes = (nodes: ComplianceTreeNode[]): ComplianceTreeNode[] => {
      return nodes.reduce((result: ComplianceTreeNode[], node) => {
        const children = node.children?.length ? filterNodes(node.children) : []
        if (node.title?.toLowerCase().includes(keyword) || children.length) {
          result.push({ ...node, children })
        }
        return result
      }, [])
    }
    return filterNodes(wrappedTree.value)
  })

  /** 构建树节点选中后的 drill 请求参数 */
  const buildDrillParams = (): Record<string, unknown> => {
    const params = baseParams()
    params.level = dimension.value === 'menu' ? 'cloud' : dimension.value
    if (!selectedKeys.value.length) return params

    const nodeKey = selectedKeys.value[0]
    // 「全部」根节点：菜单维度展示云级汇总；归类/客户/版本维度展示该维度
    // 下一级（即维度值本身）的汇总，与左树顶层节点一致。
    if (nodeKey === 'root:all') return params
    const node = findTreeNode(treeData.value, nodeKey)
    if (!node) return params

    if (dimension.value === 'menu') {
      if (node.level === 'cloud') {
        params.level = 'app'
        params.cloud_number = node.code
      } else if (node.level === 'app') {
        params.level = 'form'
        params.app_number = node.code
      } else if (node.level === 'form') {
        params.level = 'button'
        params.form_id = node.code
      }
    } else if (node.level === dimension.value) {
      params.level = 'app'
      Object.assign(params, dimensionNodeFilter(node.level, node.code))
    } else if (node.level === 'app') {
      params.level = 'form'
      params.app_number = node.code
      Object.assign(params, contextParams(node))
    } else if (node.level === 'form') {
      params.level = 'button'
      params.form_id = node.code
      if (node.app_number) params.app_number = node.app_number
      Object.assign(params, contextParams(node))
    }
    return params
  }

  return {
    treeData,
    treeLoading,
    treeSearch,
    selectedKeys,
    showCode,
    wrappedTree,
    displayTree,
    displayTitle,
    findTreeNode,
    findTreePath,
    reloadTree,
    onLoadMore,
    onTreeSelect,
    buildDrillParams,
  }
}
