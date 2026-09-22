<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { ApiPerfIssue, ApiPerfPatternLedger } from '@/api/perfApis'
import { rateColor, useGet } from '@/hooks'

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
 * 两条源（问题列表 / 问题台账）走同一套接口形状与同一套建树（后端 report::scope_tree）：
 * 一次取回「结构 + 计数 + 当月 3 秒达标率」，表单级展开时再拉。
 *
 * 旧的问题列表路径是聚合千万行的达标率快照视图 + 逐节点 count（最多 500 次），
 * 实测 15 秒级 —— 这是这次合并的由来：快的是取数方式，不是前端。
 */
const isPattern = computed(() => props.source === 'pattern')
const treeEndpoint = computed(() => (isPattern.value ? ApiPerfPatternLedger.scopeTree : ApiPerfIssue.scopeTree))
const drillEndpoint = computed(() => (isPattern.value ? ApiPerfPatternLedger.formDrill : ApiPerfIssue.formDrill))

const productLine = ref('星瀚')
const mode = ref<ScopeMode>('menu')
const keyword = ref('')
const showCode = ref(false)
const selectedKeys = ref<string[]>([ROOT_KEY])
const treeData = ref<any[]>([])
const loading = ref(false)
/** 达标率口径月份（后端按「当月，无当月数据回退最新月」决定）；无快照数据时为空 */
const periodLabel = ref('')
const periodIsCurrentMonth = ref(false)

const treePayload = ref<any>({})
const treeRequest = useGet<any>(treeEndpoint, treePayload, { immediate: false })
const drillPayload = ref<any>({})
const drillRequest = useGet<any>(drillEndpoint, drillPayload, { immediate: false })

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

/** 节点 → 组件内部形状：计数与达标率随结构返回，children 递归归一。 */
function normalizeNode(item: any, parentScope: IssueScopeFilter): any {
  const level = item.level
  const code = String(item.code || '')
  const scope = scopeFor(level, code, parentScope)
  return {
    ...item,
    key: item.key || `${level}:${code}`,
    code,
    title: item.title || item.name || code,
    is_leaf: level === 'form',
    children: Array.isArray(item.children) ? item.children.map((child: any) => normalizeNode(child, scope)) : [],
    scope,
    record_count: Number(item.count || 0),
  }
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

/**
 * 重建：一次取回「范围 → 应用」两级（含计数与达标率），表单级展开时再拉。
 *
 * `resetSelection=true`（换模式/产品线）时回到「全部」并通知右表清范围；
 * false（右表筛选变化）时尽量保住当前选中节点，节点被筛没了才回退到「全部」。
 */
async function reloadTree(resetSelection: boolean) {
  const keepKey = resetSelection ? ROOT_KEY : (selectedKeys.value[0] || ROOT_KEY)
  treePayload.value = {
    mode: mode.value,
    product_line: productLine.value,
    ...props.filters,
  }
  loading.value = true
  try {
    await treeRequest.execute()
    const resp = treeRequest.data.value || {}
    const items = Array.isArray(resp.nodes) ? resp.nodes : []
    periodLabel.value = resp.period?.label || ''
    periodIsCurrentMonth.value = Boolean(resp.period?.is_current_month)
    const children = items.map((item: any) => normalizeNode(item, { product_line: productLine.value }))
    if (children.length) {
      const root: any = createRoot(children)
      root.record_count = children.reduce((sum: number, child: any) => sum + Number(child.record_count || 0), 0)
      // 「全部」取整条产品线的达标率（子节点只覆盖有问题/台账的应用，所以整体可以大于子项之和）
      root.compliance_rate = resp.overall?.compliance_rate ?? null
      root.total_count = resp.overall?.total_count ?? null
      root.over_3s_count = resp.overall?.over_3s_count ?? null
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

/** 应用层展开时懒加载表单节点。 */
async function loadChildren(node: any) {
  if (node.level !== 'app')
    return
  drillPayload.value = {
    app_number: node.code,
    product_line: productLine.value,
    ...props.filters,
  }
  await drillRequest.execute()
  const items = Array.isArray(drillRequest.data.value) ? drillRequest.data.value : []
  node.children = items.map((item: any) => normalizeNode(item, node.scope))
  if (!node.children.length)
    node.is_leaf = true
  const origin = findNode(treeData.value, node.key)
  if (origin && origin !== node) {
    origin.children = node.children
    origin.is_leaf = node.is_leaf
  }
}

function handleSelect(keys: (string | number)[]) {
  const normalizedKeys = keys.map(String)
  selectedKeys.value = normalizedKeys
  const node = normalizedKeys.length ? findNode(treeData.value, normalizedKeys[0]) : null
  emit('change', node?.scope || { product_line: productLine.value })
}

function handleProductLineChange() {
  void reloadTree(true)
}

function handleModeChange() {
  void reloadTree(true)
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

const countLabel = computed(() => (isPattern.value ? '台账数' : '问题数'))
const countUnit = computed(() => (isPattern.value ? '条台账' : '个问题'))
const scopeSourceText = computed(() => (isPattern.value ? '台账全量' : '问题全量'))
const selectedNode = computed(() => {
  const key = selectedKeys.value[0] || ROOT_KEY
  return findNode(treeData.value, key) || treeData.value[0] || null
})
const selectedCount = computed(() => selectedNode.value?.record_count ?? null)
const selectedRate = computed<number | null>(() => selectedNode.value?.compliance_rate ?? null)

function rateText(rate: number | null | undefined) {
  if (rate === null || rate === undefined)
    return '--'
  return `${Number(rate).toFixed(2)}%`
}

const displayTree = computed(() => {
  const search = keyword.value.trim().toLowerCase()
  const filter = (nodes: any[]): any[] => nodes.reduce((result: any[], node: any) => {
    // 计数已按右侧非范围条件统计；明确为 0 的节点没有可展示数据，
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

const treeRenderKey = computed(() => `${productLine.value}:${mode.value}`)

// 右表筛选变化会重载整棵树（后端每次要跑一次月度达标率聚合），加个防抖
let reloadTimer: ReturnType<typeof setTimeout> | null = null
watch(
  () => props.filters,
  () => {
    if (reloadTimer)
      clearTimeout(reloadTimer)
    reloadTimer = setTimeout(() => void reloadTree(false), 300)
  },
  { deep: true },
)

onMounted(() => {
  void reloadTree(true)
})

onUnmounted(() => {
  if (reloadTimer)
    clearTimeout(reloadTimer)
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
    <div class="period-tip">
      范围：{{ scopeSourceText }} · 达标率口径：{{ periodLabel || '—' }}{{ periodLabel && !periodIsCurrentMonth ? '（最近数据月）' : '' }} · 当前：{{ selectedNode?.title || '全部' }}
    </div>
    <div class="scope-stats">
      <span>{{ countLabel }}</span>
      <strong>{{ formatCount(selectedCount) }}</strong>
      <span class="scope-rate" :style="{ color: rateColor(selectedRate) }">3秒达标率 {{ rateText(selectedRate) }}</span>
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
              <!-- 当月 3 秒达标率：项目组判断「先改哪个」的判断基准，与达标率看板同阈值配色 -->
              <a-tooltip>
                <template #content>
                  <div>3 秒达标率：{{ rateText(node.compliance_rate) }}{{ periodLabel ? `（${periodLabel}）` : '' }}</div>
                  <div v-if="node.compliance_rate !== null && node.compliance_rate !== undefined">
                    超3秒 {{ formatCount(node.over_3s_count) }} / 总请求 {{ formatCount(node.total_count) }}
                  </div>
                  <div v-else>
                    暂无当月达标率数据
                  </div>
                </template>
                <span class="node-rate" :style="{ color: rateColor(node.compliance_rate) }">{{ rateText(node.compliance_rate) }}</span>
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
.scope-stats { display: grid; grid-template-columns: auto auto 1fr auto; gap: 8px; align-items: baseline; margin-bottom: 8px; padding: 8px 10px; border-radius: 4px; background: var(--color-fill-2); color: var(--color-text-3); font-size: 12px; }
.scope-stats strong { color: rgb(var(--primary-6)); font-size: 18px; }
.scope-stats small { font-size: 11px; }
.scope-rate { font-variant-numeric: tabular-nums; }
.tree-search { display: flex; gap: 6px; align-items: center; margin-bottom: 8px; color: var(--color-text-3); font-size: 12px; }
.tree-search :deep(.arco-input-wrapper) { flex: 1; }
.tree-content { flex: 1; min-height: 0; overflow: auto; }
.tree-content :deep(.arco-tree-node-title-text) { flex: 1; min-width: 0; }
.tree-node-title { display: flex; align-items: center; justify-content: space-between; gap: 6px; width: 100%; min-width: 0; }
.node-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.node-count { min-width: 20px; flex-shrink: 0; padding: 0 5px; border-radius: 8px; background: var(--color-fill-3); color: var(--color-text-2); font-size: 11px; line-height: 18px; text-align: center; }
.node-rate { min-width: 46px; flex-shrink: 0; font-size: 11px; line-height: 18px; text-align: right; font-variant-numeric: tabular-nums; }
</style>
