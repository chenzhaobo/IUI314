<script setup lang="ts">
// 缺陷页左侧「维度树」：规则分布 / 项目组 / 业务领域 / 产品领域，节点带分桶计数。
//
// 口径与取舍（与后端 issue_scope.rs 一致）：
//   · 计数走**与列表同一套筛选**，所以节点数字 = 点它之后列表的 total（含 Excel 导入行）；
//   · 右侧筛选一变就防抖重算（状态/风险/来源/负责人…），保证「树上的数字跟列表对得上」；
//   · 树不随选中节点收窄：结构维度不参与左树自身查询；点节点只收窄右侧列表，点根节点「全部」回到全量；
//   · 展开态跨重载保持（仍存在的已展开 key 不收起，选中节点的祖先链自动展开），
//     只有切换维度才回到默认展开（根 + 第一层，规则分布再加分类层）。
import type { IssueScopeTreeNode } from './ruleCategoryTree'
import type { IssueScopeCounts } from '@/types/static-scan'
import { ref, watch } from 'vue'
import { insertIssueCategoryLevel } from './ruleCategoryTree'
import { fetchIssueScopeTree } from './service'
import { useScanPointCategories } from './useScanPointCategories'

const props = defineProps<{
  /** 与右侧列表同一套筛选（分页/排序/勾选 id 不参与） */
  filters: Record<string, unknown>
}>()

const emit = defineEmits<{
  /** 选中的范围（空对象 = 全部）；父页面据此收窄列表 */
  (e: 'change', scope: Record<string, string>): void
}>()

const ROOT_KEY = 'root'
/** 只在筛选真正变化后重算树，避免连续改动打出一串请求 */
const RELOAD_DEBOUNCE_MS = 300

/**
 * 结构维度：树自己就是按这些维度聚合出来的。
 *
 * 它们若回流进树自身的查询，就会「点节点 → 该筛选进入树请求 → 树只剩该子集 →
 * 其它节点消失」，所以 buildQuery 一律跳过；这些 key 只由父页面用于收窄右侧列表。
 * 与 scopeOfKey 的前缀映射一一对应。
 */
const STRUCTURE_DIMENSION_KEYS = new Set([
  'project_group_id',
  'repository_id',
  'business_area',
  'product_domain',
  'domain',
  'scan_point_id',
  'rule_version_id',
])

const MODE_OPTIONS = [
  { value: 'project_group', label: '项目组' },
  { value: 'business_area', label: '业务领域' },
  { value: 'product_domain', label: '产品领域' },
  { value: 'rule', label: '规则分布' },
] as const

type ScopeMode = (typeof MODE_OPTIONS)[number]['value']

const mode = ref<ScopeMode>('project_group')
const loading = ref(false)
const tree = ref<IssueScopeTreeNode[]>([])
const selectedKeys = ref<string[]>([])
const expandedKeys = ref<string[]>([])
const { scanPointCategories, ensureScanPointCategories } = useScanPointCategories()

/** 树的请求参数：调用方给的筛选 + 维度（分页/排序由调用方剔除，结构维度由组件剔除，保证树结构稳定） */
function buildQuery(): Record<string, string> {
  const query: Record<string, string> = { mode: mode.value }
  for (const [key, value] of Object.entries(props.filters)) {
    if (STRUCTURE_DIMENSION_KEYS.has(key))
      continue
    if (value !== '' && value != null)
      query[key] = String(value)
  }
  return query
}

/** 节点 key → 要写回列表的范围（前缀语义见后端 issue_scope.rs 模块头） */
function scopeOfKey(key: string): Record<string, string> {
  const sep = key.indexOf(':')
  if (sep < 0)
    return {}
  const prefix = key.slice(0, sep)
  const value = key.slice(sep + 1)
  switch (prefix) {
    case 'repo': return { repository_id: value }
    case 'pg': return { project_group_id: value }
    case 'ba': return { business_area: value }
    case 'pd': return { product_domain: value }
    case 'dom': return { domain: value }
    case 'sp': return { scan_point_id: value }
    case 'rule': return { rule_version_id: value }
    default: return {}
  }
}

/** key → 父节点 key（根节点的父为 ''），用于把选中节点的祖先链展开 */
function indexParents(nodes: IssueScopeTreeNode[], parentKey: string, out: Map<string, string>): void {
  for (const node of nodes) {
    out.set(node.key, parentKey)
    indexParents(node.children ?? [], node.key, out)
  }
}

/** 默认展开：根 + 第一层（维度节点）；规则分布再展开分类层。应用层按需展开 */
function defaultExpandedKeys(root: IssueScopeTreeNode | null): string[] {
  if (!root)
    return []
  const firstLevel = root.children ?? []
  const categoryLevel = mode.value === 'rule'
    ? firstLevel.flatMap(child => (child.children ?? []).map(grand => grand.key))
    : []
  return [root.key, ...firstLevel.map(child => child.key), ...categoryLevel]
}

/** 自下而上取祖先链（不含自身），用于保证选中节点在新树里可见 */
function ancestorKeys(key: string | undefined, parents: Map<string, string>): string[] {
  const out: string[] = []
  let current = key ? parents.get(key) : undefined
  while (current) {
    out.push(current)
    current = parents.get(current)
  }
  return out
}

async function load(resetSelection = false) {
  loading.value = true
  try {
    if (resetSelection) {
      selectedKeys.value = []
      emit('change', {})
    }
    const isRuleMode = mode.value === 'rule'
    // 规则分布：与规则版本页同一层级（域 → 分类 → 扫描点 → 规则），分类取自扫描点树
    const [data] = await Promise.all([
      fetchIssueScopeTree(buildQuery()),
      isRuleMode ? ensureScanPointCategories() : Promise.resolve(),
    ])
    let root: IssueScopeTreeNode | null = null
    if (data?.key)
      root = isRuleMode ? insertIssueCategoryLevel(data, scanPointCategories.value) : data
    tree.value = root ? [root] : []
    const parents = new Map<string, string>()
    if (root)
      indexParents([root], '', parents)
    // 展开态跨重载保持：只保留仍在新树里的已展开 key，并确保选中节点的祖先链展开；
    // 只有切换维度（resetSelection）才回到默认展开
    const kept = resetSelection
      ? defaultExpandedKeys(root)
      : [...expandedKeys.value].filter(key => parents.has(key))
    const selectedKey = selectedKeys.value[0]
    expandedKeys.value = root
      ? [...new Set([...kept, ...ancestorKeys(selectedKey, parents)])]
      : []
    // 选中节点被新筛选筛没了：静默清掉选中态（范围已写过列表，不重复通知父页面）
    if (selectedKey && !parents.has(selectedKey))
      selectedKeys.value = []
  }
  finally {
    loading.value = false
  }
}

/** 供父页面在批量操作后主动刷新（那些操作不改筛选，watcher 不会触发） */
function reload() {
  void load()
}

defineExpose({ reload })

let debounceTimer: ReturnType<typeof setTimeout> | undefined
// 按序列化结果比对：父页面的筛选对象每次计算都会换新身份（含翻页这类改动），
// 直接 deep watch 会白刷一次树；筛选字段本身没变就不该重算
watch(() => JSON.stringify(props.filters ?? {}), () => {
  if (debounceTimer)
    clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => void load(), RELOAD_DEBOUNCE_MS)
})

// 首帧直接拉（不走防抖）
void load()

/** 切维度：清掉旧范围（上一个维度的范围在新维度里没有意义）再重拉 */
function onModeChange() {
  void load(true)
}

function onSelect(keys: (string | number)[]) {
  const key = keys.length ? String(keys[0]) : ROOT_KEY
  selectedKeys.value = [key]
  emit('change', scopeOfKey(key))
}

/** 节点悬浮提示：四个桶 + 总数（胶囊里只放总数，避免左树变宽） */
function countsText(counts: IssueScopeCounts): string {
  return `待修复 ${counts.pending} · 处理中 ${counts.in_progress} · 已处理 ${counts.handled} · 不处理 ${counts.wont_fix} · 共 ${counts.total}`
}
</script>

<template>
  <a-card :bordered="false" size="small" class="split-card scroll-body">
    <template #title>
      <div class="scope-head">
        <a-select v-model="mode" size="small" style="width: 104px" @change="onModeChange">
          <a-option v-for="opt in MODE_OPTIONS" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </a-option>
        </a-select>
        <span class="scope-legend">数字与右侧列表口径一致</span>
      </div>
    </template>
    <a-spin :loading="loading" style="width: 100%">
      <a-tree
        v-if="tree.length"
        v-model:expanded-keys="expandedKeys"
        :data="tree"
        :selected-keys="selectedKeys"
        @select="onSelect"
      >
        <template #title="node">
          <div class="scope-node">
            <span class="scope-name" :title="node.title">{{ node.title }}</span>
            <a-tooltip position="right" mini :content="countsText(node.counts)">
              <span class="scope-count">{{ node.counts?.total ?? 0 }}</span>
            </a-tooltip>
          </div>
        </template>
      </a-tree>
      <a-empty v-else description="暂无缺陷" />
    </a-spin>
  </a-card>
</template>

<style scoped>
/* 与右侧表格栏同款的栏布局约定：卡片撑满栏高但自己不滚，内容区滚动（标题固定）。
   注意不能借用父页面的 scoped 类 —— scoped 样式作用不到子组件内部 */
.split-card { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.scroll-body :deep(.arco-card-body) {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  /* 只写 overflow-y 时横向会被计算成 auto，探出的子元素会长出横向滚动条 */
  overflow-x: hidden;
}
.scope-head { display: flex; align-items: center; gap: 8px; }
.scope-legend { color: var(--color-text-3); font-size: 12px; font-weight: 400; }
.scope-node { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.scope-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* 总数胶囊：灰底小圆角，跟性能问题台账左树一致 */
.scope-count {
  flex-shrink: 0;
  padding: 0 6px;
  color: var(--color-text-2);
  font-size: 12px;
  line-height: 16px;
  background: var(--color-fill-2);
  border-radius: 8px;
}
</style>
