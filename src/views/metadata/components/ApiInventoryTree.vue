<script setup lang="ts">
/**
 * API 清单维度树（左树）
 *
 * 数据：GET /metadata/api-inventory/tree?dimension=&env_id=&product_line=&depth=&source=
 *   · 两层（depth=app，默认）：维度值（云/项目组/业务领域/产品领域）→ 应用
 *   · 三层（depth=api）：维度值 → 应用 → **API 叶子**（{code: call_path, name, api_count}），
 *     供「API测试用例 / API测试结果」按 API 过滤；source=cases 计数=用例数、results=结果数
 *
 * 只负责渲染与选中；选中结果用 `select` 事件抛出规范化描述，查询参数由页面自己拼 ——
 * 各页的 scope 语义不同（清单页按应用过滤、用例页按 api_path 过滤）。
 */
import { computed, ref, watch } from 'vue'

import { ApiMetadataInventory } from '@/api/metadataApis'
import { getAction } from '@/hooks'

/** 选中节点的规范化描述 */
interface TreeScope {
  dimension: string
  kind: 'all' | 'group' | 'app' | 'api'
  /** 维度值 / 应用编码 / 调用路径（按 kind 取义） */
  code: string
  /** 展示名（面包屑/提示用） */
  label: string
  /** API 叶子所属应用编码（kind=api 时有值） */
  appNumber: string
}

const props = withDefaults(defineProps<{
  /** app / project_group / business_area / product_domain */
  dimension: string
  depth?: 'app' | 'api'
  /** depth=api 时的计数口径：cases / results */
  source?: string
  /** 已同步的测试环境；缺省由后端挑「已有数据的环境」 */
  envId?: string
  productLine?: string
}>(), { depth: 'app', source: '', envId: '', productLine: '' })

const emit = defineEmits<{
  (e: 'select', scope: TreeScope): void
}>()

/** 「未分类」哨兵：库里没有归属（如应用没绑定项目组）的接口归到这一组。
 *  值必须与后端 `service::metadata::api_inventory::UNCLASSIFIED_FILTER` 一致。 */
const UNCLASSIFIED_FILTER = '__unclassified__'

const loading = ref(false)
const envName = ref('')
const groups = ref<any[]>([])
const unclassified = ref<any[]>([])
const totalApis = ref(0)
const selectedKeys = ref<string[]>(['all'])

/** 应用节点下的 API 叶子；字段名以后端为准，多写几个兜底避免树空白 */
function apiLeavesOf(app: any): any[] {
  const raw = app.apis || app.api_list || app.children || []
  return Array.isArray(raw) ? raw : []
}

function buildAppNode(a: any, prefix: string) {
  const node: any = {
    key: `${prefix}${a.app_number}`,
    title: `${a.app_number || '未归属'} ${a.app_name || ''}（${a.api_count || 0}）`,
    appNumber: a.app_number || '',
  }
  const leaves = apiLeavesOf(a)
  if (leaves.length) {
    node.children = leaves.map((api: any) => ({
      key: `p:${api.code}`,
      title: `${api.name || api.code}（${api.api_count || 0}）`,
      isLeaf: true,
      appNumber: a.app_number || '',
    }))
  }
  else {
    node.isLeaf = true
  }
  return node
}

const treeData = computed(() => {
  const root: any = {
    key: 'all',
    title: `全部接口（${totalApis.value}）`,
    children: [] as any[],
  }
  for (const g of groups.value) {
    root.children.push({
      key: `g:${g.code}`,
      title: `${g.name || g.code}（${g.api_count || 0}）`,
      children: (g.apps || []).map((a: any) => buildAppNode(a, 'a:')),
    })
  }
  if (unclassified.value.length) {
    const count = unclassified.value.reduce((s: number, u: any) => s + (u.api_count || 0), 0)
    root.children.push({
      key: `g:${UNCLASSIFIED_FILTER}`,
      title: `未分类（${count}）`,
      children: unclassified.value.map((a: any) => buildAppNode(a, 'a:')),
    })
  }
  return [root]
})

function findApiNode(callPath: string) {
  for (const g of [...groups.value, ...unclassified.value]) {
    for (const a of g.apps || []) {
      const hit = apiLeavesOf(a).find((api: any) => api.code === callPath)
      if (hit)
        return { api: hit, app: a, group: g }
    }
  }
  return null
}

function scopeOf(key: string): TreeScope {
  const dimension = props.dimension
  if (key.startsWith('p:')) {
    const code = key.slice(2)
    const hit = findApiNode(code)
    return {
      dimension,
      kind: 'api',
      code,
      label: hit?.api?.name || code,
      appNumber: hit?.app?.app_number || '',
    }
  }
  if (key.startsWith('a:'))
    return { dimension, kind: 'app', code: key.slice(2), label: key.slice(2), appNumber: key.slice(2) }
  if (key.startsWith('g:'))
    return { dimension, kind: 'group', code: key.slice(2), label: key.slice(2), appNumber: '' }
  return { dimension, kind: 'all', code: '', label: '全部接口', appNumber: '' }
}

function handleSelect(keys: any) {
  const list = Array.isArray(keys) ? keys : [keys]
  selectedKeys.value = list.length ? list : ['all']
  emit('select', scopeOf(selectedKeys.value[0] || 'all'))
}

async function fetchTree() {
  loading.value = true
  try {
    const res = await getAction<any>(ApiMetadataInventory.tree, {
      dimension: props.dimension,
      env_id: props.envId || undefined,
      product_line: props.productLine || undefined,
      depth: props.depth,
      source: props.source || undefined,
    })
    if (res) {
      envName.value = res.env?.name || ''
      totalApis.value = res.total || 0
      groups.value = res.groups || []
      unclassified.value = res.unclassified || []
    }
  }
  finally {
    loading.value = false
    // 维度/产品线切换后旧选中可能已不存在，回到「全部接口」；
    // 无条件 emit：树拉失败时页面也要把列表拉一次（否则右表永远空白）
    selectedKeys.value = ['all']
    emit('select', scopeOf('all'))
  }
}

/** 供父级在同步完成后刷新 */
defineExpose({ reload: fetchTree, envName, totalApis })

watch(
  () => [props.dimension, props.envId, props.productLine, props.depth, props.source],
  () => {
    selectedKeys.value = ['all']
    void fetchTree()
  },
  { immediate: true },
)
</script>

<template>
  <div class="api-scope-tree">
    <a-spin :loading="loading" style="display: block">
      <a-tree
        :data="treeData"
        :selected-keys="selectedKeys"
        block-node
        @select="handleSelect"
      />
      <a-empty v-if="!loading && !groups.length && !unclassified.length" description="暂无数据" />
    </a-spin>
  </div>
</template>

<style scoped>
/* 树节点标题很长（应用编码 + 名称），允许折行而不是撑出横向滚动 */
.api-scope-tree :deep(.arco-tree-node-title) {
  word-break: break-all;
}
</style>
