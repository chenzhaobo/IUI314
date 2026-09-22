<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ApiPerfCompliance, ApiPerfIssue, ApiPerfPatternLedger } from '@/api/perfApis'
import { useGet, usePost } from '@/hooks'

interface IssueScopeFilter {
  product_line: string
  project_group_code?: string
  cloud_number?: string
  business_area?: string
  product_domain?: string
  app_number?: string
  form_id?: string
}

interface Props {
  source: 'issue' | 'pattern'
  filters?: Record<string, unknown>
}

type ScopeMode = 'menu' | 'project_group' | 'business_area' | 'product_domain'

const props = withDefaults(defineProps<Props>(), {
  filters: () => ({}),
})
const emit = defineEmits<{
  change: [scope: IssueScopeFilter]
}>()
const ROOT_KEY = 'root:all'
/**
 * 台账源（问题台账页）：结构与计数走台账驱动接口（scope-tree / form-drill），
 * 不依赖达标率周期与快照 —— 旧结构来自 500 万行快照，实测 15 秒级且受 500 节点上限约束；
 * 台账自身字段分组又快又只出现有数据的节点。
 */
const ledgerMode = props.source === 'pattern'

const productLine = ref('星瀚')
const mode = ref<ScopeMode>('menu')
const selectedPeriod = ref('')
const periodLabel = ref('')
const keyword = ref('')
const showCode = ref(false)
const selectedKeys = ref<string[]>([ROOT_KEY])
const treeData = ref<any[]>([])
const loading = ref(false)

const periodPayload = ref<any>({ period_type: 'monthly', product_line: productLine.value })
const { execute: fetchPeriods } = useGet<any>(ApiPerfCompliance.periodOptions, periodPayload, {
  // 台账源没有周期概念（结构与计数来自台账自身），不发这个请求
  immediate: !ledgerMode,
  onSuccess(data: any) {
    const periods = Array.isArray(data) ? data : []
    selectedPeriod.value = periods[0]?.period || ''
    periodLabel.value = periods[0]?.label || selectedPeriod.value
    void reloadTree()
  },
})

const treePayload = ref<any>({})
const treeRequest = useGet<any>(ApiPerfCompliance.tree, treePayload, { immediate: false })
const drillPayload = ref<any>({})
const drillRequest = useGet<any>(ApiPerfCompliance.drill, drillPayload, { immediate: false })
// 台账驱动请求：结构与计数一次取回；表单级由 form-drill 懒加载
const ledgerTreePayload = ref<any>({})
const ledgerTreeRequest = useGet<any>(ApiPerfPatternLedger.scopeTree, ledgerTreePayload, { immediate: false })
const ledgerDrillPayload = ref<any>({})
const ledgerDrillRequest = useGet<any>(ApiPerfPatternLedger.formDrill, ledgerDrillPayload, { immediate: false })
const countEndpoint = computed(() => props.source === 'issue' ? ApiPerfIssue.scopeCounts : ApiPerfPatternLedger.scopeCounts)
const countPayload = ref<any>({ filters: {}, scopes: [] })
const countRequest = usePost<any>(countEndpoint, countPayload, { immediate: false })
let countGeneration = 0

function scopeFor(level: string, code: string, parentScope: IssueScopeFilter): IssueScopeFilter {
  const scope = { ...parentScope }
  if (level === 'cloud')
    scope.cloud_number = code
  if (level === 'project_group')
    scope.project_group_code = code
  if (level === 'business_area')
    scope.business_area = code
  if (level === 'product_domain')
    scope.product_domain = code
  if (level === 'app')
    scope.app_number = code
  if (level === 'form')
    scope.form_id = code
  return scope
}

function normalizeNodes(items: any[], parentScope: IssueScopeFilter): any[] {
  return items.map((item: any) => {
    const level = item.level
    const code = String(item.code || '')
    const scope = scopeFor(level, code, parentScope)
    return {
      ...item,
      key: item.key || `${level}:${code}`,
      code,
      title: item.title || item.name || code,
      is_leaf: level === 'form',
      children: [],
      scope,
      record_count: null,
    }
  })
}

function createRoot(children: any[]) {
  return {
    key: ROOT_KEY,
    code: '',
    title: '全部',
    level: 'root',
    is_leaf: false,
    children,
    scope: { product_line: productLine.value },
    record_count: null,
  }
}

function flattenNodes(nodes: any[]): any[] {
  return nodes.flatMap(node => [node, ...flattenNodes(node.children || [])])
}

async function loadRecordCounts(nodes: any[]) {
  if (!nodes.length)
    return
  const generation = ++countGeneration
  countPayload.value = {
    filters: { ...props.filters },
    period_type: 'monthly',
    period: selectedPeriod.value,
    scopes: nodes.map(node => ({ key: node.key, ...node.scope })),
  }
  await countRequest.execute()
  if (generation !== countGeneration)
    return
  const counts = Array.isArray(countRequest.data.value) ? countRequest.data.value : []
  counts.forEach((item: any) => {
    const node = findNode(treeData.value, String(item.key || ''))
    if (node)
      node.record_count = Number(item.count || 0)
  })
}

async function refreshAllCounts() {
  await loadRecordCounts(flattenNodes(treeData.value))
}

async function reloadTree() {
  selectedKeys.value = [ROOT_KEY]
  treeData.value = []
  emit('change', { product_line: productLine.value })
  if (!selectedPeriod.value)
    return
  treePayload.value = {
    period_type: 'monthly',
    period: selectedPeriod.value,
    product_line: productLine.value,
    dimension: mode.value,
  }
  loading.value = true
  try {
    await treeRequest.execute()
    const items = Array.isArray(treeRequest.data.value) ? treeRequest.data.value : []
    const children = normalizeNodes(items, { product_line: productLine.value })
    treeData.value = children.length ? [createRoot(children)] : []
    await refreshAllCounts()
  }
  finally {
    loading.value = false
  }
}

/** 台账树节点 → 组件内部形状：计数随结构返回（record_count），children 递归归一。 */
function normalizeLedgerNode(item: any, parentScope: IssueScopeFilter): any {
  const level = item.level
  const code = String(item.code || '')
  const scope = scopeFor(level, code, parentScope)
  return {
    ...item,
    key: item.key || `${level}:${code}`,
    code,
    title: item.title || item.name || code,
    is_leaf: level === 'form',
    children: Array.isArray(item.children) ? item.children.map((child: any) => normalizeLedgerNode(child, scope)) : [],
    scope,
    record_count: Number(item.count || 0),
  }
}

/**
 * 台账源重建：一次取回「范围→应用」两级（含计数），表单级展开时再拉。
 *
 * `resetSelection=true`（换模式/产品线）时回到「全部」并通知右表清范围；
 * false（右表筛选变化）时尽量保住当前选中节点，节点被筛没了才回退到「全部」。
 */
async function reloadLedgerTree(resetSelection: boolean) {
  const keepKey = resetSelection ? ROOT_KEY : (selectedKeys.value[0] || ROOT_KEY)
  ledgerTreePayload.value = {
    mode: mode.value,
    product_line: productLine.value,
    ...props.filters,
  }
  loading.value = true
  try {
    await ledgerTreeRequest.execute()
    const items = Array.isArray(ledgerTreeRequest.data.value) ? ledgerTreeRequest.data.value : []
    const children = items.map((item: any) => normalizeLedgerNode(item, { product_line: productLine.value }))
    if (children.length) {
      const root: any = createRoot(children)
      root.record_count = children.reduce((sum: number, child: any) => sum + Number(child.record_count || 0), 0)
      treeData.value = [root]
    }
    else {
      treeData.value = []
    }
    if (resetSelection) {
      selectedKeys.value = [ROOT_KEY]
      emit('change', { product_line: productLine.value })
    }
    else if (findNode(treeData.value, keepKey)) {
      selectedKeys.value = [keepKey]
    }
    else {
      selectedKeys.value = [ROOT_KEY]
      emit('change', { product_line: productLine.value })
    }
  }
  finally {
    loading.value = false
  }
}

async function loadChildren(node: any) {
  if (ledgerMode) {
    // 范围/云层的应用子节点已在树响应里；应用层展开才拉表单
    if (node.level !== 'app')
      return
    ledgerDrillPayload.value = {
      app_number: node.code,
      product_line: productLine.value,
      ...props.filters,
    }
    await ledgerDrillRequest.execute()
    const items = Array.isArray(ledgerDrillRequest.data.value) ? ledgerDrillRequest.data.value : []
    node.children = items.map((item: any) => normalizeLedgerNode(item, node.scope))
    if (!node.children.length)
      node.is_leaf = true
    const origin = findNode(treeData.value, node.key)
    if (origin && origin !== node) {
      origin.children = node.children
      origin.is_leaf = node.is_leaf
    }
    return
  }
  if (node.level === 'root' || node.level === 'form')
    return
  const params: any = {
    period_type: 'monthly',
    period: selectedPeriod.value,
    product_line: productLine.value,
  }
  if (node.level === 'cloud') {
    params.level = 'app'
    params.cloud_number = node.code
  }
  else if (node.level === 'project_group') {
    params.level = 'app'
    params.project_group_code = node.code
  }
  else if (node.level === 'business_area') {
    params.level = 'app'
    params.business_area = node.code
  }
  else if (node.level === 'product_domain') {
    params.level = 'app'
    params.product_domain = node.code
  }
  else if (node.level === 'app') {
    params.level = 'form'
    params.app_number = node.code
  }
  else {
    return
  }
  drillPayload.value = params
  await drillRequest.execute()
  const items = Array.isArray(drillRequest.data.value) ? drillRequest.data.value : []
  node.children = normalizeNodes(items, node.scope)
  if (!node.children.length)
    node.is_leaf = true
  const origin = findNode(treeData.value, node.key)
  if (origin && origin !== node) {
    origin.children = node.children
    origin.is_leaf = node.is_leaf
  }
  await loadRecordCounts(node.children)
}

function findNode(nodes: any[], key: string): any {
  for (const node of nodes) {
    if (node.key === key)
      return node
    const child = node.children?.length ? findNode(node.children, key) : null
    if (child)
      return child
  }
  return null
}

function handleSelect(keys: (string | number)[]) {
  const normalizedKeys = keys.map(String)
  selectedKeys.value = normalizedKeys
  const node = normalizedKeys.length ? findNode(treeData.value, normalizedKeys[0]) : null
  emit('change', node?.scope || { product_line: productLine.value })
}

function handleProductLineChange() {
  if (ledgerMode) {
    void reloadLedgerTree(true)
    return
  }
  selectedPeriod.value = ''
  periodLabel.value = ''
  periodPayload.value = { period_type: 'monthly', product_line: productLine.value }
  void fetchPeriods()
}

function handleModeChange() {
  void (ledgerMode ? reloadLedgerTree(true) : reloadTree())
}

function nodeTitle(node: any) {
  if (!showCode.value || !node.code || node.title === node.code)
    return node.title
  return `${node.title} (${node.code})`
}

function formatCount(value: unknown) {
  if (value === null || value === undefined)
    return '--'
  return Number(value || 0).toLocaleString('zh-CN')
}

const countLabel = computed(() => props.source === 'issue' ? '问题数' : '台账数')
const countUnit = computed(() => props.source === 'issue' ? '个问题' : '条台账')
const selectedNode = computed(() => {
  const key = selectedKeys.value[0] || ROOT_KEY
  return findNode(treeData.value, key) || treeData.value[0] || null
})
const selectedCount = computed(() => selectedNode.value?.record_count ?? null)

const displayTree = computed(() => {
  const search = keyword.value.trim().toLowerCase()
  const filter = (nodes: any[]): any[] => nodes.reduce((result: any[], node: any) => {
    // scope-counts 已按右侧非范围条件统计；明确为 0 的节点没有可展示数据，
    // 不再让用户展开后看到空表。null 表示计数仍在加载，先保留以避免闪烁。
    if (node.record_count !== null && node.record_count !== undefined && Number(node.record_count) <= 0)
      return result
    const children = node.children?.length ? filter(node.children) : []
    const matched = !search || `${node.title} ${node.code}`.toLowerCase().includes(search)
    if (matched || children.length)
      result.push({ ...node, children })
    return result
  }, [])
  return filter(treeData.value)
})

const treeRenderKey = computed(() => `${productLine.value}:${mode.value}:${selectedPeriod.value}`)

watch(
  () => props.filters,
  () => { void (ledgerMode ? reloadLedgerTree(false) : refreshAllCounts()) },
  { deep: true },
)

// 台账源没有周期请求驱动首次加载，挂载时自己拉一次
onMounted(() => {
  if (ledgerMode)
    void reloadLedgerTree(true)
})
</script>

<template>
  <div class="issue-scope-tree">
    <div class="tree-toolbar">
      <a-select v-model="productLine" size="small" @change="handleProductLineChange">
        <a-option value="星瀚">
          星瀚
        </a-option>
        <a-option value="星空">
          星空
        </a-option>
      </a-select>
      <a-select v-model="mode" size="small" @change="handleModeChange">
        <a-option value="menu">
          菜单
        </a-option>
        <a-option value="project_group">
          项目组
        </a-option>
        <a-option value="business_area">
          业务领域
        </a-option>
        <a-option value="product_domain">
          产品领域
        </a-option>
      </a-select>
    </div>
    <div v-if="!ledgerMode" class="period-tip">
      范围周期：{{ periodLabel || '加载中…' }} · 当前：{{ selectedNode?.title || '全部' }}
    </div>
    <div v-else class="period-tip">
      范围：台账全量 · 当前：{{ selectedNode?.title || '全部' }}
    </div>
    <div class="scope-stats">
      <span>{{ countLabel }}</span>
      <strong>{{ formatCount(selectedCount) }}</strong>
      <small>与右侧筛选一致</small>
    </div>
    <div class="tree-search">
      <a-input-search v-model="keyword" size="small" placeholder="搜索范围/应用/表单" allow-clear />
      <a-switch v-model="showCode" size="small" />
      <span>编码</span>
    </div>
    <div class="tree-content">
      <a-spin :loading="loading" style="width: 100%">
        <a-tree
          v-if="displayTree.length"
          :key="treeRenderKey"
          :data="displayTree"
          :default-expanded-keys="[ROOT_KEY]"
          :field-names="{ key: 'key', title: 'title', children: 'children', isLeaf: 'is_leaf' }"
          :load-more="loadChildren"
          :selected-keys="selectedKeys"
          block-node
          show-line
          @select="handleSelect"
        >
          <template #title="node">
            <span class="tree-node-title">
              <span class="node-name">{{ nodeTitle(node) }}</span>
              <a-tooltip :content="`${countLabel}：${formatCount(node.record_count)} ${countUnit}`">
                <span class="node-count">{{ formatCount(node.record_count) }}</span>
              </a-tooltip>
            </span>
          </template>
        </a-tree>
        <a-empty v-else description="暂无范围数据" />
      </a-spin>
    </div>
  </div>
</template>

<style scoped>
.issue-scope-tree { height: 100%; display: flex; flex-direction: column; min-height: 420px; }
.tree-toolbar { display: grid; grid-template-columns: 92px 1fr; gap: 8px; }
.period-tip { margin: 8px 0 6px; color: var(--color-text-3); font-size: 12px; }
.scope-stats { display: grid; grid-template-columns: auto 1fr auto; gap: 8px; align-items: baseline; margin-bottom: 8px; padding: 8px 10px; border-radius: 4px; background: var(--color-fill-2); color: var(--color-text-3); font-size: 12px; }
.scope-stats strong { color: rgb(var(--primary-6)); font-size: 18px; }
.scope-stats small { font-size: 11px; }
.tree-search { display: flex; gap: 6px; align-items: center; margin-bottom: 8px; color: var(--color-text-3); font-size: 12px; }
.tree-search :deep(.arco-input-wrapper) { flex: 1; }
.tree-content { flex: 1; min-height: 0; overflow: auto; }
.tree-content :deep(.arco-tree-node-title-text) { flex: 1; min-width: 0; }
.tree-node-title { display: flex; align-items: center; justify-content: space-between; gap: 6px; width: 100%; min-width: 0; }
.node-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.node-count { min-width: 20px; flex-shrink: 0; padding: 0 5px; border-radius: 8px; background: var(--color-fill-3); color: var(--color-text-2); font-size: 11px; line-height: 18px; text-align: center; }
</style>
