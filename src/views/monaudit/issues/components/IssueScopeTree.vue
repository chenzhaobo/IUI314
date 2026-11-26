<script setup lang="ts">
/**
 * 问题清单左树：维度（项目组 / 业务领域 / 产品领域 / 处理人 / 审计类型）+ 带计数的范围树。
 *
 * 节点标题后显示「未关闭 / 总数」；点节点把 node.scope 交给父页面合并进列表查询，点根节点清空范围。
 * 「未归类」等哨兵节点由后端给出。
 */
import type { IssueScope } from '../types'
import { toRef } from 'vue'
import { SCOPE_MODES } from '../types'
import { useScopeTree } from '../useScopeTree'

const props = defineProps<{
  /** 右侧筛选（不含左树范围、分页） */
  filters: object
}>()

const emit = defineEmits<{
  (e: 'change', scope: IssueScope): void
}>()

const { mode, loading, tree, selectedKeys, expandedKeys, load, select } = useScopeTree(
  toRef(props, 'filters'),
  scope => emit('change', scope),
)

function onModeChange() {
  void load(true)
}

void load()

defineExpose({ reload: () => load() })
</script>

<template>
  <div class="scope-tree">
    <a-radio-group v-model="mode" type="button" size="mini" class="scope-modes" @change="onModeChange">
      <a-radio v-for="opt in SCOPE_MODES" :key="opt.value" :value="opt.value">
        {{ opt.label }}
      </a-radio>
    </a-radio-group>
    <div class="scope-legend">
      数字：未关闭 / 总数
    </div>
    <a-spin :loading="loading" class="scope-spin">
      <a-tree
        v-if="tree.length"
        v-model:expanded-keys="expandedKeys"
        :data="tree"
        :selected-keys="selectedKeys"
        block-node
        @select="select"
      >
        <template #title="node">
          <div class="scope-node">
            <span class="scope-name" :title="node.title">{{ node.title }}</span>
            <span class="scope-count" :class="{ 'scope-count-danger': (node.counts?.focus ?? 0) > 0 }">
              {{ node.counts?.focus ?? 0 }}/{{ node.counts?.total ?? 0 }}
            </span>
          </div>
        </template>
      </a-tree>
      <a-empty v-else description="暂无问题" />
    </a-spin>
  </div>
</template>

<style scoped>
.scope-tree { display: flex; flex-direction: column; gap: 6px; }
.scope-modes { flex-wrap: wrap; }
.scope-legend { color: var(--color-text-3); font-size: 12px; }
.scope-spin { width: 100%; }
.scope-node { display: flex; align-items: center; justify-content: space-between; gap: 6px; min-width: 0; }
.scope-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
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
