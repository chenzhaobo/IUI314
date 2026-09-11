<script setup lang="ts">
/**
 * 实体元数据维度树（左树）
 *
 * 数据：GET /metadata/entity-meta/tree?dimension=&env_id=&product_line=
 *   结构：维度值（云/项目组/业务领域/产品领域）→ 应用 → 菜单（每菜单绑一个表单）
 *   · 应用下「未归类（n）」= 归属该应用但没挂到菜单的实体；
 *   · 顶层「未分类」= 连应用都定不了的实体。
 *
 * 只负责渲染与选中；选中结果用 `select` 事件抛出规范化描述，查询参数由页面自己拼。
 */
import { computed, ref, watch } from 'vue'

import { ApiMetadataEntityMeta } from '@/api/metadataApis'
import { getAction } from '@/hooks'

/** 选中节点的规范化描述 */
export interface TreeScope {
  dimension: string
  kind: 'all' | 'group' | 'app' | 'menu' | 'unclassified'
  /** 维度值 / 应用编码 / 表单编码（按 kind 取义） */
  code: string
  /** 展示名（面包屑/提示用） */
  label: string
  /** 所属应用编码（kind=menu / unclassified 时有值） */
  appNumber: string
}

interface MenuNode {
  id: string
  name: string
  full_path: string
  form_number: string
  entity_count: number
}
interface AppNode {
  app_number: string
  app_name: string
  entity_count: number
  unclassified_count: number
  menus: MenuNode[]
}
interface GroupNode {
  code: string
  name: string
  entity_count: number
  apps: AppNode[]
}
interface TreeResp {
  env: { id: string, name: string }
  dimension: string
  product_line: string
  total: number
  groups: GroupNode[]
  unclassified: AppNode[]
}

const props = withDefaults(defineProps<{
  /** app / project_group / business_area / product_domain */
  dimension: string
  /** 已同步的测试环境；缺省由后端挑「已有数据的环境」 */
  envId?: string
  productLine?: string
}>(), { envId: '', productLine: '' })

const emit = defineEmits<{
  (e: 'select', scope: TreeScope): void
}>()

/** 「未分类」哨兵：值必须与后端 `service::metadata::api_inventory::UNCLASSIFIED_FILTER` 一致 */
const UNCLASSIFIED_FILTER = '__unclassified__'
/** 应用下「未归类」叶子的 key 前缀（区别于应用节点本身） */
const UNCLASSIFIED_KEY = 'u:'

const loading = ref(false)
const envName = ref('')
const groups = ref<GroupNode[]>([])
const unclassified = ref<AppNode[]>([])
const totalEntities = ref(0)
const selectedKeys = ref<string[]>(['all'])

const treeData = computed(() => {
  const root: Record<string, unknown> = {
    key: 'all',
    title: `全部实体（${totalEntities.value}）`,
    children: [] as unknown[],
  }
  const children = root.children as unknown[]
  for (const g of groups.value) {
    children.push({
      key: `g:${g.code}`,
      title: `${g.name || g.code}（${g.entity_count || 0}）`,
      children: (g.apps || []).map(buildAppNode),
    })
  }
  if (unclassified.value.length) {
    const count = unclassified.value.reduce((s, u) => s + (u.entity_count || 0), 0)
    children.push({
      key: `g:${UNCLASSIFIED_FILTER}`,
      title: `未分类（${count}）`,
      children: unclassified.value.map(buildAppNode),
    })
  }
  return [root]
})

function buildAppNode(a: AppNode): Record<string, unknown> {
  const children: unknown[] = []
  for (const m of a.menus || []) {
    children.push({
      key: `m:${m.form_number}`,
      title: `${m.name || m.full_path || m.form_number}（${m.entity_count || 0}）`,
      isLeaf: true,
    })
  }
  if ((a.unclassified_count || 0) > 0) {
    children.push({
      key: `${UNCLASSIFIED_KEY}${a.app_number}`,
      title: `未归类（${a.unclassified_count}）`,
      isLeaf: true,
    })
  }
  return {
    key: `a:${a.app_number}`,
    title: `${a.app_number || '未归属'} ${a.app_name || ''}（${a.entity_count || 0}）`,
    isLeaf: children.length === 0,
    children: children.length ? children : undefined,
    appNumber: a.app_number || '',
  }
}

/** 选中 key → scope（应用编码/表单编码从树数据反查） */
function scopeOf(key: string): TreeScope {
  const dimension = props.dimension
  const findApp = (appNumber: string): AppNode | undefined => {
    for (const g of groups.value) {
      const hit = (g.apps || []).find(a => a.app_number === appNumber)
      if (hit)
        return hit
    }
    return unclassified.value.find(a => a.app_number === appNumber)
  }
  if (key.startsWith('m:')) {
    const formNumber = key.slice(2)
    for (const g of [...groups.value, { apps: unclassified.value } as GroupNode]) {
      for (const a of g.apps || []) {
        const hit = (a.menus || []).find(m => m.form_number === formNumber)
        if (hit) {
          return { dimension, kind: 'menu', code: formNumber, label: hit.name || formNumber, appNumber: a.app_number || '' }
        }
      }
    }
    return { dimension, kind: 'menu', code: formNumber, label: formNumber, appNumber: '' }
  }
  if (key.startsWith(UNCLASSIFIED_KEY)) {
    const appNumber = key.slice(UNCLASSIFIED_KEY.length)
    const app = findApp(appNumber)
    return { dimension, kind: 'unclassified', code: appNumber, label: `${app?.app_name || appNumber} 未归类`, appNumber }
  }
  if (key.startsWith('a:')) {
    const appNumber = key.slice(2)
    const app = findApp(appNumber)
    return { dimension, kind: 'app', code: appNumber, label: app?.app_name || appNumber, appNumber }
  }
  if (key.startsWith('g:'))
    return { dimension, kind: 'group', code: key.slice(2), label: key.slice(2), appNumber: '' }
  return { dimension, kind: 'all', code: '', label: '全部实体', appNumber: '' }
}

function handleSelect(keys: unknown) {
  const list = Array.isArray(keys) ? keys.map(String) : [String(keys)]
  selectedKeys.value = list.length ? list : ['all']
  emit('select', scopeOf(selectedKeys.value[0] || 'all'))
}

async function fetchTree() {
  loading.value = true
  try {
    const res = await getAction<TreeResp>(ApiMetadataEntityMeta.tree, {
      dimension: props.dimension,
      env_id: props.envId || undefined,
      product_line: props.productLine || undefined,
    })
    if (res) {
      envName.value = res.env?.name || ''
      totalEntities.value = res.total || 0
      groups.value = res.groups || []
      unclassified.value = res.unclassified || []
    }
  }
  finally {
    loading.value = false
    // 无条件 emit：树拉失败时页面也要把列表拉一次（否则右表永远空白）
    selectedKeys.value = ['all']
    emit('select', scopeOf('all'))
  }
}

/** 供父级在同步/环境切换后刷新 */
defineExpose({ reload: fetchTree, envName, totalEntities })

watch(
  () => [props.dimension, props.envId, props.productLine],
  () => {
    selectedKeys.value = ['all']
    void fetchTree()
  },
  { immediate: true },
)
</script>

<template>
  <div class="entity-scope-tree">
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
/* 树节点标题很长（应用编码 + 名称 / 菜单名），允许折行而不是撑出横向滚动 */
.entity-scope-tree :deep(.arco-tree-node-title) {
  word-break: break-all;
}
</style>
