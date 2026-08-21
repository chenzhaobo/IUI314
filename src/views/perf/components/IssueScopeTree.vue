<script setup lang="ts">
import { computed, ref } from 'vue'
import { ApiPerfCompliance } from '@/api/perfApis'
import { useGet } from '@/hooks'

interface IssueScopeFilter {
  product_line: string
  project_group_code?: string
  cloud_number?: string
  app_number?: string
  form_id?: string
}

const emit = defineEmits<{
  change: [scope: IssueScopeFilter]
}>()

const productLine = ref('星瀚')
const mode = ref<'menu' | 'project_group'>('menu')
const selectedPeriod = ref('')
const periodLabel = ref('')
const keyword = ref('')
const showCode = ref(false)
const selectedKeys = ref<string[]>([])
const treeData = ref<any[]>([])
const loading = ref(false)

const periodPayload = ref<any>({ period_type: 'monthly', product_line: productLine.value })
const { execute: fetchPeriods } = useGet<any>(ApiPerfCompliance.periodOptions, periodPayload, {
  immediate: true,
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

function scopeFor(level: string, code: string, parentScope: IssueScopeFilter): IssueScopeFilter {
  const scope = { ...parentScope }
  if (level === 'cloud')
    scope.cloud_number = code
  if (level === 'project_group')
    scope.project_group_code = code
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
    }
  })
}

async function reloadTree() {
  selectedKeys.value = []
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
    treeData.value = normalizeNodes(items, { product_line: productLine.value })
  }
  finally {
    loading.value = false
  }
}

async function loadChildren(node: any) {
  if (node.level === 'form')
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

function handleSelect(keys: string[]) {
  selectedKeys.value = keys
  const node = keys.length ? findNode(treeData.value, keys[0]) : null
  emit('change', node?.scope || { product_line: productLine.value })
}

function handleProductLineChange() {
  selectedPeriod.value = ''
  periodLabel.value = ''
  periodPayload.value = { period_type: 'monthly', product_line: productLine.value }
  void fetchPeriods()
}

function handleModeChange() {
  void reloadTree()
}

function nodeTitle(node: any) {
  if (!showCode.value || !node.code || node.title === node.code)
    return node.title
  return `${node.title} (${node.code})`
}

const displayTree = computed(() => {
  const search = keyword.value.trim().toLowerCase()
  if (!search)
    return treeData.value
  const filter = (nodes: any[]): any[] => nodes.reduce((result: any[], node: any) => {
    const children = node.children?.length ? filter(node.children) : []
    const matched = `${node.title} ${node.code}`.toLowerCase().includes(search)
    if (matched || children.length)
      result.push({ ...node, children })
    return result
  }, [])
  return filter(treeData.value)
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
      <a-radio-group v-model="mode" type="button" size="small" @change="handleModeChange">
        <a-radio value="menu">
          菜单
        </a-radio>
        <a-radio value="project_group">
          项目组
        </a-radio>
      </a-radio-group>
    </div>
    <div class="period-tip">
      数据周期：{{ periodLabel || '加载中…' }}
    </div>
    <div class="tree-search">
      <a-input-search v-model="keyword" size="small" placeholder="搜索云/项目组/应用/表单" allow-clear />
      <a-switch v-model="showCode" size="small" />
      <span>编码</span>
    </div>
    <div class="tree-content">
      <a-spin :loading="loading" style="width: 100%">
        <a-tree
          v-if="displayTree.length"
          :data="displayTree"
          :field-names="{ key: 'key', title: 'title', children: 'children', isLeaf: 'is_leaf' }"
          :load-more="loadChildren"
          :selected-keys="selectedKeys"
          block-node
          show-line
          @select="handleSelect"
        >
          <template #title="node">
            <span>{{ nodeTitle(node) }}</span>
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
.period-tip { margin: 8px 0; color: var(--color-text-3); font-size: 12px; }
.tree-search { display: flex; gap: 6px; align-items: center; margin-bottom: 8px; color: var(--color-text-3); font-size: 12px; }
.tree-search :deep(.arco-input-wrapper) { flex: 1; }
.tree-content { flex: 1; min-height: 0; overflow: auto; }
</style>
