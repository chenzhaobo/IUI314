<script setup lang="ts">
/**
 * 发版左树：维度下拉 + 搜索 + 带重点计数的范围树。
 *
 * 数据与状态都在 `useReleaseScopeTree`；本组件只渲染并转发点选。
 * 结构维度变化不会让树塌缩（点节点只收窄右侧列表）。
 */
import type { TreeModeOption } from '../../composables/useReleaseScopeTree'
import type { ReleaseScopeTreeNode, ReleaseScopeTreeResponse, ReleaseTreeScope } from '@/types/sechub-release'
import { computed, ref, toRef } from 'vue'

import { countsText, filterTreeByKeyword } from '../../composables/releaseScopeTreeRules'
import { useReleaseScopeTree } from '../../composables/useReleaseScopeTree'

const props = defineProps<{
  fetcher: (query: Record<string, string | number | boolean>) => Promise<ReleaseScopeTreeResponse | null>
  /** 页面当前列表 query（结构键 / 分页键由 composable 剔除） */
  query: object
  /** 当前范围选择，用于高亮 */
  selectedScope: ReleaseTreeScope
  modes: TreeModeOption[]
  /** 记住 mode 的存储键 */
  persistKey: string
}>()

const emit = defineEmits<{
  (e: 'select', scope: ReleaseTreeScope): void
}>()

const keyword = ref('')
const {
  mode,
  loading,
  root,
  labels,
  expandedKeys,
  selectedKeys,
  resolveScope,
  reload,
} = useReleaseScopeTree({
  fetcher: props.fetcher,
  query: toRef(props, 'query'),
  selectedScope: toRef(props, 'selectedScope'),
  modes: toRef(props, 'modes'),
  persistKey: props.persistKey,
})

function pruneEmpty(node: ReleaseScopeTreeNode): ReleaseScopeTreeNode | null {
  if (node.counts.total === 0 && node.counts.focus === 0)
    return null
  const children = (node.children ?? [])
    .map(child => pruneEmpty(child))
    .filter((child): child is ReleaseScopeTreeNode => child !== null)
  return { ...node, children }
}

const treeData = computed<ReleaseScopeTreeNode[]>(() => {
  if (!root.value)
    return []
  const pruned = pruneEmpty(root.value)
  if (!pruned)
    return []
  const filtered = filterTreeByKeyword(pruned, keyword.value)
  return filtered ? [filtered] : []
})

function onSelect(keys: (string | number)[]) {
  emit('select', resolveScope(keys))
}

defineExpose({ reload })
</script>

<template>
  <a-card :bordered="false" size="small" class="split-card scroll-body">
    <template #title>
      <div class="scope-head">
        <a-select v-model="mode" size="small" style="width: 104px">
          <a-option v-for="opt in modes" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </a-option>
        </a-select>
        <a-input v-model="keyword" size="small" placeholder="搜索节点" allow-clear class="scope-search" />
      </div>
    </template>
    <a-spin :loading="loading" style="width: 100%">
      <a-tree
        v-if="treeData.length"
        v-model:expanded-keys="expandedKeys"
        :data="treeData"
        :selected-keys="selectedKeys"
        @select="onSelect"
      >
        <template #title="node">
          <div class="scope-node">
            <span class="scope-name" :title="node.title">{{ node.title }}</span>
            <a-tooltip position="right" mini :content="countsText(node.counts, labels)">
              <span
                class="scope-count"
                :class="{ 'scope-count-danger': (node.counts?.focus ?? 0) > 0 }"
              >{{ node.counts?.focus ?? 0 }}</span>
            </a-tooltip>
          </div>
        </template>
      </a-tree>
      <a-empty v-else description="暂无数据" />
    </a-spin>
  </a-card>
</template>

<style scoped>
/* 与右侧表格栏同款的栏布局约定：卡片撑满栏高但自己不滚，内容区滚动（标题固定） */
.split-card { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.scroll-body :deep(.arco-card-body) {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  /* 只写 overflow-y 时横向会被计算成 auto，探出的子元素会长出横向滚动条 */
  overflow-x: hidden;
}
.scope-head { display: flex; align-items: center; gap: 8px; }
.scope-search { flex: 1; min-width: 90px; }
.scope-node { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.scope-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* 重点计数胶囊：有重点用危险色浅底，没有用灰底 */
.scope-count {
  flex-shrink: 0;
  padding: 0 6px;
  color: var(--color-text-2);
  font-size: 12px;
  line-height: 16px;
  background: var(--color-fill-2);
  border-radius: 8px;
}
.scope-count-danger {
  color: var(--color-danger-6);
  background: var(--color-danger-light-1);
}
</style>
