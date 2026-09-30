<script setup lang="ts">
/**
 * 运行页左侧「应用范围」树（维度 → 分组 → 仓库）。
 *
 * 只做渲染与事件转发：树数据、选中状态、持久化都在 useRepoScopeTree，
 * change 事件把解析好的范围（仓库 id / 仓库 id 集合 / 范围名）交给调用方。
 */
import type { RepoScope } from './useRepoScopeTree'
import { ref, watch } from 'vue'
import { useAutoHeight } from '@/hooks'
import { useRepoScopeTree } from './useRepoScopeTree'

const emit = defineEmits<{
  /** 范围变化（含挂载时从暂存恢复出的范围）；对同一范围只触发一次 */
  (e: 'change', scope: RepoScope): void
}>()

const {
  loading,
  dimension,
  treeSearch,
  showCode,
  selectedKey,
  expandedKeys,
  displayTree,
  scope,
  scopeFingerprint,
  onDimensionChange,
  onTreeSelect,
  selectRepo,
} = useRepoScopeTree()

const bodyRef = ref<HTMLElement>()
// 树体按「面板到视口底部」实测限高，内部滚动，不跟着右侧长列表整页滚
const { style: bodyStyle } = useAutoHeight(bodyRef)

// 按指纹而不是 watch(scope)：scope 是计算属性，仓库列表加载完成这类无关变化
// 也会换新对象身份，直接 watch 会对同一范围重复触发重载
watch(scopeFingerprint, () => emit('change', { ...scope.value }))

defineExpose({ selectRepo })
</script>

<template>
  <a-card :bordered="false" class="scope-card">
    <template #title>
      <div class="scope-head">
        <span>应用范围</span>
        <span class="scope-hint">右侧运行记录跟随所选范围</span>
      </div>
    </template>
    <div class="scope-toolbar">
      <a-radio-group v-model="dimension" type="button" size="mini" @change="onDimensionChange">
        <a-radio value="project_group">
          项目组
        </a-radio>
        <a-radio value="business_area">
          业务领域
        </a-radio>
        <a-radio value="product_domain">
          产品领域
        </a-radio>
      </a-radio-group>
      <div class="scope-search">
        <a-input-search v-model="treeSearch" size="small" placeholder="搜索应用" allow-clear />
        <a-button size="small" :type="showCode ? 'primary' : 'outline'" @click="showCode = !showCode">
          编码
        </a-button>
      </div>
    </div>
    <div ref="bodyRef" class="scope-body" :style="bodyStyle">
      <a-spin :loading="loading" style="width: 100%">
        <a-tree
          v-if="displayTree.length"
          v-model:expanded-keys="expandedKeys"
          :data="displayTree"
          :selected-keys="[selectedKey]"
          show-line
          block-node
          @select="onTreeSelect"
        />
        <a-empty v-else description="暂无已绑定仓库的应用" />
      </a-spin>
    </div>
  </a-card>
</template>

<style scoped>
.scope-card { display: flex; flex-direction: column; }
.scope-head { display: flex; align-items: baseline; gap: 8px; }
.scope-hint { color: var(--color-text-3); font-size: 12px; font-weight: 400; }
.scope-toolbar { display: flex; flex-direction: column; gap: 8px; margin-bottom: 8px; }
.scope-search { display: flex; gap: 8px; }
.scope-search :deep(.arco-input-search) { flex: 1; }
.scope-body { overflow-y: auto; overflow-x: hidden; }
</style>
